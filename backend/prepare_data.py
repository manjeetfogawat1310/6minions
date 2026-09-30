import os
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")

def load_sensors():
    path = os.path.join(DATA_DIR, "D1_sensor_data.csv")
    if not os.path.exists(path):
        return pd.DataFrame()
    df = pd.read_csv(path)
    if "hive_power" in df.columns:
        df.rename(columns={"hive_power": "audio_feature"}, inplace=True)
    if "tag_number" in df.columns:
        df["nectar_id"] = df["tag_number"].apply(lambda x: x - 200000 if int(x) > 200000 else int(x))
    return df

def load_pheno():
    path = os.path.join(DATA_DIR, "D1_ant.xlsx")
    if not os.path.exists(path):
        return pd.DataFrame()
    # Sheet 'Phenotypic measurements' with header=None
    df = pd.read_excel(path, sheet_name="Phenotypic measurements", header=None)
    # Col 3 = hive id, col 8 = varroa, col 20 = honey yield
    clean = pd.DataFrame({
        "nectar_id": pd.to_numeric(df.iloc[:, 3], errors="coerce"),
        "varroa": pd.to_numeric(df.iloc[:, 8], errors="coerce"),
        "honey_yield": pd.to_numeric(df.iloc[:, 20], errors="coerce")
    })
    return clean.dropna(subset=["nectar_id"])

def main():
    print("Preparing MSPB dataset...")
    sensors = load_sensors()
    pheno = load_pheno()
    
    if sensors.empty:
        print("Error: D1_sensor_data.csv nahi mila!")
        return

    # Daily aggregation per hive
    sensors['date'] = pd.to_datetime(sensors['date']).dt.strftime('%Y-%m-%d')
    daily = sensors.groupby(['nectar_id', 'date']).agg({
        'temperature': 'mean',
        'humidity': 'mean',
        'audio_feature': 'mean'
    }).reset_index()

    # Merge with phenotypic data if available
    if not pheno.empty:
        df = pd.merge(daily, pheno, on="nectar_id", how="left")
    else:
        df = daily
        df['honey_yield'] = 25.0
        df['varroa'] = 0.0

    df.fillna({'honey_yield': 25.0, 'varroa': 0.0, 'temperature': 35.0, 'humidity': 60.0, 'audio_feature': 1.75}, inplace=True)
    
    # Target feature setup for ML
    df['health_score'] = 85.0 - (df['varroa'] * 2.0)
    df['health_score'] = df['health_score'].clip(10.0, 98.0)

    output_path = os.path.join(DATA_DIR, "mspb_dataset_clean.csv")
    df.to_csv(output_path, index=False)
    print(f"Success! Clean MSPB dataset saved to {output_path}")

if __name__ == "__main__":
    main()