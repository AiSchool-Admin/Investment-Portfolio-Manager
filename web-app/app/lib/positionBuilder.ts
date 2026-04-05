/**
 * محرك بناء المراكز - Half-Kelly، DCA، Pyramiding
 * ترجمة من optimizer.py إلى TypeScript
 */

import { PositionBuildingPlan, Tranche, TrancheNotification, SystemSettings, DEFAULT_SYSTEM_SETTINGS } from './types';
import { mean, standardDeviation, calculateReturns, expectedReturn, volatility, calculateZScore, calculateMA, calculateTrendStrength, calculateZScoreAdj, calculateTrend, calculateRSI, rsiToSignal, calculateMomentum, calculateMACD, macdToSignal, sharpeRatio, computeOptimumScore, lowVolatilitySignal } from './engine';

// ============ Half-Kelly Position Sizing ============

export function calculateHalfKellyPositionSize(
  optimumScore: number,
  riskRewardRatio: number,
  portfolioValue: number,
): number {
  // تحويل OS إلى احتمالية
  const p = Math.max(0.01, Math.min(0.99, optimumScore));
  const b = riskRewardRatio;
  if (b <= 0) return 0;

  const kelly = (p * (b + 1) - 1) / b;
  const halfKelly = Math.max(0, kelly / 2);

  // الحد الأقصى 25% من المحفظة لأي أصل جديد
  const capped = Math.min(0.25, halfKelly);
  return capped * portfolioValue;
}

// ============ الأفق الزمني الافتراضي ============

export function getDefaultHorizonDays(assetClass: string, marketVolatility = 0.2): number {
  // تحديد الأيام بناءً على الفئة أو المجموعة الأم
  const categoryMap: Record<string, number> = {
    // أسهم
    'أسهم محلية': 90, 'أسهم أمريكية': 90, 'أسهم أوروبية': 90,
    'أسهم أسواق ناشئة': 120, 'أسهم آسيوية': 90,
    'صناديق أسهم (ETF)': 60, 'صناديق مؤشرات': 60,
    // دخل ثابت
    'سندات حكومية': 120, 'سندات شركات': 120, 'صكوك إسلامية': 120, 'صناديق دخل ثابت': 90,
    // نقد
    'صناديق نقد': 30, 'ودائع بنكية': 30,
    // معادن
    'ذهب': 120, 'فضة': 120, 'بلاتين': 120,
    // سلع
    'نفط وطاقة': 180, 'سلع زراعية': 180, 'سلع صناعية': 180,
    // عقارات
    'عقارات سكنية': 180, 'عقارات تجارية': 180, 'صناديق عقارية (REITs)': 90,
    // عملات رقمية
    'بيتكوين': 60, 'إيثريوم': 60, 'عملات رقمية أخرى': 45, 'عملات مستقرة (Stablecoins)': 30,
    // صناديق
    'صناديق متوازنة': 90, 'صناديق تحوط': 120, 'أسهم خاصة (Private Equity)': 180,
    // أخرى
    'فوركس (عملات أجنبية)': 60, 'خيارات ومشتقات': 45, 'أخرى': 90,
  };
  let days = categoryMap[assetClass] ?? 90;

  if (marketVolatility > 0.3) {
    days = Math.floor(days * 0.7);
  } else if (marketVolatility < 0.15) {
    days = Math.floor(days * 1.3);
  }
  return Math.max(30, Math.min(365, days));
}

// ============ جدولة الدفعات ============

