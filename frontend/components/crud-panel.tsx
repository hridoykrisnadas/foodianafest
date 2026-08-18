'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/lib/language-context';
import { ApiError, api, type ContentRecord, type ContentTable } from '@/lib/api';
import { Plus, Pencil, Trash2, X, Loader2, AlertCircle } from 'lucide-react';

export type CrudConfig = {
  /** Real table name, which is also the backend content endpoint segment. */
  table: ContentTable;
  labelKey: string;
  fields: { key: string; label: string; type: 'text' | 'select' | 'textarea'; options?: { value: string; label: string }[] }[];
};

type Item = ContentRecord;

export default function CrudPanel({ config }: { config: CrudConfig }) {
  const { t, lang } = useLanguage();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Item | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isBn = lang === 'bn';

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items: rows } = await api.admin.content.list(config.table);
      setItems(rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this list.');
    } finally {
      setLoading(false);
    }
  }, [config.table]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openAdd = () => {
    setEditing(null);
    const empty: Record<string, string> = {};
    config.fields.forEach((f) => { empty[f.key] = ''; });
    setFormData(empty);
    setShowForm(true);
  };

  const openEdit = (item: Item) => {
    setEditing(item);
    const data: Record<string, string> = {};
    config.fields.forEach((f) => { data[f.key] = (item[f.key] as string) || ''; });
    setFormData(data);
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const payload: Record<string, unknown> = {};
    config.fields.forEach((f) => { payload[f.key] = formData[f.key] || null; });

    try {
      if (editing) {
        await api.admin.content.update(config.table, editing.id, payload);
      } else {
        // display_order is appended server-side.
        await api.admin.content.create(config.table, payload);
      }
      await fetchItems();
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Item) => {
    if (!confirm(t.admin.crud.confirmDelete)) return;
    setError(null);
    try {
      await api.admin.content.remove(config.table, item.id);
      await fetchItems();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete. Please try again.');
    }
  };

  const label = (key: string) => {
    const labels: Record<string, string> = {
      guests: t.admin.crud.guests, advisors: t.admin.crud.advisors,
      management_members: t.admin.crud.management, sponsors: t.admin.crud.sponsors,
      brand_stalls: t.admin.crud.brands,
    };
    return labels[key] || key;
  };

  const displayName = (item: Item) => {
    const field = isBn ? 'name_bn' : 'name_en';
    return (item[field] as string) || (item.name as string) || '?';
  };

  const displayField = (item: Item, bnKey: string, enKey: string, fallbackKey?: string) => {
    const field = isBn ? bnKey : enKey;
    return (item[field] as string) || (fallbackKey ? (item[fallbackKey] as string) : null);
  };

  const displayCategory = (item: Item) => {
    const bn = displayField(item, 'category_bn', 'category_en', 'category');
    if (bn) return bn;
    const cat = item.category as string;
    if (!cat) return null;
    return cat === 'TITLE' ? t.admin.crud.titleSponsor : cat === 'CO' ? t.admin.crud.coSponsor : t.admin.crud.partner;
  };

  const displayType = (item: Item) => {
    const type = item.type as string;
    if (!type) return null;
    return type === 'CHIEF' ? t.admin.crud.chief : t.admin.crud.special;
  };

  return (
    <div className="glass-strong rounded-2xl border border-border/30 overflow-hidden">
      <div className="p-4 border-b border-border/20 flex items-center justify-between">
        <h3 className={`font-semibold text-primary ${isBn ? 'font-bengali' : ''}`}>{label(config.table)}</h3>
        <button onClick={openAdd} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/15 text-primary text-xs font-semibold hover:bg-primary/25 transition-all">
          <Plus className="w-4 h-4" /> {t.admin.crud.add}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 mx-4 mt-4 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="w-8 h-8 text-foreground/30 mb-2" />
          <p className={`text-sm text-foreground/40 ${isBn ? 'font-bengali' : ''}`}>{t.admin.crud.noData}</p>
        </div>
      ) : (
        <div className="divide-y divide-border/10">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-4 hover:bg-primary/5 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                {item.image_url ? (
                  <img src={item.image_url as string} alt={displayName(item)} className="w-10 h-10 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="font-display text-sm font-bold text-primary">{displayName(item).charAt(0)}</span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{displayName(item)}</p>
                  <p className="text-xs text-foreground/40 truncate">
                    {[
                      displayField(item, 'designation_bn', 'designation_en', 'designation'),
                      displayField(item, 'title_bn', 'title_en', 'title'),
                      displayField(item, 'role_bn', 'role_en', 'role'),
                      displayField(item, 'organization_bn', 'organization_en', 'organization'),
                      displayCategory(item),
                      displayType(item),
                      item.contact,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => openEdit(item)} className="p-2 rounded-lg text-foreground/50 hover:text-primary hover:bg-primary/10 transition-all"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(item)} className="p-2 rounded-lg text-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-all"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/50" onClick={() => setShowForm(false)}>
          <div className="glass-strong rounded-2xl border border-border/30 max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 pb-4 shrink-0">
              <h3 className={`font-display text-lg font-bold text-primary ${isBn ? 'font-bengali' : ''}`}>
                {editing ? t.admin.crud.edit : t.admin.crud.add}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg text-foreground/50 hover:text-foreground transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 pb-4 space-y-4 overflow-y-auto flex-1">
              {config.fields.map((field) => (
                <div key={field.key}>
                  <label className={`block text-sm font-medium text-foreground/80 mb-2 ${isBn ? 'font-bengali' : ''}`}>{field.label}</label>
                  {field.type === 'select' ? (
                    <select value={formData[field.key] || ''} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      className={`w-full px-4 py-2.5 rounded-xl bg-input border border-border/40 text-foreground outline-none focus:border-primary/40 ${isBn ? 'font-bengali' : ''}`}>
                      <option value="">—</option>
                      {field.options?.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea value={formData[field.key] || ''} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })} rows={3}
                      className={`w-full px-4 py-2.5 rounded-xl bg-input border border-border/40 text-foreground outline-none focus:border-primary/40 resize-none ${isBn ? 'font-bengali' : ''}`} />
                  ) : (
                    <input type="text" value={formData[field.key] || ''} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      className={`w-full px-4 py-2.5 rounded-xl bg-input border border-border/40 text-foreground outline-none focus:border-primary/40 ${isBn ? 'font-bengali' : ''}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-3 p-6 pt-4 border-t border-border/20 shrink-0">
              <button onClick={() => setShowForm(false)} className={`flex-1 px-4 py-2.5 rounded-xl glass border border-border/40 text-foreground/70 font-medium text-sm hover:border-border/60 transition-all ${isBn ? 'font-bengali' : ''}`}>{t.admin.crud.cancel}</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-gold text-white font-bold text-sm shadow-gold transition-all disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {t.admin.crud.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
