import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/asset.dart';
import '../models/investor_profile.dart';
import '../models/signal.dart';
import '../models/trade.dart';
import '../services/database_service.dart';
import '../services/optimizer_engine.dart';
import '../services/notification_service.dart';

// ============================================================
// مزودات الخدمات
// ============================================================

final databaseProvider = Provider<DatabaseService>((ref) => DatabaseService());

// ============================================================
// مزود الملف الاستثماري
// ============================================================

final profileProvider =
    StateNotifierProvider<ProfileNotifier, AsyncValue<InvestorProfile?>>(
        (ref) => ProfileNotifier(ref.read(databaseProvider)));

class ProfileNotifier extends StateNotifier<AsyncValue<InvestorProfile?>> {
  final DatabaseService _db;

  ProfileNotifier(this._db) : super(const AsyncValue.loading()) {
    loadProfile();
  }

  Future<void> loadProfile() async {
    state = const AsyncValue.loading();
    try {
      final profile = await _db.getProfile();
      state = AsyncValue.data(profile);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> saveProfile(InvestorProfile profile) async {
    await _db.saveProfile(profile);
    state = AsyncValue.data(profile);
  }

  Future<void> updateCash(double cash) async {
    final current = state.valueOrNull;
    if (current != null) {
      final updated = current.copyWith(availableCash: cash);
      await _db.saveProfile(updated);
      state = AsyncValue.data(updated);
    }
  }
}

// ============================================================
// مزود الأصول
// ============================================================

final assetsProvider =
    StateNotifierProvider<AssetsNotifier, AsyncValue<List<Asset>>>(
        (ref) => AssetsNotifier(ref.read(databaseProvider)));

class AssetsNotifier extends StateNotifier<AsyncValue<List<Asset>>> {
  final DatabaseService _db;

  AssetsNotifier(this._db) : super(const AsyncValue.loading()) {
    loadAssets();
  }

  Future<void> loadAssets() async {
    state = const AsyncValue.loading();
    try {
      final assets = await _db.getAssets();
      state = AsyncValue.data(assets);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> addAsset(Asset asset) async {
    await _db.insertAsset(asset);
    await loadAssets();
  }

  Future<void> updateAsset(Asset asset) async {
    await _db.updateAsset(asset);
    await loadAssets();
  }

  Future<void> deleteAsset(int id) async {
    await _db.deleteAsset(id);
    await loadAssets();
  }

  Future<void> updatePrice(int assetId, double newPrice) async {
    final asset = await _db.getAsset(assetId);
    if (asset != null) {
      final updated = asset.copyWith(currentPrice: newPrice);
      await _db.updateAsset(updated);
      await loadAssets();
    }
  }

  double get totalPortfolioValue {
    final assets = state.valueOrNull ?? [];
    return assets.fold(0.0, (sum, a) => sum + a.currentValue);
  }
}

// ============================================================
// مزود الإشارات
// ============================================================

final signalsProvider =
    StateNotifierProvider<SignalsNotifier, AsyncValue<List<TradingSignal>>>(
        (ref) => SignalsNotifier(ref));

class SignalsNotifier extends StateNotifier<AsyncValue<List<TradingSignal>>> {
  final Ref _ref;

  SignalsNotifier(this._ref) : super(const AsyncValue.data([]));

  Future<void> analyzeAll() async {
    state = const AsyncValue.loading();
    try {
      final db = _ref.read(databaseProvider);
      final assets = _ref.read(assetsProvider).valueOrNull ?? [];
      final profile = _ref.read(profileProvider).valueOrNull;

      if (assets.isEmpty) {
        state = const AsyncValue.data([]);
        return;
      }

      final totalValue =
          assets.fold(0.0, (sum, a) => sum + a.currentValue);
      final availableCash = profile?.availableCash ?? 0.0;

      final signals = <TradingSignal>[];

      for (final asset in assets) {
        final prices = await db.getPriceList(asset.id!, limit: 50);
        if (prices.length < 10) continue; // بيانات غير كافية

        final signal = OptimizerEngine.analyzeAsset(
          assetName: asset.name,
          assetId: asset.id!,
          currentPrice: asset.currentPrice,
          historicalPrices: prices,
          quantityHeld: asset.quantity,
          portfolioValue: totalValue,
          targetWeight: asset.targetWeight,
          availableCash: availableCash,
        );

        signals.add(signal);

        // إرسال إشعار إذا كانت إشارة نشطة
        if (!signal.isNeutral) {
          await NotificationService.showSignalNotification(signal);
        }
      }

      state = AsyncValue.data(signals);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}

// ============================================================
// مزود الصفقات
// ============================================================

final tradesProvider =
    StateNotifierProvider<TradesNotifier, AsyncValue<List<Trade>>>(
        (ref) => TradesNotifier(ref.read(databaseProvider)));

class TradesNotifier extends StateNotifier<AsyncValue<List<Trade>>> {
  final DatabaseService _db;

  TradesNotifier(this._db) : super(const AsyncValue.loading()) {
    loadTrades();
  }

  Future<void> loadTrades() async {
    state = const AsyncValue.loading();
    try {
      final trades = await _db.getTrades();
      state = AsyncValue.data(trades);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> addTrade(Trade trade) async {
    await _db.insertTrade(trade);
    await loadTrades();
  }
}

// ============================================================
// مزودات مشتقة
// ============================================================

/// القيمة الإجمالية للمحفظة
final totalPortfolioValueProvider = Provider<double>((ref) {
  final assets = ref.watch(assetsProvider).valueOrNull ?? [];
  return assets.fold(0.0, (sum, a) => sum + a.currentValue);
});

/// الإشارات النشطة فقط (شراء أو بيع)
final activeSignalsProvider = Provider<List<TradingSignal>>((ref) {
  final signals = ref.watch(signalsProvider).valueOrNull ?? [];
  return signals.where((s) => !s.isNeutral).toList();
});

/// الأصول التي تحتاج إعادة توازن
final rebalancingProvider = Provider<
    List<
        ({
          String assetName,
          double currentWeight,
          double targetWeight,
          double deviation
        })>>((ref) {
  final assets = ref.watch(assetsProvider).valueOrNull ?? [];
  if (assets.isEmpty) return [];

  final totalValue =
      assets.fold(0.0, (sum, a) => sum + a.currentValue);
  if (totalValue <= 0) return [];

  return OptimizerEngine.checkRebalancing(
    assetNames: assets.map((a) => a.name).toList(),
    currentWeights: assets.map((a) => a.currentValue / totalValue).toList(),
    targetWeights: assets.map((a) => a.targetWeight).toList(),
  );
});
