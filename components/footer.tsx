'use client';

import { Mail, Phone, MapPin, LayoutDashboard, QrCode, Youtube, Facebook, Instagram, Linkedin } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/lib/language-context';

const LOGO_URL = 'https://i.postimg.cc/bJLZQm0q/Foodiana-Logo-White-Stroke.png';

export default function Footer() {
  const { t, lang } = useLanguage();

  return (
    <footer className="relative mt-20 border-t border-border/40 bg-secondary/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src={LOGO_URL} alt="Foodiana 2026" className="h-10 w-auto object-contain" />
            </div>
            <p className={`text-sm text-foreground/60 leading-relaxed ${lang === 'bn' ? 'font-bengali' : ''}`}>
              {t.footer.about}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className={`font-semibold text-primary mb-4 ${lang === 'bn' ? 'font-bengali' : ''}`}>
              {t.footer.quickLinks}
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className={`text-sm text-foreground/60 hover:text-primary transition-colors ${lang === 'bn' ? 'font-bengali' : ''}`}>
                  {t.nav.home}
                </Link>
              </li>
              <li>
                <Link href="/register" className={`text-sm text-foreground/60 hover:text-primary transition-colors ${lang === 'bn' ? 'font-bengali' : ''}`}>
                  {t.nav.register}
                </Link>
              </li>
              <li>
                <Link href="/admin" className="flex items-center gap-1.5 text-sm text-foreground/60 hover:text-primary transition-colors">
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span className={lang === 'bn' ? 'font-bengali' : ''}>{t.footer.adminPanel}</span>
                </Link>
              </li>
              <li>
                <Link href="/admin/scan" className="flex items-center gap-1.5 text-sm text-foreground/60 hover:text-primary transition-colors">
                  <QrCode className="w-3.5 h-3.5" />
                  <span className={lang === 'bn' ? 'font-bengali' : ''}>{t.footer.qrScanner}</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className={`font-semibold text-primary mb-4 ${lang === 'bn' ? 'font-bengali' : ''}`}>
              {t.footer.contact}
            </h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-sm text-foreground/60">
                <Phone className="w-4 h-4 text-primary/60" />
                {t.footer.phone}
              </li>
              <li className="flex items-center gap-2 text-sm text-foreground/60">
                <Mail className="w-4 h-4 text-primary/60" />
                {t.footer.email}
              </li>
              <li className="flex items-center gap-2 text-sm text-foreground/60">
                <MapPin className="w-4 h-4 text-primary/60" />
                {t.footer.address}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border/30 flex flex-col items-center gap-4">
          {/* Social Links */}
          <div className="flex items-center gap-3">
            <a href="https://www.youtube.com/@foodianafest" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="p-2.5 rounded-lg text-foreground/70 hover:text-primary hover:bg-primary/5 border border-border/40 hover:border-primary/30 transition-all duration-200">
              <Youtube className="w-4 h-4" />
            </a>
            <a href="https://www.facebook.com/foodianafest/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="p-2.5 rounded-lg text-foreground/70 hover:text-primary hover:bg-primary/5 border border-border/40 hover:border-primary/30 transition-all duration-200">
              <Facebook className="w-4 h-4" />
            </a>
            <a href="https://www.instagram.com/foodianafest" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="p-2.5 rounded-lg text-foreground/70 hover:text-primary hover:bg-primary/5 border border-border/40 hover:border-primary/30 transition-all duration-200">
              <Instagram className="w-4 h-4" />
            </a>
            <a href="https://www.linkedin.com/company/foodianafest/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="p-2.5 rounded-lg text-foreground/70 hover:text-primary hover:bg-primary/5 border border-border/40 hover:border-primary/30 transition-all duration-200">
              <Linkedin className="w-4 h-4" />
            </a>
          </div>
          <p className={`text-center text-sm text-foreground/40 ${lang === 'bn' ? 'font-bengali' : ''}`}>
            {t.footer.rights}
          </p>
        </div>
      </div>
    </footer>
  );
}
