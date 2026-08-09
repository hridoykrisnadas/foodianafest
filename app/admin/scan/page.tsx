'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '@/lib/language-context';
import { supabase } from '@/lib/supabase';
import { QrCode, Camera, CameraOff, Search, CheckCircle2, XCircle, AlertCircle, Loader2, User, Phone, Briefcase, Clock, ListChecks, RefreshCw, ArrowLeft, Lock } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import Link from 'next/link';

type Visitor = {
  id: string; qr_code_id: string; name: string; mobile: string; profession: string;
  payment_status: string; entry_status: boolean; checked_in_at: string | null;
};

type ScanRecord = { qr_code_id: string; name: string; status: 'paid' | 'pending' | 'entered' | 'not_found'; time: string };

const ADMIN_PASSWORD = 'foodiana2026';

export default function ScanPage() {
  const { t, lang } = useLanguage();
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [manualId, setManualId] = useState('');
  const [recentScans, setRecentScans] = useState<ScanRecord[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerDivId = 'qr-reader';
  const isBn = lang === 'bn';

  useEffect(() => {
    const saved = sessionStorage.getItem('foodiana-admin-authed');
    if (saved === 'true') setAuthed(true);
  }, []);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setAuthed(true);
      setAuthError(false);
      sessionStorage.setItem('foodiana-admin-authed', 'true');
    } else {
      setAuthError(true);
    }
  };

  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); await scannerRef.current.clear(); } catch { /* stopped */ }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => { return () => { stopCamera(); }; }, [stopCamera]);

  const addScanRecord = (qrId: string, name: string, status: ScanRecord['status']) => {
    setRecentScans((prev) => [{ qr_code_id: qrId, name, status, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)]);
  };

  const lookupVisitor = useCallback(async (qrId: string) => {
    setLookupError(null); setActionMessage(null);
    const cleanId = qrId.trim().toUpperCase();
    if (!cleanId) return;
    const { data, error } = await supabase.from('visitors')
      .select('id, qr_code_id, name, mobile, profession, payment_status, entry_status, checked_in_at')
      .eq('qr_code_id', cleanId).maybeSingle();
    if (error || !data) {
      setVisitor(null); setLookupError(t.agent.visitorNotFound); addScanRecord(cleanId, '—', 'not_found'); return;
    }
    const v = data as Visitor;
    setVisitor(v);
    addScanRecord(cleanId, v.name, v.entry_status ? 'entered' : v.payment_status === 'Paid' ? 'paid' : 'pending');
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

  const markPaidAndAllowEntry = async () => {
    if (!visitor) return;
    setProcessing(true); setActionMessage(null);
    try {
      const { error } = await supabase.from('visitors')
        .update({ payment_status: 'Paid', entry_status: true, checked_in_at: new Date().toISOString() }).eq('id', visitor.id);
      if (error) throw error;
      setVisitor({ ...visitor, payment_status: 'Paid', entry_status: true, checked_in_at: new Date().toISOString() });
      setActionMessage(t.agent.verified);
    } catch { setActionMessage('Failed to update. Try again.'); }
    finally { setProcessing(false); }
  };

  const clearVisitor = () => { setVisitor(null); setLookupError(null); setActionMessage(null); };

  const statusBadge = (v: Visitor) => {
    if (v.entry_status) return <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald/15 border border-emerald/30"><CheckCircle2 className="w-4 h-4 text-emerald" /><span className="text-sm font-semibold text-emerald">{t.agent.entered}</span></div>;
    if (v.payment_status === 'Paid') return <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald/15 border border-emerald/30"><CheckCircle2 className="w-4 h-4 text-emerald" /><span className="text-sm font-semibold text-emerald">{t.agent.paid}</span></div>;
    return <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-saffron/15 border border-saffron/30"><Clock className="w-4 h-4 text-saffron" /><span className="text-sm font-semibold text-saffron">{t.agent.pending}</span></div>;
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

  return (
    <div className="min-h-[85vh] max-w-2xl mx-auto px-4 py-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-primary/20 mb-3">
          <QrCode className="w-4 h-4 text-primary" />
          <span className={`text-xs font-medium text-primary tracking-wider uppercase ${isBn ? 'font-bengali' : ''}`}>{t.agent.title}</span>
        </div>
        <p className={`text-sm text-foreground/60 ${isBn ? 'font-bengali' : ''}`}>{t.agent.subtitle}</p>
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
            </div>
            <div className="mt-4 pt-4 border-t border-border/20"><p className="text-xs text-foreground/50 mb-1">{t.success.yourId}</p><p className="text-lg font-bold text-primary font-display tracking-wider">{visitor.qr_code_id}</p></div>
          </div>

          {visitor.entry_status ? (
            <div className="glass-strong rounded-2xl p-6 border border-emerald/30 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald/15 flex items-center justify-center mx-auto mb-3"><CheckCircle2 className="w-9 h-9 text-emerald" /></div>
              <p className={`text-lg font-bold text-emerald ${isBn ? 'font-bengali' : ''}`}>{t.agent.alreadyEntered}</p>
            </div>
          ) : visitor.payment_status === 'Paid' ? (
            <div className="glass-strong rounded-2xl p-6 border border-emerald/30 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald/15 flex items-center justify-center mx-auto mb-3 animate-glow-pulse"><CheckCircle2 className="w-9 h-9 text-emerald" /></div>
              <p className={`text-xl font-bold text-emerald mb-4 ${isBn ? 'font-bengali' : ''}`}>{t.agent.verified}</p>
              <button onClick={markPaidAndAllowEntry} disabled={processing} className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald text-white font-bold text-sm hover:bg-emerald/90 transition-all disabled:opacity-50">
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {t.agent.markPaid}
              </button>
            </div>
          ) : (
            <div className="glass-strong rounded-2xl p-6 border border-saffron/30">
              <div className="flex items-center gap-2 mb-4"><AlertCircle className="w-5 h-5 text-saffron" /><p className={`text-sm text-saffron ${isBn ? 'font-bengali' : ''}`}>{t.agent.collectPayment}</p></div>
              <button onClick={markPaidAndAllowEntry} disabled={processing} className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-gold text-white font-bold text-sm shadow-gold hover:shadow-gold-lg transition-all disabled:opacity-50">
                {processing ? (<><Loader2 className="w-4 h-4 animate-spin" />{t.agent.processing}</>) : (<><CheckCircle2 className="w-4 h-4" />{t.agent.markPaid}</>)}
              </button>
            </div>
          )}

          {actionMessage && <div className="glass-strong rounded-2xl p-4 border border-emerald/30 text-center"><p className={`text-sm font-semibold text-emerald ${isBn ? 'font-bengali' : ''}`}>{actionMessage}</p></div>}
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
