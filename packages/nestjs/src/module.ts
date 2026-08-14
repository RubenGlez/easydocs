import { Module, DynamicModule, Inject, OnApplicationShutdown } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { EasyDocsInterceptor, EASYDOCS_CAPTURER } from './interceptor'
import { parseConfig, createCapturer } from '@easydocs/core'
import type { EasyDocsConfig, Capturer } from '@easydocs/core'

@Module({})
export class EasyDocsModule implements OnApplicationShutdown {
  constructor(@Inject(EASYDOCS_CAPTURER) private readonly capturer: Capturer) {}

  /**
   * Drain queued spec generation on shutdown. Requires
   * `app.enableShutdownHooks()`; without it Nest never calls this and pending
   * specs are lost on deploy, same as before.
   */
  async onApplicationShutdown(): Promise<void> {
    await this.capturer.flush()
  }

  static forRoot(config: EasyDocsConfig = {}): DynamicModule {
    const capturer = createCapturer(parseConfig(config))
    return {
      module: EasyDocsModule,
      global: true,
      providers: [
        {
          provide: EASYDOCS_CAPTURER,
          useValue: capturer,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: EasyDocsInterceptor,
        },
      ],
    }
  }
}
