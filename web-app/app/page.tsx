'use client';

import { useState, useEffect } from 'react';
import { getProfile } from './lib/store';
import Questionnaire from './components/Questionnaire';
import AppShell from './components/AppShell';

export default function Page() {
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  useEffect(() => {
    setHasProfile(getProfile() !== null);
  }, []);

  // شاشة التحميل
  if (hasProfile === null) {
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

  // استبيان المخاطر (أول مرة)
  if (!hasProfile) {
    return <Questionnaire onComplete={() => setHasProfile(true)} />;
  }

  // التطبيق الرئيسي
  return <AppShell />;
}
