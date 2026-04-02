/**
 * محرك Optimum Score - الخوارزميات المالية
 * تنفيذ كامل بلغة TypeScript
 */

import { TradingSignal, BacktestResult, BacktestTrade, RebalanceItem } from './types';

// المعاملات الافتراضية
const DEFAULT_ALPHA = 0.4;
const DEFAULT_BETA = 0.4;
const DEFAULT_GAMMA = 0.2;
const DEFAULT_RF = 0.03;
const DEFAULT_COST = 0.001;

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

export function covariance(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;
  const mx = mean(x), my = mean(y);
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += (x[i] - mx) * (y[i] - my);
  return sum / (x.length - 1);
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

export function expectedReturn(returns: number[], annualize = true): number {
  if (returns.length === 0) return 0;
  const avg = mean(returns);
  return annualize ? avg * 252 : avg;
}

export function volatility(returns: number[], annualize = true): number {
  if (returns.length < 2) return 0;
  const std = standardDeviation(returns);
  return annualize ? std * Math.sqrt(252) : std;
}

export function sharpeRatio(expRet: number, rf: number, vol: number): number {
  if (vol === 0) return 0;
  return (expRet - rf) / vol;
}

// ============ Optimum Score ============

export function computeOptimumScore(
  expRet: number, vol: number, zScore: number,
  rf = DEFAULT_RF, cost = DEFAULT_COST,
  alpha = DEFAULT_ALPHA, beta = DEFAULT_BETA, gamma = DEFAULT_GAMMA,
): number {
  const sharpe = sharpeRatio(expRet, rf, vol);
  let os = alpha * sharpe + beta * (-zScore) - gamma * cost;
  os = (os + 1) / 2; // تطبيع إلى [0,1]
  return Math.max(0, Math.min(1, os));
}

// ============ حجم الصفقة ============

export function calculateBuyOrder(
  targetWeight: number, currentWeight: number,
  portfolioValue: number, availableCash: number,
  currentPrice: number, cashRatio = 0.3,
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
  portfolioValue: number, mode: 'rebalance' | 'half' | 'quarter' | 'all' = 'rebalance',
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

// ============ تحليل أصل كامل ============

export function analyzeAsset(
  assetName: string, assetId: string,
  currentPrice: number, historicalPrices: number[],
  quantityHeld: number, portfolioValue: number,
  targetWeight: number, availableCash: number,
  rf = DEFAULT_RF, cost = DEFAULT_COST,
  alpha = DEFAULT_ALPHA, beta = DEFAULT_BETA, gamma = DEFAULT_GAMMA,
): TradingSignal {
  const returns = calculateReturns(historicalPrices);
  const zScore = calculateZScore(currentPrice, historicalPrices);
  const expRet = expectedReturn(returns);
  const vol = volatility(returns);
  const os = computeOptimumScore(expRet, vol, zScore, rf, cost, alpha, beta, gamma);

  const currentValue = quantityHeld * currentPrice;
  const effPV = portfolioValue > 0 ? portfolioValue : currentValue + availableCash;
  const currentWeight = effPV > 0 ? currentValue / effPV : 0;

  let signalType: 'buy' | 'sell' | 'none' = 'none';
  let suggestedQuantity = 0, suggestedValue = 0;
  const reasons: string[] = [];

  if (os >= 0.7) {
    signalType = 'buy';
    reasons.push(`Optimum Score مرتفع (${os.toFixed(2)})`);
    const order = calculateBuyOrder(targetWeight, currentWeight, effPV, availableCash, currentPrice);
    suggestedQuantity = order.quantity;
    suggestedValue = order.value;
    if (suggestedQuantity > 0)
      reasons.push(`الوزن الحالي ${(currentWeight * 100).toFixed(1)}% < المستهدف ${(targetWeight * 100).toFixed(1)}%`);
    else reasons.push('لا حاجة للشراء - الوزن متوافق أو لا يوجد نقد كافٍ');
  } else if (os <= 0.3) {
    signalType = 'sell';
    reasons.push(`Optimum Score منخفض (${os.toFixed(2)})`);
    const order = calculateSellOrder(quantityHeld, currentPrice, currentWeight, targetWeight, effPV, 'half');
    suggestedQuantity = order.quantity;
    suggestedValue = order.value;
    if (suggestedQuantity > 0)
      reasons.push(`اقتراح بيع نصف المركز (${suggestedQuantity.toFixed(4)} وحدة)`);
  } else {
    reasons.push(`Optimum Score متوسط (${os.toFixed(2)}) - انتظار`);
  }

  if (zScore < -2) reasons.push(`Z-Score منخفض جداً (${zScore.toFixed(2)}) ← فرصة شراء`);
  else if (zScore > 2) reasons.push(`Z-Score مرتفع جداً (${zScore.toFixed(2)}) ← فرصة بيع`);

  return {
    assetName, assetId, signalType, optimumScore: os, zScore,
    expectedReturn: expRet, volatility: vol, currentPrice,
    currentWeight, targetWeight, suggestedQuantity, suggestedValue, reasons,
  };
}

// ============ إعادة التوازن ============

export function checkRebalancing(
  names: string[], currentWeights: number[], targetWeights: number[], threshold = 0.05,
): RebalanceItem[] {
  const items: RebalanceItem[] = [];
  for (let i = 0; i < names.length; i++) {
    const dev = Math.abs(currentWeights[i] - targetWeights[i]);
    if (dev > threshold) {
      items.push({
        assetName: names[i], currentWeight: currentWeights[i],
        targetWeight: targetWeights[i], deviation: dev,
      });
    }
  }
  return items;
}

// ============ تحسين الأوزان (Monte Carlo) ============

export function optimizeWeights(
  expectedReturns: number[], covMatrix: number[][], rf = DEFAULT_RF, iterations = 10000,
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

// ============ باك تيست ============

export function runBacktest(
  prices: number[], initialCapital: number,
  rf = DEFAULT_RF, cost = DEFAULT_COST, lookback = 50,
  alpha = DEFAULT_ALPHA, beta = DEFAULT_BETA, gamma = DEFAULT_GAMMA,
): BacktestResult {
  if (prices.length < lookback + 1) {
    return { totalReturn: 0, buyAndHoldReturn: 0, numberOfTrades: 0, winRate: 0, trades: [], equityCurve: [initialCapital] };
  }

  let cash = initialCapital, holdings = 0;
  const trades: BacktestTrade[] = [];
  const equityCurve: number[] = [initialCapital];

  for (let i = lookback; i < prices.length; i++) {
    const window = prices.slice(i - lookback, i);
    const cp = prices[i];
    const ret = calculateReturns(window);
    const z = calculateZScore(cp, window);
    const er = expectedReturn(ret);
    const v = volatility(ret);
    const os = computeOptimumScore(er, v, z, rf, cost, alpha, beta, gamma);

    if (os >= 0.7 && cash > 0) {
      const invest = cash * 0.3;
      const qty = invest / cp;
      cash -= invest + invest * cost;
      holdings += qty;
      trades.push({ type: 'buy', price: cp, quantity: qty, value: invest, dayIndex: i, os });
    } else if (os <= 0.3 && holdings > 0) {
      const qty = holdings * 0.5;
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

// مولّد أرقام عشوائية ببذرة ثابتة (للتكرار)
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
