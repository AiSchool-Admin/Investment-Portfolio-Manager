'use client';

import { useState, useEffect } from 'react';
import { getProfile, saveProfile, getAssets, loadSampleData } from './lib/store';
import AppShell from './components/AppShell';

export default function Page() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // إذا لم يكن هناك ملف استثماري، ننشئ ملفاً افتراضياً
    if (!getProfile()) {
      saveProfile({
        riskScore: 5,
        profileType: 'balanced',
        stocksWeight: 0.35,
        cryptoWeight: 0.10,
        bondsWeight: 0.25,
        commoditiesWeight: 0.10,
        realEstateWeight: 0.10,
        cashWeight: 0.10,
        availableCash: 10000,
      });
    }
    // إذا لم تكن هناك أصول، نحمّل بيانات تجريبية تلقائياً
    if (getAssets().length === 0) {
      loadSampleData();
    }
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-5xl mb-4">📊</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
            مدير المحفظة الاستثمارية
          </div>
          <div className="text-sm text-gray-500 mt-2">جاري التحميل...</div>
        </div>
      </div>
    );
  }

  return <AppShell />;
}
