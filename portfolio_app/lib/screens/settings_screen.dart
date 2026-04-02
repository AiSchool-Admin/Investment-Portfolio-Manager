import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/portfolio_provider.dart';
import 'risk_questionnaire_screen.dart';

/// شاشة الإعدادات
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider).valueOrNull;
    final tradesAsync = ref.watch(tradesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('الإعدادات'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // الملف الاستثماري
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('الملف الاستثماري',
                      style:
                          TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  if (profile != null) ...[
                    _buildRow('النمط', profile.profileTypeArabic),
                    _buildRow('درجة المخاطر', '${profile.riskScore}/10'),
                    _buildRow(
                        'النقد المتاح', '\$${profile.availableCash.toStringAsFixed(2)}'),
                    const Divider(),
                    const Text('التوزيع المستهدف:',
                        style: TextStyle(fontWeight: FontWeight.w500)),
                    const SizedBox(height: 8),
                    _buildWeightBar('أسهم', profile.stocksWeight),
                    _buildWeightBar('عملات رقمية', profile.cryptoWeight),
                    _buildWeightBar('سندات', profile.bondsWeight),
                    _buildWeightBar('سلع', profile.commoditiesWeight),
                    _buildWeightBar('عقارات', profile.realEstateWeight),
                    _buildWeightBar('نقد', profile.cashWeight),
                  ] else
                    const Text('لم يتم إعداد الملف الاستثماري بعد'),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) =>
                                    const RiskQuestionnaireScreen(),
                              ),
                            );
                          },
                          icon: const Icon(Icons.refresh),
                          label: const Text('إعادة التقييم'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () =>
                              _showUpdateCashDialog(context, ref, profile),
                          icon: const Icon(Icons.attach_money),
                          label: const Text('تحديث النقد'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // سجل الصفقات
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('سجل الصفقات',
                      style:
                          TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  tradesAsync.when(
                    loading: () => const CircularProgressIndicator(),
                    error: (e, _) => Text('خطأ: $e'),
                    data: (trades) {
                      if (trades.isEmpty) {
                        return const Text('لا توجد صفقات مسجلة');
                      }
                      return Column(
                        children: trades.take(10).map((t) {
                          final isBuy = t.type == 'buy';
                          return ListTile(
                            dense: true,
                            leading: Icon(
                              isBuy
                                  ? Icons.arrow_downward
                                  : Icons.arrow_upward,
                              color: isBuy ? Colors.green : Colors.red,
                            ),
                            title: Text(
                                '${isBuy ? 'شراء' : 'بيع'} ${t.assetName}'),
                            subtitle: Text(
                                '${t.quantity.toStringAsFixed(4)} @ \$${t.price.toStringAsFixed(2)} - ${t.date}'),
                            trailing: Text(
                              '\$${t.totalValue.toStringAsFixed(2)}',
                              style:
                                  const TextStyle(fontWeight: FontWeight.bold),
                            ),
                          );
                        }).toList(),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // معلومات التطبيق
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('حول التطبيق',
                      style:
                          TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  _buildRow('الإصدار', '1.0.0 (MVP)'),
                  _buildRow('المحرك', 'Optimum Score Engine v1'),
                  _buildRow('قاعدة البيانات', 'SQLite (محلية)'),
                  _buildRow('الاتصال', 'بدون إنترنت - بيانات محلية فقط'),
                  const SizedBox(height: 8),
                  const Text(
                    'تطبيق المدير الديناميكي للمحفظة الاستثمارية الشخصية.\n'
                    'يعتمد على نموذج Optimum Score الرياضي لتوليد إشارات شراء وبيع.\n'
                    'جميع البيانات مخزنة محلياً على الجهاز.',
                    style: TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRow(String label, String value) {
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

  Widget _buildWeightBar(String label, double weight) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          SizedBox(
            width: 90,
            child: Text(label, style: const TextStyle(fontSize: 13)),
          ),
          Expanded(
            child: LinearProgressIndicator(
              value: weight,
              minHeight: 8,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 40,
            child: Text(
              '${(weight * 100).toStringAsFixed(0)}%',
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }

  void _showUpdateCashDialog(
      BuildContext context, WidgetRef ref, profile) {
    final ctrl = TextEditingController(
        text: profile?.availableCash?.toStringAsFixed(2) ?? '0');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('تحديث النقد المتاح'),
        content: TextField(
          controller: ctrl,
          decoration: const InputDecoration(
            labelText: 'المبلغ (\$)',
          ),
          keyboardType: TextInputType.number,
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('إلغاء'),
          ),
          FilledButton(
            onPressed: () {
              final cash = double.tryParse(ctrl.text) ?? 0;
              ref.read(profileProvider.notifier).updateCash(cash);
              Navigator.pop(ctx);
            },
            child: const Text('تحديث'),
          ),
        ],
      ),
    );
  }
}
