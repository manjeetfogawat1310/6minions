from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AIResult, Farmer, Hive, HoneyBatch, TraceabilityEvent

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    farmers = db.query(Farmer).all()
    hives = db.query(Hive).all()
    batches = db.query(HoneyBatch).all()

    healthy = 0
    at_risk = 0
    health_stats = Counter()

    for hive in hives:
        latest = (
            db.query(AIResult)
            .filter(AIResult.hive_id == hive.id)
            .order_by(AIResult.created_at.desc())
            .first()
        )

        if latest:
            status = str(latest.health_status or "UNKNOWN").upper()
            health_stats[status] += 1

            if status == "HEALTHY":
                healthy += 1
            else:
                at_risk += 1
        else:
            health_stats["UNKNOWN"] += 1

    regional_production = Counter()
    regional_batches = Counter()

    for batch in batches:
        farmer = db.get(Farmer, batch.farmer_id)

        region = (
            farmer.region
            if farmer
            else "Unknown"
        )

        regional_production[region] += float(
            batch.quantity_kg or 0
        )

        regional_batches[region] += 1

    total_honey = sum(
        float(batch.quantity_kg or 0)
        for batch in batches
    )

    return {
        "total_farmers": len(farmers),
        "total_hives": len(hives),
        "total_batches": len(batches),
        "total_honey_kg": round(total_honey, 2),

        "healthy_hives": healthy,
        "at_risk_hives": at_risk,

        "regional_production": dict(regional_production),
        "regional_batch_counts": dict(regional_batches),

        "hive_health_statistics": dict(health_stats),
    }


# ============================================================
# REGION LIST
# ============================================================

@router.get("/regions")
def get_regions(db: Session = Depends(get_db)):

    regions = (
        db.query(Farmer.region)
        .filter(Farmer.region.isnot(None))
        .distinct()
        .order_by(Farmer.region)
        .all()
    )

    return {
        "regions": [
            row[0]
            for row in regions
            if row[0]
        ]
    }

@router.get("/region/{region_name}")
def get_region_dashboard(
    region_name: str,
    db: Session = Depends(get_db)
):
    # Selected region ke farmers
    farmers = (
        db.query(Farmer)
        .filter(Farmer.region == region_name)
        .all()
    )

    farmer_ids = [farmer.id for farmer in farmers]

    # Selected region ke hives
    hives = []

    if farmer_ids:
        hives = (
            db.query(Hive)
            .filter(Hive.farmer_id.in_(farmer_ids))
            .all()
        )

    # Selected region ke batches
    batches = []

    if farmer_ids:
        batches = (
            db.query(HoneyBatch)
            .filter(HoneyBatch.farmer_id.in_(farmer_ids))
            .all()
        )

    # Total honey
    total_honey = sum(
        float(batch.quantity_kg or 0)
        for batch in batches
    )

    # Hive health
    healthy_hives = 0
    at_risk_hives = 0
    unknown_hives = 0

    for hive in hives:

        latest = (
            db.query(AIResult)
            .filter(AIResult.hive_id == hive.id)
            .order_by(AIResult.created_at.desc())
            .first()
        )

        if not latest:
            unknown_hives += 1
            continue

        status = str(
            latest.health_status or "UNKNOWN"
        ).upper()

        if status == "HEALTHY":
            healthy_hives += 1
        else:
            at_risk_hives += 1

    # Farmer-wise details
    farmer_details = []

    for farmer in farmers:

        farmer_hives = [
            hive
            for hive in hives
            if hive.farmer_id == farmer.id
        ]

        farmer_batches = [
            batch
            for batch in batches
            if batch.farmer_id == farmer.id
        ]

        farmer_honey = sum(
            float(batch.quantity_kg or 0)
            for batch in farmer_batches
        )

        farmer_details.append({
            "id": farmer.id,
            "name": farmer.name,
            "age": farmer.age,
            "phone": farmer.phone,
            "region": farmer.region,
            "village": farmer.village,
            "hives": len(farmer_hives),
            "batches": len(farmer_batches),
            "honey_produced_kg": round(
                farmer_honey,
                2
            )
        })

    return {
        "region": region_name,

        "summary": {
            "farmers": len(farmers),
            "hives": len(hives),
            "batches": len(batches),
            "honey_produced_kg": round(
                total_honey,
                2
            ),
            "healthy_hives": healthy_hives,
            "at_risk_hives": at_risk_hives,
            "unknown_hives": unknown_hives
        },

        "farmers": farmer_details
    }
