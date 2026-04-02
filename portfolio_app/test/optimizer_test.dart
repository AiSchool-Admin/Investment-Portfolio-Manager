/// اختبارات الخوارزميات المالية
/// يمكن تشغيلها بـ: flutter test test/optimizer_test.dart

// ملاحظة: هذا ملف اختبار يدوي يمكن تشغيله كسكربت Dart مستقل
// dart run test/optimizer_test.dart

import '../lib/services/optimizer_engine.dart';

void main() {
  print('=' * 60);
  print('اختبار محرك Optimum Score');
  print('=' * 60);

  testStatistics();
  testZScore();
  testRSI();
  testSharpe();
  testOptimumScore();
  testAnalyzeAsset();
  testBacktest();
  testPortfolioOptimization();

  print('\n✅ جميع الاختبارات نجحت!');
}

void testStatistics() {
  print('\n--- اختبار الدوال الإحصائية ---');

  final values = [10.0, 20.0, 30.0, 40.0, 50.0];
  final avg = OptimizerEngine.mean(values);
  assert(avg == 30.0, 'Mean should be 30.0, got $avg');
  print('✓ المتوسط: $avg');

  final std = OptimizerEngine.standardDeviation(values);
  print('✓ الانحراف المعياري: ${std.toStringAsFixed(4)}');
  assert(std > 15 && std < 16, 'StdDev should be ~15.81');

  final returns = OptimizerEngine.calculateReturns([100, 110, 105, 115]);
  print('✓ العوائد: $returns');
  assert(returns.length == 3, 'Should have 3 returns');
}

void testZScore() {
  print('\n--- اختبار Z-Score ---');

  final prices = [150.0, 152.0, 148.0, 155.0, 160.0, 158.0, 162.0, 165.0, 170.0, 168.0];
  final z = OptimizerEngine.calculateZScore(168.0, prices);
  print('✓ Z-Score لـ AAPL @ 168: ${z.toStringAsFixed(4)}');

  // سعر منخفض جداً -> Z-Score سالب
  final zLow = OptimizerEngine.calculateZScore(140.0, prices);
  print('✓ Z-Score لـ AAPL @ 140: ${zLow.toStringAsFixed(4)}');
  assert(zLow < 0, 'Low price should have negative Z-Score');

  // سعر مرتفع جداً -> Z-Score موجب
  final zHigh = OptimizerEngine.calculateZScore(180.0, prices);
  print('✓ Z-Score لـ AAPL @ 180: ${zHigh.toStringAsFixed(4)}');
  assert(zHigh > 0, 'High price should have positive Z-Score');
}

void testRSI() {
  print('\n--- اختبار RSI ---');

  // بيانات صاعدة -> RSI مرتفع
  final upPrices = List.generate(20, (i) => 100.0 + i * 2.0);
  final rsiUp = OptimizerEngine.calculateRSI(upPrices);
  print('✓ RSI (اتجاه صاعد): ${rsiUp.toStringAsFixed(2)}');
  assert(rsiUp > 70, 'Uptrend RSI should be > 70');

  // بيانات هابطة -> RSI منخفض
  final downPrices = List.generate(20, (i) => 200.0 - i * 2.0);
  final rsiDown = OptimizerEngine.calculateRSI(downPrices);
  print('✓ RSI (اتجاه هابط): ${rsiDown.toStringAsFixed(2)}');
  assert(rsiDown < 30, 'Downtrend RSI should be < 30');
}

void testSharpe() {
  print('\n--- اختبار نسبة شارب ---');

  final sharpe = OptimizerEngine.sharpeRatio(0.12, 0.03, 0.20);
  print('✓ Sharpe (12% return, 3% rf, 20% vol): ${sharpe.toStringAsFixed(4)}');
  assert(sharpe > 0.4 && sharpe < 0.5, 'Sharpe should be ~0.45');
}

void testOptimumScore() {
  print('\n--- اختبار Optimum Score ---');

  // حالة 1: عائد جيد وسعر منخفض (Z سالب) -> OS مرتفع (شراء)
  final osBuy = OptimizerEngine.computeOptimumScore(
    expectedRet: 0.15,
    volatility: 0.20,
    zScore: -2.0,
    riskFreeRate: 0.03,
    transactionCost: 0.001,
  );
  print('✓ OS (فرصة شراء - Z=-2): ${osBuy.toStringAsFixed(4)}');
  assert(osBuy >= 0.7, 'Buy opportunity OS should be >= 0.7, got $osBuy');

  // حالة 2: عائد ضعيف وسعر مرتفع (Z موجب) -> OS منخفض (بيع)
  final osSell = OptimizerEngine.computeOptimumScore(
    expectedRet: 0.01,
    volatility: 0.30,
    zScore: 2.5,
    riskFreeRate: 0.03,
    transactionCost: 0.001,
  );
  print('✓ OS (فرصة بيع - Z=+2.5): ${osSell.toStringAsFixed(4)}');
  assert(osSell <= 0.3, 'Sell opportunity OS should be <= 0.3, got $osSell');

  // حالة 3: وسط -> OS متوسط
  final osNeutral = OptimizerEngine.computeOptimumScore(
    expectedRet: 0.05,
    volatility: 0.15,
    zScore: 0.0,
    riskFreeRate: 0.03,
    transactionCost: 0.001,
  );
  print('✓ OS (حيادي - Z=0): ${osNeutral.toStringAsFixed(4)}');
  assert(osNeutral > 0.3 && osNeutral < 0.7, 'Neutral OS should be between 0.3 and 0.7');
}

