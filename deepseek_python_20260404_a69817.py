# optimizer.py (نسخة متكاملة مع موديل بناء الأصول الجديد)
# تشمل: RSI، Z-Score، Optimum Score (OS)، Half-Kelly، جدولة الدفعات، DCA، Pyramiding

import math
import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta

# ------------------------------------------------------------
# 1. دوال مساعدة (RSI، Z-Score، Sharpe، إلخ) – كما هي سابقاً
# ------------------------------------------------------------

def calculate_rsi(prices: List[float], period: int = 14) -> float:
    if len(prices) < period + 1:
        return 50.0
    gains, losses = [], []
    for i in range(1, period + 1):
        diff = prices[-i] - prices[-i-1]
        if diff >= 0:
            gains.append(diff)
            losses.append(0)
        else:
            gains.append(0)
            losses.append(-diff)
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return round(rsi, 2)

def calculate_z_score(current_price: float, historical_prices: List[float]) -> float:
    if len(historical_prices) < 2:
        return 0.0
    mu = np.mean(historical_prices)
    sigma = np.std(historical_prices)
    if sigma == 0:
        return 0.0
    z = (current_price - mu) / sigma
    return round(z, 2)

def expected_return_from_history(historical_returns: List[float], annualize: bool = True) -> float:
    if not historical_returns:
        return 0.0
    avg_daily_return = np.mean(historical_returns)
    return avg_daily_return * 252 if annualize else avg_daily_return

def sharpe_ratio(expected_return: float, risk_free_rate: float, volatility: float) -> float:
    if volatility == 0:
        return 0.0
    return (expected_return - risk_free_rate) / volatility

# ------------------------------------------------------------
# 2. Optimum Score (OS) – كما هي سابقاً
# ------------------------------------------------------------

def compute_optimum_score(
    expected_return: float,
    volatility: float,
    risk_free_rate: float,
    z_score: float,
    transaction_cost: float = 0.001,
    alpha: float = 0.4,
    beta: float = 0.4,
    gamma: float = 0.2
) -> float:
    sharpe = sharpe_ratio(expected_return, risk_free_rate, volatility)
    term1 = alpha * sharpe
    term2 = beta * (-z_score)
    term3 = gamma * transaction_cost
    os_raw = term1 + term2 - term3
    # تطبيع إلى [0,1]
    os_norm = 1 / (1 + np.exp(-os_raw * 2))
    return round(os_norm, 4)

# ------------------------------------------------------------
# 3. موديل بناء أصل جديد (Half-Kelly، جدولة الدفعات، DCA، Pyramiding)
# ------------------------------------------------------------

@dataclass
class Tranche:
    number: int
    value: float          # قيمة الدفعة بالعملة
    target_date: datetime
    min_price: Optional[float] = None   # سعر الشراء المستهدف (اختياري)
    executed: bool = False
    executed_price: Optional[float] = None

@dataclass
class PositionBuildingPlan:
    asset_name: str
    total_target_value: float          # القيمة الإجمالية المستهدفة للمركز
    num_tranches: int
    tranches: List[Tranche]
    strategy: str                      # "DCA" or "Pyramiding"
    horizon_days: int
    created_at: datetime
    last_review: datetime

def calculate_half_kelly_position_size(
    optimum_score: float,
    risk_reward_ratio: float = 2.0,
    portfolio_value: float = 100000.0
) -> float:
    """
    حساب حجم المركز المثالي باستخدام نصف معيار كيلي (Half-Kelly)
    optimum_score: يستخدم كتقدير لاحتمالية النجاح (p)
    risk_reward_ratio: نسبة الربح المتوقع إلى الخسارة المتوقعة (b)
    الصيغة: Kelly% = (p * (b+1) - 1) / b
    Half-Kelly = Kelly% / 2
    """
    p = max(0.01, min(0.99, optimum_score))  # تحويل OS إلى احتمال
    b = risk_reward_ratio
    if b <= 0:
        return 0.0
    kelly = (p * (b + 1) - 1) / b
    half_kelly = max(0.0, kelly / 2)
    # الحد الأقصى 25% من المحفظة لأي أصل جديد
    capped = min(0.25, half_kelly)
    return capped * portfolio_value

