/// نموذج الصفقة
class Trade {
  final int? id;
  final int assetId;
  final String assetName;
  final String type; // buy / sell
  final double quantity;
  final double price;
  final double totalValue;
  final String date;
  final String notes;

  Trade({
    this.id,
    required this.assetId,
    required this.assetName,
    required this.type,
    required this.quantity,
    required this.price,
    required this.totalValue,
    required this.date,
    this.notes = '',
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'asset_id': assetId,
        'asset_name': assetName,
        'type': type,
        'quantity': quantity,
        'price': price,
        'total_value': totalValue,
        'date': date,
        'notes': notes,
      };

  factory Trade.fromMap(Map<String, dynamic> map) => Trade(
        id: map['id'] as int?,
        assetId: map['asset_id'] as int,
        assetName: map['asset_name'] as String,
        type: map['type'] as String,
        quantity: (map['quantity'] as num).toDouble(),
        price: (map['price'] as num).toDouble(),
        totalValue: (map['total_value'] as num).toDouble(),
        date: map['date'] as String,
        notes: map['notes'] as String? ?? '',
      );
}
