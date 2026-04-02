'use client';

import { useState } from 'react';
import { getProfile, saveProfile, getTrades } from '../lib/store';
import { PROFILE_NAMES } from '../lib/types';

export default function SettingsPage({ onProfileReset }: { onProfileReset: () => void }) {
  const [profile, setProfile] = useState(getProfile);
  const [cash, setCash] = useState(profile?.availableCash?.toString() || '0');
  const trades = getTrades();

  const updateCash = () => {
    if (profile) {
      const updated = { ...profile, availableCash: parseFloat(cash) || 0 };
      saveProfile(updated);
      setProfile(updated);
    }
  };

  const resetProfile = () => {
    if (confirm('هل تريد إعادة تعيين الملف الاستثماري؟ ستحتاج لإعادة الاستبيان.')) {
      localStorage.clear();
      onProfileReset();
    }
  };

  const weights = profile ? [
    { label: 'أسهم', value: profile.stocksWeight },
    { label: 'عملات رقمية', value: profile.cryptoWeight },
    { label: 'سندات', value: profile.bondsWeight },
    { label: 'سلع', value: profile.commoditiesWeight },
    { label: 'عقارات', value: profile.realEstateWeight },
    { label: 'نقد', value: profile.cashWeight },
  ] : [];

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">الإعدادات</h1>

      {/* الملف الاستثماري */}
      <div className="card mb-4">
        <h2 className="font-bold text-lg mb-3">الملف الاستثماري</h2>
        {profile ? (
          <>
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div className="flex justify-between"><span>النمط:</span><b>{PROFILE_NAMES[profile.profileType]}</b></div>
              <div className="flex justify-between"><span>درجة المخاطر:</span><b>{profile.riskScore}/10</b></div>
            </div>

            <div className="mb-3">
              <div className="text-sm font-bold mb-2">التوزيع المستهدف:</div>
              {weights.map(w => (
                <div key={w.label} className="flex items-center gap-2 mb-1">
                  <span className="w-20 text-xs">{w.label}</span>
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${w.value * 100}%`, background: 'var(--primary)' }} />
                  </div>
                  <span className="text-xs font-bold w-8">{(w.value * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mb-3">
              <input className="input flex-1" type="number" value={cash} onChange={e => setCash(e.target.value)}
                placeholder="النقد المتاح" />
              <button className="btn-primary text-sm" onClick={updateCash}>تحديث النقد</button>
            </div>

            <button className="btn-outline w-full text-sm" onClick={resetProfile}>
              إعادة تعيين الملف الاستثماري
            </button>
          </>
        ) : (
          <div className="text-gray-400">لم يتم إعداد الملف الاستثماري</div>
        )}
      </div>

      {/* سجل الصفقات */}
      <div className="card mb-4">
        <h2 className="font-bold text-lg mb-3">سجل الصفقات ({trades.length})</h2>
        {trades.length === 0 ? (
          <div className="text-gray-400 text-sm">لا توجد صفقات مسجلة</div>
        ) : (
          trades.slice(0, 15).map(t => (
            <div key={t.id} className="flex items-center gap-2 py-2 border-b border-gray-50 text-sm">
              <span className={`font-bold ${t.type === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
                {t.type === 'buy' ? '↓' : '↑'}
              </span>
              <span className="flex-1">
                {t.type === 'buy' ? 'شراء' : 'بيع'} {t.assetName} - {t.quantity.toFixed(4)} @ ${t.price.toFixed(2)}
              </span>
              <span className="text-gray-400 text-xs">{t.date}</span>
              <span className="font-bold">${t.totalValue.toFixed(2)}</span>
            </div>
          ))
        )}
      </div>

      {/* حول التطبيق */}
      <div className="card">
        <h2 className="font-bold text-lg mb-3">حول التطبيق</h2>
        <div className="text-sm space-y-1">
          <div className="flex justify-between"><span>الإصدار:</span><b>1.0.0 (Web MVP)</b></div>
          <div className="flex justify-between"><span>المحرك:</span><b>Optimum Score Engine v1</b></div>
          <div className="flex justify-between"><span>التخزين:</span><b>محلي (localStorage)</b></div>
          <div className="flex justify-between"><span>الاتصال:</span><b>بدون إنترنت - بيانات محلية</b></div>
        </div>
        <div className="text-xs text-gray-400 mt-3">
          تطبيق المدير الديناميكي للمحفظة الاستثمارية. يعتمد على نموذج Optimum Score
          لتوليد إشارات شراء وبيع. جميع البيانات مخزنة محلياً في متصفحك.
        </div>
      </div>
    </div>
  );
}
