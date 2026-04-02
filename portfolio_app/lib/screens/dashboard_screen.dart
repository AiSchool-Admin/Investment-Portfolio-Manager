import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import '../providers/portfolio_provider.dart';
import '../services/export_service.dart';

/// لوحة التحكم الرئيسية - تخطيط متجاوب
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assetsAsync = ref.watch(assetsProvider);
    final signalsAsync = ref.watch(signalsProvider);
    final profile = ref.watch(profileProvider).valueOrNull;
    final totalValue = ref.watch(totalPortfolioValueProvider);
    final activeSignals = ref.watch(activeSignalsProvider);
    final rebalancing = ref.watch(rebalancingProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('لوحة التحكم'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () =>
                ref.read(signalsProvider.notifier).analyzeAll(),
            tooltip: 'تحديث التحليل',
          ),
          PopupMenuButton<String>(
            onSelected: (value) async {
              final assets = assetsAsync.valueOrNull ?? [];
              final signals = signalsAsync.valueOrNull ?? [];
              String? path;
              switch (value) {
                case 'pdf':
                  path = await ExportService.exportPortfolioPDF(
                      assets, signals, totalValue);
                  break;
                case 'csv':
                  path = await ExportService.exportPortfolioCSV(assets);
                  break;
              }
              if (path != null) {
                await ExportService.shareFile(path);
              }
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'pdf', child: Text('تصدير PDF')),
              const PopupMenuItem(value: 'csv', child: Text('تصدير CSV')),
            ],
          ),
        ],
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
                  Icon(Icons.account_balance_wallet_outlined,
                      size: 64, color: Colors.grey[400]),
                  const SizedBox(height: 16),
                  const Text('لا توجد أصول بعد',
                      style: TextStyle(fontSize: 18, color: Colors.grey)),
                  const SizedBox(height: 8),
                  const Text('ابدأ بإضافة أصولك من قسم "الأصول"',
                      style: TextStyle(color: Colors.grey)),
                ],
              ),
            );
          }

          final totalPL = assets.fold(0.0, (sum, a) => sum + a.profitLoss);
          final totalPurchase =
              assets.fold(0.0, (sum, a) => sum + a.purchaseValue);
          final plPercent =
              totalPurchase > 0 ? (totalPL / totalPurchase) * 100 : 0.0;

          final width = MediaQuery.of(context).size.width;
          final isWide = width >= 800;

          if (isWide) {
            return _buildDesktopDashboard(
              context, ref, assets, totalValue, totalPL, plPercent,
              profile?.availableCash ?? 0, activeSignals, rebalancing,
            );
          }

          return _buildMobileDashboard(
            context, ref, assets, totalValue, totalPL, plPercent,
            profile?.availableCash ?? 0, activeSignals, rebalancing,
          );
        },
      ),
    );
  }

  /// تخطيط سطح المكتب: عمودين متجاورين
  Widget _buildDesktopDashboard(
    BuildContext context,
    WidgetRef ref,
    List assets,
    double totalValue,
    double totalPL,
    double plPercent,
    double cash,
    List activeSignals,
    List rebalancing,
  ) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // الصف الأول: ملخص + رسم بياني
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                flex: 3,
                child: _buildSummaryCard(
                    context, totalValue, totalPL, plPercent, cash),
              ),
              const SizedBox(width: 16),
              if (assets.length > 1)
                Expanded(
                  flex: 2,
                  child: _buildPieChart(context, assets, totalValue),
                ),
            ],
          ),
          const SizedBox(height: 24),

          // الصف الثاني: إشارات + إعادة توازن
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // الإشارات النشطة
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildSectionTitle(context, 'الإشارات النشطة',
                        badge: activeSignals.length),
                    const SizedBox(height: 8),
                    if (activeSignals.isEmpty)
                      const Card(
                        child: Padding(
                          padding: EdgeInsets.all(24),
                          child: Center(child: Text('لا توجد إشارات نشطة')),
                        ),
                      )
                    else
                      ...activeSignals
                          .map((s) => _buildSignalCard(context, s)),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              // إعادة التوازن
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildSectionTitle(context, 'إعادة التوازن',
                        badge: rebalancing.length),
                    const SizedBox(height: 8),
                    if (rebalancing.isEmpty)
                      const Card(
                        child: Padding(
                          padding: EdgeInsets.all(24),
                          child: Center(child: Text('جميع الأوزان متوازنة')),
                        ),
                      )
                    else
                      ...rebalancing
                          .map((r) => _buildRebalanceCard(context, r)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // الصف الثالث: ملخص الأصول (جدول على سطح المكتب)
          _buildSectionTitle(context, 'ملخص الأصول'),
          const SizedBox(height: 8),
          _buildAssetsTable(context, assets, totalValue),
        ],
      ),
    );
  }

  /// جدول الأصول (لسطح المكتب)
  Widget _buildAssetsTable(
      BuildContext context, List assets, double totalValue) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Table(
          columnWidths: const {
            0: FlexColumnWidth(2),
            1: FlexColumnWidth(1.5),
            2: FlexColumnWidth(1.5),
            3: FlexColumnWidth(1.5),
            4: FlexColumnWidth(1.5),
            5: FlexColumnWidth(1),
          },
          children: [
            TableRow(
              decoration: BoxDecoration(
                border: Border(
                    bottom: BorderSide(color: Colors.grey[300]!)),
              ),
              children: const [
                _TableHeader('الأصل'),
                _TableHeader('الفئة'),
                _TableHeader('السعر الحالي'),
                _TableHeader('القيمة'),
                _TableHeader('الربح/الخسارة'),
                _TableHeader('الوزن'),
              ],
            ),
            ...assets.map((a) {
              final weight =
                  totalValue > 0 ? (a.currentValue / totalValue) : 0.0;
              final isPositive = a.profitLoss >= 0;
              return TableRow(
                children: [
                  _TableCell(a.name, bold: true),
                  _TableCell(a.category),
                  _TableCell('\$${a.currentPrice.toStringAsFixed(2)}'),
                  _TableCell('\$${a.currentValue.toStringAsFixed(2)}'),
                  _TableCell(
                    '${isPositive ? '+' : ''}${a.profitLossPercent.toStringAsFixed(1)}%',
                    color: isPositive ? Colors.green : Colors.red,
                  ),
                  _TableCell('${(weight * 100).toStringAsFixed(1)}%'),
                ],
              );
            }),
          ],
        ),
      ),
    );
  }

  /// تخطيط الجوال: قائمة عمودية
  Widget _buildMobileDashboard(
    BuildContext context,
    WidgetRef ref,
    List assets,
    double totalValue,
    double totalPL,
    double plPercent,
    double cash,
    List activeSignals,
    List rebalancing,
  ) {
    return RefreshIndicator(
      onRefresh: () async =>
          ref.read(signalsProvider.notifier).analyzeAll(),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildSummaryCard(context, totalValue, totalPL, plPercent, cash),
          const SizedBox(height: 16),
          if (assets.length > 1)
            _buildPieChart(context, assets, totalValue),
          const SizedBox(height: 16),
          if (activeSignals.isNotEmpty) ...[
            _buildSectionTitle(context, 'الإشارات النشطة',
                badge: activeSignals.length),
            const SizedBox(height: 8),
            ...activeSignals.map((s) => _buildSignalCard(context, s)),
            const SizedBox(height: 16),
          ],
          if (rebalancing.isNotEmpty) ...[
            _buildSectionTitle(context, 'إعادة التوازن المطلوبة',
                badge: rebalancing.length),
            const SizedBox(height: 8),
            ...rebalancing.map((r) => _buildRebalanceCard(context, r)),
            const SizedBox(height: 16),
          ],
          _buildSectionTitle(context, 'ملخص الأصول'),
          const SizedBox(height: 8),
          ...assets
              .map((a) => _buildAssetSummaryCard(context, a, totalValue)),
        ],
      ),
    );
  }

  // ===================== مكونات مشتركة =====================

  Widget _buildSummaryCard(BuildContext context, double totalValue,
      double totalPL, double plPercent, double cash) {
    final isPositive = totalPL >= 0;
    return Card(
      color: Theme.of(context).colorScheme.primaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            const Text('القيمة الإجمالية للمحفظة',
                style: TextStyle(fontSize: 14)),
            const SizedBox(height: 8),
            Text(
              '\$${totalValue.toStringAsFixed(2)}',
              style: const TextStyle(
                  fontSize: 32, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  isPositive ? Icons.trending_up : Icons.trending_down,
                  color: isPositive ? Colors.green : Colors.red,
                  size: 20,
                ),
                const SizedBox(width: 4),
                Text(
                  '${isPositive ? '+' : ''}\$${totalPL.toStringAsFixed(2)} (${plPercent.toStringAsFixed(1)}%)',
                  style: TextStyle(
                    color: isPositive ? Colors.green[700] : Colors.red[700],
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const Divider(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('النقد المتاح:'),
                Text('\$${cash.toStringAsFixed(2)}',
                    style: const TextStyle(fontWeight: FontWeight.bold)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPieChart(
      BuildContext context, List assets, double totalValue) {
    if (totalValue <= 0) return const SizedBox.shrink();

    final colors = [
      Colors.blue, Colors.green, Colors.orange, Colors.purple,
      Colors.red, Colors.teal, Colors.amber, Colors.indigo,
      Colors.pink, Colors.cyan,
    ];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            const Text('توزيع المحفظة',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 16),
            SizedBox(
              height: 200,
              child: PieChart(
                PieChartData(
                  sections: assets.asMap().entries.map((entry) {
                    final i = entry.key;
                    final a = entry.value;
                    final percent = (a.currentValue / totalValue) * 100;
                    return PieChartSectionData(
                      value: a.currentValue,
                      title: '${percent.toStringAsFixed(0)}%',
                      color: colors[i % colors.length],
                      radius: 60,
                      titleStyle: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    );
                  }).toList(),
                  sectionsSpace: 2,
                  centerSpaceRadius: 40,
                ),
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 16,
              runSpacing: 8,
              children: assets.asMap().entries.map((entry) {
                final i = entry.key;
                final a = entry.value;
                return Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 12, height: 12,
                      decoration: BoxDecoration(
                        color: colors[i % colors.length],
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(a.name, style: const TextStyle(fontSize: 12)),
                  ],
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(BuildContext context, String title, {int? badge}) {
    return Row(
      children: [
        Text(title,
            style:
                const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        if (badge != null && badge > 0) ...[
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text('$badge',
                style: TextStyle(
                    color: Theme.of(context).colorScheme.onPrimary,
                    fontSize: 12)),
          ),
        ],
      ],
    );
  }

  Widget _buildSignalCard(BuildContext context, signal) {
    final isBuy = signal.signalType == 'buy';
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: isBuy ? Colors.green[100] : Colors.red[100],
          child: Icon(
            isBuy ? Icons.arrow_downward : Icons.arrow_upward,
            color: isBuy ? Colors.green : Colors.red,
          ),
        ),
        title: Text(signal.assetName),
        subtitle: Text(
          '${signal.signalTypeArabic} | OS: ${signal.optimumScore.toStringAsFixed(2)}',
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              '\$${signal.suggestedValue.toStringAsFixed(2)}',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            Text(
              '${signal.suggestedQuantity.toStringAsFixed(4)} وحدة',
              style: const TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRebalanceCard(BuildContext context, rebalance) {
    return Card(
      color: Colors.orange[50],
      child: ListTile(
        leading: const CircleAvatar(
          backgroundColor: Colors.orange,
          child: Icon(Icons.balance, color: Colors.white),
        ),
        title: Text(rebalance.assetName),
        subtitle: Text(
          'الحالي: ${(rebalance.currentWeight * 100).toStringAsFixed(1)}% | المستهدف: ${(rebalance.targetWeight * 100).toStringAsFixed(1)}%',
        ),
        trailing: Text(
          '${(rebalance.deviation * 100).toStringAsFixed(1)}%',
          style: const TextStyle(
              color: Colors.orange, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }

  Widget _buildAssetSummaryCard(
      BuildContext context, asset, double totalValue) {
    final weight = totalValue > 0 ? (asset.currentValue / totalValue) : 0.0;
    final isPositive = asset.profitLoss >= 0;

    return Card(
      child: ListTile(
        title: Text(asset.name,
            style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Text(
          '${asset.category} | ${(weight * 100).toStringAsFixed(1)}% من المحفظة',
        ),
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
      ),
    );
  }
}

/// عنوان خلية الجدول
class _TableHeader extends StatelessWidget {
  final String text;
  const _TableHeader(this.text);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        child: Text(text,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
      );
}

/// خلية الجدول
class _TableCell extends StatelessWidget {
  final String text;
  final bool bold;
  final Color? color;
  const _TableCell(this.text, {this.bold = false, this.color});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        child: Text(
          text,
          style: TextStyle(
            fontWeight: bold ? FontWeight.bold : FontWeight.normal,
            color: color,
            fontSize: 13,
          ),
        ),
      );
}
