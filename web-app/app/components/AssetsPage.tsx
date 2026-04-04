'use client';

import { useState } from 'react';
import { Asset, CATEGORY_GROUPS, getCategoryColor } from '../lib/types';
import { getAssets, addAsset, updateAsset, deleteAsset, addPriceRecord, setPriceHistory, getPriceHistory } from '../lib/store';

export default function AssetsPage({ onRefresh }: { onRefresh: () => void }) {
  const [assets, setAssets] = useState(getAssets);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const reload = () => { setAssets(getAssets()); onRefresh(); };

  const totalValue = assets.reduce((s, a) => s + a.quantity * a.currentPrice, 0);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">إدارة الأصول</h1>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>+ إضافة أصل</button>
      </div>

      {assets.length === 0 ? (
        <div className="text-center text-gray-400 py-16">
          <div className="text-5xl mb-4">📈</div>
          <div className="text-lg">لا توجد أصول - اضغط &quot;إضافة أصل&quot; للبدء</div>
        </div>
      ) : (
        assets.map(a => (
          <AssetCard
            key={a.id}
            asset={a}
            totalValue={totalValue}
            isEditing={editId === a.id}
            onEdit={() => setEditId(editId === a.id ? null : a.id)}
            onUpdate={(updated) => { updateAsset(updated); reload(); }}
            onDelete={() => { deleteAsset(a.id); reload(); }}
            onPriceUpdate={(price) => {
              updateAsset({ ...a, currentPrice: price });
              addPriceRecord(a.id, { date: new Date().toISOString().split('T')[0], close: price });
              reload();
            }}
            onReload={reload}
          />
        ))
      )}

      {showAdd && (
        <AddAssetModal
          onClose={() => setShowAdd(false)}
          onAdd={(asset) => { addAsset(asset); reload(); setShowAdd(false); }}
        />
      )}
    </div>
  );
}

