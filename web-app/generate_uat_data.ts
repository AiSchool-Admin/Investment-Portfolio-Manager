/**
 * مولّد بيانات UAT - 5 أصول × 252 يوم مع أحداث اقتصادية
 */
import * as fs from 'fs';
import * as path from 'path';

function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

interface Event { day: number; btc: number; egx: number; tbi: number; xau: number; reit: number; }

const EVENTS: Event[] = [
  { day: 50, btc: -0.08, egx: -0.02, tbi: 0.01, xau: -0.05, reit: -0.01 },  // رفع فائدة أمريكية
  { day: 100, btc: 0.03, egx: 0.04, tbi: 0.01, xau: 0.02, reit: 0.05 },     // تضخم مصري
  { day: 130, btc: -0.02, egx: -0.06, tbi: 0.03, xau: -0.01, reit: -0.04 },  // رفع CBE
  { day: 175, btc: 0.10, egx: 0.20, tbi: -0.02, xau: 0.08, reit: 0.15 },     // تعويم الجنيه
  { day: 230, btc: -0.10, egx: -0.05, tbi: 0.01, xau: 0.10, reit: -0.03 },   // أزمة جيوسياسية
];

function gen(name: string, start: number, trend: number, vol: number, field: keyof Event): number[] {
  const rng = seeded(name.length * 777);
  const prices = [start];
  for (let i = 1; i < 252; i++) {
    let ret = trend + (rng() - 0.5) * vol;
    for (const e of EVENTS) {
      if (i === e.day) ret += e[field] as number;
      if (i > e.day && i <= e.day + 5) ret += (e[field] as number) * 0.1;
    }
    prices.push(Math.round(prices[i-1] * (1 + ret) * 100) / 100);
  }
  return prices;
}

const btc = gen('BTC', 45000, 0.0008, 0.03, 'btc');
const egx = gen('EGX', 15000, 0.0005, 0.015, 'egx');
const tbi = gen('TBI', 100, 0.0002, 0.002, 'tbi');
const xau = gen('XAU', 2000, 0.0003, 0.012, 'xau');
const reit = gen('REIT', 10, 0.0004, 0.01, 'reit');

// ملف واحد متعدد الأعمدة
const startDate = new Date('2025-01-02');
const lines = ['Date,BTC,EGX,TBI,XAU,REIT'];
for (let i = 0; i < 252; i++) {
  const d = new Date(startDate); d.setDate(d.getDate() + i);
  lines.push(`${d.toISOString().split('T')[0]},${btc[i].toFixed(2)},${egx[i].toFixed(2)},${tbi[i].toFixed(2)},${xau[i].toFixed(2)},${reit[i].toFixed(2)}`);
}

const outDir = path.join(__dirname, 'test-data', 'uat');
fs.writeFileSync(path.join(outDir, 'uat_assets_2025.csv'), lines.join('\n'));

// ملفات فردية لكل أصل (للاستيراد في التطبيق)
const assets = [
  { name: 'BTC', prices: btc },
  { name: 'EGX30', prices: egx },
  { name: 'T-BILL', prices: tbi },
  { name: 'GOLD', prices: xau },
  { name: 'REIT', prices: reit },
];

for (const a of assets) {
  const csv = ['Date,Value'];
  for (let i = 0; i < 252; i++) {
    const d = new Date(startDate); d.setDate(d.getDate() + i);
    csv.push(`${d.toISOString().split('T')[0]},${a.prices[i].toFixed(2)}`);
  }
  fs.writeFileSync(path.join(outDir, `${a.name}.csv`), csv.join('\n'));
}

console.log('✅ تم إنشاء بيانات UAT:');
for (const a of assets) {
  const p = a.prices;
  console.log(`  ${a.name}: $${p[0]} → $${p[251].toFixed(2)} (${((p[251]-p[0])/p[0]*100).toFixed(1)}%)`);
}
