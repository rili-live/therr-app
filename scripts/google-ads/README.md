# Google Ads campaign tooling

A small CLI for creating, funding and reading Google Ads campaigns for
**Friends with Habits**, joined against GA4 and the product database so the
question "did this spend produce anything" has an actual answer.

Agent-oriented notes on *why* it is built this way: [`CLAUDE.md`](CLAUDE.md).
Strategy, thresholds and the decision log: [`docs/PAID_ACQUISITION_PLAYBOOK.md`](../../docs/PAID_ACQUISITION_PLAYBOOK.md).

---

## Setup (once)

```bash
cd scripts/google-ads
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt

./therrads config init          # writes config.yaml + settings.yaml from the examples
```

Then fill in `config.yaml`. It needs four things from **four different places**,
and each one is documented inline in the file:

| Value | Where it comes from |
|---|---|
| `developer_token` | Google Ads UI → Tools & Settings → Setup → **API Center**, on your *manager* account |
| `client_id` / `client_secret` | Google Cloud Console → Credentials → OAuth client ID → **Desktop app** |
| `login_customer_id` | Your manager account id, digits only |
| `refresh_token` | Minted by the next command |

```bash
./therrads auth login           # opens a browser, writes refresh_token into config.yaml
./therrads auth check           # proves it works and lists accounts you can reach
```

Put the account you want to advertise from into `settings.yaml` → `customer_id`.

<details>
<summary><strong>The four things that actually go wrong</strong></summary>

- **`DEVELOPER_TOKEN_NOT_APPROVED`** — a new developer token is issued at "Test
  Account" access and cannot touch a real account. Apply for Basic access in the
  API Center; approval takes 1–3 business days.
- **"It worked last week"** — while the Cloud project's OAuth consent screen is
  in *Testing* status, Google expires refresh tokens after **7 days**. Set it to
  *In production*. (Publishing status is separate from verification; an internal
  unverified app can still be "in production".)
- **`redirect_uri_mismatch`** — the OAuth client is type *Web application*. It
  must be *Desktop app*.
- **`USER_PERMISSION_DENIED`** — `settings.yaml` → `customer_id` is not under
  `config.yaml` → `login_customer_id`, or you authorised the wrong Google
  account. `./therrads auth check` lists what the token can actually see.

</details>

Running headless (no browser on this machine):

```bash
ssh -L 8765:localhost:8765 <this-host>
./therrads auth login --no-browser      # then open the printed URL on your laptop
```

---

## The two campaign arms

The tooling ships two specs, and they are not alternatives — run both.

| | `campaigns/habits-app-install.yaml` | `campaigns/habits-web-landing.yaml` |
|---|---|---|
| **Buys** | Play Store installs | Landing-page signups |
| **Cost** | Lowest available | Several times higher |
| **Attribution** | Blind past the install | Full — click → signup → pact → payer |
| **Answers** | "Can we get volume?" | "Who converts, and are they worth it?" |
| **Budget role** | Growth | Research |

The app arm exists because it is the only realistic way to get volume. The web
arm exists because a Play install never touches a page that can set a UTM, so
`main."userAcquisition"` records nothing for it — every conclusion about the
app arm's users is inference until the Play Install Referrer is wired up.

---

## Creating a campaign

Nothing mutates without `--confirm`. Every command without it prints what it
would do and exits having done nothing.

```bash
./therrads campaign validate campaigns/habits-app-install.yaml   # offline, no credentials
./therrads campaign plan     campaigns/habits-app-install.yaml   # the exact operations
./therrads campaign apply    campaigns/habits-app-install.yaml --confirm
```

Campaigns are created **PAUSED**. Review what was built in the Ads UI, then:

```bash
./therrads campaign resume "FwH-App-US-Installs-2026Q3" --confirm
```

Now leave it alone for seven days. Edits during the learning period reset it.

---

## Budget, flexibly

```bash
./therrads campaign list                                          # what exists, and its budget
./therrads campaign budget "FwH-App-US-Installs-2026Q3" --daily 24 --confirm
./therrads campaign pause  "FwH-App-US-Installs-2026Q3" --confirm
```

Budget is a per-campaign number in a version-controlled YAML file, changeable at
any time, with three guards between you and a mistake:

1. **Hard ceilings** (`settings.yaml` → `limits.max_daily_budget` and
   `max_total_daily_budget`). Over either, the command refuses. The account-wide
   one exists because two campaigns each under the per-campaign cap are still
   twice the intended burn.
2. **A ±20% change warning.** Google resets the learning phase on larger changes,
   so the next reading is not comparable to this one. Override with `--force`.
3. **A learning-period warning** for the first 7 days after start.

Guards warn; they never silently refuse to scale. Raising spend is always
possible, it is just never accidental.

---

## Reading results

```bash
./therrads report ads     --days 14    # impressions, clicks, CPI, ad groups, search terms
./therrads report ga4     --days 14    # web sessions by campaign + the in-app funnel
./therrads report product --days 14    # signups → pacts → invites → check-ins → payers
./therrads report funnel  --days 14    # all three
./therrads analyze        --days 14    # signals, verdicts, and what to do next
```

Add `--json` to any of them for machine-readable output.

`analyze` is the one to run. It judges the data against `settings.yaml` →
`targets` and produces three verdicts — **CHANNEL** (can we buy users at a price
we can pay), **PRODUCT** (do bought users do the thing the app is for), **MODEL**
(does the money work) — each either `VIABLE`, `AT_RISK`, `UNVIABLE`, or
`INSUFFICIENT_DATA`. Below `targets.min_conversions_for_verdict` conversions it
refuses to recommend anything, which is the correct output for a small sample.

### Filing the findings

```bash
./therrads analyze --days 14 --write-work-items
```

Action items are split by kind and written into a **replaceable marker block**:

- code work and manual ops steps → `docs/WORK_IN_PROGRESS.md`, inside
  § Manual Operational Follow-ups where `CLAUDE.md` tells agents to look
- campaign and business decisions → `docs/PAID_ACQUISITION_PLAYBOOK.md`

Re-running replaces the block rather than appending, so the backlog does not
turn into a changelog. Everything outside the markers is never touched. Review
the diff before committing — these are generated claims about the business, and
they are only as good as the window they were computed over.

---

## Suggested cadence

| When | Command |
|---|---|
| Day 0 | `campaign apply` both specs, `campaign resume` the app arm |
| Days 1–7 | Nothing. Learning period. |
| Day 8 | `analyze --days 7`, resume the web arm |
| Weekly | `analyze --days 14 --write-work-items`, then act on P1 items |
| After any budget change | Wait a full 7 days before re-reading |

---

## Development

```bash
python3 -m unittest discover -s tests -t .
```

104 tests, no credentials required, no `google-ads` install required — the pure
layers (`money`, `spec`, `analysis`, `workitems`, and the GA4 crawler guard and
in-app funnel builder) hold the logic worth testing and are deliberately kept
importable on their own.

## Files

```
config.example.yaml     credentials for the google-ads library ONLY
settings.example.yaml   everything else: account, limits, GA4, targets, outputs
campaigns/*.yaml        campaign specs — the declarative source of truth
therr_ads/              the package (see CLAUDE.md for the module map)
tests/                  unit tests for the pure layers
therrads                CLI wrapper; activates .venv if present
```

`config.yaml` and `settings.yaml` are gitignored. `config.yaml` holds the
developer token *and* the refresh token — together they are write access to a
billable ad account.
