import './globals.css';
import type { Metadata } from 'next';
import { Montserrat, Hind_Siliguri } from 'next/font/google';
import { ThemeProvider } from '@/lib/theme-context';
import { LanguageProvider } from '@/lib/language-context';
import Navbar from '@/components/navbar';
import Footer from '@/components/footer';

const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-Montserrat', display: 'swap' });
const hindSiliguri = Hind_Siliguri({ subsets: ['bengali'], weight: ['300', '400', '500', '600', '700'], variable: '--font-bengali', display: 'swap' });

const HERO_IMAGE = 'https://i.postimg.cc/W1P7R9XG/513099929-24076391128716699-8581022198636302790-n.jpg';

export const metadata: Metadata = {
  title: 'Foodiana 2026 — Khana Hobe, Gana Hobe, Mela Hobe, Khela Hobe',
  description: 'The Premier Food, Culture & Lifestyle Festival of Bangladesh. 5-7 November 2026, Dhaka.',
  openGraph: {
    url: 'https://www.foodianafest.com',
    siteName: 'Foodiana 2026',
    description: 'The Premier Food, Culture & Lifestyle Festival of Bangladesh. 5-7 November 2026, Dhaka.',
    title: 'Foodiana 2026 — Khana Hobe, Gana Hobe, Mela Hobe, Khela Hobe',
    type: 'website',
    images: [
      {
        url: HERO_IMAGE,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Foodiana 2026 — Khana Hobe, Gana Hobe, Mela Hobe, Khela Hobe',
    description: 'The Premier Food, Culture & Lifestyle Festival of Bangladesh. 5-7 November 2026, Dhaka.',
    images: [HERO_IMAGE],
  },
};

const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('foodiana-theme');
    if (t === 'dark') document.documentElement.classList.add('dark');
  } catch(e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" suppressHydrationWarning className={`${montserrat.variable} ${hindSiliguri.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background text-foreground">
        <ThemeProvider>
          <LanguageProvider>
            <Navbar />
            <main className="pt-16 min-h-screen">{children}</main>
            <Footer />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
