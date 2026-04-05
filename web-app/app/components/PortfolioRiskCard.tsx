'use client';

import { useMemo } from 'react';
import { getAssets, getProfile, getPriceList } from '../lib/store';
import { calculateReturns, volatility, mean, standardDeviation, correlation, valueAtRisk95, maxDrawdown } from '../lib/engine';
import { PortfolioRiskMetrics } from '../lib/types';

export default function PortfolioRiskCard() {
  const assets = getAssets();
  const profile = getProfile();

  const risk = useMemo<PortfolioRiskMetrics | null>(() => {
    if (assets.length === 0) return null;

    const totalValue = assets.reduce((s, a) => s + a.quantity * a.currentPrice, 0);
    const totalPurchase = assets.reduce((s, a) => s + a.quantity * a.purchasePrice, 0);
    const totalPL = totalValue - totalPurchase;
    const cash = profile?.availableCash ?? 0;
    const fullPortfolio = totalValue + cash;

    // عوائد كل أصل
    const assetReturns: { name: string; returns: number[]; weight: number; vol: number }[] = [];
    for (const a of assets) {
      const prices = getPriceList(a.id);
      if (prices.length < 10) continue;
      const ret = calculateReturns(prices);
      const w = fullPortfolio > 0 ? (a.quantity * a.currentPrice) / fullPortfolio : 0;
      const v = volatility(ret, 252);
      assetReturns.push({ name: a.name, returns: ret, weight: w, vol: v });
    }

    // تقلب المحفظة (تقريب: متوسط مرجح بالأوزان)
    let portfolioVol = 0;
    for (const a of assetReturns) {
      portfolioVol += a.weight * a.vol;
    }

    // VaR 95%
    const var95 = valueAtRisk95(fullPortfolio, portfolioVol);

    // محاكاة منحنى رأس المال (من أقدم البيانات)
    const maxLen = Math.max(...assets.map(a => getPriceList(a.id).length), 0);
    const equityCurve: number[] = [];
    for (let day = 0; day < maxLen; day++) {
      let dayValue = cash;
      for (const a of assets) {
        const prices = getPriceList(a.id);
        if (day < prices.length) {
          dayValue += a.quantity * prices[day];
        } else {
          dayValue += a.quantity * a.currentPrice;
        }
      }
      equityCurve.push(dayValue);
    }
    const mdd = maxDrawdown(equityCurve);
    const peak = equityCurve.length > 0 ? Math.max(...equityCurve) : fullPortfolio;
    const currentDD = peak > 0 ? (peak - fullPortfolio) / peak : 0;
    const threshold = profile ? 0.15 : 0.15; // default

    // شارب المحفظة
    const rf = 0.03;
    const portfolioReturn = totalPurchase > 0 ? ((totalValue - totalPurchase) / totalPurchase) : 0;
    const sharpeP = portfolioVol > 0 ? (portfolioReturn - rf) / portfolioVol : 0;

    // مصفوفة الارتباط
    const correlations: { asset1: string; asset2: string; correlation: number }[] = [];
    const warnings: string[] = [];
    for (let i = 0; i < assetReturns.length; i++) {
      for (let j = i + 1; j < assetReturns.length; j++) {
        const corr = correlation(assetReturns[i].returns, assetReturns[j].returns);
        correlations.push({
          asset1: assetReturns[i].name,
          asset2: assetReturns[j].name,
          correlation: corr,
        });
        if (corr > 0.7) {
          warnings.push(`ارتباط عالي (${(corr * 100).toFixed(0)}%) بين ${assetReturns[i].name} و ${assetReturns[j].name} - تنويع ضعيف`);
        }
      }
    }

    // درجة التنويع (عكس متوسط الارتباطات)
    const avgCorr = correlations.length > 0
      ? correlations.reduce((s, c) => s + Math.abs(c.correlation), 0) / correlations.length
      : 0;
    const diversification = Math.max(0, 1 - avgCorr);

    return {
      totalValue: fullPortfolio,
      totalPL,
      totalPLPercent: totalPurchase > 0 ? (totalPL / totalPurchase) * 100 : 0,
      portfolioVolatility: portfolioVol,
      valueAtRisk95: var95,
      maxDrawdown: mdd,
      currentDrawdown: currentDD,
      drawdownAlert: currentDD > threshold,
      sharpePortfolio: sharpeP,
      diversificationScore: diversification,
      correlationWarnings: warnings,
      assetCorrelations: correlations,
    };
  }, [assets, profile]);

  if (!risk || assets.length === 0) return null;

  return (
    <div className="card mb-4">
      <h2 className="font-bold text-lg mb-3">مخاطر المحفظة</h2>

      {/* مقاييس رئيسية */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <MetricCard label="تقلب المحفظة" value={`${(risk.portfolioVolatility * 100).toFixed(1)}%`}
          color={risk.portfolioVolatility < 0.15 ? 'green' : risk.portfolioVolatility < 0.30 ? 'yellow' : 'red'} />
        <MetricCard label="VaR 95% (يومي)" value={`$${risk.valueAtRisk95.toFixed(0)}`}
          color="gray" desc="أقصى خسارة متوقعة في يوم" />
        <MetricCard label="أقصى انخفاض" value={`${(risk.maxDrawdown * 100).toFixed(1)}%`}
          color={risk.maxDrawdown < 0.10 ? 'green' : risk.maxDrawdown < 0.20 ? 'yellow' : 'red'} />
        <MetricCard label="شارب المحفظة" value={risk.sharpePortfolio.toFixed(2)}
          color={risk.sharpePortfolio > 1 ? 'green' : risk.sharpePortfolio > 0 ? 'yellow' : 'red'} />
      </div>

      {/* التنويع */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-sm mb-1">
          <span>التنويع</span>
          <span className="font-bold">{(risk.diversificationScore * 100).toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{
            width: `${risk.diversificationScore * 100}%`,
            background: risk.diversificationScore > 0.6 ? '#22c55e' : risk.diversificationScore > 0.3 ? '#f59e0b' : '#ef4444',
          }} />
        </div>
      </div>

      {/* تحذير الانهيار */}
      {risk.drawdownAlert && (
        <div className="p-2 rounded bg-red-50 border border-red-200 text-sm text-red-700 mb-3">
          تحذير: المحفظة انخفضت {(risk.currentDrawdown * 100).toFixed(1)}% من القمة. يُنصح بتقليص المخاطر.
        </div>
      )}

      {/* تحذيرات الارتباط */}
      {risk.correlationWarnings.length > 0 && (
        <div className="mb-3">
          {risk.correlationWarnings.map((w, i) => (
            <div key={i} className="text-xs text-orange-600 bg-orange-50 p-1.5 rounded mb-1">{w}</div>
          ))}
        </div>
      )}

      {/* مصفوفة الارتباط */}
      {risk.assetCorrelations.length > 0 && (
        <div>
          <div className="text-xs font-bold mb-1 text-gray-500">مصفوفة الارتباط</div>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(risk.assetCorrelations.length, 3)}, 1fr)` }}>
            {risk.assetCorrelations.map((c, i) => (
              <div key={i} className={`text-xs p-1.5 rounded text-center ${
                c.correlation > 0.7 ? 'bg-red-100 text-red-700' :
                c.correlation > 0.3 ? 'bg-yellow-50 text-yellow-700' :
                c.correlation < -0.3 ? 'bg-green-100 text-green-700' :
                'bg-gray-50 text-gray-600'
              }`}>
                <div className="font-bold">{(c.correlation * 100).toFixed(0)}%</div>
                <div className="text-[9px]">{c.asset1} / {c.asset2}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color, desc }: { label: string; value: string; color: string; desc?: string }) {
  const bg = color === 'green' ? 'bg-green-50' : color === 'red' ? 'bg-red-50' : color === 'yellow' ? 'bg-yellow-50' : 'bg-gray-50';
  const text = color === 'green' ? 'text-green-700' : color === 'red' ? 'text-red-700' : color === 'yellow' ? 'text-yellow-700' : 'text-gray-700';
  return (
    <div className={`p-2 rounded ${bg} text-center`}>
      <div className={`font-bold text-lg ${text}`}>{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
      {desc && <div className="text-[9px] text-gray-400">{desc}</div>}
    </div>
  );
}
