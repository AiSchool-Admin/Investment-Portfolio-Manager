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

// أسماء الأنماط بالعربية
export const PROFILE_NAMES: Record<string, string> = {
  aggressive: 'نمو عنيف',
  balanced: 'متوازن',
  income: 'دخل ثابت',
  capital_preservation: 'تأمين رأس المال',
  custom: 'مخصص',
};

export const CATEGORY_OPTIONS = ['أسهم', 'عملات رقمية', 'سندات', 'سلع', 'عقارات'];
