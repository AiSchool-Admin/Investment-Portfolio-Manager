// ======================== نماذج البيانات ========================

export interface Asset {
  id: string;
  name: string;
  category: string; // فئة الأصل (من CATEGORY_OPTIONS)
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
  signalSource: 'os' | 'trailing_stop' | 'force_rebalance'; // مصدر الإشارة
  optimumScore: number;
  confidence: number; // درجة الثقة (0-1)

  // العوامل الفردية
  factors: {
    sharpe: number;
    zScore: number;
    zScoreAdj: number;
    trend: number;        // +1, 0, -1
    trendStrength: number;
    rsi: number;          // 0-100
    rsiSignal: number;    // -1 to +1
    momentum: number;     // -1 to +1
    macd: number;         // -1 to +1
    lowVolSignal: number; // -1 to +1 (تقلب منخفض = إيجابي)
    ma50: number;         // قيمة المتوسط المتحرك
    adx: number;          // قوة الاتجاه (0-100)
    regime: string;       // 'trending' أو 'ranging'
    bollingerPercentB: number; // موقع السعر في نطاق Bollinger (0-1)
  };

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
  source?: string;  // مصدر التمويل (شراء) أو وعاء الاستلام (بيع)
  notes?: string;   // ملاحظات
}

// مصادر التمويل / أوعية الاستلام
export const FUNDING_SOURCES = [
  { value: 'cash', label: 'النقدية الحالية في المحفظة' },
  { value: 'bank_transfer', label: 'تحويل بنكي' },
  { value: 'external', label: 'مصدر تمويل خارجي' },
  { value: 'dividend', label: 'أرباح موزعة (إعادة استثمار)' },
  { value: 'salary', label: 'مدخرات / راتب' },
  { value: 'loan', label: 'تمويل / قرض' },
  { value: 'gift', label: 'هبة / منحة' },
  { value: 'other', label: 'أخرى' },
];

export const RECEIVING_DESTINATIONS = [
  { value: 'cash', label: 'النقدية الحالية في المحفظة' },
  { value: 'bank_transfer', label: 'تحويل إلى حساب بنكي' },
  { value: 'reinvest', label: 'إعادة استثمار في أصل آخر' },
  { value: 'withdrawal', label: 'سحب نقدي' },
  { value: 'expense', label: 'مصاريف / التزامات' },
  { value: 'other', label: 'أخرى' },
];

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

// ============ مخاطر المحفظة ============

export interface PortfolioRiskMetrics {
  totalValue: number;
  totalPL: number;
  totalPLPercent: number;
  portfolioVolatility: number;     // تقلب المحفظة السنوي
  valueAtRisk95: number;           // VaR 95% (أقصى خسارة متوقعة في يوم)
  maxDrawdown: number;             // أقصى انخفاض من القمة
  currentDrawdown: number;         // الانخفاض الحالي من القمة
  drawdownAlert: boolean;          // تحذير إذا تجاوز العتبة
  sharpePortfolio: number;         // شارب المحفظة ككل
  diversificationScore: number;    // درجة التنويع (0-1)
  correlationWarnings: string[];   // تحذيرات ارتباط عالي
  assetCorrelations: { asset1: string; asset2: string; correlation: number }[];
}

export interface RebalanceItem {
  assetName: string;
  currentWeight: number;
  targetWeight: number;
  deviation: number;
}

// ============ إعدادات النظام الديناميكية ============

export interface SystemSettings {
  // === أوزان محرك OS المحسّن (المجموع = 1) ===
  alpha: number;          // وزن شارب (Sharpe)
  beta: number;           // وزن Z-Score المعدّل (Z_adj)
  delta: number;          // وزن الاتجاه (Trend)
  epsilon: number;        // وزن RSI
  zeta: number;           // وزن الزخم (Momentum)
  eta: number;            // وزن MACD
  theta: number;          // وزن التقلب المنخفض (Low Volatility)
  gamma: number;          // وزن تكلفة المعاملات

