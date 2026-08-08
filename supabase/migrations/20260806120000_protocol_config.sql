-- Runtime deployment configuration.
--
-- These values used to be VITE_ variables, which meant they were compiled into
-- the bundle at build time. Changing the mint address therefore required a
-- rebuild and a redeploy — minutes of downtime for a one-field edit, and no way
-- to correct a wrong address in a hurry. That is the wrong shape for the single
-- value that decides where real money goes.
--
-- They live here instead. An operator edits this row in the Supabase table
-- editor and every browser picks it up within one poll interval, with no deploy.
--
-- What did NOT move: the Supabase URL and anon key stay build-time variables,
-- because they are what a browser needs in order to reach this table at all. A
-- config that told you how to find itself would be a circular dependency.

create table if not exists public.protocol_config (
  -- Single-row table. The check constraint is the enforcement: a second row
  -- would give two browsers two different mint addresses depending on which one
  -- their query happened to return first.
  id smallint primary key default 1 check (id = 1),

  -- The $xNFT SPL mint. THE most important value in this database: it decides
  -- which token a buyer's wallet is asked to send. Empty means "not launched",
  -- and every mint path refuses while it is empty rather than guessing.
  xnft_mint text not null default '',

  -- Where a mint's 10,000 $xNFT lands. Also empty-by-default, and also a hard
  -- refusal when unset — there is no safe fallback for "where does the money go".
  dev_wallet text not null default '',

  -- Simulated marketplace fees only. Nothing real touches this yet.
  treasury_wallet text not null default '',

  -- The Solana RPC the BROWSER uses. Empty falls back to the public
  -- mainnet-beta endpoint, which Solana Labs documents as development-only and
  -- which throttles hard — fine for a site nobody is using, not fine on the
  -- confirmation poll of a mint somebody has already signed and paid for.
  --
  -- Here rather than in a build-time variable for the same reason the mint
  -- address is: swapping providers during an outage must not require a redeploy.
  --
  -- NOT a secret. It ships to every browser and anyone can read it out of the
  -- bundle, which is normal for RPC — restrict the key to your domain in the
  -- provider's dashboard. The Edge Functions read their own SOLANA_RPC_URL
  -- secret and that one should be a DIFFERENT key, because it is genuinely
  -- private and is used to build payout transactions.
  rpc_url text not null default '',

  pump_fun_url text not null default '',
  dexscreener_url text not null default '',
  support_handle text not null default 'xnfts_network',

  -- Lets an operator take the mint offline without clearing the address, which
  -- would otherwise be the only way to stop it and would lose the value.
  minting_enabled boolean not null default true,

  updated_at timestamptz not null default now()
);

-- `create table if not exists` above is a no-op on a database that already has
-- this table, so a column added later would never appear on one. This is what
-- actually installs rpc_url for anyone who ran an earlier version of this file.
alter table public.protocol_config add column if not exists rpc_url text not null default '';

insert into public.protocol_config (id) values (1) on conflict (id) do nothing;

alter table public.protocol_config enable row level security;

-- Readable by anyone. These are all public facts: a mint address and a payee
-- wallet are visible in every transaction the site produces, so hiding them here
-- while publishing them on-chain would protect nothing and would only stop the
-- site from working.
drop policy if exists protocol_config_read on public.protocol_config;
create policy protocol_config_read
  on public.protocol_config
  for select
  to anon, authenticated
  using (true);

-- No write policy of any kind. With RLS on and no permissive policy for
-- insert/update/delete, the anon key cannot change these values — which matters
-- more here than anywhere else in the schema, because whoever controls
-- dev_wallet controls where every buyer's payment is sent. Edits happen through
-- the Supabase dashboard (service role) or an Edge Function, never the browser.
revoke insert, update, delete on public.protocol_config from anon, authenticated;

comment on table public.protocol_config is
  'Single-row runtime config. Edited by the operator in the dashboard; read by every browser. Never writable with the anon key.';

create or replace function public.touch_protocol_config()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists protocol_config_touch on public.protocol_config;
create trigger protocol_config_touch
  before update on public.protocol_config
  for each row execute function public.touch_protocol_config();
