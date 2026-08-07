import { Panel, Table, Th, Td, Tr, TierBadge, Chip } from '../components/ui'
import { TIERS } from '../lib/tiers'
import { SKILLS } from '../lib/skills'
import { XSTOCKS } from '../lib/xstocks'
import { UNIFORMS, HEADS, FACES, ACCESSORIES, MAX_SUPPLY } from '../lib/xployee'
import { EPOCHS_PER_YEAR } from '../lib/accrual'
import { XNFT_USD, EXPECTED_MINT_VALUE_USD, TOKEN } from '../lib/market'
import { SIM_RENT_FEE_BPS, SIM_SALE_FEE_BPS, XNFT_DECIMALS, bpsFraction, fromRawUnits, mintAmount } from '../lib/fees'
import { XBOSS_THRESHOLDS } from '../lib/network'
import { XBossBadge } from '../components/XBossBadge'
import { pct, num, usd, shortAddress } from '../lib/format'

/**
 * Derived once, at module scope: the mint cost is a constant, and recomputing it
 * inside the render would invite the copy and the table to drift apart.
 *
 * One figure, not three. A mint is a single transfer with no fee, so the burn and
 * the debit are the same number and there is nothing to total.
 */
const MINT_COST_TOKENS = fromRawUnits(mintAmount(XNFT_DECIMALS), XNFT_DECIMALS)
const MINT_COST_USD = MINT_COST_TOKENS * XNFT_USD

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 max-w-3xl text-[12px] leading-relaxed last:mb-0">{children}</p>
}

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="ui ui-12 mb-2 mt-5 first:mt-0">{children}</h3>
}

