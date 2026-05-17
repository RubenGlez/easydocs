# @easydocs/cli

Zero-install proxy and spec export for [EasyDocs](https://github.com/RubenGlez/easydocs).

## Proxy mode — zero code changes

Route your requests through the EasyDocs proxy and it captures traffic automatically. No middleware to install, no code to change.

```bash
npx @easydocs/cli proxy --project=my-api --port=3999
```

Then send requests through the proxy:

```
http://localhost:3999?target=https://api.example.com/users
```

Every request is captured and an OpenAPI spec is generated in the background.

## Dashboard

```bash
npx @easydocs/cli dashboard
# requires @easydocs/dashboard to be installed
npm install -D @easydocs/dashboard
```

## Export spec

```bash
# JSON (default)
npx @easydocs/cli export

# YAML
npx @easydocs/cli export --yaml

# Scoped to a project
npx @easydocs/cli export --project=my-api

# Pipe to a file
npx @easydocs/cli export > openapi.json
```

## Flags

| Flag | Command | Default | Description |
|------|---------|---------|-------------|
| `--port=<n>` | proxy | `3999` | Port for the proxy server |
| `--port=<n>` | dashboard | `4999` | Port for the dashboard |
| `--project=<slug>` | proxy, export | `default` | Scope to a project |
| `--yaml` | export | — | Output YAML instead of JSON |
| `--prod` | dashboard | — | Run `next start` instead of `next dev` |

## Environment variables

| Variable | Description |
|----------|-------------|
| `EASYDOCS_DB_URL` | Database URL (default: `~/.easydocs/db.sqlite`) |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `EASYDOCS_DASHBOARD_PATH` | Path to a custom dashboard directory |
