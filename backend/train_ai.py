import os
import pandas as pd
from pathlib import Path
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
import joblib

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "mspb_dataset_clean.csv"
MODEL_DIR = BASE_DIR / "app" / "services" / "models_ml"

def train_models():
    print("Loading clean MSPB dataset...")
    if not DATA_PATH.exists():
        print("Error: mspb_dataset_clean.csv nahi mila. Pehle prepare_data.py chalao!")
        return

    df = pd.read_csv(DATA_PATH)

    # 3 Features standard model ke liye (Temp, Humidity, Audio)
    X = df[['temperature', 'humidity', 'audio_feature']]
    y_health = df['health_score']
    y_yield = df['honey_yield']

    print("Fitting Scaler...")
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    print("Training Health Model...")
    model_health = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
    model_health.fit(X_scaled, y_health)

    print("Training Yield Model...")
    model_yield = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
    model_yield.fit(X_scaled, y_yield)

    print("Saving models...")
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    
    joblib.dump(scaler, MODEL_DIR / "scaler.joblib")
    joblib.dump(model_health, MODEL_DIR / "model_health.joblib")
    joblib.dump(model_yield, MODEL_DIR / "model_yield.joblib")

    print("Success! Standard ML Models trained and saved successfully.")

if __name__ == "__main__":
    train_models()