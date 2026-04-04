// ======================== نماذج البيانات ========================

export interface Asset {
  id: string;
  name: string;
  category: string; // أسهم، عملات رقمية، سندات، سلع، عقارات
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
  currentPrice: number;
  targetWeight: number; // 0-1
}

export interface PriceRecord {
  date: string;
  close: number;
}

export interface InvestorProfile {
  riskScore: number; // 1-10
  profileType: 'aggressive' | 'balanced' | 'income' | 'capital_preservation' | 'custom';
  stocksWeight: number;
  cryptoWeight: number;
  bondsWeight: number;
  commoditiesWeight: number;
  realEstateWeight: number;
  cashWeight: number;
  availableCash: number;
}

export interface TradingSignal {
  assetName: string;
  assetId: string;
  signalType: 'buy' | 'sell' | 'none';
  optimumScore: number;
  zScore: number;
  expectedReturn: number;
  volatility: number;
  currentPrice: number;
  currentWeight: number;
  targetWeight: number;
  suggestedQuantity: number;
  suggestedValue: number;
  reasons: string[];
}

export interface Trade {
  id: string;
  assetId: string;
  assetName: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  totalValue: number;
  date: string;
}

export interface BacktestResult {
  totalReturn: number;
  buyAndHoldReturn: number;
  numberOfTrades: number;
  winRate: number;
  trades: BacktestTrade[];
  equityCurve: number[];
}

export interface BacktestTrade {
  type: 'buy' | 'sell';
  price: number;
  quantity: number;
  value: number;
  dayIndex: number;
  os: number;
}

export interface RebalanceItem {
  assetName: string;
  currentWeight: number;
  targetWeight: number;
  deviation: number;
}

// ============ إعدادات النظام الديناميكية ============

export interface SystemSettings {
  // معاملات محرك Optimum Score
  alpha: number;          // وزن شارب (0-1)
  beta: number;           // وزن Z-Score (0-1)
  gamma: number;          // وزن تكلفة المعاملات (0-1)
  riskFreeRate: number;   // معدل العائد الخالي من المخاطر (سنوي)
  transactionCost: number; // تكلفة المعاملات (نسبة)

  // عتبات الإشارات
  buyThreshold: number;   // عتبة الشراء (OS >= هذه القيمة)
  sellThreshold: number;  // عتبة البيع (OS <= هذه القيمة)

  // عتبة إعادة التوازن
  rebalanceThreshold: number; // نسبة الانحراف المسموحة

  // مؤشر RSI
  rsiPeriod: number;

  // باك تيست
  backtestLookback: number;    // نافذة المراجعة (يوم)
  backtestBuyRatio: number;    // نسبة النقد للشراء في الباك تيست
  backtestSellRatio: number;   // نسبة البيع في الباك تيست

  // حجم الصفقة
  buyOrderCashRatio: number;   // نسبة النقد المستخدم في أمر الشراء
  sellMode: 'rebalance' | 'half' | 'quarter' | 'all'; // أسلوب البيع الافتراضي

  // Monte Carlo
  monteCarloIterations: number;

  // أيام التداول السنوية (للتقييس السنوي)
  tradingDaysPerYear: number;

  // Z-Score عتبات التنبيه
  zScoreStrongBuy: number;    // أقل من هذا = فرصة شراء قوية
  zScoreStrongSell: number;   // أكثر من هذا = فرصة بيع قوية
}

// إعدادات مخصصة لكل أصل (تتجاوز إعدادات النظام)
export interface AssetSettings {
  assetId: string;
  alpha?: number;
  beta?: number;
  gamma?: number;
  buyThreshold?: number;
  sellThreshold?: number;
  riskFreeRate?: number;
  transactionCost?: number;
  sellMode?: 'rebalance' | 'half' | 'quarter' | 'all';
  buyOrderCashRatio?: number;
  zScoreStrongBuy?: number;
  zScoreStrongSell?: number;
}

// القيم الافتراضية لإعدادات النظام
export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  alpha: 0.4,
  beta: 0.4,
  gamma: 0.2,
  riskFreeRate: 0.03,
  transactionCost: 0.001,
  buyThreshold: 0.7,
  sellThreshold: 0.3,
  rebalanceThreshold: 0.05,
  rsiPeriod: 14,
  backtestLookback: 50,
  backtestBuyRatio: 0.3,
  backtestSellRatio: 0.5,
  buyOrderCashRatio: 0.3,
  sellMode: 'half',
  monteCarloIterations: 10000,
  tradingDaysPerYear: 252,
  zScoreStrongBuy: -2,
  zScoreStrongSell: 2,
};

// وصف كل إعداد (للعرض الديناميكي)
export interface SettingMeta {
  key: keyof SystemSettings;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  group: string;
}

