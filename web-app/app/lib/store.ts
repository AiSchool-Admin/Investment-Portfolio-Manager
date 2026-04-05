/**
 * تخزين البيانات - Supabase (قاعدة بيانات سحابية) + localStorage (كاش محلي)
 * عند الكتابة: يحفظ في localStorage فوراً + Supabase في الخلفية
 * عند بدء التشغيل: يسحب من Supabase ويحدّث localStorage
 */

import { Asset, InvestorProfile, Trade, PriceRecord, SystemSettings, AssetSettings, DEFAULT_SYSTEM_SETTINGS, PositionBuildingPlan, TrancheNotification } from './types';
import { getSupabase } from './supabaseClient';

const KEYS = {
  profile: 'portfolio_profile',
  assets: 'portfolio_assets',
  trades: 'portfolio_trades',
  priceHistory: 'portfolio_prices',
  systemSettings: 'portfolio_system_settings',
  assetSettings: 'portfolio_asset_settings',
  plans: 'portfolio_plans',
  notifications: 'portfolio_notifications',
};

// ============ Supabase sync helper (fire-and-forget) ============

function sb() { return getSupabase(); }

function syncToSupabase(fn: () => Promise<void>) {
  const client = sb();
  if (!client) return;
  fn().catch(err => console.warn('Supabase sync error:', err));
}

// ============ سحب البيانات من Supabase عند بدء التشغيل ============

export async function syncFromSupabase(): Promise<boolean> {
  const client = sb();
  if (!client) return false;

  try {
    // سحب الملف الاستثماري
    const { data: profileData } = await client.from('investor_profile').select('*').eq('id', 'default').single();
    if (profileData) {
      const p: InvestorProfile = {
        riskScore: profileData.risk_score, profileType: profileData.profile_type,
        stocksWeight: profileData.stocks_weight, cryptoWeight: profileData.crypto_weight,
        bondsWeight: profileData.bonds_weight, commoditiesWeight: profileData.commodities_weight,
        realEstateWeight: profileData.real_estate_weight, cashWeight: profileData.cash_weight,
        availableCash: profileData.available_cash,
      };
      localStorage.setItem(KEYS.profile, JSON.stringify(p));
    }

    // سحب الأصول
    const { data: assetsData } = await client.from('assets').select('*').order('created_at');
    if (assetsData && assetsData.length > 0) {
      const assets: Asset[] = assetsData.map(r => ({
        id: r.id, name: r.name, category: r.category, quantity: r.quantity,
        purchasePrice: r.purchase_price, purchaseDate: r.purchase_date,
        currentPrice: r.current_price, targetWeight: r.target_weight,
      }));
      localStorage.setItem(KEYS.assets, JSON.stringify(assets));

      // سحب الأسعار التاريخية
      const { data: pricesData } = await client.from('price_history').select('*').order('date');
      if (pricesData) {
        const priceMap: Record<string, PriceRecord[]> = {};
        for (const r of pricesData) {
          if (!priceMap[r.asset_id]) priceMap[r.asset_id] = [];
          priceMap[r.asset_id].push({ date: r.date, close: r.close_price });
        }
        localStorage.setItem(KEYS.priceHistory, JSON.stringify(priceMap));
      }
    }

    // سحب الصفقات
    const { data: tradesData } = await client.from('trades').select('*').order('created_at', { ascending: false });
    if (tradesData && tradesData.length > 0) {
      const trades: Trade[] = tradesData.map(r => ({
        id: r.id, assetId: r.asset_id, assetName: r.asset_name,
        type: r.type, quantity: r.quantity, price: r.price,
        totalValue: r.total_value, date: r.date,
      }));
      localStorage.setItem(KEYS.trades, JSON.stringify(trades));
    }

    // سحب الإعدادات
    const { data: settingsData } = await client.from('system_settings').select('*');
    if (settingsData && settingsData.length > 0) {
      const settings: Record<string, unknown> = {};
      for (const r of settingsData) {
        try { settings[r.key] = JSON.parse(r.value); } catch { /* skip */ }
      }
      localStorage.setItem(KEYS.systemSettings, JSON.stringify(settings));
    }

    return true;
  } catch (err) {
    console.warn('Failed to sync from Supabase:', err);
    return false;
  }
}

// ============ الملف الاستثماري ============

