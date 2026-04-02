import 'dart:math';
import '../models/signal.dart';

/// محرك التحسين - Optimum Score Engine
/// تنفيذ كامل بلغة Dart للخوارزميات المالية
class OptimizerEngine {
  // المعاملات الافتراضية
  static const double defaultAlpha = 0.4; // وزن العائد المعدل بالمخاطر
  static const double defaultBeta = 0.4; // وزن Z-Score
  static const double defaultGamma = 0.2; // وزن تكلفة المعاملات
  static const double defaultRiskFreeRate = 0.03; // 3%
  static const double defaultTransactionCost = 0.001; // 0.1%

  // ============================================================
  // 1. الدوال الإحصائية الأساسية
  // ============================================================

  /// حساب المتوسط الحسابي
  static double mean(List<double> values) {
    if (values.isEmpty) return 0.0;
    return values.reduce((a, b) => a + b) / values.length;
  }

  /// حساب الانحراف المعياري
  static double standardDeviation(List<double> values) {
    if (values.length < 2) return 0.0;
    final avg = mean(values);
    final sumSquaredDiff =
        values.map((v) => pow(v - avg, 2)).reduce((a, b) => a + b);
    return sqrt(sumSquaredDiff / (values.length - 1));
  }

  /// حساب التغاير (Covariance) بين مجموعتين
  static double covariance(List<double> x, List<double> y) {
    if (x.length != y.length || x.length < 2) return 0.0;
    final meanX = mean(x);
    final meanY = mean(y);
    double sum = 0.0;
    for (int i = 0; i < x.length; i++) {
      sum += (x[i] - meanX) * (y[i] - meanY);
    }
    return sum / (x.length - 1);
  }

  /// حساب العوائد اليومية من الأسعار
  static List<double> calculateReturns(List<double> prices) {
    if (prices.length < 2) return [];
    final returns = <double>[];
    for (int i = 1; i < prices.length; i++) {
      if (prices[i - 1] != 0) {
        returns.add((prices[i] - prices[i - 1]) / prices[i - 1]);
      }
    }
    return returns;
  }

  // ============================================================
  // 2. المؤشرات المالية
  // ============================================================

