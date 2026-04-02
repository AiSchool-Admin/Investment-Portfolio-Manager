/// نموذج إشارة التداول
class TradingSignal {
  final String assetName;
  final int assetId;
  final String signalType; // buy / sell / none
  final double optimumScore;
  final double zScore;
  final double expectedReturn;
  final double volatility;
  final double currentPrice;
  final double currentWeight;
  final double targetWeight;
  final double suggestedQuantity;
  final double suggestedValue;
  final List<String> reasons;
  final DateTime timestamp;

  TradingSignal({
    required this.assetName,
    required this.assetId,
    required this.signalType,
    required this.optimumScore,
    required this.zScore,
    required this.expectedReturn,
    required this.volatility,
    required this.currentPrice,
    required this.currentWeight,
    required this.targetWeight,
    required this.suggestedQuantity,
    required this.suggestedValue,
    required this.reasons,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();

  bool get isBuySignal => signalType == 'buy';
  bool get isSellSignal => signalType == 'sell';
  bool get isNeutral => signalType == 'none';

  String get signalTypeArabic {
    switch (signalType) {
      case 'buy':
        return 'شراء';
      case 'sell':
        return 'بيع';
      default:
        return 'انتظار';
    }
  }

  String get strengthArabic {
    if (optimumScore >= 0.85) return 'قوية جداً';
    if (optimumScore >= 0.7) return 'قوية';
    if (optimumScore <= 0.15) return 'قوية جداً';
    if (optimumScore <= 0.3) return 'قوية';
    return 'متوسطة';
  }
}