void testAnalyzeAsset() {
  print('\n--- اختبار تحليل الأصل الكامل ---');

  // AAPL مع بيانات تاريخية
  final histPrices = [
    150.0, 152.0, 148.0, 155.0, 153.0, 157.0, 160.0, 158.0, 162.0, 165.0,
    163.0, 167.0, 170.0, 168.0, 172.0, 175.0, 173.0, 176.0, 179.0, 177.0,
    180.0, 183.0, 181.0, 184.0, 186.0, 183.0, 187.0, 189.0, 188.0, 190.0,
    185.0, 182.0, 179.0, 176.0, 173.0, 170.0, 168.0, 172.0, 175.0, 178.0,
    180.0, 183.0, 181.0, 184.0, 186.0, 185.0, 187.0, 189.0, 186.0, 184.0,
  ];

  final signal = OptimizerEngine.analyzeAsset(
    assetName: 'AAPL',
    assetId: 1,
    currentPrice: 168.0,
    historicalPrices: histPrices,
    quantityHeld: 10,
    portfolioValue: 5000,
    targetWeight: 0.3,
    availableCash: 2000,
  );

  print('✓ AAPL:');
  print('  الإشارة: ${signal.signalTypeArabic}');
  print('  OS: ${signal.optimumScore.toStringAsFixed(4)}');
  print('  Z-Score: ${signal.zScore.toStringAsFixed(4)}');
  print('  العائد المتوقع: ${(signal.expectedReturn * 100).toStringAsFixed(2)}%');
  print('  التقلب: ${(signal.volatility * 100).toStringAsFixed(2)}%');
  print('  الأسباب:');
  for (final r in signal.reasons) {
    print('    - $r');
  }
}

void testBacktest() {
  print('\n--- اختبار الباك تيست ---');

  // بيانات 100 يوم
  final prices = <double>[];
  double price = 100.0;
  final changes = [
    0.02, -0.01, 0.015, -0.005, 0.01, 0.025, -0.02, 0.005, 0.01, -0.015,
    0.03, -0.01, 0.02, -0.025, 0.015, 0.005, -0.01, 0.02, -0.005, 0.01,
  ];
  for (int i = 0; i < 100; i++) {
    prices.add(price);
    price *= (1 + changes[i % changes.length]);
  }

  final result = OptimizerEngine.runBacktest(
    prices: prices,
    initialCapital: 10000,
    lookbackWindow: 30,
  );

  print('✓ نتائج الباك تيست:');
  print('  العائد: ${result.totalReturn.toStringAsFixed(2)}%');
  print('  الشراء والاحتفاظ: ${result.buyAndHoldReturn.toStringAsFixed(2)}%');
  print('  عدد الصفقات: ${result.numberOfTrades}');
  print('  معدل الفوز: ${result.winRate.toStringAsFixed(1)}%');
  print('  نقاط منحنى رأس المال: ${result.equityCurve.length}');
}

void testPortfolioOptimization() {
  print('\n--- اختبار تحسين المحفظة ---');

  // عوائد متوقعة لـ 3 أصول
  final expectedReturns = [0.12, 0.08, 0.05]; // أسهم، سندات، ذهب

  // مصفوفة التغاير
  final returns1 = [0.02, -0.01, 0.015, -0.005, 0.01, 0.025, -0.02, 0.005, 0.01, -0.015];
  final returns2 = [0.005, 0.003, -0.002, 0.004, -0.001, 0.003, 0.002, -0.003, 0.001, 0.004];
  final returns3 = [0.01, 0.005, 0.008, -0.003, 0.006, 0.002, 0.007, -0.001, 0.004, 0.003];

  final covMatrix = OptimizerEngine.covarianceMatrix([returns1, returns2, returns3]);
  print('✓ مصفوفة التغاير:');
  for (final row in covMatrix) {
    print('  ${row.map((v) => v.toStringAsFixed(6)).join(', ')}');
  }

  // تحسين الأوزان
  final weights = OptimizerEngine.optimizeWeights(
    expectedReturns: expectedReturns,
    covMatrix: covMatrix,
  );
  print('✓ الأوزان المثلى: ${weights.map((w) => '${(w * 100).toStringAsFixed(1)}%').join(', ')}');

  // التحقق من أن المجموع = 1
  final sum = weights.reduce((a, b) => a + b);
  assert((sum - 1.0).abs() < 0.01, 'Weights should sum to 1.0, got $sum');

  // فحص إعادة التوازن
  final rebalancing = OptimizerEngine.checkRebalancing(
    assetNames: ['AAPL', 'BTC', 'GOLD'],
    currentWeights: [0.45, 0.35, 0.20],
    targetWeights: [0.30, 0.20, 0.50],
  );
  print('✓ أصول تحتاج إعادة توازن: ${rebalancing.length}');
  for (final r in rebalancing) {
    print('  ${r.assetName}: انحراف ${(r.deviation * 100).toStringAsFixed(1)}%');
  }
}
