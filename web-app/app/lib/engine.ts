/**
 * محرك Optimum Score المحسّن - متعدد العوامل
 * العوامل: Sharpe + Z_adj + Trend + RSI + Momentum + MACD - Cost
 * كل المعاملات ديناميكية من الإعدادات
 */

import { TradingSignal, BacktestResult, BacktestTrade, RebalanceItem, SystemSettings } from './types';

// ============ دوال إحصائية ============

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const sumSq = values.reduce((s, v) => s + (v - avg) ** 2, 0);
  return Math.sqrt(sumSq / (values.length - 1));
}

export function calculateReturns(prices: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] !== 0) r.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  return r;
}

// ============ مؤشرات مالية ============

export function calculateZScore(currentPrice: number, historicalPrices: number[]): number {
  if (historicalPrices.length < 2) return 0;
  const mu = mean(historicalPrices);
  const sigma = standardDeviation(historicalPrices);
  if (sigma === 0) return 0;
  return (currentPrice - mu) / sigma;
}

export function calculateMA(prices: number[], period: number): number {
  if (prices.length < period) return mean(prices);
  return mean(prices.slice(-period));
}

export function calculateTrendStrength(currentPrice: number, ma: number): number {
  if (ma === 0) return 0;
  const raw = (currentPrice - ma) / ma;
  // تضخيم: ×5 لجعل انحرافات صغيرة (3%) تعطي تأثير كبير (15%)
  return Math.max(0, Math.min(1, raw * 5));
}

export function calculateZScoreAdj(zScore: number, trendStrength: number): number {
  // في الاتجاه الصاعد القوي: Z-Score الإيجابي يُخفَّض بشكل كبير
  // trendStrength = 0.5 → Z يُخفَّض 50%
  // trendStrength = 1.0 → Z يُخفَّض 100% (يصبح صفر)
  const dampened = zScore * (1 - trendStrength);
  // لا نسمح لـ Z_adj أن يكون أكثر من 1.5 في الاتجاه الصاعد
  if (trendStrength > 0.2 && dampened > 1.5) return 1.5;
  return dampened;
}

export function calculateTrend(currentPrice: number, ma: number): number {
  if (ma === 0) return 0;
  const diff = (currentPrice - ma) / ma;
  if (diff > 0.01) return 1;   // فوق المتوسط بوضوح
  if (diff < -0.01) return -1; // تحت المتوسط بوضوح
  return 0;                    // متقاطع
}

export function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// تحويل RSI إلى قيمة بين -1 و +1
// RSI < 30 → +1 (تشبع بيعي = فرصة شراء)
// RSI > 70 → -1 (تشبع شرائي = فرصة بيع)
export function rsiToSignal(rsi: number): number {
  if (rsi <= 30) return 1;
  if (rsi >= 70) return -1;
  // تدرج خطي بين 30 و 70
  return 1 - (rsi - 30) / 20; // 30→1, 50→0, 70→-1
}

export function calculateMomentum(prices: number[], period = 10): number {
  if (prices.length < period + 1) return 0;
  const current = prices[prices.length - 1];
  const past = prices[prices.length - 1 - period];
  if (past === 0) return 0;
  const raw = (current - past) / past;
  return Math.max(-1, Math.min(1, raw * 10)); // تطبيع إلى [-1, 1]
}

// MACD: الفرق بين EMA السريع والبطيء، مقارنة بخط الإشارة
export function calculateEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  if (prices.length < period) return mean(prices);
  const k = 2 / (period + 1);
  let ema = mean(prices.slice(0, period));
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

export function calculateMACD(prices: number[], fast = 12, slow = 26, signal = 9): { macdLine: number; signalLine: number; histogram: number } {
  if (prices.length < slow + signal) return { macdLine: 0, signalLine: 0, histogram: 0 };

  // حساب MACD لكل يوم للحصول على خط الإشارة
  const macdValues: number[] = [];
  for (let i = slow; i <= prices.length; i++) {
    const slice = prices.slice(0, i);
    const emaFast = calculateEMA(slice, fast);
    const emaSlow = calculateEMA(slice, slow);
    macdValues.push(emaFast - emaSlow);
  }

  const macdLine = macdValues[macdValues.length - 1];
  const signalLine = macdValues.length >= signal ? calculateEMA(macdValues, signal) : macdLine;
  const histogram = macdLine - signalLine;

  return { macdLine, signalLine, histogram };
}

// تحويل MACD إلى قيمة بين -1 و +1
export function macdToSignal(histogram: number, currentPrice: number): number {
  if (currentPrice === 0) return 0;
  const normalized = histogram / currentPrice * 100; // تطبيع نسبي
  return Math.max(-1, Math.min(1, normalized * 10));
}

// عامل التقلب المنخفض: الأصول المستقرة تحصل على قيمة أعلى
// تقلب < 10% → +1 (ممتاز)، تقلب > 40% → -1 (خطر)
export function lowVolatilitySignal(vol: number): number {
  if (vol <= 0) return 0;
  const targetVol = 0.15;
  const signal = (targetVol - vol) / targetVol;
  return Math.max(-1, Math.min(1, signal));
}

