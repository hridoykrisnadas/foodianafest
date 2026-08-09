'use client';

import { useState, FormEvent } from 'react';
import { useLanguage } from '@/lib/language-context';
import { supabase } from '@/lib/supabase';
import { User, Phone, Mail, Calendar, Briefcase, ArrowRight, CheckCircle2, Download, RotateCcw, AlertCircle, Loader2 } from 'lucide-react';
import QRCode from 'react-qr-code';

type FormData = { name: string; mobile: string; email: string; dob: string; profession: string };
type FormErrors = Partial<Record<keyof FormData, string>>;

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
  const [formData, setFormData] = useState<FormData>({ name: '', mobile: '', email: '', dob: '', profession: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ qrId: string; name: string } | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const isBn = lang === 'bn';

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!formData.name.trim()) e.name = t.register.errors.name;
    if (!formData.mobile.trim() || formData.mobile.length < 10) e.mobile = t.register.errors.mobile;
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = t.register.errors.email;
    if (!formData.dob) e.dob = t.register.errors.dob;
    if (!formData.profession.trim()) e.profession = t.register.errors.profession;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    setDbError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const qrId = await createUniqueQrId();
      const { error } = await supabase.from('visitors').insert({
        qr_code_id: qrId, name: formData.name.trim(), email: formData.email.trim(),
        mobile: formData.mobile.trim(), dob: formData.dob, profession: formData.profession.trim(),
        payment_status: 'Pending', entry_status: false,
      });
      if (error) throw error;
      setSuccess({ qrId, name: formData.name.trim() });
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
    setFormData({ name: '', mobile: '', email: '', dob: '', profession: '' });
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

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full animate-scale-in">
          <div className="glass-strong rounded-3xl p-8 border border-primary/20 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald/15 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-9 h-9 text-emerald" />
            </div>
            <h1 className={`font-display text-3xl font-bold text-primary mb-2 ${isBn ? 'font-bengali' : ''}`}>{t.success.title}</h1>
            <p className={`text-sm text-foreground/60 mb-6 ${isBn ? 'font-bengali' : ''}`}>{t.success.subtitle}</p>
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

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full animate-fade-in-up">
        <div className="text-center mb-8">
          <h1 className={`font-display text-3xl md:text-4xl font-bold text-primary mb-2 ${isBn ? 'font-bengali' : ''}`}>{t.register.title}</h1>
          <p className={`text-sm text-foreground/60 ${isBn ? 'font-bengali' : ''}`}>{t.register.subtitle}</p>
        </div>
        <form onSubmit={handleSubmit} className="glass-strong rounded-2xl p-6 sm:p-8 border border-border/30 space-y-5">
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
          {dbError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0" /><p className="text-xs text-destructive">{dbError}</p>
            </div>
          )}
          <button type="submit" disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-gold text-white font-bold text-base shadow-gold hover:shadow-gold-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? (<><Loader2 className="w-5 h-5 animate-spin" />{t.register.submitting}</>) : (<>{t.register.submit}<ArrowRight className="w-5 h-5" /></>)}
          </button>
        </form>
      </div>
    </div>
  );
}
