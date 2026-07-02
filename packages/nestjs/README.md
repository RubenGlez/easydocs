# @easydocs/nestjs

EasyDocs module for [NestJS](https://nestjs.com/). Generate accurate OpenAPI 3.0 specs from your API's real traffic — local-first and self-hostable, with an offline mode (Ollama) where nothing leaves your machine.

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

`EasyDocsInterceptor` requires the `EASYDOCS_CAPTURER` DI token to be provided. The easiest way is to still import `EasyDocsModule.forRoot()` globally (which registers the token), then apply the interceptor manually on specific controllers instead of relying on the global one.

If you want full control without `forRoot()`, provide the token yourself:

```ts
import { Module } from '@nestjs/common'
import { UseInterceptors, Controller } from '@nestjs/common'
import { EasyDocsInterceptor, EASYDOCS_CAPTURER } from '@easydocs/nestjs'
import { createCapturer, parseConfig } from '@easydocs/core'

@Module({
  providers: [
    {
      provide: EASYDOCS_CAPTURER,
      useValue: createCapturer(parseConfig({ project: 'my-api' })),
    },
  ],
})
export class UsersModule {}

@UseInterceptors(EasyDocsInterceptor)
@Controller('users')
export class UsersController {}
```

## Configuration

```ts
EasyDocsModule.forRoot({
  ai: {
    provider: 'openai', // 'openai' | 'anthropic' | 'deepseek' | 'ollama'
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