  // === معاملات أساسية ===
  riskFreeRate: number;   // معدل العائد الخالي من المخاطر (سنوي)
  transactionCost: number; // تكلفة المعاملات (نسبة)
  sigmoidK: number;       // حساسية دالة Sigmoid (k)

  // === عتبات الإشارات ===
  buyThreshold: number;   // عتبة الشراء (OS >= هذه القيمة)
  sellThreshold: number;  // عتبة البيع (OS <= هذه القيمة)

  // === عتبة إعادة التوازن ===
  rebalanceThreshold: number;    // عتبة عادية (5%)
  forceRebalanceThreshold: number; // عتبة إلزامية (10%) - تتجاوز OS

  // === فترات المؤشرات ===
  rsiPeriod: number;       // فترة RSI (يوم)
  maPeriod: number;        // فترة المتوسط المتحرك MA (يوم)
  momentumPeriod: number;  // فترة الزخم (يوم)
  macdFast: number;        // MACD الخط السريع
  macdSlow: number;        // MACD الخط البطيء
  macdSignal: number;      // MACD خط الإشارة
  adxPeriod: number;       // فترة ADX
  adxThreshold: number;    // عتبة ADX (< هذا = متذبذب)
  bollingerPeriod: number; // فترة Bollinger Bands
  bollingerStdDev: number; // عدد الانحرافات المعيارية

  // === أوزان الوضع المتذبذب (عندما ADX < العتبة) ===
  rangingAlpha: number;    // Sharpe في المتذبذب
  rangingBeta: number;     // Z_adj في المتذبذب
  rangingDelta: number;    // Trend في المتذبذب
  rangingEpsilon: number;  // RSI في المتذبذب
  rangingZeta: number;     // Momentum في المتذبذب
  rangingEta: number;      // MACD في المتذبذب
  rangingTheta: number;    // LowVol في المتذبذب
  rangingGamma: number;    // Cost في المتذبذب

  // === عتبات الوضع المتذبذب ===
  rangingBuyThreshold: number;   // عتبة شراء في المتذبذب (أقل من العادي)
  rangingSellThreshold: number;  // عتبة بيع في المتذبذب (أعلى من العادي)

  // === وقف خسارة ثابت ===
  hardStopLossEnabled: boolean;
  hardStopLossPercent: number;   // نسبة وقف الخسارة من سعر الشراء

  // === Trailing Stop ===
  trailingStopEnabled: boolean;
  trailingStopProfitTrigger: number; // نسبة الربح التي تفعّل الـ trailing stop
  trailingStopDistance: number;      // المسافة من أعلى سعر

  // === Drawdown Protection ===
  drawdownProtectionEnabled: boolean;
  maxDrawdownThreshold: number;  // عتبة أقصى انخفاض للمحفظة (مثلاً 0.15 = 15%)

  // === باك تيست ===
  backtestLookback: number;
  backtestBuyRatio: number;
  backtestSellRatio: number;

  // === حجم الصفقة ===
  buyOrderCashRatio: number;
  sellMode: 'rebalance' | 'half' | 'quarter' | 'all';

  // === عام ===
  monteCarloIterations: number;
  tradingDaysPerYear: number;
  zScoreStrongBuy: number;
  zScoreStrongSell: number;
}

// إعدادات مخصصة لكل أصل (تتجاوز إعدادات النظام)
export interface AssetSettings {
  assetId: string;
  alpha?: number;
  beta?: number;
  delta?: number;
  epsilon?: number;
  zeta?: number;
  eta?: number;
  theta?: number;
  gamma?: number;
  sigmoidK?: number;
  buyThreshold?: number;
  sellThreshold?: number;
  riskFreeRate?: number;
  transactionCost?: number;
  sellMode?: 'rebalance' | 'half' | 'quarter' | 'all';
  buyOrderCashRatio?: number;
  zScoreStrongBuy?: number;
  zScoreStrongSell?: number;
  rsiPeriod?: number;
  maPeriod?: number;
  momentumPeriod?: number;
  trailingStopEnabled?: boolean;
  trailingStopProfitTrigger?: number;
  trailingStopDistance?: number;
}

