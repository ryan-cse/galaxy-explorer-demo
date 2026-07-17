# Agentic quality pipeline with mabl + Claude — setup guide

A reference implementation and setup playbook for teams standing up an **agentic
testing workflow**: a Jira ticket → a built feature (PR) → **Claude-authored unit
tests** (dev-QA layer) → **mabl E2E authored via the mabl MCP** (independent
verification layer) → CI that deploys, runs mabl, and reports failures.

This repo (`ryan-cse/galaxy-explorer-demo`) is the working reference. Every choice
below is grounded in mabl's official documentation (links in **References**); where
we diverged from a naïve first cut, the reason is called out under **Why**.

---

## 1. The idea

> **Claude writes the feature *and* the unit tests; mabl independently verifies the
> *built* result.** Two layers, not one intelligence grading its own homework.

| Layer | Author | Runs | Proves |
|---|---|---|---|
| **Unit tests** (dev QA) | Claude, in the PR | Vitest, in CI | Pure logic is correct in isolation |
| **mabl E2E** (independent verification) | Claude via the **mabl MCP** | mabl cloud, against the deployed site | The built feature works in a real browser |

The **agentic** part is *authoring and triage* (Claude drives mabl through the MCP).
The CI trigger at runtime is ordinary automation — Claude is not in that loop.

---

## 2. Pipeline (`.github/workflows/deploy.yml`)

```
push to main
  → 1. unit-test  (npm ci && npm test)         ── fails? stop
  → 2. deploy     (official GitHub Pages actions)
  → 3. e2e        (run-mabl-tests Action → mabl deployment event, plan label "ci")
  → 4. report     (on mabl failure → Jira bug in SUP + Slack)
```

We use the **official `run-mabl-tests` GitHub Action** to trigger the deployment
event, not a hand-rolled `curl`.
**Why:** mabl's docs state most customers should use a native integration or the
CLI; the raw Deployment Events API is the documented *fallback* "if none of those
options fit." The Action also auto-passes `github.sha`, which powers PR checks and
commit-hash traceability. *(See References: API-based CI/CD integration; Run mabl
tests GitHub Action.)*

---

## 3. Prerequisites

- A GitHub repo with a **static web app served from the repo** (or built to a static
  dir). This reference serves plain HTML/CSS/JS from the root.
- A mabl workspace where you are an **owner** (needed to mint a CI/CD API key).
- Node 20+ for the unit-test layer.

---

## 4. Setup steps

### 4.1 Instrument the app for testability
- Add **stable `data-testid` hooks** to every interactive element. mabl's find model
  and the authoring agent both anchor on them.
- Add a **deterministic data mode** for CI. This reference uses a `?demo=true` URL
  param that forces bundled seed data instead of the live API, so E2E runs are
  stable regardless of upstream API state.
  **Why:** reliable E2E requires deterministic inputs; live third-party data is the
  most common source of flakiness.

### 4.2 Unit-test layer (Vitest)
- Extract pure, side-effect-free logic into an importable module. This reference uses
  a small **UMD `lib.js`** that works both as a browser global *and* a
  `require()`-able module — so the same tested code runs in the app **and** in Vitest
  with **no bundler**.
- `package.json` → `"test": "vitest run"`; `vitest.config.js` → `globals: true`.
- Keep tests in `tests/**/*.test.js`.

### 4.3 GitHub Pages hosting
- Repo must be **public** for Pages on a free plan (or use Pro for private).
- Set **Settings → Pages → Source = "GitHub Actions"** (not "deploy from a branch").
  **Why:** the Actions source gives an explicit `deploy` job the E2E job can depend
  on, and drops the third-party `peaceiris` action in favor of the official
  `actions/upload-pages-artifact` + `actions/deploy-pages`.
- The mabl **environment URL** should point at the live Pages URL
  (`https://<owner>.github.io/<repo>/?demo=true`), **not** an `htmlpreview.github.io`
  proxy — the proxy is flaky with multi-file assets.

### 4.4 mabl objects
- Create (or reuse) a mabl **application** and **environment** mapped to the Pages URL.
- **Configure the custom test ID attribute** *(manual, UI):*
  Configuration → Applications → *your app* → **Advanced → Custom test ID attributes**
  → add `data-testid` (up to 3 attributes).
  **Why:** mabl then treats `data-testid` as the **primary** selector during agentic
  authoring and auto-heal — far more resilient than CSS/XPath.
  ⚠️ Existing tests don't pick this up until retrained; author fresh tests *after*
  configuring it so the agent uses it from the start.

### 4.5 Author the E2E test — agentic, via the mabl MCP
- Drive the **mabl authoring agent** (via the MCP from your AI client) with a clear
  prompt describing the flow. The agent pulls workspace context, builds an outline,
  then **runs the test as it builds to confirm each step passes**.
- Name tests per your convention (this team: `Agentic YYYY-MM-DD — <app> — <flow>`).
- Optionally set **scoped agent instructions** (Agents → Settings, scoped to the
  app/env) to encode recurring corrections and naming rules.

