# xNFTs — deployment runbook

Written 2026-08-06 against the current build. Follow it in order; each step
unblocks the next.

**What is actually real:** one on-chain action. Minting signs a single SPL
transfer of 10,000 $xNFT from the buyer to your project wallet. Nothing else
touches a chain — sales, rentals, yield, books, xNET and the whole social layer
are Postgres rows. Payouts are SOL you send by hand from the admin desk.

**Nothing here has been run against a live token or a live database.** The code
is typechecked and unit-tested; the deployment path is not. Expect to find
problems at steps 2 and 5, because that is where reality first gets a vote.

---

## 0. Prerequisites

- A Solana wallet you control with SOL for fees (Phantom or Solflare).
- A Supabase account (free tier is fine to start).
- A Cloudflare account.
- Node 20+ and this repo installed (`npm install`).

---

## 1. Create the wallets

You need **two** addresses. They can be the same wallet, but keeping them
separate means a compromise of one is not a compromise of both.

| Wallet | Holds | Used by |
|---|---|---|
| **Project wallet** | Mint revenue — every buyer's 10,000 $xNFT | `VITE_DEV_WALLET` |
| **Treasury wallet** | Simulated marketplace fees (nothing real today) | `VITE_TREASURY_WALLET` |

The project wallet is also what the admin desk pays out from, so keep enough SOL
in it to cover claims.

> The project wallet address is a **public** value compiled into the bundle. That
> is correct and unavoidable — buyers must be able to see where their money goes.
> The private key never leaves your wallet app.

---

## 2. Set up Supabase

**This is the step most likely to surface a real problem.** Ten migrations exist
and none has ever been executed against a live Postgres.

```bash
npx supabase login
```

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

```bash
npx supabase db push
```

If `db push` fails, that is the expected place to find schema bugs — send me the
error. Then deploy the Edge Functions, which hold the service-role key and are
the only things that write:

```bash
npx supabase functions deploy
```

Set the function secrets (these are **server-side** and never reach the browser):

```bash
npx supabase secrets set SOLANA_RPC_URL=https://your-rpc-endpoint
```

---

## 3. Launch the token

Launch $xNFT on pump.fun and capture the **contract address**. Everything token-
facing stays in a "not launched" state until this exists, by design — no fake CA
is ever rendered.

Capture:
- the CA (base58 mint address)
- your pump.fun URL
- your DexScreener URL once it indexes

---

## 4. Get a real RPC endpoint

The public `mainnet-beta` endpoint is rate-limited hard enough to drop requests
under any real traffic, and it is the default if you leave this unset. Get one
from Helius, Triton or QuickNode. The free tiers are sufficient to start.

---

## 5. Configure the environment

Copy `.env.example` to `.env` and fill it in:

```bash
cp .env.example .env
```

| Variable | What it does | Consequence if unset |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | App runs, all persistence is local-only |
| `VITE_SUPABASE_ANON_KEY` | Public anon key | Same |
| `VITE_SOLANA_RPC_URL` | Your paid RPC | Falls back to public, drops requests under load |
| `VITE_XNFT_MINT` | The $xNFT mint / CA | **Minting refuses entirely** |
| `VITE_DEV_WALLET` | Project wallet — receives mint revenue | **Minting refuses entirely** |
| `VITE_TREASURY_WALLET` | Treasury for simulated fees | Rent/claim paths refuse |
| `VITE_PUMP_FUN_URL` | Token page link | Link hidden |
| `VITE_DEXSCREENER_URL` | Token page link | Link hidden |
| `VITE_SUPPORT_HANDLE` | Shown in the claim-ID modal | Neutral fallback text |
| `VITE_ADMIN_PASSCODE_SHA256` | SHA-256 of your admin passcode | Defaults to the shipped one — **change it** |

Every one defaults to empty, and empty means *refuse*, never *guess*. A build
with no mint address cannot construct a mint transaction at all.

To rotate the admin passcode:

```bash
node -e "console.log(require('crypto').createHash('sha256').update('YOUR-NEW-PASSCODE').digest('hex'))"
```

> **The admin passcode is not a security control.** It hides `/admin` from casual
> visitors. Anyone who reads the bundle gets past it. The control that actually
> holds is the project wallet's signature — no payout can be sent without it, and
> the page says so on screen.

---

## 6. Verify locally before deploying

```bash
npm run build
```

```bash
npm test
```

Then run it against your real configuration and click through: mint page shows
the correct price and an armed button, `/admin` unlocks and lists the queue,
`/token` renders the CA and both market links.

---

## 7. Deploy the frontend

`wrangler.jsonc` is already configured as an assets-only Worker with SPA
fallback, which is what makes a shared deep link to `/marketplace` work.

```bash
npx wrangler login
```

```bash
npm run deploy
```

That returns a `*.workers.dev` URL. Add a custom domain in the Cloudflare
dashboard under Workers → your worker → Settings → Domains.

---

## 8. First mint, watched

Do the first mint yourself, with one wallet, and confirm on Solscan that exactly
10,000 $xNFT moved from the buyer to the project wallet and nothing else moved.
Then confirm the row appears in Supabase.

Only after that is verified should you tell anyone the mint is open.

---

## Operating the payout desk

1. A user requests a payout on `/payments` and receives a claim ID.
2. It appears at `/admin` within 15 seconds (the queue polls; there is no
   websocket).
3. Connect the project wallet. Requests older than 3 hours are flagged, because
   3 hours is what the claim modal promises.
4. Click **Pay**. It builds a SOL transfer to the requester, you approve it in
   your wallet, and the signature is recorded against the claim.

If the transfer lands but recording fails, the desk says so explicitly and tells
you **not** to pay again. Keep the signature — that is the evidence, and paying
twice costs you real SOL.

---

## Known gaps

Things that are true today and that you should know before launching:

- **Migrations have never been executed.** See step 2.
- **The mint path has never run against a live token.** Step 8 is the first time.
- **Mint rate limiting has never been tested under concurrency.** The schema is
  written to be atomic; nobody has fired two simultaneous mints at real Postgres
  to prove it. That matters because the low serials are the rare ones.
- **Fee arithmetic exists twice** — `src/lib/fees.ts` and
  `supabase/functions/_shared/protocol.ts` — with no test pinning them together.
  They agree today by inspection, not by construction.
- **Sales and rentals are simulated.** No escrow exists, so nothing settles them
  on-chain. Handle any real trade manually.
- **The 5%/10% marketplace rates are UI-only.** Nothing enforces them anywhere.
- **`anchor/` is dead code**, kept only because this repo has no version control.
  It was never compiled. Delete it whenever you like.

## Risk

Paying users from creator-fee revenue, and presenting yield figures on tokenized
equities, both carry securities and money-transmission exposure. This is not
legal advice and I am not qualified to give any — get counsel before you take
money from the public.