function AssetCard({ asset: a, totalValue, isEditing, onEdit, onUpdate, onDelete, onPriceUpdate, onReload }: {
  asset: Asset; totalValue: number; isEditing: boolean;
  onEdit: () => void; onUpdate: (a: Asset) => void;
  onDelete: () => void; onPriceUpdate: (price: number) => void;
  onReload: () => void;
}) {
  const [newPrice, setNewPrice] = useState('');
  const [csvStatus, setCsvStatus] = useState('');
  const val = a.quantity * a.currentPrice;
  const pl = val - a.quantity * a.purchasePrice;
  const plPct = a.purchasePrice > 0 ? ((a.currentPrice - a.purchasePrice) / a.purchasePrice) * 100 : 0;
  const weight = totalValue > 0 ? (val / totalValue) * 100 : 0;
  const isPos = pl >= 0;

  // عدد السجلات التاريخية المحفوظة
  const historyCount = getPriceHistory(a.id).length;

  // استيراد CSV للأسعار التاريخية
  const importCSV = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const lines = text.trim().split('\n');
      const records: { date: string; close: number }[] = [];

      // تحديد أعمدة CSV
      const header = lines[0].toLowerCase().split(',');
      let dateCol = header.indexOf('date');
      let closeCol = header.indexOf('close');
      if (dateCol === -1) dateCol = 0;
      if (closeCol === -1) closeCol = header.length > 4 ? 4 : 1;

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length <= closeCol) continue;
        const date = cols[dateCol]?.trim();
        const price = parseFloat(cols[closeCol]);
        if (date && !isNaN(price) && price > 0) {
          records.push({ date, close: price });
        }
      }

      if (records.length === 0) {
        setCsvStatus('لم يتم العثور على بيانات صالحة في الملف');
        return;
      }

      // حفظ البيانات مربوطة بالأصل
      setPriceHistory(a.id, records);

      // تحديث السعر الحالي بآخر سعر في الملف
      const lastPrice = records[records.length - 1].close;
      updateAsset({ ...a, currentPrice: lastPrice });

      setCsvStatus(`تم استيراد ${records.length} سجل بنجاح ✓`);
      onReload();

      // مسح الرسالة بعد 3 ثواني
      setTimeout(() => setCsvStatus(''), 3000);
    };
    input.click();
  };

  return (
    <div className="card mb-3">
      <div className="flex items-center gap-3 cursor-pointer" onClick={onEdit}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
          style={{ background: getCategoryColor(a.category) }}>
          {a.name.slice(0, 2)}
        </div>
        <div className="flex-1">
          <div className="font-bold">{a.name}</div>
          <div className="text-xs text-gray-500">{a.category} | {weight.toFixed(1)}% من المحفظة</div>
        </div>
        <div className="text-left">
          <div className="font-bold">${val.toFixed(2)}</div>
          <div className={`text-xs font-bold ${isPos ? 'text-green-600' : 'text-red-600'}`}>
            {isPos ? '+' : ''}{plPct.toFixed(1)}%
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
            <div>الكمية: <b>{a.quantity}</b></div>
            <div>سعر الشراء: <b>${a.purchasePrice.toFixed(2)}</b></div>
            <div>السعر الحالي: <b>${a.currentPrice.toFixed(2)}</b></div>
            <div>الربح/الخسارة: <b className={isPos ? 'text-green-600' : 'text-red-600'}>${pl.toFixed(2)}</b></div>
            <div>تاريخ الشراء: <b>{a.purchaseDate}</b></div>
            <div>الوزن المستهدف: <b>{(a.targetWeight * 100).toFixed(0)}%</b></div>
          </div>

          {/* البيانات التاريخية */}
          <div className="mb-3 p-3 rounded-lg" style={{ background: historyCount >= 50 ? 'var(--primary-bg)' : 'var(--warning-bg)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm">
                <b>البيانات التاريخية:</b> {historyCount} سجل
                {historyCount < 50 && <span className="text-orange-600 mr-1"> (يحتاج 50 على الأقل للإشارات)</span>}
                {historyCount >= 50 && <span className="text-green-600 mr-1"> ✓ كافية للإشارات</span>}
              </div>
            </div>
            <button className="btn-outline text-sm w-full" onClick={importCSV}>
              📁 استيراد أسعار تاريخية (CSV)
            </button>
            {csvStatus && (
              <div className={`text-xs mt-2 text-center font-bold ${csvStatus.includes('✓') ? 'text-green-600' : 'text-red-600'}`}>
                {csvStatus}
              </div>
            )}
          </div>

          {/* تحديث السعر */}
          <div className="flex gap-2 mb-3">
            <input className="input flex-1" type="number" placeholder="السعر الجديد" value={newPrice}
              onChange={e => setNewPrice(e.target.value)} />
            <button className="btn-primary text-sm" onClick={() => {
              const p = parseFloat(newPrice);
              if (p > 0) { onPriceUpdate(p); setNewPrice(''); }
            }}>تحديث السعر</button>
          </div>

          <button className="btn-danger text-sm" onClick={() => { if (confirm('هل تريد حذف هذا الأصل؟')) onDelete(); }}>
            حذف الأصل
          </button>
        </div>
      )}
    </div>
  );
}

function AddAssetModal({ onClose, onAdd }: { onClose: () => void; onAdd: (a: Asset) => void }) {
  const [form, setForm] = useState({ name: '', category: 'أسهم محلية', quantity: '', price: '', weight: '' });

  const handleSubmit = () => {
    if (!form.name || !form.quantity || !form.price) return alert('يرجى ملء جميع الحقول');
    onAdd({
      id: '',
      name: form.name.toUpperCase(),
      category: form.category,
      quantity: parseFloat(form.quantity),
      purchasePrice: parseFloat(form.price),
      purchaseDate: new Date().toISOString().split('T')[0],
      currentPrice: parseFloat(form.price),
      targetWeight: (parseFloat(form.weight) || 0) / 100,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="card max-w-md w-full" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">إضافة أصل جديد</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-sm font-bold">اسم الأصل</label>
            <input className="input" placeholder="مثال: AAPL" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-bold">الفئة</label>
            <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {Object.values(CATEGORY_GROUPS).map(g => (
                <optgroup key={g.label} label={g.label}>
                  {g.categories.map(c => <option key={c} value={c}>{c}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-bold">الكمية</label>
            <input className="input" type="number" placeholder="10" value={form.quantity}
              onChange={e => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-bold">سعر الشراء</label>
            <input className="input" type="number" placeholder="150.00" value={form.price}
              onChange={e => setForm({ ...form, price: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-bold">الوزن المستهدف (%)</label>
            <input className="input" type="number" placeholder="20" value={form.weight}
              onChange={e => setForm({ ...form, weight: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button className="btn-outline flex-1" onClick={onClose}>إلغاء</button>
          <button className="btn-primary flex-1" onClick={handleSubmit}>إضافة</button>
        </div>
      </div>
    </div>
  );
}