  /// حساب RSI (مؤشر القوة النسبية)
  static double calculateRSI(List<double> prices, {int period = 14}) {
    if (prices.length < period + 1) return 50.0;

    final gains = <double>[];
    final losses = <double>[];

    for (int i = prices.length - period; i < prices.length; i++) {
      final diff = prices[i] - prices[i - 1];
      if (diff >= 0) {
        gains.add(diff);
        losses.add(0);
      } else {
        gains.add(0);
        losses.add(-diff);
      }
    }

    final avgGain = gains.reduce((a, b) => a + b) / period;
    final avgLoss = losses.reduce((a, b) => a + b) / period;

    if (avgLoss == 0) return 100.0;
    final rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /// حساب Z-Score
  /// Z = (P_t - μ) / σ
  static double calculateZScore(
      double currentPrice, List<double> historicalPrices) {
    if (historicalPrices.length < 2) return 0.0;
    final mu = mean(historicalPrices);
    final sigma = standardDeviation(historicalPrices);
    if (sigma == 0) return 0.0;
    return (currentPrice - mu) / sigma;
  }

  /// تقدير العائد المتوقع من العوائد التاريخية (سنوي)
  static double expectedReturn(List<double> historicalReturns,
      {bool annualize = true}) {
    if (historicalReturns.isEmpty) return 0.0;
    final avgDaily = mean(historicalReturns);
    return annualize ? avgDaily * 252 : avgDaily;
  }

  /// حساب التقلب (سنوي)
  static double calculateVolatility(List<double> returns,
      {bool annualize = true}) {
    if (returns.length < 2) return 0.0;
    final std = standardDeviation(returns);
    return annualize ? std * sqrt(252) : std;
  }

  /// نسبة شارب
  /// Sharpe = (E[R] - Rf) / σ
  static double sharpeRatio(
      double expectedReturn, double riskFreeRate, double volatility) {
    if (volatility == 0) return 0.0;
    return (expectedReturn - riskFreeRate) / volatility;
  }

  // ============================================================
  // 3. مصفوفة التغاير وتحسين المحفظة
  // ============================================================

  /// حساب مصفوفة التغاير بين أصول متعددة
  static List<List<double>> covarianceMatrix(
      List<List<double>> assetsReturns) {
    final n = assetsReturns.length;
    final matrix = List.generate(n, (_) => List.filled(n, 0.0));
    for (int i = 0; i < n; i++) {
      for (int j = i; j < n; j++) {
        final cov = covariance(assetsReturns[i], assetsReturns[j]);
        matrix[i][j] = cov;
        matrix[j][i] = cov; // مصفوفة متماثلة
      }
    }
    return matrix;
  }

  /// حساب تباين المحفظة
  /// σ²_p = w^T * Σ * w
  static double portfolioVariance(
      List<double> weights, List<List<double>> covMatrix) {
    final n = weights.length;
    double variance = 0.0;
    for (int i = 0; i < n; i++) {
      for (int j = 0; j < n; j++) {
        variance += weights[i] * weights[j] * covMatrix[i][j];
      }
    }
    return variance;
  }

  /// حساب عائد المحفظة المتوقع
  /// E(R_p) = Σ w_i * E(R_i)
  static double portfolioExpectedReturn(
      List<double> weights, List<double> expectedReturns) {
    double ret = 0.0;
    for (int i = 0; i < weights.length; i++) {
      ret += weights[i] * expectedReturns[i];
    }
    return ret;
  }

  /// تحسين الأوزان لتعظيم نسبة شارب (بحث شبكي بسيط)
  /// في MVP نستخدم أسلوب Monte Carlo المبسط
  static List<double> optimizeWeights({
    required List<double> expectedReturns,
    required List<List<double>> covMatrix,
    double riskFreeRate = defaultRiskFreeRate,
    int iterations = 10000,
  }) {
    final n = expectedReturns.length;
    if (n == 0) return [];
    if (n == 1) return [1.0];

    final random = Random(42); // بذرة ثابتة للتكرار
    var bestWeights = List.filled(n, 1.0 / n);
    var bestSharpe = double.negativeInfinity;

    for (int iter = 0; iter < iterations; iter++) {
      // توليد أوزان عشوائية موجبة (مجموعها = 1)
      final rawWeights = List.generate(n, (_) => random.nextDouble());
      final sum = rawWeights.reduce((a, b) => a + b);
      final weights = rawWeights.map((w) => w / sum).toList();

      final portReturn = portfolioExpectedReturn(weights, expectedReturns);
      final portVar = portfolioVariance(weights, covMatrix);
      final portVol = sqrt(portVar);

      if (portVol > 0) {
        final sharpe = (portReturn - riskFreeRate) / portVol;
        if (sharpe > bestSharpe) {
          bestSharpe = sharpe;
          bestWeights = List.from(weights);
        }
      }
    }

    return bestWeights;
  }

  // ============================================================
  // 4. Optimum Score (OS) - المعادلة الذهبية
  // ============================================================

  /// حساب Optimum Score
  /// OS = α * (E[R]-Rf)/σ + β * (-Z) - γ * C
  /// ثم تطبيع إلى [0, 1]
  static double computeOptimumScore({
    required double expectedRet,
    required double volatility,
    required double zScore,
    double riskFreeRate = defaultRiskFreeRate,
    double transactionCost = defaultTransactionCost,
    double alpha = defaultAlpha,
    double beta = defaultBeta,
    double gamma = defaultGamma,
  }) {
    final sharpe = sharpeRatio(expectedRet, riskFreeRate, volatility);
    final term1 = alpha * sharpe;
    final term2 = beta * (-zScore);
    final term3 = gamma * transactionCost;

    double os = term1 + term2 - term3;
    // تطبيع إلى [0, 1]
    os = (os + 1) / 2;
    return os.clamp(0.0, 1.0);
  }

  // ============================================================
  // 5. حساب حجم الصفقة
  // ============================================================

  /// حساب كمية وقيمة الشراء المقترحة
  static ({double quantity, double value}) calculateBuyOrder({
    required double targetWeight,
    required double currentWeight,
    required double portfolioValue,
    required double availableCash,
    required double currentPrice,
    double cashUsageRatio = 0.3,
  }) {
    final rebalancingAmount = (targetWeight - currentWeight) * portfolioValue;
    if (rebalancingAmount <= 0) return (quantity: 0.0, value: 0.0);

    final cashBased = availableCash * cashUsageRatio;
    final suggestedValue = min(rebalancingAmount, cashBased);
    if (suggestedValue <= 0 || currentPrice <= 0) {
      return (quantity: 0.0, value: 0.0);
    }

    final quantity = suggestedValue / currentPrice;
    return (quantity: quantity, value: suggestedValue);
  }

  /// حساب كمية وقيمة البيع المقترحة
  static ({double quantity, double value}) calculateSellOrder({
    required double assetQuantity,
    required double currentPrice,
    required double currentWeight,
    required double targetWeight,
    required double portfolioValue,
    String sellMode = 'rebalance', // rebalance, all, half, quarter
  }) {
    switch (sellMode) {
      case 'all':
        return (
          quantity: assetQuantity,
          value: assetQuantity * currentPrice,
        );
      case 'half':
        final qty = assetQuantity * 0.5;
        return (quantity: qty, value: qty * currentPrice);
      case 'quarter':
        final qty = assetQuantity * 0.25;
        return (quantity: qty, value: qty * currentPrice);
      default: // rebalance
        final excessValue =
            (currentWeight - targetWeight) * portfolioValue;
        if (excessValue <= 0) return (quantity: 0.0, value: 0.0);
        final qty = min(excessValue / currentPrice, assetQuantity);
        return (quantity: qty, value: qty * currentPrice);
    }
  }

  // ============================================================
  // 6. تحليل أصل كامل وإنتاج الإشارة
  // ============================================================

  /// تحليل أصل واحد وإنتاج إشارة تداول
  static TradingSignal analyzeAsset({
    required String assetName,
    required int assetId,
    required double currentPrice,
    required List<double> historicalPrices,
    required double quantityHeld,
    required double portfolioValue,
    required double targetWeight,
    required double availableCash,
    double riskFreeRate = defaultRiskFreeRate,
    double transactionCost = defaultTransactionCost,
    double alpha = defaultAlpha,
    double beta = defaultBeta,
    double gamma = defaultGamma,
  }) {
    // 1. حساب العوائد
    final returns = calculateReturns(historicalPrices);

    // 2. Z-Score
    final zScore = calculateZScore(currentPrice, historicalPrices);

    // 3. العائد المتوقع والتقلب
    final expRet = expectedReturn(returns);
    final vol = calculateVolatility(returns);

    // 4. Optimum Score
    final os = computeOptimumScore(
      expectedRet: expRet,
      volatility: vol,
      zScore: zScore,
      riskFreeRate: riskFreeRate,
      transactionCost: transactionCost,
      alpha: alpha,
      beta: beta,
      gamma: gamma,
    );

    // 5. الأوزان
    final currentValue = quantityHeld * currentPrice;
    final effectivePortfolioValue =
        portfolioValue > 0 ? portfolioValue : currentValue + availableCash;
    final currentWeight = effectivePortfolioValue > 0
        ? currentValue / effectivePortfolioValue
        : 0.0;

    // 6. اتخاذ القرار
    String signal = 'none';
    double suggestedQty = 0.0;
    double suggestedVal = 0.0;
    final reasons = <String>[];

    if (os >= 0.7) {
      signal = 'buy';
      reasons.add('Optimum Score مرتفع (${os.toStringAsFixed(2)})');
      final buyOrder = calculateBuyOrder(
        targetWeight: targetWeight,
        currentWeight: currentWeight,
        portfolioValue: effectivePortfolioValue,
        availableCash: availableCash,
        currentPrice: currentPrice,
      );
      suggestedQty = buyOrder.quantity;
      suggestedVal = buyOrder.value;
      if (suggestedQty > 0) {
        reasons.add(
            'الوزن الحالي ${(currentWeight * 100).toStringAsFixed(1)}% < المستهدف ${(targetWeight * 100).toStringAsFixed(1)}%');
      } else {
        reasons.add('لا حاجة للشراء - الوزن متوافق أو لا يوجد نقد كافٍ');
      }
    } else if (os <= 0.3) {
      signal = 'sell';
      reasons.add('Optimum Score منخفض (${os.toStringAsFixed(2)})');
      final sellOrder = calculateSellOrder(
        assetQuantity: quantityHeld,
        currentPrice: currentPrice,
        currentWeight: currentWeight,
        targetWeight: targetWeight,
        portfolioValue: effectivePortfolioValue,
        sellMode: 'half',
      );
      suggestedQty = sellOrder.quantity;
      suggestedVal = sellOrder.value;
      if (suggestedQty > 0) {
        reasons.add(
            'اقتراح بيع نصف المركز (${suggestedQty.toStringAsFixed(4)} وحدة)');
      }
    } else {
      reasons.add('Optimum Score متوسط (${os.toStringAsFixed(2)}) - انتظار');
    }

    // تفسيرات Z-Score
    if (zScore < -2) {
      reasons.add('Z-Score منخفض جداً (${zScore.toStringAsFixed(2)}) ← فرصة شراء');
    } else if (zScore > 2) {
      reasons.add('Z-Score مرتفع جداً (${zScore.toStringAsFixed(2)}) ← فرصة بيع');
    }

    return TradingSignal(
      assetName: assetName,
      assetId: assetId,
      signalType: signal,
      optimumScore: os,
      zScore: zScore,
      expectedReturn: expRet,
      volatility: vol,
      currentPrice: currentPrice,
      currentWeight: currentWeight,
      targetWeight: targetWeight,
      suggestedQuantity: suggestedQty,
      suggestedValue: suggestedVal,
      reasons: reasons,
    );
  }

  // ============================================================
  // 7. فحص إعادة التوازن
  // ============================================================

  /// التحقق من الأصول التي تحتاج إعادة توازن (انحراف > 5%)
  static List<({String assetName, double currentWeight, double targetWeight, double deviation})>
      checkRebalancing({
    required List<String> assetNames,
    required List<double> currentWeights,
    required List<double> targetWeights,
    double threshold = 0.05,
  }) {
    final results =
        <({String assetName, double currentWeight, double targetWeight, double deviation})>[];
    for (int i = 0; i < assetNames.length; i++) {
      final deviation = (currentWeights[i] - targetWeights[i]).abs();
      if (deviation > threshold) {
        results.add((
          assetName: assetNames[i],
          currentWeight: currentWeights[i],
          targetWeight: targetWeights[i],
          deviation: deviation,
        ));
      }
    }
    return results;
  }

  // ============================================================
  // 8. محرك الباك تيست
  // ============================================================

  /// تشغيل باك تيست على بيانات تاريخية
  static BacktestResult runBacktest({
    required List<double> prices,
    required double initialCapital,
    double riskFreeRate = defaultRiskFreeRate,
    double transactionCost = defaultTransactionCost,
    int lookbackWindow = 50,
    double alpha = defaultAlpha,
    double beta = defaultBeta,
    double gamma = defaultGamma,
  }) {
    if (prices.length < lookbackWindow + 1) {
      return BacktestResult(
        totalReturn: 0,
        buyAndHoldReturn: 0,
        numberOfTrades: 0,
        winRate: 0,
        trades: [],
        equityCurve: [initialCapital],
      );
    }

    double cash = initialCapital;
    double holdings = 0;
    final trades = <BacktestTrade>[];
    final equityCurve = <double>[initialCapital];

    for (int i = lookbackWindow; i < prices.length; i++) {
      final window = prices.sublist(i - lookbackWindow, i);
      final currentPrice = prices[i];

      final returns = calculateReturns(window);
      final zScore = calculateZScore(currentPrice, window);
      final expRet = expectedReturn(returns);
      final vol = calculateVolatility(returns);

      final os = computeOptimumScore(
        expectedRet: expRet,
        volatility: vol,
        zScore: zScore,
        riskFreeRate: riskFreeRate,
        transactionCost: transactionCost,
        alpha: alpha,
        beta: beta,
        gamma: gamma,
      );

      // إشارة شراء
      if (os >= 0.7 && cash > 0) {
        final investAmount = cash * 0.3;
        final qty = investAmount / currentPrice;
        final cost = investAmount * transactionCost;
        cash -= investAmount + cost;
        holdings += qty;
        trades.add(BacktestTrade(
          type: 'buy',
          price: currentPrice,
          quantity: qty,
          value: investAmount,
          dayIndex: i,
          os: os,
        ));
      }
      // إشارة بيع
      else if (os <= 0.3 && holdings > 0) {
        final sellQty = holdings * 0.5;
        final sellValue = sellQty * currentPrice;
        final cost = sellValue * transactionCost;
        cash += sellValue - cost;
        holdings -= sellQty;
        trades.add(BacktestTrade(
          type: 'sell',
          price: currentPrice,
          quantity: sellQty,
          value: sellValue,
          dayIndex: i,
          os: os,
        ));
      }

      equityCurve.add(cash + holdings * currentPrice);
    }

    final finalValue = cash + holdings * prices.last;
    final totalReturn = ((finalValue - initialCapital) / initialCapital) * 100;
    final buyAndHoldReturn =
        ((prices.last - prices.first) / prices.first) * 100;

    // حساب معدل الفوز
    int wins = 0;
    for (int i = 0; i < trades.length; i++) {
      if (trades[i].type == 'sell' && i > 0) {
        final lastBuy =
            trades.sublist(0, i).lastWhere((t) => t.type == 'buy',
                orElse: () => trades[i]);
        if (trades[i].price > lastBuy.price) wins++;
      }
    }
    final winRate =
        trades.where((t) => t.type == 'sell').isEmpty
            ? 0.0
            : wins / trades.where((t) => t.type == 'sell').length * 100;

    return BacktestResult(
      totalReturn: totalReturn,
      buyAndHoldReturn: buyAndHoldReturn,
      numberOfTrades: trades.length,
      winRate: winRate,
      trades: trades,
      equityCurve: equityCurve,
    );
  }
}

/// نتيجة الباك تيست
class BacktestResult {
  final double totalReturn;
  final double buyAndHoldReturn;
  final int numberOfTrades;
  final double winRate;
  final List<BacktestTrade> trades;
  final List<double> equityCurve;

  BacktestResult({
    required this.totalReturn,
    required this.buyAndHoldReturn,
    required this.numberOfTrades,
    required this.winRate,
    required this.trades,
    required this.equityCurve,
  });
}

/// صفقة في الباك تيست
class BacktestTrade {
  final String type;
  final double price;
  final double quantity;
  final double value;
  final int dayIndex;
  final double os;

  BacktestTrade({
    required this.type,
    required this.price,
    required this.quantity,
    required this.value,
    required this.dayIndex,
    required this.os,
  });
}
