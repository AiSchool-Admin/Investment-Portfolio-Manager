# optimizer.py
# النموذج الأولي المتطور للمدير الديناميكي للمحفظة
# يشمل: RSI، Z-Score، Optimum Score (OS)، إشارات شراء/بيع، حساب الكميات

import math
import numpy as np
from typing import Dict, List, Tuple, Optional

# ------------------------------------------------------------
# 1. دوال مساعدة للإحصاء والمؤشرات
# ------------------------------------------------------------

def calculate_rsi(prices: List[float], period: int = 14) -> float:
    """حساب RSI من قائمة أسعار الإغلاق"""
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
    """
    Z-Score = (P_t - μ) / σ
    حيث μ و σ يحسبان من البيانات التاريخية
    """
    if len(historical_prices) < 2:
        return 0.0
    mu = np.mean(historical_prices)
    sigma = np.std(historical_prices)
    if sigma == 0:
        return 0.0
    z = (current_price - mu) / sigma
    return round(z, 2)

def expected_return_from_history(historical_returns: List[float], annualize: bool = True) -> float:
    """تقدير العائد المتوقع من متوسط العوائد التاريخية"""
    if not historical_returns:
        return 0.0
    avg_daily_return = np.mean(historical_returns)
    if annualize:
        return avg_daily_return * 252  # 252 يوم تداول
    return avg_daily_return

def portfolio_variance(weights: List[float], cov_matrix: np.ndarray) -> float:
    """حساب تباين المحفظة = w^T * Cov * w"""
    weights = np.array(weights)
    return float(np.dot(weights.T, np.dot(cov_matrix, weights)))

def sharpe_ratio(expected_return: float, risk_free_rate: float, volatility: float) -> float:
    """نسبة شارب = (E[R] - Rf) / σ"""
    if volatility == 0:
        return 0.0
    return (expected_return - risk_free_rate) / volatility

# ------------------------------------------------------------
# 2. حساب Optimum Score (OS) الموحدة
# ------------------------------------------------------------

def compute_optimum_score(
    expected_return: float,      # العائد المتوقع (سنوي)
    volatility: float,           # التقلب (σ سنوي)
    risk_free_rate: float,       # العائد الخالي من المخاطر (مثلاً 0.03)
    z_score: float,              # Z-Score الحالي
    transaction_cost: float,     # تكلفة المعاملات المتوقعة (كنسبة، مثلاً 0.001)
    alpha: float = 0.4,          # وزن العائد المعدل بالمخاطر
    beta: float = 0.4,           # وزن Z-Score
    gamma: float = 0.2           # وزن التكلفة (يُطرح)
) -> float:
    """
    Optimum Score (OS) كما في معادلة Gemini المطورة:
    OS = α * ( (E[R]-Rf)/σ ) + β * ( -Z ) - γ * C
    حيث:
    - الشق الأول: نسبة شارب المعدلة (كلما زادت، أفضل)
    - الشق الثاني: سالب Z-Score (كلما كان السعر منخفضاً جداً (Z سالب كبير) يصبح المصطلح موجباً)
    - الشق الثالث: طرح تكلفة المعاملات
    """
    sharpe = sharpe_ratio(expected_return, risk_free_rate, volatility)
    term1 = alpha * sharpe
    term2 = beta * (-z_score)   # إذا Z = -2 → +0.8
    term3 = gamma * transaction_cost
    os = term1 + term2 - term3
    # نطبق حدود 0-1 لتكون درجة مفهومة
    os = max(0.0, min(1.0, (os + 1) / 2))  # تحويل من نطاق غير محدد إلى [0,1]
    return round(os, 4)

# ------------------------------------------------------------
# 3. دوال الشراء والبيع القديمة (معدلة لاستخدام OS)
# ------------------------------------------------------------

def compute_buy_score_from_os(os: float) -> float:
    """استخراج درجة الشراء من OS (يمكن استخدامها للتوافق مع الكود السابق)"""
    return os  # في النموذج الجديد، OS نفسها تمثل القوة الشرائية

def compute_sell_score_from_os(os: float) -> float:
    """درجة البيع هي مقلوب OS"""
    return 1.0 - os

# ------------------------------------------------------------
# 4. حساب حجم الصفقة (كما هو سابقاً مع تحسينات)
# ------------------------------------------------------------

def calculate_buy_order_size(
    asset_current_value: float,
    target_weight: float,
    current_weight: float,
    portfolio_value: float,
    available_cash: float,
    current_price: float,
    cash_usage_ratio: float = 0.3
) -> Tuple[float, float]:
    """إرجاع (الكمية, القيمة) المقترحة للشراء"""
    rebalancing_amount = (target_weight - current_weight) * portfolio_value
    if rebalancing_amount <= 0:
        return 0.0, 0.0
    cash_based = available_cash * cash_usage_ratio
    suggested_value = min(rebalancing_amount, cash_based)
    if suggested_value <= 0:
        return 0.0, 0.0
    quantity = suggested_value / current_price
    quantity = round(quantity, 6)
    return quantity, round(suggested_value, 2)

