import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Ensure the same schema used by the application exists before API tests run.
from backend.app.database import init_db
init_db()
