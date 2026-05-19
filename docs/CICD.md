# CI/CD

## CI — `.github/workflows/ci.yml`

Runs on every push and PR to `main` on Node 24:

1. `pnpm install --frozen-lockfile`
2. Build all packages
3. Lint all packages
4. Typecheck all packages
5. Run tests

No secrets required.

## CD — `.github/workflows/publish.yml`

Triggered by pushing a `v*` tag. Use the release script — it bumps versions, commits, tags, and pushes:

```sh
pnpm release           # patch bump
pnpm release:minor     # minor bump
pnpm release:major     # major bump
```

Runs the same checks as CI first (build → lint → typecheck → test), then publishes all packages to npm.

**Required secret:** `NPM_TOKEN`
- Generate at npmjs.com → Access Tokens → Automation token
- Add at: GitHub repo → Settings → Secrets and variables → Actions

---

## Future additions

### Evals workflow

Manual trigger (`workflow_dispatch`) — evals call the real AI so they should never run automatically.

```yaml
on:
  workflow_dispatch:

jobs:
  evals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v5
        with:
          version: 11
      - uses: actions/setup-node@v5
        with:
          node-version: 24
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

### Dashboard deploy

Vercel GitHub integration (free Hobby tier) is the simplest option — import the repo, set root directory to `apps/dashboard`. Requires a Postgres database (Neon/Supabase free tier) since Vercel has no persistent filesystem for SQLite.

### Changesets

Once packages have independent release cycles, adopt [Changesets](https://github.com/changesets/changesets) for automated changelog generation and per-package version bumps. For now, the custom release script (`scripts/release.mjs`) handles synchronized version bumps across all packages.
