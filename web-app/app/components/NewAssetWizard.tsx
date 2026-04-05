'use client';

import { useState, useMemo } from 'react';
import { CATEGORY_GROUPS } from '../lib/types';
import { getProfile, getAssets, getSystemSettings, addAsset, addPlan, setPriceHistory } from '../lib/store';
import {
  calculateHalfKellyPositionSize,
  getDefaultHorizonDays,
  calculateMarketVolatility,
  createPositionBuildingPlan,
  computeOSFromPrices,
} from '../lib/positionBuilder';

interface Props {
  onComplete: () => void;
  onCancel: () => void;
}

export default function NewAssetWizard({ onComplete, onCancel }: Props) {
  const [step, setStep] = useState(0);

  // الخطوة 1: بيانات الأصل
  const [assetName, setAssetName] = useState('');
  const [assetCategory, setAssetCategory] = useState('أسهم محلية');

  // الخطوة 2: السعر والبيانات التاريخية
  const [currentPrice, setCurrentPrice] = useState('');
  const [historicalPrices, setHistoricalPrices] = useState<number[]>([]);
  const [csvStatus, setCsvStatus] = useState('');

  // الخطوة 3: حجم المركز (Half-Kelly)
  const [riskRewardRatio, setRiskRewardRatio] = useState('2.0');
  const [manualTargetValue, setManualTargetValue] = useState('');

  // الخطوة 4: الاستراتيجية
  const [strategy, setStrategy] = useState<'DCA' | 'Pyramiding'>('DCA');
  const [numTranches, setNumTranches] = useState('4');
  const [horizonDays, setHorizonDays] = useState('');

  // الخطوة 5: المراجعة

  const profile = getProfile();
  const assets = getAssets();
  const settings = getSystemSettings();
  const totalPortfolioValue = assets.reduce((s, a) => s + a.quantity * a.currentPrice, 0) + (profile?.availableCash ?? 0);
  const availableCash = profile?.availableCash ?? 0;

  // حساب OS من البيانات التاريخية
  const optimumScore = useMemo(() => {
    const price = parseFloat(currentPrice);
    if (!price || historicalPrices.length < 10) return 0.5;
    return computeOSFromPrices(price, historicalPrices, settings);
  }, [currentPrice, historicalPrices, settings]);

  // حساب Half-Kelly
  const halfKellyValue = useMemo(() => {
    const rrr = parseFloat(riskRewardRatio) || 2;
    return calculateHalfKellyPositionSize(optimumScore, rrr, totalPortfolioValue);
  }, [optimumScore, riskRewardRatio, totalPortfolioValue]);

  const targetValue = manualTargetValue
    ? parseFloat(manualTargetValue) || halfKellyValue
    : halfKellyValue;

  // تقلب السوق
  const marketVol = useMemo(() =>
    calculateMarketVolatility(historicalPrices),
    [historicalPrices]
  );

  // الأفق الزمني الافتراضي
  const defaultHorizon = useMemo(() =>
    getDefaultHorizonDays(assetCategory, marketVol),
    [assetCategory, marketVol]
  );

  const actualHorizon = parseInt(horizonDays) || defaultHorizon;
  const actualTranches = parseInt(numTranches) || 4;

  // معاينة الخطة
  const previewPlan = useMemo(() => {
    const price = parseFloat(currentPrice);
    if (!price || !assetName) return null;
    return createPositionBuildingPlan(
      assetName.toUpperCase(), assetCategory, optimumScore,
      totalPortfolioValue, Math.min(targetValue, availableCash),
      parseFloat(riskRewardRatio) || 2,
      strategy, actualTranches, actualHorizon,
      price, historicalPrices.length > 10 ? historicalPrices : null, null,
    );
  }, [assetName, assetCategory, optimumScore, totalPortfolioValue, targetValue, availableCash, riskRewardRatio, strategy, actualTranches, actualHorizon, currentPrice, historicalPrices]);

  // استيراد CSV
  const importCSV = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const lines = text.trim().split('\n');
      const prices: number[] = [];
      const header = lines[0].toLowerCase().split(',');
      let closeCol = header.indexOf('close');
      if (closeCol === -1) closeCol = header.length > 4 ? 4 : 1;

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length <= closeCol) continue;
        const p = parseFloat(cols[closeCol]);
        if (!isNaN(p) && p > 0) prices.push(p);
      }

      if (prices.length === 0) {
        setCsvStatus('لم يتم العثور على بيانات صالحة');
        return;
      }

      setHistoricalPrices(prices);
      if (!currentPrice && prices.length > 0) {
        setCurrentPrice(prices[prices.length - 1].toString());
      }
      setCsvStatus(`تم استيراد ${prices.length} سجل ✓`);
    };
    input.click();
  };

  // حفظ الخطة
  const handleSave = () => {
    if (!previewPlan) return;
    const price = parseFloat(currentPrice);

    // إنشاء الأصل في المحفظة
    const newAssetId = crypto.randomUUID();
    addAsset({
      id: newAssetId,
      name: assetName.toUpperCase(),
      category: assetCategory,
      quantity: 0, // يبدأ بصفر حتى تُنفَّذ الدفعات
      purchasePrice: price,
      purchaseDate: new Date().toISOString().split('T')[0],
      currentPrice: price,
      targetWeight: Math.min(targetValue / totalPortfolioValue, 0.25),
    });

    // حفظ البيانات التاريخية إن وجدت
    if (historicalPrices.length > 0) {
      const records = historicalPrices.map((p, i) => ({
        date: `2026-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
        close: p,
      }));
      setPriceHistory(newAssetId, records);
    }

    // حفظ خطة البناء مرتبطة بالأصل
    const finalPlan = { ...previewPlan, assetId: newAssetId };
    // تحديث planId في الدفعات
    finalPlan.tranches = finalPlan.tranches.map(t => ({ ...t, planId: finalPlan.id }));
    addPlan(finalPlan);

    onComplete();
  };

  const canNext = () => {
    switch (step) {
      case 0: return assetName.trim().length > 0;
      case 1: return parseFloat(currentPrice) > 0;
      case 2: return targetValue > 0;
      case 3: return actualTranches >= 2 && actualHorizon >= 7;
      case 4: return true;
      default: return false;
    }
  };

  const STEPS = ['الأصل', 'السعر', 'الحجم', 'الاستراتيجية', 'المراجعة'];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* شريط التقدم */}
        <div className="flex items-center gap-1 mb-6">
          {STEPS.map((s, i) => (
            <div key={i} className="flex-1 text-center">
              <div className={`h-2 rounded-full mb-1 ${
                i < step ? 'bg-green-500' : i === step ? '' : 'bg-gray-200'
              }`} style={i === step ? { background: 'var(--primary)' } : {}} />
              <span className={`text-[10px] ${i === step ? 'font-bold' : 'text-gray-400'}`}>{s}</span>
            </div>
          ))}
        </div>

        {/* الخطوة 1: اختيار الأصل */}
        {step === 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4">اختيار الأصل</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-sm font-bold block mb-1">اسم الأصل</label>
                <input className="input" placeholder="مثال: AAPL, BTC, GOLD"
                  value={assetName} onChange={e => setAssetName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-bold block mb-1">الفئة</label>
                <select className="input" value={assetCategory} onChange={e => setAssetCategory(e.target.value)}>
                  {Object.values(CATEGORY_GROUPS).map(g => (
                    <optgroup key={g.label} label={g.label}>
                      {g.categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* الخطوة 2: السعر والبيانات التاريخية */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold mb-4">السعر والبيانات التاريخية</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-sm font-bold block mb-1">السعر الحالي ($)</label>
                <input className="input" type="number" placeholder="100.00"
                  value={currentPrice} onChange={e => setCurrentPrice(e.target.value)} />
              </div>

              <div className="p-3 rounded-lg" style={{
                background: historicalPrices.length >= 50 ? 'var(--primary-bg)' : 'var(--warning-bg)'
              }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold">البيانات التاريخية: {historicalPrices.length} سجل</span>
                  {historicalPrices.length >= 50 && <span className="text-green-600 text-xs">✓ كافية</span>}
                  {historicalPrices.length > 0 && historicalPrices.length < 50 && (
                    <span className="text-orange-600 text-xs">يفضل 50+ للدقة</span>
                  )}
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

              {historicalPrices.length >= 10 && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 rounded bg-gray-50">
                    <div className="text-gray-400 text-xs">Optimum Score</div>
                    <div className="font-bold" style={{ color: optimumScore >= 0.7 ? '#22c55e' : optimumScore <= 0.3 ? '#ef4444' : '#6b7280' }}>
                      {(optimumScore * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="p-2 rounded bg-gray-50">
                    <div className="text-gray-400 text-xs">تقلب السوق</div>
                    <div className="font-bold">{(marketVol * 100).toFixed(1)}%</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* الخطوة 3: حجم المركز (Half-Kelly) */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold mb-4">حجم المركز (Half-Kelly)</h2>

            <div className="card mb-4" style={{ background: 'var(--primary-bg)' }}>
              <div className="text-center">
                <div className="text-xs text-gray-500">الحجم المقترح (Half-Kelly)</div>
                <div className="text-3xl font-bold" style={{ color: 'var(--primary)' }}>
                  ${halfKellyValue.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {totalPortfolioValue > 0 ? `${((halfKellyValue / totalPortfolioValue) * 100).toFixed(1)}% من المحفظة` : ''}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-sm font-bold block mb-1">نسبة الربح/الخسارة (Risk-Reward)</label>
                <input className="input" type="number" step="0.1" min="0.5" max="10"
                  value={riskRewardRatio} onChange={e => setRiskRewardRatio(e.target.value)} />
                <div className="text-xs text-gray-400 mt-1">نسبة العائد المتوقع إلى الخسارة المتوقعة</div>
              </div>

              <div>
                <label className="text-sm font-bold block mb-1">تعديل يدوي (اختياري)</label>
                <input className="input" type="number" placeholder={halfKellyValue.toFixed(2)}
                  value={manualTargetValue} onChange={e => setManualTargetValue(e.target.value)} />
                <div className="text-xs text-gray-400 mt-1">اتركه فارغاً لاستخدام Half-Kelly</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 rounded bg-gray-50">
                  <div className="text-gray-400 text-xs">النقد المتاح</div>
                  <div className="font-bold">${availableCash.toFixed(2)}</div>
                </div>
                <div className="p-2 rounded bg-gray-50">
                  <div className="text-gray-400 text-xs">القيمة النهائية</div>
                  <div className="font-bold">${Math.min(targetValue, availableCash).toFixed(2)}</div>
                </div>
              </div>

              {targetValue > availableCash && (
                <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
                  القيمة المطلوبة تتجاوز النقد المتاح. سيتم تقليصها إلى ${availableCash.toFixed(2)}
                </div>
              )}
            </div>

            {/* شرح Half-Kelly */}
            <div className="mt-3 p-3 bg-gray-50 rounded text-xs text-gray-500">
              <div className="font-bold mb-1">ما هو Half-Kelly؟</div>
              <div>معيار كيلي يحسب الحجم الأمثل للمركز بناءً على احتمالية النجاح (OS) ونسبة العائد/المخاطر.
              نصف كيلي (Half-Kelly) يقلل المخاطر بنسبة 50% مع الحفاظ على 75% من العائد المتوقع.</div>
              <div className="mt-1 font-mono text-[10px]">
                Kelly% = (p × (b+1) - 1) / b | Half-Kelly = Kelly% / 2
              </div>
            </div>
          </div>
        )}

        {/* الخطوة 4: الاستراتيجية */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold mb-4">اختيار الاستراتيجية</h2>

            <div className="flex gap-2 mb-4">
              <button
                className={`flex-1 p-4 rounded-xl border-2 cursor-pointer transition-all text-center ${
                  strategy === 'DCA' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => { setStrategy('DCA'); setNumTranches('4'); }}
              >
                <div className="text-lg font-bold mb-1">DCA</div>
                <div className="text-xs text-gray-500">توزيع متساوٍ</div>
                <div className="text-xs text-gray-400 mt-1">دفعات متساوية القيمة على فترات منتظمة</div>
              </button>
              <button
                className={`flex-1 p-4 rounded-xl border-2 cursor-pointer transition-all text-center ${
                  strategy === 'Pyramiding' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => { setStrategy('Pyramiding'); setNumTranches('3'); }}
              >
                <div className="text-lg font-bold mb-1">Pyramiding</div>
                <div className="text-xs text-gray-500">هرمي تنازلي</div>
                <div className="text-xs text-gray-400 mt-1">دفعات أكبر في البداية تتناقص تدريجياً</div>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-sm font-bold block mb-1">عدد الدفعات</label>
                <input className="input" type="number" min="2" max="12"
                  value={numTranches} onChange={e => setNumTranches(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-bold block mb-1">الأفق الزمني (يوم)</label>
                <input className="input" type="number" min="7" max="365"
                  value={horizonDays || ''} placeholder={defaultHorizon.toString()}
                  onChange={e => setHorizonDays(e.target.value)} />
                <div className="text-xs text-gray-400 mt-0.5">الافتراضي: {defaultHorizon} يوم</div>
              </div>
            </div>

            {/* وصف الاستراتيجيات */}
            <div className="p-3 bg-gray-50 rounded text-xs text-gray-500">
              {strategy === 'DCA' ? (
                <div>
                  <b>DCA (متوسط تكلفة الدولار):</b> تقسيم المبلغ بالتساوي على {actualTranches} دفعات.
                  كل دفعة = ${(Math.min(targetValue, availableCash) / actualTranches).toFixed(2)}.
                  يقلل مخاطر الشراء عند القمة.
                </div>
              ) : (
                <div>
                  <b>Pyramiding (هرمي):</b> دفعات أكبر في البداية (40% → 30% → 20% → 10%).
                  يناسب الأصول ذات الإشارات القوية، حيث يدخل بقوة أولاً ثم يعزز.
                </div>
              )}
            </div>
          </div>
        )}

        {/* الخطوة 5: المراجعة والحفظ */}
        {step === 4 && previewPlan && (
          <div>
            <h2 className="text-xl font-bold mb-4">مراجعة الخطة</h2>

            <div className="grid grid-cols-2 gap-2 text-sm mb-4">
              <div className="p-2 rounded bg-gray-50">
                <div className="text-gray-400 text-xs">الأصل</div>
                <div className="font-bold">{previewPlan.assetName}</div>
              </div>
              <div className="p-2 rounded bg-gray-50">
                <div className="text-gray-400 text-xs">الفئة</div>
                <div className="font-bold">{previewPlan.assetCategory}</div>
              </div>
              <div className="p-2 rounded bg-gray-50">
                <div className="text-gray-400 text-xs">الاستراتيجية</div>
                <div className="font-bold">{previewPlan.strategy}</div>
              </div>
              <div className="p-2 rounded bg-gray-50">
                <div className="text-gray-400 text-xs">Optimum Score</div>
                <div className="font-bold">{(previewPlan.optimumScore * 100).toFixed(0)}%</div>
              </div>
              <div className="p-2 rounded bg-gray-50">
                <div className="text-gray-400 text-xs">القيمة الإجمالية</div>
                <div className="font-bold" style={{ color: 'var(--primary)' }}>${previewPlan.totalTargetValue.toFixed(2)}</div>
              </div>
              <div className="p-2 rounded bg-gray-50">
                <div className="text-gray-400 text-xs">الأفق الزمني</div>
                <div className="font-bold">{previewPlan.horizonDays} يوم</div>
              </div>
            </div>

            {/* جدول الدفعات */}
            <h3 className="font-bold mb-2">جدول الدفعات ({previewPlan.numTranches})</h3>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-right py-1.5 px-2">#</th>
                    <th className="text-right py-1.5 px-2">التاريخ</th>
                    <th className="text-right py-1.5 px-2">القيمة</th>
                    <th className="text-right py-1.5 px-2">السعر المستهدف</th>
                    <th className="text-right py-1.5 px-2">النسبة</th>
                  </tr>
                </thead>
                <tbody>
                  {previewPlan.tranches.map(t => (
                    <tr key={t.number} className="border-b border-gray-50">
                      <td className="py-1.5 px-2 font-bold">{t.number}</td>
                      <td className="py-1.5 px-2">{t.targetDate}</td>
                      <td className="py-1.5 px-2 font-bold" style={{ color: 'var(--primary)' }}>${t.value.toFixed(2)}</td>
                      <td className="py-1.5 px-2">{t.minPrice ? `$${t.minPrice.toFixed(2)}` : '-'}</td>
                      <td className="py-1.5 px-2 text-gray-500">
                        {((t.value / previewPlan.totalTargetValue) * 100).toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* تمثيل بصري */}
            <div className="flex gap-1 mb-4">
              {previewPlan.tranches.map(t => (
                <div
                  key={t.number}
                  className="rounded-sm"
                  style={{
                    flex: t.value / previewPlan.totalTargetValue,
                    height: '24px',
                    background: `hsl(${140 + t.number * 20}, 60%, ${50 + t.number * 5}%)`,
                  }}
                  title={`دفعة ${t.number}: $${t.value.toFixed(2)}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* أزرار التنقل */}
        <div className="flex gap-3 mt-6 pt-4 border-t border-border">
          {step > 0 ? (
            <button className="btn-outline flex-1" onClick={() => setStep(step - 1)}>السابق</button>
          ) : (
            <button className="btn-outline flex-1" onClick={onCancel}>إلغاء</button>
          )}

          {step < 4 ? (
            <button className="btn-primary flex-1" onClick={() => setStep(step + 1)} disabled={!canNext()}>
              التالي →
            </button>
          ) : (
            <button className="btn-primary flex-1" onClick={handleSave}>
              حفظ الخطة ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
