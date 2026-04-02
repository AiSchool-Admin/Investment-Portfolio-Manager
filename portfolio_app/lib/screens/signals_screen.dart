import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/signal.dart';
import '../models/trade.dart';
import '../providers/portfolio_provider.dart';
import '../services/export_service.dart';

/// شاشة الإشارات والتوصيات
class SignalsScreen extends ConsumerWidget {
  const SignalsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final signalsAsync = ref.watch(signalsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('إشارات التداول'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () =>
                ref.read(signalsProvider.notifier).analyzeAll(),
          ),
          IconButton(
            icon: const Icon(Icons.file_download),
            onPressed: () async {
              final signals = signalsAsync.valueOrNull ?? [];
              if (signals.isNotEmpty) {
                final path = await ExportService.exportSignalsCSV(signals);
                await ExportService.shareFile(path);
              }
            },
          ),
        ],
      ),
      body: signalsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('خطأ: $e')),
        data: (signals) {
          if (signals.isEmpty) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.analytics_outlined, size: 64, color: Colors.grey),
                  SizedBox(height: 16),
                  Text('لا توجد إشارات حالياً', style: TextStyle(fontSize: 18)),
                  SizedBox(height: 8),
                  Text('أضف أصولاً وبيانات تاريخية لتوليد الإشارات'),
                ],
              ),
            );
          }

          final buySignals = signals.where((s) => s.isBuySignal).toList();
          final sellSignals = signals.where((s) => s.isSellSignal).toList();
          final neutralSignals = signals.where((s) => s.isNeutral).toList();

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // ملخص
              _buildSummaryRow(context, buySignals.length, sellSignals.length,
                  neutralSignals.length),
              const SizedBox(height: 16),

              if (buySignals.isNotEmpty) ...[
                _buildSectionHeader(context, 'إشارات الشراء', Colors.green,
                    Icons.arrow_downward),
                const SizedBox(height: 8),
                ...buySignals
                    .map((s) => _buildSignalDetailCard(context, ref, s)),
                const SizedBox(height: 16),
              ],

              if (sellSignals.isNotEmpty) ...[
                _buildSectionHeader(
                    context, 'إشارات البيع', Colors.red, Icons.arrow_upward),
                const SizedBox(height: 8),
                ...sellSignals
                    .map((s) => _buildSignalDetailCard(context, ref, s)),
                const SizedBox(height: 16),
              ],

              if (neutralSignals.isNotEmpty) ...[
                _buildSectionHeader(
                    context, 'انتظار', Colors.grey, Icons.pause_circle),
                const SizedBox(height: 8),
                ...neutralSignals
                    .map((s) => _buildSignalDetailCard(context, ref, s)),
              ],
            ],
          );
        },
      ),
    );
  }

  Widget _buildSummaryRow(
      BuildContext context, int buy, int sell, int neutral) {
    return Row(
      children: [
        Expanded(
          child: _buildCountCard(context, 'شراء', buy, Colors.green),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _buildCountCard(context, 'بيع', sell, Colors.red),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _buildCountCard(context, 'انتظار', neutral, Colors.grey),
        ),
      ],
    );
  }

  Widget _buildCountCard(
      BuildContext context, String label, int count, Color color) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Text(
              '$count',
              style: TextStyle(
                  fontSize: 24, fontWeight: FontWeight.bold, color: color),
            ),
            Text(label, style: TextStyle(color: color)),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(
      BuildContext context, String title, Color color, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(width: 8),
        Text(title,
            style: TextStyle(
                fontSize: 18, fontWeight: FontWeight.bold, color: color)),
      ],
    );
  }

  Widget _buildSignalDetailCard(
      BuildContext context, WidgetRef ref, TradingSignal signal) {
    final isBuy = signal.isBuySignal;
    final isSell = signal.isSellSignal;
    final color = isBuy
        ? Colors.green
        : isSell
            ? Colors.red
            : Colors.grey;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () => _showSignalDetails(context, ref, signal),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 20,
                        backgroundColor: color.withOpacity(0.1),
                        child: Icon(
                          isBuy
                              ? Icons.arrow_downward
                              : isSell
                                  ? Icons.arrow_upward
                                  : Icons.pause,
                          color: color,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(signal.assetName,
                              style: const TextStyle(
                                  fontWeight: FontWeight.bold, fontSize: 16)),
                          Text(
                            '${signal.signalTypeArabic} - ${signal.strengthArabic}',
                            style: TextStyle(color: color, fontSize: 12),
                          ),
                        ],
                      ),
                    ],
                  ),
                  _buildOSIndicator(signal.optimumScore, color),
                ],
              ),
              const SizedBox(height: 12),
              // مؤشرات
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildMetric('OS', signal.optimumScore.toStringAsFixed(2)),
                  _buildMetric('Z-Score', signal.zScore.toStringAsFixed(2)),
                  _buildMetric(
                      'العائد', '${(signal.expectedReturn * 100).toStringAsFixed(1)}%'),
                  _buildMetric(
                      'التقلب', '${(signal.volatility * 100).toStringAsFixed(1)}%'),
                ],
              ),
              const SizedBox(height: 12),
              // الأسباب
              ...signal.reasons.map((r) => Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Row(
                      children: [
                        Icon(Icons.info_outline,
                            size: 14, color: Colors.grey[600]),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(r,
                              style: TextStyle(
                                  fontSize: 12, color: Colors.grey[600])),
                        ),
                      ],
                    ),
                  )),
              // اقتراح الكمية
              if (signal.suggestedQuantity > 0) ...[
                const Divider(),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '${isBuy ? 'شراء' : 'بيع'}: ${signal.suggestedQuantity.toStringAsFixed(4)} وحدة',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    Text(
                      '\$${signal.suggestedValue.toStringAsFixed(2)}',
                      style: TextStyle(
                          fontWeight: FontWeight.bold, color: color),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildOSIndicator(double os, Color color) {
    return SizedBox(
      width: 50,
      height: 50,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CircularProgressIndicator(
            value: os,
            strokeWidth: 4,
            backgroundColor: Colors.grey[200],
            color: color,
          ),
          Text(
            (os * 100).toStringAsFixed(0),
            style: TextStyle(
                fontSize: 12, fontWeight: FontWeight.bold, color: color),
          ),
        ],
      ),
    );
  }

  Widget _buildMetric(String label, String value) {
    return Column(
      children: [
        Text(value,
            style:
                const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
        Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
      ],
    );
  }

  void _showSignalDetails(
      BuildContext context, WidgetRef ref, TradingSignal signal) {
    final qtyCtrl = TextEditingController(
        text: signal.suggestedQuantity.toStringAsFixed(4));

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          top: 20,
          left: 20,
          right: 20,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              '${signal.signalTypeArabic} - ${signal.assetName}',
              style: const TextStyle(
                  fontSize: 20, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),

            // تفاصيل
            _buildDetailRow('السعر الحالي',
                '\$${signal.currentPrice.toStringAsFixed(2)}'),
            _buildDetailRow(
                'Optimum Score', signal.optimumScore.toStringAsFixed(4)),
            _buildDetailRow('Z-Score', signal.zScore.toStringAsFixed(2)),
            _buildDetailRow('الوزن الحالي',
                '${(signal.currentWeight * 100).toStringAsFixed(1)}%'),
            _buildDetailRow('الوزن المستهدف',
                '${(signal.targetWeight * 100).toStringAsFixed(1)}%'),

            const SizedBox(height: 16),
            TextField(
              controller: qtyCtrl,
              decoration: InputDecoration(
                labelText: 'الكمية (قابلة للتعديل)',
                suffixText: signal.isBuySignal ? 'شراء' : 'بيع',
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 8),
            Builder(builder: (context) {
              final qty = double.tryParse(qtyCtrl.text) ?? 0;
              return Text(
                'القيمة التقديرية: \$${(qty * signal.currentPrice).toStringAsFixed(2)}',
                style: const TextStyle(fontSize: 14, color: Colors.grey),
                textAlign: TextAlign.center,
              );
            }),

            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () {
                final qty =
                    double.tryParse(qtyCtrl.text) ?? signal.suggestedQuantity;
                final trade = Trade(
                  assetId: signal.assetId,
                  assetName: signal.assetName,
                  type: signal.isBuySignal ? 'buy' : 'sell',
                  quantity: qty,
                  price: signal.currentPrice,
                  totalValue: qty * signal.currentPrice,
                  date: DateTime.now().toString().split(' ').first,
                  notes: 'OS: ${signal.optimumScore.toStringAsFixed(2)}',
                );
                ref.read(tradesProvider.notifier).addTrade(trade);
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('تم تسجيل الصفقة بنجاح')),
                );
              },
              icon: const Icon(Icons.check),
              label: const Text('تسجيل الصفقة'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label),
          Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}
