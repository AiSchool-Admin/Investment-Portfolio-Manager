/**
 * النماذج الاقتصادية الكلية (Macro-Quant Models)
 * تم تطويرها بواسطة: DeepSeek + Gemini
 * تنفيذ: Claude
 *
 * تحسب "القيمة العادلة" للأصول بناءً على متغيرات اقتصادية كلية
 */

// ============ المتغيرات الاقتصادية ============

export interface MacroVariables {
  // أمريكا والعالم
  usRealYield10y: number;      // العائد الحقيقي لسندات 10 سنوات (مثال: 2.5%)
  dxyIndex: number;            // مؤشر الدولار (مثال: 105.2)
  vixIndex: number;            // مؤشر الخوف VIX (مثال: 18.5)
  centralBankGoldBuy: number;  // مشتريات البنوك المركزية من الذهب بالأطنان (مثال: 15)
  globalPMI: number;           // مؤشر مديري المشتريات العالمي (مثال: 52.5)

  // مصر
  cpiEgypt: number;            // التضخم في مصر (مثال: 25.5%)
  cpiUS: number;               // التضخم في أمريكا (مثال: 3.2%)
  cbeInterestRate: number;     // سعر فائدة البنك المركزي المصري (مثال: 19.5%)
  usFedRate: number;           // سعر فائدة الفيدرالي الأمريكي (مثال: 5.5%)
  nfaGap: number;              // فجوة صافي الأصول الأجنبية (موجب = فائض)
  externalDebtService: number; // خدمة الدين الخارجي (مليارات دولار)
  fdi: number;                 // الاستثمار الأجنبي المباشر (مليارات دولار)
  remittances: number;         // تحويلات المصريين بالخارج (مليارات دولار)
  exports: number;             // الصادرات (مليارات دولار)
  reserves: number;            // الاحتياطي الأجنبي (مليارات دولار)
}

// ============ القيم الافتراضية للمتغيرات ============

export const DEFAULT_MACRO: MacroVariables = {
  usRealYield10y: 2.0,
  dxyIndex: 104,
  vixIndex: 18,
  centralBankGoldBuy: 10,
  globalPMI: 51,
  cpiEgypt: 24,
  cpiUS: 3.0,
  cbeInterestRate: 27.25,
  usFedRate: 4.5,
  nfaGap: -5,
  externalDebtService: 12,
  fdi: 3,
  remittances: 25,
  exports: 35,
  reserves: 46,
};

// ============ معاملات النماذج (قابلة للتعديل) ============

export interface GoldParams {
  alpha0: number; // القاعدة (طلب المجوهرات + الصناعة)
  beta0: number;  // تكلفة الاستخراج
  alpha1: number; // حساسية للعائد الحقيقي
  alpha2: number; // حساسية لمؤشر الدولار
  alpha3: number; // حساسية لـ VIX
  alpha4: number; // حساسية لمشتريات البنوك المركزية
  beta1: number;  // معامل التطبيع
}

export interface SilverParams {
  lambda: number;  // ارتباط بالذهب
  gamma0: number;  // طلب صناعي قاعدي
  gamma1: number;  // حساسية لـ PMI
  delta0: number;  // تكلفة الاستخراج
  delta1: number;  // معامل التطبيع
}

export interface CbeParams {
  realTarget: number;    // العائد الحقيقي المستهدف
  cpiTarget: number;     // هدف التضخم
  theta1: number;        // حساسية لفجوة التضخم
  theta2: number;        // حساسية لفجوة NFA
}

export interface UsdParams {
  pppWeight: number;     // وزن تعادل القوة الشرائية
  riskPremiumBase: number; // علاوة المخاطر الأساسية
  debtSensitivity: number; // حساسية لخدمة الدين
  reserveSensitivity: number; // حساسية للاحتياطي
}

export interface EgxParams {
  omega0: number;  // القاعدة
  omega1: number;  // حساسية لسعر الصرف (إيجابي = تحوط)
  omega2: number;  // حساسية لسعر الفائدة (سلبي)
  omega3: number;  // حساسية لتغير التضخم
}

// ============ القيم الافتراضية للمعاملات ============

export const DEFAULT_GOLD_PARAMS: GoldParams = {
  alpha0: 1800, beta0: 200, alpha1: 40, alpha2: 8, alpha3: 15, alpha4: 2, beta1: 1.2,
};

export const DEFAULT_SILVER_PARAMS: SilverParams = {
  lambda: 0.02, gamma0: 10, gamma1: 0.5, delta0: 5, delta1: 0.8,
};

export const DEFAULT_CBE_PARAMS: CbeParams = {
  realTarget: 4.0, cpiTarget: 7.0, theta1: 1.5, theta2: 0.5,
};

export const DEFAULT_USD_PARAMS: UsdParams = {
  pppWeight: 0.6, riskPremiumBase: 3.0, debtSensitivity: 0.8, reserveSensitivity: 0.3,
};

export const DEFAULT_EGX_PARAMS: EgxParams = {
  omega0: 15000, omega1: 200, omega2: 500, omega3: 100,
};

// ============ دوال حساب القيمة العادلة ============

/**
 * القيمة العادلة للذهب ($/أونصة)
 * P* = (α0 - β0 - α1*r_real - α2*DXY + α3*VIX + α4*CB_buy) / β1
 */
