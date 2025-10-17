import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { I18nModule, AcceptLanguageResolver, HeaderResolver, QueryResolver } from 'nestjs-i18n';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // Enterprise Configuration Management
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.development', '.env'],
    }),

    // Enterprise++++ Fortune 10 Global Military Internationalization
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: join(__dirname, '/i18n/'),
        watch: true,
      },
      resolvers: [
        // Enterprise-grade locale detection strategy
        { use: QueryResolver, options: ['lang', 'locale', 'l'] }, // Query parameters
        { use: HeaderResolver, options: ['x-custom-lang'] }, // Custom header
        AcceptLanguageResolver, // Accept-Language header (standard)
      ],
      // Enterprise audit logging
      logging: true,
      // Global validation pipe integration
      disableMiddleware: false,
      // Type safety for translations
      typesOutputPath: join(process.cwd(), 'src/generated/i18n.generated.ts'),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
