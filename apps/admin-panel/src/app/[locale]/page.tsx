/**
 * Enterprise++++ Fortune 10 Global Military Dashboard Page
 *
 * Internationalized main dashboard with enterprise-grade features
 */

import { useTranslations } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { Locale } from '@/i18n'

interface DashboardPageProps {
  params: { locale: Locale }
}

export default function DashboardPage({ params: { locale } }: DashboardPageProps) {
  const t = useTranslations()

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Enterprise Header */}
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          {t('dashboard.title')}
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          {t('dashboard.overview')} - {locale.toUpperCase()}
        </p>
      </header>

      {/* Enterprise Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* System Status */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-lg border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
            {t('dashboard.system_status')}
          </h3>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-slate-600 dark:text-slate-400">Operational</span>
          </div>
        </div>

        {/* Performance */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-lg border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
            {t('dashboard.performance')}
          </h3>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">99.99%</div>
          <p className="text-sm text-slate-600 dark:text-slate-400">{t('monitoring.uptime')}</p>
        </div>

        {/* Security Alerts */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-lg border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
            {t('dashboard.security_alerts')}
          </h3>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">0</div>
          <p className="text-sm text-slate-600 dark:text-slate-400">Active Threats</p>
        </div>

        {/* Compliance Status */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-lg border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
            {t('dashboard.compliance_status')}
          </h3>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">100%</div>
          <p className="text-sm text-slate-600 dark:text-slate-400">{t('compliance.compliant')}</p>
        </div>
      </div>

      {/* Enterprise Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Users Management */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-lg border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-shadow">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
            {t('navigation.users')}
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            {t('users.title')}
          </p>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
            {t('common.view')}
          </button>
        </div>

        {/* Security Center */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-lg border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-shadow">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
            {t('navigation.security')}
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            {t('security.title')}
          </p>
          <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors">
            {t('common.view')}
          </button>
        </div>

        {/* Compliance */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-lg border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-shadow">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
            {t('navigation.compliance')}
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            {t('compliance.title')}
          </p>
          <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors">
            {t('common.view')}
          </button>
        </div>
      </div>

      {/* Enterprise Status Bar */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Enterprise++++ Fortune 10 Global Military</h3>
            <p className="text-sm opacity-90">
              {t('enterprise.global_deployment')} | Locale: {locale} | {new Date().toLocaleString(locale)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm opacity-90">Security Level</div>
            <div className="font-bold">MAXIMUM</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Generate metadata for each locale
export async function generateMetadata({ params: { locale } }: DashboardPageProps) {
  const t = await getTranslations({ locale, namespace: 'dashboard' })

  return {
    title: `${t('title')} - Enterprise++++ Fortune 10 Global Military`,
    description: t('overview'),
  }
}