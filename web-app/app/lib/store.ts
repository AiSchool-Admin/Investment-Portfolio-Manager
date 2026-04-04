/**
 * تخزين البيانات محلياً في المتصفح (localStorage)
 * يعمل بدون إنترنت - جميع البيانات على جهازك
 */

import { Asset, InvestorProfile, Trade, PriceRecord, SystemSettings, AssetSettings, DEFAULT_SYSTEM_SETTINGS, PositionBuildingPlan, TrancheNotification } from './types';

const KEYS = {
  profile: 'portfolio_profile',
  assets: 'portfolio_assets',
  trades: 'portfolio_trades',
  priceHistory: 'portfolio_prices',
  systemSettings: 'portfolio_system_settings',
  assetSettings: 'portfolio_asset_settings',
  plans: 'portfolio_plans',
  notifications: 'portfolio_notifications',
  initialized: 'portfolio_initialized', // علامة إتمام الاستبيان
};

// ============ علامة إتمام الإعداد الأولي ============

export function isInitialized(): boolean {
  return localStorage.getItem(KEYS.initialized) === 'true';
}

export function setInitialized(): void {
  localStorage.setItem(KEYS.initialized, 'true');
}

// ============ الملف الاستثماري ============

export function saveProfile(profile: InvestorProfile): void {
  localStorage.setItem(KEYS.profile, JSON.stringify(profile));
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
  const assets = getAssets();
  assets.push({ ...asset, id: crypto.randomUUID() });
  saveAssets(assets);
}

export function updateAsset(updated: Asset): void {
  const assets = getAssets().map(a => a.id === updated.id ? updated : a);
  saveAssets(assets);
}

export function deleteAsset(id: string): void {
  saveAssets(getAssets().filter(a => a.id !== id));
  // حذف الأسعار التاريخية المرتبطة
  const all = getAllPriceHistory();
  delete all[id];
  localStorage.setItem(KEYS.priceHistory, JSON.stringify(all));
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
}

export function setPriceHistory(assetId: string, records: PriceRecord[]): void {
  const all = getAllPriceHistory();
  all[assetId] = records.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem(KEYS.priceHistory, JSON.stringify(all));
}

// ============ الصفقات ============

export function getTrades(): Trade[] {
  const data = localStorage.getItem(KEYS.trades);
  return data ? JSON.parse(data) : [];
}

export function addTrade(trade: Omit<Trade, 'id'>): void {
  const trades = getTrades();
  trades.unshift({ ...trade, id: crypto.randomUUID() } as Trade);
  localStorage.setItem(KEYS.trades, JSON.stringify(trades));
}

// ============ إعدادات النظام ============

export function getSystemSettings(): SystemSettings {
  const data = localStorage.getItem(KEYS.systemSettings);
  if (data) {
    // دمج مع الافتراضية لضمان وجود أي إعدادات جديدة
    return { ...DEFAULT_SYSTEM_SETTINGS, ...JSON.parse(data) };
  }
  return { ...DEFAULT_SYSTEM_SETTINGS };
}

