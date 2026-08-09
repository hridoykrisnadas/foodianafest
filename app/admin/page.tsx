'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/lib/language-context';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import CrudPanel from '@/components/crud-panel';
import { Users, DollarSign, LogIn, CheckCircle2, Clock, Search, Ticket, Printer, LogOut, Loader2, ShieldCheck, AlertCircle, Calendar, Save, Sun, Moon, ArrowLeft, QrCode, Music, DoorOpen, UsersRound } from 'lucide-react';
import Link from 'next/link';

type Visitor = {
  id: string; qr_code_id: string; name: string; email: string; mobile: string;
  profession: string; payment_status: string; entry_status: boolean; created_at: string;
  ticket_tier_id: string | null; ticket_price: number | null; includes_concert: boolean;
  exited_status: boolean; checked_in_at: string | null; exited_at: string | null;
};

type Metrics = { total: number; paid: number; checkedIn: number; pending: number; insideNow: number; exited: number };

type TicketTier = {
  id: string; day: string; start_time: string; end_time: string;
  price: number; includes_concert: boolean; label_en: string; label_bn: string;
  is_active: boolean; display_order: number;
};

type CrowdMetrics = { insideNow: number; capacity: number; available: number; isFull: boolean };

const ADMIN_PASSWORD = 'foodiana2026';