// القيم الافتراضية لإعدادات النظام (نمط متوازن)
export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  // أوزان OS (المجموع = 1.0)
  alpha: 0.18,    // Sharpe
  beta: 0.17,     // Z_adj
  delta: 0.15,    // Trend
  epsilon: 0.13,  // RSI
  zeta: 0.10,     // Momentum
  eta: 0.08,      // MACD
  theta: 0.10,    // Low Volatility
  gamma: 0.09,    // Cost

  riskFreeRate: 0.03,
  transactionCost: 0.001,
  sigmoidK: 2.5,

  buyThreshold: 0.7,
  sellThreshold: 0.3,

  rebalanceThreshold: 0.05,
  forceRebalanceThreshold: 0.10,

  rsiPeriod: 14,
  maPeriod: 50,
  momentumPeriod: 10,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  adxPeriod: 14,
  adxThreshold: 20,
  bollingerPeriod: 20,
  bollingerStdDev: 2,

  // أوزان الوضع المتذبذب
  rangingAlpha: 0.10,
  rangingBeta: 0.30,
  rangingDelta: 0.05,
  rangingEpsilon: 0.20,
  rangingZeta: 0.10,
  rangingEta: 0.10,
  rangingTheta: 0.05,
  rangingGamma: 0.10,

  rangingBuyThreshold: 0.65,
  rangingSellThreshold: 0.35,

  hardStopLossEnabled: true,
  hardStopLossPercent: 0.05,

  trailingStopEnabled: true,
  trailingStopProfitTrigger: 0.20,
  trailingStopDistance: 0.10,

  drawdownProtectionEnabled: true,
  maxDrawdownThreshold: 0.15,

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

// أنماط المعاملات المسبقة حسب نمط المستثمر
export const PROFILE_PRESETS: Record<string, Partial<SystemSettings>> = {
  aggressive: { alpha: 0.12, beta: 0.25, delta: 0.22, epsilon: 0.13, zeta: 0.10, eta: 0.05, theta: 0.05, gamma: 0.08 },
  balanced: { alpha: 0.18, beta: 0.17, delta: 0.15, epsilon: 0.13, zeta: 0.10, eta: 0.08, theta: 0.10, gamma: 0.09 },
  income: { alpha: 0.25, beta: 0.12, delta: 0.12, epsilon: 0.12, zeta: 0.08, eta: 0.08, theta: 0.15, gamma: 0.08 },
  capital_preservation: { alpha: 0.30, beta: 0.10, delta: 0.10, epsilon: 0.10, zeta: 0.05, eta: 0.05, theta: 0.22, gamma: 0.08 },
};

// ============ الضبط المثالي لكل فئة أصل ============
// مستمد من منهجيات BlackRock, Goldman Sachs, Bridgewater

export interface AssetClassConfig {
  // أوزان OS
  alpha: number; beta: number; delta: number; epsilon: number;
  zeta: number; eta: number; theta: number; gamma: number;
  // مؤشرات
  maPeriod: number;
  rsiPeriod: number;
  rsiBuyThreshold: number;   // عتبة RSI للشراء (مثلاً 30)
  rsiSellThreshold: number;  // عتبة RSI للبيع (مثلاً 70)
  momentumPeriod: number;
  macdFast: number; macdSlow: number; macdSignal: number;
  zScoreStrongBuy: number;
  zScoreStrongSell: number;
  // إدارة مخاطر
  halfKellyRatio: number;    // نسبة استخدام كيلي (0.5 = نصف)
  riskRewardRatio: number;
  buyOrderCashRatio: number;
  trailingStopProfitTrigger: number;
  trailingStopDistance: number;
  // بناء المركز
  dcaTranches: number;
  horizonDays: number;
}

