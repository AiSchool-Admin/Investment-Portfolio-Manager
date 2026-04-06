'use client';

import { useState } from 'react';
import Dashboard from './Dashboard';
import AssetsPage from './AssetsPage';
import SignalsPage from './SignalsPage';
import BacktestPage from './BacktestPage';
import PositionBuilderPage from './PositionBuilderPage';
import EconomicIndicatorsPage from './EconomicIndicatorsPage';
import SettingsPage from './SettingsPage';

const TABS = [
  { id: 'dashboard', label: 'لوحة التحكم', icon: '📊' },
  { id: 'assets', label: 'الأصول', icon: '💼' },
  { id: 'builder', label: 'بناء المراكز', icon: '🏗️' },
  { id: 'signals', label: 'الإشارات', icon: '🔔' },
  { id: 'macro', label: 'الاقتصاد الكلي', icon: '🌍' },
  { id: 'backtest', label: 'باك تيست', icon: '📈' },
  { id: 'settings', label: 'الإعدادات', icon: '⚙️' },
];

export default function AppShell() {
  const [tab, setTab] = useState('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey(k => k + 1);

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* الشريط الجانبي (سطح المكتب) */}
      <nav className="hidden md:flex flex-col w-56 border-l border-border bg-white p-4 gap-1">
        <div className="text-center mb-6 pb-4 border-b border-border">
          <div className="text-2xl">📊</div>
          <div className="text-sm font-bold mt-1" style={{ color: 'var(--primary)' }}>مدير المحفظة</div>
        </div>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-right transition-all cursor-pointer ${
              tab === t.id
                ? 'font-bold'
                : 'hover:bg-gray-50'
            }`}
            style={tab === t.id ? { background: 'var(--primary-bg)', color: 'var(--primary)' } : {}}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {/* المحتوى */}
      <main className="flex-1 overflow-auto pb-20 md:pb-4">
        {tab === 'dashboard' && <Dashboard key={refreshKey} onRefresh={refresh} onNavigate={setTab} />}
        {tab === 'assets' && <AssetsPage key={refreshKey} onRefresh={refresh} />}
        {tab === 'builder' && <PositionBuilderPage key={refreshKey} onRefresh={refresh} />}
        {tab === 'signals' && <SignalsPage key={refreshKey} />}
        {tab === 'macro' && <EconomicIndicatorsPage />}
        {tab === 'backtest' && <BacktestPage />}
        {tab === 'settings' && <SettingsPage />}
      </main>

      {/* شريط التنقل السفلي (جوال) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border flex justify-around py-2 z-50">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 cursor-pointer ${
              tab === t.id ? 'font-bold' : 'opacity-60'
            }`}
            style={tab === t.id ? { color: 'var(--primary)' } : {}}
          >
            <span className="text-lg">{t.icon}</span>
            <span className="text-[10px]">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
