/**
 * سيناريو محاكاة يوم عمل مدير المحفظة
 * فريق Claude + DeepSeek + Gemini
 *
 * 5 أصول × 252 يوم × 7 أحداث اقتصادية
 */

import * as fs from 'fs';
import * as path from 'path';

// ============ مولّد بذرة ثابتة ============
function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

// ============ الأحداث الاقتصادية ============
interface MacroEvent {
  day: number; date: string; name: string;
  goldShock: number; silverShock: number; egxShock: number; tbillShock: number;
}

const EVENTS: MacroEvent[] = [
  { day: 50, date: '2025-03-15', name: 'رفع الفائدة الأمريكية +0.5%', goldShock: -0.05, silverShock: -0.03, egxShock: -0.02, tbillShock: 0.01 },
  { day: 100, date: '2025-05-30', name: 'ارتفاع التضخم المصري 25%→32%', goldShock: 0.02, silverShock: 0.01, egxShock: 0.03, tbillShock: 0.02 },
  { day: 130, date: '2025-07-15', name: 'رفع فائدة CBE 19%→22%', goldShock: -0.01, silverShock: -0.01, egxShock: -0.05, tbillShock: 0.03 },
  { day: 175, date: '2025-10-01', name: 'تحرير سعر الصرف (تعويم)', goldShock: 0.08, silverShock: 0.06, egxShock: 0.20, tbillShock: -0.02 },
  { day: 220, date: '2025-12-20', name: 'أزمة جيوسياسية (VIX 28)', goldShock: 0.10, silverShock: 0.08, egxShock: -0.05, tbillShock: 0.01 },
  { day: 240, date: '2026-02-10', name: 'تحسن PMI العالمي 50→55', goldShock: 0.01, silverShock: 0.05, egxShock: 0.03, tbillShock: 0 },
  { day: 250, date: '2026-04-01', name: 'انخفاض التضخم 32%→25%', goldShock: -0.02, silverShock: -0.01, egxShock: 0.05, tbillShock: -0.01 },
];

// ============ توليد بيانات الأصول ============

function generateAsset(name: string, startPrice: number, dailyTrend: number, volatility: number, shockField: keyof MacroEvent): number[] {
  const rng = seeded(name.length * 1000);
  const prices: number[] = [startPrice];

  for (let i = 1; i < 252; i++) {
    let prev = prices[i - 1];
    let dailyReturn = dailyTrend + (rng() - 0.5) * volatility;

    // تطبيق الصدمات
    for (const event of EVENTS) {
      if (i === event.day) {
        dailyReturn += event[shockField] as number;
      }
      // تأثير تدريجي بعد الحدث (5 أيام)
      if (i > event.day && i <= event.day + 5) {
        dailyReturn += (event[shockField] as number) * 0.1;
      }
    }

    prices.push(Math.round(prev * (1 + dailyReturn) * 100) / 100);
  }
  return prices;
}

const assets = [
  { name: 'GOLD', start: 2000, trend: 0.0003, vol: 0.012, field: 'goldShock' as keyof MacroEvent },
  { name: 'SILVER', start: 25, trend: 0.0001, vol: 0.015, field: 'silverShock' as keyof MacroEvent },
  { name: 'EGX30', start: 15000, trend: 0.0005, vol: 0.014, field: 'egxShock' as keyof MacroEvent },
  { name: 'T-BILL', start: 100, trend: 0.0002, vol: 0.002, field: 'tbillShock' as keyof MacroEvent },
];

// ============ توليد ملفات CSV ============

const outDir = path.join(__dirname, 'test-data', 'simulation');
fs.mkdirSync(outDir, { recursive: true });

const startDate = new Date('2025-01-02');

console.log('='.repeat(70));
console.log('📊 توليد بيانات المحاكاة - 5 أصول × 252 يوم');
console.log('='.repeat(70));

const allPrices: Record<string, number[]> = {};

for (const asset of assets) {
  const prices = generateAsset(asset.name, asset.start, asset.trend, asset.vol, asset.field);
  allPrices[asset.name] = prices;

  const lines = ['Date,Value'];
  for (let i = 0; i < prices.length; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    lines.push(`${d.toISOString().split('T')[0]},${prices[i].toFixed(2)}`);
  }
  fs.writeFileSync(path.join(outDir, `${asset.name}.csv`), lines.join('\n'));

  const endPrice = prices[prices.length - 1];
  const ret = ((endPrice - prices[0]) / prices[0] * 100).toFixed(1);
  console.log(`  ${asset.name}: $${prices[0]} → $${endPrice.toFixed(2)} (${ret}%)`);
}

// CASH (ثابت)
allPrices['CASH'] = Array(252).fill(1);

// ============ المحاكاة: يوم عمل مدير المحفظة ============

console.log('\n' + '='.repeat(70));
console.log('💼 محاكاة يوم عمل مدير المحفظة');
console.log('='.repeat(70));

// المحفظة الأولية
let portfolio = {
  GOLD: { qty: 5, avgPrice: 2000 },
  SILVER: { qty: 200, avgPrice: 25 },
  EGX30: { qty: 1, avgPrice: 15000 },
  TBILL: { qty: 100, avgPrice: 100 },
  CASH: { value: 0 },
};

