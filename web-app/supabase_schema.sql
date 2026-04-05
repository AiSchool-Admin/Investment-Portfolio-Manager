-- ============================================================
-- جداول مدير المحفظة الاستثمارية - Supabase
-- شغّل هذا في SQL Editor في لوحة تحكم Supabase
-- ============================================================

-- الملف الاستثماري
CREATE TABLE IF NOT EXISTS investor_profile (
  id TEXT PRIMARY KEY DEFAULT 'default',
  risk_score INTEGER DEFAULT 5,
  profile_type TEXT DEFAULT 'balanced',
  stocks_weight REAL DEFAULT 0.35,
  crypto_weight REAL DEFAULT 0.10,
  bonds_weight REAL DEFAULT 0.25,
  commodities_weight REAL DEFAULT 0.10,
  real_estate_weight REAL DEFAULT 0.10,
  cash_weight REAL DEFAULT 0.10,
  available_cash REAL DEFAULT 10000,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- الأصول
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  purchase_price REAL NOT NULL DEFAULT 0,
  purchase_date TEXT,
  current_price REAL NOT NULL DEFAULT 0,
  target_weight REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- الأسعار التاريخية
CREATE TABLE IF NOT EXISTS price_history (
  id BIGSERIAL PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  close_price REAL NOT NULL,
  UNIQUE(asset_id, date)
);

-- الصفقات
CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  asset_id TEXT,
  asset_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
  quantity REAL NOT NULL,
  price REAL NOT NULL,
  total_value REAL NOT NULL,
  date TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- إعدادات النظام
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- إعدادات الأصول الفردية
CREATE TABLE IF NOT EXISTS asset_settings (
  asset_id TEXT PRIMARY KEY,
  settings JSONB NOT NULL DEFAULT '{}'
);

-- خطط بناء المراكز
CREATE TABLE IF NOT EXISTS position_plans (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  asset_name TEXT NOT NULL,
  asset_category TEXT,
  asset_id TEXT,
  total_target_value REAL NOT NULL,
  num_tranches INTEGER NOT NULL,
  strategy TEXT NOT NULL CHECK (strategy IN ('DCA', 'Pyramiding')),
  horizon_days INTEGER NOT NULL,
  current_price REAL,
  risk_reward_ratio REAL,
  optimum_score REAL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  created_at TIMESTAMPTZ DEFAULT now(),
  last_review TIMESTAMPTZ DEFAULT now()
);

-- دفعات خطط البناء
CREATE TABLE IF NOT EXISTS tranches (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  plan_id TEXT NOT NULL REFERENCES position_plans(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  value REAL NOT NULL,
  target_date TEXT,
  min_price REAL,
  executed BOOLEAN DEFAULT FALSE,
  executed_price REAL,
  executed_date TEXT
);

-- الإشعارات
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  plan_id TEXT,
  tranche_number INTEGER,
  asset_name TEXT,
  message TEXT,
  type TEXT,
  date TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_price_history_asset ON price_history(asset_id);
CREATE INDEX IF NOT EXISTS idx_trades_asset ON trades(asset_id);
CREATE INDEX IF NOT EXISTS idx_tranches_plan ON tranches(plan_id);

-- تفعيل RLS (Row Level Security) - اختياري
-- ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- سياسة وصول عام (بدون مصادقة)
-- إذا تريد أن يعمل بدون تسجيل دخول:
ALTER TABLE investor_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE tranches ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON investor_profile FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON assets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON price_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON trades FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON system_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON asset_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON position_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON tranches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON notifications FOR ALL USING (true) WITH CHECK (true);