// ============ ADX - مؤشر قوة الاتجاه ============
// ADX < 20 → سوق متذبذب | ADX ≥ 20 → سوق ذو اتجاه

export function calculateADX(prices: number[], period = 14): number {
  if (prices.length < period * 2 + 1) return 25; // افتراضي: اتجاه
  const len = prices.length;

  // حساب True Range و +DM و -DM
  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < len; i++) {
    const high = prices[i];
    const low = prices[i]; // نستخدم close كتقريب (لا يوجد high/low)
    const prevHigh = prices[i - 1];
    const prevLow = prices[i - 1];
    const prevClose = prices[i - 1];

    // True Range (تقريب باستخدام close فقط)
    tr.push(Math.abs(prices[i] - prices[i - 1]));

    // +DM و -DM
    const upMove = high - prevHigh;
    const downMove = prevLow - low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  if (tr.length < period) return 25;

  // متوسط متحرك أسي
  const smooth = (arr: number[], p: number): number[] => {
    const result: number[] = [];
    let sum = 0;
    for (let i = 0; i < p && i < arr.length; i++) sum += arr[i];
    result.push(sum);
    for (let i = p; i < arr.length; i++) {
      result.push(result[result.length - 1] - result[result.length - 1] / p + arr[i]);
    }
    return result;
  };

  const smoothTR = smooth(tr, period);
  const smoothPlusDM = smooth(plusDM, period);
  const smoothMinusDM = smooth(minusDM, period);

  const minLen = Math.min(smoothTR.length, smoothPlusDM.length, smoothMinusDM.length);
  if (minLen === 0) return 25;

  // حساب +DI و -DI
  const dx: number[] = [];
  for (let i = 0; i < minLen; i++) {
    if (smoothTR[i] === 0) continue;
    const plusDI = (smoothPlusDM[i] / smoothTR[i]) * 100;
    const minusDI = (smoothMinusDM[i] / smoothTR[i]) * 100;
    const diSum = plusDI + minusDI;
    if (diSum > 0) {
      dx.push(Math.abs(plusDI - minusDI) / diSum * 100);
    }
  }

  if (dx.length < period) return dx.length > 0 ? mean(dx) : 25;

  // ADX = متوسط DX
  return mean(dx.slice(-period));
}

// تحديد نوع السوق: متذبذب أو ذو اتجاه
export type MarketRegime = 'trending' | 'ranging';

// كشف التذبذب بعدة طرق (أكثر دقة من ADX وحده)
export function detectMarketRegime(prices: number[], adxThreshold = 20, maPeriod = 50): MarketRegime {
  if (prices.length < maPeriod + 10) return 'trending'; // بيانات غير كافية

  const adx = calculateADX(prices);

  // طريقة إضافية: عدد تقاطعات المتوسط المتحرك
  // إذا السعر تقاطع مع MA عدة مرات → متذبذب
  const recent = prices.slice(-maPeriod);
  const ma = mean(recent);
  let crossings = 0;
  for (let i = 1; i < recent.length; i++) {
    if ((recent[i] > ma && recent[i - 1] <= ma) || (recent[i] < ma && recent[i - 1] >= ma)) {
      crossings++;
    }
  }

  // طريقة إضافية: العائد الصافي مقارنة بالتقلب
  // عائد صافي صغير + تقلب عالي = متذبذب
  const netReturn = Math.abs((prices[prices.length - 1] - prices[prices.length - maPeriod]) / prices[prices.length - maPeriod]);
  const vol = standardDeviation(calculateReturns(recent));
  const efficiencyRatio = vol > 0 ? netReturn / (vol * Math.sqrt(maPeriod)) : 1;

  // متذبذب إذا: ADX < عتبة أو تقاطعات كثيرة أو عائد صافي ضعيف
  if (adx < adxThreshold) return 'ranging';
  if (crossings >= 4) return 'ranging';
  if (efficiencyRatio < 0.3) return 'ranging';

  return 'trending';
}

// ============ Bollinger Bands ============

export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
  width: number;       // عرض النطاق (نسبة)
  percentB: number;    // موقع السعر داخل النطاق (0-1)
}

export function calculateBollingerBands(prices: number[], period = 20, stdMultiplier = 2): BollingerBands {
  if (prices.length < period) {
    const m = mean(prices);
    return { upper: m, middle: m, lower: m, width: 0, percentB: 0.5 };
  }

  const recent = prices.slice(-period);
  const middle = mean(recent);
  const std = standardDeviation(recent);
  const upper = middle + stdMultiplier * std;
  const lower = middle - stdMultiplier * std;
  const currentPrice = prices[prices.length - 1];
  const width = middle > 0 ? (upper - lower) / middle : 0;
  const percentB = upper !== lower ? (currentPrice - lower) / (upper - lower) : 0.5;

  return { upper, middle, lower, width, percentB };
}

