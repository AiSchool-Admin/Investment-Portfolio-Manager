import 'dart:io';
import 'package:csv/csv.dart';
import 'package:file_picker/file_picker.dart';
import '../models/price_history.dart';

/// خدمة استيراد ملفات CSV
class CsvImportService {
  /// اختيار ملف CSV واستيراد الأسعار التاريخية
  /// الشكل المتوقع: Date,Close أو Date,Open,High,Low,Close
  static Future<List<CsvPriceRecord>?> importPriceHistory() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['csv'],
    );

    if (result == null || result.files.isEmpty) return null;

    final file = File(result.files.single.path!);
    final content = await file.readAsString();
    final rows = const CsvToListConverter().convert(content);

    if (rows.isEmpty) return null;

    // تحديد عمود السعر (Close)
    final header = rows.first.map((e) => e.toString().toLowerCase()).toList();
    int dateCol = header.indexOf('date');
    int closeCol = header.indexOf('close');

    // إذا لم يوجد header، نفترض أن العمود الأول تاريخ والثاني سعر
    if (dateCol == -1) dateCol = 0;
    if (closeCol == -1) closeCol = header.length > 4 ? 4 : 1;

    final records = <CsvPriceRecord>[];
    for (int i = 1; i < rows.length; i++) {
      if (rows[i].length <= closeCol) continue;
      final date = rows[i][dateCol].toString();
      final price = double.tryParse(rows[i][closeCol].toString());
      if (price != null) {
        records.add(CsvPriceRecord(date: date, closePrice: price));
      }
    }

    return records;
  }

  /// تحويل سجلات CSV إلى قائمة أسعار (للباك تيست)
  static List<double> recordsToPrices(List<CsvPriceRecord> records) {
    return records.map((r) => r.closePrice).toList();
  }

  /// تحويل سجلات CSV إلى PriceHistory
  static List<PriceHistory> recordsToPriceHistory(
      List<CsvPriceRecord> records, int assetId) {
    return records
        .map((r) => PriceHistory(
              assetId: assetId,
              date: r.date,
              closePrice: r.closePrice,
            ))
        .toList();
  }
}

/// سجل سعر من ملف CSV
class CsvPriceRecord {
  final String date;
  final double closePrice;

  CsvPriceRecord({required this.date, required this.closePrice});
}
