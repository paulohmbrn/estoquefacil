import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegister } from './_components/sw-register';

export const metadata: Metadata = {
  title: 'Estoque Fácil — Reis Magos',
  description: 'Sistema multi-loja de contagem e controle de estoque para Famiglia Reis Magos / Madre Pane.',
  applicationName: 'Estoque Fácil',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Estoque Fácil',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Estoque Fácil',
    description: 'Contagem e controle de estoque das operações Reis Magos.',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#004125',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
