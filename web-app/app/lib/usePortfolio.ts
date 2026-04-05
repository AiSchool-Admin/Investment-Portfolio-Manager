'use client';

/**
 * React Hook لإدارة بيانات المحفظة
 * يعمل مع Supabase (إذا تم تكوينه) أو localStorage (كـ fallback)
 * يوفر واجهة موحدة لجميع المكونات
 */

import { useState, useEffect, useCallback } from 'react';
import { Asset, InvestorProfile, Trade, SystemSettings, DEFAULT_SYSTEM_SETTINGS, PositionBuildingPlan } from './types';
import { isSupabaseConfigured } from './supabaseClient';
import * as db from './db';

export interface PortfolioData {
  profile: InvestorProfile | null;
  assets: Asset[];
  trades: Trade[];
  settings: SystemSettings;
  plans: PositionBuildingPlan[];
  loading: boolean;
  dbType: 'supabase' | 'localStorage';

  // actions
  reload: () => Promise<void>;
  saveProfile: (p: InvestorProfile) => Promise<void>;
  addAsset: (a: Asset) => Promise<string>;
  updateAsset: (a: Asset) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  addTrade: (t: Omit<Trade, 'id'>) => Promise<void>;
  saveSettings: (s: SystemSettings) => Promise<void>;
  addPlan: (p: PositionBuildingPlan) => Promise<void>;
  updatePlan: (p: PositionBuildingPlan) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;
  getPriceList: (assetId: string) => Promise<number[]>;
  setPriceHistory: (assetId: string, records: { date: string; close: number }[]) => Promise<void>;
  addPriceRecord: (assetId: string, record: { date: string; close: number }) => Promise<void>;
}

export function usePortfolio(): PortfolioData {
  const [profile, setProfile] = useState<InvestorProfile | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [plans, setPlans] = useState<PositionBuildingPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const dbType = isSupabaseConfigured() ? 'supabase' : 'localStorage';

  const reload = useCallback(async () => {
    setLoading(true);
    const [p, a, t, s, pl] = await Promise.all([
      db.dbGetProfile(),
      db.dbGetAssets(),
      db.dbGetTrades(),
      db.dbGetSystemSettings(),
      db.dbGetPlans(),
    ]);

    // إنشاء ملف افتراضي إذا لم يكن موجوداً
    if (!p) {
      const defaultProfile: InvestorProfile = {
        riskScore: 5, profileType: 'balanced',
        stocksWeight: 0.35, cryptoWeight: 0.10, bondsWeight: 0.25,
        commoditiesWeight: 0.10, realEstateWeight: 0.10, cashWeight: 0.10,
        availableCash: 10000,
      };
      await db.dbSaveProfile(defaultProfile);
      setProfile(defaultProfile);
    } else {
      setProfile(p);
    }

    setAssets(a);
    setTrades(t);
    setSettings(s);
    setPlans(pl);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return {
    profile, assets, trades, settings, plans, loading, dbType,
    reload,
    saveProfile: async (p) => { await db.dbSaveProfile(p); setProfile(p); },
    addAsset: async (a) => { const id = await db.dbAddAsset(a); await reload(); return id; },
    updateAsset: async (a) => { await db.dbUpdateAsset(a); await reload(); },
    deleteAsset: async (id) => { await db.dbDeleteAsset(id); await reload(); },
    addTrade: async (t) => { await db.dbAddTrade(t); setTrades(await db.dbGetTrades()); },
    saveSettings: async (s) => { await db.dbSaveSystemSettings(s); setSettings(s); },
    addPlan: async (p) => { await db.dbAddPlan(p); setPlans(await db.dbGetPlans()); },
    updatePlan: async (p) => { await db.dbUpdatePlan(p); setPlans(await db.dbGetPlans()); },
    deletePlan: async (id) => { await db.dbDeletePlan(id); setPlans(await db.dbGetPlans()); },
    getPriceList: (assetId) => db.dbGetPriceList(assetId),
    setPriceHistory: (assetId, records) => db.dbSetPriceHistory(assetId, records),
    addPriceRecord: (assetId, record) => db.dbAddPriceRecord(assetId, record),
  };
}
