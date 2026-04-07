'use client';

import { useState, useMemo } from 'react';
import {
  MacroVariables, DEFAULT_MACRO, ECONOMY_LIMITS, validateMacro,
  fairGoldPrice, fairSilverPrice, fairCbeRate, fairUsdEgp, fairEgx30,
  calculateValuationGap, DEFAULT_GOLD_PARAMS, DEFAULT_SILVER_PARAMS,
} from '../lib/fundamentalModels';

const SIGNAL_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  strong_buy: { bg: 'bg-green-600', text: 'text-white', label: 'شراء قوي' },
  buy: { bg: 'bg-green-100', text: 'text-green-700', label: 'شراء' },
  hold: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'احتفاظ' },
  reduce: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'تخفيف' },
  strong_sell: { bg: 'bg-red-600', text: 'text-white', label: 'بيع قوي' },
};

// المتغيرات الأساسية (4 منزلقات رئيسية - Gemini المستوى العلوي)
const KEY_SLIDERS: { key: keyof MacroVariables; label: string; icon: string }[] = [
  { key: 'cbeInterestRate', label: 'فائدة CBE', icon: '🏦' },
  { key: 'cpiEgypt', label: 'التضخم المصري', icon: '📈' },
  { key: 'usRealYield10y', label: 'العائد الحقيقي US', icon: '🇺🇸' },
  { key: 'dxyIndex', label: 'مؤشر الدولار', icon: '💵' },
];

