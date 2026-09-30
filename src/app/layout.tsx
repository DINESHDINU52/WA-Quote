import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'WA Quote — CHN TECHNOLOGIES PVT LTD',
  description: 'Quotations and Proforma Invoices for CHN TECHNOLOGIES.',
  robots: { index: false, follow: false },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png'
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'WA Quote'
  },
  other: {
    'mobile-web-app-capable': 'yes'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#1f8378" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Anton&family=Caveat:wght@500;600;700&family=Inter:wght@400;500;600;700&family=Kalam:wght@400;700&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{__html: `
          try {
            const savedTheme = localStorage.getItem('chn-theme') || 'blue';
            document.documentElement.setAttribute('data-theme', savedTheme);
          } catch (_) {}
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js');
            });
          }
        `}} />
      </head>
      <body className="min-h-screen font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
