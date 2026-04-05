'use client';

import { useMemo, useState } from 'react';
import { getAssets, getProfile, getPriceList, addTrade, getEffectiveSettings } from '../lib/store';
import { analyzeAsset } from '../lib/engine';
import { TradingSignal } from '../lib/types';

// ============ تصنيف قوة الإشارة ============

function getSignalStrength(os: number, confidence: number, signalType: string): {
  label: string; color: string; textColor: string; level: number;
} {
  if (signalType === 'none') return { label: 'محايد', color: '#9ca3af', textColor: 'text-gray-500', level: 0 };
  const score = os * 0.6 + confidence * 0.4; // 60% OS + 40% ثقة
  if (signalType === 'buy') {
    if (score >= 0.75) return { label: 'شراء قوي', color: '#15803d', textColor: 'text-green-800', level: 3 };
    if (score >= 0.60) return { label: 'شراء', color: '#22c55e', textColor: 'text-green-600', level: 2 };
    return { label: 'شراء ضعيف', color: '#86efac', textColor: 'text-green-500', level: 1 };
  } else {
    if (score >= 0.75) return { label: 'بيع قوي', color: '#b91c1c', textColor: 'text-red-800', level: 3 };
    if (score >= 0.60) return { label: 'بيع', color: '#ef4444', textColor: 'text-red-600', level: 2 };
    return { label: 'بيع ضعيف', color: '#fca5a5', textColor: 'text-red-400', level: 1 };
  }
}

