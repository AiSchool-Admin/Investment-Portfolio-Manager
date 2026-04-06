/**
 * مولّد بيانات اختبار واقعية - 7 سيناريوهات سوق
 * فريق Claude + DeepSeek + Gemini
 *
 * يولّد ملفات CSV بتنسيق Date,Value
 * يستخدم Math.random للضوضاء (بدون مكتبات خارجية)
 */

import * as fs from 'fs';
import * as path from 'path';

// ============ مولّد أرقام عشوائية ببذرة ثابتة (للتكرار) ============
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

// ============ إعدادات السيناريوهات ============

interface ScenarioConfig {
  name: string;
  filename: string;
  days: number;
  startPrice: number;
  description: string;
  generator: (config: ScenarioConfig, rng: () => number) => number[];
}

// ============ دوال التوليد ============

function generateBullSteady(config: ScenarioConfig, rng: () => number): number[] {
  // صعود ثابت: +0.15%/يوم مع ضوضاء صغيرة (±0.5%)
  const prices: number[] = [config.startPrice];
  for (let i = 1; i < config.days; i++) {
    const prev = prices[i - 1];
    const trend = 0.0015; // +0.15%/يوم ≈ +45% سنوياً
    const noise = (rng() - 0.5) * 0.010; // ±0.5% ضوضاء
    prices.push(Math.round(prev * (1 + trend + noise) * 100) / 100);
  }
  return prices;
}

function generateBullCorrections(config: ScenarioConfig, rng: () => number): number[] {
  // صعود مع تصحيحات 5-10% كل 30-45 يوم
  // المفتاح: الاتجاه العام صاعد بوضوح (+0.2%/يوم) والتصحيحات مؤقتة
  const prices: number[] = [config.startPrice];
  let nextCorrectionDay = 35 + Math.floor(rng() * 10);
  let inCorrection = false;
  let correctionDaysLeft = 0;

  for (let i = 1; i < config.days; i++) {
    const prev = prices[i - 1];
    let dailyReturn: number;

    if (inCorrection) {
      dailyReturn = -(0.006 + rng() * 0.006); // تصحيح -0.6% إلى -1.2%/يوم
      correctionDaysLeft--;
      if (correctionDaysLeft <= 0) {
        inCorrection = false;
        nextCorrectionDay = i + 30 + Math.floor(rng() * 15);
      }
    } else if (i >= nextCorrectionDay) {
      inCorrection = true;
      correctionDaysLeft = 4 + Math.floor(rng() * 4); // 4-8 أيام
      dailyReturn = -0.012; // أول يوم هبوط
    } else {
      dailyReturn = 0.002 + rng() * 0.001; // صعود +0.2% إلى +0.3%/يوم
    }

    const noise = (rng() - 0.5) * 0.004;
    prices.push(Math.round(prev * (1 + dailyReturn + noise) * 100) / 100);
  }
  return prices;
}

function generateBearSteady(config: ScenarioConfig, rng: () => number): number[] {
  // هبوط ثابت: -0.12%/يوم مع ضوضاء
  const prices: number[] = [config.startPrice];
  for (let i = 1; i < config.days; i++) {
    const prev = prices[i - 1];
    const trend = -0.0012; // -0.12%/يوم ≈ -26% سنوياً
    const noise = (rng() - 0.5) * 0.010;
    prices.push(Math.round(prev * (1 + trend + noise) * 100) / 100);
  }
  return prices;
}

function generateBearRallies(config: ScenarioConfig, rng: () => number): number[] {
  // هبوط مع ارتدادات 5-8% كل 20-35 يوم
  // المفتاح: الاتجاه العام هابط بوضوح (-0.15%/يوم) والارتدادات مؤقتة
  const prices: number[] = [config.startPrice];
  let nextRallyDay = 20 + Math.floor(rng() * 10);
  let inRally = false;
  let rallyDaysLeft = 0;

  for (let i = 1; i < config.days; i++) {
    const prev = prices[i - 1];
    let dailyReturn: number;

    if (inRally) {
      dailyReturn = 0.006 + rng() * 0.004; // ارتداد مؤقت +0.6% إلى +1.0%
      rallyDaysLeft--;
      if (rallyDaysLeft <= 0) {
        inRally = false;
        nextRallyDay = i + 18 + Math.floor(rng() * 12);
      }
    } else if (i >= nextRallyDay) {
      inRally = true;
      rallyDaysLeft = 3 + Math.floor(rng() * 3); // 3-6 أيام ارتداد
      dailyReturn = 0.008;
    } else {
      dailyReturn = -0.002 - rng() * 0.001; // هبوط -0.2% إلى -0.3%/يوم
    }

    const noise = (rng() - 0.5) * 0.004;
    prices.push(Math.round(prev * (1 + dailyReturn + noise) * 100) / 100);
  }
  return prices;
}

function generateRangingTight(config: ScenarioConfig, rng: () => number): number[] {
  // تذبذب ضيق: مدى 5-8%
  const prices: number[] = [];
  const mid = config.startPrice;
  const amplitude = mid * 0.04; // ±4% = مدى 8%
  for (let i = 0; i < config.days; i++) {
    const cycle1 = Math.sin(i * 2 * Math.PI / 55) * amplitude;
    const cycle2 = Math.sin(i * 2 * Math.PI / 23) * (amplitude * 0.3);
    const noise = (rng() - 0.5) * mid * 0.005;
    prices.push(Math.round((mid + cycle1 + cycle2 + noise) * 100) / 100);
  }
  return prices;
}