export function saveProfile(profile: InvestorProfile): void {
  localStorage.setItem(KEYS.profile, JSON.stringify(profile));
  syncToSupabase(async () => {
    await sb()!.from('investor_profile').upsert({
      id: 'default', risk_score: profile.riskScore, profile_type: profile.profileType,
      stocks_weight: profile.stocksWeight, crypto_weight: profile.cryptoWeight,
      bonds_weight: profile.bondsWeight, commodities_weight: profile.commoditiesWeight,
      real_estate_weight: profile.realEstateWeight, cash_weight: profile.cashWeight,
      available_cash: profile.availableCash, updated_at: new Date().toISOString(),
    });
  });
}

export function getProfile(): InvestorProfile | null {
  const data = localStorage.getItem(KEYS.profile);
  return data ? JSON.parse(data) : null;
}

// ============ الأصول ============

export function getAssets(): Asset[] {
  const data = localStorage.getItem(KEYS.assets);
  return data ? JSON.parse(data) : [];
}

export function saveAssets(assets: Asset[]): void {
  localStorage.setItem(KEYS.assets, JSON.stringify(assets));
}

export function addAsset(asset: Asset): void {
  const id = asset.id || crypto.randomUUID();
  const newAsset = { ...asset, id };
  const assets = getAssets();
  assets.push(newAsset);
  saveAssets(assets);
  syncToSupabase(async () => {
    await sb()!.from('assets').insert({
      id, name: newAsset.name, category: newAsset.category, quantity: newAsset.quantity,
      purchase_price: newAsset.purchasePrice, purchase_date: newAsset.purchaseDate,
      current_price: newAsset.currentPrice, target_weight: newAsset.targetWeight,
    });
  });
}

export function updateAsset(updated: Asset): void {
  const assets = getAssets().map(a => a.id === updated.id ? updated : a);
  saveAssets(assets);
  syncToSupabase(async () => {
    await sb()!.from('assets').update({
      name: updated.name, category: updated.category, quantity: updated.quantity,
      purchase_price: updated.purchasePrice, purchase_date: updated.purchaseDate,
      current_price: updated.currentPrice, target_weight: updated.targetWeight,
      updated_at: new Date().toISOString(),
    }).eq('id', updated.id);
  });
}

export function deleteAsset(id: string): void {
  saveAssets(getAssets().filter(a => a.id !== id));
  const all = getAllPriceHistory();
  delete all[id];
  localStorage.setItem(KEYS.priceHistory, JSON.stringify(all));
  syncToSupabase(async () => {
    await sb()!.from('assets').delete().eq('id', id);
  });
}

// ============ الأسعار التاريخية ============

function getAllPriceHistory(): Record<string, PriceRecord[]> {
  const data = localStorage.getItem(KEYS.priceHistory);
  return data ? JSON.parse(data) : {};
}

export function getPriceHistory(assetId: string): PriceRecord[] {
  return getAllPriceHistory()[assetId] || [];
}

export function getPriceList(assetId: string): number[] {
  return getPriceHistory(assetId).map(p => p.close);
}

export function addPriceRecord(assetId: string, record: PriceRecord): void {
  const all = getAllPriceHistory();
  if (!all[assetId]) all[assetId] = [];
  all[assetId].push(record);
  all[assetId].sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem(KEYS.priceHistory, JSON.stringify(all));
  syncToSupabase(async () => {
    await sb()!.from('price_history').upsert(
      { asset_id: assetId, date: record.date, close_price: record.close },
      { onConflict: 'asset_id,date' }
    );
  });
}

export function setPriceHistory(assetId: string, records: PriceRecord[]): void {
  const all = getAllPriceHistory();
  all[assetId] = records.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem(KEYS.priceHistory, JSON.stringify(all));
  syncToSupabase(async () => {
    const client = sb()!;
    await client.from('price_history').delete().eq('asset_id', assetId);
    if (records.length > 0) {
      const rows = records.map(r => ({ asset_id: assetId, date: r.date, close_price: r.close }));
      for (let i = 0; i < rows.length; i += 500) {
        await client.from('price_history').insert(rows.slice(i, i + 500));
      }
    }
  });
}

// ============ الصفقات ============

export function getTrades(): Trade[] {
  const data = localStorage.getItem(KEYS.trades);
  return data ? JSON.parse(data) : [];
}

