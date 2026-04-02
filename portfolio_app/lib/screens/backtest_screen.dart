import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import '../services/optimizer_engine.dart';
import '../services/csv_import_service.dart';
import '../services/export_service.dart';

/// شاشة الباك تيست
class BacktestScreen extends ConsumerStatefulWidget {
  const BacktestScreen({super.key});

  @override
  ConsumerState<BacktestScreen> createState() => _BacktestScreenState();
}

class _BacktestScreenState extends ConsumerState<BacktestScreen> {
  BacktestResult? _result;
  bool _isLoading = false;
  String _fileName = '';
  int _dataPoints = 0;

  // معاملات قابلة للتعديل
  double _initialCapital = 10000;
  double _alpha = 0.4;
  double _beta = 0.4;
  double _gamma = 0.2;
  int _lookbackWindow = 50;

  Future<void> _importAndRun() async {
    final records = await CsvImportService.importPriceHistory();
    if (records == null || records.isEmpty) return;

    setState(() {
      _isLoading = true;
      _dataPoints = records.length;
      _fileName = 'ملف CSV (${records.length} سجل)';
    });

    final prices = CsvImportService.recordsToPrices(records);

    final result = OptimizerEngine.runBacktest(
      prices: prices,
      initialCapital: _initialCapital,
      lookbackWindow: _lookbackWindow,
      alpha: _alpha,
      beta: _beta,
      gamma: _gamma,
    );

    setState(() {
      _result = result;
      _isLoading = false;
    });
  }

  /// تشغيل باك تيست ببيانات مثال (AAPL تقريبية)
  void _runSampleBacktest() {
    setState(() => _isLoading = true);

    // بيانات أسعار تقريبية لـ AAPL (180 يوم)
    final samplePrices = _generateSamplePrices();

    final result = OptimizerEngine.runBacktest(
      prices: samplePrices,
      initialCapital: _initialCapital,
      lookbackWindow: _lookbackWindow,
      alpha: _alpha,
      beta: _beta,
      gamma: _gamma,
    );

    setState(() {
      _result = result;
      _isLoading = false;
      _fileName = 'بيانات مثال (AAPL - ${samplePrices.length} يوم)';
      _dataPoints = samplePrices.length;
    });
  }