// القيم الافتراضية المثالية لكل فئة أصل
export const ASSET_CLASS_DEFAULTS: Record<string, AssetClassConfig> = {
  // === الأسهم ===
  EQ: {
    alpha: 0.22, beta: 0.17, delta: 0.17, epsilon: 0.13, zeta: 0.08, eta: 0.08, theta: 0.08, gamma: 0.07,
    maPeriod: 50, rsiPeriod: 14, rsiBuyThreshold: 30, rsiSellThreshold: 70,
    momentumPeriod: 10, macdFast: 12, macdSlow: 26, macdSignal: 9,
    zScoreStrongBuy: -2, zScoreStrongSell: 2,
    halfKellyRatio: 0.50, riskRewardRatio: 2.0, buyOrderCashRatio: 0.30,
    trailingStopProfitTrigger: 0.20, trailingStopDistance: 0.15,
    dcaTranches: 4, horizonDays: 90,
  },
  // === الدخل الثابت ===
  FI: {
    alpha: 0.28, beta: 0.12, delta: 0.15, epsilon: 0.08, zeta: 0.08, eta: 0.08, theta: 0.15, gamma: 0.06,
    maPeriod: 50, rsiPeriod: 14, rsiBuyThreshold: 30, rsiSellThreshold: 70,
    momentumPeriod: 10, macdFast: 12, macdSlow: 26, macdSignal: 9,
    zScoreStrongBuy: -1.5, zScoreStrongSell: 1.5,
    halfKellyRatio: 0.40, riskRewardRatio: 1.5, buyOrderCashRatio: 0.25,
    trailingStopProfitTrigger: 0.05, trailingStopDistance: 0.05,
    dcaTranches: 3, horizonDays: 60,
  },
  // === السلع والمعادن الثمينة ===
  CM: {
    alpha: 0.17, beta: 0.22, delta: 0.17, epsilon: 0.12, zeta: 0.08, eta: 0.08, theta: 0.08, gamma: 0.08,
    maPeriod: 50, rsiPeriod: 14, rsiBuyThreshold: 25, rsiSellThreshold: 75,
    momentumPeriod: 10, macdFast: 12, macdSlow: 26, macdSignal: 9,
    zScoreStrongBuy: -2.5, zScoreStrongSell: 2.5,
    halfKellyRatio: 0.30, riskRewardRatio: 2.5, buyOrderCashRatio: 0.20,
    trailingStopProfitTrigger: 0.30, trailingStopDistance: 0.20,
    dcaTranches: 6, horizonDays: 180,
  },
  // === العقارات ===
  RE: {
    alpha: 0.25, beta: 0.12, delta: 0.15, epsilon: 0.12, zeta: 0.08, eta: 0.08, theta: 0.12, gamma: 0.08,
    maPeriod: 100, rsiPeriod: 20, rsiBuyThreshold: 30, rsiSellThreshold: 70,
    momentumPeriod: 20, macdFast: 12, macdSlow: 26, macdSignal: 9,
    zScoreStrongBuy: -2, zScoreStrongSell: 2,
    halfKellyRatio: 0.25, riskRewardRatio: 2.0, buyOrderCashRatio: 0.15,
    trailingStopProfitTrigger: 0.25, trailingStopDistance: 0.15,
    dcaTranches: 4, horizonDays: 365,
  },
  // === النقد وما يعادله ===
  CS: {
    alpha: 0.35, beta: 0.05, delta: 0.05, epsilon: 0.05, zeta: 0.03, eta: 0.03, theta: 0.25, gamma: 0.19,
    maPeriod: 20, rsiPeriod: 14, rsiBuyThreshold: 30, rsiSellThreshold: 70,
    momentumPeriod: 5, macdFast: 12, macdSlow: 26, macdSignal: 9,
    zScoreStrongBuy: -1, zScoreStrongSell: 1,
    halfKellyRatio: 1.0, riskRewardRatio: 1.0, buyOrderCashRatio: 1.0,
    trailingStopProfitTrigger: 1.0, trailingStopDistance: 1.0,
    dcaTranches: 1, horizonDays: 30,
  },
  // === رأس المال الجريء ===
  VC: {
    alpha: 0.12, beta: 0.25, delta: 0.12, epsilon: 0.08, zeta: 0.08, eta: 0.08, theta: 0.15, gamma: 0.12,
    maPeriod: 50, rsiPeriod: 14, rsiBuyThreshold: 30, rsiSellThreshold: 70,
    momentumPeriod: 10, macdFast: 12, macdSlow: 26, macdSignal: 9,
    zScoreStrongBuy: -2, zScoreStrongSell: 2,
    halfKellyRatio: 0.15, riskRewardRatio: 5.0, buyOrderCashRatio: 0.10,
    trailingStopProfitTrigger: 1.0, trailingStopDistance: 1.0,
    dcaTranches: 3, horizonDays: 730,
  },
  // === الأسهم الخاصة ===
  PE: {
    alpha: 0.17, beta: 0.20, delta: 0.12, epsilon: 0.08, zeta: 0.08, eta: 0.08, theta: 0.15, gamma: 0.12,
    maPeriod: 50, rsiPeriod: 14, rsiBuyThreshold: 30, rsiSellThreshold: 70,
    momentumPeriod: 10, macdFast: 12, macdSlow: 26, macdSignal: 9,
    zScoreStrongBuy: -2, zScoreStrongSell: 2,
    halfKellyRatio: 0.20, riskRewardRatio: 3.0, buyOrderCashRatio: 0.15,
    trailingStopProfitTrigger: 1.0, trailingStopDistance: 1.0,
    dcaTranches: 2, horizonDays: 365,
  },
  // === العملات الرقمية ===
  CR: {
    alpha: 0.08, beta: 0.30, delta: 0.17, epsilon: 0.12, zeta: 0.10, eta: 0.08, theta: 0.05, gamma: 0.10,
    maPeriod: 50, rsiPeriod: 14, rsiBuyThreshold: 20, rsiSellThreshold: 80,
    momentumPeriod: 7, macdFast: 12, macdSlow: 26, macdSignal: 9,
    zScoreStrongBuy: -3, zScoreStrongSell: 3,
    halfKellyRatio: 0.25, riskRewardRatio: 3.0, buyOrderCashRatio: 0.20,
    trailingStopProfitTrigger: 0.40, trailingStopDistance: 0.25,
    dcaTranches: 3, horizonDays: 45,
  },
};

