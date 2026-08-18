import './globals.css';
import type { Metadata } from 'next';
import { Inter, Playfair_Display, Hind_Siliguri } from 'next/font/google';
import { ThemeProvider } from '@/lib/theme-context';
import { LanguageProvider } from '@/lib/language-context';
import Navbar from '@/components/navbar';
import Footer from '@/components/footer';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' });
const hindSiliguri = Hind_Siliguri({ subsets: ['bengali'], weight: ['300', '400', '500', '600', '700'], variable: '--font-bengali', display: 'swap' });

export const metadata: Metadata = {
  title: 'Foodiana 2026 — Khana Hobe, Gana Hobe, Mela Hobe, Khela Hobe',
  description: 'The Premier Food, Culture & Lifestyle Festival of Bangladesh. 5-7 November 2026, Dhaka.',
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
    <html lang="bn" suppressHydrationWarning className={`${inter.variable} ${playfair.variable} ${hindSiliguri.variable}`}>
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