function generateReport(s: TradingSignal): string {
  const strength = getSignalStrength(s.optimumScore, s.confidence, s.signalType);
  const f = s.factors;

  const osLabel = s.optimumScore >= 0.7 ? 'مرتفع' : s.optimumScore >= 0.5 ? 'متوسط' : s.optimumScore >= 0.3 ? 'ضعيف' : 'منخفض جداً';
  const trendLabel = f.trend > 0 ? 'صاعد (فوق المتوسط المتحرك)' : f.trend < 0 ? 'هابط (تحت المتوسط المتحرك)' : 'محايد (عند المتوسط المتحرك)';
  const rsiLabel = f.rsi > 70 ? 'تشبع شرائي (مُبالغ في الشراء)' : f.rsi < 30 ? 'تشبع بيعي (فرصة ارتداد)' : 'منطقة طبيعية';
  const momLabel = f.momentum > 0.3 ? 'زخم صاعد قوي' : f.momentum > 0 ? 'زخم صاعد طفيف' : f.momentum < -0.3 ? 'زخم هابط قوي' : f.momentum < 0 ? 'زخم هابط طفيف' : 'ثابت (بدون زخم)';
  const sharpeLabel = f.sharpe > 1.5 ? 'ممتاز' : f.sharpe > 0.5 ? 'جيد' : f.sharpe > 0 ? 'ضعيف' : 'سلبي';
  const zLabel = f.zScoreAdj > 2 ? 'أعلى بكثير من المتوسط' : f.zScoreAdj > 1 ? 'أعلى من المتوسط' : f.zScoreAdj < -2 ? 'أقل بكثير من المتوسط' : f.zScoreAdj < -1 ? 'أقل من المتوسط' : 'قرب المتوسط';

  let report = `══════ تقرير تحليل ${s.assetName} ══════\n\n`;
  report += `التوصية: ${strength.label.toUpperCase()} | القوة: ${(strength.level / 3 * 100).toFixed(0)}% | الثقة: ${(s.confidence * 100).toFixed(0)}%\n\n`;

  report += `── المؤشرات الرئيسية ──\n`;
  report += `• Optimum Score: ${(s.optimumScore * 100).toFixed(0)}% (${osLabel})\n`;
  report += `• Sharpe Ratio: ${f.sharpe.toFixed(2)} (${sharpeLabel}) — عائد ${(s.expectedReturn * 100).toFixed(1)}% مقابل تقلب ${(s.volatility * 100).toFixed(1)}%\n`;
  report += `• الاتجاه: ${trendLabel} — السعر $${s.currentPrice.toFixed(4)} | MA: $${f.ma50.toFixed(4)}\n`;
  report += `• RSI: ${f.rsi.toFixed(0)} (${rsiLabel})\n`;
  report += `• Z-Score المعدّل: ${f.zScoreAdj.toFixed(2)} (${zLabel})\n`;
  report += `• الزخم: ${(f.momentum * 100).toFixed(0)}% (${momLabel})\n`;
  report += `• MACD: ${(f.macd * 100).toFixed(0)}%\n\n`;

  // تحليل العوامل المتوافقة
  const buyFactors: string[] = [];
  const sellFactors: string[] = [];
  if (f.sharpe > 0) buyFactors.push('شارب إيجابي'); else sellFactors.push('شارب سلبي');
  if (f.trend > 0) buyFactors.push('اتجاه صاعد'); else if (f.trend < 0) sellFactors.push('اتجاه هابط');
  if (f.rsi < 30) buyFactors.push('تشبع بيعي (RSI)'); else if (f.rsi > 70) sellFactors.push('تشبع شرائي (RSI)');
  if (f.zScoreAdj < 0) buyFactors.push('سعر أقل من المتوسط'); else if (f.zScoreAdj > 0) sellFactors.push('سعر أعلى من المتوسط');
  if (f.momentum > 0) buyFactors.push('زخم إيجابي'); else if (f.momentum < 0) sellFactors.push('زخم سلبي');
  if (f.macd > 0) buyFactors.push('MACD إيجابي'); else if (f.macd < 0) sellFactors.push('MACD سلبي');

  report += `── تحليل العوامل ──\n`;
  report += `عوامل تدعم الشراء (${buyFactors.length}/6): ${buyFactors.join('، ') || 'لا يوجد'}\n`;
  report += `عوامل تدعم البيع (${sellFactors.length}/6): ${sellFactors.join('، ') || 'لا يوجد'}\n\n`;

  // التوصية النهائية
  report += `── التوصية ──\n`;
  if (s.signalType === 'buy') {
    if (strength.level === 3) report += `إشارة شراء قوية مدعومة بأغلب المؤشرات. يُنصح بالشراء مع الالتزام بحجم المركز المقترح.`;
    else if (strength.level === 2) report += `إشارة شراء معتدلة. بعض المؤشرات لا تدعم الشراء بشكل كامل. يُنصح بالشراء بحذر مع مراقبة الاتجاه.`;
    else report += `إشارة شراء ضعيفة. عوامل قليلة تدعم الشراء. يُفضل الانتظار لتأكيد أقوى قبل الدخول.`;
  } else if (s.signalType === 'sell') {
    if (strength.level === 3) report += `إشارة بيع قوية مدعومة بأغلب المؤشرات. يُنصح بتقليص المركز فوراً.`;
    else if (strength.level === 2) report += `إشارة بيع معتدلة. يُنصح بجني جزء من الأرباح أو تقليص المركز تدريجياً.`;
    else report += `إشارة بيع ضعيفة. المخاطر محدودة حالياً. يُفضل المراقبة مع وضع حد خسارة.`;
  } else {
    report += `لا توجد إشارة واضحة. يُنصح بالاحتفاظ بالمركز الحالي ومراقبة تطور المؤشرات.`;
  }

  return report;
}

