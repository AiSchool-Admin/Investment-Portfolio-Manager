/**
 * نظام التنبيهات الاستباقية
 * يفحص كل الأصول عند بدء التشغيل ويولّد تنبيهات ذكية
 */

import { Asset, TradingSignal, SystemSettings, PositionBuildingPlan, PriceRecord } from './types';

export interface ProactiveAlert {
  id: string;
  type: 'opportunity' | 'risk' | 'action' | 'info';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  assetName?: string;
  actionLabel?: string;
  actionTab?: string; // التبويب المطلوب فتحه
}

// ============ توليد كل التنبيهات ============

export function generateProactiveAlerts(
  assets: Asset[],
  signals: TradingSignal[],
  plans: PositionBuildingPlan[],
  settings: SystemSettings,
  availableCash: number,
  priceHistories?: Record<string, PriceRecord[]>,
): ProactiveAlert[] {
  const alerts: ProactiveAlert[] = [];
  const today = new Date();

  // 0. بيانات قديمة - تذكير بتحديث الأسعار
  if (priceHistories) {
    for (const a of assets) {
      const history = priceHistories[a.id];
      if (!history || history.length === 0) continue;
      const lastDate = new Date(history[history.length - 1].date);
      const daysSinceUpdate = Math.ceil((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceUpdate > 7) {
        alerts.push({
          id: `stale-${a.id}`,
          type: 'action',
          severity: daysSinceUpdate > 30 ? 'high' : 'medium',
          title: `بيانات قديمة: ${a.name}`,
          message: `آخر تحديث منذ ${daysSinceUpdate} يوم (${history[history.length - 1].date}). حدّث الأسعار لإشارات دقيقة.`,
          assetName: a.name,
          actionLabel: 'تحديث',
          actionTab: 'assets',
        });
      }
    }
  }

  // 1. فرص شراء قوية (OS عالي + ثقة عالية)
  for (const s of signals) {
    if (s.signalType === 'buy' && s.confidence >= 0.6 && s.optimumScore >= 0.75) {
      alerts.push({
        id: `opp-buy-${s.assetId}`,
        type: 'opportunity',
        severity: s.confidence >= 0.8 ? 'critical' : 'high',
        title: `فرصة شراء قوية: ${s.assetName}`,
        message: `OS ${(s.optimumScore * 100).toFixed(0)}% | ثقة ${(s.confidence * 100).toFixed(0)}% | ${s.reasons[0] || ''}`,
        assetName: s.assetName,
        actionLabel: 'عرض الإشارة',
        actionTab: 'signals',
      });
    }
  }

  // 2. تحذيرات بيع قوية
  for (const s of signals) {
    if (s.signalType === 'sell' && s.confidence >= 0.6 && s.optimumScore <= 0.25) {
      alerts.push({
        id: `risk-sell-${s.assetId}`,
        type: 'risk',
        severity: s.confidence >= 0.8 ? 'critical' : 'high',
        title: `تحذير بيع: ${s.assetName}`,
        message: `OS ${(s.optimumScore * 100).toFixed(0)}% | ثقة ${(s.confidence * 100).toFixed(0)}% | ${s.reasons[0] || ''}`,
        assetName: s.assetName,
        actionLabel: 'عرض الإشارة',
        actionTab: 'signals',
      });
    }
  }

  // 3. RSI متطرف (تشبع بيعي = فرصة، تشبع شرائي = خطر)
  for (const s of signals) {
    if (s.factors.rsi < 25) {
      alerts.push({
        id: `rsi-low-${s.assetId}`,
        type: 'opportunity',
        severity: 'high',
        title: `تشبع بيعي شديد: ${s.assetName}`,
        message: `RSI = ${s.factors.rsi.toFixed(0)} (أقل من 25) - قد يكون فرصة ارتداد`,
        assetName: s.assetName,
        actionTab: 'signals',
      });
    }
    if (s.factors.rsi > 80) {
      alerts.push({
        id: `rsi-high-${s.assetId}`,
        type: 'risk',
        severity: 'high',
        title: `تشبع شرائي شديد: ${s.assetName}`,
        message: `RSI = ${s.factors.rsi.toFixed(0)} (أكثر من 80) - قد ينخفض قريباً`,
        assetName: s.assetName,
        actionTab: 'signals',
      });
    }
  }

  // 4. تقلب مرتفع جداً
  for (const s of signals) {
    if (s.volatility > 0.5) {
      alerts.push({
        id: `vol-high-${s.assetId}`,
        type: 'risk',
        severity: 'medium',
        title: `تقلب مرتفع: ${s.assetName}`,
        message: `التقلب السنوي ${(s.volatility * 100).toFixed(0)}% - مخاطرة عالية`,
        assetName: s.assetName,
      });
    }
  }

  // 5. Trailing Stop قريب من التفعيل
  for (const s of signals) {
    const asset = assets.find(a => a.id === s.assetId);
    if (!asset) continue;
    const profitPct = asset.purchasePrice > 0 ? (s.currentPrice - asset.purchasePrice) / asset.purchasePrice : 0;
    if (profitPct > settings.trailingStopProfitTrigger * 0.8 && profitPct < settings.trailingStopProfitTrigger) {
      alerts.push({
        id: `ts-near-${s.assetId}`,
        type: 'info',
        severity: 'medium',
        title: `Trailing Stop قريب: ${s.assetName}`,
        message: `ربح ${(profitPct * 100).toFixed(1)}% - يقترب من عتبة التفعيل (${(settings.trailingStopProfitTrigger * 100).toFixed(0)}%)`,
        assetName: s.assetName,
      });
    }
  }

  // 6. أصول بدون بيانات تاريخية كافية
  for (const a of assets) {
    // لا نملك عدد السجلات هنا مباشرة، لكن إذا الأصل ليس في الإشارات = بيانات غير كافية
    const hasSignal = signals.some(s => s.assetId === a.id);
    if (!hasSignal && a.quantity > 0) {
      alerts.push({
        id: `data-missing-${a.id}`,
        type: 'action',
        severity: 'medium',
        title: `بيانات ناقصة: ${a.name}`,
        message: `لا توجد بيانات تاريخية كافية لتوليد إشارات. استورد CSV.`,
        assetName: a.name,
        actionLabel: 'تحديث البيانات',
        actionTab: 'assets',
      });
    }
  }

  // 7. نقد كبير غير مستثمر
  const totalValue = assets.reduce((s, a) => s + a.quantity * a.currentPrice, 0) + availableCash;
  if (totalValue > 0) {
    const cashRatio = availableCash / totalValue;
    if (cashRatio > 0.3 && availableCash > 1000) {
      alerts.push({
        id: 'cash-idle',
        type: 'opportunity',
        severity: 'medium',
        title: 'نقد كبير غير مستثمر',
        message: `${(cashRatio * 100).toFixed(0)}% من المحفظة نقد ($${availableCash.toFixed(0)}). فرصة لاستثمار جزء منه.`,
        actionLabel: 'بناء مركز جديد',
        actionTab: 'builder',
      });
    }
  }

  // 8. دفعات بناء مراكز مستحقة
  const activePlans = plans.filter(p => p.status === 'active');
  for (const plan of activePlans) {
    const nextTranche = plan.tranches.find(t => !t.executed);
    if (nextTranche) {
      const targetDate = new Date(nextTranche.targetDate);
      const daysUntil = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 3 && daysUntil >= 0) {
        alerts.push({
          id: `tranche-due-${plan.id}-${nextTranche.number}`,
          type: 'action',
          severity: daysUntil <= 1 ? 'critical' : 'high',
          title: `دفعة مستحقة: ${plan.assetName}`,
          message: `الدفعة #${nextTranche.number} بقيمة $${nextTranche.value.toFixed(0)} ${daysUntil === 0 ? 'اليوم' : `خلال ${daysUntil} يوم`}`,
          assetName: plan.assetName,
          actionLabel: 'متابعة البناء',
          actionTab: 'builder',
        });
      } else if (daysUntil < 0) {
        alerts.push({
          id: `tranche-overdue-${plan.id}-${nextTranche.number}`,
          type: 'action',
          severity: 'critical',
          title: `دفعة متأخرة: ${plan.assetName}`,
          message: `الدفعة #${nextTranche.number} بقيمة $${nextTranche.value.toFixed(0)} متأخرة ${Math.abs(daysUntil)} يوم`,
          assetName: plan.assetName,
          actionLabel: 'تنفيذ الدفعة',
          actionTab: 'builder',
        });
      }
    }
  }

  // 9. اتجاه تغيّر (أصل كان صاعد وأصبح هابط أو العكس)
  for (const s of signals) {
    if (s.factors.trend < 0 && s.factors.momentum < -0.3) {
      alerts.push({
        id: `trend-reversal-down-${s.assetId}`,
        type: 'risk',
        severity: 'high',
        title: `انعكاس هبوطي: ${s.assetName}`,
        message: `الاتجاه هابط مع زخم سلبي ${(s.factors.momentum * 100).toFixed(0)}% - راقب عن كثب`,
        assetName: s.assetName,
        actionTab: 'signals',
      });
    }
    if (s.factors.trend > 0 && s.factors.momentum > 0.3 && s.optimumScore >= 0.6) {
      alerts.push({
        id: `trend-strong-up-${s.assetId}`,
        type: 'opportunity',
        severity: 'medium',
        title: `زخم صاعد قوي: ${s.assetName}`,
        message: `اتجاه صاعد مع زخم +${(s.factors.momentum * 100).toFixed(0)}% وOS ${(s.optimumScore * 100).toFixed(0)}%`,
        assetName: s.assetName,
        actionTab: 'signals',
      });
    }
  }

  // ترتيب حسب الأهمية
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}