export const SETTINGS_META: SettingMeta[] = [
  // محرك Optimum Score
  { key: 'alpha', label: 'α وزن شارب', description: 'وزن نسبة شارب في حساب Optimum Score', min: 0, max: 1, step: 0.05, unit: '', group: 'محرك Optimum Score' },
  { key: 'beta', label: 'β وزن Z-Score', description: 'وزن مؤشر Z-Score في حساب Optimum Score', min: 0, max: 1, step: 0.05, unit: '', group: 'محرك Optimum Score' },
  { key: 'gamma', label: 'γ وزن التكلفة', description: 'وزن تكلفة المعاملات في حساب Optimum Score', min: 0, max: 1, step: 0.05, unit: '', group: 'محرك Optimum Score' },
  { key: 'riskFreeRate', label: 'العائد الخالي من المخاطر', description: 'معدل العائد الخالي من المخاطر السنوي (مثل عائد السندات الحكومية)', min: 0, max: 0.2, step: 0.005, unit: '%', group: 'محرك Optimum Score' },
  { key: 'transactionCost', label: 'تكلفة المعاملات', description: 'نسبة تكلفة تنفيذ كل صفقة (عمولة الوسيط)', min: 0, max: 0.05, step: 0.0005, unit: '%', group: 'محرك Optimum Score' },

  // عتبات الإشارات
  { key: 'buyThreshold', label: 'عتبة الشراء', description: 'عندما يكون OS أكبر من أو يساوي هذه القيمة → إشارة شراء', min: 0.5, max: 0.95, step: 0.05, unit: '', group: 'عتبات الإشارات' },
  { key: 'sellThreshold', label: 'عتبة البيع', description: 'عندما يكون OS أقل من أو يساوي هذه القيمة → إشارة بيع', min: 0.05, max: 0.5, step: 0.05, unit: '', group: 'عتبات الإشارات' },

  // Z-Score
  { key: 'zScoreStrongBuy', label: 'Z-Score شراء قوي', description: 'عندما يكون Z-Score أقل من هذه القيمة → فرصة شراء قوية', min: -5, max: 0, step: 0.5, unit: '', group: 'عتبات الإشارات' },
  { key: 'zScoreStrongSell', label: 'Z-Score بيع قوي', description: 'عندما يكون Z-Score أكبر من هذه القيمة → فرصة بيع قوية', min: 0, max: 5, step: 0.5, unit: '', group: 'عتبات الإشارات' },

  // إعادة التوازن
  { key: 'rebalanceThreshold', label: 'عتبة إعادة التوازن', description: 'نسبة الانحراف المسموحة قبل اقتراح إعادة التوازن', min: 0.01, max: 0.20, step: 0.01, unit: '%', group: 'إعادة التوازن' },

  // حجم الصفقة
  { key: 'buyOrderCashRatio', label: 'نسبة النقد للشراء', description: 'نسبة النقد المتاح المستخدم في كل أمر شراء', min: 0.05, max: 1, step: 0.05, unit: '%', group: 'حجم الصفقة' },
  { key: 'sellMode', label: 'أسلوب البيع', description: 'الأسلوب الافتراضي لحساب كمية البيع', min: 0, max: 3, step: 1, unit: '', group: 'حجم الصفقة' },

  // المؤشرات
  { key: 'rsiPeriod', label: 'فترة RSI', description: 'عدد الأيام لحساب مؤشر القوة النسبية', min: 5, max: 50, step: 1, unit: 'يوم', group: 'المؤشرات الفنية' },
  { key: 'tradingDaysPerYear', label: 'أيام التداول السنوية', description: 'عدد أيام التداول في السنة (لتقييس العوائد والتقلبات)', min: 200, max: 365, step: 1, unit: 'يوم', group: 'المؤشرات الفنية' },

  // باك تيست
  { key: 'backtestLookback', label: 'نافذة المراجعة', description: 'عدد الأيام التاريخية المستخدمة لحساب الإشارات في الباك تيست', min: 10, max: 200, step: 5, unit: 'يوم', group: 'الباك تيست' },
  { key: 'backtestBuyRatio', label: 'نسبة الشراء', description: 'نسبة النقد المستخدم في كل عملية شراء أثناء الباك تيست', min: 0.1, max: 1, step: 0.05, unit: '%', group: 'الباك تيست' },
  { key: 'backtestSellRatio', label: 'نسبة البيع', description: 'نسبة المركز المباع في كل عملية بيع أثناء الباك تيست', min: 0.1, max: 1, step: 0.05, unit: '%', group: 'الباك تيست' },

  // Monte Carlo
  { key: 'monteCarloIterations', label: 'تكرارات Monte Carlo', description: 'عدد التكرارات لتحسين الأوزان (أكثر = أدق لكن أبطأ)', min: 1000, max: 100000, step: 1000, unit: 'تكرار', group: 'تحسين الأوزان' },
];

// أسماء الأنماط بالعربية
export const PROFILE_NAMES: Record<string, string> = {
  aggressive: 'نمو عنيف',
  balanced: 'متوازن',
  income: 'دخل ثابت',
  capital_preservation: 'تأمين رأس المال',
  custom: 'مخصص',
};

export const CATEGORY_OPTIONS = ['أسهم', 'عملات رقمية', 'سندات', 'سلع', 'عقارات'];