// تحويل Bollinger إلى إشارة (-1 إلى +1)
// السعر عند الحد السفلي → +1 (فرصة شراء)
// السعر عند الحد العلوي → -1 (فرصة بيع)
export function bollingerToSignal(percentB: number): number {
  if (percentB <= 0) return 1;    // تحت الحد السفلي
  if (percentB >= 1) return -1;   // فوق الحد العلوي
  return 1 - percentB * 2;        // خطي: 0→1, 0.5→0, 1→-1
}

// مصفوفة الارتباط بين أصلين
export function correlation(returns1: number[], returns2: number[]): number {
  const n = Math.min(returns1.length, returns2.length);
  if (n < 5) return 0;
  const r1 = returns1.slice(-n), r2 = returns2.slice(-n);
  const m1 = mean(r1), m2 = mean(r2);
  let cov = 0, var1 = 0, var2 = 0;
  for (let i = 0; i < n; i++) {
    cov += (r1[i] - m1) * (r2[i] - m2);
    var1 += (r1[i] - m1) ** 2;
    var2 += (r2[i] - m2) ** 2;
  }
  const denom = Math.sqrt(var1 * var2);
  return denom === 0 ? 0 : cov / denom;
}

// VaR 95% (Parametric) - أقصى خسارة متوقعة في يوم بثقة 95%
export function valueAtRisk95(portfolioValue: number, portfolioVol: number): number {
  const z95 = 1.645; // Z-score for 95% confidence
  const dailyVol = portfolioVol / Math.sqrt(252);
  return portfolioValue * dailyVol * z95;
}

