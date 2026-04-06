'use client';

import { useState, useMemo } from 'react';
import {
  MacroVariables, DEFAULT_MACRO,
  fairGoldPrice, fairSilverPrice, fairCbeRate, fairUsdEgp, fairEgx30,
  calculateValuationGap, DEFAULT_GOLD_PARAMS, DEFAULT_SILVER_PARAMS,
} from '../lib/fundamentalModels';

const MACRO_FIELDS: { key: keyof MacroVariables; label: string; unit: string; group: string }[] = [
  { key: 'usRealYield10y', label: 'العائد الحقيقي 10 سنوات (أمريكا)', unit: '%', group: 'عالمي' },
  { key: 'dxyIndex', label: 'مؤشر الدولار DXY', unit: '', group: 'عالمي' },
  { key: 'vixIndex', label: 'مؤشر الخوف VIX', unit: '', group: 'عالمي' },
  { key: 'centralBankGoldBuy', label: 'مشتريات البنوك المركزية (ذهب)', unit: 'طن', group: 'عالمي' },
  { key: 'globalPMI', label: 'مؤشر PMI العالمي', unit: '', group: 'عالمي' },
  { key: 'usFedRate', label: 'سعر الفائدة الفيدرالي', unit: '%', group: 'عالمي' },
  { key: 'cpiUS', label: 'التضخم الأمريكي', unit: '%', group: 'عالمي' },
  { key: 'cpiEgypt', label: 'التضخم المصري', unit: '%', group: 'مصر' },
  { key: 'cbeInterestRate', label: 'سعر فائدة البنك المركزي', unit: '%', group: 'مصر' },
  { key: 'nfaGap', label: 'فجوة صافي الأصول الأجنبية', unit: 'مليار $', group: 'مصر' },
  { key: 'externalDebtService', label: 'خدمة الدين الخارجي', unit: 'مليار $', group: 'مصر' },
  { key: 'fdi', label: 'الاستثمار الأجنبي المباشر', unit: 'مليار $', group: 'مصر' },
  { key: 'remittances', label: 'تحويلات المصريين بالخارج', unit: 'مليار $', group: 'مصر' },
  { key: 'exports', label: 'الصادرات', unit: 'مليار $', group: 'مصر' },
  { key: 'reserves', label: 'الاحتياطي الأجنبي', unit: 'مليار $', group: 'مصر' },
];

export default function EconomicIndicatorsPage() {
  const [macro, setMacro] = useState<MacroVariables>({ ...DEFAULT_MACRO });

  const updateField = (key: keyof MacroVariables, value: string) => {
    setMacro(prev => ({ ...prev, [key]: parseFloat(value) || 0 }));
  };

  // حساب القيم العادلة
  const results = useMemo(() => {
    const goldFV = fairGoldPrice(macro);
    const silverFV = fairSilverPrice(goldFV, macro);
    const cbeFV = fairCbeRate(macro);
    const usdFV = fairUsdEgp(macro);
    const egxFV = fairEgx30(macro);

    return [
      { name: 'الذهب (عالمي)', fairPrice: goldFV, unit: '$/أونصة', currentField: 'أدخل السعر الحالي' },
      { name: 'الفضة (عالمي)', fairPrice: silverFV, unit: '$/أونصة', currentField: '' },
      { name: 'سعر الفائدة CBE', fairPrice: cbeFV, unit: '%', currentField: '' },
      { name: 'الدولار/الجنيه', fairPrice: usdFV, unit: 'جنيه', currentField: '' },
      { name: 'مؤشر EGX30', fairPrice: egxFV, unit: 'نقطة', currentField: '' },
    ];
  }, [macro]);

  const [currentPrices, setCurrentPrices] = useState<Record<string, string>>({});

  const groups = ['عالمي', 'مصر'];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">المؤشرات الاقتصادية</h1>
      <p className="text-sm text-gray-500 mb-6">أدخل المتغيرات الاقتصادية لحساب القيم العادلة للأصول (نماذج DeepSeek + Gemini)</p>

      {/* إدخال المتغيرات */}
      {groups.map(group => (
        <div key={group} className="card mb-4">
          <h2 className="font-bold text-lg mb-3">{group === 'عالمي' ? 'المؤشرات العالمية' : 'المؤشرات المصرية'}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {MACRO_FIELDS.filter(f => f.group === group).map(field => (
              <div key={field.key}>
                <label className="text-xs font-bold block mb-0.5">{field.label}</label>
                <div className="flex items-center gap-1">
                  <input
                    className="input text-sm flex-1"
                    type="number"
                    step="any"
                    value={macro[field.key]}
                    onChange={e => updateField(field.key, e.target.value)}
                  />
                  {field.unit && <span className="text-xs text-gray-400 w-12">{field.unit}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* القيم العادلة */}
      <div className="card mb-4">
        <h2 className="font-bold text-lg mb-3">القيم العادلة المحسوبة</h2>
        <div className="space-y-3">
          {results.map(r => {
            const currentPrice = parseFloat(currentPrices[r.name] || '0');
            const gap = currentPrice > 0 ? calculateValuationGap(currentPrice, r.fairPrice) : null;

            return (
              <div key={r.name} className="p-3 rounded-lg bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold">{r.name}</span>
                  <span className="text-lg font-bold" style={{ color: 'var(--primary)' }}>
                    {r.fairPrice.toFixed(2)} {r.unit}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    className="input text-sm flex-1"
                    type="number"
                    step="any"
                    placeholder="السعر الحالي"
                    value={currentPrices[r.name] || ''}
                    onChange={e => setCurrentPrices(prev => ({ ...prev, [r.name]: e.target.value }))}
                  />
                  {gap && (
                    <div className={`text-sm font-bold px-2 py-1 rounded ${
                      gap.gapPercent < -5 ? 'bg-green-100 text-green-700' :
                      gap.gapPercent > 5 ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {gap.gapPercent >= 0 ? '+' : ''}{gap.gapPercent.toFixed(1)}%
                    </div>
                  )}
                </div>

                {gap && (
                  <div className={`text-xs mt-1 ${
                    gap.gapPercent < -5 ? 'text-green-600' :
                    gap.gapPercent > 5 ? 'text-red-600' :
                    'text-gray-500'
                  }`}>
                    {gap.recommendation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-xs text-gray-400 text-center">
        النماذج الاقتصادية تقديرية وتعتمد على دقة المتغيرات المدخلة. ليست نصيحة استثمارية.
      </div>
    </div>
  );
}
