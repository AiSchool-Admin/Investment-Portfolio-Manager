/// الملف الاستثماري للمستخدم
class InvestorProfile {
  final int? id;
  final int riskScore; // 1-10
  final String profileType; // aggressive, balanced, income, capital_preservation
  final double stocksWeight;
  final double cryptoWeight;
  final double bondsWeight;
  final double commoditiesWeight;
  final double realEstateWeight;
  final double cashWeight;
  final double availableCash;

  InvestorProfile({
    this.id,
    required this.riskScore,
    required this.profileType,
    required this.stocksWeight,
    required this.cryptoWeight,
    required this.bondsWeight,
    required this.commoditiesWeight,
    required this.realEstateWeight,
    required this.cashWeight,
    this.availableCash = 0.0,
  });

  /// الأنماط الاستثمارية المحددة مسبقاً
  static InvestorProfile aggressive() => InvestorProfile(
        riskScore: 9,
        profileType: 'aggressive',
        stocksWeight: 0.50,
        cryptoWeight: 0.25,
        bondsWeight: 0.05,
        commoditiesWeight: 0.10,
        realEstateWeight: 0.05,
        cashWeight: 0.05,
      );

  static InvestorProfile balanced() => InvestorProfile(
        riskScore: 6,
        profileType: 'balanced',
        stocksWeight: 0.35,
        cryptoWeight: 0.10,
        bondsWeight: 0.25,
        commoditiesWeight: 0.10,
        realEstateWeight: 0.10,
        cashWeight: 0.10,
      );

  static InvestorProfile income() => InvestorProfile(
        riskScore: 4,
        profileType: 'income',
        stocksWeight: 0.20,
        cryptoWeight: 0.05,
        bondsWeight: 0.40,
        commoditiesWeight: 0.05,
        realEstateWeight: 0.15,
        cashWeight: 0.15,
      );

  static InvestorProfile capitalPreservation() => InvestorProfile(
        riskScore: 2,
        profileType: 'capital_preservation',
        stocksWeight: 0.10,
        cryptoWeight: 0.00,
        bondsWeight: 0.50,
        commoditiesWeight: 0.05,
        realEstateWeight: 0.10,
        cashWeight: 0.25,
      );

  String get profileTypeArabic {
    switch (profileType) {
      case 'aggressive':
        return 'نمو عنيف';
      case 'balanced':
        return 'متوازن';
      case 'income':
        return 'دخل ثابت';
      case 'capital_preservation':
        return 'تأمين رأس المال';
      default:
        return 'مخصص';
    }
  }

  Map<String, dynamic> toMap() => {
        'id': id,
        'risk_score': riskScore,
        'profile_type': profileType,
        'stocks_weight': stocksWeight,
        'crypto_weight': cryptoWeight,
        'bonds_weight': bondsWeight,
        'commodities_weight': commoditiesWeight,
        'real_estate_weight': realEstateWeight,
        'cash_weight': cashWeight,
        'available_cash': availableCash,
      };

  factory InvestorProfile.fromMap(Map<String, dynamic> map) => InvestorProfile(
        id: map['id'] as int?,
        riskScore: map['risk_score'] as int,
        profileType: map['profile_type'] as String,
        stocksWeight: (map['stocks_weight'] as num).toDouble(),
        cryptoWeight: (map['crypto_weight'] as num).toDouble(),
        bondsWeight: (map['bonds_weight'] as num).toDouble(),
        commoditiesWeight: (map['commodities_weight'] as num).toDouble(),
        realEstateWeight: (map['real_estate_weight'] as num).toDouble(),
        cashWeight: (map['cash_weight'] as num).toDouble(),
        availableCash: (map['available_cash'] as num?)?.toDouble() ?? 0.0,
      );

  InvestorProfile copyWith({
    int? id,
    int? riskScore,
    String? profileType,
    double? stocksWeight,
    double? cryptoWeight,
    double? bondsWeight,
    double? commoditiesWeight,
    double? realEstateWeight,
    double? cashWeight,
    double? availableCash,
  }) =>
      InvestorProfile(
        id: id ?? this.id,
        riskScore: riskScore ?? this.riskScore,
        profileType: profileType ?? this.profileType,
        stocksWeight: stocksWeight ?? this.stocksWeight,
        cryptoWeight: cryptoWeight ?? this.cryptoWeight,
        bondsWeight: bondsWeight ?? this.bondsWeight,
        commoditiesWeight: commoditiesWeight ?? this.commoditiesWeight,
        realEstateWeight: realEstateWeight ?? this.realEstateWeight,
        cashWeight: cashWeight ?? this.cashWeight,
        availableCash: availableCash ?? this.availableCash,
      );
}