export function suggestTrancheSchedule(
  totalTargetValue: number,
  numTranches: number,
  horizonDays: number,
  startDate: string, // ISO date
  strategy: 'DCA' | 'Pyramiding',
  planId: string,
): Tranche[] {
  if (numTranches <= 0) return [];

  let trancheValues: number[];

  if (strategy === 'DCA') {
    trancheValues = Array(numTranches).fill(totalTargetValue / numTranches);
  } else {
    // Pyramiding: 40%, 30%, 20%, 10% ... للأولى 4، ثم الباقي بالتساوي
    let weights = [0.4, 0.3, 0.2, 0.1];
    if (numTranches > 4) {
      const remaining = 1.0 - weights.reduce((a, b) => a + b, 0);
      const extraWeight = remaining / (numTranches - 4);
      weights = [...weights, ...Array(numTranches - 4).fill(extraWeight)];
    } else {
      weights = weights.slice(0, numTranches);
      const totalW = weights.reduce((a, b) => a + b, 0);
      weights = weights.map(w => w / totalW);
    }
    trancheValues = weights.map(w => totalTargetValue * w);
  }

  const deltaDays = numTranches > 1 ? horizonDays / (numTranches - 1) : horizonDays;
  const start = new Date(startDate);
  const tranches: Tranche[] = [];

  for (let i = 0; i < numTranches; i++) {
    const targetDate = new Date(start);
    targetDate.setDate(targetDate.getDate() + Math.floor(i * deltaDays));

    tranches.push({
      id: crypto.randomUUID(),
      planId,
      number: i + 1,
      value: Math.round(trancheValues[i] * 100) / 100,
      targetDate: targetDate.toISOString().split('T')[0],
      minPrice: null,
      executed: false,
      executedPrice: null,
      executedDate: null,
    });
  }
  return tranches;
}

// ============ نقاط الدخول المحسّنة ============

export function generateEntryPoints(
  historicalPrices: number[],
  currentPrice: number,
  numPoints: number,
): number[] {
  if (historicalPrices.length < 20) {
    return Array.from({ length: numPoints }, (_, i) =>
      Math.round(currentPrice * (0.98 - i * 0.02) * 100) / 100
    );
  }

  const recent = historicalPrices.slice(-50);
  const mu = mean(recent);
  const sigma = standardDeviation(recent);

  const supports = [
    mu - sigma,
    mu - 1.5 * sigma,
    mu - 2 * sigma,
  ].filter(s => s < currentPrice && s > 0);

  while (supports.length < numPoints) {
    supports.push(currentPrice * (0.98 - supports.length * 0.02));
  }

  return supports.slice(0, numPoints).map(s => Math.round(s * 100) / 100);
}

// ============ حساب تقلب السوق من البيانات التاريخية ============

export function calculateMarketVolatility(prices: number[]): number {
  if (prices.length < 10) return 0.2;
  const returns = calculateReturns(prices);
  return volatility(returns, 252);
}

// ============ إنشاء خطة بناء مركز ============

export function createPositionBuildingPlan(
  assetName: string,
  assetCategory: string,
  optimumScore: number,
  portfolioValue: number,
  availableCash: number,
  riskRewardRatio: number,
  strategy: 'DCA' | 'Pyramiding',
  numTranches: number,
  horizonDays: number,
  currentPrice: number,
  historicalPrices: number[] | null,
  assetId: string | null,
): PositionBuildingPlan {
  const planId = crypto.randomUUID();
  const today = new Date().toISOString().split('T')[0];

  // حجم المركز الإجمالي (Half-Kelly)
  let totalTargetValue = calculateHalfKellyPositionSize(
    optimumScore, riskRewardRatio, portfolioValue,
  );
  // لا يتجاوز النقد المتاح
  totalTargetValue = Math.min(totalTargetValue, availableCash);
  totalTargetValue = Math.round(totalTargetValue * 100) / 100;

  // جدولة الدفعات
  const tranches = suggestTrancheSchedule(
    totalTargetValue, numTranches, horizonDays, today, strategy, planId,
  );

  // إضافة نقاط دخول إذا توفرت بيانات تاريخية
  if (historicalPrices && historicalPrices.length > 10) {
    const entryPrices = generateEntryPoints(historicalPrices, currentPrice, numTranches);
    for (let i = 0; i < tranches.length && i < entryPrices.length; i++) {
      tranches[i].minPrice = entryPrices[i];
    }
  }

  return {
    id: planId,
    assetName,
    assetCategory,
    assetId,
    totalTargetValue,
    numTranches,
    tranches,
    strategy,
    horizonDays,
    currentPrice,
    riskRewardRatio,
    optimumScore,
    createdAt: today,
    lastReview: today,
    status: 'active',
  };
}

// ============ إعادة حساب الدفعات المتبقية ============

