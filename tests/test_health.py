from fastapi.testclient import TestClient
from backend.app.main import app
def test_health():
 with TestClient(app) as c: assert c.get('/health').status_code==200
