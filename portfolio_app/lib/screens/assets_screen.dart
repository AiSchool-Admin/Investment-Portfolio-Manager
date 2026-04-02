import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/asset.dart';
import '../models/price_history.dart';
import '../providers/portfolio_provider.dart';

/// شاشة إدارة الأصول
class AssetsScreen extends ConsumerWidget {
  const AssetsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assetsAsync = ref.watch(assetsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('إدارة الأصول'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddAssetDialog(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('إضافة أصل'),
      ),
      body: assetsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('خطأ: $e')),
        data: (assets) {
          if (assets.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.add_chart, size: 64, color: Colors.grey[400]),
                  const SizedBox(height: 16),
                  const Text('لا توجد أصول', style: TextStyle(fontSize: 18)),
                  const SizedBox(height: 8),
                  const Text('اضغط + لإضافة أصل جديد'),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: assets.length,
            itemBuilder: (context, index) =>
                _buildAssetCard(context, ref, assets[index]),
          );
        },
      ),
    );
  }

  Widget _buildAssetCard(BuildContext context, WidgetRef ref, Asset asset) {
    final isPositive = asset.profitLoss >= 0;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ExpansionTile(
        leading: CircleAvatar(
          backgroundColor: _categoryColor(asset.category),
          child: Text(
            asset.name.substring(0, asset.name.length.clamp(0, 2)),
            style: const TextStyle(
                color: Colors.white, fontWeight: FontWeight.bold),
          ),
        ),
        title: Text(asset.name,
            style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Text(asset.category),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              '\$${asset.currentValue.toStringAsFixed(2)}',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            Text(
              '${isPositive ? '+' : ''}${asset.profitLossPercent.toStringAsFixed(1)}%',
              style: TextStyle(
                color: isPositive ? Colors.green : Colors.red,
                fontSize: 12,
              ),
            ),
          ],
        ),
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _buildDetailRow('الكمية', asset.quantity.toStringAsFixed(4)),
                _buildDetailRow(
                    'سعر الشراء', '\$${asset.purchasePrice.toStringAsFixed(2)}'),
                _buildDetailRow(
                    'السعر الحالي', '\$${asset.currentPrice.toStringAsFixed(2)}'),
                _buildDetailRow(
                    'تاريخ الشراء', asset.purchaseDate),
                _buildDetailRow(
                    'الوزن المستهدف',
                    '${(asset.targetWeight * 100).toStringAsFixed(1)}%'),
                _buildDetailRow(
                    'الربح/الخسارة',
                    '\$${asset.profitLoss.toStringAsFixed(2)}'),
                const Divider(),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    TextButton.icon(
                      onPressed: () =>
                          _showUpdatePriceDialog(context, ref, asset),
                      icon: const Icon(Icons.edit),
                      label: const Text('تحديث السعر'),
                    ),
                    TextButton.icon(
                      onPressed: () =>
                          _showAddPriceHistoryDialog(context, ref, asset),
                      icon: const Icon(Icons.history),
                      label: const Text('إضافة سجل'),
                    ),
                    TextButton.icon(
                      onPressed: () =>
                          _confirmDelete(context, ref, asset),
                      icon: const Icon(Icons.delete, color: Colors.red),
                      label: const Text('حذف',
                          style: TextStyle(color: Colors.red)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.grey)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  Color _categoryColor(String category) {
    switch (category) {
      case 'أسهم':
        return Colors.blue;
      case 'عملات رقمية':
        return Colors.orange;
      case 'سندات':
        return Colors.green;
      case 'سلع':
        return Colors.amber;
      case 'عقارات':
        return Colors.purple;
      default:
        return Colors.grey;
    }
  }

  void _showAddAssetDialog(BuildContext context, WidgetRef ref) {
    final nameCtrl = TextEditingController();
    final qtyCtrl = TextEditingController();
    final priceCtrl = TextEditingController();
    final weightCtrl = TextEditingController();
    String category = 'أسهم';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Text('إضافة أصل جديد'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(
                    labelText: 'اسم الأصل',
                    hintText: 'مثال: AAPL',
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: category,
                  decoration: const InputDecoration(labelText: 'الفئة'),
                  items: const [
                    DropdownMenuItem(value: 'أسهم', child: Text('أسهم')),
                    DropdownMenuItem(
                        value: 'عملات رقمية', child: Text('عملات رقمية')),
                    DropdownMenuItem(value: 'سندات', child: Text('سندات')),
                    DropdownMenuItem(value: 'سلع', child: Text('سلع')),
                    DropdownMenuItem(value: 'عقارات', child: Text('عقارات')),
                  ],
                  onChanged: (v) => setState(() => category = v!),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: qtyCtrl,
                  decoration: const InputDecoration(
                    labelText: 'الكمية',
                    hintText: 'مثال: 10',
                  ),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: priceCtrl,
                  decoration: const InputDecoration(
                    labelText: 'سعر الشراء (\$)',
                    hintText: 'مثال: 150.00',
                  ),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: weightCtrl,
                  decoration: const InputDecoration(
                    labelText: 'الوزن المستهدف (%)',
                    hintText: 'مثال: 20',
                  ),
                  keyboardType: TextInputType.number,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('إلغاء'),
            ),
            FilledButton(
              onPressed: () {
                final name = nameCtrl.text.trim();
                final qty = double.tryParse(qtyCtrl.text) ?? 0;
                final price = double.tryParse(priceCtrl.text) ?? 0;
                final weight = (double.tryParse(weightCtrl.text) ?? 0) / 100;

                if (name.isEmpty || qty <= 0 || price <= 0) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('يرجى ملء جميع الحقول بشكل صحيح')),
                  );
                  return;
                }

                final asset = Asset(
                  name: name,
                  category: category,
                  quantity: qty,
                  purchasePrice: price,
                  purchaseDate: DateTime.now().toString().split(' ').first,
                  currentPrice: price,
                  targetWeight: weight,
                );

                ref.read(assetsProvider.notifier).addAsset(asset);
                Navigator.pop(ctx);
              },
              child: const Text('إضافة'),
            ),
          ],
        ),
      ),
    );
  }

  void _showUpdatePriceDialog(
      BuildContext context, WidgetRef ref, Asset asset) {
    final priceCtrl =
        TextEditingController(text: asset.currentPrice.toString());

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('تحديث سعر ${asset.name}'),
        content: TextField(
          controller: priceCtrl,
          decoration: const InputDecoration(
            labelText: 'السعر الجديد (\$)',
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
              final price = double.tryParse(priceCtrl.text);
              if (price != null && price > 0) {
                ref.read(assetsProvider.notifier).updatePrice(asset.id!, price);

                // إضافة للسجل التاريخي
                final db = ref.read(databaseProvider);
                db.insertPriceHistory(PriceHistory(
                  assetId: asset.id!,
                  date: DateTime.now().toString().split(' ').first,
                  closePrice: price,
                ));

                Navigator.pop(ctx);
                // إعادة تحليل الإشارات
                ref.read(signalsProvider.notifier).analyzeAll();
              }
            },
            child: const Text('تحديث'),
          ),
        ],
      ),
    );
  }

  void _showAddPriceHistoryDialog(
      BuildContext context, WidgetRef ref, Asset asset) {
    final dateCtrl = TextEditingController();
    final priceCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('إضافة سجل تاريخي - ${asset.name}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: dateCtrl,
              decoration: const InputDecoration(
                labelText: 'التاريخ',
                hintText: '2026-01-15',
              ),
              onTap: () async {
                final date = await showDatePicker(
                  context: ctx,
                  initialDate: DateTime.now(),
                  firstDate: DateTime(2020),
                  lastDate: DateTime.now(),
                );
                if (date != null) {
                  dateCtrl.text = date.toString().split(' ').first;
                }
              },
              readOnly: true,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: priceCtrl,
              decoration: const InputDecoration(
                labelText: 'سعر الإغلاق (\$)',
              ),
              keyboardType: TextInputType.number,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('إلغاء'),
          ),
          FilledButton(
            onPressed: () {
              final date = dateCtrl.text.trim();
              final price = double.tryParse(priceCtrl.text);
              if (date.isNotEmpty && price != null && price > 0) {
                final db = ref.read(databaseProvider);
                db.insertPriceHistory(PriceHistory(
                  assetId: asset.id!,
                  date: date,
                  closePrice: price,
                ));
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('تم إضافة السجل بنجاح')),
                );
              }
            },
            child: const Text('إضافة'),
          ),
        ],
      ),
    );
  }

  void _confirmDelete(BuildContext context, WidgetRef ref, Asset asset) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('تأكيد الحذف'),
        content: Text('هل تريد حذف ${asset.name}؟ لا يمكن التراجع عن هذا الإجراء.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('إلغاء'),
          ),
          FilledButton(
            onPressed: () {
              ref.read(assetsProvider.notifier).deleteAsset(asset.id!);
              Navigator.pop(ctx);
            },
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('حذف'),
          ),
        ],
      ),
    );
  }
}
