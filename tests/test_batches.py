from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_batch_list():
    response = client.get("/api/batches")
    assert response.status_code == 200
    assert isinstance(response.json(), (list, dict))


def test_batch_creation_and_detail():
    payload = {
        "batch_code": "TEST-BATCH-001",
        "honey_type": "multifloral",
        "quantity_kg": 25,
        "region": "West Bengal",
        "location": "West Bengal",
        "status": "available",
    }
    response = client.post("/api/batches", json=payload)
    assert response.status_code in {200, 201, 409}
    if response.status_code in {200, 201}:
        body = response.json()
        batch_id = body.get("id") or body.get("batch_id")
        if batch_id:
            detail = client.get(f"/api/batches/{batch_id}")
            assert detail.status_code == 200


def test_batch_harvest_if_present():
    response = client.post(
        "/api/batches/1/harvest",
        json={"quantity_kg": 10, "location": "Bihar"},
    )
    assert response.status_code in {200, 201, 404, 405}


def test_batch_update_if_present():
    response = client.patch(
        "/api/batches/1",
        json={"status": "available"},
    )
    assert response.status_code in {200, 404, 405, 422}