// أقصى انخفاض من القمة (Max Drawdown)
export function maxDrawdown(equityCurve: number[]): number {
  if (equityCurve.length < 2) return 0;
  let peak = equityCurve[0];
  let maxDD = 0;
  for (const val of equityCurve) {
    if (val > peak) peak = val;
    const dd = (peak - val) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

export function expectedReturn(returns: number[], tradingDays = 252): number {
  if (returns.length === 0) return 0;
  return mean(returns) * tradingDays;
}

export function volatility(returns: number[], tradingDays = 252): number {
  if (returns.length < 2) return 0;
  return standardDeviation(returns) * Math.sqrt(tradingDays);
}

export function sharpeRatio(expRet: number, rf: number, vol: number): number {
  if (vol === 0) return 0;
  return (expRet - rf) / vol;
}

// ============ Optimum Score المحسّن ============

export function computeOptimumScore(
  sharpe: number, zScoreAdj: number, trend: number,
  rsiSignal: number, momentum: number, macdSignal: number,
  lowVolSig: number, cost: number, s: SystemSettings,
): number {
  const osRaw = s.alpha * sharpe
    + s.beta * (-zScoreAdj)
    + s.delta * trend
    + s.epsilon * rsiSignal
    + s.zeta * momentum
    + s.eta * macdSignal
    + s.theta * lowVolSig
    - s.gamma * cost;

  // تطبيع باستخدام Sigmoid
  const os = 1 / (1 + Math.exp(-s.sigmoidK * osRaw));
  return Math.max(0, Math.min(1, os));
}

// درجة الثقة: نسبة العوامل المتوافقة على نفس الاتجاه
export function calculateConfidence(
  signalType: 'buy' | 'sell' | 'none',
  sharpe: number, zScoreAdj: number, trend: number,
  rsiSignal: number, momentum: number, macdSignal: number,
  lowVolSig: number,
): number {
  if (signalType === 'none') return 0;

  const factors = [
    signalType === 'buy' ? sharpe > 0 : sharpe < 0,
    signalType === 'buy' ? zScoreAdj < 0 : zScoreAdj > 0,
    signalType === 'buy' ? trend > 0 : trend < 0,
    signalType === 'buy' ? rsiSignal > 0 : rsiSignal < 0,
    signalType === 'buy' ? momentum > 0 : momentum < 0,
    signalType === 'buy' ? macdSignal > 0 : macdSignal < 0,
    lowVolSig > 0, // تقلب منخفض يدعم كلا الاتجاهين (أصل مستقر)
  ];

  return factors.filter(Boolean).length / factors.length;
}

// ============ حجم الصفقة ============

export function calculateBuyOrder(
  targetWeight: number, currentWeight: number,
  portfolioValue: number, availableCash: number,
  currentPrice: number, cashRatio: number,
): { quantity: number; value: number } {
  const rebalanceAmt = (targetWeight - currentWeight) * portfolioValue;
  if (rebalanceAmt <= 0) return { quantity: 0, value: 0 };
  const suggested = Math.min(rebalanceAmt, availableCash * cashRatio);
  if (suggested <= 0 || currentPrice <= 0) return { quantity: 0, value: 0 };
  return { quantity: suggested / currentPrice, value: suggested };
}

export function calculateSellOrder(
  assetQty: number, currentPrice: number,
  currentWeight: number, targetWeight: number,
  portfolioValue: number, mode: 'rebalance' | 'half' | 'quarter' | 'all',
): { quantity: number; value: number } {
  let qty: number;
  switch (mode) {
    case 'all': qty = assetQty; break;
    case 'half': qty = assetQty * 0.5; break;
    case 'quarter': qty = assetQty * 0.25; break;
    default: {
      const excess = (currentWeight - targetWeight) * portfolioValue;
      if (excess <= 0) return { quantity: 0, value: 0 };
      qty = Math.min(excess / currentPrice, assetQty);
    }
  }
  return { quantity: qty, value: qty * currentPrice };
}

// ============ تحليل أصل كامل (محسّن) ============

export function analyzeAsset(
  assetName: string, assetId: string,
  currentPrice: number, historicalPrices: number[],
  quantityHeld: number, portfolioValue: number,
  targetWeight: number, availableCash: number,
  purchasePrice: number,
  s: SystemSettings,
): TradingSignal {
  const returns = calculateReturns(historicalPrices);
  const expRet = expectedReturn(returns, s.tradingDaysPerYear);
  const vol = volatility(returns, s.tradingDaysPerYear);

  // العوامل
  const zScore = calculateZScore(currentPrice, historicalPrices);
  const ma = calculateMA(historicalPrices, s.maPeriod);
  const trendStrength = calculateTrendStrength(currentPrice, ma);
  const zScoreAdj = calculateZScoreAdj(zScore, trendStrength);
  const trend = calculateTrend(currentPrice, ma);
  const rsi = calculateRSI(historicalPrices, s.rsiPeriod);
  const rsiSig = rsiToSignal(rsi);
  const momentum = calculateMomentum(historicalPrices, s.momentumPeriod);
  const macdResult = calculateMACD(historicalPrices, s.macdFast, s.macdSlow, s.macdSignal);
  const macdSig = macdToSignal(macdResult.histogram, currentPrice);
  const shr = sharpeRatio(expRet, s.riskFreeRate, vol);
  const lowVolSig = lowVolatilitySignal(vol);

  // كشف نوع السوق (متذبذب أو ذو اتجاه)
  const adx = calculateADX(historicalPrices, s.adxPeriod);
  const regime = detectMarketRegime(historicalPrices, s.adxThreshold, s.maPeriod);
  const bb = calculateBollingerBands(historicalPrices, s.bollingerPeriod, s.bollingerStdDev);
  const bbSignal = bollingerToSignal(bb.percentB);

  // اختيار الأوزان حسب نوع السوق
  const effectiveSettings = regime === 'ranging' ? {
    ...s,
    alpha: s.rangingAlpha, beta: s.rangingBeta, delta: s.rangingDelta,
    epsilon: s.rangingEpsilon, zeta: s.rangingZeta, eta: s.rangingEta,
    theta: s.rangingTheta, gamma: s.rangingGamma,
  } : s;

  // في السوق المتذبذب: عكس الاتجاه والزخم وMACD (mean-reversion)
  const effTrend = regime === 'ranging' ? -trend : trend;
  const effMomentum = regime === 'ranging' ? -momentum : momentum;
  const effMacdSig = regime === 'ranging' ? -macdSig : macdSig;

  // حساب OS بالأوزان المناسبة
  const os = computeOptimumScore(shr, zScoreAdj, effTrend, rsiSig, effMomentum, effMacdSig, lowVolSig, s.transactionCost, effectiveSettings);

  // عتبات حسب نوع السوق
  const buyTh = regime === 'ranging' ? s.rangingBuyThreshold : s.buyThreshold;
  const sellTh = regime === 'ranging' ? s.rangingSellThreshold : s.sellThreshold;

  // الأوزان
  const currentValue = quantityHeld * currentPrice;
  const effPV = portfolioValue > 0 ? portfolioValue : currentValue + availableCash;
  const currentWeight = effPV > 0 ? currentValue / effPV : 0;

  // Trailing Stop + Hard Stop Loss
  const profitPct = purchasePrice > 0 ? (currentPrice - purchasePrice) / purchasePrice : 0;
  const lossPct = purchasePrice > 0 ? (purchasePrice - currentPrice) / purchasePrice : 0;

  // تحديد الإشارة
  let signalType: 'buy' | 'sell' | 'none' = 'none';
  let signalSource: 'os' | 'trailing_stop' | 'force_rebalance' = 'os';
  let suggestedQuantity = 0, suggestedValue = 0;
  const reasons: string[] = [];

  // 0. وقف خسارة ديناميكي (حسب نوع السوق)
  const dynamicStopLoss = regime === 'ranging'
    ? Math.max(s.hardStopLossPercent * 2, vol / Math.sqrt(s.tradingDaysPerYear) * 5)
    : s.hardStopLossPercent;
  if (s.hardStopLossEnabled && lossPct >= dynamicStopLoss && quantityHeld > 0) {
    signalType = 'sell';
    signalSource = 'trailing_stop';
    reasons.push(`وقف خسارة: انخفض ${(lossPct * 100).toFixed(1)}% (حد ${(dynamicStopLoss * 100).toFixed(0)}% - ${regime === 'ranging' ? 'ديناميكي' : 'ثابت'})`);
    const order = calculateSellOrder(quantityHeld, currentPrice, currentWeight, targetWeight, effPV, 'all');
    suggestedQuantity = order.quantity;
    suggestedValue = order.value;
  }

  // 1. Trailing Stop
  if (signalType === 'none' && s.trailingStopEnabled && profitPct > s.trailingStopProfitTrigger && quantityHeld > 0) {
    const maxPrice = Math.max(...historicalPrices.slice(-60));
    const dropFromMax = maxPrice > 0 ? (maxPrice - currentPrice) / maxPrice : 0;
    if (dropFromMax >= s.trailingStopDistance) {
      signalType = 'sell';
      signalSource = 'trailing_stop';
      reasons.push(`Trailing Stop: ربح ${(profitPct * 100).toFixed(1)}% لكن انخفض ${(dropFromMax * 100).toFixed(1)}% من القمة`);
      const order = calculateSellOrder(quantityHeld, currentPrice, currentWeight, targetWeight, effPV, s.sellMode);
      suggestedQuantity = order.quantity;
      suggestedValue = order.value;
    }
  }

  // 2. جني أرباح عند 15% + Z إيجابي
  if (signalType === 'none' && profitPct >= 0.15 && zScoreAdj > 0.5 && quantityHeld > 0) {
    signalType = 'sell';
    signalSource = 'os';
    reasons.push(`جني أرباح: ربح ${(profitPct * 100).toFixed(1)}% + Z_adj ${zScoreAdj.toFixed(2)} > 0.5 (سعر فوق المتوسط)`);
    const order = calculateSellOrder(quantityHeld, currentPrice, currentWeight, targetWeight, effPV, 'half');
    suggestedQuantity = order.quantity;
    suggestedValue = order.value;
  }

  // 3. شراء - طريقتان:
  //    أ) Mean Reversion: خوف شديد (Z منخفض، RSI منخفض، Bollinger منخفض)
  //    ب) Trend Following: اتجاه صاعد قوي ومستمر (للأصول الصاعدة بثبات)
  if (signalType === 'none') {
    const deepValue = zScoreAdj < -1.5;
    const oversold = rsi < 30;
    const nearBollingerLow = bb.percentB < 0.15;
    const strongOS = os >= s.buyThreshold;

    // اتجاه صاعد قوي: فوق MA + شارب إيجابي + زخم إيجابي
    const strongUptrend = trend > 0 && shr > 0.5 && momentum > 0 && adx >= 20;

    if (strongOS && (deepValue || oversold || nearBollingerLow || strongUptrend)) {
      signalType = 'buy';
      if (strongUptrend && !deepValue && !oversold && !nearBollingerLow) {
        reasons.push(`OS ${(os * 100).toFixed(0)}% + اتجاه صاعد قوي (Sharpe ${shr.toFixed(2)}, ADX ${adx.toFixed(0)})`);
        reasons.push(`شراء اتباع الاتجاه (Trend Following)`);
      } else {
        reasons.push(`OS ${(os * 100).toFixed(0)}% ≥ ${(s.buyThreshold * 100).toFixed(0)}% [${regime}]`);
      }
      if (deepValue) reasons.push(`Z_adj ${zScoreAdj.toFixed(2)} ← سعر أقل بكثير من المتوسط (فرصة)`);
      if (oversold) reasons.push(`RSI ${rsi.toFixed(0)} ← تشبع بيعي شديد`);
      if (nearBollingerLow) reasons.push(`Bollinger ${(bb.percentB * 100).toFixed(0)}% ← قرب الدعم`);
      if (trend > 0) reasons.push(`الاتجاه صاعد (فوق MA${s.maPeriod})`);
      const order = calculateBuyOrder(targetWeight, currentWeight, effPV, availableCash, currentPrice, s.buyOrderCashRatio);
      suggestedQuantity = order.quantity;
      suggestedValue = order.value;
      if (suggestedQuantity <= 0) reasons.push('لا حاجة للشراء - الوزن متوافق أو لا يوجد نقد كافٍ');
    }
    // 4. بيع عند الطمع الشديد
    //    OS منخفض + (سعر مرتفع جداً أو RSI مرتفع) = فرصة بيع
    else if (os <= s.sellThreshold && quantityHeld > 0) {
      const overvalued = zScoreAdj > 1.5;
      const overbought = rsi > 70;
      const nearBollingerHigh = bb.percentB > 0.85;

      if (overvalued || overbought || nearBollingerHigh) {
        signalType = 'sell';
        reasons.push(`OS ${(os * 100).toFixed(0)}% ≤ ${(s.sellThreshold * 100).toFixed(0)}% [${regime}]`);
        if (overvalued) reasons.push(`Z_adj ${zScoreAdj.toFixed(2)} ← سعر أعلى بكثير من المتوسط`);
        if (overbought) reasons.push(`RSI ${rsi.toFixed(0)} ← تشبع شرائي`);
        if (nearBollingerHigh) reasons.push(`Bollinger ${(bb.percentB * 100).toFixed(0)}% ← قرب المقاومة`);
        const order = calculateSellOrder(quantityHeld, currentPrice, currentWeight, targetWeight, effPV, s.sellMode);
        suggestedQuantity = order.quantity;
        suggestedValue = order.value;
      } else {
        reasons.push(`OS ${(os * 100).toFixed(0)}% منخفض لكن بدون تأكيد (Z/RSI/Bollinger)`);
      }
    }
    // 5. لا إشارة
    else {
      reasons.push(`OS ${(os * 100).toFixed(0)}% [${regime}] - انتظار`);
      if (deepValue && !strongOS) reasons.push(`سعر منخفض لكن OS غير كافٍ`);
    }
  }

  // درجة الثقة
  const confidence = calculateConfidence(signalType, shr, zScoreAdj, trend, rsiSig, momentum, macdSig, lowVolSig);

  return {
    assetName, assetId, signalType, signalSource, optimumScore: os, confidence,
    factors: {
      sharpe: shr, zScore, zScoreAdj, trend, trendStrength,
      rsi, rsiSignal: rsiSig, momentum, macd: macdSig, lowVolSignal: lowVolSig, ma50: ma,
      adx, regime, bollingerPercentB: bb.percentB,
    },
    expectedReturn: expRet, volatility: vol, currentPrice,
    currentWeight, targetWeight, suggestedQuantity, suggestedValue, reasons,
  };
}

// ============ إعادة التوازن ============

export function checkRebalancing(
  names: string[], currentWeights: number[], targetWeights: number[], threshold: number,
): RebalanceItem[] {
  const items: RebalanceItem[] = [];
  for (let i = 0; i < names.length; i++) {
    const dev = Math.abs(currentWeights[i] - targetWeights[i]);
    if (dev > threshold) {
      items.push({ assetName: names[i], currentWeight: currentWeights[i], targetWeight: targetWeights[i], deviation: dev });
    }
  }
  return items;
}

// ============ تحسين الأوزان (Monte Carlo) ============

export function optimizeWeights(
  expectedReturns: number[], covMatrix: number[][], rf: number, iterations: number,
): number[] {
  const n = expectedReturns.length;
  if (n === 0) return [];
  if (n === 1) return [1];
  let bestWeights = new Array(n).fill(1 / n);
  let bestSharpe = -Infinity;
  const rng = mulberry32(42);
  for (let iter = 0; iter < iterations; iter++) {
    const raw = Array.from({ length: n }, () => rng());
    const sum = raw.reduce((a, b) => a + b, 0);
    const w = raw.map(v => v / sum);
    let pRet = 0;
    for (let i = 0; i < n; i++) pRet += w[i] * expectedReturns[i];
    let pVar = 0;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) pVar += w[i] * w[j] * covMatrix[i][j];
    const pVol = Math.sqrt(pVar);
    if (pVol > 0) {
      const s = (pRet - rf) / pVol;
      if (s > bestSharpe) { bestSharpe = s; bestWeights = [...w]; }
    }
  }
  return bestWeights;
}

// ============ SMA - المتوسط المتحرك البسيط ============

export function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices.length > 0 ? mean(prices) : 0;
  return mean(prices.slice(-period));
}

