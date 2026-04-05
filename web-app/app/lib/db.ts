/**
 * طبقة قاعدة البيانات - Supabase مع fallback إلى localStorage
 * إذا تم تكوين Supabase → يخزن في قاعدة البيانات السحابية
 * إذا لم يتم تكوينه → يخزن في localStorage (كما كان)
 */

import { getSupabase } from './supabaseClient';
import { Asset, InvestorProfile, Trade, PriceRecord, SystemSettings, DEFAULT_SYSTEM_SETTINGS, PositionBuildingPlan, Tranche, TrancheNotification } from './types';

const sb = () => getSupabase();

// ============ الملف الاستثماري ============

export async function dbGetProfile(): Promise<InvestorProfile | null> {
  const client = sb();
  if (!client) return localGet<InvestorProfile>('portfolio_profile');
  const { data } = await client.from('investor_profile').select('*').eq('id', 'default').single();
  if (!data) return null;
  return {
    riskScore: data.risk_score,
    profileType: data.profile_type,
    stocksWeight: data.stocks_weight,
    cryptoWeight: data.crypto_weight,
    bondsWeight: data.bonds_weight,
    commoditiesWeight: data.commodities_weight,
    realEstateWeight: data.real_estate_weight,
    cashWeight: data.cash_weight,
    availableCash: data.available_cash,
  };
}

export async function dbSaveProfile(p: InvestorProfile): Promise<void> {
  const client = sb();
  if (!client) { localSet('portfolio_profile', p); return; }
  await client.from('investor_profile').upsert({
    id: 'default',
    risk_score: p.riskScore,
    profile_type: p.profileType,
    stocks_weight: p.stocksWeight,
    crypto_weight: p.cryptoWeight,
    bonds_weight: p.bondsWeight,
    commodities_weight: p.commoditiesWeight,
    real_estate_weight: p.realEstateWeight,
    cash_weight: p.cashWeight,
    available_cash: p.availableCash,
    updated_at: new Date().toISOString(),
  });
}

// ============ الأصول ============

export async function dbGetAssets(): Promise<Asset[]> {
  const client = sb();
  if (!client) return localGet<Asset[]>('portfolio_assets') || [];
  const { data } = await client.from('assets').select('*').order('created_at');
  if (!data) return [];
  return data.map(r => ({
    id: r.id,
    name: r.name,
    category: r.category,
    quantity: r.quantity,
    purchasePrice: r.purchase_price,
    purchaseDate: r.purchase_date,
    currentPrice: r.current_price,
    targetWeight: r.target_weight,
  }));
}

export async function dbAddAsset(a: Asset): Promise<string> {
  const client = sb();
  const id = a.id || crypto.randomUUID();
  if (!client) {
    const assets = localGet<Asset[]>('portfolio_assets') || [];
    assets.push({ ...a, id });
    localSet('portfolio_assets', assets);
    return id;
  }
  await client.from('assets').insert({
    id, name: a.name, category: a.category, quantity: a.quantity,
    purchase_price: a.purchasePrice, purchase_date: a.purchaseDate,
    current_price: a.currentPrice, target_weight: a.targetWeight,
  });
  return id;
}

export async function dbUpdateAsset(a: Asset): Promise<void> {
  const client = sb();
  if (!client) {
    const assets = (localGet<Asset[]>('portfolio_assets') || []).map(x => x.id === a.id ? a : x);
    localSet('portfolio_assets', assets);
    return;
  }
  await client.from('assets').update({
    name: a.name, category: a.category, quantity: a.quantity,
    purchase_price: a.purchasePrice, purchase_date: a.purchaseDate,
    current_price: a.currentPrice, target_weight: a.targetWeight,
    updated_at: new Date().toISOString(),
  }).eq('id', a.id);
}

export async function dbDeleteAsset(id: string): Promise<void> {
  const client = sb();
  if (!client) {
    localSet('portfolio_assets', (localGet<Asset[]>('portfolio_assets') || []).filter(a => a.id !== id));
    return;
  }
  await client.from('assets').delete().eq('id', id);
}

