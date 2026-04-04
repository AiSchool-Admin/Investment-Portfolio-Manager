'use client';

import { useMemo } from 'react';
import { getAssets, getProfile, getPriceList, getSystemSettings, getEffectiveSettings } from '../lib/store';
import { analyzeAsset, checkRebalancing } from '../lib/engine';
import { TradingSignal, RebalanceItem } from '../lib/types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#F44336', '#009688', '#FFC107', '#3F51B5'];

export default function Dashboard({ onRefresh }: { onRefresh: () => void }) {
  const assets = getAssets();
  const profile = getProfile();
  const systemSettings = getSystemSettings();
  const totalValue = assets.reduce((s, a) => s + a.quantity * a.currentPrice, 0);
  const totalPurchase = assets.reduce((s, a) => s + a.quantity * a.purchasePrice, 0);
  const totalPL = totalValue - totalPurchase;
  const plPercent = totalPurchase > 0 ? (totalPL / totalPurchase) * 100 : 0;
  const cash = profile?.availableCash ?? 0;

  // تحليل الإشارات باستخدام الإعدادات الفعالة لكل أصل
  const signals = useMemo<TradingSignal[]>(() => {
    return assets.map(a => {
      const prices = getPriceList(a.id);
      if (prices.length < 10) return null;
      const effectiveSettings = getEffectiveSettings(a.id);
      return analyzeAsset(a.name, a.id, a.currentPrice, prices, a.quantity, totalValue, a.targetWeight, cash, effectiveSettings);
    }).filter(Boolean) as TradingSignal[];
  }, [assets, totalValue, cash]);

  const activeSignals = signals.filter(s => s.signalType !== 'none');

  // إعادة التوازن باستخدام عتبة من الإعدادات
  const rebalancing = useMemo<RebalanceItem[]>(() => {
    if (totalValue <= 0) return [];
    return checkRebalancing(
      assets.map(a => a.name),
      assets.map(a => (a.quantity * a.currentPrice) / totalValue),
      assets.map(a => a.targetWeight),
      systemSettings.rebalanceThreshold,
    );
  }, [assets, totalValue, systemSettings.rebalanceThreshold]);

  // بيانات الرسم البياني
  const pieData = assets.map(a => ({ name: a.name, value: a.quantity * a.currentPrice }));

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400">
        <div className="text-6xl mb-4">💼</div>
        <div className="text-xl">لا توجد أصول بعد</div>
        <div className="text-sm mt-2">ابدأ بإضافة أصولك من قسم &quot;الأصول&quot;</div>
      </div>
    );
  }

  const isPositive = totalPL >= 0;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">لوحة التحكم</h1>
        <button onClick={onRefresh} className="btn-outline text-sm">تحديث ↻</button>
      </div>

      {/* الملخص + الرسم البياني */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* بطاقة القيمة الإجمالية */}
        <div className="card text-center" style={{ background: 'var(--primary-bg)' }}>
          <div className="text-sm text-gray-600">القيمة الإجمالية للمحفظة</div>
          <div className="text-3xl font-bold mt-2">${totalValue.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className={`mt-2 text-lg font-bold ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
            {isPositive ? '▲' : '▼'} {isPositive ? '+' : ''}${totalPL.toFixed(2)} ({plPercent.toFixed(1)}%)
          </div>
          <div className="border-t border-gray-300 mt-3 pt-3 flex justify-between text-sm">
            <span>النقد المتاح:</span>
            <span className="font-bold">${cash.toLocaleString('en', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* رسم بياني دائري */}
        {assets.length > 1 && (
          <div className="card">
            <div className="text-center font-bold mb-2">توزيع المحفظة</div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35} label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {assets.map((a, i) => (
                <span key={a.id} className="flex items-center gap-1 text-xs">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ background: COLORS[i % COLORS.length] }} />
                  {a.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* الإشارات + إعادة التوازن */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold mb-3">
            الإشارات النشطة
            {activeSignals.length > 0 && (
              <span className="mr-2 text-xs text-white px-2 py-0.5 rounded-full" style={{ background: 'var(--primary)' }}>
                {activeSignals.length}
              </span>
            )}
          </h2>
          {activeSignals.length === 0 ? (
            <div className="card text-center text-gray-400 py-6">لا توجد إشارات نشطة</div>
          ) : (
            activeSignals.map(s => (
              <div key={s.assetId} className="card mb-2 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${s.signalType === 'buy' ? 'bg-green-500' : 'bg-red-500'}`}>
                  {s.signalType === 'buy' ? '↓' : '↑'}
                </div>
                <div className="flex-1">
                  <div className="font-bold">{s.assetName}</div>
                  <div className="text-xs text-gray-500">
                    {s.signalType === 'buy' ? 'شراء' : 'بيع'} | OS: {s.optimumScore.toFixed(2)}
                  </div>
                </div>
                <div className="text-left">
                  <div className="font-bold">${s.suggestedValue.toFixed(2)}</div>
                  <div className="text-xs text-gray-500">{s.suggestedQuantity.toFixed(4)} وحدة</div>
                </div>
              </div>
            ))
          )}
        </div>

        <div>
          <h2 className="text-lg font-bold mb-3">
            إعادة التوازن
            {rebalancing.length > 0 && (
              <span className="mr-2 text-xs text-white px-2 py-0.5 rounded-full" style={{ background: 'var(--warning)' }}>
                {rebalancing.length}
              </span>
            )}
          </h2>
          {rebalancing.length === 0 ? (
            <div className="card text-center text-gray-400 py-6">جميع الأوزان متوازنة</div>
          ) : (
            rebalancing.map(r => (
              <div key={r.assetName} className="card mb-2" style={{ background: 'var(--warning-bg)' }}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold">{r.assetName}</div>
                    <div className="text-xs">
                      الحالي: {(r.currentWeight * 100).toFixed(1)}% | المستهدف: {(r.targetWeight * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="font-bold" style={{ color: 'var(--warning)' }}>
                    {(r.deviation * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* جدول الأصول */}
      <h2 className="text-lg font-bold mb-3">ملخص الأصول</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-right py-2 px-3">الأصل</th>
              <th className="text-right py-2 px-3">الفئة</th>
              <th className="text-right py-2 px-3">السعر</th>
              <th className="text-right py-2 px-3">القيمة</th>
              <th className="text-right py-2 px-3">الربح%</th>
              <th className="text-right py-2 px-3">الوزن</th>
            </tr>
          </thead>
          <tbody>
            {assets.map(a => {
              const val = a.quantity * a.currentPrice;
              const pl = ((a.currentPrice - a.purchasePrice) / a.purchasePrice) * 100;
              const w = totalValue > 0 ? (val / totalValue) * 100 : 0;
              return (
                <tr key={a.id} className="border-b border-gray-50">
                  <td className="py-2 px-3 font-bold">{a.name}</td>
                  <td className="py-2 px-3 text-gray-500">{a.category}</td>
                  <td className="py-2 px-3">${a.currentPrice.toFixed(2)}</td>
                  <td className="py-2 px-3">${val.toFixed(2)}</td>
                  <td className={`py-2 px-3 font-bold ${pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {pl >= 0 ? '+' : ''}{pl.toFixed(1)}%
                  </td>
                  <td className="py-2 px-3">{w.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
