from dataclasses import dataclass
from datetime import date
import math

from .. import schemas


@dataclass
class Prediction:
    health_score: float
    health_status: str
    disease_risk: str
    predicted_yield_kg: float
    environmental_stress: str
    explanation: str
    estimated_weight_kg: float


# ==========================================
# GAUSSIAN DISTRIBUTION
# ==========================================
def gaussian(value: float, mean: float, sigma: float) -> float:
    """
    Returns a value between 0 and 1.

    value = mean  -> 1.0 (maximum contribution)
    value moves away from mean -> contribution decreases
    """
    return math.exp(
        -0.5 * ((value - mean) / sigma) ** 2
    )


# ==========================================
# HEALTH PREDICTION
# ==========================================
def predict(
    t: float,
    h: float,
    w: float = None,
    a: float = 0.0
) -> Prediction:

    # --------------------------------------
    # IDEAL / MEAN VALUES
    # --------------------------------------
    TEMP_MEAN = 37.0
    HUMIDITY_MEAN = 67.0
    AUDIO_MEAN = 0.47

    # --------------------------------------
    # SIGMA = TOLERANCE / SPREAD
    # Higher sigma = slower score decrease
    # --------------------------------------
    TEMP_SIGMA = 4.0
    HUMIDITY_SIGMA = 12.0
    AUDIO_SIGMA = 0.12

    # --------------------------------------
    # AUDIO NORMALIZATION
    # Expected audio is 0 to 1
    # Safety: if > 1, assume 0 to 5 scale
    # --------------------------------------
    norm_audio = a / 5.0 if a > 1.0 else a

    # Keep audio inside valid range
    norm_audio = max(0.0, min(1.0, norm_audio))

    # --------------------------------------
    # GAUSSIAN CONTRIBUTIONS
    # --------------------------------------
    temp_score = gaussian(
        t,
        TEMP_MEAN,
        TEMP_SIGMA
    )

    humidity_score = gaussian(
        h,
        HUMIDITY_MEAN,
        HUMIDITY_SIGMA
    )

    audio_score = gaussian(
        norm_audio,
        AUDIO_MEAN,
        AUDIO_SIGMA
    )

    # --------------------------------------
    # WEIGHTS
    #
    # Temperature = 40%
    # Humidity    = 35%
    # Audio       = 25%
    # --------------------------------------
    combined_score = (
        0.40 * temp_score +
        0.35 * humidity_score +
        0.25 * audio_score
    )

    # --------------------------------------
    # FINAL HEALTH SCORE
    # --------------------------------------
    score = combined_score * 100.0

    score = round(
        max(0.0, min(100.0, score)),
        1
    )

    # --------------------------------------
    # HEALTH STATUS
    # --------------------------------------
    if score >= 80.0:
        status = "Healthy"
        risk = "Low"

    elif score >= 60.0:
        status = "At Risk"
        risk = "Medium"

    elif score >= 35.0:
        status = "High Risk"
        risk = "High"

    else:
        status = "Critical"
        risk = "High"

    # --------------------------------------
    # ENVIRONMENTAL STRESS
    # --------------------------------------
    stress = []

    if temp_score < 0.60:
        stress.append("Thermal Stress")

    if humidity_score < 0.60:
        stress.append("Humidity Imbalance")

    if audio_score < 0.60:
        stress.append("Audio Anomaly")

    if stress:
        environmental_stress = ", ".join(stress)
    else:
        environmental_stress = "Optimal Conditions"

    # --------------------------------------
    # ESTIMATED YIELD
    # Deterministic, based on health score
    # --------------------------------------
    estimated_weight = 40.0

    predicted_yield = round(
        (score / 100.0) * 35.0,
        2
    )

    # --------------------------------------
    # EXPLANATION
    # --------------------------------------
    explanation = (
        f"Gaussian health model applied. "
        f"Temperature={t}°C "
        f"(mean={TEMP_MEAN}°C), "
        f"Humidity={h}% "
        f"(mean={HUMIDITY_MEAN}%), "
        f"Audio={round(norm_audio, 3)} "
        f"(mean={AUDIO_MEAN}). "
        f"Final health score={score}/100."
    )

    return Prediction(
        health_score=score,
        health_status=status,
        disease_risk=risk,
        predicted_yield_kg=predicted_yield,
        environmental_stress=environmental_stress,
        explanation=explanation,
        estimated_weight_kg=estimated_weight
    )


# ==========================================
# ADVANCED AI ENDPOINT
# ==========================================
def predict_advanced_health(
    req: schemas.AIAdvancedPredictRequest
) -> schemas.AIAdvancedPredictResponse:

    target = (
        req.target_date
        if req.target_date
        else date.today().strftime("%Y-%m-%d")
    )

    # ML MODEL COMPLETELY REMOVED.
    # Direct Gaussian-based prediction.
    res_pred = predict(
        t=req.temperature,
        h=req.humidity,
        w=40.0,
        a=req.audio_feature
    )

    return schemas.AIAdvancedPredictResponse(
        hive_id=req.hive_id,
        health_score=res_pred.health_score,
        health_status=res_pred.health_status,
        daily_change_kg=0.0,
        last7_change_kg=0.0,
        total_change_kg=0.0,
        current_weight_kg=40.0,
        weight_source_simulated=True,
        ai_explanation=res_pred.explanation,
        disease_risk=res_pred.disease_risk,
        environmental_stress=res_pred.environmental_stress
    )