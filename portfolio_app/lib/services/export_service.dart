import 'dart:io';
import 'package:csv/csv.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import '../models/asset.dart';
import '../models/signal.dart';
import '../services/optimizer_engine.dart';

/// خدمة تصدير التقارير (PDF/CSV)
class ExportService {
  /// تصدير المحفظة كملف CSV
  static Future<String> exportPortfolioCSV(List<Asset> assets) async {
    final rows = <List<dynamic>>[
      ['الأصل', 'الفئة', 'الكمية', 'سعر الشراء', 'السعر الحالي', 'القيمة', 'الربح/الخسارة', 'النسبة'],
    ];

    for (final asset in assets) {
      rows.add([
        asset.name,
        asset.category,
        asset.quantity,
        asset.purchasePrice,
        asset.currentPrice,
        asset.currentValue.toStringAsFixed(2),
        asset.profitLoss.toStringAsFixed(2),
        '${asset.profitLossPercent.toStringAsFixed(2)}%',
      ]);
    }

    final csv = const ListToCsvConverter().convert(rows);
    final dir = await getApplicationDocumentsDirectory();
    final file = File('${dir.path}/portfolio_report.csv');
    await file.writeAsString(csv);
    return file.path;
  }

  /// تصدير الإشارات كملف CSV
  static Future<String> exportSignalsCSV(List<TradingSignal> signals) async {
    final rows = <List<dynamic>>[
      ['الأصل', 'الإشارة', 'OS', 'Z-Score', 'السعر', 'الكمية المقترحة', 'القيمة المقترحة'],
    ];

    for (final signal in signals) {
      rows.add([
        signal.assetName,
        signal.signalTypeArabic,
        signal.optimumScore.toStringAsFixed(4),
        signal.zScore.toStringAsFixed(2),
        signal.currentPrice.toStringAsFixed(2),
        signal.suggestedQuantity.toStringAsFixed(4),
        signal.suggestedValue.toStringAsFixed(2),
      ]);
    }

    final csv = const ListToCsvConverter().convert(rows);
    final dir = await getApplicationDocumentsDirectory();
    final file = File('${dir.path}/signals_report.csv');
    await file.writeAsString(csv);
    return file.path;
  }

  /// تصدير تقرير الباك تيست كملف CSV
  static Future<String> exportBacktestCSV(BacktestResult result) async {
    final rows = <List<dynamic>>[
      ['النوع', 'السعر', 'الكمية', 'القيمة', 'اليوم', 'OS'],
    ];

    for (final trade in result.trades) {
      rows.add([
        trade.type == 'buy' ? 'شراء' : 'بيع',
        trade.price.toStringAsFixed(2),
        trade.quantity.toStringAsFixed(6),
        trade.value.toStringAsFixed(2),
        trade.dayIndex,
        trade.os.toStringAsFixed(4),
      ]);
    }

    rows.add([]);
    rows.add(['العائد الإجمالي', '${result.totalReturn.toStringAsFixed(2)}%']);
    rows.add(['عائد الشراء والاحتفاظ', '${result.buyAndHoldReturn.toStringAsFixed(2)}%']);
    rows.add(['عدد الصفقات', result.numberOfTrades]);
    rows.add(['معدل الفوز', '${result.winRate.toStringAsFixed(1)}%']);

    final csv = const ListToCsvConverter().convert(rows);
    final dir = await getApplicationDocumentsDirectory();
    final file = File('${dir.path}/backtest_report.csv');
    await file.writeAsString(csv);
    return file.path;
  }

  /// تصدير تقرير المحفظة كـ PDF
  static Future<String> exportPortfolioPDF(
    List<Asset> assets,
    List<TradingSignal> signals,
    double totalValue,
  ) async {
    final pdf = pw.Document();

    pdf.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        textDirection: pw.TextDirection.rtl,
        build: (context) => [
          pw.Header(
            level: 0,
            child: pw.Text(
              'تقرير المحفظة الاستثمارية',
              style: pw.TextStyle(fontSize: 24, fontWeight: pw.FontWeight.bold),
              textDirection: pw.TextDirection.rtl,
            ),
          ),
          pw.SizedBox(height: 10),
          pw.Text(
            'القيمة الإجمالية: \$${totalValue.toStringAsFixed(2)}',
            style: const pw.TextStyle(fontSize: 16),
            textDirection: pw.TextDirection.rtl,
          ),
          pw.Text(
            'عدد الأصول: ${assets.length}',
            textDirection: pw.TextDirection.rtl,
          ),
          pw.Text(
            'تاريخ التقرير: ${DateTime.now().toString().split('.').first}',
            textDirection: pw.TextDirection.rtl,
          ),
          pw.SizedBox(height: 20),
          pw.Header(level: 1,
            child: pw.Text('الأصول', textDirection: pw.TextDirection.rtl)),
          pw.TableHelper.fromTextArray(
            headers: ['الأصل', 'الكمية', 'السعر', 'القيمة', 'الربح%'],
            data: assets.map((a) => [
              a.name,
              a.quantity.toStringAsFixed(2),
              a.currentPrice.toStringAsFixed(2),
              a.currentValue.toStringAsFixed(2),
              '${a.profitLossPercent.toStringAsFixed(1)}%',
            ]).toList(),
          ),
          pw.SizedBox(height: 20),
          if (signals.isNotEmpty) ...[
            pw.Header(level: 1,
              child: pw.Text('الإشارات النشطة', textDirection: pw.TextDirection.rtl)),
            pw.TableHelper.fromTextArray(
              headers: ['الأصل', 'الإشارة', 'OS', 'Z-Score'],
              data: signals
                  .where((s) => !s.isNeutral)
                  .map((s) => [
                        s.assetName,
                        s.signalTypeArabic,
                        s.optimumScore.toStringAsFixed(2),
                        s.zScore.toStringAsFixed(2),
                      ])
                  .toList(),
            ),
          ],
        ],
      ),
    );

    final dir = await getApplicationDocumentsDirectory();
    final file = File('${dir.path}/portfolio_report.pdf');
    await file.writeAsBytes(await pdf.save());
    return file.path;
  }

  /// مشاركة ملف
  static Future<void> shareFile(String filePath) async {
    await Share.shareXFiles([XFile(filePath)]);
  }
}
