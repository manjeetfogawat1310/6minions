from typing import Optional, Any

from pydantic import BaseModel, Field


# ============================================================
# FARMER
# ============================================================

class FarmerCreate(BaseModel):
    name: str = Field(
        ...,
        min_length=2,
        max_length=150
    )

    age: int = Field(
        ...,
        ge=18,
        le=100
    )

    phone: str = Field(
        ...,
        min_length=5,
        max_length=30
    )

    # State
    region: str = Field(
        ...,
        min_length=2,
        max_length=80
    )

    # District
    district: str = Field(
        ...,
        min_length=2,
        max_length=120
    )

    # Village
    village: str = Field(
        ...,
        min_length=2,
        max_length=120
    )
    # Password
    password: str = Field(
        ...,
        min_length=6,
        max_length=100
    )


class FarmerRead(BaseModel):
    id: int

    name: str

    age: int

    phone: str

    region: str

    district: str

    village: str

    created_at: Any


# ============================================================
# AI
# ============================================================

class AIPredictRequest(BaseModel):

    hive_id: Optional[int] = None

    temperature: float = Field(
        ...,
        ge=-50,
        le=80
    )

    humidity: float = Field(
        ...,
        ge=0,
        le=100
    )

    
    audio_feature: float = Field(
        ...,
        ge=0,
        le=100
    )


class AIPredictResponse(BaseModel):

    health_score: float

    health_status: str

    disease_risk: str

    predicted_yield_kg: float

    environmental_stress: str

    explanation: str

    estimated_weight_kg: Optional[float] = None


# ============================================================
# BATCH
# ============================================================

class BatchCreate(BaseModel):

    batch_id: Optional[str] = None

    hive_id: int

    farmer_id: int

    honey_type: str

    quantity: float = Field(
        ...,
        gt=0
    )

    harvest_date: str

    location: str

    region: str = "West Bengal"

    current_owner: str = "Farmer"

    status: str = "AVAILABLE"


# ============================================================
# LAB REPORT
# ============================================================

class LabReportCreate(BaseModel):

    report_number: str

    laboratory: str

    test_date: str

    moisture: Optional[float] = None

    purity: Optional[float] = None

    quality_grade: Optional[str] = None

    report_file_name: Optional[str] = None

    report_content: Optional[str] = None


# ============================================================
# TRACEABILITY
# ============================================================

class TraceabilityEventCreate(BaseModel):

    event_type: str

    from_party: str

    to_party: str

    location: str

    metadata: dict[str, Any] = {}
# ============================================================
# ADMIN
# ============================================================

class AdminCreate(BaseModel):
    admin_id: str = Field(
        ...,
        min_length=3,
        max_length=50
    )

    state: str = Field(
        ...,
        min_length=2,
        max_length=80
    )

    district: str = Field(
        ...,
        min_length=2,
        max_length=120
    )

    password: str = Field(
        ...,
        min_length=6,
        max_length=100
    )


class AdminLogin(BaseModel):
    admin_id: str
    password: str


class FarmerLogin(BaseModel):
    farmer_id: int
    password: str
    # NAYE SCHEMAS (Advanced / History-based AI ke liye)
class AIAdvancedPredictRequest(BaseModel):
    hive_id: str
    temperature: float = Field(..., ge=-50, le=80)
    humidity: float = Field(..., ge=0, le=100)
    audio_feature: float = Field(..., ge=0, le=5)  # Naya 0-5 scale
    anchor_weight: float = Field(..., ge=0)
    anchor_date: str
    target_date: Optional[str] = None

class AIAdvancedPredictResponse(BaseModel):
    hive_id: str
    health_score: float
    health_status: str
    daily_change_kg: Optional[float]
    last7_change_kg: Optional[float]
    total_change_kg: Optional[float]
    current_weight_kg: Optional[float]
    weight_source_simulated: bool
    ai_explanation: str
    disease_risk: str
    environmental_stress: str