def calculate_sell_order_size(
    asset_quantity: float,
    current_price: float,
    current_weight: float,
    target_weight: float,
    portfolio_value: float,
    sell_mode: str = "rebalance"
) -> Tuple[float, float]:
    """إرجاع (الكمية, القيمة) المقترحة للبيع"""
    if sell_mode == "all":
        quantity = asset_quantity
        return quantity, round(quantity * current_price, 2)
    if sell_mode == "half":
        quantity = asset_quantity * 0.5
        return round(quantity, 6), round(quantity * current_price, 2)
    if sell_mode == "quarter":
        quantity = asset_quantity * 0.25
        return round(quantity, 6), round(quantity * current_price, 2)
    # rebalance mode
    target_value = target_weight * portfolio_value
    current_value = current_weight * portfolio_value
    excess_value = current_value - target_value
    if excess_value <= 0:
        return 0.0, 0.0
    quantity = excess_value / current_price
    quantity = min(quantity, asset_quantity)
    return round(quantity, 6), round(quantity * current_price, 2)

# ------------------------------------------------------------
# 5. دالة تحليل الأصول الكاملة باستخدام OS
# ------------------------------------------------------------

def analyze_asset_with_os(
    asset_name: str,
    current_price: float,
    historical_prices: List[float],      # قائمة الأسعار التاريخية (لحساب Z-Score)
    historical_returns: List[float],     # قائمة العوائد التاريخية (لحساب العائد المتوقع)
    volatility: float,                   # التقلب المحسوب مسبقاً
    quantity_held: float,
    portfolio_value: float,
    target_weight: float,
    available_cash: float,
    risk_free_rate: float = 0.03,
    transaction_cost_ratio: float = 0.001,
    alpha: float = 0.4,
    beta: float = 0.4,
    gamma: float = 0.2
) -> Dict:
    """
    تحليل أصل باستخدام Optimum Score الموحدة.
    تعيد: الإشارة (شراء/بيع/لا شيء)، الكميات المقترحة، الأسباب.
    """
    # 1. حساب Z-Score
    z_score = calculate_z_score(current_price, historical_prices)
    
    # 2. العائد المتوقع
    expected_ret = expected_return_from_history(historical_returns, annualize=True)
    
    # 3. حساب OS
    os = compute_optimum_score(
        expected_return=expected_ret,
        volatility=volatility,
        risk_free_rate=risk_free_rate,
        z_score=z_score,
        transaction_cost=transaction_cost_ratio,
        alpha=alpha,
        beta=beta,
        gamma=gamma
    )
    
    # 4. الأوزان الحالية والمستهدفة
    current_value = quantity_held * current_price
    if portfolio_value <= 0:
        portfolio_value = current_value + available_cash
    current_weight = current_value / portfolio_value if portfolio_value > 0 else 0
    
    # 5. اتخاذ القرار
    signal = "none"
    suggested_buy_qty = 0.0
    suggested_buy_value = 0.0
    suggested_sell_qty = 0.0
    suggested_sell_value = 0.0
    reasons = []
    
    if os >= 0.7:
        signal = "buy"
        reasons.append(f"Optimum Score مرتفع ({os})")
        suggested_buy_qty, suggested_buy_value = calculate_buy_order_size(
            asset_current_value=current_value,
            target_weight=target_weight,
            current_weight=current_weight,
            portfolio_value=portfolio_value,
            available_cash=available_cash,
            current_price=current_price,
            cash_usage_ratio=0.3
        )
        if suggested_buy_qty > 0:
            reasons.append(f"الوزن الحالي {current_weight:.1%} < المستهدف {target_weight:.1%}")
        else:
            reasons.append("لا حاجة للشراء حالياً بسبب الوزن أو النقد")
    elif os <= 0.3:
        signal = "sell"
        reasons.append(f"Optimum Score منخفض ({os})")
        suggested_sell_qty, suggested_sell_value = calculate_sell_order_size(
            asset_quantity=quantity_held,
            current_price=current_price,
            current_weight=current_weight,
            target_weight=target_weight,
            portfolio_value=portfolio_value,
            sell_mode="half"
        )
        if suggested_sell_qty > 0:
            reasons.append(f"اقتراح بيع نصف المركز ({suggested_sell_qty} وحدة)")
        else:
            reasons.append("الوزن الحالي أقل من المستهدف، لكن OS يوصي بالبيع لجني أرباح")
    else:
        reasons.append(f"Optimum Score متوسط ({os})، انتظار")
    
    # إضافة تفسيرات للمؤشرات
    if z_score < -2:
        reasons.append(f"Z-Score منخفض جداً ({z_score}) → فرصة شراء")
    elif z_score > 2:
        reasons.append(f"Z-Score مرتفع جداً ({z_score}) → فرصة بيع")
    
    return {
        "asset": asset_name,
        "current_price": current_price,
        "z_score": z_score,
        "optimum_score": os,
        "current_weight": round(current_weight, 4),
        "target_weight": target_weight,
        "signal": signal,
        "suggested_buy": {"quantity": suggested_buy_qty, "value": suggested_buy_value},
        "suggested_sell": {"quantity": suggested_sell_qty, "value": suggested_sell_value},
        "reasons": reasons
    }

# ------------------------------------------------------------
# 6. مثال توضيحي سريع
# ------------------------------------------------------------
if __name__ == "__main__":
    # بيانات افتراضية لـ AAPL
    hist_prices = [150, 152, 148, 155, 160, 158, 162, 165, 170, 168]
    hist_returns = [0.01, -0.02, 0.04, 0.03, -0.01, 0.02, 0.01, 0.03, -0.01]
    result = analyze_asset_with_os(
        asset_name="AAPL",
        current_price=168,
        historical_prices=hist_prices,
        historical_returns=hist_returns,
        volatility=0.25,
        quantity_held=10,
        portfolio_value=5000,
        target_weight=0.2,
        available_cash=2000
    )
    print(result)