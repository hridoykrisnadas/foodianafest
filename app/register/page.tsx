'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useLanguage } from '@/lib/language-context';
import { supabase } from '@/lib/supabase';
import { User, Phone, Mail, Calendar, Briefcase, ArrowRight, CheckCircle2, Download, RotateCcw, AlertCircle, Loader2, Ticket, Clock, Music, CreditCard, ShieldCheck } from 'lucide-react';
import QRCode from 'react-qr-code';

type FormData = { name: string; mobile: string; email: string; dob: string; profession: string; ticket_tier_id: string };
type FormErrors = Partial<Record<keyof FormData, string>>;

type TicketTier = {
  id: string; day: string; start_time: string; end_time: string;
  price: number; includes_concert: boolean; label_en: string; label_bn: string;
  is_active: boolean; display_order: number;
};

function generateQrId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'FDL-';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

async function createUniqueQrId(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = generateQrId();
    const { data } = await supabase.from('visitors').select('id').eq('qr_code_id', id).maybeSingle();
    if (!data) return id;
  }
  return generateQrId() + Date.now().toString(36).slice(-2);
}

export default function RegisterPage() {
  const { t, lang } = useLanguage();
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [formData, setFormData] = useState<FormData>({ name: '', mobile: '', email: '', dob: '', profession: '', ticket_tier_id: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ qrId: string; name: string; price: number; tierLabel: string } | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const isBn = lang === 'bn';

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('ticket_tiers').select('*').eq('is_active', true).order('display_order', { ascending: true });
      if (data) setTiers(data as TicketTier[]);
      setTiersLoading(false);
    })();
  }, []);

  const selectedTier = tiers.find((tier) => tier.id === formData.ticket_tier_id) || null;

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!formData.name.trim()) e.name = t.register.errors.name;
    if (!formData.mobile.trim() || formData.mobile.length < 10) e.mobile = t.register.errors.mobile;
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = t.register.errors.email;
    if (!formData.dob) e.dob = t.register.errors.dob;
    if (!formData.profession.trim()) e.profession = t.register.errors.profession;
    if (!formData.ticket_tier_id) e.ticket_tier_id = t.register.errors.tier;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    setDbError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const tier = tiers.find((t) => t.id === formData.ticket_tier_id);
      if (!tier) throw new Error('Invalid ticket tier');
      const qrId = await createUniqueQrId();
      const { error } = await supabase.from('visitors').insert({
        qr_code_id: qrId, name: formData.name.trim(), email: formData.email.trim(),
        mobile: formData.mobile.trim(), dob: formData.dob, profession: formData.profession.trim(),
        payment_status: 'Pending', entry_status: false,
        ticket_tier_id: tier.id, ticket_price: tier.price, includes_concert: tier.includes_concert,
      });
      if (error) throw error;
      setSuccess({
        qrId, name: formData.name.trim(), price: tier.price,
        tierLabel: isBn ? (tier.label_bn || tier.label_en || '') : (tier.label_en || tier.label_bn || ''),
      });
    } catch (err) {
      setDbError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) setErrors({ ...errors, [field]: undefined });
  };

  const resetForm = () => {
    setFormData({ name: '', mobile: '', email: '', dob: '', profession: '', ticket_tier_id: '' });
    setSuccess(null); setErrors({}); setDbError(null);
  };

  const downloadQr = () => {
    if (!success) return;
    const svg = document.querySelector('#qr-svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `foodiana-2026-${success.qrId}.svg`; a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (time: string) => {
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${m} ${period}`;
  };

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full animate-scale-in">
          <div className="glass-strong rounded-3xl p-8 border border-primary/20 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald/15 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-9 h-9 text-emerald" />
            </div>
            <h1 className={`font-display text-3xl font-bold text-primary mb-2 ${isBn ? 'font-bengali' : ''}`}>{t.success.title}</h1>
            <p className={`text-sm text-foreground/60 mb-4 ${isBn ? 'font-bengali' : ''}`}>{t.success.subtitle}</p>

            <div className="mb-4 px-4 py-3 rounded-xl bg-primary/10 border border-primary/20">
              <p className={`text-xs text-foreground/50 mb-1 ${isBn ? 'font-bengali' : ''}`}>{t.register.ticketTitle}</p>
              <p className={`text-sm font-semibold text-primary ${isBn ? 'font-bengali' : ''}`}>{success.tierLabel}</p>
              <p className="text-2xl font-bold text-primary font-display mt-1">৳ {success.price}</p>
            </div>

            <div className="bg-white p-6 rounded-2xl mb-6 inline-block">
              <QRCode id="qr-svg" value={success.qrId} size={200} level="H" />
            </div>
            <div className="mb-6">
              <p className={`text-xs text-foreground/50 mb-1 uppercase tracking-wider ${isBn ? 'font-bengali' : ''}`}>{t.success.yourId}</p>
              <p className="text-2xl font-bold text-primary font-display tracking-wider">{success.qrId}</p>
            </div>
            <div className="flex items-center justify-center gap-2 mb-6 px-4 py-3 rounded-xl bg-saffron/10 border border-saffron/30">
              <AlertCircle className="w-4 h-4 text-saffron shrink-0" />
              <p className={`text-xs text-saffron ${isBn ? 'font-bengali' : ''}`}>{t.success.pending}</p>
            </div>
            <p className={`text-sm text-foreground/60 mb-6 leading-relaxed ${isBn ? 'font-bengali' : ''}`}>{t.success.instructions}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={downloadQr} className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl glass border border-border/40 text-primary font-semibold text-sm hover:border-primary/40 transition-all">
                <Download className="w-4 h-4" /> {t.success.download}
              </button>
              <button onClick={resetForm} className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-gold text-white font-bold text-sm shadow-gold hover:shadow-gold-lg transition-all">
                <RotateCcw className="w-4 h-4" /> {t.success.registerAnother}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const fields: { key: keyof FormData; label: string; placeholder: string; icon: typeof User; type: string }[] = [
    { key: 'name', label: t.register.name, placeholder: t.register.namePlaceholder, icon: User, type: 'text' },
    { key: 'mobile', label: t.register.mobile, placeholder: t.register.mobilePlaceholder, icon: Phone, type: 'tel' },
    { key: 'email', label: t.register.email, placeholder: t.register.emailPlaceholder, icon: Mail, type: 'email' },
    { key: 'dob', label: t.register.dob, placeholder: '', icon: Calendar, type: 'date' },
    { key: 'profession', label: t.register.profession, placeholder: t.register.professionPlaceholder, icon: Briefcase, type: 'text' },
  ];

  const days = ['Thursday', 'Friday', 'Saturday'];
  const dayLabel: Record<string, string> = isBn
    ? { Thursday: 'বৃহস্পতিবার', Friday: 'শুক্রবার', Saturday: 'শনিবার' }
    : { Thursday: 'Thursday', Friday: 'Friday', Saturday: 'Saturday' };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full animate-fade-in-up">
        <div className="text-center mb-8">
          <h1 className={`font-display text-3xl md:text-4xl font-bold text-primary mb-2 ${isBn ? 'font-bengali' : ''}`}>{t.register.title}</h1>
          <p className={`text-sm text-foreground/60 ${isBn ? 'font-bengali' : ''}`}>{t.register.subtitle}</p>
        </div>
        <form onSubmit={handleSubmit} className="glass-strong rounded-2xl p-6 sm:p-8 border border-border/30 space-y-6">
          {/* Ticket Tier Selection */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Ticket className="w-5 h-5 text-primary" />
              <h3 className={`font-display text-lg font-bold text-primary ${isBn ? 'font-bengali' : ''}`}>{t.register.ticketTitle}</h3>
            </div>
            <p className={`text-xs text-foreground/50 mb-4 ${isBn ? 'font-bengali' : ''}`}>{t.register.ticketSubtitle}</p>
            {tiersLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
            ) : (
              <div className="space-y-4">
                {days.map((day) => {
                  const dayTiers = tiers.filter((tier) => tier.day === day);
                  if (dayTiers.length === 0) return null;
                  return (
                    <div key={day}>
                      <p className={`text-sm font-semibold text-foreground/70 mb-2 ${isBn ? 'font-bengali' : ''}`}>{dayLabel[day]}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {dayTiers.map((tier) => {
                          const isSelected = formData.ticket_tier_id === tier.id;
                          const tierLabel = isBn ? (tier.label_bn || tier.label_en) : (tier.label_en || tier.label_bn);
                          return (
                            <button
                              key={tier.id}
                              type="button"
                              onClick={() => handleChange('ticket_tier_id', tier.id)}
                              className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                                isSelected
                                  ? 'border-primary bg-primary/10 shadow-gold'
                                  : 'border-border/30 bg-input/50 hover:border-primary/40'
                              }`}
                            >
                              {isSelected && (
                                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                </div>
                              )}
                              <div className="flex items-start gap-2 mb-2">
                                <Clock className="w-4 h-4 text-primary/60 shrink-0 mt-0.5" />
                                <p className={`text-xs text-foreground/60 ${isBn ? 'font-bengali' : ''}`}>
                                  {formatTime(tier.start_time)} – {formatTime(tier.end_time)}
                                </p>
                              </div>
                              {tier.includes_concert && (
                                <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded-md bg-saffron/10 border border-saffron/20 inline-flex">
                                  <Music className="w-3.5 h-3.5 text-saffron" />
                                  <span className={`text-xs font-medium text-saffron ${isBn ? 'font-bengali' : ''}`}>{t.register.concert}</span>
                                </div>
                              )}
                              <p className={`text-sm font-semibold text-foreground mb-1 ${isBn ? 'font-bengali' : ''}`}>{tierLabel}</p>
                              <p className="text-2xl font-bold text-primary font-display">৳ {tier.price}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {errors.ticket_tier_id && <p className={`mt-2 text-xs text-destructive ${isBn ? 'font-bengali' : ''}`}>{errors.ticket_tier_id}</p>}
          </div>

          {/* Price Summary */}
          {selectedTier && (
            <div className="flex items-center justify-between px-5 py-4 rounded-xl bg-gradient-gold/10 border border-primary/20">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                <span className={`text-sm font-medium text-foreground/70 ${isBn ? 'font-bengali' : ''}`}>{t.register.price}</span>
              </div>
              <span className="text-2xl font-bold text-primary font-display">৳ {selectedTier.price}</span>
            </div>
          )}

          {/* Personal Info Fields */}
          <div className="space-y-5">
            {fields.map(({ key, label, placeholder, icon: Icon, type }) => (
              <div key={key}>
                <label className={`block text-sm font-medium text-foreground/80 mb-2 ${isBn ? 'font-bengali' : ''}`}>{label}</label>
                <div className="relative">
                  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/50" />
                  <input type={type} value={formData[key]} onChange={(e) => handleChange(key, e.target.value)} placeholder={placeholder}
                    className={`w-full pl-11 pr-4 py-3 rounded-xl bg-input border text-foreground placeholder:text-foreground/30 transition-all outline-none focus:ring-2 focus:ring-primary/30 ${errors[key] ? 'border-destructive' : 'border-border/40 focus:border-primary/40'} ${isBn ? 'font-bengali' : ''}`} />
                </div>
                {errors[key] && <p className={`mt-1.5 text-xs text-destructive ${isBn ? 'font-bengali' : ''}`}>{errors[key]}</p>}
              </div>
            ))}
          </div>

          {dbError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0" /><p className="text-xs text-destructive">{dbError}</p>
            </div>
          )}

          {/* Payment Notice */}
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary/5 border border-primary/20">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
            <p className={`text-xs text-foreground/60 ${isBn ? 'font-bengali' : ''}`}>
              {isBn
                ? 'নিবন্ধনের পর অনলাইন পেমেন্ট করুন অথবা গেটে টাকা পরিশোধ করুন। পেমেন্ট সম্পূর্ণ হলে আপনার QR কোড সক্রিয় হবে।'
                : 'Complete online payment or pay at the gate after registration. Your QR code will be activated once payment is confirmed.'}
            </p>
          </div>

          <button type="submit" disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-gold text-white font-bold text-base shadow-gold hover:shadow-gold-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? (<><Loader2 className="w-5 h-5 animate-spin" />{t.register.submitting}</>) : (<>{t.register.submit}<ArrowRight className="w-5 h-5" /></>)}
          </button>
        </form>
      </div>
    </div>
  );
}
