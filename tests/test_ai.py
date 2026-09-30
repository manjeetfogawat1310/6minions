from backend.app.services.ai_service import predict
def test_ai(): assert predict(27,58,42,20).health_score>80