// ============ ATR المبسط (بدون High/Low) ============

export function calculateATR(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 0;
  let trSum = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    trSum += Math.abs(prices[i] - prices[i - 1]);
  }
  return trSum / period;
}

// ============ باك تيست - استراتيجية Claude + DeepSeek النهائية ============
// 1. Pyramiding في الصاعد (20% + 20% + 20% = حد أقصى 60%)
// 2. فلتر SMA100 + ADX للاتجاه (يمنع الشراء عند القمم)
// 3. تأكيد ثلاثي للارتداد (Z < -1.5 و RSI < 30 و Bollinger السفلي)

export function runBacktest(
  prices: number[], initialCapital: number, settings: SystemSettings,
): BacktestResult {
  const { transactionCost: cost } = settings;

  if (prices.length < 50) {
    return { totalReturn: 0, buyAndHoldReturn: 0, numberOfTrades: 0, winRate: 0, trades: [], equityCurve: [initialCapital] };
  }

  const dataLength = prices.length;
  const slowPeriod = Math.min(200, Math.max(50, Math.floor(dataLength * 0.3)));
  const fastPeriod = Math.max(10, Math.floor(slowPeriod * 0.4));
  const sma100Period = Math.min(100, Math.max(30, Math.floor(dataLength * 0.5)));

  let cash = initialCapital, holdings = 0;
  let avgBuyPrice = 0;
  let position: 'none' | 'long' = 'none';
  let pyramidCount = 0;
  let peakPrice = 0; // أعلى سعر منذ الشراء (لشبكة الأمان)
  const maxPyramid = 3;
  const pyramidRatio = 0.20; // 20% من النقد لكل دفعة
  const trades: BacktestTrade[] = [];
  const equityCurve: number[] = [initialCapital];
  let lastTradeDay = -20;
  const cooldownDays = 10;
  const warmupDays = slowPeriod;

  for (let i = fastPeriod; i < prices.length; i++) {
    const cp = prices[i];
    const allPrices = prices.slice(0, i + 1);
    const daysSinceLastTrade = i - lastTradeDay;
    const isWarmup = i < warmupDays;

    const smaFast = calculateSMA(allPrices, fastPeriod);
    const smaSlow = calculateSMA(allPrices, Math.min(slowPeriod, allPrices.length));
    const sma100 = calculateSMA(allPrices, Math.min(sma100Period, allPrices.length));
    const rsi = calculateRSI(allPrices, 14);
    const bb = calculateBollingerBands(allPrices, 20, 2);
    const zScore = calculateZScore(cp, allPrices.slice(-Math.min(50, allPrices.length)));
    const adx = calculateADX(allPrices, 14);
    const atr = calculateATR(allPrices, 14);

    const dynamicStopLoss = cp > 0 ? Math.min(0.08, Math.max(0.03, 2 * atr / cp)) : 0.05;

    // === فلتر المدة: كم يوم متواصلة SMA_fast > SMA_slow? (Claude + DeepSeek) ===
    let consecutiveTrendDays = 0;
    for (let j = i; j >= Math.max(fastPeriod, i - 40); j--) {
      const pSlice = prices.slice(0, j + 1);
      const sf = calculateSMA(pSlice, fastPeriod);
      const ss = calculateSMA(pSlice, Math.min(slowPeriod, pSlice.length));
      if (sf > ss) consecutiveTrendDays++;
      else break;
    }

    // === تصنيف السوق (Gemini: فلتر ديناميكي حسب قوة ADX) ===
    // ADX > 35 = زخم انفجاري → 7 أيام تأكيد فقط
    // ADX 25-35 = اتجاه عادي → 20 يوم تأكيد
    const confirmDays = adx >= 35 ? 15 : 20;
    const isConfirmedTrend = adx >= 25 && consecutiveTrendDays >= confirmDays;
    const isRanging = adx < 25 || consecutiveTrendDays < Math.min(10, confirmDays);

    const displayOS = isConfirmedTrend ? (cp > smaSlow ? 0.8 : 0.2) : 0.5;

    // تتبع أعلى سعر منذ الشراء
    if (position === 'long' && cp > peakPrice) peakPrice = cp;

    // ===== وقف خسارة ذكي حسب نوع الصفقة (DeepSeek الحل 2) =====
    if (position === 'long' && avgBuyPrice > 0) {
      if (isConfirmedTrend) {
        // اتجاه مؤكد: لا وقف خسارة ATR! فقط شبكة أمان 20% من القمة
        const drawdownFromPeak = peakPrice > 0 ? (peakPrice - cp) / peakPrice : 0;
        if (drawdownFromPeak >= 0.20) {
          const val = holdings * cp;
          cash += val - val * cost;
          trades.push({ type: 'sell', price: cp, quantity: holdings, value: val, dayIndex: i, os: displayOS });
          holdings = 0; avgBuyPrice = 0; position = 'none'; pyramidCount = 0; peakPrice = 0;
          lastTradeDay = i;
          equityCurve.push(cash);
          continue;
        }
      } else {
        // غير مؤكد: وقف خسارة ATR عادي
        const loss = (avgBuyPrice - cp) / avgBuyPrice;
        if (loss >= dynamicStopLoss) {
          const val = holdings * cp;
          cash += val - val * cost;
          trades.push({ type: 'sell', price: cp, quantity: holdings, value: val, dayIndex: i, os: displayOS });
          holdings = 0; avgBuyPrice = 0; position = 'none'; pyramidCount = 0; peakPrice = 0;
          lastTradeDay = i;
          equityCurve.push(cash);
          continue;
        }
      }
    }

    if (isWarmup) {
      equityCurve.push(cash + holdings * cp);
      continue;
    }

    // ===== الاستراتيجية A: اتباع الاتجاه (DeepSeek 4 تعديلات) =====
    if (isConfirmedTrend && daysSinceLastTrade >= cooldownDays) {
      const trendBuyCondition = smaFast > smaSlow && cp > sma100 && cp > smaSlow;

      // === تعديل 1: تخصيص النقد الديناميكي (DeepSeek) ===
      let dynamicAllocation = 0.40; // الأساس 40%
      if (adx >= 30) dynamicAllocation = 0.50;
      if (adx >= 35 && consecutiveTrendDays >= 30) dynamicAllocation = 0.60;
      dynamicAllocation = Math.min(0.70, dynamicAllocation); // حد أقصى 70%

      // === تعديل 2: شراء التصحيحات (Dip Buying) ===
      let dipBuyCount = 0;
      const isDip = position === 'long' && peakPrice > 0 && ((peakPrice - cp) / peakPrice) >= 0.05;
      const canDipBuy = isDip && adx >= 25 && cash > 0 && dipBuyCount < 2;

      if (trendBuyCondition && cash > 0 && pyramidCount === 0) {
        // الدفعة الأولى: تخصيص ديناميكي
        const invest = cash * dynamicAllocation;
        const qty = invest / cp;
        avgBuyPrice = cp;
        peakPrice = cp;
        cash -= invest + invest * cost;
        holdings += qty;
        position = 'long';
        pyramidCount = 1;
        trades.push({ type: 'buy', price: cp, quantity: qty, value: invest, dayIndex: i, os: displayOS });
        lastTradeDay = i;
      }
      else if (canDipBuy) {
        // شراء عند التصحيح: 10% من النقد المتبقي (بحد أقصى 2 مرات)
        const invest = cash * 0.10;
        const qty = invest / cp;
        avgBuyPrice = ((avgBuyPrice * holdings) + (cp * qty)) / (holdings + qty);
        cash -= invest + invest * cost;
        holdings += qty;
        pyramidCount++;
        dipBuyCount++;
        trades.push({ type: 'buy', price: cp, quantity: qty, value: invest, dayIndex: i, os: displayOS });
        lastTradeDay = i;
      }
      // === تعديل 4: جني أرباح جزئي عند 25% ربح (بيع 30%) ===
      else if (position === 'long' && avgBuyPrice > 0 && ((cp - avgBuyPrice) / avgBuyPrice) >= 0.25 && holdings > 0) {
        const qty = holdings * 0.30;
        const val = qty * cp;
        cash += val - val * cost;
        holdings -= qty;
        trades.push({ type: 'sell', price: cp, quantity: qty, value: val, dayIndex: i, os: displayOS });
        lastTradeDay = i;
      }
      // بيع كامل فقط عند انعكاس حقيقي
      else if (position === 'long' && smaFast < smaSlow) {
        const val = holdings * cp;
        cash += val - val * cost;
        trades.push({ type: 'sell', price: cp, quantity: holdings, value: val, dayIndex: i, os: displayOS });
        holdings = 0; avgBuyPrice = 0; position = 'none'; pyramidCount = 0; peakPrice = 0;
        lastTradeDay = i;
      }
    }

    // ===== الاستراتيجية B: القناص في التذبذب (Gemini Active Ranging) =====
    if (isRanging && daysSinceLastTrade >= cooldownDays) {
      // شراء هجومي: Z-Score < -2 أو (Z < -1.5 + RSI < 30 + Bollinger السفلي)
      const aggressiveEntry = zScore < -2 && cp <= bb.lower;
      const standardEntry = zScore < -1.5 && rsi < 30 && cp <= bb.lower;
      const notInDowntrend = cp > smaSlow;

      if (position === 'none' && (aggressiveEntry || standardEntry) && notInDowntrend && cash > 0) {
        const invest = cash * 0.30; // Gemini: 30% من المحفظة
        const qty = invest / cp;
        avgBuyPrice = cp;
        cash -= invest + invest * cost;
        holdings += qty;
        position = 'long'; pyramidCount = 1;
        trades.push({ type: 'buy', price: cp, quantity: qty, value: invest, dayIndex: i, os: displayOS });
        lastTradeDay = i;
      }
      // بيع سريع: Bollinger العلوي أو ربح 5% (Gemini: خروج سريع)
      else if (position === 'long') {
        const gain = avgBuyPrice > 0 ? (cp - avgBuyPrice) / avgBuyPrice : 0;
        if (cp >= bb.upper || gain >= 0.05) {
          const val = holdings * cp;
          cash += val - val * cost;
          trades.push({ type: 'sell', price: cp, quantity: holdings, value: val, dayIndex: i, os: displayOS });
          holdings = 0; avgBuyPrice = 0; position = 'none'; pyramidCount = 0;
          lastTradeDay = i;
        }
      }
    }

    equityCurve.push(cash + holdings * cp);
  }

  const finalVal = cash + holdings * prices[prices.length - 1];
  const totalReturn = ((finalVal - initialCapital) / initialCapital) * 100;
  const bah = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;

  let wins = 0;
  const sellTrades = trades.filter(t => t.type === 'sell');
  for (const st of sellTrades) {
    const lastBuy = trades.filter(t => t.type === 'buy' && t.dayIndex < st.dayIndex).pop();
    if (lastBuy && st.price > lastBuy.price) wins++;
  }
  const winRate = sellTrades.length > 0 ? (wins / sellTrades.length) * 100 : 0;

  return { totalReturn, buyAndHoldReturn: bah, numberOfTrades: trades.length, winRate, trades, equityCurve };
}

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
