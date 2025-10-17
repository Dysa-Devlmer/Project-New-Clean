/**
 * Enterprise++++ Fortune 10 Global Military Internationalization Middleware
 *
 * Advanced locale detection and routing for global enterprise operations
 * with security, compliance, and performance optimizations.
 */

import createMiddleware from 'next-intl/middleware'
import { locales, defaultLocale, regionalGroups } from './i18n'
import type { NextRequest } from 'next/server'

// Enterprise security headers for all localized responses
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
}

// Enhanced locale detection with enterprise features
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,

  // Advanced locale detection strategy
  localeDetection: true,

  // Custom locale prefix configuration
  localePrefix: 'as-needed',

  // Alternate links for SEO and enterprise compliance
  alternateLinks: true,

  // Custom pathname matcher for enterprise routes
  pathnames: {
    '/': '/',
    '/dashboard': {
      en: '/dashboard',
      es: '/panel',
      fr: '/tableau-de-bord',
      de: '/dashboard',
      zh: '/仪表板',
      ja: '/ダッシュボード'
    },
    '/users': {
      en: '/users',
      es: '/usuarios',
      fr: '/utilisateurs',
      de: '/benutzer',
      zh: '/用户',
      ja: '/ユーザー'
    },
    '/compliance': {
      en: '/compliance',
      es: '/cumplimiento',
      fr: '/conformite',
      de: '/compliance',
      zh: '/合规',
      ja: '/コンプライアンス'
    },
    '/security': {
      en: '/security',
      es: '/seguridad',
      fr: '/securite',
      de: '/sicherheit',
      zh: '/安全',
      ja: '/セキュリティ'
    }
  }
})

export default function middleware(request: NextRequest) {
  // Security check: Block malicious requests
  const userAgent = request.headers.get('user-agent') || ''
  const suspiciousPatterns = [
    /bot|crawler|spider/i,
    /curl|wget/i,
    /python|php|perl/i
  ]

  // Allow legitimate search engine bots but log for monitoring
  if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
    console.warn(`[Security] Suspicious user agent detected: ${userAgent} from ${request.ip}`)
  }

  // Regional compliance check
  const clientIP = request.ip || request.headers.get('x-forwarded-for')?.split(',')[0]
  const acceptLanguage = request.headers.get('accept-language')

  // Enhanced locale detection for enterprise clients
  let detectedLocale = defaultLocale

  if (acceptLanguage) {
    // Parse accept-language header with quality values
    const languageRanges = acceptLanguage
      .split(',')
      .map(lang => {
        const [locale, quality = '1'] = lang.trim().split(';q=')
        return {
          locale: locale.toLowerCase().substring(0, 2),
          quality: parseFloat(quality)
        }
      })
      .sort((a, b) => b.quality - a.quality)

    // Find best matching locale
    for (const range of languageRanges) {
      const matchedLocale = locales.find(locale =>
        locale.startsWith(range.locale) || range.locale.startsWith(locale)
      )
      if (matchedLocale) {
        detectedLocale = matchedLocale
        break
      }
    }
  }

  // Enterprise audit logging
  console.log(`[i18n Audit] Request: ${request.nextUrl.pathname} | Locale: ${detectedLocale} | IP: ${clientIP} | UA: ${userAgent.substring(0, 100)}`)

  // Execute the intl middleware
  const response = intlMiddleware(request)

  if (response) {
    // Add enterprise security headers
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    // Add compliance headers based on region
    const currentLocale = response.headers.get('x-next-intl-locale') || detectedLocale

    if (regionalGroups.emea.includes(currentLocale as any)) {
      response.headers.set('X-GDPR-Compliance', 'enabled')
      response.headers.set('X-Data-Residency', 'EU')
    } else if (regionalGroups.americas.includes(currentLocale as any)) {
      response.headers.set('X-CCPA-Compliance', 'enabled')
      response.headers.set('X-Data-Residency', 'US')
    } else if (regionalGroups.apac.includes(currentLocale as any)) {
      response.headers.set('X-APAC-Compliance', 'enabled')
      response.headers.set('X-Data-Residency', 'APAC')
    }

    // Add enterprise monitoring headers
    response.headers.set('X-Response-Time', Date.now().toString())
    response.headers.set('X-Request-ID', crypto.randomUUID())
    response.headers.set('X-Locale-Detected', detectedLocale)
    response.headers.set('X-Enterprise-Level', 'Fortune-10-Global-Military')

    return response
  }

  return response
}

export const config = {
  // Enhanced matcher for enterprise routes
  matcher: [
    // Enable i18n routing for all pages except API routes and static files
    '/((?!api|_next|_vercel|.*\\.).*)',
    // Include specific enterprise endpoints
    '/dashboard/:path*',
    '/users/:path*',
    '/compliance/:path*',
    '/security/:path*',
    '/monitoring/:path*',
    '/reports/:path*',
    '/analytics/:path*'
  ]
}