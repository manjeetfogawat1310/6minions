from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models import BlockchainRecord, TraceabilityEvent
from app.services.blockchain_service import (
    BlockchainService,
    BlockchainUnavailableError,
)
from app.services.hash_service import sha256_text


SUPPORTED_EVENT_TYPES = {
    "BATCH_CREATED",
    "LAB_REPORT_ADDED",
    "LOCATION_UPDATED",
    "OWNERSHIP_TRANSFERRED",
    "SHIPMENT_CREATED",
    "SHIPMENT_DELIVERED",
}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _timestamp_value(value: Optional[datetime]) -> int:
    selected = value or _utc_now()
    if selected.tzinfo is None:
        selected = selected.replace(tzinfo=timezone.utc)
    return int(selected.timestamp())


def _metadata_json(metadata: Optional[Dict[str, Any]]) -> str:
    return json.dumps(metadata or {}, sort_keys=True, separators=(",", ":"))


def _model_metadata(metadata: Optional[Dict[str, Any]]) -> Any:
    return metadata or {}


def create_traceability_event(
    db: Session,
    blockchain: BlockchainService,
    batch_id: int,
    event_type: str,
    from_party: Optional[str] = None,
    to_party: Optional[str] = None,
    location: Optional[str] = None,
    timestamp: Optional[datetime] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> TraceabilityEvent:
    if event_type not in SUPPORTED_EVENT_TYPES:
        raise ValueError(
            f"Unsupported event type: {event_type}. "
            f"Expected one of: {', '.join(sorted(SUPPORTED_EVENT_TYPES))}"
        )

    event_timestamp = timestamp or _utc_now()
    metadata_text = _metadata_json(metadata)
    blockchain_tx_hash: Optional[str] = None
    block_number: Optional[int] = None

    try:
        if blockchain.available:
            result = blockchain.add_event(
                batch_id=str(batch_id),
                event_type=event_type,
                from_party=from_party or "",
                to_party=to_party or "",
                location=location or "",
                timestamp=_timestamp_value(event_timestamp),
                metadata=metadata_text,
            )
            blockchain_tx_hash = result["transaction_hash"]
            block_number = result.get("block_number")
    except BlockchainUnavailableError:
        if blockchain.required:
            raise

    event = TraceabilityEvent(
        batch_id=batch_id,
        event_type=event_type,
        from_party=from_party,
        to_party=to_party,
        location=location,
        timestamp=event_timestamp,
        blockchain_tx_hash=blockchain_tx_hash,
        metadata=_model_metadata(metadata),
    )
    db.add(event)

    if blockchain_tx_hash:
        record_payload = {
            "batch_id": batch_id,
            "event_type": event_type,
            "from_party": from_party,
            "to_party": to_party,
            "location": location,
            "timestamp": event_timestamp.isoformat(),
            "metadata": metadata or {},
        }
        db.add(
            BlockchainRecord(
                batch_id=batch_id,
                record_type="TRACEABILITY_EVENT",
                data_hash=sha256_text(
                    json.dumps(
                        record_payload,
                        sort_keys=True,
                        separators=(",", ":"),
                    )
                ),
                blockchain_tx_hash=blockchain_tx_hash,
                block_number=block_number,
            )
        )

    db.commit()
    db.refresh(event)
    return event


def create_batch_event(
    db: Session,
    blockchain: BlockchainService,
    batch_id: int,
    metadata: Optional[Dict[str, Any]] = None,
) -> TraceabilityEvent:
    return create_traceability_event(
        db=db,
        blockchain=blockchain,
        batch_id=batch_id,
        event_type="BATCH_CREATED",
        metadata=metadata,
    )


def add_lab_report_event(
    db: Session,
    blockchain: BlockchainService,
    batch_id: int,
    report_number: str,
    report_hash: str,
    laboratory: Optional[str] = None,
) -> TraceabilityEvent:
    event = create_traceability_event(
        db=db,
        blockchain=blockchain,
        batch_id=batch_id,
        event_type="LAB_REPORT_ADDED",
        metadata={
            "report_number": report_number,
            "report_hash": report_hash,
            "laboratory": laboratory,
        },
    )

    return event


def add_lab_hash(
    db: Session,
    blockchain: BlockchainService,
    batch_id: int,
    report_number: str,
    report_hash: str,
) -> Optional[BlockchainRecord]:
    blockchain_tx_hash: Optional[str] = None
    block_number: Optional[int] = None

    try:
        if blockchain.available:
            result = blockchain.add_lab_hash(
                batch_id=str(batch_id),
                report_number=report_number,
                data_hash=report_hash,
            )
            blockchain_tx_hash = result["transaction_hash"]
            block_number = result.get("block_number")
    except BlockchainUnavailableError:
        if blockchain.required:
            raise

    if not blockchain_tx_hash:
        return None

    record = BlockchainRecord(
        batch_id=batch_id,
        record_type="LAB_REPORT",
        data_hash=report_hash,
        blockchain_tx_hash=blockchain_tx_hash,
        block_number=block_number,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
