'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/language-context';
import { supabase } from '@/lib/supabase';
import { useState, useEffect, useRef } from 'react';
import FoodCarousel from '@/components/food-carousel';
import {
  ArrowRight, Star, Leaf, Calendar, Clock, MapPin, Users, Store, Music,
  ChevronLeft, ChevronRight, Plus, Minus, Award, UtensilsCrossed, Baby,
  Camera, Gamepad2, HeartPulse, PawPrint, Recycle, Droplets, CupSoda,
  Trash2, Sparkles, GraduationCap, Briefcase, ChefHat, Building2,
  Soup, Pizza, Sandwich, Salad, Globe2, Wheat, Flame,
} from 'lucide-react';

const HERO_IMAGE = 'https://images.pexels.com/photos/15645257/pexels-photo-15645257.jpeg?auto=compress&cs=tinysrgb&h=1200&w=1920';
const FOOD_IMAGE = 'https://images.pexels.com/photos/9792458/pexels-photo-9792458.jpeg?auto=compress&cs=tinysrgb&h=800&w=1200';
const DEFAULT_EVENT_DATE = '2026-11-05';

type Guest = { id: string; type: string; name: string; designation: string; image_url: string | null };
type Advisor = { id: string; name: string; title: string; organization: string | null; image_url: string | null };
type ManagementMember = { id: string; name: string; role: string; contact: string | null; image_url: string | null };
type Sponsor = { id: string; name: string; category: string; logo_url: string | null; website: string | null };
type BrandStall = { id: string; name: string; category: string; logo_url: string | null };