// ربط فئات الأصول بأكواد المجموعات
export function getAssetClassCode(category: string): string {
  for (const [groupKey, group] of Object.entries(CATEGORY_GROUPS)) {
    if (group.categories.includes(category)) {
      switch (groupKey) {
        case 'stocks': return 'EQ';
        case 'fixedIncome': return 'FI';
        case 'cash': return 'CS';
        case 'preciousMetals': case 'commodities': return 'CM';
        case 'realEstate': return 'RE';
        case 'crypto': return 'CR';
        case 'funds':
          if (category.includes('تحوط') || category.includes('خاصة')) return 'PE';
          return 'EQ'; // صناديق متوازنة → مثل الأسهم
        default: return 'EQ';
      }
    }
  }
  return 'EQ';
}

// الحصول على الإعدادات الافتراضية لفئة أصل
export function getAssetClassDefaults(category: string): AssetClassConfig {
  const code = getAssetClassCode(category);
  return ASSET_CLASS_DEFAULTS[code] || ASSET_CLASS_DEFAULTS['EQ'];
}

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
  // أوزان محرك OS
  { key: 'alpha', label: 'α وزن شارب', description: 'وزن نسبة شارب (عائد معدل بالمخاطر) في OS', min: 0, max: 0.5, step: 0.05, unit: '', group: 'أوزان محرك OS' },
  { key: 'beta', label: 'β وزن Z-Score المعدّل', description: 'وزن الانحراف عن المتوسط (معدّل بالاتجاه)', min: 0, max: 0.5, step: 0.05, unit: '', group: 'أوزان محرك OS' },
  { key: 'delta', label: 'δ وزن الاتجاه', description: 'وزن مؤشر الاتجاه (فوق/تحت المتوسط المتحرك)', min: 0, max: 0.5, step: 0.05, unit: '', group: 'أوزان محرك OS' },
  { key: 'epsilon', label: 'ε وزن RSI', description: 'وزن مؤشر القوة النسبية (تشبع بيعي/شرائي)', min: 0, max: 0.5, step: 0.05, unit: '', group: 'أوزان محرك OS' },
  { key: 'zeta', label: 'ζ وزن الزخم', description: 'وزن معدل تغير السعر (Momentum)', min: 0, max: 0.5, step: 0.05, unit: '', group: 'أوزان محرك OS' },
  { key: 'eta', label: 'η وزن MACD', description: 'وزن مؤشر MACD (تقاطع المتوسطات)', min: 0, max: 0.5, step: 0.05, unit: '', group: 'أوزان محرك OS' },
  { key: 'theta', label: 'θ وزن التقلب المنخفض', description: 'يفضّل الأصول ذات التقلب المنخفض (استقرار أعلى)', min: 0, max: 0.5, step: 0.05, unit: '', group: 'أوزان محرك OS' },
  { key: 'gamma', label: 'γ وزن التكلفة', description: 'وزن تكلفة المعاملات', min: 0, max: 0.3, step: 0.05, unit: '', group: 'أوزان محرك OS' },

  // معاملات أساسية
  { key: 'riskFreeRate', label: 'العائد الخالي من المخاطر', description: 'معدل العائد السنوي الخالي من المخاطر', min: 0, max: 0.2, step: 0.005, unit: '%', group: 'معاملات أساسية' },
  { key: 'transactionCost', label: 'تكلفة المعاملات', description: 'نسبة عمولة الوسيط لكل صفقة', min: 0, max: 0.05, step: 0.0005, unit: '%', group: 'معاملات أساسية' },
  { key: 'sigmoidK', label: 'حساسية Sigmoid (k)', description: 'كلما زاد k زادت حساسية OS حول الوسط', min: 1, max: 5, step: 0.5, unit: '', group: 'معاملات أساسية' },

  // عتبات الإشارات
  { key: 'buyThreshold', label: 'عتبة الشراء', description: 'OS ≥ هذه القيمة → إشارة شراء', min: 0.5, max: 0.95, step: 0.05, unit: '', group: 'عتبات الإشارات' },
  { key: 'sellThreshold', label: 'عتبة البيع', description: 'OS ≤ هذه القيمة → إشارة بيع', min: 0.05, max: 0.5, step: 0.05, unit: '', group: 'عتبات الإشارات' },

  // إعادة التوازن
  { key: 'rebalanceThreshold', label: 'عتبة إعادة التوازن', description: 'انحراف الوزن المسموح قبل الاقتراح', min: 0.01, max: 0.20, step: 0.01, unit: '%', group: 'إعادة التوازن' },
  { key: 'forceRebalanceThreshold', label: 'عتبة إلزامية', description: 'عند هذا الانحراف يتم إصدار إشارة بيع/شراء فورية بغض النظر عن OS', min: 0.05, max: 0.30, step: 0.01, unit: '%', group: 'إعادة التوازن' },

  // فترات المؤشرات
  { key: 'rsiPeriod', label: 'فترة RSI', description: 'عدد الأيام لحساب مؤشر القوة النسبية', min: 5, max: 50, step: 1, unit: 'يوم', group: 'فترات المؤشرات' },
  { key: 'maPeriod', label: 'فترة المتوسط المتحرك', description: 'عدد الأيام للمتوسط المتحرك (MA) لتحديد الاتجاه', min: 10, max: 200, step: 5, unit: 'يوم', group: 'فترات المؤشرات' },
  { key: 'momentumPeriod', label: 'فترة الزخم', description: 'عدد الأيام لحساب معدل تغير السعر', min: 5, max: 30, step: 1, unit: 'يوم', group: 'فترات المؤشرات' },
  { key: 'macdFast', label: 'MACD السريع', description: 'فترة المتوسط السريع لـ MACD', min: 5, max: 20, step: 1, unit: 'يوم', group: 'فترات المؤشرات' },
  { key: 'macdSlow', label: 'MACD البطيء', description: 'فترة المتوسط البطيء لـ MACD', min: 15, max: 50, step: 1, unit: 'يوم', group: 'فترات المؤشرات' },
  { key: 'macdSignal', label: 'MACD الإشارة', description: 'فترة خط إشارة MACD', min: 5, max: 20, step: 1, unit: 'يوم', group: 'فترات المؤشرات' },

  // Trailing Stop
  { key: 'trailingStopProfitTrigger', label: 'تفعيل Trailing Stop', description: 'نسبة الربح غير المحقق التي تفعّل وقف الخسارة المتحرك', min: 0.05, max: 0.50, step: 0.05, unit: '%', group: 'وقف الخسارة المتحرك' },
  { key: 'trailingStopDistance', label: 'مسافة Trailing Stop', description: 'نسبة الانخفاض من أعلى سعر التي تطلق إشارة بيع', min: 0.03, max: 0.25, step: 0.01, unit: '%', group: 'وقف الخسارة المتحرك' },
  { key: 'maxDrawdownThreshold', label: 'حماية الانهيار', description: 'عند انخفاض المحفظة أكثر من هذه النسبة → تنبيه وتوصية بتقليص المخاطر', min: 0.05, max: 0.40, step: 0.05, unit: '%', group: 'حماية المحفظة' },

  // حجم الصفقة
  { key: 'buyOrderCashRatio', label: 'نسبة النقد للشراء', description: 'نسبة النقد المتاح المستخدم في كل أمر شراء', min: 0.05, max: 1, step: 0.05, unit: '%', group: 'حجم الصفقة' },
  { key: 'sellMode', label: 'أسلوب البيع', description: 'الأسلوب الافتراضي لحساب كمية البيع', min: 0, max: 3, step: 1, unit: '', group: 'حجم الصفقة' },

  // عام
  { key: 'tradingDaysPerYear', label: 'أيام التداول السنوية', description: 'عدد أيام التداول في السنة', min: 200, max: 365, step: 1, unit: 'يوم', group: 'عام' },
  { key: 'backtestLookback', label: 'نافذة المراجعة', description: 'عدد الأيام التاريخية للباك تيست', min: 10, max: 200, step: 5, unit: 'يوم', group: 'الباك تيست' },
  { key: 'backtestBuyRatio', label: 'نسبة الشراء', description: 'نسبة النقد في كل شراء بالباك تيست', min: 0.1, max: 1, step: 0.05, unit: '%', group: 'الباك تيست' },
  { key: 'backtestSellRatio', label: 'نسبة البيع', description: 'نسبة المركز في كل بيع بالباك تيست', min: 0.1, max: 1, step: 0.05, unit: '%', group: 'الباك تيست' },
  { key: 'monteCarloIterations', label: 'تكرارات Monte Carlo', description: 'عدد التكرارات لتحسين الأوزان', min: 1000, max: 100000, step: 1000, unit: 'تكرار', group: 'تحسين الأوزان' },
];

