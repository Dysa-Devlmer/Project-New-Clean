/**
 * Enterprise++++ Fortune 10 Global Military Internationalization Configuration
 *
 * Comprehensive multi-regional support for global enterprise operations
 * with advanced locale detection, timezone handling, and compliance features.
 */

import { getRequestConfig } from 'next-intl/server'
import { notFound } from 'next/navigation'

// Enterprise locales supporting Fortune 10 Global Military operations
export const locales = [
  'en',    // English (Primary - Global)
  'es',    // Spanish (LATAM, Spain)
  'fr',    // French (France, Canada)
  'de',    // German (Germany, Austria, Switzerland)
  'zh',    // Chinese Simplified (China)
  'zh-TW', // Chinese Traditional (Taiwan, Hong Kong)
  'ja',    // Japanese (Japan)
  'ko',    // Korean (South Korea)
  'pt',    // Portuguese (Brazil)
  'ru',    // Russian (Russia, Eastern Europe)
  'ar',    // Arabic (Middle East, North Africa)
  'hi',    // Hindi (India)
  'it',    // Italian (Italy)
  'nl',    // Dutch (Netherlands, Belgium)
  'sv',    // Swedish (Sweden, Finland)
  'no',    // Norwegian (Norway)
  'da',    // Danish (Denmark)
  'pl',    // Polish (Poland)
  'cs',    // Czech (Czech Republic)
  'hu',    // Hungarian (Hungary)
  'th',    // Thai (Thailand)
  'vi',    // Vietnamese (Vietnam)
  'id',    // Indonesian (Indonesia)
  'ms',    // Malay (Malaysia, Singapore)
  'tl'     // Filipino (Philippines)
] as const

export type Locale = typeof locales[number]

export const defaultLocale: Locale = 'en'

// Regional groupings for compliance and business logic
export const regionalGroups = {
  americas: ['en', 'es', 'pt', 'fr'],
  emea: ['en', 'fr', 'de', 'it', 'nl', 'sv', 'no', 'da', 'pl', 'cs', 'hu', 'ar', 'ru'],
  apac: ['en', 'zh', 'zh-TW', 'ja', 'ko', 'hi', 'th', 'vi', 'id', 'ms', 'tl'],
} as const

// Currency mapping for enterprise financial operations
export const currencyMapping: Record<Locale, string> = {
  'en': 'USD',
  'es': 'EUR',
  'fr': 'EUR',
  'de': 'EUR',
  'zh': 'CNY',
  'zh-TW': 'TWD',
  'ja': 'JPY',
  'ko': 'KRW',
  'pt': 'BRL',
  'ru': 'RUB',
  'ar': 'USD',
  'hi': 'INR',
  'it': 'EUR',
  'nl': 'EUR',
  'sv': 'SEK',
  'no': 'NOK',
  'da': 'DKK',
  'pl': 'PLN',
  'cs': 'CZK',
  'hu': 'HUF',
  'th': 'THB',
  'vi': 'VND',
  'id': 'IDR',
  'ms': 'MYR',
  'tl': 'PHP'
} as const

// Timezone mapping for enterprise scheduling
export const timezoneMapping: Record<Locale, string> = {
  'en': 'America/New_York',
  'es': 'Europe/Madrid',
  'fr': 'Europe/Paris',
  'de': 'Europe/Berlin',
  'zh': 'Asia/Shanghai',
  'zh-TW': 'Asia/Taipei',
  'ja': 'Asia/Tokyo',
  'ko': 'Asia/Seoul',
  'pt': 'America/Sao_Paulo',
  'ru': 'Europe/Moscow',
  'ar': 'Asia/Dubai',
  'hi': 'Asia/Kolkata',
  'it': 'Europe/Rome',
  'nl': 'Europe/Amsterdam',
  'sv': 'Europe/Stockholm',
  'no': 'Europe/Oslo',
  'da': 'Europe/Copenhagen',
  'pl': 'Europe/Warsaw',
  'cs': 'Europe/Prague',
  'hu': 'Europe/Budapest',
  'th': 'Asia/Bangkok',
  'vi': 'Asia/Ho_Chi_Minh',
  'id': 'Asia/Jakarta',
  'ms': 'Asia/Kuala_Lumpur',
  'tl': 'Asia/Manila'
} as const

export default getRequestConfig(async ({ locale }) => {
  // Validate locale exists in our supported list
  if (!locales.includes(locale as Locale)) {
    notFound()
  }

  try {
    const messages = (await import(`../locales/${locale}.json`)).default

    return {
      messages,
      timeZone: timezoneMapping[locale as Locale],
      now: new Date(),
      // Enterprise-grade number and date formatting
      formats: {
        dateTime: {
          short: {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          },
          medium: {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric'
          },
          long: {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            timeZoneName: 'short'
          }
        },
        number: {
          currency: {
            style: 'currency',
            currency: currencyMapping[locale as Locale]
          },
          percentage: {
            style: 'percent',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }
        }
      }
    }
  } catch (error) {
    // Fallback to English if locale file is missing
    console.error(`Failed to load locale ${locale}, falling back to English:`, error)
    const messages = (await import(`../locales/en.json`)).default
    return {
      messages,
      timeZone: timezoneMapping.en,
      now: new Date()
    }
  }
})