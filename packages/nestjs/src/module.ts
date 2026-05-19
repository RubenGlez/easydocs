import { Module, DynamicModule } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { EasyDocsInterceptor, EASYDOCS_CONFIG } from './interceptor'
import { parseConfig } from '@easydocs/core'
import type { EasyDocsConfig } from '@easydocs/core'

@Module({})
export class EasyDocsModule {
  static forRoot(config: EasyDocsConfig = {}): DynamicModule {
    const parsedConfig = parseConfig(config)
    return {
      module: EasyDocsModule,
      global: true,
      providers: [
        {
          provide: EASYDOCS_CONFIG,
          useValue: parsedConfig,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: EasyDocsInterceptor,
        },
      ],
    }
  }
}