export function saveSystemSettings(settings: SystemSettings): void {
  localStorage.setItem(KEYS.systemSettings, JSON.stringify(settings));
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
  const all = getAllAssetSettings();
  return all.find(s => s.assetId === assetId) || null;
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

// دمج إعدادات النظام مع إعدادات الأصل (الأصل يتجاوز النظام)
export function getEffectiveSettings(assetId: string): SystemSettings {
  const sys = getSystemSettings();
  const asset = getAssetSettings(assetId);
  if (!asset) return sys;
  return {
    ...sys,
    alpha: asset.alpha ?? sys.alpha,
    beta: asset.beta ?? sys.beta,
    gamma: asset.gamma ?? sys.gamma,
    buyThreshold: asset.buyThreshold ?? sys.buyThreshold,
    sellThreshold: asset.sellThreshold ?? sys.sellThreshold,
    riskFreeRate: asset.riskFreeRate ?? sys.riskFreeRate,
    transactionCost: asset.transactionCost ?? sys.transactionCost,
    sellMode: asset.sellMode ?? sys.sellMode,
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
}

export function updatePlan(updated: PositionBuildingPlan): void {
  const plans = getPlans().map(p => p.id === updated.id ? updated : p);
  savePlans(plans);
}

export function deletePlan(id: string): void {
  savePlans(getPlans().filter(p => p.id !== id));
}

// ============ الإشعارات ============

export function getNotifications(): TrancheNotification[] {
  const data = localStorage.getItem(KEYS.notifications);
  return data ? JSON.parse(data) : [];
}

export function addNotification(notif: TrancheNotification): void {
  const all = getNotifications();
  // تجنب التكرار
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

// ============ بيانات تجريبية ============

export function loadSampleData(): void {
  // لا نكتب فوق الملف الاستثماري إذا كان موجوداً (يأتي من الاستبيان)
  if (!getProfile()) {
    saveProfile({
      riskScore: 6, profileType: 'balanced',
      stocksWeight: 0.35, cryptoWeight: 0.10, bondsWeight: 0.25,
      commoditiesWeight: 0.10, realEstateWeight: 0.10, cashWeight: 0.10,
      availableCash: 5000,
    });
  }

  // لا نكتب فوق الأصول الموجودة! نضيف فقط إذا لم تكن موجودة
  const existingAssets = getAssets();
  if (existingAssets.length > 0) return; // ← أصول موجودة، لا تُستبدل

  const aapl: Asset = {
    id: 'aapl-1', name: 'AAPL', category: 'أسهم',
    quantity: 10, purchasePrice: 150, purchaseDate: '2025-10-01',
    currentPrice: 185, targetWeight: 0.30,
  };
  const btc: Asset = {
    id: 'btc-1', name: 'BTC', category: 'عملات رقمية',
    quantity: 0.1, purchasePrice: 45000, purchaseDate: '2025-09-15',
    currentPrice: 52000, targetWeight: 0.20,
  };
  const msft: Asset = {
    id: 'msft-1', name: 'MSFT', category: 'أسهم',
    quantity: 8, purchasePrice: 380, purchaseDate: '2025-11-01',
    currentPrice: 420, targetWeight: 0.25,
  };
  const gold: Asset = {
    id: 'gold-1', name: 'GOLD', category: 'سلع',
    quantity: 5, purchasePrice: 2000, purchaseDate: '2025-08-01',
    currentPrice: 2350, targetWeight: 0.15,
  };
  saveAssets([aapl, btc, msft, gold]);

  // أسعار تاريخية 60 يوم
  const aaplPrices = [150,152.3,148.5,155.2,153.8,157.1,160.4,158.9,162,165.3,163.5,167.2,170.1,168.4,172.5,175,173.2,176.8,179.1,177.5,180.3,183,181.2,184.5,186,183.8,187.2,189.5,188,190.3,185.2,182,179.5,176,173.5,170,168.5,172,175.5,178,180.5,183,181.5,184,186.5,185,187.5,189,186.5,184,182,180,178.5,181,183.5,185,186.5,184.5,183,185];
  const btcPrices = [45000,45500,44800,46200,47000,46500,48000,49200,48500,50000,51500,50800,52000,53500,52800,54000,55000,53500,52000,50500,49000,48000,47000,46500,48000,49500,51000,52500,54000,55500,54000,52500,51000,49500,48000,47000,46000,45500,47000,48500,50000,51500,53000,54500,53000,51500,50000,49000,50500,52000,53500,55000,54000,52500,51000,50000,51500,53000,52000,52000];
  const msftPrices = [380,382,378,385,388,386,390,393,391,395,398,396,400,403,401,405,408,406,410,413,411,415,418,416,420,423,421,418,415,412,410,408,406,410,413,415,418,420,417,414,412,410,413,416,418,420,422,419,416,414,417,420,422,424,421,418,416,419,421,420];
  const goldPrices = [2000,2010,2005,2020,2030,2025,2040,2055,2050,2070,2085,2080,2100,2115,2110,2130,2145,2140,2160,2175,2170,2190,2205,2200,2220,2235,2230,2250,2265,2260,2280,2295,2290,2310,2300,2285,2270,2260,2280,2300,2315,2330,2320,2310,2325,2340,2335,2350,2365,2355,2340,2330,2345,2360,2375,2365,2350,2345,2355,2350];

  const makeRecords = (prices: number[]) =>
    prices.map((p, i) => ({ date: `2026-${String(Math.floor(i/30)+1).padStart(2,'0')}-${String((i%30)+1).padStart(2,'0')}`, close: p }));

  setPriceHistory('aapl-1', makeRecords(aaplPrices));
  setPriceHistory('btc-1', makeRecords(btcPrices));
  setPriceHistory('msft-1', makeRecords(msftPrices));
  setPriceHistory('gold-1', makeRecords(goldPrices));
}
