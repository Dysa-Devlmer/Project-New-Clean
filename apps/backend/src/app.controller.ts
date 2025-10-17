import { Controller, Get, Headers } from '@nestjs/common';
import { I18n, I18nContext } from 'nestjs-i18n';
import { AppService } from './app.service';

/**
 * Enterprise++++ Fortune 10 Global Military API Controller
 *
 * Main application controller with internationalization support
 * for global enterprise operations and compliance.
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(@I18n() i18n: I18nContext): string {
    return this.appService.getHello(i18n);
  }

  @Get('health')
  getHealth(@I18n() i18n: I18nContext) {
    return this.appService.getHealthStatus(i18n);
  }

  @Get('enterprise-status')
  getEnterpriseStatus(
    @I18n() i18n: I18nContext,
    @Headers('accept-language') acceptLanguage: string,
    @Headers('x-custom-lang') customLang: string,
  ) {
    return this.appService.getEnterpriseStatus(i18n, {
      acceptLanguage,
      customLang,
      locale: i18n.lang,
    });
  }
}
