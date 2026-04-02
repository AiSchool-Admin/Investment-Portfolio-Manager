/// نموذج السعر التاريخي
class PriceHistory {
  final int? id;
  final int assetId;
  final String date;
  final double closePrice;

  PriceHistory({
    this.id,
    required this.assetId,
    required this.date,
    required this.closePrice,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'asset_id': assetId,
        'date': date,
        'close_price': closePrice,
      };

  factory PriceHistory.fromMap(Map<String, dynamic> map) => PriceHistory(
        id: map['id'] as int?,
        assetId: map['asset_id'] as int,
        date: map['date'] as String,
        closePrice: (map['close_price'] as num).toDouble(),
      );
}