def get_default_horizon_days(asset_class: str, market_volatility: float = 0.2) -> int:
    """
    تحديد الأفق الزمني الافتراضي (أيام) لبناء مركز بناءً على نوع الأصل والتقلب
    """
    base_days = {
        "أسهم": 90,
        "سلع": 180,
        "عملات رقمية": 60,
        "سندات": 120,
        "نقد": 30,
        "صناديق": 90
    }.get(asset_class, 90)
    # تعديل حسب التقلب: تقليل المدة إذا كان التقلب عالياً
    if market_volatility > 0.3:
        base_days = int(base_days * 0.7)
    elif market_volatility < 0.15:
        base_days = int(base_days * 1.3)
    return max(30, min(365, base_days))

def suggest_tranche_schedule(
    total_target_value: float,
    num_tranches: int,
    horizon_days: int,
    start_date: datetime,
    strategy: str = "DCA"
) -> List[Tranche]:
    """
    جدولة الدفعات إما بتوزيع متساوٍ (DCA) أو هرمي (Pyramiding)
    """
    if num_tranches <= 0:
        return []
    
    if strategy == "DCA":
        tranche_values = [total_target_value / num_tranches] * num_tranches
    else:  # Pyramiding: 40%, 30%, 20%, 10% ... لأول 4 دفعات، ثم الباقي
        weights = [0.4, 0.3, 0.2, 0.1]
        # إذا كان عدد الدفعات أكثر من 4، نوزع الباقي بالتساوي على الدفعات الإضافية
        if num_tranches > 4:
            remaining = 1.0 - sum(weights)
            extra_weight = remaining / (num_tranches - 4)
            weights += [extra_weight] * (num_tranches - 4)
        else:
            weights = weights[:num_tranches]
            # إعادة تطبيع المجموع إلى 1
            total_w = sum(weights)
            weights = [w / total_w for w in weights]
        tranche_values = [total_target_value * w for w in weights]
    
    # توزيع التواريخ بالتساوي
    delta_days = horizon_days / (num_tranches - 1) if num_tranches > 1 else horizon_days
    tranches = []
    for i in range(num_tranches):
        target_date = start_date + timedelta(days=int(i * delta_days))
        tranches.append(Tranche(
            number=i+1,
            value=round(tranche_values[i], 2),
            target_date=target_date
        ))
    return tranches

def calculate_tranche_value_dynamic(
    plan: PositionBuildingPlan,
    current_position_value: float,
    remaining_cash: float,
    market_volatility: float = 0.2
) -> List[Tranche]:
    """
    إعادة حساب قيم الدفعات المتبقية بناءً على المركز الحالي والنقد المتاح والتقلب.
    يتم تعديل الدفعات غير المنفذة فقط.
    """
    executed_value = sum(t.value for t in plan.tranches if t.executed)
    remaining_target = max(0, plan.total_target_value - executed_value)
    
    pending_tranches = [t for t in plan.tranches if not t.executed]
    if not pending_tranches:
        return plan.tranches
    
    # إذا كان النقد المتبقي أقل من الهدف، نقلص الدفعات
    if remaining_cash < remaining_target:
        scaling_factor = remaining_cash / remaining_target
        new_values = [t.value * scaling_factor for t in pending_tranches]
    else:
        # توزيع الهدف المتبقي بنفس النسب الأصلية
        original_weights = [t.value / sum(t.value for t in pending_tranches) for t in pending_tranches]
        new_values = [remaining_target * w for w in original_weights]
    
    # تحديث الدفعات
    for i, tranche in enumerate(pending_tranches):
        tranche.value = round(new_values[i], 2)
    
    return plan.tranches