function generateRangingWide(config: ScenarioConfig, rng: () => number): number[] {
  // تذبذب واسع: مدى 20-25%
  const prices: number[] = [];
  const mid = config.startPrice;
  const amplitude = mid * 0.12; // ±12% = مدى 24%
  for (let i = 0; i < config.days; i++) {
    const cycle1 = Math.sin(i * 2 * Math.PI / 75) * amplitude;
    const cycle2 = Math.sin(i * 2 * Math.PI / 35) * (amplitude * 0.3);
    const cycle3 = Math.sin(i * 2 * Math.PI / 120) * (amplitude * 0.2);
    const noise = (rng() - 0.5) * mid * 0.01;
    prices.push(Math.round((mid + cycle1 + cycle2 + cycle3 + noise) * 100) / 100);
  }
  return prices;
}

function generateMixedRegime(config: ScenarioConfig, rng: () => number): number[] {
  // 120 يوم صاعد → 100 يوم متذبذب → 80 يوم هابط
  const prices: number[] = [config.startPrice];

  for (let i = 1; i < config.days; i++) {
    const prev = prices[i - 1];
    let dailyReturn: number;

    if (i <= 120) {
      // فترة صاعدة
      dailyReturn = 0.0018 + (rng() - 0.5) * 0.008;
    } else if (i <= 220) {
      // فترة متذبذبة
      const cyclePos = Math.sin((i - 120) * 2 * Math.PI / 40);
      dailyReturn = cyclePos * 0.008 + (rng() - 0.5) * 0.006;
    } else {
      // فترة هابطة
      dailyReturn = -0.0015 + (rng() - 0.5) * 0.008;
    }

    prices.push(Math.round(prev * (1 + dailyReturn) * 100) / 100);
  }
  return prices;
}

// ============ الإعدادات ============

const scenarios: ScenarioConfig[] = [
  {
    name: 'صعود ثابت (Bull Steady)',
    filename: 'bull_steady.csv',
    days: 300, startPrice: 100,
    description: 'صعود مستمر +45% سنوياً مع تقلب منخفض',
    generator: generateBullSteady,
  },
  {
    name: 'صعود مع تصحيحات (Bull Corrections)',
    filename: 'bull_corrections.csv',
    days: 350, startPrice: 100,
    description: 'صعود عام مع تصحيحات 5-10% كل 30-45 يوم',
    generator: generateBullCorrections,
  },
  {
    name: 'هبوط ثابت (Bear Steady)',
    filename: 'bear_steady.csv',
    days: 300, startPrice: 100,
    description: 'هبوط مستمر -26% سنوياً مع تقلب منخفض',
    generator: generateBearSteady,
  },
  {
    name: 'هبوط مع ارتدادات (Bear Rallies)',
    filename: 'bear_rallies.csv',
    days: 300, startPrice: 100,
    description: 'هبوط عام مع ارتدادات مؤقتة 5-8% كل 20-35 يوم',
    generator: generateBearRallies,
  },
  {
    name: 'تذبذب ضيق (Ranging Tight)',
    filename: 'ranging_tight.csv',
    days: 300, startPrice: 100,
    description: 'تذبذب في مدى 5-8% حول المتوسط',
    generator: generateRangingTight,
  },
  {
    name: 'تذبذب واسع (Ranging Wide)',
    filename: 'ranging_wide.csv',
    days: 350, startPrice: 100,
    description: 'تذبذب في مدى 20-25% مع قمم وقيعان حادة',
    generator: generateRangingWide,
  },
  {
    name: 'انتقال بين الأنماط (Mixed Regime)',
    filename: 'mixed_regime.csv',
    days: 300, startPrice: 100,
    description: '120 يوم صاعد → 100 يوم متذبذب → 80 يوم هابط',
    generator: generateMixedRegime,
  },
];

// ============ توليد الملفات ============

const outputDir = path.join(__dirname, 'test-data');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

console.log('='.repeat(70));
console.log('مولّد بيانات الاختبار - فريق Claude + DeepSeek + Gemini');
console.log('='.repeat(70));

for (const scenario of scenarios) {
  const rng = seededRandom(scenario.filename.length * 1000 + scenario.days);
  const prices = scenario.generator(scenario, rng);

  // توليد التواريخ
  const startDate = new Date('2025-01-02');
  const lines = ['Date,Value'];
  for (let i = 0; i < prices.length; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    lines.push(`${dateStr},${prices[i].toFixed(2)}`);
  }

  const filepath = path.join(outputDir, scenario.filename);
  fs.writeFileSync(filepath, lines.join('\n'));

  // إحصائيات
  const endPrice = prices[prices.length - 1];
  const totalReturn = ((endPrice - prices[0]) / prices[0] * 100);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const maxDD = (() => {
    let peak = prices[0], maxDD = 0;
    for (const p of prices) {
      if (p > peak) peak = p;
      const dd = (peak - p) / peak;
      if (dd > maxDD) maxDD = dd;
    }
    return maxDD;
  })();

  console.log(`\n📊 ${scenario.name}`);
  console.log(`   ملف: ${scenario.filename} | ${prices.length} يوم`);
  console.log(`   الوصف: ${scenario.description}`);
  console.log(`   بداية: $${prices[0]} → نهاية: $${endPrice.toFixed(2)} (${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(1)}%)`);
  console.log(`   أعلى: $${maxPrice.toFixed(2)} | أدنى: $${minPrice.toFixed(2)} | أقصى انخفاض: ${(maxDD * 100).toFixed(1)}%`);
}

console.log(`\n${'='.repeat(70)}`);
console.log(`تم توليد ${scenarios.length} ملفات في ${outputDir}`);