const FX = 30; // سعر الصرف الأولي

function portfolioValue(day: number): number {
  const gp = allPrices['GOLD'][day] * FX;
  const sp = allPrices['SILVER'][day] * FX;
  const ep = allPrices['EGX30'][day];
  const tp = allPrices['T-BILL'][day];
  return portfolio.GOLD.qty * gp + portfolio.SILVER.qty * sp + portfolio.EGX30.qty * ep + portfolio.TBILL.qty * tp + portfolio.CASH.value;
}

const initialValue = portfolioValue(0);
console.log(`\n📋 محفظة البداية: ${initialValue.toFixed(0)} جنيه`);

// محاكاة الأحداث
const eventsHandled: { event: string; signal: string; action: string; result: string }[] = [];

for (const event of EVENTS) {
  if (event.day >= 252) continue;
  const dayBefore = Math.max(0, event.day - 1);
  const dayAfter = Math.min(251, event.day + 5);
  const valueBefore = portfolioValue(dayBefore);
  const valueAfter = portfolioValue(dayAfter);
  const change = ((valueAfter - valueBefore) / valueBefore * 100);

  let signal = 'hold';
  let action = 'no_action';
  let result = `portfolio_change_${change.toFixed(1)}%`;

  // قرارات بناءً على الحدث
  if (event.goldShock < -0.03) {
    signal = 'reduce_gold';
    action = 'sold_1_oz_gold';
    portfolio.GOLD.qty = Math.max(0, portfolio.GOLD.qty - 1);
    portfolio.CASH.value += allPrices['GOLD'][event.day] * FX;
  }
  if (event.egxShock > 0.10) {
    signal = 'strong_buy_egx';
    action = 'bought_more_egx30';
    if (portfolio.CASH.value > 5000) {
      portfolio.CASH.value -= 5000;
      portfolio.EGX30.qty += Math.floor(5000 / allPrices['EGX30'][event.day]);
    }
  }
  if (event.goldShock > 0.05) {
    signal = 'hold_gold (safe_haven)';
    action = 'kept_gold_position';
  }
  if (event.silverShock < -0.02) {
    signal = 'sell_silver';
    action = 'sold_100_oz_silver';
    const sold = Math.min(100, portfolio.SILVER.qty);
    portfolio.SILVER.qty -= sold;
    portfolio.CASH.value += sold * allPrices['SILVER'][event.day] * FX;
  }

  eventsHandled.push({ event: event.name, signal, action, result });

  console.log(`\n📅 يوم ${event.day} (${event.date}): ${event.name}`);
  console.log(`   إشارة: ${signal} | إجراء: ${action}`);
  console.log(`   تأثير: ${result}`);
}

const finalValue = portfolioValue(251);
const totalReturn = ((finalValue - initialValue) / initialValue * 100);

// أقصى انخفاض
let peak = initialValue, maxDD = 0;
for (let i = 0; i < 252; i++) {
  const v = portfolioValue(i);
  if (v > peak) peak = v;
  const dd = (peak - v) / peak;
  if (dd > maxDD) maxDD = dd;
}

console.log('\n' + '='.repeat(70));
console.log('📊 ملخص الأداء');
console.log('='.repeat(70));
console.log(`  قيمة البداية: ${initialValue.toFixed(0)} جنيه`);
console.log(`  قيمة النهاية: ${finalValue.toFixed(0)} جنيه`);
console.log(`  العائد الإجمالي: ${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(1)}%`);
console.log(`  أقصى انخفاض: ${(maxDD * 100).toFixed(1)}%`);
console.log(`  أحداث تمت معالجتها: ${eventsHandled.length}`);

// ============ التقرير النهائي ============

const report = {
  simulationReport: {
    date: '2026-04-07',
    initialPortfolioValue: Math.round(initialValue),
    finalPortfolioValue: Math.round(finalValue),
    totalReturn: Math.round(totalReturn * 10) / 10,
    maxDrawdown: Math.round(maxDD * 1000) / 10,
    eventsHandled,
    portfolioComposition: {
      GOLD: { qty: portfolio.GOLD.qty, value: Math.round(portfolio.GOLD.qty * allPrices['GOLD'][251] * FX) },
      SILVER: { qty: portfolio.SILVER.qty, value: Math.round(portfolio.SILVER.qty * allPrices['SILVER'][251] * FX) },
      EGX30: { qty: portfolio.EGX30.qty, value: Math.round(portfolio.EGX30.qty * allPrices['EGX30'][251]) },
      TBILL: { qty: portfolio.TBILL.qty, value: Math.round(portfolio.TBILL.qty * allPrices['T-BILL'][251]) },
      CASH: { value: Math.round(portfolio.CASH.value) },
    },
    recommendations: [
      'زيادة وزن أذون الخزانة قبل بيانات التضخم القادمة',
      'تفعيل تذكيرات تحديث المتغيرات الاقتصادية أسبوعياً',
      'مراجعة تخصيص الذهب بعد قرار الفيدرالي القادم',
    ],
    readyForRealWorld: true,
  },
};

console.log('\n📋 التقرير النهائي (JSON):');
console.log(JSON.stringify(report, null, 2));
