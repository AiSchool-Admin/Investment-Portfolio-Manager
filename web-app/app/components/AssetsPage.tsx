'use client';

import { useState } from 'react';
import { Asset, CATEGORY_GROUPS, getCategoryColor, FUNDING_SOURCES, RECEIVING_DESTINATIONS } from '../lib/types';
import { getAssets, addAsset, updateAsset, deleteAsset, addPriceRecord, setPriceHistory, getPriceHistory, addTrade, getProfile, saveProfile } from '../lib/store';

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
            onReload={reload}
          />
        ))
      )}

      {showAdd && (
        <AssetFormModal
          title="إضافة أصل جديد"
          onClose={() => setShowAdd(false)}
          onSave={(asset) => { addAsset(asset); reload(); setShowAdd(false); }}
        />
      )}
    </div>
  );
}

function AssetCard({ asset: a, totalValue, isEditing, onEdit, onUpdate, onDelete, onReload }: {
  asset: Asset; totalValue: number; isEditing: boolean;
  onEdit: () => void; onUpdate: (a: Asset) => void;
  onDelete: () => void; onReload: () => void;
}) {
  const [newPrice, setNewPrice] = useState('');
  const [csvStatus, setCsvStatus] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [previewData, setPreviewData] = useState<{ date: string; close: number }[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [tradeMode, setTradeMode] = useState<'none' | 'buy' | 'sell'>('none');
  const [tradeQty, setTradeQty] = useState('');
  const [tradePrice, setTradePrice] = useState('');
  const [tradeValue, setTradeValue] = useState('');
  const [fundingSource, setFundingSource] = useState('cash'); // مصدر التمويل
  const [tradeNotes, setTradeNotes] = useState('');
  const val = a.quantity * a.currentPrice;
  const pl = val - a.quantity * a.purchasePrice;
  const plPct = a.purchasePrice > 0 ? ((a.currentPrice - a.purchasePrice) / a.purchasePrice) * 100 : 0;
  const weight = totalValue > 0 ? (val / totalValue) * 100 : 0;
  const isPos = pl >= 0;

  const historyCount = getPriceHistory(a.id).length;

  // قراءة CSV → عرض معاينة (بدون حفظ)
  const loadCSVForPreview = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.txt';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const lines = text.trim().split('\n');
      const records: { date: string; close: number }[] = [];

      // محاولة تحديد الفاصل (فاصلة أو تاب)
      const separator = lines[0].includes('\t') ? '\t' : ',';
      const header = lines[0].toLowerCase().split(separator).map(h => h.trim());
      let dateCol = header.findIndex(h => h.includes('date') || h.includes('تاريخ'));
      let closeCol = header.findIndex(h => h.includes('close') || h.includes('value') || h.includes('price') || h.includes('قيمة') || h.includes('سعر'));
      if (dateCol === -1) dateCol = 0;
      if (closeCol === -1) closeCol = header.length > 4 ? 4 : 1;

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(separator).map(c => c.trim());
        if (cols.length <= Math.max(dateCol, closeCol)) continue;
        const date = cols[dateCol];
        const priceStr = cols[closeCol]?.replace(/[^\d.-]/g, '');
        const price = parseFloat(priceStr);
        if (date && !isNaN(price) && price > 0) records.push({ date, close: price });
      }

      if (records.length === 0) {
        setCsvStatus('لم يتم العثور على بيانات صالحة في الملف');
        return;
      }

      records.sort((a, b) => a.date.localeCompare(b.date));
      setPreviewData(records);
      setCsvStatus('');
    };
    input.click();
  };

  // تأكيد حفظ البيانات المعاينة
  const confirmSavePreview = () => {
    if (!previewData || previewData.length === 0) return;
    setPriceHistory(a.id, previewData);
    const lastPrice = previewData[previewData.length - 1].close;
    updateAsset({ ...a, currentPrice: lastPrice });
    setCsvStatus(`تم حفظ ${previewData.length} سجل ✓`);
    setPreviewData(null);
    onReload();
    setTimeout(() => setCsvStatus(''), 3000);
  };

  // مسح البيانات التاريخية
  const clearHistory = () => {
    if (!confirm(`هل تريد مسح كل البيانات التاريخية لـ "${a.name}"؟\nعدد السجلات: ${historyCount}`)) return;
    setPriceHistory(a.id, []);
    setCsvStatus('تم مسح البيانات التاريخية');
    onReload();
    setTimeout(() => setCsvStatus(''), 3000);
  };

  // عرض البيانات التاريخية الحالية
  const currentHistory = showHistory ? getPriceHistory(a.id) : [];

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
          {/* معلومات الأصل */}
          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
            <div className="flex justify-between"><span>الكمية:</span><b>{a.quantity}</b></div>
            <div className="flex justify-between"><span>سعر الشراء:</span><b>${a.purchasePrice.toFixed(2)}</b></div>
            <div className="flex justify-between"><span>السعر الحالي:</span><b>${a.currentPrice.toFixed(2)}</b></div>
            <div className="flex justify-between"><span>الربح/الخسارة:</span><b className={isPos ? 'text-green-600' : 'text-red-600'}>${pl.toFixed(2)}</b></div>
            <div className="flex justify-between"><span>تاريخ الشراء:</span><b>{a.purchaseDate}</b></div>
            <div className="flex justify-between"><span>الوزن المستهدف:</span><b>{(a.targetWeight * 100).toFixed(0)}%</b></div>
          </div>

          {/* أزرار الإجراءات */}
          <div className="flex gap-2 mb-3">
            <button className="text-sm flex-1 px-3 py-2 rounded bg-green-600 text-white cursor-pointer hover:bg-green-700"
              onClick={() => { setTradeMode('buy'); setTradePrice(a.currentPrice.toString()); setTradeQty(''); setTradeValue(''); }}>
              ↓ شراء / إضافة دفعة
            </button>
            <button className="text-sm flex-1 px-3 py-2 rounded bg-red-600 text-white cursor-pointer hover:bg-red-700"
              onClick={() => { setTradeMode('sell'); setTradePrice(a.currentPrice.toString()); setTradeQty(''); setTradeValue(''); }}>
              ↑ بيع / جني أرباح
            </button>
            <button className="btn-outline text-sm" onClick={() => setShowEditModal(true)}>
              تعديل
            </button>
          </div>

          {/* نموذج شراء/بيع */}
          {tradeMode !== 'none' && (
            <div className={`mb-3 p-3 rounded-lg border-2 ${tradeMode === 'buy' ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'}`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-sm">
                  {tradeMode === 'buy' ? '↓ شراء / إضافة دفعة استثمارية' : '↑ بيع / جني أرباح'}
                </h4>
                <button className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer" onClick={() => setTradeMode('none')}>✕</button>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-xs font-bold block mb-0.5">سعر التنفيذ</label>
                  <input className="input text-sm" type="number" step="any" placeholder={a.currentPrice.toString()}
                    value={tradePrice} onChange={e => setTradePrice(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-0.5">الكمية (وحدات)</label>
                  <input className="input text-sm" type="number" step="any" placeholder="الكمية"
                    value={tradeQty} onChange={e => {
                      setTradeQty(e.target.value);
                      const q = parseFloat(e.target.value);
                      const p = parseFloat(tradePrice) || a.currentPrice;
                      if (q > 0) setTradeValue((q * p).toFixed(2));
                    }} />
                </div>
              </div>

              <div className="mb-2">
                <label className="text-xs font-bold block mb-0.5">أو أدخل القيمة الإجمالية ($)</label>
                <input className="input text-sm" type="number" step="any" placeholder="المبلغ الإجمالي"
                  value={tradeValue} onChange={e => {
                    setTradeValue(e.target.value);
                    const v = parseFloat(e.target.value);
                    const p = parseFloat(tradePrice) || a.currentPrice;
                    if (v > 0 && p > 0) setTradeQty((v / p).toFixed(6));
                  }} />
              </div>

              {/* ملخص */}
              {(parseFloat(tradeQty) > 0 || parseFloat(tradeValue) > 0) && (
                <div className="text-xs bg-white rounded p-2 mb-2">
                  <div className="flex justify-between">
                    <span>الكمية:</span>
                    <b>{parseFloat(tradeQty || '0').toFixed(4)} وحدة</b>
                  </div>
                  <div className="flex justify-between">
                    <span>السعر:</span>
                    <b>${(parseFloat(tradePrice) || a.currentPrice).toFixed(4)}</b>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>القيمة الإجمالية:</span>
                    <b>${parseFloat(tradeValue || '0').toFixed(2)}</b>
                  </div>
                  {tradeMode === 'buy' && (
                    <div className="flex justify-between text-gray-500 mt-1">
                      <span>الكمية بعد الشراء:</span>
                      <b>{(a.quantity + parseFloat(tradeQty || '0')).toFixed(4)}</b>
                    </div>
                  )}
                  {tradeMode === 'sell' && (
                    <>
                      <div className="flex justify-between text-gray-500 mt-1">
                        <span>الكمية بعد البيع:</span>
                        <b>{Math.max(0, a.quantity - parseFloat(tradeQty || '0')).toFixed(4)}</b>
                      </div>
                      {a.purchasePrice > 0 && (
                        <div className="flex justify-between mt-1">
                          <span>الربح/الخسارة:</span>
                          {(() => {
                            const sellPrice = parseFloat(tradePrice) || a.currentPrice;
                            const profit = (sellPrice - a.purchasePrice) * parseFloat(tradeQty || '0');
                            return <b className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
                            </b>;
                          })()}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* أزرار سريعة للبيع */}
              {tradeMode === 'sell' && a.quantity > 0 && (
                <div className="flex gap-1 mb-2">
                  <span className="text-xs text-gray-400 leading-6">بيع:</span>
                  {[25, 50, 75, 100].map(pct => (
                    <button key={pct} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-100 cursor-pointer"
                      onClick={() => {
                        const q = a.quantity * pct / 100;
                        const p = parseFloat(tradePrice) || a.currentPrice;
                        setTradeQty(q.toFixed(6));
                        setTradeValue((q * p).toFixed(2));
                      }}>
                      {pct}%
                    </button>
                  ))}
                </div>
              )}

              {/* مصدر التمويل / وعاء الاستلام */}
              <div className="mb-2">
                <label className="text-xs font-bold block mb-0.5">
                  {tradeMode === 'buy' ? 'مصدر التمويل' : 'وعاء الاستلام'}
                </label>
                <select className="input text-sm" value={fundingSource}
                  onChange={e => setFundingSource(e.target.value)}>
                  {(tradeMode === 'buy' ? FUNDING_SOURCES : RECEIVING_DESTINATIONS).map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                {fundingSource === 'cash' && tradeMode === 'buy' && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    النقد المتاح: <b>${(getProfile()?.availableCash ?? 0).toFixed(2)}</b>
                  </div>
                )}
              </div>

              {/* ملاحظات */}
              <div className="mb-2">
                <label className="text-xs font-bold block mb-0.5">ملاحظات (اختياري)</label>
                <input className="input text-sm" placeholder="مثال: دفعة DCA شهرية"
                  value={tradeNotes} onChange={e => setTradeNotes(e.target.value)} />
              </div>

              <button
                className={`w-full text-sm py-2 rounded text-white cursor-pointer font-bold ${
                  tradeMode === 'buy' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
                onClick={() => {
                  const qty = parseFloat(tradeQty);
                  const price = parseFloat(tradePrice) || a.currentPrice;
                  if (!qty || qty <= 0) return alert('أدخل الكمية أو القيمة');
                  if (tradeMode === 'sell' && qty > a.quantity) return alert(`لا يمكن بيع أكثر من ${a.quantity} وحدة`);

                  const totalVal = qty * price;
                  const sourceLabel = tradeMode === 'buy'
                    ? FUNDING_SOURCES.find(s => s.value === fundingSource)?.label
                    : RECEIVING_DESTINATIONS.find(s => s.value === fundingSource)?.label;

                  // تحقق: هل النقد كافي إذا كان المصدر = النقدية
                  if (tradeMode === 'buy' && fundingSource === 'cash') {
                    const currentCash = getProfile()?.availableCash ?? 0;
                    if (totalVal > currentCash) {
                      return alert(`النقد المتاح ($${currentCash.toFixed(2)}) أقل من قيمة الشراء ($${totalVal.toFixed(2)})`);
                    }
                  }

                  // تسجيل الصفقة
                  addTrade({
                    assetId: a.id, assetName: a.name,
                    type: tradeMode, quantity: qty, price,
                    totalValue: totalVal,
                    date: new Date().toISOString().split('T')[0],
                    source: `${sourceLabel}${tradeNotes ? ' | ' + tradeNotes : ''}`,
                    notes: tradeNotes,
                  });

                  // تحديث الأصل
                  const newQty = tradeMode === 'buy' ? a.quantity + qty : a.quantity - qty;
                  const newPurchasePrice = tradeMode === 'buy' && (a.quantity + qty) > 0
                    ? ((a.purchasePrice * a.quantity) + (price * qty)) / (a.quantity + qty)
                    : a.purchasePrice;
                  onUpdate({ ...a, quantity: Math.max(0, newQty), purchasePrice: newPurchasePrice, currentPrice: price });

                  // تحديث النقد حسب المصدر/الوعاء
                  const profile = getProfile();
                  if (profile) {
                    if (tradeMode === 'buy' && fundingSource === 'cash') {
                      // شراء من النقدية → خصم
                      saveProfile({ ...profile, availableCash: Math.max(0, profile.availableCash - totalVal) });
                    } else if (tradeMode === 'buy' && fundingSource !== 'cash') {
                      // شراء من مصدر خارجي → لا يُخصم من النقد (المال جاء من الخارج)
                    } else if (tradeMode === 'sell' && fundingSource === 'cash') {
                      // بيع → إضافة للنقدية
                      saveProfile({ ...profile, availableCash: profile.availableCash + totalVal });
                    } else if (tradeMode === 'sell' && fundingSource !== 'cash') {
                      // بيع → تحويل خارجي → لا يُضاف للنقد
                    }
                  }

                  addPriceRecord(a.id, { date: new Date().toISOString().split('T')[0], close: price });

                  setTradeMode('none');
                  setTradeNotes('');
                  setFundingSource('cash');
                  alert(`تم تسجيل ${tradeMode === 'buy' ? 'الشراء' : 'البيع'} بنجاح ✓\nالمصدر: ${sourceLabel}`);
                  onReload();
                }}
              >
                {tradeMode === 'buy' ? `تأكيد الشراء ✓` : `تأكيد البيع ✓`}
              </button>
            </div>
          )}

          {/* البيانات التاريخية */}
          <div className="mb-3 p-3 rounded-lg" style={{ background: historyCount >= 50 ? 'var(--primary-bg)' : 'var(--warning-bg)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm">
                <b>البيانات التاريخية:</b> {historyCount} سجل
                {historyCount < 50 && <span className="text-orange-600 mr-1"> (يحتاج 50+ للإشارات)</span>}
                {historyCount >= 50 && <span className="text-green-600 mr-1"> ✓ كافية</span>}
              </div>
            </div>

            <div className="flex gap-2 mb-2">
              <button className="btn-outline text-sm flex-1" onClick={loadCSVForPreview}>
                📁 استيراد CSV
              </button>
              {historyCount > 0 && (
                <>
                  <button className="text-sm px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setShowHistory(!showHistory)}>
                    {showHistory ? 'إخفاء' : '👁 عرض'}
                  </button>
                  <button className="text-sm px-3 py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                    onClick={clearHistory}>
                    🗑 مسح
                  </button>
                </>
              )}
            </div>

            {csvStatus && (
              <div className={`text-xs mt-1 text-center font-bold ${csvStatus.includes('✓') ? 'text-green-600' : csvStatus.includes('مسح') ? 'text-orange-600' : 'text-red-600'}`}>
                {csvStatus}
              </div>
            )}

            {/* عرض البيانات التاريخية الحالية */}
            {showHistory && currentHistory.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b"><th className="text-right p-1">التاريخ</th><th className="text-right p-1">السعر</th></tr>
                  </thead>
                  <tbody>
                    {currentHistory.slice(-30).reverse().map((r, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="p-1">{r.date}</td>
                        <td className="p-1 font-bold">{r.close.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {currentHistory.length > 30 && (
                  <div className="text-xs text-gray-400 text-center p-1">آخر 30 سجل من {currentHistory.length}</div>
                )}
              </div>
            )}
          </div>

          {/* معاينة البيانات قبل الحفظ */}
          {previewData && (
            <div className="mb-3 p-3 rounded-lg border-2 border-blue-400 bg-blue-50">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-sm">معاينة قبل الحفظ ({previewData.length} سجل)</h4>
                <div className="flex gap-2">
                  <button className="text-xs px-2 py-1 rounded bg-green-600 text-white cursor-pointer hover:bg-green-700"
                    onClick={confirmSavePreview}>
                    ✓ حفظ
                  </button>
                  <button className="text-xs px-2 py-1 rounded bg-gray-400 text-white cursor-pointer hover:bg-gray-500"
                    onClick={() => setPreviewData(null)}>
                    ✕ إلغاء
                  </button>
                </div>
              </div>

              {/* ملخص سريع */}
              <div className="grid grid-cols-4 gap-2 text-xs mb-2">
                <div className="bg-white p-1.5 rounded text-center">
                  <div className="text-gray-400">أول سعر</div>
                  <div className="font-bold">{previewData[0].close.toFixed(4)}</div>
                  <div className="text-gray-400">{previewData[0].date}</div>
                </div>
                <div className="bg-white p-1.5 rounded text-center">
                  <div className="text-gray-400">آخر سعر</div>
                  <div className="font-bold">{previewData[previewData.length - 1].close.toFixed(4)}</div>
                  <div className="text-gray-400">{previewData[previewData.length - 1].date}</div>
                </div>
                <div className="bg-white p-1.5 rounded text-center">
                  <div className="text-gray-400">أعلى</div>
                  <div className="font-bold text-green-600">{Math.max(...previewData.map(r => r.close)).toFixed(4)}</div>
                </div>
                <div className="bg-white p-1.5 rounded text-center">
                  <div className="text-gray-400">أدنى</div>
                  <div className="font-bold text-red-600">{Math.min(...previewData.map(r => r.close)).toFixed(4)}</div>
                </div>
              </div>

              {/* جدول معاينة */}
              <div className="max-h-40 overflow-y-auto bg-white rounded border border-blue-200">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b"><th className="text-right p-1">#</th><th className="text-right p-1">التاريخ</th><th className="text-right p-1">السعر</th></tr>
                  </thead>
                  <tbody>
                    {previewData.map((r, i) => (
                      <tr key={i} className={`border-b border-gray-50 ${i === 0 || i === previewData.length - 1 ? 'bg-yellow-50' : ''}`}>
                        <td className="p-1 text-gray-400">{i + 1}</td>
                        <td className="p-1">{r.date}</td>
                        <td className="p-1 font-bold">{r.close.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-xs text-blue-600 text-center mt-1 font-bold">
                راجع البيانات ثم اضغط "حفظ" أو "إلغاء"
              </div>
            </div>
          )}

          {/* تحديث السعر السريع */}
          <div className="flex gap-2 mb-3">
            <input className="input flex-1" type="number" placeholder="تحديث السعر الحالي" value={newPrice}
              onChange={e => setNewPrice(e.target.value)} />
            <button className="btn-outline text-sm" onClick={() => {
              const p = parseFloat(newPrice);
              if (p > 0) {
                updateAsset({ ...a, currentPrice: p });
                addPriceRecord(a.id, { date: new Date().toISOString().split('T')[0], close: p });
                onReload();
                setNewPrice('');
              }
            }}>تحديث</button>
          </div>

          <button className="text-sm px-3 py-2 rounded text-red-600 hover:bg-red-50 cursor-pointer w-full"
            onClick={() => { if (confirm(`هل تريد حذف الأصل "${a.name}"؟`)) onDelete(); }}>
            حذف الأصل
          </button>
        </div>
      )}

      {/* نافذة تعديل بيانات الأصل */}
      {showEditModal && (
        <AssetFormModal
          title={`تعديل ${a.name}`}
          initialData={a}
          onClose={() => setShowEditModal(false)}
          onSave={(updated) => {
            onUpdate({ ...a, ...updated, id: a.id });
            setShowEditModal(false);
          }}
        />
      )}
    </div>
  );
}

// ============ نافذة إضافة/تعديل أصل (مشتركة) ============

function AssetFormModal({ title, initialData, onClose, onSave }: {
  title: string;
  initialData?: Asset;
  onClose: () => void;
  onSave: (a: Asset) => void;
}) {
  const [form, setForm] = useState({
    name: initialData?.name || '',
    category: initialData?.category || 'أسهم محلية',
    quantity: initialData?.quantity?.toString() || '',
    purchasePrice: initialData?.purchasePrice?.toString() || '',
    currentPrice: initialData?.currentPrice?.toString() || '',
    purchaseDate: initialData?.purchaseDate || new Date().toISOString().split('T')[0],
    targetWeight: initialData ? (initialData.targetWeight * 100).toString() : '',
  });

  const handleSubmit = () => {
    if (!form.name || !form.quantity || !form.purchasePrice) return alert('يرجى ملء الحقول المطلوبة');
    const qty = parseFloat(form.quantity);
    const pp = parseFloat(form.purchasePrice);
    const cp = parseFloat(form.currentPrice) || pp;
    if (qty <= 0 || pp <= 0) return alert('الكمية والسعر يجب أن يكونا أكبر من صفر');

    onSave({
      id: initialData?.id || '',
      name: form.name.toUpperCase(),
      category: form.category,
      quantity: qty,
      purchasePrice: pp,
      purchaseDate: form.purchaseDate,
      currentPrice: cp,
      targetWeight: (parseFloat(form.targetWeight) || 0) / 100,
    });
  };

  const isEdit = !!initialData;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="card max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-sm font-bold">اسم الأصل *</label>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-bold">الكمية *</label>
              <input className="input" type="number" step="any" placeholder="10" value={form.quantity}
                onChange={e => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-bold">سعر الشراء *</label>
              <input className="input" type="number" step="any" placeholder="150.00" value={form.purchasePrice}
                onChange={e => setForm({ ...form, purchasePrice: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-bold">السعر الحالي</label>
              <input className="input" type="number" step="any" placeholder="السعر الحالي" value={form.currentPrice}
                onChange={e => setForm({ ...form, currentPrice: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-bold">تاريخ الشراء</label>
              <input className="input" type="date" value={form.purchaseDate}
                onChange={e => setForm({ ...form, purchaseDate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-sm font-bold">الوزن المستهدف (%)</label>
            <input className="input" type="number" step="1" placeholder="20" value={form.targetWeight}
              onChange={e => setForm({ ...form, targetWeight: e.target.value })} />
          </div>

          {/* ملخص */}
          {form.quantity && form.purchasePrice && (
            <div className="p-3 rounded-lg bg-gray-50 text-sm">
              <div className="flex justify-between">
                <span>تكلفة الشراء:</span>
                <b>${((parseFloat(form.quantity) || 0) * (parseFloat(form.purchasePrice) || 0)).toFixed(2)}</b>
              </div>
              {form.currentPrice && (
                <>
                  <div className="flex justify-between">
                    <span>القيمة الحالية:</span>
                    <b>${((parseFloat(form.quantity) || 0) * (parseFloat(form.currentPrice) || 0)).toFixed(2)}</b>
                  </div>
                  <div className="flex justify-between">
                    <span>الربح/الخسارة:</span>
                    {(() => {
                      const q = parseFloat(form.quantity) || 0;
                      const pp = parseFloat(form.purchasePrice) || 0;
                      const cp = parseFloat(form.currentPrice) || 0;
                      const diff = (cp - pp) * q;
                      return <b className={diff >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {diff >= 0 ? '+' : ''}${diff.toFixed(2)}
                      </b>;
                    })()}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-4">
          <button className="btn-outline flex-1" onClick={onClose}>إلغاء</button>
          <button className="btn-primary flex-1" onClick={handleSubmit}>
            {isEdit ? 'حفظ التعديلات' : 'إضافة'}
          </button>
        </div>
      </div>
    </div>
  );
}
