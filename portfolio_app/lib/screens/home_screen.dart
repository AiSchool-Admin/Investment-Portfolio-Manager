import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/portfolio_provider.dart';
import 'dashboard_screen.dart';
import 'assets_screen.dart';
import 'signals_screen.dart';
import 'backtest_screen.dart';
import 'settings_screen.dart';

/// الشاشة الرئيسية - تخطيط متجاوب:
/// على الجوال: شريط تنقل سفلي
/// على سطح المكتب: شريط جانبي (NavigationRail)
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int _currentIndex = 0;

  final _screens = const [
    DashboardScreen(),
    AssetsScreen(),
    SignalsScreen(),
    BacktestScreen(),
    SettingsScreen(),
  ];

  static const _navItems = [
    _NavItem(Icons.dashboard_outlined, Icons.dashboard, 'لوحة التحكم'),
    _NavItem(Icons.account_balance_wallet_outlined,
        Icons.account_balance_wallet, 'الأصول'),
    _NavItem(Icons.notifications_outlined, Icons.notifications, 'الإشارات'),
    _NavItem(Icons.history_outlined, Icons.history, 'باك تيست'),
    _NavItem(Icons.settings_outlined, Icons.settings, 'الإعدادات'),
  ];

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(signalsProvider.notifier).analyzeAll();
    });
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    final isWide = width >= 800; // سطح المكتب أو تابلت عرضي

    if (isWide) {
      return _buildDesktopLayout();
    }
    return _buildMobileLayout();
  }

  /// تخطيط سطح المكتب: شريط جانبي + محتوى
  Widget _buildDesktopLayout() {
    final width = MediaQuery.of(context).size.width;
    final isExtended = width >= 1100; // إظهار النص بجانب الأيقونة

    return Scaffold(
      body: Row(
        children: [
          // الشريط الجانبي
          NavigationRail(
            extended: isExtended,
            selectedIndex: _currentIndex,
            onDestinationSelected: (index) =>
                setState(() => _currentIndex = index),
            leading: Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Column(
                children: [
                  Icon(
                    Icons.trending_up_rounded,
                    size: 32,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  if (isExtended) ...[
                    const SizedBox(height: 4),
                    Text(
                      'مدير المحفظة',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            destinations: _navItems
                .map((item) => NavigationRailDestination(
                      icon: Icon(item.icon),
                      selectedIcon: Icon(item.selectedIcon),
                      label: Text(item.label),
                    ))
                .toList(),
          ),
          const VerticalDivider(thickness: 1, width: 1),
          // المحتوى الرئيسي
          Expanded(
            child: ClipRect(
              child: IndexedStack(
                index: _currentIndex,
                children: _screens,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// تخطيط الجوال: محتوى + شريط سفلي
  Widget _buildMobileLayout() {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) =>
            setState(() => _currentIndex = index),
        destinations: _navItems
            .map((item) => NavigationDestination(
                  icon: Icon(item.icon),
                  selectedIcon: Icon(item.selectedIcon),
                  label: item.label,
                ))
            .toList(),
      ),
    );
  }
}

class _NavItem {
  final IconData icon;
  final IconData selectedIcon;
  final String label;
  const _NavItem(this.icon, this.selectedIcon, this.label);
}
