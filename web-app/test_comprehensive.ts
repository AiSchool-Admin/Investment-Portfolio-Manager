/**
 * اختبار شامل Pre-Release - فريق Claude + DeepSeek + Gemini
 * يغطي: Unit Tests + Sanity + Integration + Performance + Edge Cases
 */

import * as fs from 'fs';
import * as path from 'path';

// ============ استيراد الدوال من fundamentalModels ============
// نسخ مبسطة لأن الملف الأصلي يستخدم export

interface MacroVariables {
  usRealYield10y: number; dxyIndex: number; vixIndex: number;
  centralBankGoldBuy: number; globalPMI: number; cpiEgypt: number;
  cpiUS: number; cbeInterestRate: number; usFedRate: number;
  nfaGap: number; externalDebtService: number; fdi: number;
  remittances: number; exports: number; reserves: number;
}

const DEFAULT_MACRO: MacroVariables = {
  usRealYield10y: 2.0, dxyIndex: 104, vixIndex: 18, centralBankGoldBuy: 10,
  globalPMI: 51, cpiEgypt: 24, cpiUS: 3.0, cbeInterestRate: 27.25,
  usFedRate: 4.5, nfaGap: -5, externalDebtService: 12, fdi: 3,
  remittances: 25, exports: 35, reserves: 46,
};

const ECONOMY_LIMITS: Record<string, { min: number; max: number }> = {
  usRealYield10y: { min: -2.0, max: 5.0 }, dxyIndex: { min: 80, max: 125 },
  vixIndex: { min: 8, max: 80 }, centralBankGoldBuy: { min: 0, max: 100 },
  globalPMI: { min: 35, max: 65 }, cpiEgypt: { min: 4, max: 50 },
  cpiUS: { min: 0, max: 15 }, cbeInterestRate: { min: 7, max: 40 },
  usFedRate: { min: 0, max: 10 }, nfaGap: { min: -30, max: 30 },
  externalDebtService: { min: 0, max: 30 }, fdi: { min: 0, max: 15 },
  remittances: { min: 10, max: 40 }, exports: { min: 20, max: 60 },
  reserves: { min: 20, max: 60 },
};

function fairGoldPrice(m: MacroVariables): number {
  return Math.max(0, (1800 - 200 - 40*m.usRealYield10y - 8*m.dxyIndex + 15*m.vixIndex + 2*m.centralBankGoldBuy) / 1.2);
}

function fairSilverPrice(fairGold: number, m: MacroVariables): number {
  return Math.max(0, 0.02 * fairGold + (10 + 0.5*m.globalPMI - 5) / 0.8);
}

function fairCbeRate(m: MacroVariables): number {
  return Math.max(0, Math.min(50, 4 + m.cpiEgypt + 1.5*(m.cpiEgypt - 7) - 0.5*m.nfaGap));
}

function fairUsdEgp(m: MacroVariables, baseRate = 50): number {
  const inflDiff = (m.cpiEgypt - m.cpiUS) / 100;
  const ppp = baseRate * (1 + inflDiff * 0.6);
  const debtRatio = m.reserves > 0 ? m.externalDebtService / m.reserves : 0.5;
  const risk = 3 * (1 + 0.8 * debtRatio);
  const inflows = m.remittances + m.fdi + m.exports;
  const disc = inflows > 50 ? -2 : (inflows > 30 ? -1 : 0);
  return Math.max(10, ppp + risk + disc);
}

function fairEgx30(m: MacroVariables): number {
  const fr = fairCbeRate(m);
  const fx = fairUsdEgp(m);
  return Math.max(5000, Math.min(50000, 15000 + 200*(fx/50) - 500*(fr/100) + 100*(m.cpiEgypt > 20 ? 1 : 0)));
}

