import pandas as pd

xls = pd.ExcelFile('data/D1_ant.xlsx')

print("--- 1. READ ME SHEET KA CONTENT ---")
try:
    df_readme = pd.read_excel(xls, 'READ ME').dropna(how='all')
    print(df_readme.head(10))
except Exception as e:
    print("README error:", e)

print("\n--- 2. TAG NUMBER 200602 KAHAAN CHHUPA HAI? ---")
found = False
for s in xls.sheet_names:
    df = pd.read_excel(xls, s)
    for c in df.columns:
        if df[c].astype(str).str.contains('200602').any():
            print(f"👉 Mila! Sheet: '{s}', Column: '{c}'")
            found = True

if not found:
    print("Tag number 200602 Excel ki kisi cell mein direct nahi mila (formula/convention check karenge).")