// ============ الأسعار التاريخية ============

export async function dbGetPriceHistory(assetId: string): Promise<PriceRecord[]> {
  const client = sb();
  if (!client) {
    const all = localGet<Record<string, PriceRecord[]>>('portfolio_prices') || {};
    return all[assetId] || [];
  }
  const { data } = await client.from('price_history').select('date, close_price')
    .eq('asset_id', assetId).order('date');
  return (data || []).map(r => ({ date: r.date, close: r.close_price }));
}

export async function dbSetPriceHistory(assetId: string, records: PriceRecord[]): Promise<void> {
  const client = sb();
  if (!client) {
    const all = localGet<Record<string, PriceRecord[]>>('portfolio_prices') || {};
    all[assetId] = records.sort((a, b) => a.date.localeCompare(b.date));
    localSet('portfolio_prices', all);
    return;
  }
  await client.from('price_history').delete().eq('asset_id', assetId);
  if (records.length > 0) {
    const rows = records.map(r => ({ asset_id: assetId, date: r.date, close_price: r.close }));
    // Supabase limit: insert in batches of 500
    for (let i = 0; i < rows.length; i += 500) {
      await client.from('price_history').insert(rows.slice(i, i + 500));
    }
  }
}

export async function dbAddPriceRecord(assetId: string, record: PriceRecord): Promise<void> {
  const client = sb();
  if (!client) {
    const all = localGet<Record<string, PriceRecord[]>>('portfolio_prices') || {};
    if (!all[assetId]) all[assetId] = [];
    all[assetId].push(record);
    all[assetId].sort((a, b) => a.date.localeCompare(b.date));
    localSet('portfolio_prices', all);
    return;
  }
  await client.from('price_history').upsert({
    asset_id: assetId, date: record.date, close_price: record.close,
  }, { onConflict: 'asset_id,date' });
}

export async function dbGetPriceList(assetId: string): Promise<number[]> {
  const records = await dbGetPriceHistory(assetId);
  return records.map(r => r.close);
}

// ============ الصفقات ============

export async function dbGetTrades(): Promise<Trade[]> {
  const client = sb();
  if (!client) return localGet<Trade[]>('portfolio_trades') || [];
  const { data } = await client.from('trades').select('*').order('created_at', { ascending: false });
  return (data || []).map(r => ({
    id: r.id, assetId: r.asset_id, assetName: r.asset_name,
    type: r.type, quantity: r.quantity, price: r.price,
    totalValue: r.total_value, date: r.date,
  }));
}

export async function dbAddTrade(t: Omit<Trade, 'id'>): Promise<void> {
  const client = sb();
  const id = crypto.randomUUID();
  if (!client) {
    const trades = localGet<Trade[]>('portfolio_trades') || [];
    trades.unshift({ ...t, id } as Trade);
    localSet('portfolio_trades', trades);
    return;
  }
  await client.from('trades').insert({
    id, asset_id: t.assetId, asset_name: t.assetName,
    type: t.type, quantity: t.quantity, price: t.price,
    total_value: t.totalValue, date: t.date,
  });
}

// ============ إعدادات النظام ============

export async function dbGetSystemSettings(): Promise<SystemSettings> {
  const client = sb();
  if (!client) {
    const data = localGet<SystemSettings>('portfolio_system_settings');
    return data ? { ...DEFAULT_SYSTEM_SETTINGS, ...data } : { ...DEFAULT_SYSTEM_SETTINGS };
  }
  const { data } = await client.from('system_settings').select('*');
  if (!data || data.length === 0) return { ...DEFAULT_SYSTEM_SETTINGS };
  const settings = { ...DEFAULT_SYSTEM_SETTINGS };
  for (const row of data) {
    try {
      (settings as Record<string, unknown>)[row.key] = JSON.parse(row.value);
    } catch { /* skip */ }
  }
  return settings;
}