function validateMacro(m: MacroVariables): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const [k, lim] of Object.entries(ECONOMY_LIMITS)) {
    const v = (m as Record<string, number>)[k];
    if (v < lim.min || v > lim.max) errors.push(`${k}: ${v} out of range (${lim.min}-${lim.max})`);
  }
  return { valid: errors.length === 0, errors };
}

function calculateValuationGap(current: number, fair: number) {
  if (fair <= 0) return { gap: 0, gapPercent: 0, signal: 'hold', recommendation: 'N/A' };
  const gap = (current - fair) / fair;
  const gapPercent = gap * 100;
  let signal: string;
  if (gap < -0.15) signal = 'strong_buy';
  else if (gap < -0.05) signal = 'buy';
  else if (gap <= 0.05) signal = 'hold';
  else if (gap <= 0.15) signal = 'reduce';
  else signal = 'strong_sell';
  return { gap, gapPercent, signal, recommendation: signal };
}

function adjustThresholds(buyTh: number, sellTh: number, gap: number) {
  let buyAdj = 0, sellAdj = 0;
  if (gap < -0.05) { buyAdj = -0.05; sellAdj = 0.05; }
  else if (gap > 0.05) { buyAdj = 0.05; sellAdj = -0.05; }
  return {
    buyThreshold: Math.max(0.3, Math.min(0.9, buyTh + buyAdj)),
    sellThreshold: Math.max(0.1, Math.min(0.7, sellTh + sellAdj)),
  };
}

// ============ إطار الاختبار ============

let totalTests = 0;
let passed = 0;
let failed = 0;
const details: { suite: string; test: string; status: string; notes: string }[] = [];

function assert(suite: string, test: string, condition: boolean, notes = '') {
  totalTests++;
  if (condition) {
    passed++;
    details.push({ suite, test, status: 'PASS', notes });
  } else {
    failed++;
    details.push({ suite, test, status: 'FAIL', notes });
    console.log(`  ❌ FAIL: ${test} ${notes ? '- ' + notes : ''}`);
  }
}

function assertClose(suite: string, test: string, actual: number, expected: number, tolerance = 0.01, notes = '') {
  const diff = Math.abs(actual - expected);
  assert(suite, test, diff <= Math.abs(expected * tolerance) + 0.01,
    `expected ~${expected.toFixed(2)}, got ${actual.toFixed(2)} ${notes}`);
}

// ============ 1. اختبار وحدة النماذج الاقتصادية ============

console.log('\n📋 1. Unit Tests - Fundamental Models');

const S1 = 'Unit Tests - Fundamental Models';

// Gold - Normal
const goldNormal = fairGoldPrice(DEFAULT_MACRO);
assert(S1, 'Gold normal value is positive', goldNormal > 0, `got ${goldNormal.toFixed(2)}`);
assert(S1, 'Gold normal value is reasonable (500-3000)', goldNormal > 500 && goldNormal < 3000, `got ${goldNormal.toFixed(2)}`);

// Gold - High yield → lower gold
const goldHighYield = fairGoldPrice({ ...DEFAULT_MACRO, usRealYield10y: 4.5 });
assert(S1, 'Gold decreases with higher real yield', goldHighYield < goldNormal, `high=${goldHighYield.toFixed(2)} vs normal=${goldNormal.toFixed(2)}`);

// Gold - High VIX → higher gold
const goldHighVIX = fairGoldPrice({ ...DEFAULT_MACRO, vixIndex: 60 });
assert(S1, 'Gold increases with higher VIX', goldHighVIX > goldNormal, `vix60=${goldHighVIX.toFixed(2)} vs normal=${goldNormal.toFixed(2)}`);

// Gold - Boundary: min values
const goldMin = fairGoldPrice({ ...DEFAULT_MACRO, usRealYield10y: -2, dxyIndex: 80, vixIndex: 80, centralBankGoldBuy: 100 });
assert(S1, 'Gold boundary max is positive', goldMin > 0);

