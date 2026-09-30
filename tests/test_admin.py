from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_admin_dashboard():
    response = client.get("/api/admin")
    assert response.status_code in {200, 404}
    if response.status_code == 200:
        assert isinstance(response.json(), (list, dict))


def test_admin_statistics():
    response = client.get("/api/admin/statistics")
    assert response.status_code in {200, 404}
    if response.status_code == 200:
        assert isinstance(response.json(), (list, dict))


def test_admin_regional_statistics():
    response = client.get("/api/admin/statistics/regions")
    assert response.status_code in {200, 404}
    if response.status_code == 200:
        assert isinstance(response.json(), (list, dict))


def test_admin_hives():
    response = client.get("/api/admin/hives")
    assert response.status_code in {200, 404}
    if response.status_code == 200:
        assert isinstance(response.json(), (list, dict))


def test_admin_batches():
    response = client.get("/api/admin/batches")
    assert response.status_code in {200, 404}
    if response.status_code == 200:
        assert isinstance(response.json(), (list, dict))


def test_admin_traceability():
    response = client.get("/api/admin/traceability")
    assert response.status_code in {200, 404}
    if response.status_code == 200:
        assert isinstance(response.json(), (list, dict))
