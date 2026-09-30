from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey,
    Text,
)

from sqlalchemy.orm import relationship

from .database import Base


def now():
    return datetime.now(timezone.utc)


# ============================================================
# FARMER
# ============================================================

class Farmer(Base):
    __tablename__ = "farmers"

    id = Column(Integer, primary_key=True)

    name = Column(
        String,
        nullable=False
    )

    age = Column(Integer)

    phone = Column(String)

    # State
    region = Column(
        String,
        default="West Bengal"
    )

    # District
    district = Column(
        String,
        default=""
    )

    # Village
    village = Column(String)
    
    # Password
    password_hash = Column(
        String,
        nullable=True
    )
    created_at = Column(
        DateTime,
        default=now
    )

    hives = relationship(
        "Hive",
        back_populates="farmer"
    )

    batches = relationship(
        "HoneyBatch",
        back_populates="farmer"
    )


# ============================================================
# HIVE
# ============================================================

class Hive(Base):
    __tablename__ = "hives"

    id = Column(
        Integer,
        primary_key=True
    )

    farmer_id = Column(
        Integer,
        ForeignKey("farmers.id"),
        nullable=False
    )

    hive_code = Column(
        String,
        unique=True,
        nullable=False
    )

    location = Column(String)

    created_at = Column(
        DateTime,
        default=now
    )

    farmer = relationship(
        "Farmer",
        back_populates="hives"
    )

    ai_results = relationship(
        "AIResult",
        back_populates="hive",
        order_by="AIResult.created_at"
    )

    batches = relationship(
        "HoneyBatch",
        back_populates="hive"
    )


# ============================================================
# AI RESULT
# ============================================================

class AIResult(Base):
    __tablename__ = "ai_results"

    id = Column(
        Integer,
        primary_key=True
    )

    hive_id = Column(
        Integer,
        ForeignKey("hives.id")
    )

    temperature = Column(Float)

    humidity = Column(Float)

    weight = Column(Float)

    audio_feature = Column(Float)

    health_score = Column(Float)

    health_status = Column(String)

    disease_risk = Column(String)

    predicted_yield_kg = Column(Float)

    environmental_stress = Column(String)

    explanation = Column(Text)

    created_at = Column(
        DateTime,
        default=now
    )

    hive = relationship(
        "Hive",
        back_populates="ai_results"
    )


# ============================================================
# HONEY BATCH
# ============================================================

class HoneyBatch(Base):
    __tablename__ = "honey_batches"

    id = Column(
        Integer,
        primary_key=True
    )

    batch_id = Column(
        String,
        unique=True,
        nullable=False
    )

    hive_id = Column(
        Integer,
        ForeignKey("hives.id")
    )

    farmer_id = Column(
        Integer,
        ForeignKey("farmers.id")
    )

    honey_type = Column(String)

    quantity_kg = Column(Float)

    harvest_date = Column(String)

    current_location = Column(String)

    current_owner = Column(String)

    status = Column(
        String,
        default="AVAILABLE"
    )

    ai_health_status = Column(String)

    ai_disease_risk = Column(String)

    ai_predicted_yield = Column(Float)

    qr_token = Column(String)

    # State / region
    region = Column(
        String,
        default="West Bengal"
    )

    created_at = Column(
        DateTime,
        default=now
    )

    hive = relationship(
        "Hive",
        back_populates="batches"
    )

    farmer = relationship(
        "Farmer",
        back_populates="batches"
    )

    lab_reports = relationship(
        "LabReport",
        back_populates="batch"
    )

    events = relationship(
        "TraceabilityEvent",
        back_populates="batch"
    )


# ============================================================
# LAB REPORT
# ============================================================

class LabReport(Base):
    __tablename__ = "lab_reports"

    id = Column(
        Integer,
        primary_key=True
    )

    batch_id = Column(
        Integer,
        ForeignKey("honey_batches.id")
    )

    report_number = Column(String)

    laboratory = Column(String)

    test_date = Column(String)

    moisture = Column(Float)

    purity = Column(Float)

    quality_grade = Column(String)

    report_file_name = Column(String)

    report_content = Column(Text)

    sha256_hash = Column(String)

    blockchain_tx_hash = Column(String)

    created_at = Column(
        DateTime,
        default=now
    )

    batch = relationship(
        "HoneyBatch",
        back_populates="lab_reports"
    )


# ============================================================
# TRACEABILITY EVENT
# ============================================================

class TraceabilityEvent(Base):
    __tablename__ = "traceability_events"

    id = Column(
        Integer,
        primary_key=True
    )

    batch_id = Column(
        Integer,
        ForeignKey("honey_batches.id")
    )

    event_type = Column(String)

    from_party = Column(String)

    to_party = Column(String)

    location = Column(String)

    timestamp = Column(
        DateTime,
        default=now
    )

    blockchain_tx_hash = Column(String)

    event_metadata = Column(Text)

    batch = relationship(
        "HoneyBatch",
        back_populates="events"
    )


# ============================================================
# BLOCKCHAIN RECORD
# ============================================================

class BlockchainRecord(Base):
    __tablename__ = "blockchain_records"

    id = Column(
        Integer,
        primary_key=True
    )

    batch_id = Column(
        Integer,
        ForeignKey("honey_batches.id")
    )

    record_type = Column(String)

    data_hash = Column(String)

    blockchain_tx_hash = Column(String)

    block_number = Column(Integer)

    created_at = Column(
        DateTime,
        default=now
    )
# ============================================================
# ADMIN
# ============================================================

class Admin(Base):
    __tablename__ = "admins"

    id = Column(
        Integer,
        primary_key=True
    )

    admin_id = Column(
        String,
        unique=True,
        nullable=False
    )

    state = Column(
        String,
        nullable=False
    )

    district = Column(
        String,
        nullable=False
    )

    password_hash = Column(
        String,
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=now
    )