# ============================================================
# SELECTED REGION DASHBOARD
# ============================================================

@router.get("/region/{region_name}")
def get_region_dashboard(
    region_name: str,
    db: Session = Depends(get_db),
):

    # --------------------------------------------
    # Farmers in selected region
    # --------------------------------------------

    farmers = (
        db.query(Farmer)
        .filter(Farmer.region == region_name)
        .all()
    )

    farmer_ids = [
        farmer.id
        for farmer in farmers
    ]

    # --------------------------------------------
    # Hives belonging to those farmers
    # --------------------------------------------

    hives = []

    if farmer_ids:
        hives = (
            db.query(Hive)
            .filter(Hive.farmer_id.in_(farmer_ids))
            .all()
        )

    hive_ids = [
        hive.id
        for hive in hives
    ]

    # --------------------------------------------
    # Batches belonging to those farmers
    # --------------------------------------------

    batches = []

    if farmer_ids:
        batches = (
            db.query(HoneyBatch)
            .filter(HoneyBatch.farmer_id.in_(farmer_ids))
            .all()
        )

    # --------------------------------------------
    # Honey production
    # --------------------------------------------

    total_honey = sum(
        float(batch.quantity_kg or 0)
        for batch in batches
    )

    # --------------------------------------------
    # Hive health
    # --------------------------------------------

    healthy_hives = 0
    at_risk_hives = 0
    unknown_hives = 0

    for hive in hives:

        latest = (
            db.query(AIResult)
            .filter(AIResult.hive_id == hive.id)
            .order_by(AIResult.created_at.desc())
            .first()
        )

        if not latest:
            unknown_hives += 1
            continue

        status = str(
            latest.health_status or "UNKNOWN"
        ).upper()

        if status == "HEALTHY":
            healthy_hives += 1
        else:
            at_risk_hives += 1

    # --------------------------------------------
    # Farmer-wise information
    # --------------------------------------------

    farmer_details = []

    for farmer in farmers:

        farmer_hives = [
            hive
            for hive in hives
            if hive.farmer_id == farmer.id
        ]

        farmer_batches = [
            batch
            for batch in batches
            if batch.farmer_id == farmer.id
        ]

        farmer_honey = sum(
            float(batch.quantity_kg or 0)
            for batch in farmer_batches
        )

        farmer_details.append({
            "id": farmer.id,
            "name": farmer.name,
            "age": farmer.age,
            "phone": farmer.phone,
            "region": farmer.region,
            "village": farmer.village,

            "hives": len(farmer_hives),
            "batches": len(farmer_batches),
            "honey_produced_kg": round(
                farmer_honey,
                2
            ),
        })

    # --------------------------------------------
    # Return complete regional data
    # --------------------------------------------

    return {
        "region": region_name,

        "summary": {
            "farmers": len(farmers),
            "hives": len(hives),
            "batches": len(batches),
            "honey_produced_kg": round(
                total_honey,
                2
            ),
            "healthy_hives": healthy_hives,
            "at_risk_hives": at_risk_hives,
            "unknown_hives": unknown_hives,
        },

        "farmers": farmer_details,
    }


# ============================================================
# ALL HIVES
# ============================================================

@router.get("/hives")
def admin_hives(db: Session = Depends(get_db)):
    return {
        "items": db.query(Hive).all()
    }


# ============================================================
# ALL BATCHES
# ============================================================

@router.get("/batches")
def admin_batches(db: Session = Depends(get_db)):
    return {
        "items": db.query(HoneyBatch).all()
    }


# ============================================================
# TRACEABILITY
# ============================================================

@router.get("/traceability")
def admin_traceability(
    db: Session = Depends(get_db)
):
    return {
        "items": (
            db.query(TraceabilityEvent)
            .order_by(
                TraceabilityEvent.timestamp.desc()
            )
            .all()
        )
    }