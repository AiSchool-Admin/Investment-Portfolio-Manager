/// نموذج الأصل الاستثماري
class Asset {
  final int? id;
  final String name;
  final String category; // أسهم، عملات رقمية، سندات، سلع، عقارات
  final double quantity;
  final double purchasePrice;
  final String purchaseDate;
  final double currentPrice;
  final double targetWeight; // الوزن المستهدف (0-1)

  Asset({
    this.id,
    required this.name,
    required this.category,
    required this.quantity,
    required this.purchasePrice,
    required this.purchaseDate,
    required this.currentPrice,
    this.targetWeight = 0.0,
  });

  double get currentValue => quantity * currentPrice;
  double get purchaseValue => quantity * purchasePrice;
  double get profitLoss => currentValue - purchaseValue;
  double get profitLossPercent =>
      purchaseValue > 0 ? (profitLoss / purchaseValue) * 100 : 0;

  Map<String, dynamic> toMap() => {
        'id': id,
        'name': name,
        'category': category,
        'quantity': quantity,
        'purchase_price': purchasePrice,
        'purchase_date': purchaseDate,
        'current_price': currentPrice,
        'target_weight': targetWeight,
      };

  factory Asset.fromMap(Map<String, dynamic> map) => Asset(
        id: map['id'] as int?,
        name: map['name'] as String,
        category: map['category'] as String,
        quantity: (map['quantity'] as num).toDouble(),
        purchasePrice: (map['purchase_price'] as num).toDouble(),
        purchaseDate: map['purchase_date'] as String,
        currentPrice: (map['current_price'] as num).toDouble(),
        targetWeight: (map['target_weight'] as num?)?.toDouble() ?? 0.0,
      );

  Asset copyWith({
    int? id,
    String? name,
    String? category,
    double? quantity,
    double? purchasePrice,
    String? purchaseDate,
    double? currentPrice,
    double? targetWeight,
  }) =>
      Asset(
        id: id ?? this.id,
        name: name ?? this.name,
        category: category ?? this.category,
        quantity: quantity ?? this.quantity,
        purchasePrice: purchasePrice ?? this.purchasePrice,
        purchaseDate: purchaseDate ?? this.purchaseDate,
        currentPrice: currentPrice ?? this.currentPrice,
        targetWeight: targetWeight ?? this.targetWeight,
      );
}
