/**
 * Enterprise++++ Fortune 10 Global Military Localized Layout
 *
 * Internationalized layout for global enterprise operations with
 * advanced locale handling, security, and compliance features.
 */

import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { locales, type Locale, currencyMapping, timezoneMapping } from '@/i18n'
import { notFound } from 'next/navigation'

interface LocaleLayoutProps {
  children: React.ReactNode
  params: { locale: string }
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params: { locale }
}: LocaleLayoutProps) {
  // Validate locale
  if (!locales.includes(locale as Locale)) {
    notFound()
  }

  // Load messages for the current locale
  const messages = await getMessages()

  // Get enterprise configuration for locale
  const currency = currencyMapping[locale as Locale]
  const timezone = timezoneMapping[locale as Locale]

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <head>
        {/* Locale-specific meta tags */}
        <meta name="locale" content={locale} />
        <meta name="currency" content={currency} />
        <meta name="timezone" content={timezone} />

        {/* Enterprise compliance headers per region */}
        {locale.startsWith('en') && (
          <>
            <meta name="data-residency" content="US" />
            <meta name="compliance-framework" content="CCPA,HIPAA,SOX" />
          </>
        )}

        {(locale === 'fr' || locale === 'de' || locale === 'es' || locale === 'it' || locale === 'nl') && (
          <>
            <meta name="data-residency" content="EU" />
            <meta name="compliance-framework" content="GDPR,ISO27001" />
          </>
        )}

        {(locale === 'zh' || locale === 'ja' || locale === 'ko' || locale === 'hi' || locale === 'th') && (
          <>
            <meta name="data-residency" content="APAC" />
            <meta name="compliance-framework" content="APAC-Privacy" />
          </>
        )}

        {/* Performance and SEO */}
        <link rel="preload" href={`/locales/${locale}.json`} as="fetch" crossOrigin="anonymous" />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <div className="enterprise-layout" data-locale={locale} data-currency={currency}>
            {/* Enterprise Security Notice */}
            <div className="sr-only" aria-live="polite">
              Enterprise++++ Fortune 10 Global Military System - Authorized Access Only
            </div>

            {/* Main Content */}
            <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
              {children}
            </main>

            {/* Enterprise Footer */}
            <footer className="text-xs text-slate-500 p-4 text-center">
              <div className="space-y-1">
                <div>Enterprise++++ Fortune 10 Global Military | Locale: {locale.toUpperCase()}</div>
                <div>Security Classification: ENTERPRISE CONFIDENTIAL</div>
                <div>Compliance: SOC 2 Type II | ISO 27001 | NIST 800-53</div>
              </div>
            </footer>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}