export default function SignalsPage() {
  const [selectedSignal, setSelectedSignal] = useState<TradingSignal | null>(null);

  const assets = getAssets();
  const profile = getProfile();
  const totalValue = assets.reduce((s, a) => s + a.quantity * a.currentPrice, 0);
  const cash = profile?.availableCash ?? 0;

  const signals = useMemo(() => {
    return assets.map(a => {
      const prices = getPriceList(a.id);
      if (prices.length < 10) return null;
      const effectiveSettings = getEffectiveSettings(a.id, a.category);
      return analyzeAsset(a.name, a.id, a.currentPrice, prices, a.quantity, totalValue, a.targetWeight, cash, a.purchasePrice, effectiveSettings);
    }).filter(Boolean) as TradingSignal[];
  }, [assets, totalValue, cash]);

  const buySignals = signals.filter(s => s.signalType === 'buy');
  const sellSignals = signals.filter(s => s.signalType === 'sell');
  const neutralSignals = signals.filter(s => s.signalType === 'none');

  if (signals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400">
        <div className="text-6xl mb-4">🔔</div>
        <div className="text-xl">لا توجد إشارات حالياً</div>
        <div className="text-sm mt-2">أضف أصولاً وبيانات تاريخية لتوليد الإشارات</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">إشارات التداول</h1>

      {/* ملخص */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card text-center">
          <div className="text-2xl font-bold text-green-600">{buySignals.length}</div>
          <div className="text-sm text-green-600">شراء</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-red-600">{sellSignals.length}</div>
          <div className="text-sm text-red-600">بيع</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-gray-400">{neutralSignals.length}</div>
          <div className="text-sm text-gray-400">انتظار</div>
        </div>
      </div>

      {buySignals.length > 0 && (
        <>
          <h2 className="text-lg font-bold text-green-700 mb-3">↓ إشارات الشراء</h2>
          {buySignals.map(s => <SignalCard key={s.assetId} signal={s} onClick={() => setSelectedSignal(s)} />)}
        </>
      )}

      {sellSignals.length > 0 && (
        <>
          <h2 className="text-lg font-bold text-red-700 mb-3 mt-4">↑ إشارات البيع</h2>
          {sellSignals.map(s => <SignalCard key={s.assetId} signal={s} onClick={() => setSelectedSignal(s)} />)}
        </>
      )}

      {neutralSignals.length > 0 && (
        <>
          <h2 className="text-lg font-bold text-gray-500 mb-3 mt-4">⏸ انتظار</h2>
          {neutralSignals.map(s => <SignalCard key={s.assetId} signal={s} onClick={() => setSelectedSignal(s)} />)}
        </>
      )}

      {selectedSignal && (
        <SignalDetail signal={selectedSignal} onClose={() => setSelectedSignal(null)} onTrade={() => setSelectedSignal(null)} />
      )}
    </div>
  );
}

// ============ بطاقة الإشارة (ملخص) ============

function SignalCard({ signal: s, onClick }: { signal: TradingSignal; onClick: () => void }) {
  const color = s.signalType === 'buy' ? 'green' : s.signalType === 'sell' ? 'red' : 'gray';
  const strength = getSignalStrength(s.optimumScore, s.confidence, s.signalType);
  const f = s.factors;

  return (
    <div className="card mb-3 cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      {/* الرأس: الاسم + OS + التصنيف */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm`}
          style={{ background: strength.color }}>
          {(s.optimumScore * 100).toFixed(0)}
        </div>
        <div className="flex-1">
          <div className="font-bold text-lg">{s.assetName}</div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${strength.textColor}`}>{strength.label}</span>
            <span className="text-xs text-gray-400">|</span>
            <span className="text-xs text-gray-500">OS: {(s.optimumScore * 100).toFixed(0)}%</span>
          </div>
        </div>
        {/* تصنيف القوة */}
        <div className="text-center">
          <div className={`text-xs font-bold px-2 py-1 rounded-full text-white`} style={{ background: strength.color }}>
            {strength.level === 3 ? 'قوي' : strength.level === 2 ? 'معتدل' : strength.level === 1 ? 'ضعيف' : 'محايد'}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            ثقة {(s.confidence * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* شريط القوة */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-gray-400 w-8">بيع</span>
        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden relative">
          <div className="absolute inset-0 flex">
            <div className="w-[30%] bg-red-100" />
            <div className="w-[40%] bg-gray-50" />
            <div className="w-[30%] bg-green-100" />
          </div>
          <div className="absolute top-0 bottom-0 w-1 bg-gray-800 rounded" style={{ left: `${s.optimumScore * 100}%`, transform: 'translateX(-50%)' }} />
        </div>
        <span className="text-xs text-gray-400 w-8 text-left">شراء</span>
      </div>

      {/* العوامل - شبكة ملونة */}
      <div className="grid grid-cols-6 gap-1 mb-2">
        <FactorMini label="شارب" value={f.sharpe} positive={f.sharpe > 0} fmt={`${f.sharpe.toFixed(1)}`} />
        <FactorMini label="الاتجاه" value={f.trend} positive={f.trend > 0} fmt={f.trend > 0 ? '↑' : f.trend < 0 ? '↓' : '→'} />
        <FactorMini label="RSI" value={f.rsi} positive={f.rsi < 40} negative={f.rsi > 60} fmt={`${f.rsi.toFixed(0)}`} />
        <FactorMini label="Z_adj" value={f.zScoreAdj} positive={f.zScoreAdj < 0} fmt={`${f.zScoreAdj.toFixed(1)}`} />
        <FactorMini label="الزخم" value={f.momentum} positive={f.momentum > 0} fmt={`${(f.momentum * 100).toFixed(0)}%`} />
        <FactorMini label="MACD" value={f.macd} positive={f.macd > 0} fmt={`${(f.macd * 100).toFixed(0)}%`} />
      </div>

      {/* التوصية المختصرة */}
      <div className={`text-xs p-2 rounded ${
        s.signalType === 'buy' ? 'bg-green-50 text-green-800' :
        s.signalType === 'sell' ? 'bg-red-50 text-red-800' :
        'bg-gray-50 text-gray-600'
      }`}>
        {s.signalType === 'buy' && strength.level === 3 && `إشارة شراء قوية مدعومة بـ ${Math.round(s.confidence * 6)}/6 عوامل. يُنصح بالشراء.`}
        {s.signalType === 'buy' && strength.level === 2 && `إشارة شراء معتدلة (${Math.round(s.confidence * 6)}/6 عوامل متوافقة). شراء بحذر مع مراقبة.`}
        {s.signalType === 'buy' && strength.level === 1 && `إشارة شراء ضعيفة (${Math.round(s.confidence * 6)}/6 عوامل). يُفضل انتظار تأكيد أقوى.`}
        {s.signalType === 'sell' && strength.level === 3 && `إشارة بيع قوية مدعومة بـ ${Math.round(s.confidence * 6)}/6 عوامل. يُنصح بتقليص المركز.`}
        {s.signalType === 'sell' && strength.level === 2 && `إشارة بيع معتدلة. يُنصح بجني جزء من الأرباح.`}
        {s.signalType === 'sell' && strength.level === 1 && `إشارة بيع ضعيفة. مراقبة مع وضع حد خسارة.`}
        {s.signalType === 'none' && `لا توجد إشارة واضحة. الاحتفاظ بالمركز الحالي.`}
      </div>
    </div>
  );
}

function FactorMini({ label, value, positive, negative, fmt }: {
  label: string; value: number; positive: boolean; negative?: boolean; fmt: string;
}) {
  const isNeg = negative ?? !positive;
  const bg = positive ? 'bg-green-500 text-white' : isNeg ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600';
  return (
    <div className={`rounded p-1 text-center ${bg}`}>
      <div className="font-bold text-[11px] leading-tight">{fmt}</div>
      <div className="text-[8px] opacity-80">{label}</div>
    </div>
  );
}

// ============ التقرير المفصل (عند الضغط) ============

function SignalDetail({ signal: s, onClose, onTrade }: { signal: TradingSignal; onClose: () => void; onTrade: () => void }) {
  const [qty, setQty] = useState(s.suggestedQuantity.toFixed(4));
  const strength = getSignalStrength(s.optimumScore, s.confidence, s.signalType);
  const report = generateReport(s);

  const handleTrade = () => {
    const q = parseFloat(qty) || s.suggestedQuantity;
    addTrade({
      assetId: s.assetId, assetName: s.assetName,
      type: s.signalType === 'buy' ? 'buy' : 'sell',
      quantity: q, price: s.currentPrice,
      totalValue: q * s.currentPrice,
      date: new Date().toISOString().split('T')[0],
    });
    alert('تم تسجيل الصفقة بنجاح ✓');
    onTrade();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50" onClick={onClose}>
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-300 rounded mx-auto mb-3" />

        {/* رأس التقرير */}
        <div className="text-center mb-4">
          <div className="text-xl font-bold">{s.assetName}</div>
          <div className={`inline-block mt-1 text-sm font-bold px-3 py-1 rounded-full text-white`} style={{ background: strength.color }}>
            {strength.label} | قوة {(strength.level / 3 * 100).toFixed(0)}% | ثقة {(s.confidence * 100).toFixed(0)}%
          </div>
        </div>

        {/* التقرير النصي الكامل */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4 text-xs font-mono whitespace-pre-wrap leading-relaxed text-gray-700 border" dir="rtl">
          {report}
        </div>

        {/* بطاقة العوامل المفصلة */}
        <div className="mb-4">
          <div className="text-sm font-bold mb-2">تحليل العوامل</div>
          <div className="space-y-1.5">
            <FactorRow label="Sharpe Ratio" value={s.factors.sharpe.toFixed(2)}
              desc={s.factors.sharpe > 1.5 ? 'ممتاز' : s.factors.sharpe > 0.5 ? 'جيد' : s.factors.sharpe > 0 ? 'ضعيف' : 'سلبي'}
              positive={s.factors.sharpe > 0} />
            <FactorRow label="الاتجاه (MA)" value={`${s.factors.trend > 0 ? '↑' : s.factors.trend < 0 ? '↓' : '→'} | MA: $${s.factors.ma50.toFixed(4)}`}
              desc={s.factors.trend > 0 ? 'صاعد' : s.factors.trend < 0 ? 'هابط' : 'محايد'}
              positive={s.factors.trend > 0} />
            <FactorRow label="RSI" value={s.factors.rsi.toFixed(0)}
              desc={s.factors.rsi > 70 ? 'تشبع شرائي' : s.factors.rsi < 30 ? 'تشبع بيعي' : 'طبيعي'}
              positive={s.factors.rsi < 30} negative={s.factors.rsi > 70} />
            <FactorRow label="Z-Score المعدّل" value={s.factors.zScoreAdj.toFixed(2)}
              desc={s.factors.zScoreAdj > 1 ? 'فوق المتوسط' : s.factors.zScoreAdj < -1 ? 'تحت المتوسط' : 'قرب المتوسط'}
              positive={s.factors.zScoreAdj < 0} />
            <FactorRow label="الزخم" value={`${(s.factors.momentum * 100).toFixed(0)}%`}
              desc={s.factors.momentum > 0 ? 'صاعد' : s.factors.momentum < 0 ? 'هابط' : 'ثابت'}
              positive={s.factors.momentum > 0} />
            <FactorRow label="MACD" value={`${(s.factors.macd * 100).toFixed(0)}%`}
              desc={s.factors.macd > 0 ? 'إيجابي' : s.factors.macd < 0 ? 'سلبي' : 'محايد'}
              positive={s.factors.macd > 0} />
          </div>
        </div>

        {/* معلومات إضافية */}
        <div className="grid grid-cols-2 gap-2 text-sm mb-4">
          <div className="p-2 bg-gray-50 rounded"><span className="text-gray-400 text-xs block">السعر</span><b>${s.currentPrice.toFixed(4)}</b></div>
          <div className="p-2 bg-gray-50 rounded"><span className="text-gray-400 text-xs block">العائد السنوي</span><b>{(s.expectedReturn * 100).toFixed(1)}%</b></div>
          <div className="p-2 bg-gray-50 rounded"><span className="text-gray-400 text-xs block">التقلب</span><b>{(s.volatility * 100).toFixed(1)}%</b></div>
          <div className="p-2 bg-gray-50 rounded"><span className="text-gray-400 text-xs block">الوزن</span><b>{(s.currentWeight * 100).toFixed(1)}% / {(s.targetWeight * 100).toFixed(0)}%</b></div>
        </div>

        {/* تنفيذ الصفقة */}
        {s.signalType !== 'none' && s.suggestedQuantity > 0 && (
          <>
            <div className="mb-3">
              <label className="text-sm font-bold">الكمية</label>
              <input className="input" type="number" value={qty} onChange={e => setQty(e.target.value)} />
              <div className="text-xs text-gray-500 mt-1 text-center">
                القيمة: ${((parseFloat(qty) || 0) * s.currentPrice).toFixed(2)}
              </div>
            </div>
            <button className="btn-primary w-full" onClick={handleTrade}>
              تسجيل الصفقة ✓
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function FactorRow({ label, value, desc, positive, negative }: {
  label: string; value: string; desc: string; positive: boolean; negative?: boolean;
}) {
  const isNeg = negative ?? !positive;
  const dot = positive ? 'bg-green-500' : isNeg ? 'bg-red-500' : 'bg-gray-300';
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`w-2.5 h-2.5 rounded-full ${dot}`} />
      <span className="w-28 text-gray-500">{label}</span>
      <span className="font-bold flex-1">{value}</span>
      <span className={`text-xs ${positive ? 'text-green-600' : isNeg ? 'text-red-600' : 'text-gray-400'}`}>{desc}</span>
    </div>
  );
}
