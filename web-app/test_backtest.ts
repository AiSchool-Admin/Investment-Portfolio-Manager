/**
 * اختبار الباك تيست من سطر الأوامر
 * node --experimental-strip-types test_backtest.ts
 */

// نسخ مبسطة من الدوال المطلوبة (بدون imports)

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const sumSq = values.reduce((s, v) => s + (v - avg) ** 2, 0);
  return Math.sqrt(sumSq / (values.length - 1));
}

function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices.length > 0 ? mean(prices) : 0;
  return mean(prices.slice(-period));
}

function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function calculateZScore(currentPrice: number, historicalPrices: number[]): number {
  if (historicalPrices.length < 2) return 0;
  const mu = mean(historicalPrices);
  const sigma = standardDeviation(historicalPrices);
  if (sigma === 0) return 0;
  return (currentPrice - mu) / sigma;
}

function calculateBollingerBands(prices: number[], period = 20, stdMultiplier = 2) {
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
  const percentB = upper !== lower ? (currentPrice - lower) / (upper - lower) : 0.5;
  return { upper, middle, lower, width: 0, percentB };
}

function calculateADX(prices: number[], period = 14): number {
  if (prices.length < period * 2 + 1) return 25;
  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    tr.push(Math.abs(prices[i] - prices[i - 1]));
    const upMove = prices[i] - prices[i - 1];
    const downMove = prices[i - 1] - prices[i];
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }
  if (tr.length < period) return 25;
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
  const dx: number[] = [];
  for (let i = 0; i < minLen; i++) {
    if (smoothTR[i] === 0) continue;
    const plusDI = (smoothPlusDM[i] / smoothTR[i]) * 100;
    const minusDI = (smoothMinusDM[i] / smoothTR[i]) * 100;
    const diSum = plusDI + minusDI;
    if (diSum > 0) dx.push(Math.abs(plusDI - minusDI) / diSum * 100);
  }
  if (dx.length < period) return dx.length > 0 ? mean(dx) : 25;
  return mean(dx.slice(-period));
}

function calculateATR(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 0;
  let trSum = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    trSum += Math.abs(prices[i] - prices[i - 1]);
  }
  return trSum / period;
}

// ============ الباك تيست ============

interface BacktestResult {
  totalReturn: number;
  buyAndHoldReturn: number;
  numberOfTrades: number;
  winRate: number;
  trades: { type: string; price: number; dayIndex: number; quantity: number; value: number }[];
}

