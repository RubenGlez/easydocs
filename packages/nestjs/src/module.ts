import { Module, DynamicModule, APP_INTERCEPTOR } from '@nestjs/common'
import { EasyDocsInterceptor, EASYDOCS_CONFIG } from './interceptor'
import type { EasyDocsConfig } from '@easydocs/core'

@Module({})
export class EasyDocsModule {
  static forRoot(config: EasyDocsConfig = {}): DynamicModule {
    return {
      module: EasyDocsModule,
      global: true,
      providers: [
        {
          provide: EASYDOCS_CONFIG,
          useValue: config,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: EasyDocsInterceptor,
        },
      ],
    }
  }
}