export function replanRemainingTranches(
  plan: PositionBuildingPlan,
  newAvailableCash: number,
): PositionBuildingPlan {
  const executedValue = plan.tranches
    .filter(t => t.executed)
    .reduce((s, t) => s + t.value, 0);
  const remainingTarget = Math.max(0, plan.totalTargetValue - executedValue);
  const pending = plan.tranches.filter(t => !t.executed);

  if (pending.length === 0) return plan;

  const scalingFactor = newAvailableCash < remainingTarget
    ? newAvailableCash / remainingTarget
    : 1;

  const originalTotal = pending.reduce((s, t) => s + t.value, 0);
  if (originalTotal <= 0) return plan;

  for (const tranche of pending) {
    const weight = tranche.value / originalTotal;
    tranche.value = Math.round(remainingTarget * weight * scalingFactor * 100) / 100;
  }

  plan.lastReview = new Date().toISOString().split('T')[0];
  return { ...plan, tranches: [...plan.tranches] };
}

// ============ تنفيذ دفعة ============

export function executeTranche(
  plan: PositionBuildingPlan,
  trancheNumber: number,
  executedPrice: number,
): PositionBuildingPlan {
  const updated = { ...plan, tranches: plan.tranches.map(t => {
    if (t.number === trancheNumber && !t.executed) {
      return {
        ...t,
        executed: true,
        executedPrice,
        executedDate: new Date().toISOString().split('T')[0],
      };
    }
    return t;
  })};

  // تحقق من الاكتمال
  if (updated.tranches.every(t => t.executed)) {
    updated.status = 'completed';
  }

  return updated;
}

// ============ فحص الإشعارات ============

export function checkTrancheNotifications(
  plans: PositionBuildingPlan[],
): TrancheNotification[] {
  const notifications: TrancheNotification[] = [];
  const today = new Date();
  const twoDaysFromNow = new Date(today);
  twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

  for (const plan of plans) {
    if (plan.status !== 'active') continue;

    for (const tranche of plan.tranches) {
      if (tranche.executed) continue;

      const targetDate = new Date(tranche.targetDate);

      // إشعار قبل يومين من الموعد
      if (targetDate <= twoDaysFromNow && targetDate >= today) {
        notifications.push({
          id: crypto.randomUUID(),
          planId: plan.id,
          trancheNumber: tranche.number,
          assetName: plan.assetName,
          message: `دفعة #${tranche.number} لـ ${plan.assetName} بقيمة $${tranche.value.toFixed(2)} مستحقة في ${tranche.targetDate}`,
          type: 'upcoming_tranche',
          date: today.toISOString().split('T')[0],
          read: false,
        });
      }
    }
  }

  return notifications;
}

// ============ حساب OS لأصل من بيانات تاريخية ============

export function computeOSFromPrices(
  currentPrice: number,
  historicalPrices: number[],
  s: SystemSettings = DEFAULT_SYSTEM_SETTINGS,
): number {
  if (historicalPrices.length < 10) return 0.5;
  const returns = calculateReturns(historicalPrices);
  const zScore = calculateZScore(currentPrice, historicalPrices);
  const ma = calculateMA(historicalPrices, s.maPeriod);
  const ts = calculateTrendStrength(currentPrice, ma);
  const zAdj = calculateZScoreAdj(zScore, ts);
  const trend = calculateTrend(currentPrice, ma);
  const rsi = calculateRSI(historicalPrices, s.rsiPeriod);
  const rsiSig = rsiToSignal(rsi);
  const mom = calculateMomentum(historicalPrices, s.momentumPeriod);
  const macdRes = calculateMACD(historicalPrices, s.macdFast, s.macdSlow, s.macdSignal);
  const macdSig = macdToSignal(macdRes.histogram, currentPrice);
  const expRet = expectedReturn(returns, s.tradingDaysPerYear);
  const vol = volatility(returns, s.tradingDaysPerYear);
  const shr = sharpeRatio(expRet, s.riskFreeRate, vol);
  const lowVolSig = lowVolatilitySignal(vol);
  return computeOptimumScore(shr, zAdj, trend, rsiSig, mom, macdSig, lowVolSig, s.transactionCost, s);
}