// أسماء الأنماط بالعربية
export const PROFILE_NAMES: Record<string, string> = {
  aggressive: 'نمو عنيف',
  balanced: 'متوازن',
  income: 'دخل ثابت',
  capital_preservation: 'تأمين رأس المال',
  custom: 'مخصص',
};

export const CATEGORY_OPTIONS = [
  // أسهم
  'أسهم محلية',
  'أسهم أمريكية',
  'أسهم أوروبية',
  'أسهم أسواق ناشئة',
  'أسهم آسيوية',
  // صناديق الأسهم
  'صناديق أسهم (ETF)',
  'صناديق مؤشرات',
  // الدخل الثابت والسندات
  'سندات حكومية',
  'سندات شركات',
  'صكوك إسلامية',
  'صناديق دخل ثابت',
  // صناديق النقد
  'صناديق نقد',
  'ودائع بنكية',
  // المعادن الثمينة
  'ذهب',
  'فضة',
  'بلاتين',
  // السلع
  'نفط وطاقة',
  'سلع زراعية',
  'سلع صناعية',
  // العقارات
  'عقارات سكنية',
  'عقارات تجارية',
  'صناديق عقارية (REITs)',
  // العملات الرقمية
  'بيتكوين',
  'إيثريوم',
  'عملات رقمية أخرى',
  'عملات مستقرة (Stablecoins)',
  // صناديق متنوعة
  'صناديق متوازنة',
  'صناديق تحوط',
  'أسهم خاصة (Private Equity)',
  // أخرى
  'فوركس (عملات أجنبية)',
  'خيارات ومشتقات',
  'أخرى',
];

