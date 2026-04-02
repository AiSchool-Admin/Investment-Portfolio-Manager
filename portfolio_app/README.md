# مدير المحفظة الاستثمارية الديناميكي

تطبيق متعدد المنصات (iOS / Android / Windows / macOS / Linux) لإدارة المحفظة الاستثمارية الشخصية باستخدام نموذج **Optimum Score (OS)** الرياضي.

## نظرة عامة

يعمل التطبيق كمدير محفظة استثمارية شخصي يقدم إشارات شراء وبيع ذكية بناءً على:
- **نسبة شارب** (Sharpe Ratio) - العائد المعدل بالمخاطر
- **Z-Score** - الانحراف السعري عن المتوسط
- **مصفوفة التغاير** - لتحسين توزيع الأصول
- **Optimum Score** - المعادلة الموحدة التي تجمع كل المؤشرات

## المعادلة الأساسية (Optimum Score)

```
OS_i = α * (E(R_i) - Rf) / σ_i + β * (-Z_i) - γ * C_i
```

حيث:
- `α = 0.4` وزن العائد المعدل بالمخاطر
- `β = 0.4` وزن Z-Score  
- `γ = 0.2` وزن تكلفة المعاملات
- **شراء** إذا OS ≥ 0.7
- **بيع** إذا OS ≤ 0.3

## البنية التقنية

```
portfolio_app/
├── lib/
│   ├── main.dart                    # نقطة الدخول
│   ├── models/                      # نماذج البيانات
│   │   ├── asset.dart               # نموذج الأصل
│   │   ├── investor_profile.dart    # الملف الاستثماري
│   │   ├── price_history.dart       # الأسعار التاريخية
│   │   ├── signal.dart              # إشارات التداول
│   │   └── trade.dart               # الصفقات
│   ├── services/                    # الخدمات
│   │   ├── database_service.dart    # SQLite
│   │   ├── optimizer_engine.dart    # محرك OS (الخوارزميات)
│   │   ├── notification_service.dart # الإشعارات المحلية
│   │   ├── export_service.dart      # تصدير PDF/CSV
│   │   └── csv_import_service.dart  # استيراد CSV
│   ├── providers/                   # إدارة الحالة (Riverpod)
│   │   └── portfolio_provider.dart
│   ├── screens/                     # الشاشات
│   │   ├── splash_screen.dart
│   │   ├── risk_questionnaire_screen.dart  # استبيان المخاطر
│   │   ├── home_screen.dart         # الشاشة الرئيسية
│   │   ├── dashboard_screen.dart    # لوحة التحكم
│   │   ├── assets_screen.dart       # إدارة الأصول
│   │   ├── signals_screen.dart      # الإشارات
│   │   ├── backtest_screen.dart     # الباك تيست
│   │   └── settings_screen.dart     # الإعدادات
│   ├── widgets/                     # مكونات مخصصة
│   │   ├── os_gauge.dart            # مؤشر OS دائري
│   │   └── signal_badge.dart        # شارة الإشارة
│   └── utils/
│       └── sample_data.dart         # بيانات تجريبية
├── assets/
│   └── sample_aapl.csv              # بيانات مثال
└── test/
    └── optimizer_test.dart          # اختبارات الخوارزميات
```

## الميزات (MVP)

1. **استبيان المخاطر** - 7 أسئلة لتحديد الملف الاستثماري (4 أنماط)
2. **إدارة الأصول** - إضافة/تعديل/حذف مع تحديث الأسعار يدوياً
3. **محرك Optimum Score** - حساب Z-Score وOS لكل أصل
4. **إشارات ذكية** - شراء/بيع مع اقتراح الكمية والقيمة
5. **إعادة التوازن** - تنبيه عند انحراف الوزن > 5%
6. **لوحة تحكم** - رسوم بيانية وملخص المحفظة
7. **إشعارات محلية** - تنبيهات فورية عند ظهور إشارات
8. **باك تيست** - اختبار الاستراتيجية على بيانات تاريخية (CSV)
9. **تصدير تقارير** - PDF و CSV
10. **بدون إنترنت** - جميع البيانات محلية (SQLite)

## التقنيات

- **Flutter** - تطوير متعدد المنصات (جوال + سطح المكتب)
- **Riverpod** - إدارة الحالة
- **SQLite** (sqflite_common_ffi) - قاعدة بيانات محلية (تعمل على جميع المنصات)
- **window_manager** - إدارة نافذة سطح المكتب
- **fl_chart** - رسوم بيانية
- **pdf** - تصدير PDF
- **واجهة عربية RTL** بالكامل
- **تخطيط متجاوب** - شريط جانبي على سطح المكتب، شريط سفلي على الجوال

## التشغيل

### على الجوال (Android/iOS)
```bash
cd portfolio_app
flutter pub get
flutter run
```

### على Windows (سطح المكتب)
```bash
cd portfolio_app
flutter pub get
flutter run -d windows
```

### على macOS
```bash
cd portfolio_app
flutter pub get
flutter run -d macos
```

## اختبار الخوارزميات

```bash
cd portfolio_app
dart run test/optimizer_test.dart
```

## الخوارزميات المنفذة

| الخوارزمية | الوصف |
|-----------|-------|
| Z-Score | (P_t - μ) / σ - نافذة 50 يوم |
| RSI | مؤشر القوة النسبية (14 فترة) |
| Sharpe Ratio | (E[R] - Rf) / σ |
| Optimum Score | α·Sharpe + β·(-Z) - γ·C |
| Portfolio Variance | w^T · Σ · w |
| Weight Optimization | Monte Carlo (10K تكرار) |
| Covariance Matrix | مصفوفة التغاير الكاملة |
