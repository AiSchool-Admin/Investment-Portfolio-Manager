'use client';

import { useMemo, useState } from 'react';
import { getAssets, getProfile, getPriceList, addTrade, getEffectiveSettings } from '../lib/store';
import { analyzeAsset } from '../lib/engine';
import { TradingSignal } from '../lib/types';

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
      const effectiveSettings = getEffectiveSettings(a.id);
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

      {/* إشارات الشراء */}
      {buySignals.length > 0 && (
        <>
          <h2 className="text-lg font-bold text-green-700 mb-3">↓ إشارات الشراء</h2>
          {buySignals.map(s => <SignalCard key={s.assetId} signal={s} onClick={() => setSelectedSignal(s)} />)}
        </>
      )}

      {/* إشارات البيع */}
      {sellSignals.length > 0 && (
        <>
          <h2 className="text-lg font-bold text-red-700 mb-3 mt-4">↑ إشارات البيع</h2>
          {sellSignals.map(s => <SignalCard key={s.assetId} signal={s} onClick={() => setSelectedSignal(s)} />)}
        </>
      )}

      {/* انتظار */}
      {neutralSignals.length > 0 && (
        <>
          <h2 className="text-lg font-bold text-gray-500 mb-3 mt-4">⏸ انتظار</h2>
          {neutralSignals.map(s => <SignalCard key={s.assetId} signal={s} onClick={() => setSelectedSignal(s)} />)}
        </>
      )}

      {/* تفاصيل الإشارة */}
      {selectedSignal && (
        <SignalDetail
          signal={selectedSignal}
          onClose={() => setSelectedSignal(null)}
          onTrade={() => setSelectedSignal(null)}
        />
      )}
    </div>
  );
}

