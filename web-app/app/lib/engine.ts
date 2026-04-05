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
  return Math.max(0, Math.min(1, raw)); // مقيد بين 0 و 1
}

export function calculateZScoreAdj(zScore: number, trendStrength: number): number {
  return zScore * (1 - trendStrength);
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
  cost: number, s: SystemSettings,
): number {
  const osRaw = s.alpha * sharpe
    + s.beta * (-zScoreAdj)
    + s.delta * trend
    + s.epsilon * rsiSignal
    + s.zeta * momentum
    + s.eta * macdSignal
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
): number {
  if (signalType === 'none') return 0;

  const factors = [
    signalType === 'buy' ? sharpe > 0 : sharpe < 0,
    signalType === 'buy' ? zScoreAdj < 0 : zScoreAdj > 0,
    signalType === 'buy' ? trend > 0 : trend < 0,
    signalType === 'buy' ? rsiSignal > 0 : rsiSignal < 0,
    signalType === 'buy' ? momentum > 0 : momentum < 0,
    signalType === 'buy' ? macdSignal > 0 : macdSignal < 0,
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

  // حساب OS
  const os = computeOptimumScore(shr, zScoreAdj, trend, rsiSig, momentum, macdSig, s.transactionCost, s);

  // الأوزان
  const currentValue = quantityHeld * currentPrice;
  const effPV = portfolioValue > 0 ? portfolioValue : currentValue + availableCash;
  const currentWeight = effPV > 0 ? currentValue / effPV : 0;

  // Trailing Stop
  const profitPct = purchasePrice > 0 ? (currentPrice - purchasePrice) / purchasePrice : 0;

  // تحديد الإشارة
  let signalType: 'buy' | 'sell' | 'none' = 'none';
  let signalSource: 'os' | 'trailing_stop' | 'force_rebalance' = 'os';
  let suggestedQuantity = 0, suggestedValue = 0;
  const reasons: string[] = [];

  // 1. Trailing Stop
  if (s.trailingStopEnabled && profitPct > s.trailingStopProfitTrigger && quantityHeld > 0) {
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

  // 2. إشارات OS المشروطة
  if (signalType === 'none') {
    if (os >= s.buyThreshold && trend >= 0 && rsiSig >= -0.5) {
      signalType = 'buy';
      reasons.push(`OS ${(os * 100).toFixed(0)}% ≥ ${(s.buyThreshold * 100).toFixed(0)}%`);
      if (trend > 0) reasons.push(`الاتجاه صاعد (فوق MA${s.maPeriod})`);
      if (rsi < 30) reasons.push(`RSI ${rsi.toFixed(0)} → تشبع بيعي (فرصة)`);
      const order = calculateBuyOrder(targetWeight, currentWeight, effPV, availableCash, currentPrice, s.buyOrderCashRatio);
      suggestedQuantity = order.quantity;
      suggestedValue = order.value;
      if (suggestedQuantity <= 0) reasons.push('لا حاجة للشراء - الوزن متوافق أو لا يوجد نقد كافٍ');
    } else if (os <= s.sellThreshold && trend <= 0 && rsiSig <= 0.5) {
      signalType = 'sell';
      reasons.push(`OS ${(os * 100).toFixed(0)}% ≤ ${(s.sellThreshold * 100).toFixed(0)}%`);
      if (trend < 0) reasons.push(`الاتجاه هابط (تحت MA${s.maPeriod})`);
      if (rsi > 70) reasons.push(`RSI ${rsi.toFixed(0)} → تشبع شرائي (خطر)`);
      const order = calculateSellOrder(quantityHeld, currentPrice, currentWeight, targetWeight, effPV, s.sellMode);
      suggestedQuantity = order.quantity;
      suggestedValue = order.value;
    } else {
      reasons.push(`OS ${(os * 100).toFixed(0)}% - انتظار`);
      if (os >= s.buyThreshold && trend < 0) reasons.push(`OS مرتفع لكن الاتجاه هابط → لا شراء`);
      if (os <= s.sellThreshold && trend > 0) reasons.push(`OS منخفض لكن الاتجاه صاعد → لا بيع`);
    }
  }

  // درجة الثقة
  const confidence = calculateConfidence(signalType, shr, zScoreAdj, trend, rsiSig, momentum, macdSig);

  return {
    assetName, assetId, signalType, signalSource, optimumScore: os, confidence,
    factors: {
      sharpe: shr, zScore, zScoreAdj, trend, trendStrength,
      rsi, rsiSignal: rsiSig, momentum, macd: macdSig, ma50: ma,
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

// ============ باك تيست (محسّن) ============

export function runBacktest(
  prices: number[], initialCapital: number, settings: SystemSettings,
): BacktestResult {
  const { riskFreeRate: rf, transactionCost: cost, backtestLookback: lookback,
    buyThreshold, sellThreshold, backtestBuyRatio, backtestSellRatio, tradingDaysPerYear } = settings;

  if (prices.length < lookback + 1) {
    return { totalReturn: 0, buyAndHoldReturn: 0, numberOfTrades: 0, winRate: 0, trades: [], equityCurve: [initialCapital] };
  }

  let cash = initialCapital, holdings = 0;
  const trades: BacktestTrade[] = [];
  const equityCurve: number[] = [initialCapital];

  for (let i = lookback; i < prices.length; i++) {
    const window = prices.slice(Math.max(0, i - lookback), i);
    const cp = prices[i];
    const ret = calculateReturns(window);
    const er = expectedReturn(ret, tradingDaysPerYear);
    const v = volatility(ret, tradingDaysPerYear);
    const shr = sharpeRatio(er, rf, v);

    const zScore = calculateZScore(cp, window);
    const ma = calculateMA(window, Math.min(settings.maPeriod, window.length));
    const ts = calculateTrendStrength(cp, ma);
    const zAdj = calculateZScoreAdj(zScore, ts);
    const trend = calculateTrend(cp, ma);
    const rsi = calculateRSI(prices.slice(0, i + 1), settings.rsiPeriod);
    const rsiSig = rsiToSignal(rsi);
    const mom = calculateMomentum(prices.slice(0, i + 1), settings.momentumPeriod);
    const macdRes = calculateMACD(prices.slice(0, i + 1), settings.macdFast, settings.macdSlow, settings.macdSignal);
    const macdSig = macdToSignal(macdRes.histogram, cp);

    const os = computeOptimumScore(shr, zAdj, trend, rsiSig, mom, macdSig, cost, settings);

    if (os >= buyThreshold && trend >= 0 && rsiSig >= -0.5 && cash > 0) {
      const invest = cash * backtestBuyRatio;
      const qty = invest / cp;
      cash -= invest + invest * cost;
      holdings += qty;
      trades.push({ type: 'buy', price: cp, quantity: qty, value: invest, dayIndex: i, os });
    } else if (os <= sellThreshold && trend <= 0 && rsiSig <= 0.5 && holdings > 0) {
      const qty = holdings * backtestSellRatio;
      const val = qty * cp;
      cash += val - val * cost;
      holdings -= qty;
      trades.push({ type: 'sell', price: cp, quantity: qty, value: val, dayIndex: i, os });
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