export function addTrade(trade: Omit<Trade, 'id'>): void {
  const id = crypto.randomUUID();
  const trades = getTrades();
  trades.unshift({ ...trade, id } as Trade);
  localStorage.setItem(KEYS.trades, JSON.stringify(trades));
  syncToSupabase(async () => {
    await sb()!.from('trades').insert({
      id, asset_id: trade.assetId, asset_name: trade.assetName,
      type: trade.type, quantity: trade.quantity, price: trade.price,
      total_value: trade.totalValue, date: trade.date,
    });
  });
}

// ============ إعدادات النظام ============

export function getSystemSettings(): SystemSettings {
  const data = localStorage.getItem(KEYS.systemSettings);
  if (data) return { ...DEFAULT_SYSTEM_SETTINGS, ...JSON.parse(data) };
  return { ...DEFAULT_SYSTEM_SETTINGS };
}

export function saveSystemSettings(settings: SystemSettings): void {
  localStorage.setItem(KEYS.systemSettings, JSON.stringify(settings));
  syncToSupabase(async () => {
    const rows = Object.entries(settings).map(([key, value]) => ({ key, value: JSON.stringify(value) }));
    await sb()!.from('system_settings').upsert(rows, { onConflict: 'key' });
  });
}

export function resetSystemSettings(): void {
  localStorage.removeItem(KEYS.systemSettings);
}

// ============ إعدادات الأصول الفردية ============

export function getAllAssetSettings(): AssetSettings[] {
  const data = localStorage.getItem(KEYS.assetSettings);
  return data ? JSON.parse(data) : [];
}

export function getAssetSettings(assetId: string): AssetSettings | null {
  return getAllAssetSettings().find(s => s.assetId === assetId) || null;
}

export function saveAssetSettings(settings: AssetSettings): void {
  const all = getAllAssetSettings().filter(s => s.assetId !== settings.assetId);
  all.push(settings);
  localStorage.setItem(KEYS.assetSettings, JSON.stringify(all));
}

export function deleteAssetSettings(assetId: string): void {
  const all = getAllAssetSettings().filter(s => s.assetId !== assetId);
  localStorage.setItem(KEYS.assetSettings, JSON.stringify(all));
}

export function getEffectiveSettings(assetId: string): SystemSettings {
  const sys = getSystemSettings();
  const asset = getAssetSettings(assetId);
  if (!asset) return sys;
  return {
    ...sys,
    alpha: asset.alpha ?? sys.alpha, beta: asset.beta ?? sys.beta,
    gamma: asset.gamma ?? sys.gamma, buyThreshold: asset.buyThreshold ?? sys.buyThreshold,
    sellThreshold: asset.sellThreshold ?? sys.sellThreshold, riskFreeRate: asset.riskFreeRate ?? sys.riskFreeRate,
    transactionCost: asset.transactionCost ?? sys.transactionCost, sellMode: asset.sellMode ?? sys.sellMode,
    buyOrderCashRatio: asset.buyOrderCashRatio ?? sys.buyOrderCashRatio,
    zScoreStrongBuy: asset.zScoreStrongBuy ?? sys.zScoreStrongBuy,
    zScoreStrongSell: asset.zScoreStrongSell ?? sys.zScoreStrongSell,
  };
}

// ============ خطط بناء المراكز ============

export function getPlans(): PositionBuildingPlan[] {
  const data = localStorage.getItem(KEYS.plans);
  return data ? JSON.parse(data) : [];
}

export function savePlans(plans: PositionBuildingPlan[]): void {
  localStorage.setItem(KEYS.plans, JSON.stringify(plans));
}

export function addPlan(plan: PositionBuildingPlan): void {
  const plans = getPlans();
  plans.push(plan);
  savePlans(plans);
  syncToSupabase(async () => {
    const client = sb()!;
    await client.from('position_plans').insert({
      id: plan.id, asset_name: plan.assetName, asset_category: plan.assetCategory,
      asset_id: plan.assetId, total_target_value: plan.totalTargetValue,
      num_tranches: plan.numTranches, strategy: plan.strategy, horizon_days: plan.horizonDays,
      current_price: plan.currentPrice, risk_reward_ratio: plan.riskRewardRatio,
      optimum_score: plan.optimumScore, status: plan.status,
    });
    if (plan.tranches.length > 0) {
      await client.from('tranches').insert(plan.tranches.map(t => ({
        id: t.id, plan_id: t.planId, number: t.number, value: t.value,
        target_date: t.targetDate, min_price: t.minPrice,
        executed: t.executed, executed_price: t.executedPrice, executed_date: t.executedDate,
      })));
    }
  });
}