### 4.6 Configure the plan (the step most people miss)
A deployment event only runs a plan if **all** of these are true
*(mabl docs — Run mabl tests GitHub Action, "Deployment succeeded but no tests ran")*:
1. Plan filters (application, environment, **plan label — CASE-SENSITIVE**) match the event.
2. Plan is **active / toggled on**.
3. Plan has the **deployment trigger enabled** in the **Triggers** section of plan settings.
4. **≥1 test in the plan is enabled.**

What's automatable vs. manual:
- ✅ **Via mabl MCP:** create the plan, add the test, add the `ci` label, enable the plan.
- 👤 **Manual (UI):** toggle **"deployment trigger" ON** in the plan's Triggers section.
- ✅ **Verify before automating:** run a **preview** event and confirm your plan is listed:
  `POST https://api.mabl.com/events/deployment?preview=true` with `environment_id`,
  `application_id`, and `plan_labels:[{name:"ci"}]`. The `triggered_plan_run_summaries`
  array shows exactly which plans *would* run — if yours isn't there, one of the four
  conditions above is unmet.

### 4.7 GitHub ↔ mabl integration
- Mint a **"CI/CD integration"** API key in mabl (Settings → APIs). ⚠️ It **must** be
  that key type — Editor or Deployment-Trigger keys return **401**.
- Store it as the repo secret **`MABL_API_KEY`** (repo-level; names are case-sensitive).
- Install the **mabl bot GitHub app** (`github.com/apps/mabl-bot`) on the repo and, in
  mabl's GitHub integration settings, toggle **"Run GitHub checks on deployment"** (and
  optionally "Allow manually re-running GitHub checks").
  **Why:** this surfaces mabl results **as a check on the PR**, lets you require it
  before merge, and enables commit-hash traceability — the highest-value part of the
  demo for a developer audience.

### 4.8 Secrets checklist (repo → Settings → Secrets → Actions)
| Secret | Used by | Notes |
|---|---|---|
| `MABL_API_KEY` | e2e | **CI/CD integration** key type |
| `MABL_APPLICATION_ID` | e2e | ends in `-a` |
| `MABL_ENVIRONMENT_ID` | e2e | ends in `-e` |
| `JIRA_BASE_URL` / `JIRA_EMAIL` / `JIRA_API_TOKEN` / `JIRA_PROJECT_KEY` | report-failure | project key = your demo/target project |
| `SLACK_WEBHOOK_URL` | report-failure | incoming webhook |

*Alternative:* instead of the curl-to-Jira step, mabl's GitHub integration can
**auto-create GitHub Issues** from mabl insights — fewer secrets, native to GitHub.
Choose based on where your team triages.

---

## 5. Best-practice checklist (mapped to mabl docs)

- [x] Trigger via **deployment event** scoped by **plan label** (credit control)
- [x] Use the **official GitHub Action** (not raw curl) for the trigger
- [x] **mabl bot app** for PR checks + commit-hash traceability
- [x] **Deterministic seed data** for CI runs
- [x] **`data-testid`** hooks + **custom test ID attribute** configured in mabl
- [x] **Agentic authoring** via the mabl agent/MCP (self-verifies as it builds)
- [x] Unit-test gate **before** deploy (dev-QA layer)
- [x] Deployment trigger enabled on the plan + **preview** verified

---

## 6. Gotchas (learned / documented)

1. **Deployment trigger toggle is mandatory** and not settable via MCP — a plan without
   it silently runs zero tests. Verify with a `?preview=true` event.
2. **Plan-label matching is case-sensitive** (`ci` ≠ `CI`).
3. **API key must be "CI/CD integration" type** or the Action returns 401.
4. **Custom test IDs apply only to newly trained/retrained steps** — configure the
   attribute *before* authoring.
5. **Plan-level auto-retry hides in the Action status:** the Action reports the
   *initial* run result; if the retry passes, the PR check still shows failed. Check the
   plan run in mabl if you rely on retries.
6. **Pages propagation delay:** allow ~30–60s after deploy before the E2E hits the site
   (the official `deploy-pages` job gating the E2E job largely covers this).
7. **Private repo ⇒ no free Pages / no raw-proxy hosting.** Make the repo public or use
   a paid plan / external host.

---

## 7. Manual steps (human required — cannot be automated via MCP/API here)

1. Make the repo **public** (or Pro for private Pages).
2. **Settings → Pages → Source = GitHub Actions.**
3. Mabl **Custom test ID attribute** = `data-testid` on the app.
4. **Deployment trigger** toggle ON for the `ci` plan.
5. Install **mabl bot** GitHub app + enable GitHub checks in mabl.
6. Create the **CI/CD integration** API key + add all repo **secrets**.
7. (Optional) **Scoped agent instructions** in mabl.

---

## 8. References (help.mabl.com)

- CI/CD integrations — `17753017054228`
- Deployment events — `17780788992148`
- API-based CI/CD integration (fallback) — `19084154669332`
- Run mabl tests GitHub Action — `19084204154644`
- Run tests as a GitHub check — `19084193183252`
- GitHub integration (overview) — `17782623760660`
- Agentic test authoring for web apps — `38361400751380`
- mabl MCP overview — `47299375773844`
- Custom test ID attributes — `49010473192340`
