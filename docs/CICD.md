# CI/CD

## CI — `.github/workflows/ci.yml`

Runs on every push and PR to `main` across Node 18, 20, and 22:

1. `pnpm install --frozen-lockfile`
2. Typecheck all packages
3. Build all packages
4. Run vitest integration tests

No secrets required.

## CD — `.github/workflows/publish.yml`

Triggered by pushing a `v*` tag:

```sh
git tag v0.2.0
git push --tags
```

Runs the same checks as CI first (typecheck → build → test), then publishes all packages to npm.

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

### Dashboard deploy

Vercel GitHub integration (free Hobby tier) is the simplest option — import the repo, set root directory to `apps/dashboard`. Requires a Postgres database (Neon/Supabase free tier) since Vercel has no persistent filesystem for SQLite.

### Changesets

Once packages have independent release cycles, adopt [Changesets](https://github.com/changesets/changesets) for automated changelog generation and per-package version bumps. For now, manual `git tag` is simpler.
