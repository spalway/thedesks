-- =========================================================================
-- xNFTs database setup — PART 08 of 08
-- =========================================================================
--
-- Run these IN ORDER, one at a time, in the Supabase SQL Editor.
-- Wait for each to finish before starting the next.
--
-- Split only at statement boundaries, so no statement is cut in half. Safe to
-- re-run: every statement uses "if not exists", "or replace", or
-- "on conflict do nothing".
--
-- After all 08 parts, run RUN-THIS-SECOND.sql (protocol_config).
-- =========================================================================

-- The handle GoTrue recorded for this session, read from `auth.identities`.
--
-- Exists so that the statement a wallet is asked to sign names the SAME handle
-- the link will record. `link-wallet` could read the handle out of its own copy
-- of the session instead, and the two would agree almost always — "almost" being
-- the problem: a user who changed their X handle between signing in and linking
-- would sign a statement naming one handle and have another written down, and the
-- stored proof would no longer match the text it was made over.
create or replace function public.twitter_handle_for_user(p_user_id uuid)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select i.identity_data->>'user_name'
    from auth.identities i
   where i.user_id = p_user_id and i.provider = 'twitter'
   limit 1
$$;

-- The exact bytes that were issued, for a challenge that is still answerable.
--
-- Returns null for a challenge that does not exist, belongs to another session,
-- has expired, or has been spent — one answer for all four, because telling a
-- caller WHICH of those is telling them how far off they were.
--
-- Read-only. It does not consume the challenge; `complete_wallet_link` does that
-- in the same transaction as the write, which is what makes a replay impossible
-- rather than merely unlikely.
create or replace function public.wallet_link_challenge_statement(p_user_id uuid, p_nonce text)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select jsonb_build_object('statement', c.statement, 'wallet', c.wallet, 'expires_at', c.expires_at)
    from public.wallet_link_challenges c
   where c.nonce = p_nonce
     and c.auth_user_id = p_user_id
     and c.consumed_at is null
     and c.expires_at > now()
$$;

-- Step two: record the link.
--
-- Called ONLY after `link-wallet` has verified the ed25519 signature against the
-- wallet's own public key. This function does not and cannot check the
-- cryptography — Postgres has no ed25519 primitive here — and pretending
-- otherwise would be worse than saying so. What it does guarantee, and what the
-- Edge Function cannot:
--
--   * the challenge existed, was issued to THIS user for THIS wallet, and has not
--     expired or been used;
--   * it is consumed in the same transaction as the link, so a replayed signature
--     finds it spent;
--   * the X handle is read from `auth.identities`, never from an argument;
--   * one wallet to one account in both directions, by unique constraints.
create or replace function public.complete_wallet_link(
  p_user_id   uuid,
  p_wallet    text,
  p_nonce     text,
  p_signature text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenge public.wallet_link_challenges;
  v_handle    text;
  v_provider  text;
begin
  select * into v_challenge
    from public.wallet_link_challenges
   where nonce = p_nonce
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'no-challenge',
      'message', 'That challenge does not exist. Nothing was linked.');
  end if;
  if v_challenge.consumed_at is not null then
    return jsonb_build_object('ok', false, 'code', 'challenge-spent',
      'message', 'That challenge has already been used. Ask for a new one; nothing was linked.');
  end if;
  if v_challenge.expires_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'challenge-expired',
      'message', 'That challenge expired. Ask for a new one; nothing was linked.');
  end if;
  -- The challenge names the user and the wallet. A signature is only proof of the
  -- pair it was issued for.
  if v_challenge.auth_user_id <> p_user_id or v_challenge.wallet <> p_wallet then
    return jsonb_build_object('ok', false, 'code', 'challenge-mismatch',
      'message', 'That challenge was issued for a different session or a different wallet. Nothing was linked.');
  end if;

  -- The X side, read from GoTrue's own record of the OAuth exchange. `user_name`
  -- is where the Twitter provider puts the handle; `sub` is the numeric account
  -- id, which is the stable half — a handle can be released and re-registered by
  -- somebody else, and a link keyed on it would follow it to the new owner.
  --
  -- Read out of `identity_data` rather than off the `provider_id` COLUMN, and the
  -- difference is availability rather than preference: `auth.identities.provider_id`
  -- was added to GoTrue partway through its life, so a query naming it fails at
  -- PARSE time on an older project — which would make this whole migration
  -- unpushable rather than making one link fail. `identity_data->>'sub'` has been
  -- populated by every version, and a jsonb key that is absent is a null this
  -- function already handles.
  select i.identity_data->>'user_name',
         coalesce(i.identity_data->>'sub', i.identity_data->>'provider_id')
    into v_handle, v_provider
    from auth.identities i
   where i.user_id = p_user_id and i.provider = 'twitter'
   limit 1;

  if v_handle is null or v_provider is null then
    return jsonb_build_object('ok', false, 'code', 'no-twitter-identity',
      'message', 'This session has no verified X identity, so there is no handle to link. Nothing was written.');
  end if;

  update public.wallet_link_challenges set consumed_at = now() where nonce = p_nonce;

  insert into public.wallet_identities
    (wallet, auth_user_id, twitter_user_id, twitter_handle, proof_nonce, proof_signature)
  values
    (p_wallet, p_user_id, v_provider, v_handle, p_nonce, p_signature)
  on conflict (wallet) do update
     set auth_user_id    = excluded.auth_user_id,
         twitter_user_id = excluded.twitter_user_id,
         twitter_handle  = excluded.twitter_handle,
         proof_nonce     = excluded.proof_nonce,
         proof_signature = excluded.proof_signature,
         linked_at       = now();

  insert into public.profiles (wallet, twitter_user_id, twitter_handle, twitter_verified_at, auth_user_id)
  values (p_wallet, v_provider, v_handle, now(), p_user_id)
  on conflict (wallet) do update
     set twitter_user_id     = excluded.twitter_user_id,
         twitter_handle      = excluded.twitter_handle,
         twitter_verified_at = excluded.twitter_verified_at,
         auth_user_id        = excluded.auth_user_id,
         updated_at          = now();

  -- The mirror. Its trigger re-reads public.profiles, so this only succeeds
  -- because the row above was written first — the guard is checking the write
  -- that just happened rather than the argument that asked for it.
  insert into public.wallets (address, twitter) values (p_wallet, v_handle)
  on conflict (address) do update set twitter = excluded.twitter;

  return jsonb_build_object('ok', true, 'wallet', p_wallet, 'twitter_handle', v_handle);
end;
$$;

