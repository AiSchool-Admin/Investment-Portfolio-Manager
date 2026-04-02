import '../models/asset.dart';
import '../models/price_history.dart';
import '../services/database_service.dart';

/// بيانات تجريبية لاختبار التطبيق
class SampleData {
  /// إنشاء بيانات تجريبية كاملة
  static Future<void> populateSampleData(DatabaseService db) async {
    // إضافة أصول تجريبية
    final aaplId = await db.insertAsset(Asset(
      name: 'AAPL',
      category: 'أسهم',
      quantity: 10,
      purchasePrice: 150.0,
      purchaseDate: '2025-10-01',
      currentPrice: 185.0,
      targetWeight: 0.30,
    ));

    final btcId = await db.insertAsset(Asset(
      name: 'BTC',
      category: 'عملات رقمية',
      quantity: 0.1,
      purchasePrice: 45000.0,
      purchaseDate: '2025-09-15',
      currentPrice: 52000.0,
      targetWeight: 0.20,
    ));

    final msftId = await db.insertAsset(Asset(
      name: 'MSFT',
      category: 'أسهم',
      quantity: 8,
      purchasePrice: 380.0,
      purchaseDate: '2025-11-01',
      currentPrice: 420.0,
      targetWeight: 0.25,
    ));

    final goldId = await db.insertAsset(Asset(
      name: 'GOLD',
      category: 'سلع',
      quantity: 5,
      purchasePrice: 2000.0,
      purchaseDate: '2025-08-01',
      currentPrice: 2350.0,
      targetWeight: 0.15,
    ));

    // إضافة أسعار تاريخية (60 يوم) لكل أصل
    await _addAAPLHistory(db, aaplId);
    await _addBTCHistory(db, btcId);
    await _addMSFTHistory(db, msftId);
    await _addGOLDHistory(db, goldId);
  }

  static Future<void> _addAAPLHistory(DatabaseService db, int assetId) async {
    final prices = <PriceHistory>[];
    final basePrices = [
      150.0, 152.3, 148.5, 155.2, 153.8, 157.1, 160.4, 158.9, 162.0, 165.3,
      163.5, 167.2, 170.1, 168.4, 172.5, 175.0, 173.2, 176.8, 179.1, 177.5,
      180.3, 183.0, 181.2, 184.5, 186.0, 183.8, 187.2, 189.5, 188.0, 190.3,
      185.2, 182.0, 179.5, 176.0, 173.5, 170.0, 168.5, 172.0, 175.5, 178.0,
      180.5, 183.0, 181.5, 184.0, 186.5, 185.0, 187.5, 189.0, 186.5, 184.0,
      182.0, 180.0, 178.5, 181.0, 183.5, 185.0, 186.5, 184.5, 183.0, 185.0,
    ];

    for (int i = 0; i < basePrices.length; i++) {
      final date = DateTime(2026, 1, 1).add(Duration(days: i));
      prices.add(PriceHistory(
        assetId: assetId,
        date: date.toString().split(' ').first,
        closePrice: basePrices[i],
      ));
    }
    await db.insertPriceHistoryBatch(prices);
  }

  static Future<void> _addBTCHistory(DatabaseService db, int assetId) async {
    final prices = <PriceHistory>[];
    final basePrices = [
      45000, 45500, 44800, 46200, 47000, 46500, 48000, 49200, 48500, 50000,
      51500, 50800, 52000, 53500, 52800, 54000, 55000, 53500, 52000, 50500,
      49000, 48000, 47000, 46500, 48000, 49500, 51000, 52500, 54000, 55500,
      54000, 52500, 51000, 49500, 48000, 47000, 46000, 45500, 47000, 48500,
      50000, 51500, 53000, 54500, 53000, 51500, 50000, 49000, 50500, 52000,
      53500, 55000, 54000, 52500, 51000, 50000, 51500, 53000, 52000, 52000,
    ];

    for (int i = 0; i < basePrices.length; i++) {
      final date = DateTime(2026, 1, 1).add(Duration(days: i));
      prices.add(PriceHistory(
        assetId: assetId,
        date: date.toString().split(' ').first,
        closePrice: basePrices[i].toDouble(),
      ));
    }
    await db.insertPriceHistoryBatch(prices);
  }

  static Future<void> _addMSFTHistory(DatabaseService db, int assetId) async {
    final prices = <PriceHistory>[];
    final basePrices = [
      380, 382, 378, 385, 388, 386, 390, 393, 391, 395,
      398, 396, 400, 403, 401, 405, 408, 406, 410, 413,
      411, 415, 418, 416, 420, 423, 421, 418, 415, 412,
      410, 408, 406, 410, 413, 415, 418, 420, 417, 414,
      412, 410, 413, 416, 418, 420, 422, 419, 416, 414,
      417, 420, 422, 424, 421, 418, 416, 419, 421, 420,
    ];

    for (int i = 0; i < basePrices.length; i++) {
      final date = DateTime(2026, 1, 1).add(Duration(days: i));
      prices.add(PriceHistory(
        assetId: assetId,
        date: date.toString().split(' ').first,
        closePrice: basePrices[i].toDouble(),
      ));
    }
    await db.insertPriceHistoryBatch(prices);
  }

  static Future<void> _addGOLDHistory(DatabaseService db, int assetId) async {
    final prices = <PriceHistory>[];
    final basePrices = [
      2000, 2010, 2005, 2020, 2030, 2025, 2040, 2055, 2050, 2070,
      2085, 2080, 2100, 2115, 2110, 2130, 2145, 2140, 2160, 2175,
      2170, 2190, 2205, 2200, 2220, 2235, 2230, 2250, 2265, 2260,
      2280, 2295, 2290, 2310, 2300, 2285, 2270, 2260, 2280, 2300,
      2315, 2330, 2320, 2310, 2325, 2340, 2335, 2350, 2365, 2355,
      2340, 2330, 2345, 2360, 2375, 2365, 2350, 2345, 2355, 2350,
    ];

    for (int i = 0; i < basePrices.length; i++) {
      final date = DateTime(2026, 1, 1).add(Duration(days: i));
      prices.add(PriceHistory(
        assetId: assetId,
        date: date.toString().split(' ').first,
        closePrice: basePrices[i].toDouble(),
      ));
    }
    await db.insertPriceHistoryBatch(prices);
  }
}
