# @easydocs/nestjs

EasyDocs module for [NestJS](https://nestjs.com/).

## Install

```bash
npm install @easydocs/nestjs
```

## Usage

```ts
import { Module } from '@nestjs/common'
import { EasyDocsModule } from '@easydocs/nestjs'

@Module({
  imports: [
    EasyDocsModule.forRoot({
      ai: { provider: 'anthropic' },
    }),
  ],
})
export class AppModule {}
```

That's it. A global interceptor is automatically registered. Every controller response is captured in the background.

## Per-controller or per-route

```ts
import { UseInterceptors } from '@nestjs/common'
import { EasyDocsInterceptor } from '@easydocs/nestjs'

// Skip the forRoot() import and use selectively:
@UseInterceptors(EasyDocsInterceptor)
@Controller('users')
export class UsersController {}
```

## Configuration

```ts
EasyDocsModule.forRoot({
  ai: {
    provider: 'openai', // 'openai' | 'anthropic' | 'ollama'
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  },
  capture: {
    ignoreRoutes: ['/health', '/api/metrics'],
  },
})
```

## View your docs

```bash
npm install -D @easydocs/dashboard
npx easydocs dashboard

# Or export to a file
npx easydocs export > openapi.json
```

See [@easydocs/core](../core) for the full configuration reference.
