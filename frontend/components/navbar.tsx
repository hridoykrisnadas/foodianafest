'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Menu, X, Globe, Sun, Moon, Home, ClipboardList, Youtube, Facebook, Instagram, Linkedin } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';
import { useTheme } from '@/lib/theme-context';
import { cn } from '@/lib/utils';

const LOGO_URL = 'https://i.postimg.cc/bJLZQm0q/Foodiana-Logo-White-Stroke.png';

export default function Navbar() {
  const { t, lang, toggleLang } = useLanguage();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const links = [
    { href: '/', label: t.nav.home, icon: Home },
    { href: '/register', label: t.nav.register, icon: ClipboardList },
  ];

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-border/40">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <img
              src={LOGO_URL}
              alt="Foodiana 2026"
              className="h-10 w-auto object-contain group-hover:scale-105 transition-transform duration-300"
            />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => {
              const Icon = link.icon;
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    active
                      ? 'bg-primary/15 text-primary'
                      : 'text-foreground/70 hover:text-primary hover:bg-primary/5'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className={lang === 'bn' ? 'font-bengali' : ''}>{link.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Social Links (Desktop) */}
          <div className="hidden md:flex items-center gap-1">
            <a href="https://www.youtube.com/@foodianafest" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="p-2 rounded-lg text-foreground/70 hover:text-primary hover:bg-primary/5 border border-border/40 hover:border-primary/30 transition-all duration-200">
              <Youtube className="w-4 h-4" />
            </a>
            <a href="https://www.facebook.com/foodianafest/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="p-2 rounded-lg text-foreground/70 hover:text-primary hover:bg-primary/5 border border-border/40 hover:border-primary/30 transition-all duration-200">
              <Facebook className="w-4 h-4" />
            </a>
            <a href="https://www.instagram.com/foodianafest" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="p-2 rounded-lg text-foreground/70 hover:text-primary hover:bg-primary/5 border border-border/40 hover:border-primary/30 transition-all duration-200">
              <Instagram className="w-4 h-4" />
            </a>
            <a href="https://www.linkedin.com/company/foodianafest/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="p-2 rounded-lg text-foreground/70 hover:text-primary hover:bg-primary/5 border border-border/40 hover:border-primary/30 transition-all duration-200">
              <Linkedin className="w-4 h-4" />
            </a>
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            {mounted && (
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-foreground/70 hover:text-primary hover:bg-primary/5 border border-border/40 hover:border-primary/30 transition-all duration-200"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            )}

            {/* Language toggle */}
            <button
              onClick={toggleLang}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-foreground/80 hover:text-primary hover:bg-primary/5 border border-border/40 hover:border-primary/30 transition-all duration-200"
              aria-label="Toggle language"
            >
              <Globe className="w-4 h-4" />
              <span className={cn('font-medium', lang === 'bn' && 'font-bengali')}>
                {t.nav.language}
              </span>
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-foreground/80 hover:text-primary hover:bg-primary/5 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 animate-fade-in-up">
            <div className="flex flex-col gap-1">
              {links.map((link) => {
                const Icon = link.icon;
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all',
                      active
                        ? 'bg-primary/15 text-primary'
                        : 'text-foreground/70 hover:text-primary hover:bg-primary/5'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className={lang === 'bn' ? 'font-bengali' : ''}>{link.label}</span>
                  </Link>
                );
              })}
            </div>
            {/* Social Links (Mobile) */}
            <div className="flex items-center gap-2 mt-3 px-4">
              <a href="https://www.youtube.com/@foodianafest" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="p-2 rounded-lg text-foreground/70 hover:text-primary hover:bg-primary/5 border border-border/40 hover:border-primary/30 transition-all duration-200">
                <Youtube className="w-4 h-4" />
              </a>
              <a href="https://www.facebook.com/foodianafest/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="p-2 rounded-lg text-foreground/70 hover:text-primary hover:bg-primary/5 border border-border/40 hover:border-primary/30 transition-all duration-200">
                <Facebook className="w-4 h-4" />
              </a>
              <a href="https://www.instagram.com/foodianafest" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="p-2 rounded-lg text-foreground/70 hover:text-primary hover:bg-primary/5 border border-border/40 hover:border-primary/30 transition-all duration-200">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="https://www.linkedin.com/company/foodianafest/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="p-2 rounded-lg text-foreground/70 hover:text-primary hover:bg-primary/5 border border-border/40 hover:border-primary/30 transition-all duration-200">
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