export default function AdminPage() {
  const { t, lang } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);

  const [metrics, setMetrics] = useState<Metrics>({ total: 0, paid: 0, checkedIn: 0, pending: 0, insideNow: 0, exited: 0 });
  const [crowd, setCrowd] = useState<CrowdMetrics>({ insideNow: 0, capacity: 2000, available: 2000, isFull: false });
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending' | 'entered' | 'inside' | 'exited'>('all');
  const [page, setPage] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [tierLoading, setTierLoading] = useState(false);
  const [showTierForm, setShowTierForm] = useState(false);
  const [editingTier, setEditingTier] = useState<TicketTier | null>(null);
  const [tierForm, setTierForm] = useState({ day: 'Thursday', start_time: '11:00', end_time: '17:00', price: 100, includes_concert: false, label_en: '', label_bn: '', is_active: true, display_order: 0 });
  const [tierSaving, setTierSaving] = useState(false);

  const [raffleVisitors, setRaffleVisitors] = useState<Visitor[]>([]);
  const [showRaffle, setShowRaffle] = useState(false);
  const [raffleLoading, setRaffleLoading] = useState(false);

  const [eventDate, setEventDate] = useState('2026-11-05');
  const [eventEndDate, setEventEndDate] = useState('2026-11-07');
  const [dateSaving, setDateSaving] = useState(false);
  const [dateMessage, setDateMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'visitors' | 'tickets' | 'guests' | 'advisors' | 'management' | 'sponsors' | 'brands'>('visitors');

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
    const { count: exited } = await supabase.from('visitors').select('*', { count: 'exact', head: true }).eq('exited_status', true);
    const { count: insideNow } = await supabase.from('visitors').select('*', { count: 'exact', head: true }).eq('entry_status', true).eq('exited_status', false);
    setMetrics({ total: total || 0, paid: paid || 0, checkedIn: checkedIn || 0, pending: (total || 0) - (paid || 0), insideNow: insideNow || 0, exited: exited || 0 });

    const { data: settings } = await supabase.from('event_settings').select('ground_capacity').eq('id', 1).maybeSingle();
    const cap = settings?.ground_capacity || 2000;
    const inside = insideNow || 0;
    setCrowd({ insideNow: inside, capacity: cap, available: Math.max(0, cap - inside), isFull: inside >= cap });
  }, []);

  const fetchVisitors = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('visitors').select('*').order('created_at', { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1);
    if (filter === 'paid') query = query.eq('payment_status', 'Paid');
    else if (filter === 'pending') query = query.eq('payment_status', 'Pending');
    else if (filter === 'entered') query = query.eq('entry_status', true);
    else if (filter === 'inside') query = query.eq('entry_status', true).eq('exited_status', false);
    else if (filter === 'exited') query = query.eq('exited_status', true);
    if (search.trim()) query = query.or(`name.ilike.%${search}%,mobile.ilike.%${search}%,qr_code_id.ilike.%${search}%`);
    const { data, error } = await query;
    if (!error && data) setVisitors(data as Visitor[]);
    setLoading(false);
  }, [page, filter, search]);

  const fetchTiers = useCallback(async () => {
    setTierLoading(true);
    const { data } = await supabase.from('ticket_tiers').select('*').order('display_order', { ascending: true });
    if (data) setTiers(data as TicketTier[]);
    setTierLoading(false);
  }, []);

  const fetchEventDate = useCallback(async () => {
    const { data } = await supabase.from('event_settings').select('event_date, event_end_date, ground_capacity').eq('id', 1).maybeSingle();
    if (data?.event_date) setEventDate(data.event_date);
    if (data?.event_end_date) setEventEndDate(data.event_end_date);
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('foodiana-admin-authed');
    if (saved === 'true') setAuthed(true);
  }, []);

  useEffect(() => {
    if (authed) { fetchMetrics(); fetchVisitors(); fetchEventDate(); fetchTiers(); }
  }, [authed, fetchMetrics, fetchVisitors, fetchEventDate, fetchTiers]);

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

  const markExited = async (v: Visitor) => {
    setActionLoading(v.id);
    const { error } = await supabase.from('visitors').update({ exited_status: true, exited_at: new Date().toISOString() }).eq('id', v.id);
    if (!error) { setVisitors((prev) => prev.map((x) => (x.id === v.id ? { ...x, exited_status: true } : x))); fetchMetrics(); }
    setActionLoading(null);
  };

  const handleSaveTier = async () => {
    setTierSaving(true);
    const payload = { ...tierForm, display_order: Number(tierForm.display_order), price: Number(tierForm.price) };
    if (editingTier) {
      await supabase.from('ticket_tiers').update(payload).eq('id', editingTier.id);
    } else {
      await supabase.from('ticket_tiers').insert(payload);
    }
    setTierSaving(false); setShowTierForm(false); setEditingTier(null);
    fetchTiers();
  };

  const openAddTier = () => {
    setEditingTier(null);
    setTierForm({ day: 'Thursday', start_time: '11:00', end_time: '17:00', price: 100, includes_concert: false, label_en: '', label_bn: '', is_active: true, display_order: tiers.length + 1 });
    setShowTierForm(true);
  };

  const openEditTier = (tier: TicketTier) => {
    setEditingTier(tier);
    setTierForm({ day: tier.day, start_time: tier.start_time, end_time: tier.end_time, price: tier.price, includes_concert: tier.includes_concert, label_en: tier.label_en || '', label_bn: tier.label_bn || '', is_active: tier.is_active, display_order: tier.display_order });
    setShowTierForm(true);
  };

  const deleteTier = async (tier: TicketTier) => {
    await supabase.from('ticket_tiers').delete().eq('id', tier.id);
    fetchTiers();
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

  const saveCapacity = async () => {
    setDateSaving(true);
    await supabase.from('event_settings').update({ ground_capacity: crowd.capacity, updated_at: new Date().toISOString() }).eq('id', 1);
    setDateSaving(false);
    fetchMetrics();
  };

  const formatTime = (time: string) => {
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${m} ${period}`;
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
    { key: 'inside', label: t.admin.insideNow }, { key: 'exited', label: t.admin.exited },
  ];

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: 'visitors', label: t.admin.visitors },
    { key: 'tickets', label: t.admin.tickets },
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

  const crowdPct = Math.min(100, Math.round((crowd.insideNow / crowd.capacity) * 100));

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

      {/* Crowd Control Bar */}
      <div className={`glass-strong rounded-2xl p-6 border mb-8 ${crowd.isFull ? 'border-destructive/40' : 'border-border/30'}`}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${crowd.isFull ? 'bg-destructive/15' : 'bg-primary/10'}`}>
              <UsersRound className={`w-5 h-5 ${crowd.isFull ? 'text-destructive' : 'text-primary'}`} />
            </div>
            <div>
              <h2 className={`font-display text-lg font-bold ${crowd.isFull ? 'text-destructive' : 'text-primary'} ${isBn ? 'font-bengali' : ''}`}>{t.admin.crowdControl}</h2>
              <p className={`text-sm text-foreground/50 ${isBn ? 'font-bengali' : ''}`}>
                {crowd.isFull ? t.admin.capacityFull : `${t.admin.insideVenue}: ${crowd.insideNow} / ${crowd.capacity}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className={`text-sm text-foreground/60 ${isBn ? 'font-bengali' : ''}`}>{t.admin.capacity}</label>
            <input type="number" value={crowd.capacity} min={1} onChange={(e) => setCrowd({ ...crowd, capacity: parseInt(e.target.value) || 0 })}
              className="w-24 px-3 py-2 rounded-lg bg-input border border-border/40 text-foreground text-sm outline-none focus:border-primary/40" />
            <button onClick={saveCapacity} disabled={dateSaving} className="px-3 py-2 rounded-lg bg-primary/15 text-primary text-sm font-semibold hover:bg-primary/25 transition-all disabled:opacity-50">
              {dateSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="w-full h-3 rounded-full bg-secondary/40 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${crowdPct >= 90 ? 'bg-destructive' : crowdPct >= 75 ? 'bg-saffron' : 'bg-emerald'}`} style={{ width: `${crowdPct}%` }} />
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className={`text-xs text-foreground/40 ${isBn ? 'font-bengali' : ''}`}>{crowdPct}% {isBn ? 'পূর্ণ' : 'full'}</p>
          <p className={`text-xs ${crowd.isFull ? 'text-destructive font-semibold' : 'text-foreground/40'} ${isBn ? 'font-bengali' : ''}`}>
            {crowd.isFull ? t.admin.capacityFull : `${t.admin.capacityAvailable}: ${crowd.available}`}
          </p>
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
              <div className="flex gap-1 flex-wrap">
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
                    <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider hidden md:table-cell">{t.admin.ticketTier}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider hidden md:table-cell">{t.agent.mobile}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider hidden sm:table-cell">{t.success.yourId}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">{t.agent.paymentStatus}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider hidden lg:table-cell">{t.agent.entryStatus}</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visitors.map((v) => {
                    const tier = tiers.find((t) => t.id === v.ticket_tier_id);
                    const tierLabel = tier ? (isBn ? (tier.label_bn || tier.label_en) : (tier.label_en || tier.label_bn)) : '—';
                    return (
                      <tr key={v.id} className="border-b border-border/10 hover:bg-primary/5 transition-colors">
                        <td className="px-4 py-3"><p className="text-sm font-medium text-foreground">{v.name}</p><p className="text-xs text-foreground/40">{v.profession}</p></td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs text-foreground/70 ${isBn ? 'font-bengali' : ''}`}>{tierLabel}</span>
                            {v.includes_concert && <Music className="w-3 h-3 text-saffron" />}
                          </div>
                          {v.ticket_price != null && <span className="text-xs text-primary/60 font-semibold">৳{v.ticket_price}</span>}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell"><p className="text-sm text-foreground/70">{v.mobile}</p></td>
                        <td className="px-4 py-3 hidden sm:table-cell"><p className="text-xs font-mono text-primary/70">{v.qr_code_id}</p></td>
                        <td className="px-4 py-3">
                          {v.payment_status === 'Paid' ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald/15 text-emerald text-xs font-semibold"><CheckCircle2 className="w-3 h-3" /> {t.agent.paid}</span> : <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-saffron/15 text-saffron text-xs font-semibold"><Clock className="w-3 h-3" /> {t.agent.pending}</span>}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {v.entry_status && !v.exited_status ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald/15 text-emerald text-xs font-semibold"><CheckCircle2 className="w-3 h-3" /> {t.agent.entered}</span>
                          ) : v.exited_status ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-foreground/10 text-foreground/50 text-xs font-semibold"><DoorOpen className="w-3 h-3" /> {t.admin.exited}</span>
                          ) : (
                            <span className="text-xs text-foreground/40">{t.agent.notEntered}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-1 flex-wrap justify-end">
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
                            {v.entry_status && !v.exited_status && (
                              <button onClick={() => markExited(v)} disabled={actionLoading === v.id} className="px-2.5 py-1.5 rounded-lg bg-foreground/10 text-foreground/70 text-xs font-semibold hover:bg-foreground/20 transition-all disabled:opacity-50">
                                {actionLoading === v.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><DoorOpen className="w-3 h-3" /> {t.admin.markExited}</>}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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

      {/* Ticket Tiers Tab */}
      {activeTab === 'tickets' && (
        <div className="glass-strong rounded-2xl border border-border/30 overflow-hidden">
          <div className="p-4 border-b border-border/20 flex items-center justify-between flex-wrap gap-3">
            <h2 className={`font-semibold text-primary flex items-center gap-2 ${isBn ? 'font-bengali' : ''}`}><Ticket className="w-4 h-4" /> {t.admin.ticketTiers}</h2>
            <button onClick={openAddTier} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/15 text-primary text-sm font-semibold hover:bg-primary/25 transition-all">
              <Ticket className="w-4 h-4" /> {t.admin.addTier}
            </button>
          </div>
          {tierLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/20">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">{isBn ? 'দিন' : 'Day'}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">{isBn ? 'সময়' : 'Time'}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">{t.admin.tierPrice}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider hidden sm:table-cell">{t.admin.concertAccess}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider hidden sm:table-cell">{isBn ? 'লেবেল' : 'Label'}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">{isBn ? 'স্ট্যাটাস' : 'Status'}</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((tier) => (
                    <tr key={tier.id} className="border-b border-border/10 hover:bg-primary/5 transition-colors">
                      <td className="px-4 py-3"><p className="text-sm font-medium text-foreground">{isBn ? (tier.label_bn || tier.label_en) : (tier.label_en || tier.label_bn)}</p></td>
                      <td className="px-4 py-3"><p className="text-xs text-foreground/70">{tier.day}</p><p className="text-xs text-foreground/40">{formatTime(tier.start_time)} – {formatTime(tier.end_time)}</p></td>
                      <td className="px-4 py-3"><p className="text-sm font-bold text-primary">৳ {tier.price}</p></td>
                      <td className="px-4 py-3 hidden sm:table-cell">{tier.includes_concert ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-saffron/15 text-saffron text-xs font-semibold"><Music className="w-3 h-3" /> {t.admin.active}</span> : <span className="text-xs text-foreground/40">—</span>}</td>
                      <td className="px-4 py-3 hidden sm:table-cell"><p className="text-xs text-foreground/60">{tier.label_en}</p><p className="text-xs text-foreground/40">{tier.label_bn}</p></td>
                      <td className="px-4 py-3">{tier.is_active ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald/15 text-emerald text-xs font-semibold">{t.admin.active}</span> : <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-foreground/10 text-foreground/50 text-xs font-semibold">{t.admin.inactive}</span>}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <button onClick={() => openEditTier(tier)} className="px-2.5 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-semibold hover:bg-primary/25 transition-all">{t.admin.crud.edit}</button>
                          <button onClick={() => deleteTier(tier)} className="px-2.5 py-1.5 rounded-lg bg-destructive/15 text-destructive text-xs font-semibold hover:bg-destructive/25 transition-all">{t.admin.crud.delete}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tier Form Modal */}
      {showTierForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/50" onClick={() => setShowTierForm(false)}>
          <div className="glass-strong rounded-2xl border border-border/30 max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 pb-4 shrink-0">
              <h3 className={`font-display text-lg font-bold text-primary ${isBn ? 'font-bengali' : ''}`}>{editingTier ? t.admin.editTier : t.admin.addTier}</h3>
            </div>
            <div className="px-6 pb-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className={`block text-sm font-medium text-foreground/80 mb-2 ${isBn ? 'font-bengali' : ''}`}>{isBn ? 'দিন' : 'Day'}</label>
                <select value={tierForm.day} onChange={(e) => setTierForm({ ...tierForm, day: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border/40 text-foreground outline-none focus:border-primary/40">
                  <option value="Thursday">Thursday</option><option value="Friday">Friday</option><option value="Saturday">Saturday</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm font-medium text-foreground/80 mb-2 ${isBn ? 'font-bengali' : ''}`}>{isBn ? 'শুরু' : 'Start'}</label>
                  <input type="time" value={tierForm.start_time} onChange={(e) => setTierForm({ ...tierForm, start_time: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border/40 text-foreground outline-none focus:border-primary/40" />
                </div>
                <div>
                  <label className={`block text-sm font-medium text-foreground/80 mb-2 ${isBn ? 'font-bengali' : ''}`}>{isBn ? 'শেষ' : 'End'}</label>
                  <input type="time" value={tierForm.end_time} onChange={(e) => setTierForm({ ...tierForm, end_time: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border/40 text-foreground outline-none focus:border-primary/40" />
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium text-foreground/80 mb-2 ${isBn ? 'font-bengali' : ''}`}>{t.admin.tierPrice}</label>
                <input type="number" value={tierForm.price} onChange={(e) => setTierForm({ ...tierForm, price: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border/40 text-foreground outline-none focus:border-primary/40" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="concert" checked={tierForm.includes_concert} onChange={(e) => setTierForm({ ...tierForm, includes_concert: e.target.checked })} className="w-4 h-4 rounded" />
                <label htmlFor="concert" className={`text-sm text-foreground/80 flex items-center gap-1 ${isBn ? 'font-bengali' : ''}`}><Music className="w-4 h-4 text-saffron" /> {t.admin.concertAccess}</label>
              </div>
              <div>
                <label className={`block text-sm font-medium text-foreground/80 mb-2 ${isBn ? 'font-bengali' : ''}`}>{isBn ? 'লেবেল (ইংরেজি)' : 'Label (English)'}</label>
                <input type="text" value={tierForm.label_en} onChange={(e) => setTierForm({ ...tierForm, label_en: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border/40 text-foreground outline-none focus:border-primary/40" />
              </div>
              <div>
                <label className={`block text-sm font-medium text-foreground/80 mb-2 ${isBn ? 'font-bengali' : ''}`}>{isBn ? 'লেবেল (বাংলা)' : 'Label (Bengali)'}</label>
                <input type="text" value={tierForm.label_bn} onChange={(e) => setTierForm({ ...tierForm, label_bn: e.target.value })} className={`w-full px-4 py-2.5 rounded-xl bg-input border border-border/40 text-foreground outline-none focus:border-primary/40 ${isBn ? 'font-bengali' : ''}`} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="active" checked={tierForm.is_active} onChange={(e) => setTierForm({ ...tierForm, is_active: e.target.checked })} className="w-4 h-4 rounded" />
                <label htmlFor="active" className={`text-sm text-foreground/80 ${isBn ? 'font-bengali' : ''}`}>{t.admin.active}</label>
              </div>
              <div>
                <label className={`block text-sm font-medium text-foreground/80 mb-2 ${isBn ? 'font-bengali' : ''}`}>{isBn ? 'ক্রম' : 'Order'}</label>
                <input type="number" value={tierForm.display_order} onChange={(e) => setTierForm({ ...tierForm, display_order: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border/40 text-foreground outline-none focus:border-primary/40" />
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-4 border-t border-border/20 shrink-0">
              <button onClick={() => setShowTierForm(false)} className={`flex-1 px-4 py-2.5 rounded-xl glass border border-border/40 text-foreground/70 font-medium text-sm hover:border-border/60 transition-all ${isBn ? 'font-bengali' : ''}`}>{t.admin.crud.cancel}</button>
              <button onClick={handleSaveTier} disabled={tierSaving} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-gold text-white font-bold text-sm shadow-gold transition-all disabled:opacity-50">
                {tierSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {t.admin.crud.save}
              </button>
            </div>
          </div>
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
