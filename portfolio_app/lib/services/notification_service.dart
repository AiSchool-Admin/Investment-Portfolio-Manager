import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../models/signal.dart';

/// هل نعمل على سطح المكتب؟
bool get _isDesktop =>
    !kIsWeb &&
    (Platform.isWindows || Platform.isLinux || Platform.isMacOS);

/// خدمة الإشعارات المحلية
/// على الجوال: إشعارات النظام
/// على سطح المكتب: إشعارات داخل التطبيق (SnackBar/Overlay)
class NotificationService {
  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();
  static bool _initialized = false;

  // قائمة الإشعارات المعلقة (للعرض داخل التطبيق على سطح المكتب)
  static final List<PendingNotification> pendingNotifications = [];

  static Future<void> initialize() async {
    if (_initialized) return;

    if (_isDesktop) {
      // على سطح المكتب: لا نحتاج flutter_local_notifications
      // نستخدم إشعارات داخلية بدلاً منها
      _initialized = true;
      return;
    }

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
      title = 'إشارة شراء - ${signal.assetName}';
      body =
          'OS = ${signal.optimumScore.toStringAsFixed(2)} | السعر: ${signal.currentPrice.toStringAsFixed(2)}';
    } else if (signal.isSellSignal) {
      title = 'إشارة بيع - ${signal.assetName}';
      body =
          'OS = ${signal.optimumScore.toStringAsFixed(2)} | السعر: ${signal.currentPrice.toStringAsFixed(2)}';
    } else {
      return; // لا إشعار لإشارة الانتظار
    }

    // على سطح المكتب: نضيف للقائمة الداخلية
    if (_isDesktop) {
      pendingNotifications.add(PendingNotification(
        title: title,
        body: body,
        isBuy: signal.isBuySignal,
        timestamp: DateTime.now(),
      ));
      return;
    }

    // على الجوال: إشعار نظام
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

    final title = 'إعادة توازن مطلوبة';
    final body =
        '$assetName: انحراف ${(deviation * 100).toStringAsFixed(1)}% عن الوزن المستهدف';

    if (_isDesktop) {
      pendingNotifications.add(PendingNotification(
        title: title,
        body: body,
        isBuy: false,
        timestamp: DateTime.now(),
      ));
      return;
    }

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
      title,
      body,
      details,
    );
  }
}

/// إشعار معلق (للعرض داخل التطبيق)
class PendingNotification {
  final String title;
  final String body;
  final bool isBuy;
  final DateTime timestamp;

  PendingNotification({
    required this.title,
    required this.body,
    required this.isBuy,
    required this.timestamp,
  });
}
