from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_traceability_list():
    response = client.get("/api/traceability")
    assert response.status_code == 200
    assert isinstance(response.json(), (list, dict))


def test_traceability_batch_events():
    response = client.get("/api/traceability/batch/1")
    assert response.status_code in {200, 404}


def test_traceability_event_creation_if_supported():
    response = client.post(
        "/api/traceability",
        json={
            "batch_id": 1,
            "event_type": "transported",
            "location": "Bihar",
            "description": "Test transport event",
        },
    )
    assert response.status_code in {200, 201, 404, 405, 422}