// تجميع الفئات مع ألوان لكل مجموعة
export const CATEGORY_GROUPS: Record<string, { label: string; color: string; categories: string[] }> = {
  stocks: {
    label: 'الأسهم',
    color: '#2196F3',
    categories: ['أسهم محلية', 'أسهم أمريكية', 'أسهم أوروبية', 'أسهم أسواق ناشئة', 'أسهم آسيوية', 'صناديق أسهم (ETF)', 'صناديق مؤشرات'],
  },
  fixedIncome: {
    label: 'الدخل الثابت',
    color: '#4CAF50',
    categories: ['سندات حكومية', 'سندات شركات', 'صكوك إسلامية', 'صناديق دخل ثابت'],
  },
  cash: {
    label: 'النقد وما يعادله',
    color: '#607D8B',
    categories: ['صناديق نقد', 'ودائع بنكية'],
  },
  preciousMetals: {
    label: 'المعادن الثمينة',
    color: '#FFC107',
    categories: ['ذهب', 'فضة', 'بلاتين'],
  },
  commodities: {
    label: 'السلع',
    color: '#FF9800',
    categories: ['نفط وطاقة', 'سلع زراعية', 'سلع صناعية'],
  },
  realEstate: {
    label: 'العقارات',
    color: '#9C27B0',
    categories: ['عقارات سكنية', 'عقارات تجارية', 'صناديق عقارية (REITs)'],
  },
  crypto: {
    label: 'العملات الرقمية',
    color: '#FF5722',
    categories: ['بيتكوين', 'إيثريوم', 'عملات رقمية أخرى', 'عملات مستقرة (Stablecoins)'],
  },
  funds: {
    label: 'صناديق متنوعة',
    color: '#3F51B5',
    categories: ['صناديق متوازنة', 'صناديق تحوط', 'أسهم خاصة (Private Equity)'],
  },
  other: {
    label: 'أخرى',
    color: '#795548',
    categories: ['فوركس (عملات أجنبية)', 'خيارات ومشتقات', 'أخرى'],
  },
};

