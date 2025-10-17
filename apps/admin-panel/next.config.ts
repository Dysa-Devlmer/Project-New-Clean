import path from 'path'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/index.ts')

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  // Enterprise++++ Fortune 10 Global Military Internationalization
  experimental: {
    typedRoutes: true,
  },

  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  rewrites: async () => {
    // Si no hay NEXT_PUBLIC_API_URL, destino será '/api/:path*'
    const apiBase = process.env.NEXT_PUBLIC_API_URL
      ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')
      : ''

    return [
      {
        source: '/api/:path*',
        destination: apiBase
          ? `${apiBase}/api/:path*`
          : '/api/:path*',
      },
    ]
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, 'src'),
    }
    return config
  },
}

export default withNextIntl(nextConfig)