'use client';

import { useState, useMemo } from 'react';
import { getPlans, updatePlan, deletePlan, getProfile, addTrade, saveProfile, getNotifications, markNotificationRead, addNotification } from '../lib/store';
import { PositionBuildingPlan, TrancheNotification } from '../lib/types';
import { executeTranche, replanRemainingTranches, checkTrancheNotifications } from '../lib/positionBuilder';
import NewAssetWizard from './NewAssetWizard';

export default function PositionBuilderPage({ onRefresh }: { onRefresh: () => void }) {
  const [plans, setPlans] = useState(getPlans);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showReplan, setShowReplan] = useState(false);
  const [replanCash, setReplanCash] = useState('');
  const [notifications, setNotifications] = useState(getNotifications);
  const [executeTrancheNum, setExecuteTrancheNum] = useState<number | null>(null);
  const [executePrice, setExecutePrice] = useState('');

  const profile = getProfile();
  const activePlans = plans.filter(p => p.status === 'active');
  const completedPlans = plans.filter(p => p.status === 'completed');
  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  // فحص الإشعارات عند التحميل
  useMemo(() => {
    const newNotifs = checkTrancheNotifications(activePlans);
    for (const n of newNotifs) {
      addNotification(n);
    }
    if (newNotifs.length > 0) setNotifications(getNotifications());
  }, [activePlans.length]);

  const unreadNotifs = notifications.filter(n => !n.read);

  const reload = () => {
    setPlans(getPlans());
    setNotifications(getNotifications());
    onRefresh();
  };

  // تنفيذ دفعة
  const handleExecuteTranche = (plan: PositionBuildingPlan, trancheNum: number) => {
    const price = parseFloat(executePrice);
    if (!price || price <= 0) return alert('أدخل سعر التنفيذ');

    const tranche = plan.tranches.find(t => t.number === trancheNum);
    if (!tranche) return;

    // تنفيذ الدفعة
    const updatedPlan = executeTranche(plan, trancheNum, price);
    updatePlan(updatedPlan);

    // تسجيل صفقة
    const qty = tranche.value / price;
    addTrade({
      assetId: plan.assetId || '',
      assetName: plan.assetName,
      type: 'buy',
      quantity: qty,
      price,
      totalValue: tranche.value,
      date: new Date().toISOString().split('T')[0],
    });

    // خصم من النقد
    if (profile) {
      saveProfile({ ...profile, availableCash: Math.max(0, profile.availableCash - tranche.value) });
    }

    setExecuteTrancheNum(null);
    setExecutePrice('');
    reload();
  };

  // إعادة التخطيط
  const handleReplan = (plan: PositionBuildingPlan) => {
    const cash = parseFloat(replanCash);
    if (!cash || cash <= 0) return alert('أدخل قيمة النقد المتاح');
    const updated = replanRemainingTranches(plan, cash);
    updatePlan(updated);
    setShowReplan(false);
    setReplanCash('');
    reload();
  };

  // حذف خطة
  const handleDelete = (planId: string) => {
    if (!confirm('هل تريد حذف هذه الخطة؟')) return;
    deletePlan(planId);
    setSelectedPlanId(null);
    reload();
  };

  // إيقاف/تفعيل خطة
  const togglePause = (plan: PositionBuildingPlan) => {
    const updated = { ...plan, status: plan.status === 'active' ? 'paused' as const : 'active' as const };
    updatePlan(updated);
    reload();
  };

  if (showWizard) {
    return (
      <NewAssetWizard
        onComplete={() => { setShowWizard(false); reload(); }}
        onCancel={() => setShowWizard(false)}
      />
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">بناء المراكز</h1>
        <button className="btn-primary" onClick={() => setShowWizard(true)}>+ بناء أصل جديد</button>
      </div>

      {/* الإشعارات */}
      {unreadNotifs.length > 0 && (
        <div className="mb-4">
          {unreadNotifs.slice(0, 3).map(n => (
            <div key={n.id} className="card mb-2 flex items-center gap-3" style={{ background: 'var(--warning-bg)' }}>
              <span className="text-xl">🔔</span>
              <div className="flex-1 text-sm">{n.message}</div>
              <button
                className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                onClick={() => { markNotificationRead(n.id); setNotifications(getNotifications()); }}
              >
                تجاهل
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ملخص */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card text-center">
          <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>{activePlans.length}</div>
          <div className="text-sm text-gray-500">خطط نشطة</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-green-600">{completedPlans.length}</div>
          <div className="text-sm text-gray-500">مكتملة</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold">
            {activePlans.reduce((s, p) => s + p.tranches.filter(t => !t.executed).length, 0)}
          </div>
          <div className="text-sm text-gray-500">دفعات معلقة</div>
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="text-center text-gray-400 py-16">
          <div className="text-5xl mb-4">🏗️</div>
          <div className="text-lg">لا توجد خطط بناء</div>
          <div className="text-sm mt-2">اضغط &quot;بناء أصل جديد&quot; لإنشاء خطة شراء مُهيكلة</div>
        </div>
      ) : (
        <div>
          {/* قائمة الخطط النشطة */}
          {activePlans.length > 0 && (
            <>
              <h2 className="text-lg font-bold mb-3">الخطط النشطة</h2>
              {activePlans.map(plan => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isSelected={selectedPlanId === plan.id}
                  onClick={() => setSelectedPlanId(selectedPlanId === plan.id ? null : plan.id)}
                />
              ))}
            </>
          )}

          {/* الخطط المكتملة */}
          {completedPlans.length > 0 && (
            <>
              <h2 className="text-lg font-bold mb-3 mt-6 text-green-700">الخطط المكتملة</h2>
              {completedPlans.map(plan => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isSelected={selectedPlanId === plan.id}
                  onClick={() => setSelectedPlanId(selectedPlanId === plan.id ? null : plan.id)}
                />
              ))}
            </>
          )}

          {/* الخطط الموقوفة */}
          {plans.filter(p => p.status === 'paused').length > 0 && (
            <>
              <h2 className="text-lg font-bold mb-3 mt-6 text-gray-500">خطط موقوفة</h2>
              {plans.filter(p => p.status === 'paused').map(plan => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isSelected={selectedPlanId === plan.id}
                  onClick={() => setSelectedPlanId(selectedPlanId === plan.id ? null : plan.id)}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* تفاصيل الخطة المختارة */}
      {selectedPlan && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50" onClick={() => setSelectedPlanId(null)}>
          <div className="card w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl md:rounded-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 rounded mx-auto mb-4" />

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{selectedPlan.assetName}</h2>
              <span className={`text-xs px-2 py-1 rounded-full ${
                selectedPlan.status === 'active' ? 'bg-green-100 text-green-700' :
                selectedPlan.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {selectedPlan.status === 'active' ? 'نشطة' : selectedPlan.status === 'completed' ? 'مكتملة' : 'موقوفة'}
              </span>
            </div>

            {/* معلومات الخطة */}
            <div className="grid grid-cols-3 gap-2 text-sm mb-4">
              <div className="p-2 rounded bg-gray-50 text-center">
                <div className="text-gray-400 text-xs">الهدف</div>
                <div className="font-bold">${selectedPlan.totalTargetValue.toFixed(2)}</div>
              </div>
              <div className="p-2 rounded bg-gray-50 text-center">
                <div className="text-gray-400 text-xs">المنفذ</div>
                <div className="font-bold text-green-600">
                  ${selectedPlan.tranches.filter(t => t.executed).reduce((s, t) => s + t.value, 0).toFixed(2)}
                </div>
              </div>
              <div className="p-2 rounded bg-gray-50 text-center">
                <div className="text-gray-400 text-xs">المتبقي</div>
                <div className="font-bold text-orange-600">
                  ${selectedPlan.tranches.filter(t => !t.executed).reduce((s, t) => s + t.value, 0).toFixed(2)}
                </div>
              </div>
            </div>

            {/* شريط التقدم */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>التقدم</span>
                <span>{selectedPlan.tranches.filter(t => t.executed).length}/{selectedPlan.numTranches}</span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(selectedPlan.tranches.filter(t => t.executed).length / selectedPlan.numTranches) * 100}%`,
                    background: 'var(--primary)',
                  }}
                />
              </div>
            </div>

            {/* جدول الدفعات */}
            <h3 className="font-bold mb-2">الدفعات</h3>
            <div className="mb-4">
              {selectedPlan.tranches.map(t => (
                <div key={t.number} className={`flex items-center gap-2 py-2 border-b border-gray-50 text-sm ${
                  t.executed ? 'opacity-60' : ''
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${
                    t.executed ? 'bg-green-500' : 'bg-gray-300'
                  }`}>
                    {t.executed ? '✓' : t.number}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold">${t.value.toFixed(2)}</div>
                    <div className="text-xs text-gray-400">
                      {t.targetDate}
                      {t.minPrice && ` | هدف: $${t.minPrice.toFixed(2)}`}
                    </div>
                  </div>
                  {t.executed ? (
                    <div className="text-xs text-green-600">
                      تم @ ${t.executedPrice?.toFixed(2)} ({t.executedDate})
                    </div>
                  ) : selectedPlan.status === 'active' && (
                    <button
                      className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 cursor-pointer hover:bg-green-200"
                      onClick={() => { setExecuteTrancheNum(t.number); setExecutePrice(selectedPlan.currentPrice.toString()); }}
                    >
                      تنفيذ
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* نموذج تنفيذ الدفعة */}
            {executeTrancheNum !== null && (
              <div className="card mb-4" style={{ background: 'var(--primary-bg)' }}>
                <h4 className="font-bold mb-2">تنفيذ الدفعة #{executeTrancheNum}</h4>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    type="number"
                    placeholder="سعر التنفيذ"
                    value={executePrice}
                    onChange={e => setExecutePrice(e.target.value)}
                  />
                  <button
                    className="btn-primary text-sm"
                    onClick={() => handleExecuteTranche(selectedPlan, executeTrancheNum)}
                  >
                    تأكيد ✓
                  </button>
                  <button className="btn-outline text-sm" onClick={() => setExecuteTrancheNum(null)}>
                    إلغاء
                  </button>
                </div>
              </div>
            )}

            {/* إعادة التخطيط */}
            {showReplan ? (
              <div className="card mb-4" style={{ background: 'var(--warning-bg)' }}>
                <h4 className="font-bold mb-2">إعادة التخطيط</h4>
                <p className="text-xs text-gray-500 mb-2">أدخل النقد المتاح الجديد لإعادة حساب الدفعات المتبقية</p>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    type="number"
                    placeholder="النقد المتاح"
                    value={replanCash}
                    onChange={e => setReplanCash(e.target.value)}
                  />
                  <button className="btn-primary text-sm" onClick={() => handleReplan(selectedPlan)}>
                    إعادة حساب
                  </button>
                  <button className="btn-outline text-sm" onClick={() => setShowReplan(false)}>إلغاء</button>
                </div>
              </div>
            ) : null}

            {/* أزرار الإجراءات */}
            <div className="flex flex-wrap gap-2">
              {selectedPlan.status === 'active' && (
                <>
                  <button className="btn-outline text-sm flex-1" onClick={() => setShowReplan(true)}>
                    إعادة التخطيط
                  </button>
                  <button className="btn-outline text-sm flex-1" onClick={() => { togglePause(selectedPlan); setSelectedPlanId(null); }}>
                    إيقاف مؤقت
                  </button>
                </>
              )}
              {selectedPlan.status === 'paused' && (
                <button className="btn-primary text-sm flex-1" onClick={() => { togglePause(selectedPlan); setSelectedPlanId(null); }}>
                  استئناف
                </button>
              )}
              <button className="text-sm px-3 py-2 rounded text-red-600 hover:bg-red-50 cursor-pointer" onClick={() => handleDelete(selectedPlan.id)}>
                حذف
              </button>
            </div>

            {/* معلومات إضافية */}
            <div className="mt-4 pt-3 border-t border-border text-xs text-gray-400">
              <div className="flex justify-between"><span>الاستراتيجية:</span><b>{selectedPlan.strategy}</b></div>
              <div className="flex justify-between"><span>R:R Ratio:</span><b>{selectedPlan.riskRewardRatio}</b></div>
              <div className="flex justify-between"><span>OS:</span><b>{(selectedPlan.optimumScore * 100).toFixed(0)}%</b></div>
              <div className="flex justify-between"><span>تاريخ الإنشاء:</span><b>{selectedPlan.createdAt}</b></div>
              <div className="flex justify-between"><span>آخر مراجعة:</span><b>{selectedPlan.lastReview}</b></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ بطاقة خطة ============

function PlanCard({ plan, isSelected, onClick }: {
  plan: PositionBuildingPlan;
  isSelected: boolean;
  onClick: () => void;
}) {
  const executedCount = plan.tranches.filter(t => t.executed).length;
  const executedValue = plan.tranches.filter(t => t.executed).reduce((s, t) => s + t.value, 0);
  const progress = executedCount / plan.numTranches;

  // الدفعة التالية
  const nextTranche = plan.tranches.find(t => !t.executed);

  return (
    <div
      className={`card mb-2 cursor-pointer hover:shadow-md transition-all ${isSelected ? 'ring-2' : ''}`}
      style={isSelected ? { borderColor: 'var(--primary)' } : {}}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm"
          style={{ background: plan.status === 'active' ? 'var(--primary)' : plan.status === 'completed' ? '#22c55e' : '#9ca3af' }}
        >
          {plan.assetName.slice(0, 3)}
        </div>
        <div className="flex-1">
          <div className="font-bold">{plan.assetName}</div>
          <div className="text-xs text-gray-500">
            {plan.strategy} | {plan.assetCategory} | {executedCount}/{plan.numTranches} دفعات
          </div>
        </div>
        <div className="text-left">
          <div className="font-bold">${executedValue.toFixed(0)}</div>
          <div className="text-xs text-gray-500">من ${plan.totalTargetValue.toFixed(0)}</div>
        </div>
      </div>

      {/* شريط التقدم */}
      <div className="mt-2">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{
            width: `${progress * 100}%`,
            background: plan.status === 'completed' ? '#22c55e' : 'var(--primary)',
          }} />
        </div>
      </div>

      {/* الدفعة التالية */}
      {nextTranche && plan.status === 'active' && (
        <div className="mt-2 text-xs text-gray-500 flex justify-between">
          <span>الدفعة التالية: ${nextTranche.value.toFixed(2)} في {nextTranche.targetDate}</span>
          {nextTranche.minPrice && <span>هدف: ${nextTranche.minPrice.toFixed(2)}</span>}
        </div>
      )}
    </div>
  );
}