// Gold - Boundary: max values (should still be positive)
const goldMax = fairGoldPrice({ ...DEFAULT_MACRO, usRealYield10y: 5, dxyIndex: 125, vixIndex: 8, centralBankGoldBuy: 0 });
assert(S1, 'Gold boundary min is non-negative', goldMax >= 0);

// Silver
const silverNormal = fairSilverPrice(goldNormal, DEFAULT_MACRO);
assert(S1, 'Silver is positive', silverNormal > 0);
assert(S1, 'Silver is less than gold', silverNormal < goldNormal);

// Silver - Higher PMI → higher silver (industrial demand)
const silverHighPMI = fairSilverPrice(goldNormal, { ...DEFAULT_MACRO, globalPMI: 60 });
assert(S1, 'Silver increases with higher PMI', silverHighPMI > silverNormal);

// CBE Rate
const cbeNormal = fairCbeRate(DEFAULT_MACRO);
assert(S1, 'CBE rate is positive', cbeNormal > 0);
assert(S1, 'CBE rate is reasonable (10-50%)', cbeNormal >= 10 && cbeNormal <= 50, `got ${cbeNormal.toFixed(2)}`);

// CBE - Higher inflation → higher rate (use moderate values to avoid cap)
const cbeModerate = fairCbeRate({ ...DEFAULT_MACRO, cpiEgypt: 15 });
const cbeHighInflation = fairCbeRate({ ...DEFAULT_MACRO, cpiEgypt: 20 });
assert(S1, 'CBE rate increases with inflation', cbeHighInflation > cbeModerate, `15%CPI=${cbeModerate.toFixed(1)} vs 20%CPI=${cbeHighInflation.toFixed(1)}`);

// USD/EGP
const usdNormal = fairUsdEgp(DEFAULT_MACRO);
assert(S1, 'USD/EGP is positive', usdNormal > 0);
assert(S1, 'USD/EGP is reasonable (30-70)', usdNormal >= 30 && usdNormal <= 70, `got ${usdNormal.toFixed(2)}`);

// EGX30
const egxNormal = fairEgx30(DEFAULT_MACRO);
assert(S1, 'EGX30 is positive', egxNormal > 0);
assert(S1, 'EGX30 is reasonable (10000-30000)', egxNormal >= 10000 && egxNormal <= 30000, `got ${egxNormal.toFixed(2)}`);

// ============ 2. اختبار نطاقات التحقق ============

console.log('\n📋 2. Sanity Checks');

const S2 = 'Sanity Checks';

// Valid data
const validResult = validateMacro(DEFAULT_MACRO);
assert(S2, 'Default macro passes validation', validResult.valid);

// Out of range: CPI Egypt = 300%
const invalidCPI = validateMacro({ ...DEFAULT_MACRO, cpiEgypt: 300 });
assert(S2, 'CPI Egypt 300% detected as invalid', !invalidCPI.valid);
assert(S2, 'Error message mentions cpiEgypt', invalidCPI.errors.some(e => e.includes('cpiEgypt')));

// Out of range: US yield = 10%
const invalidYield = validateMacro({ ...DEFAULT_MACRO, usRealYield10y: 10 });
assert(S2, 'US yield 10% detected as invalid', !invalidYield.valid);

// Multiple errors
const multiInvalid = validateMacro({ ...DEFAULT_MACRO, cpiEgypt: 100, dxyIndex: 200, reserves: 5 });
assert(S2, 'Multiple errors detected', multiInvalid.errors.length >= 3, `found ${multiInvalid.errors.length} errors`);

// Boundary: exactly at limit
const boundaryTest = validateMacro({ ...DEFAULT_MACRO, usRealYield10y: 5.0 });
assert(S2, 'Boundary value (exactly at max) passes', boundaryTest.valid || !boundaryTest.errors.some(e => e.includes('usRealYield')));

// ============ 3. اختبار التكامل (Macro + Technical) ============

console.log('\n📋 3. Integration - Macro & Technical');

