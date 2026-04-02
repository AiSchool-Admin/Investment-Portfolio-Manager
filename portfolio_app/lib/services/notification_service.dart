import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../models/signal.dart';

/// خدمة الإشعارات المحلية
class NotificationService {
  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();
  static bool _initialized = false;

  static Future<void> initialize() async {
    if (_initialized) return;

    const androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const settings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _plugin.initialize(settings);
    _initialized = true;
  }

  /// إرسال إشعار بإشارة تداول جديدة
  static Future<void> showSignalNotification(TradingSignal signal) async {
    if (!_initialized) await initialize();

    final String title;
    final String body;

    if (signal.isBuySignal) {
      title = '🟢 إشارة شراء - ${signal.assetName}';
      body =
          'OS = ${signal.optimumScore.toStringAsFixed(2)} | السعر: ${signal.currentPrice.toStringAsFixed(2)}';
    } else if (signal.isSellSignal) {
      title = '🔴 إشارة بيع - ${signal.assetName}';
      body =
          'OS = ${signal.optimumScore.toStringAsFixed(2)} | السعر: ${signal.currentPrice.toStringAsFixed(2)}';
    } else {
      return; // لا إشعار لإشارة الانتظار
    }

    const androidDetails = AndroidNotificationDetails(
      'trading_signals',
      'إشارات التداول',
      channelDescription: 'إشعارات إشارات الشراء والبيع',
      importance: Importance.high,
      priority: Priority.high,
      showWhen: true,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _plugin.show(
      signal.assetId,
      title,
      body,
      details,
    );
  }

  /// إشعار إعادة التوازن
  static Future<void> showRebalanceNotification(
      String assetName, double deviation) async {
    if (!_initialized) await initialize();

    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        'rebalancing',
        'إعادة التوازن',
        channelDescription: 'إشعارات إعادة توازن المحفظة',
        importance: Importance.defaultImportance,
        priority: Priority.defaultPriority,
      ),
      iOS: DarwinNotificationDetails(),
    );

    await _plugin.show(
      1000 + assetName.hashCode % 1000,
      '⚖️ إعادة توازن مطلوبة',
      '$assetName: انحراف ${(deviation * 100).toStringAsFixed(1)}% عن الوزن المستهدف',
      details,
    );
  }
}
