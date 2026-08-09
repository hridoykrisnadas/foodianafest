'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/lib/language-context';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import CrudPanel from '@/components/crud-panel';
import { Users, DollarSign, LogIn, CheckCircle2, Clock, Search, Ticket, Printer, LogOut, Loader2, ShieldCheck, AlertCircle, Calendar, Save, Sun, Moon, ArrowLeft, QrCode } from 'lucide-react';
import Link from 'next/link';

type Visitor = {
  id: string; qr_code_id: string; name: string; email: string; mobile: string;
  profession: string; payment_status: string; entry_status: boolean; created_at: string;
};

type Metrics = { total: number; paid: number; checkedIn: number; pending: number };

const ADMIN_PASSWORD = 'foodiana2026';

export default function AdminPage() {
  const { t, lang } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);

  const [metrics, setMetrics] = useState<Metrics>({ total: 0, paid: 0, checkedIn: 0, pending: 0 });
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending' | 'entered'>('all');
  const [page, setPage] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [raffleVisitors, setRaffleVisitors] = useState<Visitor[]>([]);
  const [showRaffle, setShowRaffle] = useState(false);
  const [raffleLoading, setRaffleLoading] = useState(false);

  const [eventDate, setEventDate] = useState('2026-11-05');
  const [eventEndDate, setEventEndDate] = useState('2026-11-07');
  const [dateSaving, setDateSaving] = useState(false);
  const [dateMessage, setDateMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'visitors' | 'guests' | 'advisors' | 'management' | 'sponsors' | 'brands'>('visitors');

  const isBn = lang === 'bn';
  const pageSize = 10;

  useEffect(() => { setMounted(true); }, []);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault(); setAuthenticating(true);
    setTimeout(() => {
      if (password === ADMIN_PASSWORD) { setAuthed(true); setAuthError(false); sessionStorage.setItem('foodiana-admin-authed', 'true'); } else { setAuthError(true); }
      setAuthenticating(false);
    }, 400);
  };

  const signOut = () => { setAuthed(false); setPassword(''); sessionStorage.removeItem('foodiana-admin-authed'); };

  const fetchMetrics = useCallback(async () => {
    const { count: total } = await supabase.from('visitors').select('*', { count: 'exact', head: true });
    const { count: paid } = await supabase.from('visitors').select('*', { count: 'exact', head: true }).eq('payment_status', 'Paid');
    const { count: checkedIn } = await supabase.from('visitors').select('*', { count: 'exact', head: true }).eq('entry_status', true);
    setMetrics({ total: total || 0, paid: paid || 0, checkedIn: checkedIn || 0, pending: (total || 0) - (paid || 0) });
  }, []);

  const fetchVisitors = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('visitors').select('*').order('created_at', { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1);
    if (filter === 'paid') query = query.eq('payment_status', 'Paid');
    else if (filter === 'pending') query = query.eq('payment_status', 'Pending');
    else if (filter === 'entered') query = query.eq('entry_status', true);
    if (search.trim()) query = query.or(`name.ilike.%${search}%,mobile.ilike.%${search}%,qr_code_id.ilike.%${search}%`);
    const { data, error } = await query;
    if (!error && data) setVisitors(data as Visitor[]);
    setLoading(false);
  }, [page, filter, search]);

  const fetchEventDate = useCallback(async () => {
    const { data } = await supabase.from('event_settings').select('event_date, event_end_date').eq('id', 1).maybeSingle();
    if (data?.event_date) setEventDate(data.event_date);
    if (data?.event_end_date) setEventEndDate(data.event_end_date);
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('foodiana-admin-authed');
    if (saved === 'true') setAuthed(true);
  }, []);

  useEffect(() => {
    if (authed) { fetchMetrics(); fetchVisitors(); fetchEventDate(); }
  }, [authed, fetchMetrics, fetchVisitors, fetchEventDate]);

  const markPaid = async (v: Visitor) => {
    setActionLoading(v.id);
    const { error } = await supabase.from('visitors').update({ payment_status: 'Paid' }).eq('id', v.id);
    if (!error) { setVisitors((prev) => prev.map((x) => (x.id === v.id ? { ...x, payment_status: 'Paid' } : x))); fetchMetrics(); }
    setActionLoading(null);
  };

  const allowEntry = async (v: Visitor) => {
    setActionLoading(v.id);
    const { error } = await supabase.from('visitors').update({ entry_status: true, checked_in_at: new Date().toISOString() }).eq('id', v.id);
    if (!error) { setVisitors((prev) => prev.map((x) => (x.id === v.id ? { ...x, entry_status: true } : x))); fetchMetrics(); }
    setActionLoading(null);
  };

  const generateRaffle = async () => {
    setRaffleLoading(true);
    const { data, error } = await supabase.from('visitors').select('*').eq('payment_status', 'Paid').order('created_at', { ascending: true });
    if (!error && data) { setRaffleVisitors(data as Visitor[]); setShowRaffle(true); }
    setRaffleLoading(false);
  };

  const saveEventDate = async () => {
    setDateSaving(true); setDateMessage(null);
    const { error } = await supabase.from('event_settings').update({ event_date: eventDate, event_end_date: eventEndDate, updated_at: new Date().toISOString() }).eq('id', 1);
    if (!error) setDateMessage(t.admin.dateSaved); else setDateMessage('Error saving date');
    setDateSaving(false);
    setTimeout(() => setDateMessage(null), 3000);
  };

  // Login screen
  if (!authed) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-sm w-full animate-fade-in-up">
          <div className="glass-strong rounded-2xl p-8 border border-border/30 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5"><ShieldCheck className="w-9 h-9 text-primary" /></div>
            <h1 className={`font-display text-2xl font-bold text-primary mb-2 ${isBn ? 'font-bengali' : ''}`}>{t.admin.signIn}</h1>
            <p className={`text-sm text-foreground/50 mb-6 ${isBn ? 'font-bengali' : ''}`}>Foodiana 2026 Admin</p>
            <form onSubmit={handleAuth} className="space-y-4 text-left">
              <div>
                <label className={`block text-sm font-medium text-foreground/80 mb-2 ${isBn ? 'font-bengali' : ''}`}>{t.admin.password}</label>
                <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setAuthError(false); }} autoFocus
                  className={`w-full px-4 py-3 rounded-xl bg-input border text-foreground placeholder:text-foreground/30 outline-none focus:ring-2 focus:ring-primary/30 ${authError ? 'border-destructive' : 'border-border/40 focus:border-primary/40'}`} placeholder="••••••••" />
                {authError && <p className={`mt-1.5 text-xs text-destructive ${isBn ? 'font-bengali' : ''}`}>{t.admin.invalidCreds}</p>}
              </div>
              <button type="submit" disabled={authenticating} className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-gold text-white font-bold text-sm shadow-gold hover:shadow-gold-lg transition-all disabled:opacity-50">
                {authenticating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />} {t.admin.signInBtn}
              </button>
            </form>
            <p className={`mt-6 text-xs text-foreground/30 ${isBn ? 'font-bengali' : ''}`}>Demo password: foodiana2026</p>
          </div>
        </div>
      </div>
    );
  }

  // Raffle coupon view
  if (showRaffle) {
    const couponsPerPage = 10;
    const pages: Visitor[][] = [];
    for (let i = 0; i < raffleVisitors.length; i += couponsPerPage) pages.push(raffleVisitors.slice(i, i + couponsPerPage));

    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="no-print flex items-center justify-between mb-6">
          <div>
            <h1 className={`font-display text-2xl font-bold text-primary ${isBn ? 'font-bengali' : ''}`}>{t.admin.raffleTitle}</h1>
            <p className={`text-sm text-foreground/50 ${isBn ? 'font-bengali' : ''}`}>{t.admin.raffleSubtitle}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-gold text-white font-bold text-sm shadow-gold transition-all"><Printer className="w-4 h-4" /> {t.admin.print}</button>
            <button onClick={() => setShowRaffle(false)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl glass border border-border/40 text-primary font-semibold text-sm transition-all"><ArrowLeft className="w-4 h-4" /> {t.register.back}</button>
          </div>
        </div>
        {raffleVisitors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center"><AlertCircle className="w-10 h-10 text-foreground/30 mb-3" /><p className={`text-sm text-foreground/40 ${isBn ? 'font-bengali' : ''}`}>{t.admin.noPaidVisitors}</p></div>
        ) : (
          <div className="print-area">
            {pages.map((pageVisitors, pageIdx) => (
              <div key={pageIdx} className={`grid grid-cols-2 gap-4 mb-6 ${pageIdx < pages.length - 1 ? 'coupon-page-break' : ''}`}>
                {pageVisitors.map((v, i) => {
                  const couponNumber = pageIdx * couponsPerPage + i + 1;
                  return (
                    <div key={v.id} className="raffle-coupon relative rounded-lg overflow-hidden bg-white text-black">
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-600 to-amber-400" />
                      <div className="pt-4 px-4 pb-3">
                        <div className="flex items-start justify-between mb-2">
                          <div><p className="font-serif text-lg font-black text-gray-900 leading-tight">{t.admin.couponTitle}</p><p className="text-xs text-gray-500 font-semibold tracking-wider">{t.admin.couponSubtitle}</p></div>
                          <div className="text-right"><p className="text-xs text-gray-400">{t.admin.couponNo}</p><p className="font-serif text-2xl font-black text-gray-900 leading-none">#{couponNumber.toString().padStart(4, '0')}</p></div>
                        </div>
                        <div className="mt-3 space-y-1">
                          <div className="flex items-center gap-2"><span className="text-xs text-gray-400 font-semibold w-12">{t.admin.name}:</span><span className="text-sm font-bold text-gray-800 truncate">{v.name}</span></div>
                          <div className="flex items-center gap-2"><span className="text-xs text-gray-400 font-semibold w-12">{t.admin.id}:</span><span className="text-sm font-mono font-bold text-gray-700">{v.qr_code_id}</span></div>
                        </div>
                        <div className="mt-3 flex items-center justify-between"><p className="text-xs text-gray-400">Foodiana 2026 · Dhaka</p><p className="text-xs text-gray-400">★ ★ ★</p></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Main dashboard
  const metricCards = [
    { label: t.admin.totalRegistered, value: metrics.total, icon: Users, color: 'from-primary/15 to-primary/5', iconColor: 'text-primary' },
    { label: t.admin.totalPaid, value: metrics.paid, icon: DollarSign, color: 'from-emerald/15 to-emerald/5', iconColor: 'text-emerald' },
    { label: t.admin.totalCheckedIn, value: metrics.checkedIn, icon: CheckCircle2, color: 'from-emerald/15 to-emerald/5', iconColor: 'text-emerald' },
    { label: t.admin.pendingPayment, value: metrics.pending, icon: Clock, color: 'from-saffron/15 to-saffron/5', iconColor: 'text-saffron' },
  ];

  const filters: { key: typeof filter; label: string }[] = [
    { key: 'all', label: t.admin.filterAll }, { key: 'paid', label: t.admin.filterPaid },
    { key: 'pending', label: t.admin.filterPending }, { key: 'entered', label: t.admin.filterEntered },
  ];

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: 'visitors', label: t.admin.visitors },
    { key: 'guests', label: t.admin.crud.guests },
    { key: 'advisors', label: t.admin.crud.advisors },
    { key: 'management', label: t.admin.crud.management },
    { key: 'sponsors', label: t.admin.crud.sponsors },
    { key: 'brands', label: t.admin.crud.brands },
  ];

  const crudConfigs: Record<string, CrudConfig> = {
    guests: {
      table: 'guests',
      labelKey: 'guests',
      fields: [
        { key: 'name_bn', label: t.admin.crud.nameBn, type: 'text' },
        { key: 'name_en', label: t.admin.crud.nameEn, type: 'text' },
        { key: 'type', label: t.admin.crud.type, type: 'select', options: [{ value: 'CHIEF', label: t.admin.crud.chief }, { value: 'SPECIAL', label: t.admin.crud.special }] },
        { key: 'designation_bn', label: t.admin.crud.designationBn, type: 'text' },
        { key: 'designation_en', label: t.admin.crud.designationEn, type: 'text' },
        { key: 'image_url', label: t.admin.crud.imageUrl, type: 'text' },
        { key: 'bio_bn', label: t.admin.crud.bioBn, type: 'textarea' },
        { key: 'bio_en', label: t.admin.crud.bioEn, type: 'textarea' },
      ],
    },
    advisors: {
      table: 'advisors',
      labelKey: 'advisors',
      fields: [
        { key: 'name_bn', label: t.admin.crud.nameBn, type: 'text' },
        { key: 'name_en', label: t.admin.crud.nameEn, type: 'text' },
        { key: 'title_bn', label: t.admin.crud.titleBn, type: 'text' },
        { key: 'title_en', label: t.admin.crud.titleEn, type: 'text' },
        { key: 'organization_bn', label: t.admin.crud.organizationBn, type: 'text' },
        { key: 'organization_en', label: t.admin.crud.organizationEn, type: 'text' },
        { key: 'image_url', label: t.admin.crud.imageUrl, type: 'text' },
      ],
    },
    management: {
      table: 'management_members',
      labelKey: 'management',
      fields: [
        { key: 'name_bn', label: t.admin.crud.nameBn, type: 'text' },
        { key: 'name_en', label: t.admin.crud.nameEn, type: 'text' },
        { key: 'role_bn', label: t.admin.crud.roleBn, type: 'text' },
        { key: 'role_en', label: t.admin.crud.roleEn, type: 'text' },
        { key: 'contact', label: t.admin.crud.contact, type: 'text' },
        { key: 'image_url', label: t.admin.crud.imageUrl, type: 'text' },
      ],
    },
    sponsors: {
      table: 'sponsors',
      labelKey: 'sponsors',
      fields: [
        { key: 'name_bn', label: t.admin.crud.nameBn, type: 'text' },
        { key: 'name_en', label: t.admin.crud.nameEn, type: 'text' },
        { key: 'category', label: t.admin.crud.category, type: 'select', options: [{ value: 'TITLE', label: t.admin.crud.titleSponsor }, { value: 'CO', label: t.admin.crud.coSponsor }, { value: 'PARTNER', label: t.admin.crud.partner }] },
        { key: 'category_bn', label: t.admin.crud.categoryBn, type: 'text' },
        { key: 'category_en', label: t.admin.crud.categoryEn, type: 'text' },
        { key: 'logo_url', label: t.admin.crud.logoUrl, type: 'text' },
        { key: 'website', label: t.admin.crud.website, type: 'text' },
      ],
    },
    brands: {
      table: 'brand_stalls',
      labelKey: 'brands',
      fields: [
        { key: 'name_bn', label: t.admin.crud.nameBn, type: 'text' },
        { key: 'name_en', label: t.admin.crud.nameEn, type: 'text' },
        { key: 'category_bn', label: t.admin.crud.categoryBn, type: 'text' },
        { key: 'category_en', label: t.admin.crud.categoryEn, type: 'text' },
        { key: 'logo_url', label: t.admin.crud.logoUrl, type: 'text' },
      ],
    },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className={`font-display text-2xl md:text-3xl font-bold text-primary mb-1 ${isBn ? 'font-bengali' : ''}`}>{t.admin.title}</h1>
          <p className={`text-sm text-foreground/50 ${isBn ? 'font-bengali' : ''}`}>{t.admin.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {mounted && (
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2.5 rounded-xl glass border border-border/40 text-foreground/70 hover:text-primary hover:border-primary/30 transition-all">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}
          <Link href="/admin/scan" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl glass border border-border/40 text-primary font-medium text-sm hover:border-primary/40 transition-all">
            <QrCode className="w-4 h-4" /> {t.footer.qrScanner}
          </Link>
          <button onClick={signOut} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl glass border border-border/40 text-foreground/70 font-medium text-sm hover:border-primary/40 transition-all">
            <LogOut className="w-4 h-4" /> {t.admin.signOut}
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metricCards.map((m, i) => {
          const Icon = m.icon;
          return (
            <div key={i} className={`glass rounded-2xl p-5 border border-border/30 bg-gradient-to-br ${m.color}`}>
              <div className="flex items-center justify-between mb-3"><div className="w-10 h-10 rounded-lg bg-background/50 flex items-center justify-center"><Icon className={`w-5 h-5 ${m.iconColor}`} /></div></div>
              <p className="text-3xl font-bold text-foreground font-display">{m.value}</p>
              <p className={`text-xs text-foreground/50 mt-1 ${isBn ? 'font-bengali' : ''}`}>{m.label}</p>
            </div>
          );
        })}
      </div>

      {/* Event Date Manager */}
      <div className="glass-strong rounded-2xl p-6 border border-border/30 mb-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Calendar className="w-5 h-5 text-primary" /></div>
          <div>
            <h2 className={`font-display text-lg font-bold text-primary ${isBn ? 'font-bengali' : ''}`}>{t.admin.eventDateTitle}</h2>
            <p className={`text-sm text-foreground/50 ${isBn ? 'font-bengali' : ''}`}>{t.admin.eventDateSubtitle}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={`block text-sm font-medium text-foreground/80 mb-2 ${isBn ? 'font-bengali' : ''}`}>{t.admin.eventDate}</label>
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border/40 text-foreground outline-none focus:border-primary/40" />
          </div>
          <div>
            <label className={`block text-sm font-medium text-foreground/80 mb-2 ${isBn ? 'font-bengali' : ''}`}>{t.admin.eventEndDate}</label>
            <input type="date" value={eventEndDate} onChange={(e) => setEventEndDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border/40 text-foreground outline-none focus:border-primary/40" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={saveEventDate} disabled={dateSaving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-gold text-white font-bold text-sm shadow-gold hover:shadow-gold-lg transition-all disabled:opacity-50">
            {dateSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t.admin.saveDate}
          </button>
          {dateMessage && <p className={`text-sm text-emerald ${isBn ? 'font-bengali' : ''}`}>{dateMessage}</p>}
        </div>
      </div>

      {/* Raffle Generator CTA */}
      <div className="glass-strong rounded-2xl p-6 border border-border/30 mb-8 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold"><Ticket className="w-6 h-6 text-white" /></div>
          <div>
            <h2 className={`font-display text-lg font-bold text-primary ${isBn ? 'font-bengali' : ''}`}>{t.admin.raffleTitle}</h2>
            <p className={`text-sm text-foreground/50 ${isBn ? 'font-bengali' : ''}`}>{t.admin.raffleSubtitle}</p>
          </div>
        </div>
        <button onClick={generateRaffle} disabled={raffleLoading} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-gold text-white font-bold text-sm shadow-gold hover:shadow-gold-lg transition-all disabled:opacity-50">
          {raffleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />} {t.admin.generateCoupons}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto carousel-hide-scroll">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.key ? 'bg-primary/15 text-primary border border-primary/30' : 'text-foreground/50 hover:text-primary border border-transparent'} ${isBn ? 'font-bengali' : ''}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'visitors' && (
        <div className="glass-strong rounded-2xl border border-border/30 overflow-hidden">
          <div className="p-4 border-b border-border/20 flex items-center justify-between flex-wrap gap-3">
            <h2 className={`font-semibold text-primary flex items-center gap-2 ${isBn ? 'font-bengali' : ''}`}><Users className="w-4 h-4" /> {t.admin.visitors}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
                <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder={t.admin.search}
                  className={`pl-9 pr-4 py-2 rounded-lg bg-input border border-border/40 text-sm text-foreground placeholder:text-foreground/30 outline-none focus:border-primary/40 w-48 sm:w-64 ${isBn ? 'font-bengali' : ''}`} />
              </div>
              <div className="flex gap-1">
                {filters.map((f) => (
                  <button key={f.key} onClick={() => { setFilter(f.key); setPage(0); }}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${filter === f.key ? 'bg-primary/15 text-primary border border-primary/30' : 'text-foreground/50 hover:text-primary border border-transparent'} ${isBn ? 'font-bengali' : ''}`}>{f.label}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
            ) : visitors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center"><AlertCircle className="w-8 h-8 text-foreground/30 mb-2" /><p className={`text-sm text-foreground/40 ${isBn ? 'font-bengali' : ''}`}>{t.admin.noVisitors}</p></div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/20">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">{t.admin.name}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider hidden md:table-cell">{t.agent.mobile}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider hidden sm:table-cell">{t.success.yourId}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">{t.agent.paymentStatus}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider hidden lg:table-cell">{t.agent.entryStatus}</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visitors.map((v) => (
                    <tr key={v.id} className="border-b border-border/10 hover:bg-primary/5 transition-colors">
                      <td className="px-4 py-3"><p className="text-sm font-medium text-foreground">{v.name}</p><p className="text-xs text-foreground/40">{v.profession}</p></td>
                      <td className="px-4 py-3 hidden md:table-cell"><p className="text-sm text-foreground/70">{v.mobile}</p></td>
                      <td className="px-4 py-3 hidden sm:table-cell"><p className="text-xs font-mono text-primary/70">{v.qr_code_id}</p></td>
                      <td className="px-4 py-3">
                        {v.payment_status === 'Paid' ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald/15 text-emerald text-xs font-semibold"><CheckCircle2 className="w-3 h-3" /> {t.agent.paid}</span> : <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-saffron/15 text-saffron text-xs font-semibold"><Clock className="w-3 h-3" /> {t.agent.pending}</span>}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {v.entry_status ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald/15 text-emerald text-xs font-semibold"><CheckCircle2 className="w-3 h-3" /> {t.agent.entered}</span> : <span className="text-xs text-foreground/40">{t.agent.notEntered}</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          {v.payment_status === 'Pending' && (
                            <button onClick={() => markPaid(v)} disabled={actionLoading === v.id} className="px-2.5 py-1.5 rounded-lg bg-emerald/15 text-emerald text-xs font-semibold hover:bg-emerald/25 transition-all disabled:opacity-50">
                              {actionLoading === v.id ? <Loader2 className="w-3 h-3 animate-spin" /> : t.admin.markPaid}
                            </button>
                          )}
                          {v.payment_status === 'Paid' && !v.entry_status && (
                            <button onClick={() => allowEntry(v)} disabled={actionLoading === v.id} className="px-2.5 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-semibold hover:bg-primary/25 transition-all disabled:opacity-50">
                              {actionLoading === v.id ? <Loader2 className="w-3 h-3 animate-spin" /> : t.admin.markEntered}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {!loading && visitors.length > 0 && (
            <div className="p-4 border-t border-border/20 flex items-center justify-between">
              <p className="text-xs text-foreground/40">Page {page + 1}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-3 py-1.5 rounded-lg glass border border-border/30 text-xs text-foreground/70 hover:border-primary/30 transition-all disabled:opacity-30">←</button>
                <button onClick={() => setPage(page + 1)} disabled={visitors.length < pageSize} className="px-3 py-1.5 rounded-lg glass border border-border/30 text-xs text-foreground/70 hover:border-primary/30 transition-all disabled:opacity-30">→</button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'guests' && <CrudPanel config={crudConfigs.guests} />}
      {activeTab === 'advisors' && <CrudPanel config={crudConfigs.advisors} />}
      {activeTab === 'management' && <CrudPanel config={crudConfigs.management} />}
      {activeTab === 'sponsors' && <CrudPanel config={crudConfigs.sponsors} />}
      {activeTab === 'brands' && <CrudPanel config={crudConfigs.brands} />}
    </div>
  );
}

type CrudConfig = {
  table: string;
  labelKey: string;
  fields: { key: string; label: string; type: 'text' | 'select' | 'textarea'; options?: { value: string; label: string }[] }[];
};