export function Docs() {
  return (
    <div className="space-y-4">
      <Panel title="Docs — Mechanism Specification">
        <H>Overview</H>
        <P>
          xNFTs is a collection of {num(MAX_SUPPLY)} generative pixel workers called <strong>xployees</strong>.
          Each xployee carries between one and four <strong>skills</strong>. A skill staffs a <strong>desk</strong>,
          and each desk is tied to an xStock — a tokenized equity that trades on Solana. Skills are the yield
          engine: the more desks an xployee staffs, the more income streams pay into its <strong>book</strong>.
        </P>
        <P>
          Rarity is not cosmetic. Rarity <em>is</em> skill count, which means an xployee's visual tier and its
          economic capacity are the same fact expressed two ways.
        </P>

        <H>Tiers</H>
        <Table>
          <thead>
            <tr>
              <Th>Tier</Th>
              <Th align="right">Skills</Th>
              <Th align="right">Supply</Th>
              <Th align="right">Capital</Th>
              <Th>Badge treatment</Th>
              <Th>Backdrop</Th>
            </tr>
          </thead>
          <tbody>
            {TIERS.map((t, i) => (
              <Tr key={t.id} index={i}>
                <Td>
                  <TierBadge tier={t} />
                </Td>
                <Td align="right">{t.skills}</Td>
                <Td align="right">{pct(t.supply, 0)}</Td>
                <Td align="right">{usd(1000 * t.skills, 0)}</Td>
                <Td className="text-ink-mute">
                  {t.effect === 'glow'
                    ? 'Violet drift through the type'
                    : t.effect === 'laser'
                      ? 'Laser shine sweep + ember emitter'
                      : 'Flat colour, no effect'}
                </Td>
                <Td className="text-ink-mute">
                  {t.id === 'entry'
                    ? 'Flat neutral'
                    : t.id === 'mid'
                      ? 'Vivid solid'
                      : t.id === 'expert'
                        ? 'Procedural rays + stars'
                        : 'Scenic pixel art, weathered'}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>

        <H>Skill registry</H>
        <P>
          Skills are drawn without replacement, weighted so that high-rate skills are scarce. A four-skill
          X-RATED holding both crypto-proxy skills is therefore rare on two axes at once — and the marketplace
          prices it accordingly.
        </P>
        <Table>
          <thead>
            <tr>
              <Th>Skill</Th>
              <Th>Desk</Th>
              <Th>Ticker</Th>
              <Th align="right">Base APY</Th>
              <Th align="right">Draw weight</Th>
            </tr>
          </thead>
          <tbody>
            {SKILLS.map((s, i) => (
              <Tr key={s.id} index={i}>
                <Td>
                  <span className="ui ui-10">{s.label}</span>
                </Td>
                <Td className="text-ink-mute">{s.desk}</Td>
                <Td>${s.ticker}</Td>
                <Td align="right">{pct(s.baseApy)}</Td>
                <Td align="right">{s.weight}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>

        <H>Yield derivation</H>
        <P>
          Each skill receives an equal share of the xployee's principal and a proficiency roll between 60% and
          100%. A skill's effective rate is <code>base APY × proficiency</code>. The xployee's blended APY is
          the <em>mean</em> of its effective skill rates.
        </P>
        <P>
          The mean is deliberate. Summing would make a four-skill worker earn four times an entry-level hire on
          the same capital, which is not a portfolio — it's a multiplier. Averaging means additional skills buy
          diversification, and scarcity still pays because rare high-rate skills lift the average.
        </P>
        <P>
          Accrual is continuous and linear in time, computed as a pure function of hire time, current time,
          skills, and prices. It is monotonic and exactly zero at hire. Accrual is per-NFT, not per-claim:
          skipping a claim never forfeits credit.
        </P>
        <P>
          <strong>Trailing APY</strong> is accrued yield over the trailing 30 epochs divided by average book
          NAV over the same window, annualised. An xployee younger than 30 epochs annualises over its actual
          lifetime and its figure is marked <Chip tone="outline">Est</Chip>.
        </P>

        <H>Epochs</H>
        <P>
          One epoch is 24 hours, {num(EPOCHS_PER_YEAR)} per year. Desks settle at each epoch boundary, and
          contracts open and expire on the same schedule.
        </P>

        <H>Contracts</H>
        <P>
          A contract rents an xployee's output. The owner lists a fee per epoch and a term; the renter pays the
          total up front and receives every dollar the worker produces for the duration. The owner keeps the
          asset and exchanges variable yield for guaranteed income.
        </P>
        <P>
          Renter margin is projected output minus the <em>full</em> cost — the owner's gross plus the{' '}
          {pct(bpsFraction(SIM_RENT_FEE_BPS), 0)} marketplace fee. Positive margin favours the renter, negative
          favours the owner. Because the fee rides on top, break-even sits at a listing spread of 0.909×
          rather than 1.00×; listings are drawn from 0.7–1.4× expected output, so roughly a third of that
          range pays the renter. Listings show gross, fee and total separately, so the bet is never hidden.
        </P>

        {/* keep-case: the heading style is uppercase, and $xNFT is not $XNFT. */}
        <H>
          Fees and the <span className="keep-case">${TOKEN}</span> token
        </H>
        <P>
          There is one token. Mints, sales and contracts are all denominated in <strong>${TOKEN}</strong>,
          valued at {usd(XNFT_USD, 2)} for display purposes. An earlier build priced the market in a second
          token, $XPL, with no conversion between the two anywhere in the codebase — that token is retired.
        </P>
        <Table>
          <thead>
            <tr>
              <Th>Action</Th>
              <Th align="right">Fee</Th>
              <Th>Who pays</Th>
              <Th>Where it goes</Th>
              <Th>Settlement</Th>
            </tr>
          </thead>
          <tbody>
            <Tr index={0}>
              <Td>Mint</Td>
              <Td align="right">{pct(0, 0)}</Td>
              <Td className="text-ink-mute">Nobody — there is no fee</Td>
              <Td className="text-ink-mute">Every token to the project wallet</Td>
              <Td className="text-ink-mute">Token transfer</Td>
            </Tr>
            <Tr index={1}>
              <Td>Sale</Td>
              <Td align="right">{pct(bpsFraction(SIM_SALE_FEE_BPS), 0)}</Td>
              <Td className="text-ink-mute">Buyer; seller receives the full ask</Td>
              <Td className="text-ink-mute">Protocol treasury</Td>
              <Td className="text-ink-mute">Simulated ledger entry</Td>
            </Tr>
            <Tr index={2}>
              <Td>Contract</Td>
              <Td align="right">{pct(bpsFraction(SIM_RENT_FEE_BPS), 0)}</Td>
              <Td className="text-ink-mute">Renter; owner receives the full gross</Td>
              <Td className="text-ink-mute">Protocol treasury</Td>
              <Td className="text-ink-mute">Simulated ledger entry</Td>
            </Tr>
          </tbody>
        </Table>
        <P>
          <strong>Minting takes no fee at all.</strong> It debits {num(MINT_COST_TOKENS)} ${TOKEN} and
          sends every one of them to the project wallet — one transfer, one destination, nothing routed
          to a treasury and nothing skimmed on top. That payment is protocol revenue, not a burn: supply
          is unchanged by minting. The two rates above price sales and contracts, both of which are
          ledger entries in this interface rather than transfers.
        </P>
        <P>
          Where a fee does apply it rides <em>on top</em> of the amount quoted and is rounded down, so the
          counterparty always receives exactly the figure they listed and the payer is never over-charged by
          a rounding unit.
        </P>
        <P>
          The mint price is set to be a fair bet rather than free money. Expected fair value across the tier
          distribution is about {usd(EXPECTED_MINT_VALUE_USD, 0)}, and the mint debit comes to{' '}
          {usd(MINT_COST_USD, 0)} — a mint edge of {pct(MINT_COST_USD / EXPECTED_MINT_VALUE_USD - 1, 2)}.
          Minting is a fairly-priced tier lottery; a buyer who only wants yield should buy the floor instead.
        </P>

        <H>Settlement</H>
        <P>
          There is no protocol program on Solana. Where value moves, it moves as ordinary SPL token
          transfers composed into a single transaction the payer signs. A mint is <em>one</em> transfer:{' '}
          {num(MINT_COST_TOKENS)} ${TOKEN} to the project wallet, from the buyer, under one signature.
          There is no second leg to reconcile and no ordering to get wrong. The destination is a
          deployment constant rather than anything a call site can pass in — but it is a constant the
          operator sets, so it is a promise this client keeps, not one the chain enforces.
        </P>
        <P>
          <strong>Sales are the exception, and they are simulated.</strong> A sale is the only action
          where both sides have to deliver at once: the buyer's ${TOKEN} and the seller's xployee have to
          change hands together or not at all. Without a program holding the asset in escrow, that
          requires both parties to sign the <em>same</em> transaction — and a seller who listed hours ago
          is not present to co-sign when a buyer arrives. Escrow is the one thing a program would
          genuinely have bought here, so buying an xployee writes a ledger entry rather than moving a
          token, and this interface does not pretend otherwise.
        </P>
        <P>
          The treasury is an ordinary wallet whose key an operator holds, not a program-owned account.
          A payout is therefore an authorization that operator performs, not a permission the chain
          enforces on their behalf. The mint is the one place none of that applies: it pays the treasury
          nothing, so there is no rate to trust and no custodian in the path — the tokens go to an address
          nobody holds the key to.
        </P>

        <H>Appearance traits</H>
        <P>
          Independent of tier, for silhouette diversity. Tier owns the palette so rarity stays readable across a
          dense grid; these keep individuals distinct within a tier.
        </P>
        <Table>
          <thead>
            <tr>
              <Th>Layer</Th>
              <Th align="right">Variants</Th>
              <Th>Values</Th>
            </tr>
          </thead>
          <tbody>
            <Tr index={0}>
              <Td>Uniform</Td>
              <Td align="right">{UNIFORMS.length}</Td>
              <Td className="text-ink-mute">{UNIFORMS.join(', ')}</Td>
            </Tr>
            <Tr index={1}>
              <Td>Head</Td>
              <Td align="right">{HEADS.length}</Td>
              <Td className="text-ink-mute">{HEADS.join(', ')}</Td>
            </Tr>
            <Tr index={2}>
              <Td>Face</Td>
              <Td align="right">{FACES.length}</Td>
              <Td className="text-ink-mute">{FACES.join(', ')}</Td>
            </Tr>
            <Tr index={3}>
              <Td>Accessory</Td>
              <Td align="right">{new Set(ACCESSORIES).size}</Td>
              <Td className="text-ink-mute">{[...new Set(ACCESSORIES)].join(', ')}</Td>
            </Tr>
          </tbody>
        </Table>
      </Panel>

      <Panel title="Backdrops">
        <P>
          Rarity is carried by the artwork behind the character, not by tinting the character itself —
          the xployee stays neutral so it reads against anything, and the backdrop does the signalling.
        </P>
        <Table>
          <thead>
            <tr>
              <Th>Tier</Th>
              <Th>Backdrop</Th>
              <Th>Weather</Th>
            </tr>
          </thead>
          <tbody>
            <Tr index={0}>
              <Td>
                <TierBadge tier={TIERS[0]} />
              </Td>
              <Td className="text-ink-mute">Flat neutral — deliberately drab office colour</Td>
              <Td className="text-ink-faint">None</Td>
            </Tr>
            <Tr index={1}>
              <Td>
                <TierBadge tier={TIERS[1]} />
              </Td>
              <Td className="text-ink-mute">Vivid flat colour</Td>
              <Td className="text-ink-faint">None</Td>
            </Tr>
            <Tr index={2}>
              <Td>
                <TierBadge tier={TIERS[2]} />
              </Td>
              <Td className="text-ink-mute">Procedural diagonal rays with starfield</Td>
              <Td className="text-ink-faint">Sparks, stars</Td>
            </Tr>
            <Tr index={3}>
              <Td>
                <TierBadge tier={TIERS[3]} />
              </Td>
              <Td className="text-ink-mute">Scenic pixel art, recoloured per xployee</Td>
              <Td className="text-ink-faint">Snow, rain, thunder, embers</Td>
            </Tr>
          </tbody>
        </Table>
      </Panel>

      <Panel title="xNET & xBoss">
        <P>
          Every xployee in circulation is held by exactly one wallet. <strong>xNET</strong> is the directory
          of those wallets — searchable by handle or address, ranked by portfolio value, yield, or crew size.
        </P>
        <P>
          <strong>xBoss</strong> is a wallet's standing, set by the total book value of the crew it controls
          — capital deployed, not headcount. Ten uncommon workers do not outrank one well-stocked X-RATED.
        </P>
        <Table>
          <thead>
            <tr>
              <Th>Rank</Th>
              <Th align="right">Crew value</Th>
              <Th>Roughly</Th>
            </tr>
          </thead>
          <tbody>
            {[...XBOSS_THRESHOLDS].map((step, i) => (
              <Tr key={step.rank} index={i}>
                <Td>
                  <XBossBadge rank={step.rank} />
                </Td>
                <Td align="right">{usd(step.minValue, 0)}+</Td>
                <Td className="text-ink-mute">
                  {step.rank === 'CEO'
                    ? 'Top few percent of wallets'
                    : step.rank === 'VP'
                      ? 'Next ~15%'
                      : step.rank === 'DIRECTOR'
                        ? 'Next ~30%'
                        : 'Everyone else'}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        <P>
          Thresholds are absolute USD figures rather than percentile ranks, so a rank means "this much
          capital is deployed" and cannot slip because another wallet bought in. One consequence worth
          stating plainly: because books accrue, the population drifts upward over time — the CEO share
          widens as the whole network earns.
        </P>
      </Panel>

      <Panel title="Desk Registry — xStock Addresses">
        <P>
          These are real xStock mint addresses on Solana, verified against Jupiter's token registry. Prices
          shown across the site are fetched live from these mints.
        </P>
        <Table>
          <thead>
            <tr>
              <Th>Ticker</Th>
              <Th>Name</Th>
              <Th>Sector</Th>
              <Th>Mint address</Th>
            </tr>
          </thead>
          <tbody>
            {XSTOCKS.map((s, i) => (
              <Tr key={s.symbol} index={i}>
                <Td>
                  <span className="mono keep-case font-medium">${s.symbol}</span>
                </Td>
                <Td>{s.name}</Td>
                <Td className="text-ink-mute">{s.sector}</Td>
                <Td>
                  <a
                    href={`https://solscan.io/token/${s.mint}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline"
                    title={s.mint}
                  >
                    {shortAddress(s.mint, 8, 8)}
                  </a>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      <Panel title="Disclosure">
        <H>What is real</H>
        <P>
          The xStock mint addresses above are genuine Solana mints issued by Backed Finance, and the prices
          shown throughout this interface are fetched live from Jupiter against those mints. When the price feed
          is unreachable the interface falls back to captured reference prices and labels the reading{' '}
          <Chip tone="outline">Cached</Chip>.
        </P>

        <H>What can move real value</H>
        <P>
          Minting can, and it is the only thing that does. It builds a genuine transaction that debits{' '}
          {num(MINT_COST_TOKENS)} ${TOKEN} from your wallet and sends every one of them to the project
          wallet, which nobody can reverse. Those tokens are not destroyed — they are the protocol's
          revenue, and they remain in circulation. The same transaction layer can build a contract
          payment and a treasury payout, though neither is wired to a button.
        </P>
        <P>
          Minting is off until an operator sets both the ${TOKEN} mint address and the project wallet
          that receives it, and while either is unset every mint path refuses and builds nothing at all.
          There is deliberately no fallback destination: a mint with nowhere to pay must fail rather than
          guess. The Mint page shows the live state of that switch and will not let a transaction be
          built behind it. Nothing is ever sent without a click, and the exact amount is stated before
          the button.
        </P>
        <P>
          So wallet connection is <strong>not</strong> read-only. If minting is configured, this interface will
          ask you to sign a transfer of real tokens.
        </P>

        <H>What is simulated</H>
        <P>
          Everything else, including <strong>sales</strong> — see Settlement above for why that one could not be
          made real without a program. There is no deployed program, no vault, and no custody of your xployees
          by anyone. The {num(MAX_SUPPLY)} xployees, their books, accrued yield, listings, contracts and epoch
          ledger are all generated deterministically in your browser from a seeded random number generator, and
          hiring an xployee writes a record to your browser's local storage.
        </P>
        <P>
          Treasury figures are simulated while the protocol addresses are unset; once they are set the balance
          shown is read live from the treasury's own token account, because with no program keeping counters
          the account is the only thing that knows how much is actually there.
        </P>

        <H>What is not enforced</H>
        <P>
          Because there is no program, three things a reader might reasonably assume are not true. The
          marketplace rates hold inside this interface and nowhere else — nothing prevents a trade arranged
          outside it from charging whatever it likes, and no on-chain rule caps a rate. The treasury is a
          wallet an operator holds the key to, so whoever holds that key can move its balance anywhere; the
          payout destination is a convention this interface follows, not an address the chain constrains.
          And the amount a mint costs is enforced by this client alone: a transaction composed elsewhere
          can send any amount it likes to the project wallet, and the chain will take it. Nor is the
          destination itself constrained — it is a constant in the bundle you loaded, so the operator
          who ships the bundle decides where your payment goes.
        </P>
        <P>
          Nothing here is an offer, a security, or investment advice, and no figure shown should be read as a
          claim about returns.
        </P>
      </Panel>
    </div>
  )
}