function useCountdown(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  useEffect(() => {
    const calculate = () => {
      const target = new Date(targetDate).getTime();
      const diff = target - Date.now();
      if (diff <= 0) { setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return; }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };
    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);
  return timeLeft;
}

function Carousel({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' });
  };
  return (
    <div className="relative">
      <div ref={scrollRef} className="flex gap-4 overflow-x-auto carousel-hide-scroll pb-4 snap-x">
        {children}
      </div>
      <button onClick={() => scroll('left')} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-10 h-10 rounded-full glass-strong border border-border/40 flex items-center justify-center text-foreground/70 hover:text-primary hover:border-primary/30 transition-all shadow-md z-10">
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button onClick={() => scroll('right')} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-10 h-10 rounded-full glass-strong border border-border/40 flex items-center justify-center text-foreground/70 hover:text-primary hover:border-primary/30 transition-all shadow-md z-10">
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}

function PersonCard({ name, subtitle, imageUrl, badge, badgeColor }: { name: string; subtitle: string; imageUrl: string | null; badge?: string; badgeColor?: string }) {
  return (
    <div className="snap-start shrink-0 w-64 rounded-2xl glass border border-border/30 p-6 text-center hover:border-primary/30 transition-all">
      <div className="w-20 h-20 rounded-full mx-auto mb-4 overflow-hidden bg-primary/10 flex items-center justify-center">
        {imageUrl ? <img src={imageUrl} alt={name} className="w-full h-full object-cover" /> : <span className="font-display text-2xl font-bold text-primary">{name.charAt(0)}</span>}
      </div>
      <h4 className="font-semibold text-foreground mb-1">{name}</h4>
      <p className="text-xs text-foreground/50">{subtitle}</p>
      {badge && <div className={`mt-3 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badgeColor || 'bg-primary/10 text-primary'}`}><Star className="w-3 h-3 fill-current" /> {badge}</div>}
    </div>
  );
}

function TbaCard({ label }: { label: string }) {
  return (
    <div className="snap-start shrink-0 w-64 rounded-2xl glass border border-dashed border-border/40 p-6 text-center">
      <div className="w-20 h-20 rounded-full mx-auto mb-4 bg-muted flex items-center justify-center">
        <Star className="w-8 h-8 text-foreground/20" />
      </div>
      <h4 className="font-semibold text-foreground/40 mb-1">{label}</h4>
    </div>
  );
}

function SponsorCard({ name, category, logoUrl }: { name: string; category: string; logoUrl: string | null }) {
  const categoryColors: Record<string, string> = { TITLE: 'bg-gradient-red', CO: 'bg-primary', PARTNER: 'bg-accent' };
  return (
    <div className="snap-start shrink-0 w-52 rounded-xl glass border border-border/30 p-6 text-center hover:border-primary/30 transition-all">
      <div className={`w-16 h-16 rounded-xl mx-auto mb-3 flex items-center justify-center ${categoryColors[category] || 'bg-primary'}`}>
        {logoUrl ? <img src={logoUrl} alt={name} className="w-full h-full object-contain rounded-xl" /> : <Award className="w-8 h-8 text-white" />}
      </div>
      <h4 className="font-semibold text-foreground text-sm mb-1">{name}</h4>
      <p className="text-xs text-primary font-medium">{category}</p>
    </div>
  );
}

function BrandCard({ name, category, logoUrl }: { name: string; category: string; logoUrl: string | null }) {
  return (
    <div className="snap-start shrink-0 w-56 rounded-xl glass border border-border/30 p-5 text-center hover:border-primary/30 transition-all">
      <div className="w-14 h-14 rounded-xl mx-auto mb-3 flex items-center justify-center bg-accent/15">
        {logoUrl ? <img src={logoUrl} alt={name} className="w-full h-full object-contain rounded-xl" /> : <Store className="w-7 h-7 text-accent" />}
      </div>
      <h4 className="font-semibold text-foreground text-sm mb-1">{name}</h4>
      <p className="text-xs text-foreground/40">{category}</p>
    </div>
  );
}

export default function Home() {
  const { t, lang } = useLanguage();
  const [eventDate, setEventDate] = useState(DEFAULT_EVENT_DATE);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activeDay, setActiveDay] = useState(0);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [management, setManagement] = useState<ManagementMember[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [brands, setBrands] = useState<BrandStall[]>([]);
  const isBn = lang === 'bn';

  useEffect(() => {
    (async () => {
      const { data: ed } = await supabase.from('event_settings').select('event_date').eq('id', 1).maybeSingle();
      if (ed?.event_date) setEventDate(ed.event_date);
      const [{ data: g }, { data: a }, { data: m }, { data: s }, { data: b }] = await Promise.all([
        supabase.from('guests').select('*').order('display_order', { ascending: true }),
        supabase.from('advisors').select('*').order('display_order', { ascending: true }),
        supabase.from('management_members').select('*').order('display_order', { ascending: true }),
        supabase.from('sponsors').select('*').order('display_order', { ascending: true }),
        supabase.from('brand_stalls').select('*').order('display_order', { ascending: true }),
      ]);
      if (g) setGuests(g as Guest[]);
      if (a) setAdvisors(a as Advisor[]);
      if (m) setManagement(m as ManagementMember[]);
      if (s) setSponsors(s as Sponsor[]);
      if (b) setBrands(b as BrandStall[]);
    })();
  }, []);

  const countdown = useCountdown(eventDate);

  const glanceIcons = [Calendar, Clock, MapPin, Star, Leaf, Users, Store];
  const focusIcons = [UtensilsCrossed, Music, Baby, Sparkles, Briefcase, Leaf];
  const whoIcons = [Users, GraduationCap, Briefcase, UtensilsCrossed];
  const culturalWhoIcons = [Store, Briefcase, ChefHat, Music, Camera, Users, Building2];
  const differentIcons = [Music, Gamepad2, Award, Store, HeartPulse, PawPrint, Camera, Baby, Recycle, HeartPulse];
  const zeroPlasticIcons = [Leaf, Droplets, CupSoda, Trash2, Recycle];

  const days = [t.programme.day1, t.programme.day2, t.programme.day3];

  return (
    <div className="overflow-hidden">
      {/* 1. Hero Section & Countdown */}
      <section className="relative min-h-[92vh] flex items-center justify-center">
        <div className="absolute inset-0 z-0">
          <img src={HERO_IMAGE} alt="Foodiana Festival" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-hero" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center pt-20 pb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-dark border border-accent/30 mb-6 animate-fade-in-up">
            <Star className="w-3.5 h-3.5 text-accent fill-accent" />
            <span className={`text-xs font-medium text-accent tracking-wider uppercase ${isBn ? 'font-bengali' : ''}`}>{t.hero.tagline}</span>
          </div>
          <h1 className={`font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-[1.2] mb-3 animate-fade-in-up text-white ${isBn ? 'font-bengali' : ''}`} style={{ animationDelay: '0.1s' }}>
            {t.hero.subTagline}
          </h1>
          <p className={`text-base sm:text-lg md:text-xl text-white/80 mb-3 animate-fade-in-up ${isBn ? 'font-bengali' : ''}`} style={{ animationDelay: '0.2s' }}>{t.hero.subtitle}</p>
          <p className={`text-xs sm:text-sm md:text-base text-white/60 max-w-2xl mx-auto mb-6 animate-fade-in-up ${isBn ? 'font-bengali' : ''}`} style={{ animationDelay: '0.3s' }}>{t.hero.description}</p>
          <p className={`text-sm sm:text-base text-accent mb-8 animate-fade-in-up ${isBn ? 'font-bengali' : ''}`} style={{ animationDelay: '0.35s' }}>{t.hero.date}</p>
          <div className="mb-8 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <p className={`text-sm text-white/60 mb-3 ${isBn ? 'font-bengali' : ''}`}>{t.hero.eventStarts}</p>
            <div className="flex justify-center gap-3 sm:gap-6">
              {[{ value: countdown.days, label: t.hero.days }, { value: countdown.hours, label: t.hero.hours }, { value: countdown.minutes, label: t.hero.minutes }, { value: countdown.seconds, label: t.hero.seconds }].map((unit, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl glass-dark border border-accent/20 flex items-center justify-center">
                    <span className="font-display text-2xl sm:text-3xl font-bold text-accent">{String(unit.value).padStart(2, '0')}</span>
                  </div>
                  <span className={`text-xs text-white/50 mt-2 ${isBn ? 'font-bengali' : ''}`}>{unit.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up" style={{ animationDelay: '0.45s' }}>
            <Link href="/register" className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-red text-white font-bold text-base shadow-red hover:shadow-red-lg transition-all duration-300 hover:scale-105">
              {t.hero.registerNow}<ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-5" />
      </section>

      {/* 2. SDG & Sustainability */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Zero Plastic banner */}
        <div className="rounded-3xl bg-gradient-festival border border-border/30 p-8 md:p-12 mb-10">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-orange flex items-center justify-center shrink-0 shadow-orange">
              <Leaf className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className={`font-display text-2xl md:text-3xl font-bold text-primary mb-2 ${isBn ? 'font-bengali' : ''}`}>{t.sdg.zeroPlastic.title}</h2>
              <p className={`text-sm md:text-base text-foreground/60 leading-relaxed ${isBn ? 'font-bengali' : ''}`}>{t.sdg.zeroPlastic.desc}</p>
            </div>
          </div>
        </div>

        {/* SDG Goals grid */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img
              src="https://www.gavi.org/sites/default/files/about/global-health/sdgs-rec.png"
              alt="UN SDG Logo"
              className="h-16 w-auto"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
            <div className="text-left">
              <h3 className={`font-display text-2xl md:text-3xl font-bold text-primary mb-1 ${isBn ? 'font-bengali' : ''}`}>{t.sdg.goalsTitle}</h3>
              <p className={`text-foreground/50 ${isBn ? 'font-bengali' : ''}`}>{t.sdg.goalsSubtitle}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {t.sdg.goals.map((goal, i) => (
            <div key={i} className="group rounded-2xl glass border border-border/30 p-6 hover:border-primary/30 transition-all duration-300 overflow-hidden">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center" style={{ backgroundColor: goal.color }}>
                  <img
                    src={goal.image}
                    alt={`SDG ${goal.num}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const img = e.currentTarget as HTMLImageElement;
                      img.style.display = 'none';
                      const fallback = document.createElement('span');
                      fallback.className = 'text-white font-display text-xl font-black';
                      fallback.textContent = goal.num;
                      img.parentElement?.appendChild(fallback);
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <h4 className={`font-display text-base font-bold text-foreground mb-2 ${isBn ? 'font-bengali' : ''}`}>{goal.title}</h4>
                  <p className={`text-xs text-foreground/60 leading-relaxed ${isBn ? 'font-bengali' : ''}`}>{goal.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Event At A Glance */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className={`font-display text-3xl md:text-4xl font-bold text-primary mb-2 ${isBn ? 'font-bengali' : ''}`}>{t.glance.title}</h2>
          <p className={`text-foreground/50 ${isBn ? 'font-bengali' : ''}`}>{t.glance.subtitle}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {t.glance.items.map((item, i) => {
            const Icon = glanceIcons[i] || Star;
            return (
              <div key={i} className="rounded-2xl glass border border-border/30 p-6 text-center hover:border-primary/30 transition-all">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3"><Icon className="w-6 h-6 text-primary" /></div>
                <p className="font-display text-lg font-bold text-foreground mb-1">{item.value}</p>
                <p className={`text-xs text-foreground/50 ${isBn ? 'font-bengali' : ''}`}>{item.label}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Event Overview & Details */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-secondary/20 rounded-3xl">
        <div className="text-center mb-10">
          <h2 className={`font-display text-3xl md:text-4xl font-bold text-primary mb-2 ${isBn ? 'font-bengali' : ''}`}>{t.overview.title}</h2>
          <p className={`text-foreground/50 ${isBn ? 'font-bengali' : ''}`}>{t.overview.subtitle}</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="rounded-2xl glass border border-border/30 p-8">
            <h3 className={`font-display text-xl font-bold text-primary mb-4 ${isBn ? 'font-bengali' : ''}`}>{t.overview.whyTitle}</h3>
            <p className={`text-sm text-foreground/70 leading-relaxed ${isBn ? 'font-bengali' : ''}`}>{t.overview.whyText}</p>
          </div>
          <div className="rounded-2xl glass border border-border/30 p-8">
            <h3 className={`font-display text-xl font-bold text-primary mb-4 ${isBn ? 'font-bengali' : ''}`}>{t.overview.focusTitle}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {t.overview.focusItems.map((item, i) => {
                const Icon = focusIcons[i] || Star;
                return (
                  <div key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary/5 border border-border/20">
                    <Icon className="w-4 h-4 text-accent shrink-0" />
                    <span className={`text-sm font-medium text-foreground/80 ${isBn ? 'font-bengali' : ''}`}>{item}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Experiences & Offerings */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className={`font-display text-3xl md:text-4xl font-bold text-primary mb-2 ${isBn ? 'font-bengali' : ''}`}>{t.experiences.title}</h2>
          <p className={`text-foreground/50 ${isBn ? 'font-bengali' : ''}`}>{t.experiences.subtitle}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Food Experience Zones */}
          <div className="rounded-2xl glass border border-border/30 p-6">
            <h3 className={`font-display text-lg font-bold text-primary mb-4 ${isBn ? 'font-bengali' : ''}`}>{t.experiences.experienceTitle}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {t.experiences.experienceItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-accent/5 border border-border/20">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                  <span className={`text-sm text-foreground/80 ${isBn ? 'font-bengali' : ''}`}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Visitors Experience */}
          <div className="rounded-2xl glass border border-border/30 p-6">
            <h3 className={`font-display text-lg font-bold text-primary mb-4 ${isBn ? 'font-bengali' : ''}`}>{t.experiences.visitorsTitle}</h3>
            <div className="flex flex-wrap gap-2">
              {t.experiences.visitorsItems.map((item, i) => (
                <span key={i} className={`px-3 py-1.5 rounded-lg bg-primary/5 text-foreground/70 text-sm border border-border/20 ${isBn ? 'font-bengali' : ''}`}>{item}</span>
              ))}
            </div>
          </div>

          {/* What Makes Different */}
          <div className="rounded-2xl glass border border-border/30 p-6">
            <h3 className={`font-display text-lg font-bold text-primary mb-4 ${isBn ? 'font-bengali' : ''}`}>{t.experiences.differentTitle}</h3>
            <div className="grid grid-cols-2 gap-2">
              {t.experiences.differentItems.map((item, i) => {
                const Icon = differentIcons[i] || Star;
                return (
                  <div key={i} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-accent/5 border border-border/20">
                    <Icon className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span className={`text-xs text-foreground/70 ${isBn ? 'font-bengali' : ''}`}>{item}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Zero Plastic */}
          <div className="rounded-2xl bg-gradient-festival border border-border/30 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-orange flex items-center justify-center"><Leaf className="w-5 h-5 text-white" /></div>
              <h3 className={`font-display text-lg font-bold text-primary ${isBn ? 'font-bengali' : ''}`}>{t.experiences.zeroPlasticTitle}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {t.experiences.zeroPlasticItems.map((item, i) => {
                const Icon = zeroPlasticIcons[i] || Leaf;
                return (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/50 border border-border/20">
                    <Icon className="w-4 h-4 text-accent shrink-0" />
                    <span className={`text-sm text-foreground/70 ${isBn ? 'font-bengali' : ''}`}>{item}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Who is it for + Games */}
          <div className="rounded-2xl glass border border-border/30 p-6">
            <h3 className={`font-display text-lg font-bold text-primary mb-4 ${isBn ? 'font-bengali' : ''}`}>{t.experiences.whoTitle}</h3>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {t.experiences.whoItems.map((item, i) => {
                const Icon = whoIcons[i] || Users;
                return (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-border/20">
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    <span className={`text-sm text-foreground/80 ${isBn ? 'font-bengali' : ''}`}>{item}</span>
                  </div>
                );
              })}
            </div>
            <h4 className={`font-semibold text-accent mb-3 text-sm ${isBn ? 'font-bengali' : ''}`}>{t.experiences.gamesTitle}</h4>
            <div className="flex flex-wrap gap-2">
              {t.experiences.gamesItems.map((item, i) => (
                <span key={i} className={`px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-sm font-medium ${isBn ? 'font-bengali' : ''}`}>{item}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Food Type Carousel */}
        <div className="mt-10">
          <h3 className={`font-display text-2xl md:text-3xl font-bold text-primary mb-2 text-center ${isBn ? 'font-bengali' : ''}`}>{t.experiences.foodTitle}</h3>
          <p className={`text-foreground/50 text-center mb-6 ${isBn ? 'font-bengali' : ''}`}>{t.experiences.foodStories}</p>
          <FoodCarousel items={t.experiences.foodItems} isBn={isBn} />
        </div>
      </section>

      {/* 6. Cultural Program & Participants */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-secondary/20 rounded-3xl">
        <div className="text-center mb-10">
          <h2 className={`font-display text-3xl md:text-4xl font-bold text-primary mb-2 ${isBn ? 'font-bengali' : ''}`}>{t.cultural.title}</h2>
          <p className={`text-foreground/50 ${isBn ? 'font-bengali' : ''}`}>{t.cultural.subtitle}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl glass border border-border/30 p-6">
            <h3 className={`font-display text-lg font-bold text-primary mb-4 ${isBn ? 'font-bengali' : ''}`}>{t.cultural.whoTitle}</h3>
            <div className="grid grid-cols-2 gap-2">
              {t.cultural.whoItems.map((item, i) => {
                const Icon = culturalWhoIcons[i] || Users;
                return (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-border/20">
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    <span className={`text-sm text-foreground/80 ${isBn ? 'font-bengali' : ''}`}>{item}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-2xl glass border border-border/30 p-6">
            <h3 className={`font-display text-lg font-bold text-primary mb-4 ${isBn ? 'font-bengali' : ''}`}>{t.cultural.programTitle}</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {t.cultural.programItems.map((item, i) => (
                <span key={i} className={`px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-sm font-medium ${isBn ? 'font-bengali' : ''}`}>{item}</span>
              ))}
            </div>
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-muted/50 border border-dashed border-border/40">
              <Star className="w-4 h-4 text-foreground/30" />
              <p className={`text-sm text-foreground/50 ${isBn ? 'font-bengali' : ''}`}>{t.cultural.artistsNote}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Stalls & Brand Partners */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className={`font-display text-3xl md:text-4xl font-bold text-primary mb-2 ${isBn ? 'font-bengali' : ''}`}>{t.stalls.title}</h2>
          <p className={`text-foreground/50 ${isBn ? 'font-bengali' : ''}`}>{t.stalls.subtitle}</p>
        </div>
        <div className="rounded-2xl bg-gradient-red p-8 text-center mb-10">
          <Store className="w-10 h-10 text-white mx-auto mb-3" />
          <p className="font-display text-5xl font-bold text-white mb-2">{t.stalls.capacityValue}</p>
          <p className={`text-white/80 mb-1 ${isBn ? 'font-bengali' : ''}`}>{t.stalls.capacityTitle}</p>
          <p className={`text-sm text-white/60 ${isBn ? 'font-bengali' : ''}`}>{t.stalls.capacityDesc}</p>
        </div>
        <h3 className={`text-lg font-semibold text-foreground mb-4 ${isBn ? 'font-bengali' : ''}`}>{t.stalls.brandsSlider}</h3>
        {brands.length > 0 ? (
          <Carousel>
            {brands.map((b) => (<BrandCard key={b.id} name={b.name} category={b.category} logoUrl={b.logo_url} />))}
          </Carousel>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Store className="w-8 h-8 text-foreground/30 mb-2" />
            <p className={`text-sm text-foreground/40 ${isBn ? 'font-bengali' : ''}`}>{t.stalls.noBrands}</p>
          </div>
        )}
      </section>

      {/* 8. Dynamic Guest & Management Carousels */}
      {/* Slider A: Chief Guest & Special Guests */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-secondary/20 rounded-3xl">
        <div className="text-center mb-10">
          <h2 className={`font-display text-3xl md:text-4xl font-bold text-primary mb-2 ${isBn ? 'font-bengali' : ''}`}>{t.carousels.sectionA.title}</h2>
          <p className={`text-foreground/50 ${isBn ? 'font-bengali' : ''}`}>{t.carousels.sectionA.subtitle}</p>
        </div>
        {guests.length > 0 ? (
          <Carousel>
            {guests.map((g) => (
              <PersonCard key={g.id} name={g.name} subtitle={g.designation} imageUrl={g.image_url}
                badge={g.type === 'CHIEF' ? t.carousels.chiefGuest : t.carousels.specialGuest}
                badgeColor={g.type === 'CHIEF' ? 'bg-gradient-red text-white' : 'bg-primary/10 text-primary'} />
            ))}
          </Carousel>
        ) : (
          <Carousel><TbaCard label={t.carousels.sectionA.tba} /><TbaCard label={t.carousels.sectionA.tba} /><TbaCard label={t.carousels.sectionA.tba} /></Carousel>
        )}
      </section>

      {/* Slider B: Advisory Council */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className={`font-display text-3xl md:text-4xl font-bold text-primary mb-2 ${isBn ? 'font-bengali' : ''}`}>{t.carousels.sectionB.title}</h2>
          <p className={`text-foreground/50 ${isBn ? 'font-bengali' : ''}`}>{t.carousels.sectionB.subtitle}</p>
        </div>
        {advisors.length > 0 ? (
          <Carousel>
            {advisors.map((a) => (<PersonCard key={a.id} name={a.name} subtitle={`${a.title}${a.organization ? ' · ' + a.organization : ''}`} imageUrl={a.image_url} />))}
          </Carousel>
        ) : (
          <Carousel><TbaCard label={t.carousels.sectionB.tba} /><TbaCard label={t.carousels.sectionB.tba} /><TbaCard label={t.carousels.sectionB.tba} /></Carousel>
        )}
      </section>

      {/* Slider C: Management Team */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-secondary/20 rounded-3xl">
        <div className="text-center mb-10">
          <h2 className={`font-display text-3xl md:text-4xl font-bold text-primary mb-2 ${isBn ? 'font-bengali' : ''}`}>{t.carousels.sectionC.title}</h2>
          <p className={`text-foreground/50 ${isBn ? 'font-bengali' : ''}`}>{t.carousels.sectionC.subtitle}</p>
        </div>
        {management.length > 0 ? (
          <Carousel>
            {management.map((m) => (<PersonCard key={m.id} name={m.name} subtitle={`${m.role}${m.contact ? ' · ' + m.contact : ''}`} imageUrl={m.image_url} />))}
          </Carousel>
        ) : (
          <Carousel><TbaCard label={t.carousels.sectionC.tba} /><TbaCard label={t.carousels.sectionC.tba} /><TbaCard label={t.carousels.sectionC.tba} /></Carousel>
        )}
      </section>

      {/* Slider D: Sponsors & Brand Partners */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className={`font-display text-3xl md:text-4xl font-bold text-primary mb-2 ${isBn ? 'font-bengali' : ''}`}>{t.carousels.sectionD.title}</h2>
          <p className={`text-foreground/50 ${isBn ? 'font-bengali' : ''}`}>{t.carousels.sectionD.subtitle}</p>
        </div>
        {sponsors.length > 0 ? (
          <Carousel>
            {sponsors.map((s) => (
              <SponsorCard key={s.id} name={s.name} category={s.category === 'TITLE' ? t.carousels.sponsorTitle : s.category === 'CO' ? t.carousels.sponsorCo : t.carousels.sponsorPartner} logoUrl={s.logo_url} />
            ))}
          </Carousel>
        ) : (
          <Carousel><TbaCard label={t.carousels.sectionD.tba} /><TbaCard label={t.carousels.sectionD.tba} /><TbaCard label={t.carousels.sectionD.tba} /></Carousel>
        )}
      </section>

      {/* 9. 3-Day Festival Programme */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-secondary/20 rounded-3xl">
        <div className="text-center mb-10">
          <h2 className={`font-display text-3xl md:text-4xl font-bold text-primary mb-2 ${isBn ? 'font-bengali' : ''}`}>{t.programme.title}</h2>
          <p className={`text-foreground/50 ${isBn ? 'font-bengali' : ''}`}>{t.programme.subtitle}</p>
        </div>
        <div className="flex gap-2 mb-6 justify-center">
          {days.map((day, i) => (
            <button key={i} onClick={() => setActiveDay(i)}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${activeDay === i ? 'bg-gradient-red text-white shadow-red' : 'glass border border-border/30 text-foreground/60 hover:text-primary'} ${isBn ? 'font-bengali' : ''}`}>
              {day.title} — {day.subtitle}
            </button>
          ))}
        </div>
        <div key={activeDay} className="animate-fade-in-up rounded-2xl glass border border-border/30 p-8 max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-red flex items-center justify-center text-white font-display text-xl font-bold">{activeDay + 1}</div>
            <div>
              <h3 className="font-display text-xl font-bold text-primary">{days[activeDay].title}</h3>
              <p className="text-sm text-accent font-medium">{days[activeDay].subtitle}</p>
            </div>
          </div>
          <p className={`text-sm text-foreground/70 leading-relaxed ${isBn ? 'font-bengali' : ''}`}>{days[activeDay].desc}</p>
        </div>
      </section>

      {/* 10. Mission, Vision & Join Us */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className={`font-display text-3xl md:text-4xl font-bold text-primary mb-2 ${isBn ? 'font-bengali' : ''}`}>{t.mission.title}</h2>
          <p className={`text-foreground/50 ${isBn ? 'font-bengali' : ''}`}>{t.mission.subtitle}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="rounded-2xl glass border border-border/30 p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Star className="w-5 h-5 text-primary" /></div>
              <h3 className={`font-display text-lg font-bold text-primary ${isBn ? 'font-bengali' : ''}`}>{t.mission.missionTitle}</h3>
            </div>
            <p className={`text-sm text-foreground/70 leading-relaxed ${isBn ? 'font-bengali' : ''}`}>{t.mission.missionText}</p>
          </div>
          <div className="rounded-2xl glass border border-border/30 p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center"><Sparkles className="w-5 h-5 text-accent" /></div>
              <h3 className={`font-display text-lg font-bold text-primary ${isBn ? 'font-bengali' : ''}`}>{t.mission.visionTitle}</h3>
            </div>
            <p className={`text-sm text-foreground/70 leading-relaxed ${isBn ? 'font-bengali' : ''}`}>{t.mission.visionText}</p>
          </div>
        </div>
        <div className="rounded-3xl bg-gradient-red p-8 md:p-12 text-center">
          <h3 className={`font-display text-2xl md:text-3xl font-bold text-white mb-3 ${isBn ? 'font-bengali' : ''}`}>{t.mission.joinTitle}</h3>
          <p className={`text-sm md:text-base text-white/80 max-w-2xl mx-auto mb-6 ${isBn ? 'font-bengali' : ''}`}>{t.mission.joinText}</p>
          <Link href="/register" className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-primary font-bold text-base hover:scale-105 transition-all duration-300 shadow-lg">
            {t.mission.joinBtn}<ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      {/* 11. FAQ */}
      <section className="py-16 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className={`font-display text-3xl md:text-4xl font-bold text-primary mb-2 ${isBn ? 'font-bengali' : ''}`}>{t.faq.title}</h2>
          <p className={`text-foreground/50 ${isBn ? 'font-bengali' : ''}`}>{t.faq.subtitle}</p>
        </div>
        <div className="space-y-3">
          {t.faq.items.map((item, i) => (
            <div key={i} className="rounded-xl glass border border-border/30 overflow-hidden">
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-5 text-left hover:bg-primary/5 transition-colors">
                <span className={`font-medium text-foreground pr-4 ${isBn ? 'font-bengali' : ''}`}>{item.q}</span>
                {openFaq === i ? <Minus className="w-5 h-5 text-primary shrink-0" /> : <Plus className="w-5 h-5 text-primary shrink-0" />}
              </button>
              {openFaq === i && <div className="px-5 pb-5 animate-fade-in-up"><p className={`text-sm text-foreground/60 leading-relaxed ${isBn ? 'font-bengali' : ''}`}>{item.a}</p></div>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
