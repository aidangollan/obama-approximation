import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Obama Approximator',
  description: 'Obamna',
  icons: {
    icon: '/obama.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