  List<double> _generateSamplePrices() {
    // محاكاة أسعار AAPL تقريبية لـ 180 يوم
    final prices = <double>[];
    double price = 150.0;
    final random = [
      0.02, -0.01, 0.015, -0.005, 0.01, 0.025, -0.02, 0.005, 0.01, -0.015,
      0.03, -0.01, 0.02, -0.025, 0.015, 0.005, -0.01, 0.02, -0.005, 0.01,
      0.015, -0.02, 0.025, -0.01, 0.005, 0.01, -0.015, 0.02, -0.005, 0.03,
      -0.02, 0.01, 0.015, -0.01, 0.025, -0.015, 0.005, 0.02, -0.01, 0.01,
      0.005, -0.025, 0.03, -0.01, 0.015, 0.02, -0.02, 0.01, -0.005, 0.025,
      -0.015, 0.01, 0.005, -0.01, 0.02, 0.015, -0.025, 0.03, -0.005, 0.01,
      0.02, -0.015, 0.005, 0.01, -0.02, 0.025, -0.01, 0.015, 0.005, -0.01,
      0.03, -0.02, 0.01, 0.015, -0.005, 0.02, -0.01, 0.005, 0.01, -0.015,
      0.025, -0.01, 0.02, -0.025, 0.015, 0.005, -0.01, 0.02, -0.005, 0.01,
    ];

    for (int i = 0; i < 180; i++) {
      prices.add(price);
      price *= (1 + random[i % random.length]);
    }
    return prices;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('الباك تيست'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // إعدادات الباك تيست
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('إعدادات الباك تيست',
                      style:
                          TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  TextField(
                    decoration: const InputDecoration(
                      labelText: 'رأس المال الابتدائي (\$)',
                    ),
                    keyboardType: TextInputType.number,
                    controller: TextEditingController(
                        text: _initialCapital.toStringAsFixed(0)),
                    onChanged: (v) =>
                        _initialCapital = double.tryParse(v) ?? 10000,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          decoration: const InputDecoration(labelText: 'α (شارب)'),
                          keyboardType: TextInputType.number,
                          controller: TextEditingController(
                              text: _alpha.toString()),
                          onChanged: (v) =>
                              _alpha = double.tryParse(v) ?? 0.4,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          decoration:
                              const InputDecoration(labelText: 'β (Z-Score)'),
                          keyboardType: TextInputType.number,
                          controller: TextEditingController(
                              text: _beta.toString()),
                          onChanged: (v) =>
                              _beta = double.tryParse(v) ?? 0.4,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          decoration:
                              const InputDecoration(labelText: 'γ (تكلفة)'),
                          keyboardType: TextInputType.number,
                          controller: TextEditingController(
                              text: _gamma.toString()),
                          onChanged: (v) =>
                              _gamma = double.tryParse(v) ?? 0.2,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    decoration: const InputDecoration(
                      labelText: 'نافذة المراجعة (يوم)',
                    ),
                    keyboardType: TextInputType.number,
                    controller: TextEditingController(
                        text: _lookbackWindow.toString()),
                    onChanged: (v) =>
                        _lookbackWindow = int.tryParse(v) ?? 50,
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: _isLoading ? null : _importAndRun,
                          icon: const Icon(Icons.file_upload),
                          label: const Text('استيراد CSV'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _isLoading ? null : _runSampleBacktest,
                          icon: const Icon(Icons.play_arrow),
                          label: const Text('بيانات مثال'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          if (_isLoading)
            const Padding(
              padding: EdgeInsets.all(32),
              child: Center(child: CircularProgressIndicator()),
            ),

          if (_result != null && !_isLoading) ...[
            const SizedBox(height: 16),

            // معلومات البيانات
            Card(
              color: Theme.of(context).colorScheme.secondaryContainer,
              child: ListTile(
                leading: const Icon(Icons.info_outline),
                title: Text(_fileName),
                subtitle: Text('$_dataPoints نقطة بيانات'),
              ),
            ),
            const SizedBox(height: 16),

            // نتائج الباك تيست
            _buildResultsCard(),
            const SizedBox(height: 16),

            // رسم منحنى رأس المال
            _buildEquityCurveChart(),
            const SizedBox(height: 16),

            // قائمة الصفقات
            _buildTradesCard(),
            const SizedBox(height: 16),

            // تصدير
            FilledButton.icon(
              onPressed: () async {
                final path =
                    await ExportService.exportBacktestCSV(_result!);
                await ExportService.shareFile(path);
              },
              icon: const Icon(Icons.file_download),
              label: const Text('تصدير النتائج (CSV)'),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildResultsCard() {
    final r = _result!;
    final isOutperforming = r.totalReturn > r.buyAndHoldReturn;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('نتائج الباك تيست',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            _buildResultRow(
              'العائد الإجمالي (الاستراتيجية)',
              '${r.totalReturn.toStringAsFixed(2)}%',
              r.totalReturn >= 0 ? Colors.green : Colors.red,
            ),
            _buildResultRow(
              'عائد الشراء والاحتفاظ',
              '${r.buyAndHoldReturn.toStringAsFixed(2)}%',
              r.buyAndHoldReturn >= 0 ? Colors.green : Colors.red,
            ),
            _buildResultRow(
              'التفوق',
              '${(r.totalReturn - r.buyAndHoldReturn).toStringAsFixed(2)}%',
              isOutperforming ? Colors.green : Colors.red,
            ),
            const Divider(),
            _buildResultRow('عدد الصفقات', '${r.numberOfTrades}', null),
            _buildResultRow(
                'معدل الفوز', '${r.winRate.toStringAsFixed(1)}%', null),
          ],
        ),
      ),
    );
  }

  Widget _buildResultRow(String label, String value, Color? color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label),
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEquityCurveChart() {
    final curve = _result!.equityCurve;
    if (curve.length < 2) return const SizedBox.shrink();

    final minY = curve.reduce((a, b) => a < b ? a : b) * 0.95;
    final maxY = curve.reduce((a, b) => a > b ? a : b) * 1.05;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('منحنى رأس المال',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            SizedBox(
              height: 200,
              child: LineChart(
                LineChartData(
                  minY: minY,
                  maxY: maxY,
                  gridData: const FlGridData(show: true),
                  titlesData: const FlTitlesData(
                    rightTitles:
                        AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    topTitles:
                        AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  ),
                  lineBarsData: [
                    LineChartBarData(
                      spots: curve
                          .asMap()
                          .entries
                          .map((e) =>
                              FlSpot(e.key.toDouble(), e.value))
                          .toList(),
                      isCurved: true,
                      color: Theme.of(context).colorScheme.primary,
                      barWidth: 2,
                      dotData: const FlDotData(show: false),
                      belowBarData: BarAreaData(
                        show: true,
                        color: Theme.of(context)
                            .colorScheme
                            .primary
                            .withOpacity(0.1),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTradesCard() {
    final trades = _result!.trades;
    if (trades.isEmpty) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Text('لم تُنفذ أي صفقات في هذه الفترة'),
        ),
      );
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('الصفقات (${trades.length})',
                style: const TextStyle(
                    fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ...trades.take(20).map((t) => ListTile(
                  dense: true,
                  leading: Icon(
                    t.type == 'buy' ? Icons.arrow_downward : Icons.arrow_upward,
                    color: t.type == 'buy' ? Colors.green : Colors.red,
                    size: 20,
                  ),
                  title: Text(
                    '${t.type == 'buy' ? 'شراء' : 'بيع'} ${t.quantity.toStringAsFixed(4)} @ \$${t.price.toStringAsFixed(2)}',
                    style: const TextStyle(fontSize: 13),
                  ),
                  subtitle: Text('يوم ${t.dayIndex} | OS: ${t.os.toStringAsFixed(2)}',
                      style: const TextStyle(fontSize: 11)),
                  trailing: Text('\$${t.value.toStringAsFixed(2)}',
                      style: const TextStyle(fontSize: 12)),
                )),
            if (trades.length > 20)
              Padding(
                padding: const EdgeInsets.all(8),
                child: Text(
                  '... و ${trades.length - 20} صفقة أخرى',
                  style: const TextStyle(color: Colors.grey),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
