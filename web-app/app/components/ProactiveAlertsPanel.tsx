'use client';

import { useMemo, useState } from 'react';
import { getAssets, getProfile, getPriceList, getPriceHistory, getEffectiveSettings, getPlans, getSystemSettings } from '../lib/store';
import { analyzeAsset } from '../lib/engine';
import { TradingSignal } from '../lib/types';
import { generateProactiveAlerts, ProactiveAlert } from '../lib/proactiveAlerts';

const ICONS: Record<string, string> = {
  opportunity: '💰',
  risk: '⚠️',
  action: '📋',
  info: 'ℹ️',
};

const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  critical: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800' },
  high: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-800' },
  medium: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800' },
  low: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: 'حرج',
  high: 'مهم',
  medium: 'متوسط',
  low: 'منخفض',
};

export default function ProactiveAlertsPanel({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const assets = getAssets();
  const profile = getProfile();
  const settings = getSystemSettings();
  const plans = getPlans();
  const totalValue = assets.reduce((s, a) => s + a.quantity * a.currentPrice, 0);
  const cash = profile?.availableCash ?? 0;

  const signals = useMemo<TradingSignal[]>(() => {
    return assets.map(a => {
      const prices = getPriceList(a.id);
      if (prices.length < 10) return null;
      const effectiveSettings = getEffectiveSettings(a.id, a.category);
      return analyzeAsset(a.name, a.id, a.currentPrice, prices, a.quantity, totalValue, a.targetWeight, cash, a.purchasePrice, effectiveSettings);
    }).filter(Boolean) as TradingSignal[];
  }, [assets, totalValue, cash]);

  // جمع البيانات التاريخية لكشف البيانات القديمة
  const priceHistories = useMemo(() => {
    const h: Record<string, { date: string; close: number }[]> = {};
    for (const a of assets) h[a.id] = getPriceHistory(a.id);
    return h;
  }, [assets]);

  const allAlerts = useMemo(() =>
    generateProactiveAlerts(assets, signals, plans, settings, cash, priceHistories),
    [assets, signals, plans, settings, cash, priceHistories]
  );

  const alerts = allAlerts.filter(a => !dismissed.has(a.id));
  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const highCount = alerts.filter(a => a.severity === 'high').length;
  const visibleAlerts = showAll ? alerts : alerts.slice(0, 5);

  if (alerts.length === 0) return null;

  return (
    <div className="mb-6">
      {/* رأس التنبيهات */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-lg">التنبيهات الاستباقية</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">
            {alerts.length}
          </span>
          {criticalCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-600 text-white font-bold animate-pulse">
              {criticalCount} حرج
            </span>
          )}
          {highCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500 text-white font-bold">
              {highCount} مهم
            </span>
          )}
        </div>
        {alerts.length > 5 && (
          <button className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
            onClick={() => setShowAll(!showAll)}>
            {showAll ? 'عرض أقل' : `عرض الكل (${alerts.length})`}
          </button>
        )}
      </div>

      {/* قائمة التنبيهات */}
      <div className="space-y-2">
        {visibleAlerts.map(alert => {
          const style = SEVERITY_STYLES[alert.severity];
          return (
            <div key={alert.id} className={`flex items-start gap-2 p-3 rounded-lg border ${style.bg} ${style.border}`}>
              <span className="text-lg mt-0.5">{ICONS[alert.type]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`font-bold text-sm ${style.text}`}>{alert.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${style.bg} ${style.text} border ${style.border}`}>
                    {SEVERITY_LABELS[alert.severity]}
                  </span>
                </div>
                <div className="text-xs text-gray-600">{alert.message}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {alert.actionLabel && alert.actionTab && onNavigate && (
                  <button
                    className="text-xs px-2 py-1 rounded bg-white border border-gray-200 hover:bg-gray-50 cursor-pointer font-bold"
                    onClick={() => onNavigate(alert.actionTab!)}
                  >
                    {alert.actionLabel}
                  </button>
                )}
                <button
                  className="text-xs px-1.5 py-1 text-gray-400 hover:text-gray-600 cursor-pointer"
                  onClick={() => setDismissed(prev => new Set([...prev, alert.id]))}
                  title="تجاهل"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