// استخراج لون الفئة
export function getCategoryColor(category: string): string {
  for (const group of Object.values(CATEGORY_GROUPS)) {
    if (group.categories.includes(category)) return group.color;
  }
  return '#9E9E9E';
}

// استخراج اسم المجموعة الأم
export function getCategoryGroupLabel(category: string): string {
  for (const group of Object.values(CATEGORY_GROUPS)) {
    if (group.categories.includes(category)) return group.label;
  }
  return 'أخرى';
}

// ============ بناء المركز (Position Building) ============

export interface Tranche {
  id: string;
  planId: string;
  number: number;
  value: number;          // قيمة الدفعة بالعملة
  targetDate: string;     // ISO date string
  minPrice: number | null; // سعر الشراء المستهدف (اختياري)
  executed: boolean;
  executedPrice: number | null;
  executedDate: string | null;
}

export interface PositionBuildingPlan {
  id: string;
  assetName: string;
  assetCategory: string;
  assetId: string | null;  // مرتبط بأصل موجود إن وجد
  totalTargetValue: number;
  numTranches: number;
  tranches: Tranche[];
  strategy: 'DCA' | 'Pyramiding';
  horizonDays: number;
  currentPrice: number;
  riskRewardRatio: number;
  optimumScore: number;
  createdAt: string;       // ISO date string
  lastReview: string;      // ISO date string
  status: 'active' | 'completed' | 'paused';
}

// إشعار بدفعة قادمة
export interface TrancheNotification {
  id: string;
  planId: string;
  trancheNumber: number;
  assetName: string;
  message: string;
  type: 'upcoming_tranche' | 'price_target_reached';
  date: string;
  read: boolean;
}
