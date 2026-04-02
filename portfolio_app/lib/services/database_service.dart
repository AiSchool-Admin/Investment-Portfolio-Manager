import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import '../models/asset.dart';
import '../models/price_history.dart';
import '../models/trade.dart';
import '../models/investor_profile.dart';

/// خدمة قاعدة البيانات المحلية (SQLite)
class DatabaseService {
  static Database? _database;
  static const String _dbName = 'portfolio_manager.db';
  static const int _dbVersion = 1;

  Future<Database> get database async {
    _database ??= await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, _dbName);

    return await openDatabase(
      path,
      version: _dbVersion,
      onCreate: _onCreate,
    );
  }

  Future<void> _onCreate(Database db, int version) async {
    // جدول الملف الاستثماري
    await db.execute('''
      CREATE TABLE investor_profile (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        risk_score INTEGER NOT NULL,
        profile_type TEXT NOT NULL,
        stocks_weight REAL NOT NULL,
        crypto_weight REAL NOT NULL,
        bonds_weight REAL NOT NULL,
        commodities_weight REAL NOT NULL,
        real_estate_weight REAL NOT NULL,
        cash_weight REAL NOT NULL,
        available_cash REAL DEFAULT 0
      )
    ''');

    // جدول الأصول
    await db.execute('''
      CREATE TABLE assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        quantity REAL NOT NULL,
        purchase_price REAL NOT NULL,
        purchase_date TEXT NOT NULL,
        current_price REAL NOT NULL,
        target_weight REAL DEFAULT 0
      )
    ''');

    // جدول الأسعار التاريخية
    await db.execute('''
      CREATE TABLE price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        close_price REAL NOT NULL,
        FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
      )
    ''');

    // جدول الصفقات
    await db.execute('''
      CREATE TABLE trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id INTEGER NOT NULL,
        asset_name TEXT NOT NULL,
        type TEXT NOT NULL,
        quantity REAL NOT NULL,
        price REAL NOT NULL,
        total_value REAL NOT NULL,
        date TEXT NOT NULL,
        notes TEXT DEFAULT '',
        FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
      )
    ''');

    // جدول الإعدادات
    await db.execute('''
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    ''');
  }

  // ===================== الملف الاستثماري =====================

  Future<int> saveProfile(InvestorProfile profile) async {
    final db = await database;
    // حذف الملفات السابقة (ملف واحد فقط)
    await db.delete('investor_profile');
    return await db.insert('investor_profile', profile.toMap());
  }

  Future<InvestorProfile?> getProfile() async {
    final db = await database;
    final maps = await db.query('investor_profile', limit: 1);
    if (maps.isEmpty) return null;
    return InvestorProfile.fromMap(maps.first);
  }

  // ===================== الأصول =====================

  Future<int> insertAsset(Asset asset) async {
    final db = await database;
    return await db.insert('assets', asset.toMap());
  }

  Future<List<Asset>> getAssets() async {
    final db = await database;
    final maps = await db.query('assets');
    return maps.map((m) => Asset.fromMap(m)).toList();
  }

  Future<Asset?> getAsset(int id) async {
    final db = await database;
    final maps = await db.query('assets', where: 'id = ?', whereArgs: [id]);
    if (maps.isEmpty) return null;
    return Asset.fromMap(maps.first);
  }

  Future<int> updateAsset(Asset asset) async {
    final db = await database;
    return await db.update(
      'assets',
      asset.toMap(),
      where: 'id = ?',
      whereArgs: [asset.id],
    );
  }

  Future<int> deleteAsset(int id) async {
    final db = await database;
    await db.delete('price_history', where: 'asset_id = ?', whereArgs: [id]);
    await db.delete('trades', where: 'asset_id = ?', whereArgs: [id]);
    return await db.delete('assets', where: 'id = ?', whereArgs: [id]);
  }

  // ===================== الأسعار التاريخية =====================

  Future<int> insertPriceHistory(PriceHistory price) async {
    final db = await database;
    return await db.insert('price_history', price.toMap());
  }

  Future<void> insertPriceHistoryBatch(List<PriceHistory> prices) async {
    final db = await database;
    final batch = db.batch();
    for (final price in prices) {
      batch.insert('price_history', price.toMap());
    }
    await batch.commit(noResult: true);
  }

  Future<List<PriceHistory>> getPriceHistory(int assetId,
      {int limit = 365}) async {
    final db = await database;
    final maps = await db.query(
      'price_history',
      where: 'asset_id = ?',
      whereArgs: [assetId],
      orderBy: 'date DESC',
      limit: limit,
    );
    return maps.map((m) => PriceHistory.fromMap(m)).toList();
  }

  Future<List<double>> getPriceList(int assetId, {int limit = 50}) async {
    final history = await getPriceHistory(assetId, limit: limit);
    return history.reversed.map((h) => h.closePrice).toList();
  }

  // ===================== الصفقات =====================

  Future<int> insertTrade(Trade trade) async {
    final db = await database;
    return await db.insert('trades', trade.toMap());
  }

  Future<List<Trade>> getTrades({int? assetId}) async {
    final db = await database;
    final maps = await db.query(
      'trades',
      where: assetId != null ? 'asset_id = ?' : null,
      whereArgs: assetId != null ? [assetId] : null,
      orderBy: 'date DESC',
    );
    return maps.map((m) => Trade.fromMap(m)).toList();
  }

  // ===================== الإعدادات =====================

  Future<void> setSetting(String key, String value) async {
    final db = await database;
    await db.insert(
      'settings',
      {'key': key, 'value': value},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<String?> getSetting(String key) async {
    final db = await database;
    final maps =
        await db.query('settings', where: 'key = ?', whereArgs: [key]);
    if (maps.isEmpty) return null;
    return maps.first['value'] as String;
  }

  Future<void> close() async {
    final db = await database;
    await db.close();
    _database = null;
  }
}