export function updatePlan(updated: PositionBuildingPlan): void {
  const plans = getPlans().map(p => p.id === updated.id ? updated : p);
  savePlans(plans);
  syncToSupabase(async () => {
    const client = sb()!;
    await client.from('position_plans').update({ status: updated.status, last_review: new Date().toISOString() }).eq('id', updated.id);
    for (const t of updated.tranches) {
      await client.from('tranches').update({ value: t.value, executed: t.executed, executed_price: t.executedPrice, executed_date: t.executedDate }).eq('id', t.id);
    }
  });
}

export function deletePlan(id: string): void {
  savePlans(getPlans().filter(p => p.id !== id));
  syncToSupabase(async () => { await sb()!.from('position_plans').delete().eq('id', id); });
}

// ============ الإشعارات ============

export function getNotifications(): TrancheNotification[] {
  const data = localStorage.getItem(KEYS.notifications);
  return data ? JSON.parse(data) : [];
}

export function addNotification(notif: TrancheNotification): void {
  const all = getNotifications();
  if (all.some(n => n.planId === notif.planId && n.trancheNumber === notif.trancheNumber && n.type === notif.type)) return;
  all.unshift(notif);
  localStorage.setItem(KEYS.notifications, JSON.stringify(all));
}

export function markNotificationRead(id: string): void {
  const all = getNotifications().map(n => n.id === id ? { ...n, read: true } : n);
  localStorage.setItem(KEYS.notifications, JSON.stringify(all));
}

export function clearNotifications(): void {
  localStorage.removeItem(KEYS.notifications);
}

// ============ تصدير واستيراد ============

export function exportAllData(): string {
  const data: Record<string, unknown> = {};
  for (const [name, key] of Object.entries(KEYS)) {
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        data[name] = parsed;  // الاسم المنطقي (profile, assets...)
        data[key] = parsed;   // المفتاح الكامل (portfolio_profile...) - للتوافق
      } catch { data[name] = raw; }
    }
  }
  data._exportDate = new Date().toISOString();
  return JSON.stringify(data, null, 2);
}

export function importAllData(json: string): { success: boolean; message: string } {
  try {
    const data = JSON.parse(json);
    if (!data || typeof data !== 'object') return { success: false, message: 'ملف غير صالح' };
    let count = 0;

    // دعم كلا الصيغتين: المفاتيح المنطقية (profile) أو مفاتيح localStorage (portfolio_profile)
    for (const [name, key] of Object.entries(KEYS)) {
      const value = data[name] ?? data[key]; // جرب الاسم المنطقي أو المفتاح الكامل
      if (value !== undefined) {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        count++;
      }
    }

    // رفع البيانات المستوردة إلى Supabase
    pushAllToSupabase();
    return { success: true, message: `تم استيراد ${count} مجموعة بيانات بنجاح` };
  } catch {
    return { success: false, message: 'خطأ في قراءة الملف' };
  }
}