export async function dbSaveSystemSettings(s: SystemSettings): Promise<void> {
  const client = sb();
  if (!client) { localSet('portfolio_system_settings', s); return; }
  const rows = Object.entries(s).map(([key, value]) => ({
    key, value: JSON.stringify(value),
  }));
  await client.from('system_settings').upsert(rows, { onConflict: 'key' });
}

// ============ خطط بناء المراكز ============

export async function dbGetPlans(): Promise<PositionBuildingPlan[]> {
  const client = sb();
  if (!client) return localGet<PositionBuildingPlan[]>('portfolio_plans') || [];
  const { data: plans } = await client.from('position_plans').select('*').order('created_at');
  if (!plans || plans.length === 0) return [];

  const { data: allTranches } = await client.from('tranches').select('*').order('number');

  return plans.map(p => ({
    id: p.id, assetName: p.asset_name, assetCategory: p.asset_category,
    assetId: p.asset_id, totalTargetValue: p.total_target_value,
    numTranches: p.num_tranches, strategy: p.strategy, horizonDays: p.horizon_days,
    currentPrice: p.current_price, riskRewardRatio: p.risk_reward_ratio,
    optimumScore: p.optimum_score, status: p.status,
    createdAt: p.created_at?.split('T')[0] || '', lastReview: p.last_review?.split('T')[0] || '',
    tranches: (allTranches || []).filter(t => t.plan_id === p.id).map(t => ({
      id: t.id, planId: t.plan_id, number: t.number, value: t.value,
      targetDate: t.target_date, minPrice: t.min_price, executed: t.executed,
      executedPrice: t.executed_price, executedDate: t.executed_date,
    })),
  }));
}

export async function dbAddPlan(plan: PositionBuildingPlan): Promise<void> {
  const client = sb();
  if (!client) {
    const plans = localGet<PositionBuildingPlan[]>('portfolio_plans') || [];
    plans.push(plan);
    localSet('portfolio_plans', plans);
    return;
  }
  await client.from('position_plans').insert({
    id: plan.id, asset_name: plan.assetName, asset_category: plan.assetCategory,
    asset_id: plan.assetId, total_target_value: plan.totalTargetValue,
    num_tranches: plan.numTranches, strategy: plan.strategy,
    horizon_days: plan.horizonDays, current_price: plan.currentPrice,
    risk_reward_ratio: plan.riskRewardRatio, optimum_score: plan.optimumScore,
    status: plan.status,
  });
  if (plan.tranches.length > 0) {
    await client.from('tranches').insert(plan.tranches.map(t => ({
      id: t.id, plan_id: t.planId, number: t.number, value: t.value,
      target_date: t.targetDate, min_price: t.minPrice,
      executed: t.executed, executed_price: t.executedPrice, executed_date: t.executedDate,
    })));
  }
}

export async function dbUpdatePlan(plan: PositionBuildingPlan): Promise<void> {
  const client = sb();
  if (!client) {
    const plans = (localGet<PositionBuildingPlan[]>('portfolio_plans') || []).map(p => p.id === plan.id ? plan : p);
    localSet('portfolio_plans', plans);
    return;
  }
  await client.from('position_plans').update({
    status: plan.status, last_review: new Date().toISOString(),
  }).eq('id', plan.id);
  // تحديث الدفعات
  for (const t of plan.tranches) {
    await client.from('tranches').update({
      value: t.value, executed: t.executed,
      executed_price: t.executedPrice, executed_date: t.executedDate,
    }).eq('id', t.id);
  }
}

export async function dbDeletePlan(id: string): Promise<void> {
  const client = sb();
  if (!client) {
    localSet('portfolio_plans', (localGet<PositionBuildingPlan[]>('portfolio_plans') || []).filter(p => p.id !== id));
    return;
  }
  await client.from('position_plans').delete().eq('id', id);
}

// ============ localStorage helpers ============

function localGet<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(key);
  if (!data) return null;
  try { return JSON.parse(data); } catch { return null; }
}

function localSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}