-- Unlinking. Drops the proof and the verified columns together — a profile
-- keeping a handle whose proof has been withdrawn is exactly the unverified claim
-- this file exists to make unrepresentable.
create or replace function public.unlink_wallet(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet text;
begin
  v_wallet := public.actor_wallet(p_user_id);
  if v_wallet is null then
    return jsonb_build_object('ok', false, 'code', 'no-wallet',
      'message', 'This session has no linked wallet. Nothing was changed.');
  end if;

  delete from public.wallet_identities where auth_user_id = p_user_id;

  update public.profiles
     set twitter_user_id = null, twitter_handle = null, twitter_verified_at = null,
         auth_user_id = null, updated_at = now()
   where wallet = v_wallet;

  update public.wallets set twitter = null where address = v_wallet;

  return jsonb_build_object('ok', true, 'wallet', v_wallet);
end;
$$;

-- Housekeeping for the nonce table. Nothing depends on it having run — an expired
-- challenge is refused by `complete_wallet_link` whether or not it has been swept
-- — so this is disk hygiene rather than a security control, and it is written to
-- say so.
create or replace function public.purge_wallet_link_challenges()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gone integer;
begin
  delete from public.wallet_link_challenges
   where expires_at < now() - interval '7 days';
  get diagnostics v_gone = row_count;
  return v_gone;
end;
$$;

-- ---------------------------------------------------------------------------
-- Execution grants
-- ---------------------------------------------------------------------------

revoke all on function public.actor_wallet(uuid) from public, anon, authenticated;
revoke all on function public.set_profile(uuid, text, text, bigint) from public, anon, authenticated;
revoke all on function public.issue_wallet_link_challenge(uuid, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.complete_wallet_link(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.unlink_wallet(uuid) from public, anon, authenticated;
revoke all on function public.purge_wallet_link_challenges() from public, anon, authenticated;
revoke all on function public.twitter_handle_for_user(uuid) from public, anon, authenticated;
revoke all on function public.wallet_link_challenge_statement(uuid, text) from public, anon, authenticated;
-- `guard_wallet_twitter` is deliberately NOT revoked, for the reason given in
-- 20260806090600 about `stamp_xployee_identity`: it is a trigger function with no
-- argument list to invoke, and revoking EXECUTE from PUBLIC on one is a known way
-- to turn an ordinary write into "permission denied for function".

grant execute on function public.twitter_handle_for_user(uuid) to service_role;
grant execute on function public.wallet_link_challenge_statement(uuid, text) to service_role;
grant execute on function public.actor_wallet(uuid) to service_role;
grant execute on function public.set_profile(uuid, text, text, bigint) to service_role;
grant execute on function public.issue_wallet_link_challenge(uuid, text, text, text, integer) to service_role;
grant execute on function public.complete_wallet_link(uuid, text, text, text) to service_role;
grant execute on function public.unlink_wallet(uuid) to service_role;
grant execute on function public.purge_wallet_link_challenges() to service_role;


-- =========================================================================
-- SECTION 13 of 16 — 20260806090800_market_and_epochs.sql
-- =========================================================================

-- xNFTs index — the simulated marketplace and the epoch ledger.
--
-- ===========================================================================
-- EVERYTHING IN THIS FILE IS SIMULATED, AND IT IS STILL ENFORCED
-- ===========================================================================
-- Sales and rentals move no tokens. There is no escrow program, so an atomic
-- swap would need both parties to co-sign one transaction and nothing arranges
-- that — a sale is a row in `public.trades` and a rental is a row in
-- `public.rentals`, exactly as 20260805120000 says.
--
-- Simulated does NOT mean unchecked, and the distinction is the whole point of
-- this migration. A simulated ledger has no chain reading to contradict it, so a
-- wrong row here is wrong forever and there is nothing to reconcile it against.
-- That makes the invariants MORE important than on the chain-backed tables, not
-- less:
--
--   * a seller must own what they list, at the moment they list it;
--   * a buyer cannot buy their own listing, and cannot buy one that has already
--     closed — checked under a row lock, so two simultaneous buyers cannot both
--     win;
--   * ownership moves in the same transaction as the trade row, so a sale that
--     records money without moving the asset is unreachable;
--   * a rented xployee cannot be re-rented until its contract ends.
--
-- ===========================================================================
-- THE FEE LEDGERS ARE SEPARATE, DELIBERATELY
-- ===========================================================================
-- `public.fee_ledger` is reconciled against a treasury token account anyone can
-- read on chain, and 20260806090000 narrowed it further so that only rentals
-- with a real transfer behind them can enter it. A simulated marketplace fee has
-- no deposit behind it, so it goes to `public.sim_fee_ledger` instead. Two
-- tables rather than one table with a flag, because the flag is exactly the
-- thing a `sum(amount)` written in a hurry forgets — and the resulting number
-- would be a treasury balance overstated by every sale the theatre ever staged.
--
-- ===========================================================================
-- WHO IS ACTING
-- ===========================================================================
-- Every writer takes an `auth.users` id and resolves the wallet through
-- `public.actor_wallet`. None of them takes a wallet address, so there is no
-- writer that can be pointed at somebody else's holdings.

-- ---------------------------------------------------------------------------
-- Rates
-- ---------------------------------------------------------------------------

-- Mirrors SIM_SALE_FEE_BPS and SIM_RENT_FEE_BPS in src/lib/fees.ts. Named SIM_
-- there and `sim_` here for the same reason: the mint has no fee at all, and a
-- constant that merely reads as "the protocol fee" is how a retired charge gets
-- threaded back into the one action that is real.
--
-- Floor division, matching `feeOn()` exactly: both operands are non-negative, so
-- truncation toward zero IS floor, and the payer is never overcharged by a unit.
create or replace function public.sim_sale_fee_bps() returns integer
language sql immutable parallel safe set search_path = '' as $$ select 500 $$;

create or replace function public.sim_rent_fee_bps() returns integer
language sql immutable parallel safe set search_path = '' as $$ select 1000 $$;

create or replace function public.sim_fee_on(p_gross numeric, p_bps integer)
returns numeric
language sql
immutable
parallel safe
strict
set search_path = ''
as $$ select trunc(p_gross * p_bps / 10000) $$;

comment on function public.sim_fee_on(numeric, integer) is
  'The simulated marketplace fee on a gross amount in raw units, floored. Matches feeOn() in src/lib/fees.ts — same division, same direction, so a quote on screen and the row written here cannot disagree about a rounding unit.';

-- ---------------------------------------------------------------------------
-- listings — the write path 20260805120000 said did not exist yet
-- ---------------------------------------------------------------------------

alter table public.listings
  -- The rate in force when the listing was made. Snapshotted rather than read at
  -- settlement, so changing the marketplace rate cannot silently reprice an
  -- advertisement somebody is already looking at.
  add column if not exists fee_bps integer,
  add column if not exists cancelled_at timestamptz,
  add column if not exists closed_by public.base58_address;

alter table public.listings
  add constraint listings_fee_bps_sane check (fee_bps is null or (fee_bps >= 0 and fee_bps <= 2000));

comment on column public.listings.nft_mint is
  'The xployee''s art_seed — what src/lib/xployee.ts calls `Xployee.mint` and src/lib/market.ts keys a listing by. A deterministic pseudo-address, NOT a token mint: there is no NFT on Solana, and nothing may derive an account from this.';
comment on column public.listings.fee_bps is
  'The simulated fee rate this listing was made under. Snapshotted so a rate change cannot reprice a live advertisement.';

create index if not exists listings_active_idx on public.listings (kind, updated_at desc) where status = 'active';

-- ---------------------------------------------------------------------------
-- rentals — the table the chain could not fill
-- ---------------------------------------------------------------------------

-- 20260805120000 declined to create this, and its reasoning was right for the
-- case it was about: a chain-verified rental is two token transfers, and two
-- transfers cannot say for how many epochs, so a `rentals` table written from
-- ingestion would need a `term_epochs` column nothing could fill.
--
-- A SIMULATED rental is a different object. The term is not recovered from
-- anywhere — it is stated by the contract the renter accepted, which is a row in
-- `public.listings` this database wrote itself. There is nothing to reconstruct
-- and nothing to guess.
--
-- The chain-backed path is unchanged: `record_rent` still writes a fee row and
-- still declines to invent a term. If a rental is ever settled on chain it lands
-- in `fee_ledger` with `origin = 'chain'`, and these rows stay what they say they
-- are.
create table public.rentals (
  id           uuid primary key default gen_random_uuid(),
  xployee_id   bigint not null references public.xployees (id) on delete restrict,
  owner        public.base58_address not null,
  renter       public.base58_address not null,

  -- Money in raw units as digit strings, for the reason the u64_text domain
  -- exists: PostgREST serialises numeric as a JSON number and a raw u64 loses its
  -- low digits on the way to a browser.
  fee_per_epoch public.u64_text not null,
  term_epochs   integer not null check (term_epochs > 0 and term_epochs <= 365),
  gross         public.u64_text not null,
  fee           public.u64_text not null,
  total         public.u64_text not null,
  fee_bps       integer not null check (fee_bps >= 0 and fee_bps <= 2000),

  -- Protocol epochs, from public.protocol_epoch(). Half-open: the contract covers
  -- [start_epoch, end_epoch).
  start_epoch integer not null check (start_epoch >= 0),
  end_epoch   integer not null check (end_epoch > start_epoch),

  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  origin public.row_origin not null default 'simulated',

  created_at   timestamptz not null default now(),
  ended_at     timestamptz,

  constraint rentals_term_matches_epochs check (end_epoch - start_epoch = term_epochs),
  -- The renter is not the owner. A self-rental would move no value and would
  -- redirect the epoch yield to the wallet that was already receiving it.
  constraint rentals_parties_differ check (renter <> owner),
  constraint rentals_settled_has_timestamp check (
    (status = 'active' and ended_at is null) or (status <> 'active' and ended_at is not null)
  ),
  -- Simulated rows carry no signature, and a row claiming 'chain' would have to
  -- have come from somewhere this writer cannot reach.
  constraint rentals_are_simulated check (origin = 'simulated')
);

-- One live contract per xployee. A constraint, not a check the writer performs:
-- two renters holding one worker would both be credited its epoch yield, and the
-- ledger would pay out twice for one desk.
create unique index rentals_one_active_per_xployee
  on public.rentals (xployee_id) where status = 'active';

create index rentals_renter_idx on public.rentals (renter, created_at desc);
create index rentals_owner_idx  on public.rentals (owner, created_at desc);
create index rentals_window_idx on public.rentals (start_epoch, end_epoch) where status = 'active';

comment on table public.rentals is
  'SIMULATED rental contracts. The xployee never moves; what moves is who is credited its epoch yield for the term. The term is stated by the listing this database wrote, not recovered from a transaction — which is why this table can exist for simulated rentals and could not for chain-verified ones.';

-- ---------------------------------------------------------------------------
-- sim_fee_ledger — the theatre's own revenue line
-- ---------------------------------------------------------------------------

create table public.sim_fee_ledger (
  id        uuid primary key default gen_random_uuid(),
  source    text not null check (source in ('sale', 'rent')),
  -- What the fee was charged against, so a row can be traced to the thing that
  -- produced it. Exactly one is set.
  trade_id  uuid references public.trades (id) on delete cascade,
  rental_id uuid references public.rentals (id) on delete cascade,
  payer     public.base58_address not null,
  amount    public.u64_text not null,
  fee_bps   integer not null check (fee_bps >= 0 and fee_bps <= 2000),
  origin    public.row_origin not null default 'simulated' check (origin = 'simulated'),
  charged_at timestamptz not null default now(),
  constraint sim_fee_ledger_has_one_source check (
    (source = 'sale' and trade_id is not null and rental_id is null)
    or (source = 'rent' and rental_id is not null and trade_id is null)
  )
);

create index sim_fee_ledger_charged_idx on public.sim_fee_ledger (charged_at desc);
create index sim_fee_ledger_source_idx  on public.sim_fee_ledger (source, charged_at desc);

comment on table public.sim_fee_ledger is
  'SIMULATED marketplace fees. Never summed with public.fee_ledger: that one is reconciled against a treasury token account, and every row here describes money that did not move. Two tables rather than one with a flag, because the flag is what a hurried sum() forgets.';

-- ---------------------------------------------------------------------------
-- Epochs
-- ---------------------------------------------------------------------------

-- Genesis and epoch length, matching src/lib/accrual.ts: GENESIS is
-- Date.UTC(2026, 0, 6) and an epoch is 24 hours. Fixed so epoch numbering is the
-- same on every machine and in the database.
create or replace function public.protocol_genesis()
returns timestamptz
language sql immutable parallel safe set search_path = ''
as $$ select timestamptz '2026-01-06 00:00:00+00' $$;

create or replace function public.protocol_epoch(p_at timestamptz default now())
returns integer
language sql
stable
parallel safe
set search_path = ''
as $$
  select greatest(0, floor(extract(epoch from (p_at - public.protocol_genesis())) / 86400))::integer
$$;

create or replace function public.epoch_start(p_epoch integer)
returns timestamptz
language sql immutable parallel safe strict set search_path = ''
as $$ select public.protocol_genesis() + make_interval(days => p_epoch) $$;

comment on function public.protocol_epoch(timestamptz) is
  'The protocol epoch containing a timestamp. Mirrors epochAt() in src/lib/accrual.ts: 24-hour epochs from 2026-01-06T00:00:00Z, floored at 0.';

-- Per-epoch aggregates. Written by settle_epoch, one row per epoch, never
-- rewritten: a settled epoch is history, and history that can be recomputed under
-- you is not a ledger.
create table public.epochs (
  epoch      integer primary key check (epoch >= 0),
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  -- How many workers were on the books when this epoch settled.
  workers            integer not null default 0 check (workers >= 0),
  principal_usd      numeric(20, 2) not null default 0 check (principal_usd >= 0),
  yield_usd          numeric(20, 6) not null default 0 check (yield_usd >= 0),
  settled_at timestamptz not null default now(),
  constraint epochs_span check (ends_at = starts_at + interval '1 day')
);

comment on table public.epochs is
  'One row per settled epoch. Append-only: settle_epoch refuses to rewrite an epoch it has already closed, because a book value that can be recomputed retroactively is not a book value.';

-- The per-worker line items behind each epoch row.
--
-- `credited_to` is the renter while a contract is live and the owner otherwise —
-- that redirection IS what renting an xployee buys, and recording it per epoch is
-- what makes a contract auditable after it ends. The owner is kept alongside so a
-- reader can see the redirection rather than infer it.
create table public.epoch_yields (
  epoch       integer not null references public.epochs (epoch) on delete cascade,
  xployee_id  bigint  not null references public.xployees (id) on delete cascade,
  owner       public.base58_address not null,
  credited_to public.base58_address not null,
  rental_id   uuid references public.rentals (id) on delete set null,
  yield_usd   numeric(20, 6) not null check (yield_usd >= 0),
  primary key (epoch, xployee_id)
);

create index epoch_yields_credited_idx on public.epoch_yields (credited_to, epoch desc);
create index epoch_yields_owner_idx on public.epoch_yields (owner, epoch desc);

comment on table public.epoch_yields is
  'Per-worker, per-epoch accrual. credited_to is the renter during a live contract and the owner otherwise — the redirection is the whole product of a rental, so it is recorded rather than derived later from a contract that may have ended.';

-- ---------------------------------------------------------------------------
-- settle_epoch
-- ---------------------------------------------------------------------------

-- Closes one epoch. Idempotent by the primary key on public.epochs: re-running it
-- returns 'already-settled' and changes nothing, so a cron that fires twice, or a
-- backfill overlapping a live schedule, cannot double-credit a wallet.
--
-- Refuses to settle an epoch that has not finished. A partial epoch settled early
-- would be a full epoch's credit for part of one, and the correction would have
-- to rewrite a row this table does not allow to be rewritten.
--
-- Yield is `principal x apy / 365`, matching yieldPerEpoch() in src/lib/accrual.ts,
-- in exact decimal arithmetic. No float touches it.
create or replace function public.settle_epoch(p_epoch integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_rows  integer;
begin
  if p_epoch is null or p_epoch < 0 then
    return jsonb_build_object('ok', false, 'code', 'bad-epoch', 'message', 'Epochs start at 0.');
  end if;

  v_start := public.epoch_start(p_epoch);
  if v_start + interval '1 day' > now() then
    return jsonb_build_object(
      'ok', false, 'code', 'epoch-open',
      'message', format('Epoch %s has not finished. Nothing was settled.', p_epoch)
    );
  end if;

  if exists (select 1 from public.epochs where epoch = p_epoch) then
    return jsonb_build_object('ok', true, 'outcome', 'already-settled', 'epoch', p_epoch);
  end if;

  insert into public.epochs (epoch, starts_at, ends_at)
  values (p_epoch, v_start, v_start + interval '1 day');

  -- Only workers that were already hired when the epoch STARTED accrue for it. A
  -- worker hired midway through would otherwise be credited a full epoch for a
  -- few hours, which is the one direction this ledger must not err in.
  insert into public.epoch_yields (epoch, xployee_id, owner, credited_to, rental_id, yield_usd)
  select
    p_epoch,
    x.id,
    x.owner,
    coalesce(r.renter, x.owner),
    r.id,
    round(x.principal * x.apy / 365, 6)
  from public.xployees x
  left join public.rentals r
    on r.xployee_id = x.id
   and r.status = 'active'
   and p_epoch >= r.start_epoch
   and p_epoch <  r.end_epoch
  where x.owner is not null
    and x.hired_at is not null
    and x.hired_at <= v_start;

  get diagnostics v_rows = row_count;

  update public.epochs e
     set workers       = agg.workers,
         principal_usd = agg.principal,
         yield_usd     = agg.yield
    from (
      select count(*)                as workers,
             coalesce(sum(x.principal), 0) as principal,
             coalesce(sum(y.yield_usd), 0) as yield
        from public.epoch_yields y
        join public.xployees x on x.id = y.xployee_id
       where y.epoch = p_epoch
    ) agg
   where e.epoch = p_epoch;

  -- Contracts that ran out during this epoch are closed here rather than by a
  -- separate sweep, so "the term ended" and "the yield stopped being redirected"
  -- are the same event.
  update public.rentals
     set status = 'completed', ended_at = now()
   where status = 'active' and end_epoch <= p_epoch + 1;

  return jsonb_build_object('ok', true, 'outcome', 'settled', 'epoch', p_epoch, 'workers', v_rows);
end;
$$;

-- Settles every finished epoch that has not been closed yet, oldest first, up to
-- a bound. The bound exists because a project that has been idle for a month
-- would otherwise try to settle thirty epochs x five thousand workers in one
-- statement timeout.
create or replace function public.settle_due_epochs(p_max integer default 7)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current integer := public.protocol_epoch();
  v_done    integer := 0;
  v_epoch   integer;
  v_last    integer;
begin
  select coalesce(max(epoch), -1) into v_last from public.epochs;
  v_epoch := v_last + 1;

  while v_epoch < v_current and v_done < greatest(1, least(p_max, 60)) loop
    perform public.settle_epoch(v_epoch);
    v_done  := v_done + 1;
    v_epoch := v_epoch + 1;
  end loop;

  return jsonb_build_object('ok', true, 'settled', v_done, 'through_epoch', v_epoch - 1, 'current_epoch', v_current);
end;
$$;

-- ---------------------------------------------------------------------------
-- record_simulated_sale — repaired
-- ---------------------------------------------------------------------------

-- 20260805120100 defined this with an UPSERT on public.xployees, so a sale of a
-- serial the index had never seen created it, owned by the buyer. That was the
-- right call when the index was a sparse read model that might not have heard of
-- an xployee yet.
--
-- It is the wrong call now, and the seed is why: all 5,000 exist from
-- 20260806090300, so an id the upsert does not find is not a gap to fill — it is
-- an id outside the collection, and creating it would mint a 5,001st xployee
-- through the sales endpoint. `xployees_within_supply` would refuse the insert,
-- but as an exception from a constraint rather than as a sentence about a sale.
--
-- Two things change. The upsert becomes an UPDATE that raises when it matches
-- nothing, and the seller has to actually own the thing they are selling —
-- because a simulated sale has no chain reading to contradict it, so "seller"
-- being unchecked meant any caller could move any xployee to anyone.
create or replace function public.record_simulated_sale(
  p_sale_ref      text,
  p_xployee_id    bigint,
  p_nft_mint      text,
  p_buyer         text,
  p_seller        text,
  p_gross         text,
  p_fee           text,
  p_net_to_seller text
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted boolean;
  v_owner    text;
  v_trade    uuid;
begin
  if p_buyer = p_seller then
    raise exception 'record_simulated_sale: buyer and seller are the same wallet';
  end if;

  -- The row is locked before it is checked, so a second concurrent sale of the
  -- same xployee waits here and then finds the owner has changed.
  select owner into v_owner from public.xployees where id = p_xployee_id for update;
  if not found then
    raise exception 'record_simulated_sale: xployee % is not in the collection', p_xployee_id;
  end if;
  if v_owner is null or v_owner <> p_seller then
    raise exception 'record_simulated_sale: % does not own xployee %', p_seller, p_xployee_id;
  end if;

  insert into public.trades (sale_ref, xployee_id, nft_mint, buyer, seller, gross, fee, net_to_seller, origin)
  values (p_sale_ref, p_xployee_id, p_nft_mint, p_buyer, p_seller, p_gross, p_fee, p_net_to_seller, 'simulated')
  on conflict (sale_ref) do nothing
  returning id into v_trade;
  v_inserted := found;

  -- Only on a first sighting. Replaying a sale must not move ownership again,
  -- because by then a later sale may have moved it on.
  if v_inserted then
    update public.xployees set owner = p_buyer, updated_at = now() where id = p_xployee_id;

    update public.listings l
       set status = 'sold', updated_at = now(), closed_by = p_buyer
     where l.xployee_id = p_xployee_id and l.status = 'active';

    -- The fee is notional and goes to the SIMULATED ledger. It has never entered
    -- public.fee_ledger and 20260806090000 now makes that structural rather than
    -- conventional.
    if p_fee is not null and p_fee <> '0' then
      insert into public.sim_fee_ledger (source, trade_id, payer, amount, fee_bps)
      values ('sale', v_trade, p_buyer, p_fee, public.sim_sale_fee_bps());
    end if;
  end if;

  return case when v_inserted then 'inserted' else 'duplicate' end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Listing writers
-- ---------------------------------------------------------------------------

create or replace function public.create_listing(
  p_user_id       uuid,
  p_xployee_id    bigint,
  p_kind          text,
  p_price         text default null,
  p_fee_per_epoch text default null,
  p_term_epochs   integer default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet text;
  v_mint   text;
begin
  v_wallet := public.actor_wallet(p_user_id);
  if v_wallet is null then
    return jsonb_build_object('ok', false, 'code', 'no-wallet',
      'message', 'This session has no linked wallet. Nothing was listed.');
  end if;
  if p_kind not in ('sale', 'rent') then
    return jsonb_build_object('ok', false, 'code', 'bad-kind',
      'message', 'A listing is a sale or a rent. Nothing was listed.');
  end if;

  -- Read, not `for update`. `buy_listing` locks the listing and then the xployee;
  -- taking them in the other order here would be a deadlock waiting for two
  -- unlucky requests. Listing is an advertisement — a race between listing and
  -- selling the same worker resolves at the sale, where the lock that matters is.
  select x.art_seed into v_mint
    from public.xployees x
   where x.id = p_xployee_id and x.owner = v_wallet;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not-owned',
      'message', 'This wallet does not own that xployee. Nothing was listed.');
  end if;

  if exists (select 1 from public.listings where xployee_id = p_xployee_id and status = 'active') then
    return jsonb_build_object('ok', false, 'code', 'already-listed',
      'message', 'That xployee is already on the market. Cancel the existing listing first.');
  end if;
  -- A worker under contract is not the seller's to hand over: the renter is
  -- collecting its yield until the term ends.
  if exists (select 1 from public.rentals where xployee_id = p_xployee_id and status = 'active') then
    return jsonb_build_object('ok', false, 'code', 'under-contract',
      'message', 'That xployee is out on a rental contract. It can be listed when the term ends.');
  end if;

  -- The listings table's own listings_priced_by_kind constraint would refuse a
  -- sale with no price, but as an exception rather than as an explanation.
  if p_kind = 'sale' and (p_price is null or p_price !~ '^(0|[1-9][0-9]{0,19})$' or p_price = '0') then
    return jsonb_build_object('ok', false, 'code', 'bad-price',
      'message', 'A sale listing needs a price in raw units, as a decimal string above zero. Nothing was listed.');
  end if;
  if p_kind = 'rent' and (
       p_fee_per_epoch is null or p_fee_per_epoch !~ '^(0|[1-9][0-9]{0,19})$' or p_fee_per_epoch = '0'
       or p_term_epochs is null or p_term_epochs <= 0 or p_term_epochs > 365) then
    return jsonb_build_object('ok', false, 'code', 'bad-terms',
      'message', 'A rent listing needs a per-epoch fee in raw units and a term of 1–365 epochs. Nothing was listed.');
  end if;

  -- The old row for this xployee is replaced rather than accumulated: nft_mint is
  -- the primary key and a previous cancelled listing would collide with it. The
  -- history of a listing is the trade or rental it produced, not a pile of
  -- closed advertisements.
  delete from public.listings where xployee_id = p_xployee_id;

  insert into public.listings (
    nft_mint, xployee_id, seller, kind, price, fee_per_epoch, term_epochs, status, fee_bps
  ) values (
    v_mint, p_xployee_id, v_wallet, p_kind,
    case when p_kind = 'sale' then p_price end,
    case when p_kind = 'rent' then p_fee_per_epoch end,
    case when p_kind = 'rent' then p_term_epochs end,
    'active',
    case when p_kind = 'sale' then public.sim_sale_fee_bps() else public.sim_rent_fee_bps() end
  );

  return jsonb_build_object('ok', true, 'xployee_id', p_xployee_id, 'kind', p_kind, 'nft_mint', v_mint);
end;
$$;

create or replace function public.cancel_listing(p_user_id uuid, p_xployee_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet text;
  v_hit    integer;
begin
  v_wallet := public.actor_wallet(p_user_id);
  if v_wallet is null then
    return jsonb_build_object('ok', false, 'code', 'no-wallet',
      'message', 'This session has no linked wallet. Nothing was changed.');
  end if;

  update public.listings
     set status = 'cancelled', cancelled_at = now(), updated_at = now(), closed_by = v_wallet
   where xployee_id = p_xployee_id and seller = v_wallet and status = 'active';
  get diagnostics v_hit = row_count;

  if v_hit = 0 then
    return jsonb_build_object('ok', false, 'code', 'not-found',
      'message', 'This wallet has no active listing for that xployee. Nothing was changed.');
  end if;
  return jsonb_build_object('ok', true, 'xployee_id', p_xployee_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- buy_listing — the simulated sale, end to end
-- ---------------------------------------------------------------------------

-- The listing row is taken `for update` before anything is decided, so two buyers
-- arriving together serialise: the first closes it, the second finds it closed
-- and is told so. Nothing about that depends on the order PostgREST happened to
-- process the two requests in.
--
-- The price is read off the LISTING, never from the caller. A buyer who could
-- send their own price would be writing the seller's proceeds.
create or replace function public.buy_listing(p_user_id uuid, p_xployee_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buyer  text;
  v_listing public.listings;
  v_gross  numeric;
  v_fee    numeric;
  v_net    numeric;
  v_ref    text;
begin
  v_buyer := public.actor_wallet(p_user_id);
  if v_buyer is null then
    return jsonb_build_object('ok', false, 'code', 'no-wallet',
      'message', 'This session has no linked wallet. Nothing was bought.');
  end if;

  select * into v_listing
    from public.listings
   where xployee_id = p_xployee_id and kind = 'sale'
   for update;

  if not found or v_listing.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'not-listed',
      'message', 'That xployee is not for sale. Nothing was bought.');
  end if;
  if v_listing.seller = v_buyer then
    return jsonb_build_object('ok', false, 'code', 'own-listing',
      'message', 'That is this wallet''s own listing. Nothing was bought.');
  end if;

  -- The seller must still own it.
  --
  -- `record_simulated_sale` checks this too and RAISES if it fails, which is the
  -- right behaviour for a low-level writer and the wrong response for a buyer: an
  -- exception escapes as a 500 with a Postgres string in it, and "the seller sold
  -- it to somebody else a second ago" is an ordinary outcome that deserves a
  -- sentence. Checked here so the common case reads properly; the raise below
  -- stays as the last line of defence, because this check and the ownership
  -- update are not in the same statement.
  if not exists (
    select 1 from public.xployees x where x.id = p_xployee_id and x.owner = v_listing.seller
  ) then
    return jsonb_build_object('ok', false, 'code', 'stale-listing',
      'message', 'That listing was posted by a wallet that no longer owns the xployee. Nothing was bought.');
  end if;

  v_gross := v_listing.price::numeric;
  v_fee   := public.sim_fee_on(v_gross, coalesce(v_listing.fee_bps, public.sim_sale_fee_bps()));
  -- The fee rides ON TOP of the ask, exactly as saleMath() in src/lib/market.ts
  -- quotes it: the seller receives the ask and the buyer is debited ask + fee. So
  -- the seller's net IS the gross, and `net_to_seller` records that rather than
  -- silently deducting a fee the quote never showed.
  v_net   := v_gross;

  -- A deterministic idempotency key. `record_simulated_sale` keys replay
  -- protection on `sale_ref`, and a uuid generated here would make every retry a
  -- second sale; keyed on the listing and the buyer, a retry lands on the row the
  -- first attempt wrote.
  v_ref := 'sale:' || p_xployee_id::text || ':' || v_listing.updated_at::text || ':' || v_buyer;

  perform public.record_simulated_sale(
    v_ref,
    p_xployee_id,
    v_listing.nft_mint,
    v_buyer,
    v_listing.seller,
    trunc(v_gross)::text,
    trunc(v_fee)::text,
    trunc(v_net)::text
  );

  return jsonb_build_object(
    'ok', true,
    'xployee_id', p_xployee_id,
    'seller', v_listing.seller,
    'gross', trunc(v_gross)::text,
    'fee', trunc(v_fee)::text,
    'total', trunc(v_gross + v_fee)::text
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- rent_listing — the simulated contract
-- ---------------------------------------------------------------------------

create or replace function public.rent_listing(p_user_id uuid, p_xployee_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_renter  text;
  v_listing public.listings;
  v_gross   numeric;
  v_fee     numeric;
  v_start   integer := public.protocol_epoch();
  v_rental  uuid;
begin
  v_renter := public.actor_wallet(p_user_id);
  if v_renter is null then
    return jsonb_build_object('ok', false, 'code', 'no-wallet',
      'message', 'This session has no linked wallet. Nothing was rented.');
  end if;

  select * into v_listing
    from public.listings
   where xployee_id = p_xployee_id and kind = 'rent'
   for update;

  if not found or v_listing.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'not-listed',
      'message', 'That xployee is not offered on contract. Nothing was rented.');
  end if;
  if v_listing.seller = v_renter then
    return jsonb_build_object('ok', false, 'code', 'own-listing',
      'message', 'That is this wallet''s own contract. Nothing was rented.');
  end if;
  -- The listing's seller must still be the owner. A stale advertisement left
  -- behind by a previous owner would otherwise let a renter pay the wrong wallet.
  if not exists (
    select 1 from public.xployees x where x.id = p_xployee_id and x.owner = v_listing.seller
  ) then
    return jsonb_build_object('ok', false, 'code', 'stale-listing',
      'message', 'That contract was posted by a wallet that no longer owns the xployee. Nothing was rented.');
  end if;

  v_gross := v_listing.fee_per_epoch::numeric * v_listing.term_epochs;
  v_fee   := public.sim_fee_on(v_gross, coalesce(v_listing.fee_bps, public.sim_rent_fee_bps()));

  insert into public.rentals (
    xployee_id, owner, renter, fee_per_epoch, term_epochs,
    gross, fee, total, fee_bps, start_epoch, end_epoch
  ) values (
    p_xployee_id, v_listing.seller, v_renter, v_listing.fee_per_epoch, v_listing.term_epochs,
    trunc(v_gross)::text, trunc(v_fee)::text, trunc(v_gross + v_fee)::text,
    coalesce(v_listing.fee_bps, public.sim_rent_fee_bps()),
    v_start, v_start + v_listing.term_epochs
  )
  returning id into v_rental;

  insert into public.sim_fee_ledger (source, rental_id, payer, amount, fee_bps)
  values ('rent', v_rental, v_renter, trunc(v_fee)::text, coalesce(v_listing.fee_bps, public.sim_rent_fee_bps()));

  update public.listings
     set status = 'rented', updated_at = now(), closed_by = v_renter
   where xployee_id = p_xployee_id;

  return jsonb_build_object(
    'ok', true,
    'rental_id', v_rental,
    'xployee_id', p_xployee_id,
    'owner', v_listing.seller,
    'term_epochs', v_listing.term_epochs,
    'start_epoch', v_start,
    'end_epoch', v_start + v_listing.term_epochs,
    'gross', trunc(v_gross)::text,
    'fee', trunc(v_fee)::text,
    'total', trunc(v_gross + v_fee)::text
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Execution grants
-- ---------------------------------------------------------------------------

revoke all on function public.settle_epoch(integer) from public, anon, authenticated;
revoke all on function public.settle_due_epochs(integer) from public, anon, authenticated;
revoke all on function public.create_listing(uuid, bigint, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.cancel_listing(uuid, bigint) from public, anon, authenticated;
revoke all on function public.buy_listing(uuid, bigint) from public, anon, authenticated;
revoke all on function public.rent_listing(uuid, bigint) from public, anon, authenticated;
revoke all on function public.record_simulated_sale(text, bigint, text, text, text, text, text, text) from public, anon, authenticated;

grant execute on function public.settle_epoch(integer) to service_role;
grant execute on function public.settle_due_epochs(integer) to service_role;
grant execute on function public.create_listing(uuid, bigint, text, text, text, integer) to service_role;
grant execute on function public.cancel_listing(uuid, bigint) to service_role;
grant execute on function public.buy_listing(uuid, bigint) to service_role;
grant execute on function public.rent_listing(uuid, bigint) to service_role;
grant execute on function public.record_simulated_sale(text, bigint, text, text, text, text, text, text) to service_role;

-- Pure, read-only, and called by generated columns and by the app alike.
grant execute on function public.protocol_genesis() to public;
grant execute on function public.protocol_epoch(timestamptz) to public;
grant execute on function public.epoch_start(integer) to public;
grant execute on function public.sim_sale_fee_bps() to public;
grant execute on function public.sim_rent_fee_bps() to public;
grant execute on function public.sim_fee_on(numeric, integer) to public;


-- =========================================================================
-- SECTION 14 of 16 — 20260806090900_social.sql
-- =========================================================================

-- xNFTs index — the social layer: friends, threads, messages, trade offers.
--
-- ===========================================================================
-- WHAT THIS REPLACES
-- ===========================================================================
-- `src/lib/social.ts` keeps the whole inbox in one localStorage blob per wallet,
-- with the other half of every conversation simulated from network.ts. That was
-- the right shape for a frontend with no backend, and it has one property this
-- schema has to preserve and one it has to fix.
--
--   Preserve: nothing here throws at the reader. A corrupt row, a missing
--             counterparty, a message from a wallet that no longer exists — all
--             of it degrades to a shorter list, never to a blank page.
--   Fix:      a conversation is between two people. A store only one of them can
--             write is not a conversation, it is a diary. Every table below is
--             two-sided and symmetric by construction.
--
-- ===========================================================================
-- SYMMETRY IS STRUCTURAL, NOT MAINTAINED
-- ===========================================================================
-- `friendships` and `threads` both key on an ORDERED PAIR — `wallet_a < wallet_b`
-- as a check constraint — so there is exactly one row per relationship and A
-- lists B precisely when B lists A. The alternative, two mirrored rows kept in
-- step by a writer, is a pair that drifts the first time one insert fails: one
-- wallet sees a friend, the other sees a stranger, and nothing ever notices.
--
-- `src/lib/social.ts` reaches the same property a different way, by seeding its
-- pair roll on the unordered pair. Same reasoning, and it is worth being explicit
-- that the one-way friendship is a bug both designs were built to make
-- unrepresentable rather than unlikely.
--
-- ===========================================================================
-- A TRADE OFFER MOVES NOTHING
-- ===========================================================================
-- Accepting one records a decision. There is no custody here and no escrow
-- anywhere in this protocol, so an accepted offer does NOT reassign an xployee —
-- and `accept_trade_offer` deliberately does not touch `public.xployees`. Making
-- it move assets would be inventing a settlement layer inside a messaging table,
-- with none of the ownership checks `buy_listing` performs and no way to make the
-- two legs atomic against a counterparty who sold in the meantime.
--
-- The offer legs still name real xployees and are still validated against real
-- ownership at send time, because an offer for units the sender does not hold is
-- a lie whether or not anything settles it.

-- ---------------------------------------------------------------------------
-- friend_requests
-- ---------------------------------------------------------------------------

create table public.friend_requests (
  id           uuid primary key default gen_random_uuid(),
  requester    public.base58_address not null,
  addressee    public.base58_address not null,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  message      text check (message is null or length(message) <= 200),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_requests_two_parties check (requester <> addressee),
  constraint friend_requests_resolved_has_timestamp check (
    (status = 'pending' and responded_at is null) or (status <> 'pending' and responded_at is not null)
  )
);

-- At most one OPEN request per unordered pair, in either direction. `least` and
-- `greatest` collapse the direction, so B cannot answer A's pending request by
-- sending their own and ending up with two rows that disagree about who asked.
create unique index friend_requests_one_open_per_pair
  on public.friend_requests (least(requester, addressee), greatest(requester, addressee))
  where status = 'pending';

create index friend_requests_inbox_idx  on public.friend_requests (addressee, status, created_at desc);
create index friend_requests_outbox_idx on public.friend_requests (requester, status, created_at desc);

comment on table public.friend_requests is
  'Both directions and every status — the audit trail behind public.friendships. A resolved request is history and stays; only pending rows are inbox items.';

-- ---------------------------------------------------------------------------
-- friendships
-- ---------------------------------------------------------------------------

create table public.friendships (
  -- Canonically ordered, so the pair is the key and the relationship has exactly
  -- one row. This is what makes the graph undirected at the storage layer instead
  -- of by convention.
  wallet_a   public.base58_address not null,
  wallet_b   public.base58_address not null,
  since      timestamptz not null default now(),
  -- The request that produced it, when there was one. Null for a friendship
  -- created some other way; a foreign key rather than a copy so the history
  -- cannot say something the request row does not.
  request_id uuid references public.friend_requests (id) on delete set null,
  primary key (wallet_a, wallet_b),
  constraint friendships_are_ordered check (wallet_a < wallet_b)
);

create index friendships_b_idx on public.friendships (wallet_b);

comment on table public.friendships is
  'Undirected. wallet_a < wallet_b is enforced, so one relationship is one row and a one-way friendship — the classic bug where clicking through to the other profile shows a stranger — cannot be written.';

-- Both halves of the graph as one directed view, because every query the app
-- actually writes is "who are MY friends" and expressing that against an ordered
-- pair at each call site is how a `wallet_b` gets forgotten.
create view public.friend_edges with (security_invoker = true) as
  select wallet_a as wallet, wallet_b as friend, since from public.friendships
  union all
  select wallet_b as wallet, wallet_a as friend, since from public.friendships;

comment on view public.friend_edges is
  'public.friendships seen from both sides. Query this rather than remembering to check wallet_a and wallet_b separately.';

-- ---------------------------------------------------------------------------
-- threads and messages
-- ---------------------------------------------------------------------------

create table public.threads (
  id              uuid primary key default gen_random_uuid(),
  participant_a   public.base58_address not null,
  participant_b   public.base58_address not null,
  created_at      timestamptz not null default now(),
  -- Denormalised so an inbox sorts without touching the messages table. Kept
  -- current by the trigger below rather than by every writer.
  last_message_at timestamptz,
  message_count   integer not null default 0 check (message_count >= 0),
  constraint threads_are_ordered check (participant_a < participant_b),
  unique (participant_a, participant_b)
);

create index threads_a_idx on public.threads (participant_a, last_message_at desc nulls last);
create index threads_b_idx on public.threads (participant_b, last_message_at desc nulls last);

comment on table public.threads is
  'Strictly two-party, canonically ordered. One conversation is one row whichever side opened it, so there is no "your copy" and "their copy" to fall out of step.';

create table public.messages (
  id        uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  sender    public.base58_address not null,
  -- MESSAGE_MAX in src/lib/social.ts. Long enough for a real pitch, short enough
  -- that one wallet cannot fill the table.
  body      text not null check (length(body) between 1 and 500),
  sent_at   timestamptz not null default now(),
  -- Set when the RECIPIENT reads it. A sender's own message is never unread to
  -- them, so there is no second column and no way for the two to disagree.
  read_at   timestamptz
);

create index messages_thread_idx on public.messages (thread_id, sent_at desc);
create index messages_unread_idx on public.messages (thread_id, sender) where read_at is null;

comment on column public.messages.read_at is
  'When the recipient read it. A thread has exactly two participants and a sender never reads their own message, so one nullable timestamp says everything a per-participant read table would.';

-- The sender has to be in the thread. A cross-table condition, so a trigger
-- rather than a check — and worth having, because the failure it prevents is
-- somebody else's mail appearing inside a conversation.
create or replace function public.guard_message_sender()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_a text;
  v_b text;
begin
  select participant_a, participant_b into v_a, v_b from public.threads where id = new.thread_id;
  if v_a is null then
    raise exception 'message %: no such thread', new.id;
  end if;
  if new.sender <> v_a and new.sender <> v_b then
    raise exception 'message %: sender is not a participant in that thread', new.id;
  end if;
  return new;
end;
$$;

create trigger messages_sender_must_be_a_participant
  before insert on public.messages
  for each row execute function public.guard_message_sender();

-- Keeps the thread's summary honest. In a trigger rather than in `send_message`,
-- so a row inserted by any route — a backfill, a repair, a second writer added
-- later — cannot leave the inbox sorting by a stale timestamp.
create or replace function public.touch_thread()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.threads
     set last_message_at = greatest(coalesce(last_message_at, new.sent_at), new.sent_at),
         message_count   = message_count + 1
   where id = new.thread_id;
  return new;
end;
$$;

create trigger messages_touch_thread
  after insert on public.messages
  for each row execute function public.touch_thread();

-- ---------------------------------------------------------------------------
-- trade_offers and their legs
-- ---------------------------------------------------------------------------

create table public.trade_offers (
  id        uuid primary key default gen_random_uuid(),
  sender    public.base58_address not null,
  recipient public.base58_address not null,
  note      text check (note is null or length(note) <= 500),
  status    text not null default 'pending'
              check (status in ('pending', 'accepted', 'declined', 'withdrawn', 'expired')),

  -- The $xNFT sweetener, in raw units, as TWO non-negative columns rather than
  -- one signed one.
  --
  -- `src/lib/social.ts` carries it as a signed number where negative means "the
  -- sender wants $xNFT back". That is compact and it is exactly the shape that
  -- produces an off-by-a-sign bug in a UI, because the sign has to be read
  -- correctly at every render and every comparison. Two columns make the
  -- direction a fact about which column is populated, and the check makes "both
  -- at once" — which would be two payments cancelling out — unrepresentable.
  sweetener_from_sender    public.u64_text not null default '0',
  sweetener_from_recipient public.u64_text not null default '0',

  created_at   timestamptz not null default now(),
  expires_at   timestamptz,
  responded_at timestamptz,

  constraint trade_offers_two_parties check (sender <> recipient),
  constraint trade_offers_one_direction_of_cash check (
    sweetener_from_sender = '0' or sweetener_from_recipient = '0'
  ),
  constraint trade_offers_resolved_has_timestamp check (
    (status = 'pending' and responded_at is null) or (status <> 'pending' and responded_at is not null)
  )
);

create index trade_offers_inbox_idx  on public.trade_offers (recipient, status, created_at desc);
create index trade_offers_outbox_idx on public.trade_offers (sender, status, created_at desc);
create index trade_offers_open_idx   on public.trade_offers (expires_at) where status = 'pending';

comment on table public.trade_offers is
  'A proposal, not a settlement. Accepting records a decision and moves nothing — there is no escrow anywhere in this protocol, so an offer that reassigned xployees would be a settlement layer hidden inside a messaging table.';

create table public.trade_offer_legs (
  offer_id   uuid   not null references public.trade_offers (id) on delete cascade,
  xployee_id bigint not null references public.xployees (id) on delete cascade,
  -- 'offered'   — the sender is putting this up.
  -- 'requested' — the sender wants it back.
  side       text   not null check (side in ('offered', 'requested')),
  -- (offer, xployee) as the key rather than (offer, side, xployee): the same unit
  -- cannot be on both sides of one trade, and this is what makes that impossible
  -- rather than merely checked by the writer that happens to insert the legs.
  primary key (offer_id, xployee_id)
);

create index trade_offer_legs_xployee_idx on public.trade_offer_legs (xployee_id);

comment on table public.trade_offer_legs is
  'The units on each side of an offer. The primary key is (offer, xployee), so the same worker cannot appear as both offered and requested in one trade.';

-- ---------------------------------------------------------------------------
-- Writers
-- ---------------------------------------------------------------------------

-- Every one resolves the actor through public.actor_wallet and none takes a
-- wallet address, so there is no writer that can be pointed at somebody else's
-- inbox. Each returns jsonb: a refusal here is an ordinary outcome the UI renders
-- as a sentence, not an exception.

-- The canonical pair, so ordering logic is written once.
create or replace function public.pair_key(p_x text, p_y text)
returns text[]
language sql immutable parallel safe strict set search_path = ''
as $$ select case when p_x < p_y then array[p_x, p_y] else array[p_y, p_x] end $$;

create or replace function public.send_friend_request(p_user_id uuid, p_to text, p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from text;
  v_pair text[];
  v_id   uuid;
begin
  v_from := public.actor_wallet(p_user_id);
  if v_from is null then
    return jsonb_build_object('ok', false, 'code', 'no-wallet',
      'message', 'This session has no linked wallet. Nothing was sent.');
  end if;
  if p_to is null or p_to = v_from then
    return jsonb_build_object('ok', false, 'code', 'bad-target',
      'message', 'A friend request needs somebody else to send it to. Nothing was sent.');
  end if;

  v_pair := public.pair_key(v_from, p_to);
  if exists (select 1 from public.friendships where wallet_a = v_pair[1] and wallet_b = v_pair[2]) then
    return jsonb_build_object('ok', false, 'code', 'already-friends',
      'message', 'These wallets are already connected. Nothing was sent.');
  end if;

  -- A pending request in EITHER direction is already an open question, and the
  -- partial unique index would refuse the insert anyway. Answering here turns a
  -- constraint violation into the correct sentence.
  if exists (
    select 1 from public.friend_requests
     where status = 'pending'
       and least(requester, addressee) = v_pair[1]
       and greatest(requester, addressee) = v_pair[2]
  ) then
    return jsonb_build_object('ok', false, 'code', 'already-open',
      'message', 'There is already an open request between these wallets. Nothing was sent.');
  end if;

  insert into public.friend_requests (requester, addressee, message)
  values (v_from, p_to, nullif(btrim(coalesce(p_message, '')), ''))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'request_id', v_id);
end;
$$;

create or replace function public.respond_to_friend_request(
  p_user_id uuid,
  p_request_id uuid,
  p_accept boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   text;
  v_req  public.friend_requests;
  v_pair text[];
begin
  v_me := public.actor_wallet(p_user_id);
  if v_me is null then
    return jsonb_build_object('ok', false, 'code', 'no-wallet',
      'message', 'This session has no linked wallet. Nothing was changed.');
  end if;

  -- Locked before it is read, so two clicks cannot both accept and produce two
  -- friendship inserts racing on the same primary key.
  select * into v_req from public.friend_requests where id = p_request_id for update;
  if not found or v_req.addressee <> v_me or v_req.status <> 'pending' then
    return jsonb_build_object('ok', false, 'code', 'not-answerable',
      'message', 'That request is not open, or it was not addressed to this wallet. Nothing was changed.');
  end if;

  update public.friend_requests
     set status = case when p_accept then 'accepted' else 'declined' end,
         responded_at = now()
   where id = p_request_id;

  if p_accept then
    v_pair := public.pair_key(v_req.requester, v_req.addressee);
    insert into public.friendships (wallet_a, wallet_b, request_id)
    values (v_pair[1], v_pair[2], p_request_id)
    on conflict (wallet_a, wallet_b) do nothing;
  end if;

  return jsonb_build_object('ok', true, 'accepted', p_accept);
end;
$$;

-- Removing a friend leaves the accepted request behind as history, matching
-- `removeFriend` in src/lib/social.ts — and for the same reason: a later re-add
-- would otherwise be refused as a duplicate of a relationship that no longer
-- exists.
create or replace function public.remove_friend(p_user_id uuid, p_other text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   text;
  v_pair text[];
  v_hit  integer;
begin
  v_me := public.actor_wallet(p_user_id);
  if v_me is null then
    return jsonb_build_object('ok', false, 'code', 'no-wallet',
      'message', 'This session has no linked wallet. Nothing was changed.');
  end if;

  v_pair := public.pair_key(v_me, p_other);
  delete from public.friendships where wallet_a = v_pair[1] and wallet_b = v_pair[2];
  get diagnostics v_hit = row_count;

  return jsonb_build_object('ok', v_hit > 0, 'removed', v_hit > 0);
end;
$$;

-- Opens the thread if it does not exist yet, then writes the message. One
-- function, because "create a conversation" is not a thing a user does — sending
-- the first message is.
create or replace function public.send_message(p_user_id uuid, p_to text, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from   text;
  v_pair   text[];
  v_thread uuid;
  v_body   text := btrim(coalesce(p_body, ''));
  v_id     uuid;
begin
  v_from := public.actor_wallet(p_user_id);
  if v_from is null then
    return jsonb_build_object('ok', false, 'code', 'no-wallet',
      'message', 'This session has no linked wallet. Nothing was sent.');
  end if;
  if p_to is null or p_to = v_from then
    return jsonb_build_object('ok', false, 'code', 'bad-target',
      'message', 'A message needs somebody else to send it to. Nothing was sent.');
  end if;
  if length(v_body) = 0 or length(v_body) > 500 then
    return jsonb_build_object('ok', false, 'code', 'bad-body',
      'message', 'A message is 1–500 characters. Nothing was sent.');
  end if;

  v_pair := public.pair_key(v_from, p_to);

  -- `on conflict do nothing` then select, rather than select then insert: two
  -- first messages arriving together would otherwise both find no thread and both
  -- try to create one.
  insert into public.threads (participant_a, participant_b)
  values (v_pair[1], v_pair[2])
  on conflict (participant_a, participant_b) do nothing;

  select id into v_thread from public.threads
   where participant_a = v_pair[1] and participant_b = v_pair[2];

  insert into public.messages (thread_id, sender, body)
  values (v_thread, v_from, v_body)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'thread_id', v_thread, 'message_id', v_id);
end;
$$;

create or replace function public.mark_thread_read(p_user_id uuid, p_thread_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me  text;
  v_hit integer;
begin
  v_me := public.actor_wallet(p_user_id);
  if v_me is null then
    return jsonb_build_object('ok', false, 'code', 'no-wallet',
      'message', 'This session has no linked wallet. Nothing was changed.');
  end if;

  -- `sender <> v_me` is what stops a caller marking their OWN messages read,
  -- which would clear the counterparty's unread badge from the wrong side.
  update public.messages m
     set read_at = now()
    from public.threads t
   where m.thread_id = p_thread_id
     and t.id = m.thread_id
     and (t.participant_a = v_me or t.participant_b = v_me)
     and m.sender <> v_me
     and m.read_at is null;
  get diagnostics v_hit = row_count;

  return jsonb_build_object('ok', true, 'marked', v_hit);
end;
$$;

-- ---------------------------------------------------------------------------
-- Trade offers
-- ---------------------------------------------------------------------------

-- The legs are validated against real ownership at send time. An offer for units
-- the sender does not hold, or a request for units the recipient does not hold,
-- is a lie — and it stays a lie whether or not anything ever settles it, so it is
-- refused here rather than left for a UI to notice.
create or replace function public.send_trade_offer(
  p_user_id    uuid,
  p_to         text,
  p_offering   bigint[],
  p_requesting bigint[],
  p_sweetener_from_sender    text default '0',
  p_sweetener_from_recipient text default '0',
  p_note       text default null,
  p_ttl_hours  integer default 168
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from      text;
  v_offer     uuid;
  v_offering  bigint[] := coalesce(p_offering, '{}');
  v_request   bigint[] := coalesce(p_requesting, '{}');
  v_from_cash text := coalesce(nullif(p_sweetener_from_sender, ''), '0');
  v_to_cash   text := coalesce(nullif(p_sweetener_from_recipient, ''), '0');
  v_bad       bigint;
begin
  v_from := public.actor_wallet(p_user_id);
  if v_from is null then
    return jsonb_build_object('ok', false, 'code', 'no-wallet',
      'message', 'This session has no linked wallet. Nothing was offered.');
  end if;
  if p_to is null or p_to = v_from then
    return jsonb_build_object('ok', false, 'code', 'bad-target',
      'message', 'An offer needs a counterparty. Nothing was offered.');
  end if;
  if v_from_cash !~ '^(0|[1-9][0-9]{0,19})$' or v_to_cash !~ '^(0|[1-9][0-9]{0,19})$' then
    return jsonb_build_object('ok', false, 'code', 'bad-sweetener',
      'message', 'A sweetener is raw units as a decimal string. Nothing was offered.');
  end if;
  if v_from_cash <> '0' and v_to_cash <> '0' then
    return jsonb_build_object('ok', false, 'code', 'two-way-cash',
      'message', '$xNFT moves one way in a trade. Set one side to zero; nothing was offered.');
  end if;
  -- An offer that moves nothing in either direction is not an offer.
  if array_length(v_offering, 1) is null and array_length(v_request, 1) is null
     and v_from_cash = '0' and v_to_cash = '0' then
    return jsonb_build_object('ok', false, 'code', 'empty-offer',
      'message', 'That offer moves nothing in either direction. Nothing was offered.');
  end if;
  if coalesce(array_length(v_offering, 1), 0) + coalesce(array_length(v_request, 1), 0) > 20 then
    return jsonb_build_object('ok', false, 'code', 'too-many-legs',
      'message', 'An offer carries at most 20 xployees across both sides. Nothing was offered.');
  end if;

  -- The same unit cannot be on both sides. The legs table's primary key would
  -- refuse the second insert; saying so here is the difference between an
  -- explanation and a constraint violation.
  if exists (select 1 from unnest(v_offering) as t(o) where t.o = any (v_request)) then
    return jsonb_build_object('ok', false, 'code', 'same-unit-both-sides',
      'message', 'An xployee cannot be both offered and requested. Nothing was offered.');
  end if;

  select t.o into v_bad
    from unnest(v_offering) as t(o)
   where not exists (select 1 from public.xployees x where x.id = t.o and x.owner = v_from)
   limit 1;
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'code', 'not-owned',
      'message', format('This wallet does not own %s. Nothing was offered.', public.serial_label(v_bad)));
  end if;

  select t.r into v_bad
    from unnest(v_request) as t(r)
   where not exists (select 1 from public.xployees x where x.id = t.r and x.owner = p_to)
   limit 1;
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'code', 'not-held-by-counterparty',
      'message', format('That offer asks for %s, which the counterparty does not hold. Nothing was offered.', public.serial_label(v_bad)));
  end if;

  insert into public.trade_offers (
    sender, recipient, note, sweetener_from_sender, sweetener_from_recipient, expires_at
  ) values (
    v_from, p_to, nullif(btrim(coalesce(p_note, '')), ''), v_from_cash, v_to_cash,
    now() + make_interval(hours => greatest(1, least(coalesce(p_ttl_hours, 168), 720)))
  )
  returning id into v_offer;

  insert into public.trade_offer_legs (offer_id, xployee_id, side)
  select v_offer, t.o, 'offered' from unnest(v_offering) as t(o)
  union all
  select v_offer, t.r, 'requested' from unnest(v_request) as t(r);

  return jsonb_build_object('ok', true, 'offer_id', v_offer);
end;
$$;

-- Resolve an offer.
--
-- Accepting RECORDS A DECISION. It moves nothing — see the header. The status is
-- the whole effect, and the two parties settle between themselves through the
-- marketplace, where `buy_listing` does the ownership checks and the locking that
-- a real transfer needs.
create or replace function public.respond_to_trade_offer(
  p_user_id  uuid,
  p_offer_id uuid,
  p_status   text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    text;
  v_offer public.trade_offers;
begin
  v_me := public.actor_wallet(p_user_id);
  if v_me is null then
    return jsonb_build_object('ok', false, 'code', 'no-wallet',
      'message', 'This session has no linked wallet. Nothing was changed.');
  end if;
  if p_status not in ('accepted', 'declined', 'withdrawn') then
    return jsonb_build_object('ok', false, 'code', 'bad-status',
      'message', 'An offer is accepted, declined or withdrawn. Nothing was changed.');
  end if;

  select * into v_offer from public.trade_offers where id = p_offer_id for update;
  if not found or v_offer.status <> 'pending' then
    return jsonb_build_object('ok', false, 'code', 'not-open',
      'message', 'That offer is not open. Nothing was changed.');
  end if;

  -- You withdraw your own offers and you accept or decline everyone else's.
  -- Getting this backwards would let a sender "accept" their own proposal.
  if p_status = 'withdrawn' then
    if v_offer.sender <> v_me then
      return jsonb_build_object('ok', false, 'code', 'not-yours',
        'message', 'Only the sender can withdraw an offer. Nothing was changed.');
    end if;
  elsif v_offer.recipient <> v_me then
    return jsonb_build_object('ok', false, 'code', 'not-yours',
      'message', 'That offer was not addressed to this wallet. Nothing was changed.');
  end if;

  update public.trade_offers set status = p_status, responded_at = now() where id = p_offer_id;

  return jsonb_build_object(
    'ok', true,
    'status', p_status,
    -- Said in the response so no caller can render an acceptance as a settlement.
    'settled', false,
    'note', 'Accepting records the decision. Nothing changed hands — there is no escrow, so the two wallets settle through the marketplace.'
  );
end;
$$;

-- Offers that ran out. Idempotent and safe to schedule; nothing depends on it
-- having run, because a caller reading a pending offer past its expiry can see
-- the timestamp for itself.
create or replace function public.expire_trade_offers()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gone integer;
begin
  update public.trade_offers
     set status = 'expired', responded_at = now()
   where status = 'pending' and expires_at is not null and expires_at <= now();
  get diagnostics v_gone = row_count;
  return v_gone;
end;
$$;

-- ---------------------------------------------------------------------------
-- Execution grants
-- ---------------------------------------------------------------------------

revoke all on function public.send_friend_request(uuid, text, text) from public, anon, authenticated;
revoke all on function public.respond_to_friend_request(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.remove_friend(uuid, text) from public, anon, authenticated;
revoke all on function public.send_message(uuid, text, text) from public, anon, authenticated;
revoke all on function public.mark_thread_read(uuid, uuid) from public, anon, authenticated;
revoke all on function public.send_trade_offer(uuid, text, bigint[], bigint[], text, text, text, integer) from public, anon, authenticated;
revoke all on function public.respond_to_trade_offer(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.expire_trade_offers() from public, anon, authenticated;

grant execute on function public.send_friend_request(uuid, text, text) to service_role;
grant execute on function public.respond_to_friend_request(uuid, uuid, boolean) to service_role;
grant execute on function public.remove_friend(uuid, text) to service_role;
grant execute on function public.send_message(uuid, text, text) to service_role;
grant execute on function public.mark_thread_read(uuid, uuid) to service_role;
grant execute on function public.send_trade_offer(uuid, text, bigint[], bigint[], text, text, text, integer) to service_role;
grant execute on function public.respond_to_trade_offer(uuid, uuid, text) to service_role;
grant execute on function public.expire_trade_offers() to service_role;

grant execute on function public.pair_key(text, text) to public;


-- =========================================================================
-- SECTION 15 of 16 — 20260806091000_payout_requests.sql
-- =========================================================================

-- xNFTs index — payout_requests: the SOL claim queue the admin desk works.
--
-- ===========================================================================
-- THIS IS NOT public.payouts. READ THIS BEFORE USING EITHER.
-- ===========================================================================
-- Two queues exist and they are about different money moving in different
-- directions. Confusing them would let a holder's claim be settled by a
-- transaction that paid the dev wallet, so they are separate tables with
-- separate writers and no shared status vocabulary.
--
--   public.payouts          — the OPERATOR sweeping $xNFT fees out of the
--                             treasury to the dev wallet. One signer, one
--                             destination read from configuration, settled by
--                             `confirm-payout` re-reading the chain. Money
--                             leaving the protocol.
--   public.payout_requests  — a HOLDER asking to be paid their accrued yield, in
--                             SOL, out of pump.fun creator fees. Money arriving
--                             at a user. There is no automated settlement and
--                             there is not going to be one: an operator sends the
--                             SOL by hand from a wallet this backend does not
--                             hold a key for, and then records the signature.
--
-- ===========================================================================
-- WHAT A REQUEST IS AND IS NOT
-- ===========================================================================
-- It is a ticket. `src/lib/earnings.ts` computes the claimable figure from
-- accrual — a pure function of hire time and skills — and mints a human-readable
-- claim id (`XN-A3K7M-9PQR2`, Crockford base32 with I/L/O/U removed so it
-- survives being read down a phone line). The row here is that ticket.
--
-- It is NOT an instruction to a machine. Nothing in this schema can move SOL, no
-- function here signs anything, and `status = 'paid'` is a statement an operator
-- makes about a transfer they performed — recorded with its signature so anybody
-- can go and check it, which is the only kind of verification available when the
-- paying key never comes near this system.
--
-- ===========================================================================
-- THE AMOUNT
-- ===========================================================================
-- Two figures, and the distinction is the same one `public.payouts` draws.
--
--   `amount_usd`      — the USD the requester was shown when they clicked. A
--                       display notional in exact decimal; it gates nothing.
--   `amount_lamports` — the SOL figure, in raw units as a digit string. This is
--                       the money column, and it is a u64_text for the reason the
--                       domain exists: PostgREST serialises numeric as a JSON
--                       number and a lamport figure that has been through a
--                       double is a lamport figure that is wrong.
--   `paid_lamports`   — what actually went out, filled in with the signature.
--                       NULL until then, so "requested" and "paid" can never be
--                       read as the same number.

create table public.payout_requests (
  -- The claim id IS the primary key. It is what a support ticket is resolved by
  -- and what a user reads out loud, so giving the row a uuid alongside it would
  -- create a second identity for the same thing and an opportunity for the two to
  -- be quoted at each other.
  --
  -- The pattern is CLAIM_ID_RE from src/lib/earnings.ts, restated here rather
  -- than assumed: an id generated by some other client still has to look like one
  -- of ours or it cannot enter the queue.
  claim_id text primary key check (claim_id ~ '^XN-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$'),

  wallet public.base58_address not null,

  amount_usd      numeric(20, 2)   not null check (amount_usd > 0),
  amount_lamports public.u64_text  not null,
  -- The rate the quote was made at, so a settled ticket can be read back years
  -- later without wondering what SOL was worth that afternoon. Display only.
  sol_usd_at_request numeric(20, 6) not null check (sol_usd_at_request > 0),

  --   pending   — in the queue, nobody has looked at it.
  --   approved  — an operator has accepted it and intends to pay. Not money yet.
  --   paid      — SOL was sent; the signature is on the row.
  --   rejected  — an operator declined it, with a reason.
  --   cancelled — the requester withdrew it before it was settled.
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'paid', 'rejected', 'cancelled')),

  -- The SOL transfer. Not a foreign key to anything and not verified by this
  -- backend — it is a Solana signature on a transaction sent from a wallet whose
  -- key lives with the operator. Unique, so one transfer cannot be used to settle
  -- two tickets.
  signature     public.tx_signature unique,
  paid_lamports public.u64_text,

  -- Free text from whoever worked the ticket. Visible to the requester, so it is
  -- an explanation rather than an internal note — a rejection with no sentence
  -- attached is how a support queue turns into a grievance.
  operator_note text check (operator_note is null or length(operator_note) <= 500),

  requested_at timestamptz not null default now(),
  reviewed_at  timestamptz,
  paid_at      timestamptz,
  updated_at   timestamptz not null default now(),

  -- 'paid' is reachable only with the evidence. Three columns move together or
  -- the row is refused, which makes "we only mark it paid once it is paid" a
  -- property of the table rather than of the endpoint that writes it.
  constraint payout_requests_paid_has_evidence check (
    (status = 'paid' and signature is not null and paid_lamports is not null and paid_at is not null)
    or (status <> 'paid' and signature is null and paid_lamports is null and paid_at is null)
  ),
  -- A rejection carries its reason. Without this, a declined ticket can sit in
  -- somebody's history with no explanation and no way to get one.
  constraint payout_requests_rejection_has_reason check (
    status <> 'rejected' or operator_note is not null
  ),
  -- Anything an operator has touched says when.
  constraint payout_requests_reviewed_has_timestamp check (
    status in ('pending', 'cancelled') or reviewed_at is not null
  )
);

-- ONE OPEN REQUEST PER WALLET, as a constraint rather than as a check somebody
-- performs. This is the same shape as the mint reservation index and it is doing
-- the same job: two clicks arriving together cannot both open a ticket, so a
-- wallet cannot get its accrued yield queued twice and paid twice by an operator
-- working down a list.
create unique index payout_requests_one_open_per_wallet
  on public.payout_requests (wallet) where status in ('pending', 'approved');

create index payout_requests_queue_idx  on public.payout_requests (status, requested_at asc);
create index payout_requests_wallet_idx on public.payout_requests (wallet, requested_at desc);

comment on table public.payout_requests is
  'Holders asking to be paid their accrued yield in SOL from pump.fun creator fees. A ticket, not an instruction: nothing here can move SOL, and ''paid'' is an operator recording a transfer they made by hand, with its signature.';
comment on column public.payout_requests.claim_id is
  'The id a human reads out. Crockford base32 with I, L, O and U removed so 1/I and 0/O are never both drawable — see CLAIM_ID_RE in src/lib/earnings.ts.';
comment on column public.payout_requests.signature is
  'The SOL transfer an operator sent. This backend does NOT verify it — the paying key never touches this system — so it is published for anyone to check rather than presented as something the server confirmed.';
comment on column public.payout_requests.amount_lamports is
  'The money column, in raw units. amount_usd beside it is a display notional and gates nothing.';

-- ---------------------------------------------------------------------------
-- Operator identity
-- ---------------------------------------------------------------------------

-- Who may work the queue. A table rather than a hard-coded address, so adding or
-- removing an operator is an INSERT and not a deploy — and so the answer to "who
-- could have marked this paid" is a query rather than an archaeology exercise
-- through old builds.
--
-- Seeded EMPTY on purpose, which is the same discipline as every deployment
-- constant in src/lib/spl.ts: with no rows, every operator action refuses. An
-- operator is added deliberately, once, by somebody with database access.
create table public.operators (
  wallet     public.base58_address primary key,
  label      text,
  can_pay    boolean not null default true,
  added_at   timestamptz not null default now(),
  removed_at timestamptz
);

comment on table public.operators is
  'Wallets allowed to work the payout queue. Ships EMPTY, so every operator path refuses until somebody with database access adds a row — the same "unset means disabled" rule the deployment constants follow.';

create or replace function public.is_operator(p_wallet text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.operators
     where wallet = p_wallet and removed_at is null and can_pay
  )
$$;

-- ---------------------------------------------------------------------------
-- request_payout — the holder's side
-- ---------------------------------------------------------------------------

-- The wallet comes from the session, never from the caller. The claim id and the
-- amount DO come from the client, and that is worth being honest about rather
-- than dressing up: accrual is computed in the browser from a deterministic
-- function of hire time and skills, so the figure a request carries is the
-- browser's arithmetic.
--
-- What the database enforces around it:
--
--   * the requester owns at least one xployee — you cannot claim yield from an
--     empty wallet;
--   * the amount does not exceed what this wallet's holdings could possibly have
--     accrued, recomputed HERE from `principal x apy x tenure` and net of
--     everything already requested. This is the check that matters: it does not
--     trust the client's number, it bounds it;
--   * one open ticket per wallet, by unique index.
--
-- The bound is generous by construction — it ignores rentals redirecting yield,
-- so it can only ever be too permissive rather than too strict, and a holder is
-- never refused money they are owed because of a rounding difference between two
-- languages. An operator still reviews every ticket. That is the actual control,
-- and this function's job is to stop the queue filling with impossible numbers.
create or replace function public.request_payout(
  p_user_id     uuid,
  p_claim_id    text,
  p_amount_usd  numeric,
  p_sol_usd     numeric
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet    text;
  v_accrued   numeric;
  v_requested numeric;
  v_lamports  numeric;
  v_crew      integer;
begin
  v_wallet := public.actor_wallet(p_user_id);
  if v_wallet is null then
    return jsonb_build_object('ok', false, 'code', 'no-wallet',
      'message', 'This session has no linked wallet. Nothing was requested.');
  end if;
  if p_claim_id is null or p_claim_id !~ '^XN-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$' then
    return jsonb_build_object('ok', false, 'code', 'bad-claim-id',
      'message', 'That is not a claim id. Nothing was requested.');
  end if;
  if p_amount_usd is null or p_amount_usd <= 0 then
    return jsonb_build_object('ok', false, 'code', 'bad-amount',
      'message', 'A request has to be for a positive amount. Nothing was requested.');
  end if;
  if p_sol_usd is null or p_sol_usd <= 0 then
    return jsonb_build_object('ok', false, 'code', 'bad-rate',
      'message', 'A request has to carry the SOL price it was quoted at. Nothing was requested.');
  end if;

  -- Idempotent on the claim id: a retried post finds its own ticket rather than
  -- opening a second one, and the partial unique index would refuse the second
  -- anyway.
  if exists (select 1 from public.payout_requests where claim_id = p_claim_id) then
    return jsonb_build_object('ok', true, 'outcome', 'duplicate', 'claim_id', p_claim_id);
  end if;

  select count(*),
         coalesce(sum(
           x.principal * x.apy
             * greatest(0, extract(epoch from (now() - x.hired_at))) / (86400 * 365)
         ), 0)
    into v_crew, v_accrued
    from public.xployees x
   where x.owner = v_wallet and x.hired_at is not null;

  if v_crew = 0 then
    return jsonb_build_object('ok', false, 'code', 'no-crew',
      'message', 'This wallet holds no xployees, so nothing has accrued to it. Nothing was requested.');
  end if;

  -- Everything already spoken for. A rejected ticket releases its amount back;
  -- anything else — pending, approved or paid — is money this wallet has already
  -- asked for, matching requestedUsd() in src/lib/earnings.ts.
  select coalesce(sum(amount_usd), 0) into v_requested
    from public.payout_requests
   where wallet = v_wallet and status <> 'rejected' and status <> 'cancelled';

  if p_amount_usd > greatest(0, v_accrued - v_requested) + 0.01 then
    return jsonb_build_object(
      'ok', false, 'code', 'over-accrual',
      'message', format(
        'This wallet''s crew has accrued about $%s and $%s of that is already spoken for, so $%s cannot be claimed. Nothing was requested.',
        round(v_accrued, 2), round(v_requested, 2), round(p_amount_usd, 2))
    );
  end if;

  if exists (select 1 from public.payout_requests where wallet = v_wallet and status in ('pending', 'approved')) then
    return jsonb_build_object('ok', false, 'code', 'already-open',
      'message', 'This wallet already has a request in the queue. It has to be settled before another can be opened.');
  end if;

  -- USD to lamports at the quoted rate, floored. Flooring is the deliberate
  -- direction here as everywhere else in this codebase: a request never asks for
  -- a lamport more than the quote supports.
  v_lamports := trunc(p_amount_usd / p_sol_usd * 1000000000);

  insert into public.payout_requests (claim_id, wallet, amount_usd, amount_lamports, sol_usd_at_request)
  values (p_claim_id, v_wallet, round(p_amount_usd, 2), v_lamports::text, p_sol_usd);

  return jsonb_build_object(
    'ok', true, 'outcome', 'queued',
    'claim_id', p_claim_id,
    'amount_usd', round(p_amount_usd, 2),
    'amount_lamports', v_lamports::text
  );
end;
$$;

-- The requester withdrawing their own ticket. Only while it is still open — once
-- an operator has paid it there is a transfer on a ledger somewhere, and a row
-- that says 'cancelled' next to a signature would be a lie about money that moved.
create or replace function public.cancel_payout_request(p_user_id uuid, p_claim_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet text;
  v_hit    integer;
begin
  v_wallet := public.actor_wallet(p_user_id);
  if v_wallet is null then
    return jsonb_build_object('ok', false, 'code', 'no-wallet',
      'message', 'This session has no linked wallet. Nothing was changed.');
  end if;

  update public.payout_requests
     set status = 'cancelled', updated_at = now()
   where claim_id = p_claim_id and wallet = v_wallet and status = 'pending';
  get diagnostics v_hit = row_count;

  if v_hit = 0 then
    return jsonb_build_object('ok', false, 'code', 'not-cancellable',
      'message', 'That claim is not this wallet''s, or it is no longer pending. Nothing was changed.');
  end if;
  return jsonb_build_object('ok', true, 'claim_id', p_claim_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- resolve_payout_request — the operator's side
-- ---------------------------------------------------------------------------

-- Approve, reject, or record a payment. The operator is resolved from the session
-- and checked against `public.operators`, so authority is a row in a table rather
-- than a comparison against a constant compiled into a bundle.
--
-- Marking a ticket paid REQUIRES the signature and the lamport figure. Not
-- because this backend can verify them — it cannot, the paying key is not here —
-- but because a settled row without them is unauditable, and an unauditable
-- payout record is worse than none: it is a claim of payment that nobody can
-- check and nobody can disprove.
create or replace function public.resolve_payout_request(
  p_user_id   uuid,
  p_claim_id  text,
  p_status    text,
  p_note      text default null,
  p_signature text default null,
  p_lamports  text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator text;
  v_row      public.payout_requests;
begin
  v_operator := public.actor_wallet(p_user_id);
  if v_operator is null or not public.is_operator(v_operator) then
    -- One sentence for "not signed in" and "not an operator" alike. Telling an
    -- unauthorised caller which of the two they failed is telling them how to
    -- fix it.
    return jsonb_build_object('ok', false, 'code', 'not-operator',
      'message', 'This session is not an operator of the payout queue. Nothing was changed.');
  end if;
  if p_status not in ('approved', 'rejected', 'paid') then
    return jsonb_build_object('ok', false, 'code', 'bad-status',
      'message', 'An operator approves, rejects or records payment. Nothing was changed.');
  end if;

  select * into v_row from public.payout_requests where claim_id = p_claim_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not-found',
      'message', 'No claim with that id. Nothing was changed.');
  end if;
  -- Settlement is one-way. A paid ticket cannot be re-opened, re-approved or
  -- rejected after the fact — the transfer already happened.
  if v_row.status not in ('pending', 'approved') then
    return jsonb_build_object('ok', false, 'code', 'already-settled',
      'message', format('That claim is already %s. Nothing was changed.', v_row.status));
  end if;

  if p_status = 'rejected' and nullif(btrim(coalesce(p_note, '')), '') is null then
    return jsonb_build_object('ok', false, 'code', 'reason-required',
      'message', 'A rejection needs a reason the requester can read. Nothing was changed.');
  end if;

  if p_status = 'paid' then
    if p_signature is null or p_signature !~ '^[1-9A-HJ-NP-Za-km-z]{64,88}$' then
      return jsonb_build_object('ok', false, 'code', 'signature-required',
        'message', 'Recording a payment needs the signature of the SOL transfer. Nothing was changed.');
    end if;
    if p_lamports is null or p_lamports !~ '^(0|[1-9][0-9]{0,19})$' or p_lamports = '0' then
      return jsonb_build_object('ok', false, 'code', 'amount-required',
        'message', 'Recording a payment needs the lamports actually sent. Nothing was changed.');
    end if;
    if exists (select 1 from public.payout_requests where signature = p_signature and claim_id <> p_claim_id) then
      return jsonb_build_object('ok', false, 'code', 'signature-reused',
        'message', 'That signature already settles another claim. One transfer settles one ticket. Nothing was changed.');
    end if;

    update public.payout_requests
       set status = 'paid',
           signature = p_signature,
           paid_lamports = p_lamports,
           paid_at = now(),
           reviewed_at = coalesce(reviewed_at, now()),
           operator_note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), operator_note),
           updated_at = now()
     where claim_id = p_claim_id;
  else
    update public.payout_requests
       set status = p_status,
           reviewed_at = now(),
           operator_note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), operator_note),
           updated_at = now()
     where claim_id = p_claim_id;
  end if;

  return jsonb_build_object('ok', true, 'claim_id', p_claim_id, 'status', p_status, 'operator', v_operator);
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

-- The admin desk subscribes to this queue, so a ticket opened while the operator
-- is looking at the page appears without a refresh.
--
-- `replica identity full` so an UPDATE payload carries the PREVIOUS row as well
-- as the new one. Without it Postgres publishes only the primary key for the old
-- tuple, and a desk watching for "pending became paid" would have to re-query to
-- find out what a row changed FROM — which is a round trip per event and a race
-- with the next update.
--
-- Note that realtime respects RLS for the anon key: an unauthenticated browser
-- receives these events only because the read policy in 20260806091100 publishes
-- the queue, and every column it can see is one it could already have selected.
alter table public.payout_requests replica identity full;
alter table public.payouts         replica identity full;

do $$
begin
  -- The publication exists on every Supabase project, but this migration should
  -- not fail on a bare Postgres that has never had Realtime enabled.
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.payout_requests;
    alter publication supabase_realtime add table public.payouts;
    alter publication supabase_realtime add table public.mints;
  else
    raise notice 'publication supabase_realtime does not exist; realtime was not configured';
  end if;
exception
  when duplicate_object then
    raise notice 'tables are already in the supabase_realtime publication';
end;
$$;

-- ---------------------------------------------------------------------------
-- Execution grants
-- ---------------------------------------------------------------------------

revoke all on function public.is_operator(text) from public, anon, authenticated;
revoke all on function public.request_payout(uuid, text, numeric, numeric) from public, anon, authenticated;
revoke all on function public.cancel_payout_request(uuid, text) from public, anon, authenticated;
revoke all on function public.resolve_payout_request(uuid, text, text, text, text, text) from public, anon, authenticated;

grant execute on function public.is_operator(text) to service_role;
grant execute on function public.request_payout(uuid, text, numeric, numeric) to service_role;
grant execute on function public.cancel_payout_request(uuid, text) to service_role;
grant execute on function public.resolve_payout_request(uuid, text, text, text, text, text) to service_role;


-- =========================================================================
-- SECTION 16 of 16 — 20260806091100_rls_policies.sql
-- =========================================================================

-- xNFTs index — row level security for everything added since 20260805120200.
--
-- The rule from that file is unchanged and this one extends it rather than
-- reopening it:
--
--   THE ANON KEY CAN SELECT PUBLIC DATA AND CAN INSERT, UPDATE OR DELETE
--   NOTHING, ANYWHERE, EVER.
--
-- Three independent layers, exactly as before. GRANT (anon holds SELECT and
-- nothing else, so a client INSERT is refused before RLS is consulted),
-- RESTRICTIVE deny-write policies on every verb of every table (which survive
-- someone later adding a well-meaning permissive one), and writers that are
-- SECURITY DEFINER functions granted only to service_role.
--
-- ===========================================================================
-- WHAT IS NEW: THERE IS NOW A SESSION, SO SOME THINGS CAN BE PRIVATE
-- ===========================================================================
-- 20260805120200 argued — correctly, for what existed then — that a policy
-- depending on a JWT claim this app could not mint was theatre, and made
-- everything public. Supabase Auth with the X provider changes the premise:
-- `authenticated` is now a role a real visitor can actually hold, and
-- `public.current_wallet()` resolves it to the wallet that PROVED it owns that
-- session.
--
-- So the tables that hold correspondence between two people are no longer
-- published to the world. Direct messages, open friend requests and trade offers
-- are readable by their participants and by nobody else. That is not theatre:
-- the lock has a wall beside it, because the only other route to those rows is
-- an Edge Function that resolves the same identity server-side.
--
-- ===========================================================================
-- WHAT STAYS PUBLIC, AND WHY EACH ONE
-- ===========================================================================
--   the collection, the tiers, the skills, the trait vocabulary
--                       — this is the artwork's metadata. Hiding an NFT
--                         collection's attributes would be strange.
--   the reveal order    — it is ALREADY public and nothing here changes that:
--                         `mintOrder()` is a fixed-seed shuffle compiled into the
--                         browser bundle, so anyone can derive the whole
--                         permutation offline. See the note below, because the
--                         consequence deserves stating plainly rather than
--                         hiding behind a policy that would not hide anything.
--   the mint policy     — published limits. A rate limit whose numbers are secret
--                         is a rate limit users experience as random failure.
--   listings, trades, rentals, the simulated fee ledger, the epoch ledger
--                       — the marketplace. All of it is meant to be read.
--   friendships         — profiles render friend lists; the graph is the product.
--   profiles            — a public profile, minus the columns that identify a
--                         session (see the column grants).
--   paid payout requests — a paid one names a SOL transfer that is on a public
--                         ledger, which is the same argument 20260805120200 made
--                         for publishing `payouts`. Pending and rejected ones are
--                         not on any ledger and stay private.
--
-- ===========================================================================
-- A CONSEQUENCE OF THE PUBLIC REVEAL ORDER, SAID OUT LOUD
-- ===========================================================================
-- Because the permutation is derivable in a browser and serials are dealt from
-- the head of the pool in order, a determined buyer can compute which draw
-- position yields an X-RATED and mint precisely when the pool head reaches it.
-- Publishing `reveal_order` does not create that exposure and restricting it
-- would not remove it.
--
-- What actually bounds it is `mint_policy`: a sniper cannot choose a position,
-- only wait for one, and while they wait the cooldown and the global window mean
-- they are queueing against everybody else on equal terms. Closing it properly
-- needs a commit–reveal with a seed the client does not hold, which is a
-- different design and is recorded as a known gap in supabase/README.md rather
-- than papered over here.

-- ---------------------------------------------------------------------------
-- Session helpers
-- ---------------------------------------------------------------------------

-- The wallet behind the current session, or null.
--
-- ZERO ARGUMENTS, deliberately. `actor_wallet(uuid)` stays closed to clients
-- because a caller who can pass a user id can enumerate the mapping from auth
-- users to wallets. This one reads `auth.uid()` itself, so the only question it
-- can answer is "who am I".
create or replace function public.current_wallet()
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select w.wallet from public.wallet_identities w where w.auth_user_id = auth.uid()
$$;

create or replace function public.is_current_operator()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.wallet_identities w
      join public.operators o on o.wallet = w.wallet
     where w.auth_user_id = auth.uid()
       and o.removed_at is null
       and o.can_pay
  )
$$;

comment on function public.current_wallet() is
  'The wallet that proved it owns the current session, or null. Takes no argument on purpose: a parameterised version would let any signed-in user enumerate the auth-user-to-wallet mapping.';

grant execute on function public.current_wallet() to anon, authenticated;
grant execute on function public.is_current_operator() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
--
-- Not FORCED, for the reason 20260805120200 gives: FORCE ROW LEVEL SECURITY
-- would subject the table owner to these policies too, and the owner is exactly
-- who the SECURITY DEFINER writers run as. Forcing it locks out the only
-- legitimate writer.

alter table public.tiers                   enable row level security;
alter table public.skills                  enable row level security;
alter table public.trait_values            enable row level security;
alter table public.xployee_skills          enable row level security;
alter table public.reveal_order            enable row level security;
alter table public.mint_policy             enable row level security;
alter table public.mint_rate_limits        enable row level security;
alter table public.mint_reservations       enable row level security;
alter table public.profiles                enable row level security;
alter table public.wallet_identities       enable row level security;
alter table public.wallet_link_challenges  enable row level security;
alter table public.rentals                 enable row level security;
alter table public.sim_fee_ledger          enable row level security;
alter table public.epochs                  enable row level security;
alter table public.epoch_yields            enable row level security;
alter table public.friend_requests         enable row level security;
alter table public.friendships             enable row level security;
alter table public.threads                 enable row level security;
alter table public.messages                enable row level security;
alter table public.trade_offers            enable row level security;
alter table public.trade_offer_legs        enable row level security;
alter table public.payout_requests         enable row level security;
alter table public.operators               enable row level security;

-- ---------------------------------------------------------------------------
-- Layer 1 — table privileges
-- ---------------------------------------------------------------------------

-- Everything closed first, so a table added to the list below without a matching
-- grant is unreadable rather than accidentally writable.
revoke all on public.tiers                  from anon, authenticated;
revoke all on public.skills                 from anon, authenticated;
revoke all on public.trait_values           from anon, authenticated;
revoke all on public.xployee_skills         from anon, authenticated;
revoke all on public.reveal_order           from anon, authenticated;
revoke all on public.mint_policy            from anon, authenticated;
revoke all on public.mint_rate_limits       from anon, authenticated;
revoke all on public.mint_reservations      from anon, authenticated;
revoke all on public.profiles               from anon, authenticated;
revoke all on public.wallet_identities      from anon, authenticated;
revoke all on public.wallet_link_challenges from anon, authenticated;
revoke all on public.rentals                from anon, authenticated;
revoke all on public.sim_fee_ledger         from anon, authenticated;
revoke all on public.epochs                 from anon, authenticated;
revoke all on public.epoch_yields           from anon, authenticated;
revoke all on public.friend_requests        from anon, authenticated;
revoke all on public.friendships            from anon, authenticated;
revoke all on public.threads                from anon, authenticated;
revoke all on public.messages               from anon, authenticated;
revoke all on public.trade_offers           from anon, authenticated;
revoke all on public.trade_offer_legs       from anon, authenticated;
revoke all on public.payout_requests        from anon, authenticated;
revoke all on public.operators              from anon, authenticated;

grant select on public.tiers             to anon, authenticated;
grant select on public.skills            to anon, authenticated;
grant select on public.trait_values      to anon, authenticated;
grant select on public.xployee_skills    to anon, authenticated;
grant select on public.reveal_order      to anon, authenticated;
grant select on public.mint_policy       to anon, authenticated;
grant select on public.mint_reservations to anon, authenticated;
grant select on public.rentals           to anon, authenticated;
grant select on public.sim_fee_ledger    to anon, authenticated;
grant select on public.epochs            to anon, authenticated;
grant select on public.epoch_yields      to anon, authenticated;
grant select on public.friendships       to anon, authenticated;
grant select on public.payout_requests   to anon, authenticated;

-- Correspondence: readable only by a session, and then only its own rows. The
-- policies below do the filtering; the grant is what makes the query legal at all.
grant select on public.friend_requests   to authenticated;
grant select on public.threads           to authenticated;
grant select on public.messages          to authenticated;
grant select on public.trade_offers      to authenticated;
grant select on public.trade_offer_legs  to authenticated;

-- COLUMN-LEVEL GRANT. `profiles.auth_user_id` is the join between a public wallet
-- and a private GoTrue user, and nothing outside this schema has any business
-- reading it — publishing it would let anyone build the mapping the zero-argument
-- `current_wallet()` above exists to avoid handing out. A column grant is the
-- right tool: it is enforced by the planner rather than by remembering to write
-- `select=...` correctly at every call site, and `select *` from anon simply
-- returns the columns it is allowed.
grant select (
  wallet, handle, bio, avatar_xployee_id,
  twitter_handle, twitter_verified_at,
  created_at, updated_at
) on public.profiles to anon, authenticated;

-- Deliberately NO grant at all:
--   wallet_identities      — holds auth_user_id and the signature that proved a
--                            link. The public projection of it is profiles.
--   wallet_link_challenges — a nonce is a secret until it is spent.
--   mint_rate_limits       — the live state of a security control. Publishing
--                            when a window resets is publishing when to attack.
--   operators              — an authority list is a target list, and nothing in
--                            the UI needs it: an operator's own session already
--                            knows, through is_current_operator().

-- Views inherit nothing; they need their own grant. Both are security_invoker,
-- so the underlying policies still apply to whoever queries them.
grant select on public.xployee_desks to anon, authenticated;
grant select on public.friend_edges  to anon, authenticated;

-- Sequences and default privileges were closed in 20260805120200 and are
-- restated here so this file can be read on its own.
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Layer 2 — read policies
-- ---------------------------------------------------------------------------

-- ---- The collection ----

create policy "tiers are public" on public.tiers
  for select to anon, authenticated using (true);
create policy "skills are public" on public.skills
  for select to anon, authenticated using (true);
create policy "trait vocabulary is public" on public.trait_values
  for select to anon, authenticated using (true);
create policy "xployee skills are public" on public.xployee_skills
  for select to anon, authenticated using (true);

-- Public because it already is — see the note at the top of this file. A policy
-- restricting a permutation that every visitor can recompute from the bundle
-- would protect nothing and would invite somebody to reason that it did.
create policy "the reveal order is public" on public.reveal_order
  for select to anon, authenticated using (true);

-- ---- The mint ----

create policy "the mint policy is published" on public.mint_policy
  for select to anon, authenticated using (true);

-- Reservations are supply information: which serials are spoken for right now.
-- The buyer already knows their own, and everyone benefits from the mint page
-- being able to say how much of the collection is genuinely still available
-- rather than counting a pool that includes held positions.
create policy "reservations are public" on public.mint_reservations
  for select to anon, authenticated using (true);

-- ---- The marketplace ----

create policy "rentals are public" on public.rentals
  for select to anon, authenticated using (true);
create policy "simulated fees are public" on public.sim_fee_ledger
  for select to anon, authenticated using (true);
create policy "the epoch ledger is public" on public.epochs
  for select to anon, authenticated using (true);
create policy "epoch yields are public" on public.epoch_yields
  for select to anon, authenticated using (true);

-- ---- Identity ----

-- The public half of a profile. The private half is excluded by the column
-- grant above rather than by this predicate, because a row-level policy cannot
-- hide a column and pretending otherwise is how `select auth_user_id` starts
-- working one day.
create policy "profiles are public" on public.profiles
  for select to anon, authenticated using (true);

-- ---- The social graph ----

-- Friendships are public: profiles render friend lists, and the connection graph
-- is a feature rather than a confidence.
create policy "friendships are public" on public.friendships
  for select to anon, authenticated using (true);

-- Requests are not. An open request is a thing one person has said to another and
-- nobody else, and a public request table would publish every rejection.
--
-- `(select public.current_wallet())` rather than a bare call: wrapping it in a
-- scalar subquery makes Postgres evaluate it once per statement as an InitPlan
-- instead of once per row.
create policy "a party reads its own friend requests" on public.friend_requests
  for select to authenticated
  using (
    requester = (select public.current_wallet())
    or addressee = (select public.current_wallet())
  );

create policy "a participant reads their own threads" on public.threads
  for select to authenticated
  using (
    participant_a = (select public.current_wallet())
    or participant_b = (select public.current_wallet())
  );

-- Messages are filtered through their thread rather than by a sender/recipient
-- column, so a message can only be read by someone who can read the conversation
-- it is in. One predicate, one place for it to be wrong.
create policy "a participant reads their own messages" on public.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.threads t
       where t.id = messages.thread_id
         and (t.participant_a = (select public.current_wallet())
              or t.participant_b = (select public.current_wallet()))
    )
  );

create policy "a party reads its own offers" on public.trade_offers
  for select to authenticated
  using (
    sender = (select public.current_wallet())
    or recipient = (select public.current_wallet())
  );

create policy "a party reads its own offer legs" on public.trade_offer_legs
  for select to authenticated
  using (
    exists (
      select 1 from public.trade_offers o
       where o.id = trade_offer_legs.offer_id
         and (o.sender = (select public.current_wallet())
              or o.recipient = (select public.current_wallet()))
    )
  );

-- ---- The payout queue ----

-- Split on the same reasoning 20260805120200 used to publish `payouts`: a PAID
-- request names a SOL transfer that is already on a public ledger, so gating it
-- here would be theatre. A pending or rejected one is on no ledger at all — it is
-- a support ticket, and publishing everybody's declined claims would be a
-- disclosure with nothing behind it.
create policy "settled payout requests are public" on public.payout_requests
  for select to anon, authenticated using (status = 'paid');

create policy "a requester reads its own claims" on public.payout_requests
  for select to authenticated
  using (wallet = (select public.current_wallet()));

-- The admin desk. This is also what makes the realtime subscription work for an
-- operator and not for anybody else: Realtime evaluates these policies per
-- subscriber, so an unauthenticated socket receives only the 'paid' rows the
-- first policy publishes.
create policy "an operator reads the whole queue" on public.payout_requests
  for select to authenticated
  using ((select public.is_current_operator()));

-- ---------------------------------------------------------------------------
-- Layer 3 — explicit write denial
-- ---------------------------------------------------------------------------

-- Restrictive policies AND together with everything else, so `false` is final: no
-- permissive policy added later can grant a client write, and the denial shows up
-- in \d output instead of being an absence a reviewer has to notice.
--
-- Generated in a loop rather than written out twenty-three times four. Three
-- hand-written blocks of ninety near-identical statements is how one table ends
-- up with two of the three verbs closed and nobody spots the third.
do $$
declare
  t text;
  tables text[] := array[
    'tiers', 'skills', 'trait_values', 'xployee_skills', 'reveal_order',
    'mint_policy', 'mint_rate_limits', 'mint_reservations',
    'profiles', 'wallet_identities', 'wallet_link_challenges',
    'rentals', 'sim_fee_ledger', 'epochs', 'epoch_yields',
    'friend_requests', 'friendships', 'threads', 'messages',
    'trade_offers', 'trade_offer_legs', 'payout_requests', 'operators'
  ];
begin
  foreach t in array tables loop
    execute format(
      'create policy %I on public.%I as restrictive for insert to anon, authenticated with check (false)',
      t || ' accepts no client insert', t);
    execute format(
      'create policy %I on public.%I as restrictive for update to anon, authenticated using (false) with check (false)',
      t || ' accepts no client update', t);
    execute format(
      'create policy %I on public.%I as restrictive for delete to anon, authenticated using (false)',
      t || ' accepts no client delete', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- The check that the loop above actually covered everything
-- ---------------------------------------------------------------------------

-- Every table in `public` must have RLS enabled and must carry a restrictive
-- denial on all three write verbs. A table added by a later migration that
-- forgets its policies fails this block on the next push, which is the only way a
-- list like the one above stays complete.
do $$
declare
  v_rec record;
begin
  for v_rec in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and not c.relrowsecurity
  loop
    raise exception 'table public.% has no row level security', v_rec.relname;
  end loop;

  for v_rec in
    select c.relname,
           count(*) filter (where p.polpermissive = false and p.polcmd = 'a') as ins,
           count(*) filter (where p.polpermissive = false and p.polcmd = 'w') as upd,
           count(*) filter (where p.polpermissive = false and p.polcmd = 'd') as del
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      left join pg_policy p on p.polrelid = c.oid
     where n.nspname = 'public' and c.relkind = 'r'
     group by c.relname
    having count(*) filter (where p.polpermissive = false and p.polcmd = 'a') = 0
        or count(*) filter (where p.polpermissive = false and p.polcmd = 'w') = 0
        or count(*) filter (where p.polpermissive = false and p.polcmd = 'd') = 0
  loop
    raise exception
      'table public.% is missing a restrictive write denial (insert=%, update=%, delete=%)',
      v_rec.relname, v_rec.ins, v_rec.upd, v_rec.del;
  end loop;
end;
$$;