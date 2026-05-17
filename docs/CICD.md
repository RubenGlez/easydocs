# CI/CD

## What's active now

**GitHub Actions — CI** (`.github/workflows/ci.yml`)

Runs on every push and PR to `main`:
1. Install dependencies (`pnpm install --frozen-lockfile`)
2. Typecheck all packages
3. Build all packages
4. Run vitest integration tests

No secrets required. Free on GitHub for public repos.

---

## Future workflows to add

### npm publish (`publish.yml`)

Triggered by pushing a `v*` tag (e.g. `git tag v0.2.0 && git push --tags`).

```yaml
on:
  push:
    tags: ['v*']

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter './packages/*' build
      - run: pnpm publish -r --access public --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Required secret:** `NPM_TOKEN` — generate at npmjs.com → Access Tokens → Automation token.

**Consider adopting [Changesets](https://github.com/changesets/changesets)** once there are multiple independent release cycles across packages. It automates changelog generation and per-package version bumps via a GitHub bot PR.

---

### Evals (`evals.yml`)

Manual trigger only — evals call the real AI, cost tokens, and are non-deterministic.

```yaml
on:
  workflow_dispatch:

jobs:
  evals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter './packages/*' build
      - run: pnpm eval
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      - uses: actions/upload-artifact@v4
        with:
          name: eval-results
          path: evals/results.json
```

**Required secret:** `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`).

Run before releases to catch prompt regressions. Results are uploaded as a build artifact.

---

### Dashboard deploy

**Recommended: Vercel GitHub integration** (zero config, free Hobby tier)

1. Go to vercel.com → Add Project → import this repo
2. Set root directory to `apps/dashboard`
3. Vercel auto-detects Next.js and deploys on every push to `main`
4. PR previews are created automatically

**Alternative: explicit workflow** — use `vercel` CLI action if you need deploy inside the same pipeline or want to gate on CI passing first:

```yaml
on:
  push:
    branches: [main]

jobs:
  deploy:
    needs: ci  # wait for CI to pass
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: apps/dashboard
          vercel-args: '--prod'
```

**Required secrets:** `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` — all found in Vercel project settings.

---

## Secrets reference

| Secret | Used by | How to get it |
|--------|---------|---------------|
| `NPM_TOKEN` | publish.yml | npmjs.com → Access Tokens → Automation |
| `OPENAI_API_KEY` | evals.yml | platform.openai.com → API keys |
| `ANTHROPIC_API_KEY` | evals.yml | console.anthropic.com → API keys |
| `VERCEL_TOKEN` | deploy workflow | vercel.com → Account Settings → Tokens |
| `VERCEL_ORG_ID` | deploy workflow | Vercel project settings |
| `VERCEL_PROJECT_ID` | deploy workflow | Vercel project settings |

Add secrets at: GitHub repo → Settings → Secrets and variables → Actions.
