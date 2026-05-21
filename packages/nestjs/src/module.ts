import { Module, DynamicModule } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { EasyDocsInterceptor, EASYDOCS_CAPTURER } from './interceptor'
import { parseConfig, createCapturer } from '@easydocs/core'
import type { EasyDocsConfig } from '@easydocs/core'

@Module({})
export class EasyDocsModule {
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
