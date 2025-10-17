import { GetServerSideProps } from 'next'
import Head from 'next/head'

interface HomeProps {
  timestamp: string
}

export default function Home({ timestamp }: HomeProps) {
  return (
    <>
      <Head>
        <title>Admin Panel - Project New Clean</title>
        <meta name="description" content="Military-grade admin panel for Project New Clean" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center text-white">
            <h1 className="text-5xl font-bold mb-8">
              🔐 Admin Panel
            </h1>
            <p className="text-xl mb-6 text-blue-200">
              Military-Grade Security Architecture
            </p>
            <div className="bg-black/20 backdrop-blur-sm border border-blue-500/30 rounded-lg p-8 max-w-2xl mx-auto">
              <h2 className="text-2xl font-semibold mb-4">Security Features Active</h2>
              <ul className="text-left space-y-2 text-blue-100">
                <li>✅ GPG-signed commits enforced</li>
                <li>✅ Multi-layer SAST/DAST scanning</li>
                <li>✅ SBOM generation & supply chain security</li>
                <li>✅ Pre-commit security gates</li>
                <li>✅ End-to-end testing framework</li>
                <li>✅ Container security & image signing</li>
              </ul>
            </div>
            <p className="mt-8 text-sm text-blue-300">
              Generated at: {timestamp}
            </p>
          </div>
        </div>
      </main>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {
      timestamp: new Date().toISOString(),
    },
  }
}