function runBacktest(prices: number[], initialCapital: number): BacktestResult {
  const cost = 0.001;
  const pyramidRatio = 0.20;
  const maxPyramid = 3;

  if (prices.length < 50) {
    return { totalReturn: 0, buyAndHoldReturn: 0, numberOfTrades: 0, winRate: 0, trades: [] };
  }

  const dataLength = prices.length;
  const slowPeriod = Math.min(200, Math.max(50, Math.floor(dataLength * 0.3)));
  const fastPeriod = Math.max(10, Math.floor(slowPeriod * 0.4));
  const sma100Period = Math.min(100, Math.max(30, Math.floor(dataLength * 0.5)));

  let cash = initialCapital, holdings = 0;
  let avgBuyPrice = 0;
  let position: 'none' | 'long' = 'none';
  let pyramidCount = 0;
  let peakPrice = 0;
  const trades: BacktestResult['trades'] = [];
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

    // فلتر المدة (Claude + DeepSeek)
    let consecutiveTrendDays = 0;
    for (let j = i; j >= Math.max(fastPeriod, i - 40); j--) {
      const pSlice = prices.slice(0, j + 1);
      const sf = calculateSMA(pSlice, fastPeriod);
      const ss = calculateSMA(pSlice, Math.min(slowPeriod, pSlice.length));
      if (sf > ss) consecutiveTrendDays++;
      else break;
    }

    const isConfirmedTrend = adx >= 25 && consecutiveTrendDays >= 20;
    const isRanging = adx < 25 || consecutiveTrendDays < 15;

    // تتبع القمة
    if (position === 'long' && cp > peakPrice) peakPrice = cp;

    // وقف خسارة ذكي
    if (position === 'long' && avgBuyPrice > 0) {
      if (isConfirmedTrend) {
        // اتجاه مؤكد: شبكة أمان 20% من القمة فقط
        const dd = peakPrice > 0 ? (peakPrice - cp) / peakPrice : 0;
        if (dd >= 0.20) {
          const val = holdings * cp;
          cash += val - val * cost;
          trades.push({ type: 'sell(CRASH)', price: cp, dayIndex: i, quantity: holdings, value: val });
          holdings = 0; avgBuyPrice = 0; position = 'none'; pyramidCount = 0; peakPrice = 0;
          lastTradeDay = i; continue;
        }
      } else {
        const loss = (avgBuyPrice - cp) / avgBuyPrice;
        if (loss >= dynamicStopLoss) {
          const val = holdings * cp;
          cash += val - val * cost;
          trades.push({ type: 'sell(SL)', price: cp, dayIndex: i, quantity: holdings, value: val });
          holdings = 0; avgBuyPrice = 0; position = 'none'; pyramidCount = 0; peakPrice = 0;
          lastTradeDay = i; continue;
        }
      }
    }

    if (isWarmup) continue;

    // Trend Following (اتجاه مؤكد فقط)
    if (isConfirmedTrend && daysSinceLastTrade >= cooldownDays) {
      const trendBuy = smaFast > smaSlow && cp > sma100 && cp > smaSlow;
      if (trendBuy && cash > 0 && pyramidCount < maxPyramid) {
        peakPrice = Math.max(peakPrice, cp);
        const invest = cash * 0.15;
        const qty = invest / cp;
        avgBuyPrice = holdings > 0 ? ((avgBuyPrice * holdings) + (cp * qty)) / (holdings + qty) : cp;
        cash -= invest + invest * cost;
        holdings += qty;
        position = 'long'; pyramidCount++;
        trades.push({ type: 'buy(TF)', price: cp, dayIndex: i, quantity: qty, value: invest });
        lastTradeDay = i;
      } else if (position === 'long' && smaFast < smaSlow) {
        const val = holdings * cp;
        cash += val - val * cost;
        trades.push({ type: 'sell(TF)', price: cp, dayIndex: i, quantity: holdings, value: val });
        holdings = 0; avgBuyPrice = 0; position = 'none'; pyramidCount = 0; peakPrice = 0;
        lastTradeDay = i;
      }
    }

    // Mean Reversion + Triple Confirmation
    if (isRanging && daysSinceLastTrade >= cooldownDays) {
      const tripleConfirm = zScore < -1.5 && rsi < 30 && cp <= bb.lower;
      if (position === 'none' && tripleConfirm && cash > 0) {
        const invest = cash * pyramidRatio;
        const qty = invest / cp;
        avgBuyPrice = cp;
        cash -= invest + invest * cost;
        holdings += qty;
        position = 'long'; pyramidCount = 1;
        trades.push({ type: 'buy(MR)', price: cp, dayIndex: i, quantity: qty, value: invest });
        lastTradeDay = i;
      } else if (position === 'long') {
        const gain = avgBuyPrice > 0 ? (cp - avgBuyPrice) / avgBuyPrice : 0;
        if (cp >= bb.upper || gain >= 0.10) {
          const val = holdings * cp;
          cash += val - val * cost;
          trades.push({ type: 'sell(MR)', price: cp, dayIndex: i, quantity: holdings, value: val });
          holdings = 0; avgBuyPrice = 0; position = 'none';
          lastTradeDay = i;
        }
      }
    }
  }

  const finalVal = cash + holdings * prices[prices.length - 1];
  const totalReturn = ((finalVal - initialCapital) / initialCapital) * 100;
  const bah = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;

  let wins = 0;
  const sellTrades = trades.filter(t => t.type.startsWith('sell'));
  for (const st of sellTrades) {
    const lastBuy = trades.filter(t => t.type.startsWith('buy') && t.dayIndex < st.dayIndex).pop();
    if (lastBuy && st.price > lastBuy.price) wins++;
  }
  const winRate = sellTrades.length > 0 ? (wins / sellTrades.length) * 100 : 0;

  return { totalReturn, buyAndHoldReturn: bah, numberOfTrades: trades.length, winRate, trades };
}

// ============ بيانات الاختبار ============

function generateTrendingUp(): number[] {
  const prices: number[] = [];
  let p = 10.00;
  for (let i = 0; i < 152; i++) {
    prices.push(p);
    p += (i % 3 === 0) ? -0.02 : 0.05 + Math.random() * 0.02;
  }
  // ضبط النهاية
  const scale = 15.0 / prices[prices.length - 1];
  return prices.map(x => Math.round(x * scale * 100) / 100);
}

function generateTrendingDown(): number[] {
  const prices: number[] = [];
  let p = 15.00;
  for (let i = 0; i < 152; i++) {
    prices.push(p);
    p -= (i % 3 === 0) ? -0.02 : 0.05 + Math.random() * 0.01;
  }
  const scale = 10.0 / prices[prices.length - 1];
  return prices.map(x => Math.round(x * scale * 100) / 100);
}

function generateRanging(): number[] {
  const prices: number[] = [];
  for (let i = 0; i < 152; i++) {
    const cycle = Math.sin(i * 2 * Math.PI / 30) * 2; // دورة 30 يوم
    prices.push(Math.round((10.5 + cycle) * 100) / 100);
  }
  return prices;
}

