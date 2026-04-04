'use client';

import { useState, useEffect } from 'react';
import { getProfile, isInitialized } from './lib/store';
import Questionnaire from './components/Questionnaire';
import AppShell from './components/AppShell';

export default function Page() {
  const [ready, setReady] = useState<'loading' | 'questionnaire' | 'app'>('loading');

  useEffect(() => {
    try {
      // التحقق من وجود الملف الاستثماري أو إتمام الإعداد سابقاً
      const hasProfile = getProfile() !== null;
      const wasInitialized = isInitialized();
      setReady(hasProfile || wasInitialized ? 'app' : 'questionnaire');
    } catch {
      // في حال فشل localStorage
      setReady('questionnaire');
    }
  }, []);

  if (ready === 'loading') {
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

  if (ready === 'questionnaire') {
    return <Questionnaire onComplete={() => setReady('app')} />;
  }

  return <AppShell />;
}