function SignalCard({ signal: s, onClick }: { signal: TradingSignal; onClick: () => void }) {
  const color = s.signalType === 'buy' ? 'green' : s.signalType === 'sell' ? 'red' : 'gray';
  return (
    <div className="card mb-2 cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
          color === 'green' ? 'bg-green-500' : color === 'red' ? 'bg-red-500' : 'bg-gray-400'}`}>
          {s.signalType === 'buy' ? '↓' : s.signalType === 'sell' ? '↑' : '⏸'}
        </div>
        <div className="flex-1">
          <div className="font-bold">{s.assetName}</div>
          <div className="text-xs text-gray-500">
            {s.signalType === 'buy' ? 'شراء' : s.signalType === 'sell' ? 'بيع' : 'انتظار'} | OS: {s.optimumScore.toFixed(2)}
          </div>
        </div>

        {/* مؤشر OS دائري */}
        <div className="relative w-12 h-12">
          <svg className="w-12 h-12 transform -rotate-90">
            <circle cx="24" cy="24" r="20" fill="none" stroke="#e5e7eb" strokeWidth="4" />
            <circle cx="24" cy="24" r="20" fill="none" stroke={color === 'green' ? '#22c55e' : color === 'red' ? '#ef4444' : '#9ca3af'}
              strokeWidth="4" strokeDasharray={`${s.optimumScore * 125.6} 125.6`} strokeLinecap="round" />
          </svg>
          <div className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${
            color === 'green' ? 'text-green-600' : color === 'red' ? 'text-red-600' : 'text-gray-500'}`}>
            {(s.optimumScore * 100).toFixed(0)}
          </div>
        </div>
      </div>

      {/* درجة الثقة */}
      {s.signalType !== 'none' && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-gray-400">الثقة:</span>
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{
              width: `${s.confidence * 100}%`,
              background: s.confidence >= 0.7 ? '#22c55e' : s.confidence >= 0.5 ? '#f59e0b' : '#ef4444',
            }} />
          </div>
          <span className={`text-xs font-bold ${s.confidence >= 0.7 ? 'text-green-600' : s.confidence >= 0.5 ? 'text-yellow-600' : 'text-red-600'}`}>
            {(s.confidence * 100).toFixed(0)}%
          </span>
          {s.signalSource !== 'os' && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">
              {s.signalSource === 'trailing_stop' ? 'وقف خسارة' : 'إعادة توازن'}
            </span>
          )}
        </div>
      )}

      {/* العوامل */}
      <div className="flex flex-wrap justify-around mt-3 pt-3 border-t border-gray-100 text-center text-xs gap-y-2">
        <div><div className="font-bold">{(s.optimumScore * 100).toFixed(0)}%</div><div className="text-gray-400">OS</div></div>
        <div><div className={`font-bold ${s.factors.trend > 0 ? 'text-green-600' : s.factors.trend < 0 ? 'text-red-600' : ''}`}>
          {s.factors.trend > 0 ? '↑' : s.factors.trend < 0 ? '↓' : '→'}</div><div className="text-gray-400">الاتجاه</div></div>
        <div><div className={`font-bold ${s.factors.rsi < 30 ? 'text-green-600' : s.factors.rsi > 70 ? 'text-red-600' : ''}`}>
          {s.factors.rsi.toFixed(0)}</div><div className="text-gray-400">RSI</div></div>
        <div><div className="font-bold">{s.factors.zScoreAdj.toFixed(2)}</div><div className="text-gray-400">Z_adj</div></div>
        <div><div className={`font-bold ${s.factors.momentum > 0 ? 'text-green-600' : s.factors.momentum < 0 ? 'text-red-600' : ''}`}>
          {(s.factors.momentum * 100).toFixed(0)}%</div><div className="text-gray-400">الزخم</div></div>
        <div><div className="font-bold">{(s.factors.sharpe).toFixed(2)}</div><div className="text-gray-400">شارب</div></div>
      </div>

      {/* الأسباب */}
      <div className="mt-2">
        {s.reasons.map((r, i) => (
          <div key={i} className="text-xs text-gray-500 flex items-start gap-1 mt-1">
            <span>ℹ️</span><span>{r}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SignalDetail({ signal: s, onClose, onTrade }: { signal: TradingSignal; onClose: () => void; onTrade: () => void }) {
  const [qty, setQty] = useState(s.suggestedQuantity.toFixed(4));

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
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50" onClick={onClose}>
      <div className="card w-full max-w-md rounded-t-2xl md:rounded-2xl" onClick={e => e.stopPropagation()}>
        <div className="text-center mb-4">
          <div className="w-10 h-1 bg-gray-300 rounded mx-auto mb-4" />
          <div className="text-xl font-bold">
            {s.signalType === 'buy' ? 'شراء' : s.signalType === 'sell' ? 'بيع' : 'تفاصيل'} - {s.assetName}
          </div>
        </div>

        {/* بطاقة العوامل */}
        <div className="mb-4">
          <div className="text-xs font-bold mb-2 text-gray-500">العوامل المؤثرة في القرار:</div>
          <div className="grid grid-cols-3 gap-1.5 text-xs">
            <FactorBadge label="Sharpe" value={s.factors.sharpe} fmt={v => v.toFixed(2)} positive={v => v > 0} />
            <FactorBadge label="Z_adj" value={s.factors.zScoreAdj} fmt={v => v.toFixed(2)} positive={v => v < 0} />
            <FactorBadge label="الاتجاه" value={s.factors.trend} fmt={v => v > 0 ? '↑ صاعد' : v < 0 ? '↓ هابط' : '→ محايد'} positive={v => v > 0} />
            <FactorBadge label="RSI" value={s.factors.rsi} fmt={v => v.toFixed(0)} positive={v => v < 30} negative={v => v > 70} />
            <FactorBadge label="الزخم" value={s.factors.momentum} fmt={v => (v * 100).toFixed(0) + '%'} positive={v => v > 0} />
            <FactorBadge label="MACD" value={s.factors.macd} fmt={v => (v * 100).toFixed(0) + '%'} positive={v => v > 0} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm mb-4">
          <div className="flex justify-between"><span>السعر الحالي:</span><b>${s.currentPrice.toFixed(2)}</b></div>
          <div className="flex justify-between"><span>OS:</span><b>{(s.optimumScore * 100).toFixed(0)}% (ثقة {(s.confidence * 100).toFixed(0)}%)</b></div>
          <div className="flex justify-between"><span>الوزن الحالي:</span><b>{(s.currentWeight * 100).toFixed(1)}%</b></div>
          <div className="flex justify-between"><span>الوزن المستهدف:</span><b>{(s.targetWeight * 100).toFixed(1)}%</b></div>
          <div className="flex justify-between"><span>MA{50}:</span><b>${s.factors.ma50.toFixed(2)}</b></div>
          <div className="flex justify-between"><span>العائد السنوي:</span><b>{(s.expectedReturn * 100).toFixed(1)}%</b></div>
        </div>

        {s.signalType !== 'none' && (
          <>
            <div className="mb-3">
              <label className="text-sm font-bold">الكمية (قابلة للتعديل)</label>
              <input className="input" type="number" value={qty} onChange={e => setQty(e.target.value)} />
              <div className="text-xs text-gray-500 mt-1 text-center">
                القيمة التقديرية: ${((parseFloat(qty) || 0) * s.currentPrice).toFixed(2)}
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

function FactorBadge({ label, value, fmt, positive, negative }: {
  label: string; value: number;
  fmt: (v: number) => string;
  positive: (v: number) => boolean;
  negative?: (v: number) => boolean;
}) {
  const isPos = positive(value);
  const isNeg = negative ? negative(value) : !isPos;
  const bg = isPos ? 'bg-green-50 text-green-700' : isNeg ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600';
  return (
    <div className={`p-1.5 rounded text-center ${bg}`}>
      <div className="font-bold">{fmt(value)}</div>
      <div className="text-[10px] opacity-70">{label}</div>
    </div>
  );
}