export function fairGoldPrice(
  macro: MacroVariables,
  params: GoldParams = DEFAULT_GOLD_PARAMS,
): number {
  const numerator = params.alpha0
    - params.beta0
    - params.alpha1 * macro.usRealYield10y
    - params.alpha2 * macro.dxyIndex
    + params.alpha3 * macro.vixIndex
    + params.alpha4 * macro.centralBankGoldBuy;
  return Math.max(0, numerator / params.beta1);
}

/**
 * القيمة العادلة للفضة ($/أونصة)
 * P* = λ * P_gold* + (γ0 + γ1*PMI - δ0) / δ1
 */
export function fairSilverPrice(
  fairGold: number,
  macro: MacroVariables,
  params: SilverParams = DEFAULT_SILVER_PARAMS,
): number {
  const industrialComponent = (params.gamma0 + params.gamma1 * macro.globalPMI - params.delta0) / params.delta1;
  return Math.max(0, params.lambda * fairGold + industrialComponent);
}

/**
 * سعر الفائدة العادل لمصر (%)
 * r = r_real_target + CPI + θ1*(CPI - CPI_target) - θ2*(NFA_gap)
 */
export function fairCbeRate(
  macro: MacroVariables,
  params: CbeParams = DEFAULT_CBE_PARAMS,
): number {
  const rate = params.realTarget
    + macro.cpiEgypt
    + params.theta1 * (macro.cpiEgypt - params.cpiTarget)
    - params.theta2 * macro.nfaGap;
  return Math.max(0, Math.min(50, rate)); // حد 0-50%
}

/**
 * سعر الصرف العادل (دولار/جنيه)
 * PPP part: base * (1 + CPI_EG - CPI_US) / 100
 * Risk premium: base * riskPremium * (debtService/reserves)
 */
export function fairUsdEgp(
  macro: MacroVariables,
  baseRate: number = 50, // السعر الحالي كقاعدة
  params: UsdParams = DEFAULT_USD_PARAMS,
): number {
  // تعادل القوة الشرائية
  const inflationDiff = (macro.cpiEgypt - macro.cpiUS) / 100;
  const pppRate = baseRate * (1 + inflationDiff * params.pppWeight);

  // علاوة المخاطر
  const debtRatio = macro.reserves > 0 ? macro.externalDebtService / macro.reserves : 0.5;
  const riskPremium = params.riskPremiumBase * (1 + params.debtSensitivity * debtRatio);

  // تأثير التدفقات (التحويلات + FDI + صادرات تقلل الضغط)
  const inflows = macro.remittances + macro.fdi + macro.exports;
  const inflowsDiscount = inflows > 50 ? -2 : (inflows > 30 ? -1 : 0);

  return Math.max(10, pppRate + riskPremium + inflowsDiscount);
}

/**
 * القيمة العادلة لمؤشر EGX30
 * EGX30 = ω0 + ω1*(USD/EGP) - ω2*(r_CBE) + ω3*(ΔCPI)
 */
export function fairEgx30(
  macro: MacroVariables,
  params: EgxParams = DEFAULT_EGX_PARAMS,
): number {
  const fairRate = fairCbeRate(macro);
  const fairFx = fairUsdEgp(macro);

  const value = params.omega0
    + params.omega1 * (fairFx / 50) // تطبيع حول 50
    - params.omega2 * (fairRate / 100) // تطبيع
    + params.omega3 * (macro.cpiEgypt > 20 ? 1 : 0); // تحوط تضخمي

  return Math.max(5000, Math.min(50000, value));
}

// ============ حساب فجوة التقييم ============

export interface ValuationResult {
  assetName: string;
  currentPrice: number;
  fairPrice: number;
  gap: number;         // (current - fair) / fair → سالب = مقيم بأقل
  gapPercent: number;
  recommendation: string;
}

export function calculateValuationGap(
  currentPrice: number,
  fairPrice: number,
): { gap: number; gapPercent: number; recommendation: string } {
  if (fairPrice <= 0) return { gap: 0, gapPercent: 0, recommendation: 'بيانات غير كافية' };

  const gap = (currentPrice - fairPrice) / fairPrice;
  const gapPercent = gap * 100;

  let recommendation: string;
  if (gap < -0.10) recommendation = 'مقيّم بأقل من قيمته بشكل كبير ← فرصة شراء قوية';
  else if (gap < -0.05) recommendation = 'مقيّم بأقل من قيمته ← فرصة شراء';
  else if (gap < 0.05) recommendation = 'مقيّم بشكل عادل ← احتفاظ';
  else if (gap < 0.10) recommendation = 'مقيّم بأكثر من قيمته ← حذر';
  else recommendation = 'مقيّم بأكثر من قيمته بشكل كبير ← فرصة بيع';

  return { gap, gapPercent, recommendation };
}

// ============ تعديل عتبات التداول بناءً على التقييم ============

export function adjustThresholds(
  baseBuyThreshold: number,
  baseSellThreshold: number,
  valuationGap: number,
): { buyThreshold: number; sellThreshold: number } {
  let buyAdj = 0;
  let sellAdj = 0;

  if (valuationGap < -0.05) {
    // مقيّم بأقل → سهّل الشراء
    buyAdj = -0.05;
    sellAdj = 0.05;
  } else if (valuationGap > 0.05) {
    // مقيّم بأكثر → صعّب الشراء
    buyAdj = 0.05;
    sellAdj = -0.05;
  }

  return {
    buyThreshold: Math.max(0.3, Math.min(0.9, baseBuyThreshold + buyAdj)),
    sellThreshold: Math.max(0.1, Math.min(0.7, baseSellThreshold + sellAdj)),
  };
}
