'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '@/lib/language-context';
import { supabase } from '@/lib/supabase';
import { QrCode, Camera, CameraOff, Search, CheckCircle2, XCircle, AlertCircle, Loader2, User, Phone, Briefcase, Clock, ListChecks, RefreshCw, ArrowLeft, Lock, Music, DoorOpen, UsersRound, Ticket } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import Link from 'next/link';

type Visitor = {
  id: string; qr_code_id: string; name: string; mobile: string; profession: string;
  payment_status: string; entry_status: boolean; checked_in_at: string | null;
  ticket_tier_id: string | null; ticket_price: number | null; includes_concert: boolean;
  exited_status: boolean; exited_at: string | null;
};

type TicketTier = {
  id: string; day: string; start_time: string; end_time: string;
  price: number; includes_concert: boolean; label_en: string; label_bn: string;
};

type ScanRecord = { qr_code_id: string; name: string; status: 'paid' | 'pending' | 'entered' | 'not_found' | 'exited' | 'already_exited'; time: string };

type CrowdMetrics = { insideNow: number; capacity: number; available: number; isFull: boolean };

const ADMIN_PASSWORD = 'foodiana2026';

export default function ScanPage() {
  const { t, lang } = useLanguage();
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [visitorTier, setVisitorTier] = useState<TicketTier | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [manualId, setManualId] = useState('');
  const [recentScans, setRecentScans] = useState<ScanRecord[]>([]);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [scanMode, setScanMode] = useState<'entry' | 'exit'>('entry');
  const [crowd, setCrowd] = useState<CrowdMetrics>({ insideNow: 0, capacity: 2000, available: 2000, isFull: false });
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerDivId = 'qr-reader';
  const isBn = lang === 'bn';

  useEffect(() => {
    const saved = sessionStorage.getItem('foodiana-admin-authed');
    if (saved === 'true') setAuthed(true);
  }, []);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) { setAuthed(true); setAuthError(false); sessionStorage.setItem('foodiana-admin-authed', 'true'); } else { setAuthError(true); }
  };

  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); await scannerRef.current.clear(); } catch { /* stopped */ }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => { return () => { stopCamera(); }; }, [stopCamera]);

  const fetchCrowd = useCallback(async () => {
    const { count: insideNow } = await supabase.from('visitors').select('*', { count: 'exact', head: true }).eq('entry_status', true).eq('exited_status', false);
    const { data: settings } = await supabase.from('event_settings').select('ground_capacity').eq('id', 1).maybeSingle();
    const cap = settings?.ground_capacity || 2000;
    const inside = insideNow || 0;
    setCrowd({ insideNow: inside, capacity: cap, available: Math.max(0, cap - inside), isFull: inside >= cap });
  }, []);

  useEffect(() => {
    if (authed) {
      fetchCrowd();
      const interval = setInterval(fetchCrowd, 5000);
      return () => clearInterval(interval);
    }
  }, [authed, fetchCrowd]);

  const addScanRecord = (qrId: string, name: string, status: ScanRecord['status']) => {
    setRecentScans((prev) => [{ qr_code_id: qrId, name, status, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)]);
  };

  const lookupVisitor = useCallback(async (qrId: string) => {
    setLookupError(null); setActionMessage(null); setVisitorTier(null);
    const cleanId = qrId.trim().toUpperCase();
    if (!cleanId) return;
    const { data, error } = await supabase.from('visitors')
      .select('id, qr_code_id, name, mobile, profession, payment_status, entry_status, checked_in_at, ticket_tier_id, ticket_price, includes_concert, exited_status, exited_at')
      .eq('qr_code_id', cleanId).maybeSingle();
    if (error || !data) {
      setVisitor(null); setLookupError(t.agent.visitorNotFound); addScanRecord(cleanId, '—', 'not_found'); return;
    }
    const v = data as Visitor;
    setVisitor(v);
    if (v.ticket_tier_id) {
      const { data: tierData } = await supabase.from('ticket_tiers').select('*').eq('id', v.ticket_tier_id).maybeSingle();
      if (tierData) setVisitorTier(tierData as TicketTier);
    }
    let status: ScanRecord['status'] = 'pending';
    if (v.exited_status) status = 'already_exited';
    else if (v.entry_status) status = 'entered';
    else if (v.payment_status === 'Paid') status = 'paid';
    addScanRecord(cleanId, v.name, status);
  }, [t]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const scanner = new Html5Qrcode(scannerDivId);
      scannerRef.current = scanner;
      await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => { lookupVisitor(decodedText); stopCamera(); }, () => {});
      setScanning(true);
    } catch { setCameraError(t.agent.cameraError); setScanning(false); }
  };

  const handleManualLookup = () => { if (manualId.trim()) { lookupVisitor(manualId); setManualId(''); } };

  const handleEntry = async () => {
    if (!visitor) return;
    if (crowd.isFull) {
      setActionMessage({ type: 'error', text: t.agent.capacityFull });
      return;
    }
    setProcessing(true); setActionMessage(null);
    try {
      const { error } = await supabase.from('visitors')
        .update({ payment_status: 'Paid', entry_status: true, checked_in_at: new Date().toISOString() }).eq('id', visitor.id);
      if (error) throw error;
      setVisitor({ ...visitor, payment_status: 'Paid', entry_status: true, checked_in_at: new Date().toISOString() });
      setActionMessage({ type: 'success', text: t.agent.verified });
      fetchCrowd();
    } catch {
      setActionMessage({ type: 'error', text: 'Failed to update. Try again.' });
    } finally { setProcessing(false); }
  };

  const handleExit = async () => {
    if (!visitor) return;
    if (!visitor.entry_status) {
      setActionMessage({ type: 'error', text: isBn ? 'এই ব্যক্তি এখনও প্রবেশ করেননি' : 'This person has not entered yet' });
      return;
    }
    if (visitor.exited_status) {
      setActionMessage({ type: 'info', text: t.agent.alreadyExited });
      return;
    }
    setProcessing(true); setActionMessage(null);
    try {
      const { error } = await supabase.from('visitors')
        .update({ exited_status: true, exited_at: new Date().toISOString() }).eq('id', visitor.id);
      if (error) throw error;
      setVisitor({ ...visitor, exited_status: true, exited_at: new Date().toISOString() });
      setActionMessage({ type: 'success', text: t.agent.exitConfirmed });
      fetchCrowd();
    } catch {
      setActionMessage({ type: 'error', text: 'Failed to update. Try again.' });
    } finally { setProcessing(false); }
  };

  const clearVisitor = () => { setVisitor(null); setVisitorTier(null); setLookupError(null); setActionMessage(null); };

  const formatTime = (time: string) => {
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${m} ${period}`;
  };

  const statusBadge = (v: Visitor) => {
    if (v.exited_status) return <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-foreground/10 border border-foreground/20"><DoorOpen className="w-4 h-4 text-foreground/60" /><span className={`text-sm font-semibold text-foreground/60 ${isBn ? 'font-bengali' : ''}`}>{t.agent.exited}</span></div>;
    if (v.entry_status) return <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald/15 border border-emerald/30"><CheckCircle2 className="w-4 h-4 text-emerald" /><span className={`text-sm font-semibold text-emerald ${isBn ? 'font-bengali' : ''}`}>{t.agent.entered}</span></div>;
    if (v.payment_status === 'Paid') return <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald/15 border border-emerald/30"><CheckCircle2 className="w-4 h-4 text-emerald" /><span className={`text-sm font-semibold text-emerald ${isBn ? 'font-bengali' : ''}`}>{t.agent.paid}</span></div>;
    return <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-saffron/15 border border-saffron/30"><Clock className="w-4 h-4 text-saffron" /><span className={`text-sm font-semibold text-saffron ${isBn ? 'font-bengali' : ''}`}>{t.agent.pending}</span></div>;
  };

  // Auth gate
  if (!authed) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-sm w-full animate-fade-in-up">
          <div className="glass-strong rounded-2xl p-8 border border-border/30 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5"><Lock className="w-9 h-9 text-primary" /></div>
            <h1 className={`font-display text-2xl font-bold text-primary mb-2 ${isBn ? 'font-bengali' : ''}`}>{t.admin.signIn}</h1>
            <p className={`text-sm text-foreground/50 mb-6 ${isBn ? 'font-bengali' : ''}`}>{t.agent.accessDenied}</p>
            <form onSubmit={handleAuth} className="space-y-4 text-left">
              <div>
                <label className={`block text-sm font-medium text-foreground/80 mb-2 ${isBn ? 'font-bengali' : ''}`}>{t.admin.password}</label>
                <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setAuthError(false); }} autoFocus
                  className={`w-full px-4 py-3 rounded-xl bg-input border text-foreground placeholder:text-foreground/30 outline-none focus:ring-2 focus:ring-primary/30 ${authError ? 'border-destructive' : 'border-border/40 focus:border-primary/40'}`} placeholder="••••••••" />
                {authError && <p className={`mt-1.5 text-xs text-destructive ${isBn ? 'font-bengali' : ''}`}>{t.admin.invalidCreds}</p>}
              </div>
              <button type="submit" className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-gold text-white font-bold text-sm shadow-gold hover:shadow-gold-lg transition-all">
                <Lock className="w-4 h-4" /> {t.admin.signInBtn}
              </button>
            </form>
            <Link href="/admin" className={`mt-4 inline-flex items-center gap-1.5 text-sm text-foreground/50 hover:text-primary transition-colors ${isBn ? 'font-bengali' : ''}`}>
              <ArrowLeft className="w-4 h-4" /> {t.agent.backToAdmin}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const crowdPct = Math.min(100, Math.round((crowd.insideNow / crowd.capacity) * 100));

  return (
    <div className="min-h-[85vh] max-w-2xl mx-auto px-4 py-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-primary/20 mb-3">
          <QrCode className="w-4 h-4 text-primary" />
          <span className={`text-xs font-medium text-primary tracking-wider uppercase ${isBn ? 'font-bengali' : ''}`}>{t.agent.title}</span>
        </div>
        <p className={`text-sm text-foreground/60 ${isBn ? 'font-bengali' : ''}`}>{t.agent.subtitle}</p>
      </div>

      {/* Crowd Control Display */}
      <div className={`glass-strong rounded-2xl p-5 border mb-4 ${crowd.isFull ? 'border-destructive/40' : 'border-border/30'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <UsersRound className={`w-5 h-5 ${crowd.isFull ? 'text-destructive' : 'text-primary'}`} />
            <span className={`text-sm font-semibold ${crowd.isFull ? 'text-destructive' : 'text-primary'} ${isBn ? 'font-bengali' : ''}`}>{t.agent.insideNow}</span>
          </div>
          <span className={`text-2xl font-bold font-display ${crowd.isFull ? 'text-destructive' : 'text-primary'}`}>{crowd.insideNow} / {crowd.capacity}</span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-secondary/40 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${crowdPct >= 90 ? 'bg-destructive' : crowdPct >= 75 ? 'bg-saffron' : 'bg-emerald'}`} style={{ width: `${crowdPct}%` }} />
        </div>
        {crowd.isFull && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
            <p className={`text-xs text-destructive font-semibold ${isBn ? 'font-bengali' : ''}`}>{t.agent.capacityFull}</p>
          </div>
        )}
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => { setScanMode('entry'); clearVisitor(); }} className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${scanMode === 'entry' ? 'bg-emerald text-white shadow-gold' : 'glass border border-border/40 text-foreground/60'}`}>
          <CheckCircle2 className="w-4 h-4" /> {t.agent.entryMode}
        </button>
        <button onClick={() => { setScanMode('exit'); clearVisitor(); }} className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${scanMode === 'exit' ? 'bg-destructive text-white' : 'glass border border-border/40 text-foreground/60'}`}>
          <DoorOpen className="w-4 h-4" /> {t.agent.exitMode}
        </button>
      </div>

      {!visitor && (
        <div className="glass-strong rounded-2xl p-6 border border-border/30 mb-4">
          <div id={scannerDivId} className="w-full rounded-xl overflow-hidden bg-black/40 min-h-[200px] flex items-center justify-center" />
          {cameraError && (
            <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30"><AlertCircle className="w-4 h-4 text-destructive shrink-0" /><p className="text-xs text-destructive">{cameraError}</p></div>
          )}
          <div className="mt-4 flex gap-3">
            {!scanning ? (
              <button onClick={startCamera} className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-gold text-white font-bold text-sm shadow-gold transition-all"><Camera className="w-5 h-5" /> {t.agent.startCamera}</button>
            ) : (
              <button onClick={stopCamera} className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl glass border border-border/40 text-primary font-semibold text-sm transition-all"><CameraOff className="w-5 h-5" /> {t.agent.stopCamera}</button>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-border/20">
            <p className={`text-xs text-foreground/50 mb-2 ${isBn ? 'font-bengali' : ''}`}>{t.agent.manualEntry}</p>
            <div className="flex gap-2">
              <input type="text" value={manualId} onChange={(e) => setManualId(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleManualLookup()} placeholder={t.agent.manualPlaceholder}
                className={`flex-1 px-4 py-2.5 rounded-xl bg-input border border-border/40 text-foreground placeholder:text-foreground/30 outline-none focus:border-primary/40 ${isBn ? 'font-bengali' : ''}`} />
              <button onClick={handleManualLookup} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl glass border border-border/40 text-primary font-semibold text-sm hover:border-primary/40 transition-all"><Search className="w-4 h-4" /> {t.agent.lookup}</button>
            </div>
          </div>
          {lookupError && (
            <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30"><XCircle className="w-4 h-4 text-destructive shrink-0" /><p className={`text-sm text-destructive ${isBn ? 'font-bengali' : ''}`}>{lookupError}</p></div>
          )}
        </div>
      )}

      {visitor && (
        <div className="animate-scale-in space-y-4">
          <div className="glass-strong rounded-2xl p-6 border border-border/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-primary" /><span className={`font-semibold text-primary ${isBn ? 'font-bengali' : ''}`}>{t.agent.visitorFound}</span></div>
              {statusBadge(visitor)}
            </div>
            <div className="space-y-3">
              {[{ icon: User, label: t.agent.name, value: visitor.name }, { icon: Phone, label: t.agent.mobile, value: visitor.mobile }, { icon: Briefcase, label: t.agent.profession, value: visitor.profession }].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-primary" /></div>
                    <div><p className="text-xs text-foreground/50">{item.label}</p><p className="text-base font-semibold text-foreground">{item.value}</p></div>
                  </div>
                );
              })}
              {visitorTier && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-saffron/10 flex items-center justify-center shrink-0"><Ticket className="w-5 h-5 text-saffron" /></div>
                  <div>
                    <p className="text-xs text-foreground/50">{t.agent.ticketTier}</p>
                    <p className="text-sm font-semibold text-foreground">{isBn ? (visitorTier.label_bn || visitorTier.label_en) : (visitorTier.label_en || visitorTier.label_bn)}</p>
                    <p className="text-xs text-foreground/40">{visitorTier.day} · {formatTime(visitorTier.start_time)} – {formatTime(visitorTier.end_time)} · ৳{visitorTier.price}</p>
                  </div>
                  {visitor.includes_concert && <div className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md bg-saffron/15 border border-saffron/30"><Music className="w-3.5 h-3.5 text-saffron" /><span className={`text-xs font-semibold text-saffron ${isBn ? 'font-bengali' : ''}`}>{t.agent.concertAccess}</span></div>}
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-border/20"><p className="text-xs text-foreground/50 mb-1">{t.success.yourId}</p><p className="text-lg font-bold text-primary font-display tracking-wider">{visitor.qr_code_id}</p></div>
          </div>

          {/* Entry Mode Actions */}
          {scanMode === 'entry' && (
            <>
              {visitor.exited_status ? (
                <div className="glass-strong rounded-2xl p-6 border border-foreground/20 text-center">
                  <div className="w-16 h-16 rounded-full bg-foreground/10 flex items-center justify-center mx-auto mb-3"><DoorOpen className="w-9 h-9 text-foreground/50" /></div>
                  <p className={`text-lg font-bold text-foreground/60 ${isBn ? 'font-bengali' : ''}`}>{t.agent.alreadyExited}</p>
                </div>
              ) : visitor.entry_status ? (
                <div className="glass-strong rounded-2xl p-6 border border-emerald/30 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald/15 flex items-center justify-center mx-auto mb-3"><CheckCircle2 className="w-9 h-9 text-emerald" /></div>
                  <p className={`text-lg font-bold text-emerald ${isBn ? 'font-bengali' : ''}`}>{t.agent.alreadyEntered}</p>
                </div>
              ) : visitor.payment_status === 'Paid' ? (
                <div className="glass-strong rounded-2xl p-6 border border-emerald/30 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald/15 flex items-center justify-center mx-auto mb-3 animate-glow-pulse"><CheckCircle2 className="w-9 h-9 text-emerald" /></div>
                  <p className={`text-xl font-bold text-emerald mb-4 ${isBn ? 'font-bengali' : ''}`}>{t.agent.verified}</p>
                  {crowd.isFull ? (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30 mb-4">
                      <AlertCircle className="w-4 h-4 text-destructive shrink-0" /><p className={`text-sm text-destructive font-semibold ${isBn ? 'font-bengali' : ''}`}>{t.agent.capacityFull}</p>
                    </div>
                  ) : (
                    <button onClick={handleEntry} disabled={processing} className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald text-white font-bold text-sm hover:bg-emerald/90 transition-all disabled:opacity-50">
                      {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {t.agent.markPaid}
                    </button>
                  )}
                </div>
              ) : (
                <div className="glass-strong rounded-2xl p-6 border border-saffron/30">
                  <div className="flex items-center gap-2 mb-4"><AlertCircle className="w-5 h-5 text-saffron" /><p className={`text-sm text-saffron ${isBn ? 'font-bengali' : ''}`}>{t.agent.collectPayment}</p></div>
                  {crowd.isFull && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 mb-4">
                      <AlertCircle className="w-4 h-4 text-destructive shrink-0" /><p className={`text-xs text-destructive font-semibold ${isBn ? 'font-bengali' : ''}`}>{t.agent.capacityFull}</p>
                    </div>
                  )}
                  <button onClick={handleEntry} disabled={processing || crowd.isFull} className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-gold text-white font-bold text-sm shadow-gold hover:shadow-gold-lg transition-all disabled:opacity-50">
                    {processing ? (<><Loader2 className="w-4 h-4 animate-spin" />{t.agent.processing}</>) : (<><CheckCircle2 className="w-4 h-4" />{t.agent.markPaid}</>)}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Exit Mode Actions */}
          {scanMode === 'exit' && (
            <>
              {visitor.exited_status ? (
                <div className="glass-strong rounded-2xl p-6 border border-foreground/20 text-center">
                  <div className="w-16 h-16 rounded-full bg-foreground/10 flex items-center justify-center mx-auto mb-3"><DoorOpen className="w-9 h-9 text-foreground/50" /></div>
                  <p className={`text-lg font-bold text-foreground/60 ${isBn ? 'font-bengali' : ''}`}>{t.agent.alreadyExited}</p>
                </div>
              ) : visitor.entry_status ? (
                <div className="glass-strong rounded-2xl p-6 border border-destructive/30 text-center">
                  <div className="w-16 h-16 rounded-full bg-destructive/15 flex items-center justify-center mx-auto mb-3 animate-glow-pulse"><DoorOpen className="w-9 h-9 text-destructive" /></div>
                  <p className={`text-xl font-bold text-foreground mb-4 ${isBn ? 'font-bengali' : ''}`}>{t.agent.markExit}</p>
                  <button onClick={handleExit} disabled={processing} className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-destructive text-white font-bold text-sm hover:bg-destructive/90 transition-all disabled:opacity-50">
                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <DoorOpen className="w-4 h-4" />} {t.agent.markExit}
                  </button>
                </div>
              ) : (
                <div className="glass-strong rounded-2xl p-6 border border-saffron/30 text-center">
                  <div className="w-16 h-16 rounded-full bg-saffron/15 flex items-center justify-center mx-auto mb-3"><AlertCircle className="w-9 h-9 text-saffron" /></div>
                  <p className={`text-lg font-bold text-saffron ${isBn ? 'font-bengali' : ''}`}>{isBn ? 'এই ব্যক্তি এখনও প্রবেশ করেননি' : 'This person has not entered yet'}</p>
                </div>
              )}
            </>
          )}

          {actionMessage && (
            <div className={`glass-strong rounded-2xl p-4 border text-center ${actionMessage.type === 'success' ? 'border-emerald/30' : actionMessage.type === 'error' ? 'border-destructive/30' : 'border-foreground/20'}`}>
              <p className={`text-sm font-semibold ${actionMessage.type === 'success' ? 'text-emerald' : actionMessage.type === 'error' ? 'text-destructive' : 'text-foreground/60'} ${isBn ? 'font-bengali' : ''}`}>{actionMessage.text}</p>
            </div>
          )}
          <button onClick={clearVisitor} className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl glass border border-border/30 text-foreground/70 font-medium text-sm hover:border-primary/40 transition-all"><RefreshCw className="w-4 h-4" /> {t.agent.scanPrompt}</button>
        </div>
      )}

      {!visitor && recentScans.length > 0 && (
        <div className="glass rounded-2xl p-5 border border-border/20">
          <div className="flex items-center gap-2 mb-3"><ListChecks className="w-4 h-4 text-primary" /><h3 className={`text-sm font-semibold text-primary ${isBn ? 'font-bengali' : ''}`}>{t.agent.recentScans}</h3></div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {recentScans.map((scan, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-2 min-w-0">
                  {scan.status === 'paid' && <CheckCircle2 className="w-4 h-4 text-emerald shrink-0" />}
                  {scan.status === 'entered' && <CheckCircle2 className="w-4 h-4 text-emerald shrink-0" />}
                  {scan.status === 'pending' && <Clock className="w-4 h-4 text-saffron shrink-0" />}
                  {scan.status === 'not_found' && <XCircle className="w-4 h-4 text-destructive shrink-0" />}
                  {scan.status === 'exited' && <DoorOpen className="w-4 h-4 text-foreground/50 shrink-0" />}
                  {scan.status === 'already_exited' && <DoorOpen className="w-4 h-4 text-foreground/50 shrink-0" />}
                  <div className="min-w-0"><p className="text-xs font-medium text-foreground truncate">{scan.name}</p><p className="text-xs text-foreground/40">{scan.qr_code_id}</p></div>
                </div>
                <span className="text-xs text-foreground/40 shrink-0">{scan.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
