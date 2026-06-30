# @easydocs/express

EasyDocs middleware for [Express](https://expressjs.com/).

## Install

```bash
npm install @easydocs/express
```

## Usage

```ts
import express from 'express'
import { easydocs } from '@easydocs/express'

const app = express()
app.use(express.json())
app.use(easydocs())

// Your routes — nothing changes here
app.get('/users', (req, res) => res.json({ users: [] }))

app.listen(3000)
```

The documentation dashboard runs at `http://localhost:4999` (start it with `npx @easydocs/dashboard` or run `apps/dashboard` in dev).

## Configuration

```ts
app.use(easydocs({
  ai: {
    provider: 'anthropic', // 'openai' | 'anthropic' | 'deepseek' | 'ollama'
    model: 'claude-3-5-sonnet-20241022',
  },
  storage: {
    url: 'file:/path/to/custom.sqlite',
  },
  capture: {
    ignoreRoutes: ['/health', '/metrics'],
  },
}))
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key (auto-detected) |
| `ANTHROPIC_API_KEY` | Anthropic API key (auto-detected) |
| `EASYDOCS_DB_URL` | SQLite path, e.g. `file:~/.easydocs/db.sqlite` |