// ============ بيانات سنة كاملة (252 يوم) ============

function generateRealisticTrendingUp(): number[] {
  // 10 → ~14.5 (+45%) مع تصحيحات 5-8% كل 50 يوم
  const prices: number[] = [10.00];
  for (let i = 1; i < 252; i++) {
    const prev = prices[i - 1];
    const trend = 0.0018; // اتجاه صاعد ثابت
    const noise = Math.sin(i * 0.5) * 0.003;
    // تصحيح 7% كل 50 يوم (يستمر 8 أيام)
    const inCorrection = (i % 50) > 42;
    const correction = inCorrection ? -0.009 : 0;
    prices.push(Math.round((prev * (1 + trend + noise + correction)) * 100) / 100);
  }
  return prices;
}

function generateRealisticTrendingDown(): number[] {
  // 15 → ~10 (-33%) مع ارتدادات مؤقتة
  const prices: number[] = [15.00];
  for (let i = 1; i < 252; i++) {
    const prev = prices[i - 1];
    const trend = -0.0016; // هبوط ثابت
    const noise = Math.sin(i * 0.4) * 0.003;
    // ارتداد 5% كل 40 يوم (يستمر 6 أيام)
    const inBounce = (i % 40) > 34;
    const bounce = inBounce ? 0.008 : 0;
    prices.push(Math.round((prev * (1 + trend + noise + bounce)) * 100) / 100);
  }
  return prices;
}

function generateRealisticRanging(): number[] {
  // يتذبذب بين 9 و 12.5 مع دورات 70 يوم
  const prices: number[] = [];
  for (let i = 0; i < 252; i++) {
    const cycle = Math.sin(i * 2 * Math.PI / 70) * 1.8;
    const subCycle = Math.sin(i * 2 * Math.PI / 25) * 0.3;
    const noise = Math.sin(i * 5.3) * 0.1;
    prices.push(Math.round((10.8 + cycle + subCycle + noise) * 100) / 100);
  }
  return prices;
}

// ============ تشغيل الاختبارات ============

console.log('='.repeat(70));
console.log('اختبار الباك تيست - استراتيجية Claude + DeepSeek');
console.log('='.repeat(70));

// اختبار على بيانات قصيرة (152 يوم)
console.log('\n📅 بيانات قصيرة (152 يوم):');
const shortScenarios = [
  { name: 'صاعد 152 يوم', prices: generateTrendingUp() },
  { name: 'هابط 152 يوم', prices: generateTrendingDown() },
  { name: 'متذبذب 152 يوم', prices: generateRanging() },
];

for (const s of shortScenarios) {
  const result = runBacktest(s.prices, 10000);
  const diff = result.totalReturn - result.buyAndHoldReturn;
  console.log(`  ${s.name}: استراتيجية ${result.totalReturn >= 0 ? '+' : ''}${result.totalReturn.toFixed(1)}% | احتفاظ ${result.buyAndHoldReturn >= 0 ? '+' : ''}${result.buyAndHoldReturn.toFixed(1)}% | فرق ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}% | ${result.numberOfTrades} صفقات`);
}

// اختبار على بيانات طويلة (252 يوم = سنة)
console.log('\n📅 بيانات سنة كاملة (252 يوم):');
const longScenarios = [
  { name: 'صاعد واقعي 252 يوم', prices: generateRealisticTrendingUp() },
  { name: 'هابط واقعي 252 يوم', prices: generateRealisticTrendingDown() },
  { name: 'متذبذب واقعي 252 يوم', prices: generateRealisticRanging() },
];

for (const s of longScenarios) {
  const result = runBacktest(s.prices, 10000);
  const diff = result.totalReturn - result.buyAndHoldReturn;
  console.log(`  ${s.name}:`);
  console.log(`    بداية: $${s.prices[0]} | نهاية: $${s.prices[s.prices.length-1]} | ${s.prices.length} يوم`);
  console.log(`    استراتيجية: ${result.totalReturn >= 0 ? '+' : ''}${result.totalReturn.toFixed(2)}%`);
  console.log(`    احتفاظ: ${result.buyAndHoldReturn >= 0 ? '+' : ''}${result.buyAndHoldReturn.toFixed(2)}%`);
  console.log(`    الفرق: ${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%`);
  console.log(`    صفقات: ${result.numberOfTrades} | فوز: ${result.winRate.toFixed(0)}%`);
  if (result.trades.length > 0 && result.trades.length <= 10) {
    for (const t of result.trades) {
      console.log(`      يوم ${t.dayIndex}: ${t.type} @ $${t.price.toFixed(2)} ($${t.value.toFixed(0)})`);
    }
  }
}

console.log(`\n${'='.repeat(70)}`);
console.log('انتهى الاختبار');