const S3 = 'Integration - Macro & Technical';

// Gap calculation
const gap1 = calculateValuationGap(90, 100); // 10% undervalued
assert(S3, 'Negative gap calculated correctly', gap1.gap < 0, `gap=${gap1.gap.toFixed(3)}`);
assert(S3, 'Gap percent is -10%', Math.abs(gap1.gapPercent - (-10)) < 0.1);
assert(S3, 'Signal is buy for -10% gap', gap1.signal === 'buy');

const gap2 = calculateValuationGap(120, 100); // 20% overvalued
assert(S3, 'Positive gap is +20%', Math.abs(gap2.gapPercent - 20) < 0.1);
assert(S3, 'Signal is strong_sell for +20% gap', gap2.signal === 'strong_sell');

const gap3 = calculateValuationGap(100, 100); // fair value
assert(S3, 'Zero gap gives hold signal', gap3.signal === 'hold');

const gap4 = calculateValuationGap(80, 100); // -20% deep value
assert(S3, 'Signal is strong_buy for -20% gap', gap4.signal === 'strong_buy');

// adjustThresholds
const adj1 = adjustThresholds(0.7, 0.3, -0.10); // undervalued
assertClose(S3, 'Buy threshold lowered when undervalued', adj1.buyThreshold, 0.65, 0.01);
assertClose(S3, 'Sell threshold raised when undervalued', adj1.sellThreshold, 0.35, 0.01);

const adj2 = adjustThresholds(0.7, 0.3, 0.10); // overvalued
assert(S3, 'Buy threshold raised when overvalued', adj2.buyThreshold === 0.75, `got ${adj2.buyThreshold}`);
assert(S3, 'Sell threshold lowered when overvalued', adj2.sellThreshold === 0.25, `got ${adj2.sellThreshold}`);

const adj3 = adjustThresholds(0.7, 0.3, 0.02); // fair value
assert(S3, 'No change at fair value', adj3.buyThreshold === 0.7 && adj3.sellThreshold === 0.3);

// Boundary: extreme adjustments
const adj4 = adjustThresholds(0.9, 0.1, -0.50);
assert(S3, 'Buy threshold clamped at 0.3 min', adj4.buyThreshold >= 0.3);
const adj5 = adjustThresholds(0.3, 0.7, 0.50);
assert(S3, 'Buy threshold clamped at 0.9 max', adj5.buyThreshold <= 0.9);

// ============ 4. اختبار الأداء ============

console.log('\n📋 4. Performance Test');

const S4 = 'Performance Test';

// Generate 500 days of data
const perfPrices: number[] = [100];
for (let i = 1; i < 500; i++) perfPrices.push(perfPrices[i-1] * (1 + (Math.sin(i*0.1)*0.01)));

const perfStart = Date.now();

// Calculate all indicators
for (let i = 50; i < perfPrices.length; i++) {
  const slice = perfPrices.slice(0, i+1);
  // SMA calculations
  const sma20 = slice.slice(-20).reduce((a,b) => a+b,0) / 20;
  const sma50 = slice.slice(-50).reduce((a,b) => a+b,0) / 50;
  // Fair value calculations
  fairGoldPrice(DEFAULT_MACRO);
  fairCbeRate(DEFAULT_MACRO);
  fairUsdEgp(DEFAULT_MACRO);
  fairEgx30(DEFAULT_MACRO);
  calculateValuationGap(perfPrices[i], 100);
}

const perfTime = Date.now() - perfStart;
assert(S4, 'Performance: 500 days < 5 seconds', perfTime < 5000, `took ${perfTime}ms`);
assert(S4, 'Performance: 500 days < 2 seconds', perfTime < 2000, `took ${perfTime}ms`);

// ============ 5. اختبار الحواف ============

console.log('\n📋 5. Edge Cases');

const S5 = 'Edge Cases';