export function downloadDataAsFile(): void {
  const json = exportAllData();
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `portfolio_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importDataFromFile(): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) { resolve({ success: false, message: 'لم يتم اختيار ملف' }); return; }
      const text = await file.text();
      resolve(importAllData(text));
    };
    input.click();
  });
}

// رفع كل البيانات المحلية إلى Supabase (يُستخدم بعد الاستيراد)
function pushAllToSupabase(): void {
  const client = sb();
  if (!client) return;

  const profile = getProfile();
  if (profile) saveProfile(profile);

  const assets = getAssets();
  for (const a of assets) {
    syncToSupabase(async () => {
      await client.from('assets').upsert({
        id: a.id, name: a.name, category: a.category, quantity: a.quantity,
        purchase_price: a.purchasePrice, purchase_date: a.purchaseDate,
        current_price: a.currentPrice, target_weight: a.targetWeight,
      }, { onConflict: 'id' });
    });
  }
}

// ============ بيانات تجريبية ============

export function loadSampleData(): void {
  if (!getProfile()) {
    saveProfile({
      riskScore: 6, profileType: 'balanced',
      stocksWeight: 0.35, cryptoWeight: 0.10, bondsWeight: 0.25,
      commoditiesWeight: 0.10, realEstateWeight: 0.10, cashWeight: 0.10,
      availableCash: 5000,
    });
  }
  if (getAssets().length > 0) return;

  const aapl: Asset = { id: 'aapl-1', name: 'AAPL', category: 'أسهم أمريكية', quantity: 10, purchasePrice: 150, purchaseDate: '2025-10-01', currentPrice: 185, targetWeight: 0.30 };
  const btc: Asset = { id: 'btc-1', name: 'BTC', category: 'بيتكوين', quantity: 0.1, purchasePrice: 45000, purchaseDate: '2025-09-15', currentPrice: 52000, targetWeight: 0.20 };
  const msft: Asset = { id: 'msft-1', name: 'MSFT', category: 'أسهم أمريكية', quantity: 8, purchasePrice: 380, purchaseDate: '2025-11-01', currentPrice: 420, targetWeight: 0.25 };
  const gold: Asset = { id: 'gold-1', name: 'GOLD', category: 'ذهب', quantity: 5, purchasePrice: 2000, purchaseDate: '2025-08-01', currentPrice: 2350, targetWeight: 0.15 };
  saveAssets([aapl, btc, msft, gold]);
  // ملاحظة: saveAssets لا ترفع إلى Supabase - نستخدم addAsset لكل أصل
  for (const a of [aapl, btc, msft, gold]) {
    syncToSupabase(async () => {
      await sb()!.from('assets').upsert({
        id: a.id, name: a.name, category: a.category, quantity: a.quantity,
        purchase_price: a.purchasePrice, purchase_date: a.purchaseDate,
        current_price: a.currentPrice, target_weight: a.targetWeight,
      }, { onConflict: 'id' });
    });
  }

  const aaplPrices = [150,152.3,148.5,155.2,153.8,157.1,160.4,158.9,162,165.3,163.5,167.2,170.1,168.4,172.5,175,173.2,176.8,179.1,177.5,180.3,183,181.2,184.5,186,183.8,187.2,189.5,188,190.3,185.2,182,179.5,176,173.5,170,168.5,172,175.5,178,180.5,183,181.5,184,186.5,185,187.5,189,186.5,184,182,180,178.5,181,183.5,185,186.5,184.5,183,185];
  const btcPrices = [45000,45500,44800,46200,47000,46500,48000,49200,48500,50000,51500,50800,52000,53500,52800,54000,55000,53500,52000,50500,49000,48000,47000,46500,48000,49500,51000,52500,54000,55500,54000,52500,51000,49500,48000,47000,46000,45500,47000,48500,50000,51500,53000,54500,53000,51500,50000,49000,50500,52000,53500,55000,54000,52500,51000,50000,51500,53000,52000,52000];
  const msftPrices = [380,382,378,385,388,386,390,393,391,395,398,396,400,403,401,405,408,406,410,413,411,415,418,416,420,423,421,418,415,412,410,408,406,410,413,415,418,420,417,414,412,410,413,416,418,420,422,419,416,414,417,420,422,424,421,418,416,419,421,420];
  const goldPrices = [2000,2010,2005,2020,2030,2025,2040,2055,2050,2070,2085,2080,2100,2115,2110,2130,2145,2140,2160,2175,2170,2190,2205,2200,2220,2235,2230,2250,2265,2260,2280,2295,2290,2310,2300,2285,2270,2260,2280,2300,2315,2330,2320,2310,2325,2340,2335,2350,2365,2355,2340,2330,2345,2360,2375,2365,2350,2345,2355,2350];
  const makeRecords = (prices: number[]) => prices.map((p, i) => ({ date: `2026-${String(Math.floor(i/30)+1).padStart(2,'0')}-${String((i%30)+1).padStart(2,'0')}`, close: p }));
  setPriceHistory('aapl-1', makeRecords(aaplPrices));
  setPriceHistory('btc-1', makeRecords(btcPrices));
  setPriceHistory('msft-1', makeRecords(msftPrices));
  setPriceHistory('gold-1', makeRecords(goldPrices));
}
