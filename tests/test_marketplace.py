from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def _get(**params):
    return client.get("/api/marketplace", params=params)


def test_marketplace_list():
    response = _get()
    assert response.status_code == 200
    assert isinstance(response.json(), (list, dict))


def test_marketplace_region_filter():
    response = _get(region="West Bengal")
    assert response.status_code == 200


def test_marketplace_honey_type_filter():
    response = _get(honey_type="mustard")
    assert response.status_code == 200


def test_marketplace_minimum_quantity_filter():
    response = _get(min_quantity=20)
    assert response.status_code == 200


def test_marketplace_availability_filter():
    response = _get(availability="available")
    assert response.status_code == 200


def test_marketplace_lab_status_filter():
    response = _get(lab_status="passed")
    assert response.status_code == 200


def test_marketplace_health_status_filter_if_supported():
    response = _get(health_status="healthy")
    assert response.status_code in {200, 400, 404, 422}