def generate_entry_points(
    historical_prices: List[float],
    current_price: float,
    num_points: int = 3
) -> List[float]:
    """
    اقتراح نقاط دخول مثالية (أسعار) بناءً على الدعم والمقاومة وقيعان Z-Score.
    يحاول إيجاد مستويات سعرية جذابة للشراء.
    """
    if len(historical_prices) < 20:
        return [current_price * 0.98, current_price * 0.96, current_price * 0.94]
    
    mu = np.mean(historical_prices[-50:])
    sigma = np.std(historical_prices[-50:])
    support1 = mu - sigma
    support2 = mu - 1.5 * sigma
    support3 = mu - 2 * sigma
    
    # التأكد من أن نقاط الدعم أقل من السعر الحالي وأكبر من الصفر
    supports = [s for s in [support1, support2, support3] if s < current_price and s > 0]
    if len(supports) < num_points:
        supports += [current_price * (0.98 - i*0.02) for i in range(len(supports), num_points)]
    return supports[:num_points]

def create_position_building_plan(
    asset_name: str,
    asset_class: str,
    optimum_score: float,
    portfolio_value: float,
    available_cash: float,
    risk_reward_ratio: float = 2.0,
    strategy: str = "DCA",
    start_date: Optional[datetime] = None,
    market_volatility: float = 0.2,
    historical_prices: Optional[List[float]] = None,
    current_price: float = 100.0
) -> PositionBuildingPlan:
    """
    الوظيفة الرئيسية لإنشاء خطة بناء مركز جديد.
    """
    if start_date is None:
        start_date = datetime.today()
    
    # 1. حجم المركز الإجمالي (Half-Kelly)
    total_target_value = calculate_half_kelly_position_size(
        optimum_score=optimum_score,
        risk_reward_ratio=risk_reward_ratio,
        portfolio_value=portfolio_value
    )
    # التأكد من أن القيمة لا تتجاوز النقد المتاح
    total_target_value = min(total_target_value, available_cash)
    
    # 2. عدد الدفعات (افتراضي: 4 للـ DCA، 3 للـ Pyramiding)
    num_tranches = 4 if strategy == "DCA" else 3
    
    # 3. الأفق الزمني (أيام)
    horizon_days = get_default_horizon_days(asset_class, market_volatility)
    
    # 4. جدولة الدفعات
    tranches = suggest_tranche_schedule(
        total_target_value=total_target_value,
        num_tranches=num_tranches,
        horizon_days=horizon_days,
        start_date=start_date,
        strategy=strategy
    )
    
    # 5. إضافة نقاط الدخول المحسّنة (أسعار مستهدفة) إذا توفرت بيانات تاريخية
    if historical_prices and len(historical_prices) > 10:
        entry_prices = generate_entry_points(historical_prices, current_price, num_points=num_tranches)
        for i, tranche in enumerate(tranches):
            if i < len(entry_prices):
                tranche.min_price = entry_prices[i]
    
    return PositionBuildingPlan(
        asset_name=asset_name,
        total_target_value=total_target_value,
        num_tranches=num_tranches,
        tranches=tranches,
        strategy=strategy,
        horizon_days=horizon_days,
        created_at=datetime.today(),
        last_review=datetime.today()
    )

def review_and_update_plan(
    plan: PositionBuildingPlan,
    current_position_value: float,
    remaining_cash: float,
    market_volatility: float
) -> PositionBuildingPlan:
    """
    إعادة تقييم الخطة وتحديث الدفعات المتبقية ديناميكياً.
    """
    updated_tranches = calculate_tranche_value_dynamic(
        plan, current_position_value, remaining_cash, market_volatility
    )
    plan.tranches = updated_tranches
    plan.last_review = datetime.today()
    return plan

# ------------------------------------------------------------
# 4. مثال توضيحي سريع
# ------------------------------------------------------------
if __name__ == "__main__":
    # إنشاء خطة لأصل جديد "BTC-USD"
    plan = create_position_building_plan(
        asset_name="BTC-USD",
        asset_class="عملات رقمية",
        optimum_score=0.82,
        portfolio_value=100000,
        available_cash=20000,
        risk_reward_ratio=2.5,
        strategy="Pyramiding",
        market_volatility=0.35,
        historical_prices=[50000, 51000, 49500, 52000, 53000],
        current_price=52500
    )
    print(plan)