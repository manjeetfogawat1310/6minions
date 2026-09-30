import pandas as pd
import numpy as np
import joblib
from sklearn.base import clone
from sklearn.model_selection import train_test_split, KFold
from sklearn.metrics import (accuracy_score, recall_score, classification_report,
                             confusion_matrix, r2_score, mean_absolute_error)

def to_cls(arr):
    return np.where(arr >= 80, 'Healthy', np.where(arr >= 50, 'At Risk', 'High Risk/Critical'))

df = pd.read_csv('data/mspb_dataset_clean.csv').dropna()
print('Total rows:', len(df), '| Duplicate rows:', df.duplicated().sum())

X = df[['temperature', 'humidity', 'weight', 'audio_feature']].values
y = df['health_score'].values
y_cls = to_cls(y)

# Same settings wale fresh (untrained) scaler + model
scaler_base = joblib.load('app/services/models_ml/scaler.joblib')
model_base = joblib.load('app/services/models_ml/model_health.joblib')

# ---------- 1) Hold-out test (80/20) ----------
X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y_cls)

scaler = clone(scaler_base).fit(X_tr)
model = clone(model_base).fit(scaler.transform(X_tr), y_tr)
pred = model.predict(scaler.transform(X_te))

yt, yp = to_cls(y_te), to_cls(pred)
labels = ['Healthy', 'At Risk', 'High Risk/Critical']

print('\n' + '=' * 50)
print('   TEST SET RESULTS (model ne ye data kabhi nahi dekha)')
print('=' * 50)
print(f"Test samples        : {len(y_te)}")
print(f"Accuracy            : {accuracy_score(yt, yp) * 100:.2f}%")
print(f"Macro Recall        : {recall_score(yt, yp, average='macro') * 100:.2f}%")
print(f"R2 Score            : {r2_score(y_te, pred):.4f}")
print(f"MAE                 : {mean_absolute_error(y_te, pred):.2f} pts")
print()
print(classification_report(yt, yp, digits=3))
print(pd.DataFrame(confusion_matrix(yt, yp, labels=labels),
                   index=['True_' + l for l in labels],
                   columns=['Pred_' + l for l in labels]))

# ---------- 2) 5-Fold Cross Validation ----------
accs = []
for tr, te in KFold(n_splits=5, shuffle=True, random_state=42).split(X):
    sc = clone(scaler_base).fit(X[tr])
    m = clone(model_base).fit(sc.transform(X[tr]), y[tr])
    p = m.predict(sc.transform(X[te]))
    accs.append(accuracy_score(to_cls(y[te]), to_cls(p)))

print('\n' + '=' * 50)
print('   5-FOLD CROSS VALIDATION')
print('=' * 50)
print('Fold accuracies :', [f'{a * 100:.2f}%' for a in accs])
print(f'Mean +/- Std    : {np.mean(accs) * 100:.2f}% +/- {np.std(accs) * 100:.2f}%')