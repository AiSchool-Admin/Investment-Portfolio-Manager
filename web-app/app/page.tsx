'use client';

import { useState, useEffect } from 'react';
import { getProfile, saveProfile, getAssets, loadSampleData, syncFromSupabase } from './lib/store';
import { isSupabaseConfigured } from './lib/supabaseClient';
import AppShell from './components/AppShell';

export default function Page() {
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('جاري التحميل...');

  useEffect(() => {
    async function init() {
      // إذا Supabase متصل → سحب البيانات من قاعدة البيانات أولاً
      if (isSupabaseConfigured()) {
        setStatus('جاري الاتصال بقاعدة البيانات...');
        await syncFromSupabase();
      }

      // إذا لم يكن هناك ملف استثماري → ننشئ افتراضي
      if (!getProfile()) {
        saveProfile({
          riskScore: 5, profileType: 'balanced',
          stocksWeight: 0.35, cryptoWeight: 0.10, bondsWeight: 0.25,
          commoditiesWeight: 0.10, realEstateWeight: 0.10, cashWeight: 0.10,
          availableCash: 10000,
        });
      }

      // إذا لم تكن هناك أصول → نحمّل بيانات تجريبية
      if (getAssets().length === 0) {
        loadSampleData();
      }

      setReady(true);
    }
    init();
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-5xl mb-4">📊</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
            مدير المحفظة الاستثمارية
          </div>
          <div className="text-sm text-gray-500 mt-2">{status}</div>
        </div>
      </div>
    );
  }

  return <AppShell />;
}
