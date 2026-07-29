import type { Metadata } from 'next';
import { Fraunces, Outfit } from 'next/font/google';
import { BASE_PATH, withBasePath } from '@/lib/basePath';
import './globals.css';

const SITE_URL = 'https://dmitryshelomanov.github.io/iris';
const SITE_TITLE = 'Iris — Pro camera with film looks';
const SITE_DESCRIPTION =
  'Pro camera for iOS and Android — multi-lens switching, manual controls, film looks baked into every shot.';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: SITE_TITLE,
    template: '%s · Iris',
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
  },
  // Next metadata does not always prefix basePath — use explicit paths.
  icons: {
    icon: [{ url: `${BASE_PATH}/favicon.png`, type: 'image/png' }],
    apple: [{ url: `${BASE_PATH}/icon.png`, type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'Iris',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/og.png',
        width: 1024,
        height: 500,
        alt: 'Iris — Looks baked into every shot.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/og.png'],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Iris',
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  image: `${SITE_URL}/og.png`,
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'iOS, Android',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  codeRepository: 'https://github.com/dmitryshelomanov/iris',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${fraunces.variable}`}>
      <head>
        <link rel="icon" href={withBasePath('/favicon.png')} type="image/png" />
        <link rel="apple-touch-icon" href={withBasePath('/icon.png')} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