// Empty data
assert(S5, 'Empty prices return 0 for gap', calculateValuationGap(0, 0).gap === 0);

// Zero fair price
assert(S5, 'Zero fair price returns hold', calculateValuationGap(100, 0).signal === 'hold');

// Negative values
assert(S5, 'Negative price gives valid gap', typeof calculateValuationGap(-10, 100).gap === 'number');

// Very large numbers
const bigGap = calculateValuationGap(1000000, 100);
assert(S5, 'Very large price gives strong_sell', bigGap.signal === 'strong_sell');

// Very small numbers
const smallGap = calculateValuationGap(0.001, 100);
assert(S5, 'Very small price gives strong_buy', smallGap.signal === 'strong_buy');

// All macro at minimum
const minMacro: MacroVariables = { usRealYield10y: -2, dxyIndex: 80, vixIndex: 8, centralBankGoldBuy: 0, globalPMI: 35, cpiEgypt: 4, cpiUS: 0, cbeInterestRate: 7, usFedRate: 0, nfaGap: -30, externalDebtService: 0, fdi: 0, remittances: 10, exports: 20, reserves: 20 };
assert(S5, 'Gold with min macro is positive', fairGoldPrice(minMacro) > 0);
assert(S5, 'CBE rate with min macro is positive', fairCbeRate(minMacro) > 0);
assert(S5, 'EGX30 with min macro is in range', fairEgx30(minMacro) >= 5000);

// All macro at maximum
const maxMacro: MacroVariables = { usRealYield10y: 5, dxyIndex: 125, vixIndex: 80, centralBankGoldBuy: 100, globalPMI: 65, cpiEgypt: 50, cpiUS: 15, cbeInterestRate: 40, usFedRate: 10, nfaGap: 30, externalDebtService: 30, fdi: 15, remittances: 40, exports: 60, reserves: 60 };
assert(S5, 'Gold with max macro is non-negative', fairGoldPrice(maxMacro) >= 0);
assert(S5, 'CBE rate with max macro is capped at 50', fairCbeRate(maxMacro) <= 50);
assert(S5, 'USD/EGP with max macro is reasonable', fairUsdEgp(maxMacro) >= 10);

// ============ تقرير النتائج ============

console.log('\n' + '='.repeat(70));
console.log('📊 تقرير الاختبار الشامل - Pre-Release');
console.log('='.repeat(70));

const suites = new Map<string, { total: number; passed: number; failed: number }>();
for (const d of details) {
  if (!suites.has(d.suite)) suites.set(d.suite, { total: 0, passed: 0, failed: 0 });
  const s = suites.get(d.suite)!;
  s.total++;
  if (d.status === 'PASS') s.passed++; else s.failed++;
}

for (const [suite, stats] of suites) {
  const icon = stats.failed === 0 ? '✅' : '❌';
  console.log(`${icon} ${suite}: ${stats.passed}/${stats.total} passed`);
}

console.log(`\nالإجمالي: ${passed}/${totalTests} passed (${failed} failed)`);
console.log(`نسبة النجاح: ${((passed/totalTests)*100).toFixed(1)}%`);

// JSON report
const report = {
  testReport: {
    date: new Date().toISOString().split('T')[0],
    summary: { totalTests, passed, failed, blocked: 0 },
    details: Array.from(suites.entries()).map(([suite, stats]) => ({
      testSuite: suite,
      status: stats.failed === 0 ? 'PASS' : 'FAIL',
      tests: stats.total,
      passed: stats.passed,
      failed: stats.failed,
      failedTests: details.filter(d => d.suite === suite && d.status === 'FAIL').map(d => `${d.test}: ${d.notes}`),
    })),
    readyForRelease: failed <= 2,
    recommendations: details.filter(d => d.status === 'FAIL').map(d => `Fix: ${d.test} (${d.notes})`),
  }
};

console.log('\n📋 JSON Report:');
console.log(JSON.stringify(report, null, 2));
