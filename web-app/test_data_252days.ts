/**
 * بيانات اختبار واقعية - سنة كاملة (252 يوم تداول)
 */

// صاعد واقعي: يحاكي سهم نمو مع تصحيحات 5-8%
function generateRealisticTrendingUp(): number[] {
  const prices: number[] = [10.00];
  for (let i = 1; i < 252; i++) {
    const prev = prices[i - 1];
    const dailyReturn = 0.0015; // ~45% سنوي
    const noise = (Math.sin(i * 0.3) * 0.005) + (Math.cos(i * 0.7) * 0.003);
    // تصحيحات دورية كل 40-50 يوم
    const correction = (i % 45 > 35) ? -0.008 : 0;
    prices.push(Math.round((prev * (1 + dailyReturn + noise + correction)) * 100) / 100);
  }
  return prices;
}

// هابط واقعي: يحاكي سهم في هبوط مع ارتدادات
function generateRealisticTrendingDown(): number[] {
  const prices: number[] = [15.00];
  for (let i = 1; i < 252; i++) {
    const prev = prices[i - 1];
    const dailyReturn = -0.0012; // ~-26% سنوي
    const noise = (Math.sin(i * 0.4) * 0.004) + (Math.cos(i * 0.6) * 0.003);
    // ارتدادات مؤقتة كل 30 يوم
    const bounce = (i % 35 > 28) ? 0.006 : 0;
    prices.push(Math.round((prev * (1 + dailyReturn + noise + bounce)) * 100) / 100);
  }
  return prices;
}

// متذبذب واقعي: يحاكي صندوق متوازن بدورات 60-90 يوم
function generateRealisticRanging(): number[] {
  const prices: number[] = [];
  for (let i = 0; i < 252; i++) {
    const cycle1 = Math.sin(i * 2 * Math.PI / 70) * 1.5;
    const cycle2 = Math.sin(i * 2 * Math.PI / 40) * 0.5;
    const drift = i * 0.001; // انحراف طفيف صاعد
    const noise = Math.sin(i * 3.7) * 0.15;
    prices.push(Math.round((10.5 + cycle1 + cycle2 + drift + noise) * 100) / 100);
  }
  return prices;
}

// تصدير
export { generateRealisticTrendingUp, generateRealisticTrendingDown, generateRealisticRanging };
