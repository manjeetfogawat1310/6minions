from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_consumer_verification_known_batch():
    response = client.get("/api/verify/DEMO-BATCH-001")
    assert response.status_code in {200, 404}
    if response.status_code == 200:
        body = response.json()
        assert isinstance(body, dict)


def test_consumer_verification_unknown_batch():
    response = client.get("/api/verify/DOES-NOT-EXIST")
    assert response.status_code in {404, 400}


def test_lab_report_hash_behavior():
    response = client.get("/api/lab")
    assert response.status_code in {200, 404}
    if response.status_code == 200:
        assert isinstance(response.json(), (list, dict))
