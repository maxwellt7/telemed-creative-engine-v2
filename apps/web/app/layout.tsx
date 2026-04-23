import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Telemed Creative Engine v2',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, background: '#f9fafb' }}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
