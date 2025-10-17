/**
 * Enterprise++++ Fortune 10 Global Military Root Layout
 *
 * Global layout with internationalization support for enterprise operations
 */

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Enterprise++++ Fortune 10 Global Military Admin Panel',
  description: 'Advanced enterprise administration panel with global military-grade security and compliance',
  keywords: 'enterprise, admin, panel, security, compliance, global, military-grade',
  authors: [{ name: 'Enterprise Security Team' }],
  robots: 'noindex, nofollow', // Enterprise security: no indexing
  viewport: 'width=device-width, initial-scale=1, shrink-to-fit=no',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Enterprise Security Headers */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-Frame-Options" content="DENY" />
        <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />

        {/* Enterprise Compliance Meta Tags */}
        <meta name="enterprise-level" content="Fortune-10-Global-Military" />
        <meta name="security-classification" content="enterprise-confidential" />
        <meta name="compliance-frameworks" content="SOC2,ISO27001,NIST,GDPR,HIPAA" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}