export default function EconomicIndicatorsPage() {
  const [macro, setMacro] = useState<MacroVariables>({ ...DEFAULT_MACRO });
  const [currentPrices, setCurrentPrices] = useState<Record<string, string>>({});
  const [showAllInputs, setShowAllInputs] = useState(false);
  const [lastUpdate] = useState(new Date().toISOString().split('T')[0]);

  const updateField = (key: keyof MacroVariables, value: number) => {
    const limits = ECONOMY_LIMITS[key];
    const clamped = Math.max(limits.min, Math.min(limits.max, value));
    setMacro(prev => ({ ...prev, [key]: clamped }));
  };

  const validation = useMemo(() => validateMacro(macro), [macro]);

  // حساب القيم العادلة
  const assets = useMemo(() => {
    const goldFV = fairGoldPrice(macro);
    const silverFV = fairSilverPrice(goldFV, macro);
    const cbeFV = fairCbeRate(macro);
    const usdFV = fairUsdEgp(macro);
    const egxFV = fairEgx30(macro);

    return [
      { name: 'الذهب', icon: '🥇', fairPrice: goldFV, unit: '$/أونصة', priority: 1 },
      { name: 'EGX30', icon: '📊', fairPrice: egxFV, unit: 'نقطة', priority: 2 },
      { name: 'سعر الفائدة', icon: '🏦', fairPrice: cbeFV, unit: '%', priority: 3 },
      { name: 'الدولار/الجنيه', icon: '💱', fairPrice: usdFV, unit: 'جنيه', priority: 4 },
      { name: 'الفضة', icon: '🥈', fairPrice: silverFV, unit: '$/أونصة', priority: 5 },
    ];
  }, [macro]);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">🌍 الاقتصاد الكلي</h1>
        <span className="text-xs text-gray-400">نماذج DeepSeek + Gemini + Claude</span>
      </div>
      <p className="text-sm text-gray-500 mb-4">حرّك المنزلقات لحساب القيم العادلة فوراً</p>

      {/* ===== المستوى العلوي: 4 منزلقات رئيسية (Gemini) ===== */}
      <div className="card mb-4">
        <h2 className="font-bold mb-3">المتغيرات الرئيسية</h2>
        <div className="grid grid-cols-2 gap-4">
          {KEY_SLIDERS.map(s => {
            const limits = ECONOMY_LIMITS[s.key];
            return (
              <div key={s.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold">{s.icon} {s.label}</span>
                  <span className="text-sm font-bold" style={{ color: 'var(--primary)' }}>
                    {macro[s.key]}{limits.unit === '%' ? '%' : ` ${limits.unit}`}
                  </span>
                </div>
                <input
                  type="range"
                  className="w-full accent-[#1B5E20]"
                  min={limits.min} max={limits.max}
                  step={(limits.max - limits.min) / 100}
                  value={macro[s.key]}
                  onChange={e => updateField(s.key, parseFloat(e.target.value))}
                />
                <div className="flex justify-between text-[10px] text-gray-300">
                  <span>{limits.min}{limits.unit}</span>
                  <span>{limits.max}{limits.unit}</span>
                </div>
              </div>
            );
          })}
        </div>

        <button className="text-xs text-gray-500 mt-2 cursor-pointer hover:text-gray-700"
          onClick={() => setShowAllInputs(!showAllInputs)}>
          {showAllInputs ? '▲ إخفاء المتغيرات الإضافية' : '▼ عرض كل المتغيرات (15)'}
        </button>

        {showAllInputs && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3 pt-3 border-t border-border">
            {Object.entries(ECONOMY_LIMITS).map(([key, limits]) => {
              if (KEY_SLIDERS.some(s => s.key === key)) return null;
              return (
                <div key={key}>
                  <label className="text-xs font-bold block mb-0.5">{limits.label}</label>
                  <div className="flex items-center gap-1">
                    <input className="input text-sm flex-1" type="number" step="any"
                      value={macro[key as keyof MacroVariables]}
                      onChange={e => updateField(key as keyof MacroVariables, parseFloat(e.target.value) || 0)} />
                    <span className="text-[10px] text-gray-400 w-10">{limits.unit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== المستوى الأوسط: بطاقات الأصول (Gemini) ===== */}
      <div className="space-y-3 mb-4">
        {assets.map(asset => {
          const cp = parseFloat(currentPrices[asset.name] || '0');
          const gap = cp > 0 ? calculateValuationGap(cp, asset.fairPrice) : null;
          const signalStyle = gap ? SIGNAL_COLORS[gap.signal] : null;

          return (
            <div key={asset.name} className="card">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{asset.icon}</span>
                <div className="flex-1">
                  <div className="font-bold">{asset.name}</div>
                  <div className="text-xs text-gray-400">القيمة العادلة</div>
                </div>
                <div className="text-left">
                  <div className="text-xl font-bold" style={{ color: 'var(--primary)' }}>
                    {asset.fairPrice.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-gray-400">{asset.unit}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input className="input text-sm flex-1" type="number" step="any"
                  placeholder="السعر الحالي"
                  value={currentPrices[asset.name] || ''}
                  onChange={e => setCurrentPrices(prev => ({ ...prev, [asset.name]: e.target.value }))} />

                {gap && signalStyle && (
                  <div className={`px-3 py-1.5 rounded-lg text-sm font-bold ${signalStyle.bg} ${signalStyle.text}`}>
                    {signalStyle.label}
                  </div>
                )}
              </div>

              {gap && (
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className={gap.gapPercent < 0 ? 'text-green-600' : gap.gapPercent > 0 ? 'text-red-600' : 'text-gray-500'}>
                    فجوة: {gap.gapPercent >= 0 ? '+' : ''}{gap.gapPercent.toFixed(1)}%
                  </span>
                  <span className="text-gray-500">{gap.recommendation}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ===== المستوى السفلي: التحكم (Gemini) ===== */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-400">آخر تحديث: {lastUpdate}</span>
            {!validation.valid && (
              <div className="text-xs text-red-500 mt-1">
                {validation.errors.slice(0, 2).map((e, i) => <div key={i}>⚠️ {e}</div>)}
              </div>
            )}
          </div>
          <button className="btn-primary text-sm"
            onClick={() => setMacro({ ...DEFAULT_MACRO })}>
            استعادة الافتراضية
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-400 text-center mt-3">
        النماذج تقديرية وليست نصيحة استثمارية. المعاملات قابلة للتعديل من الإعدادات.
      </div>
    </div>
  );
}
