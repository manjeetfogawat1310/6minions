from datetime import date, timedelta
from app.database import SessionLocal, init_db

# 'backend.' hata diya gaya hai
from app.models import Farmer, Hive, AIResult, HoneyBatch, LabReport, TraceabilityEvent, Admin
from app.main import hash_password
from app.services.ai_service import predict

import json

def run():
 init_db(); db=SessionLocal()
 try:
  # ====== ADMIN SEEDING LOGIC ======
  # Check karte hain ki Admin already hai ya nahi
  if not db.query(Admin).filter_by(admin_id="Admin").first():
   hashed_pw = hash_password("abc123")
   # Agar tere database mein column ka naam 'password' hai, toh 'password_hash' ki jagah 'password' likhna
   admin = Admin(admin_id="Admin", password_hash=hashed_pw) 
   db.add(admin)
   db.commit() # Admin ko turant save kar diya
   print("Demo Admin (Admin / abc123) created successfully.")
  # =================================

  if db.query(Farmer).count(): print('Seed already present'); return
  
  regions=['West Bengal','Bihar','Jharkhand','Odisha']; farmers=[]
  for i in range(3):
   f=Farmer(name=f'Demo Farmer {i+1}',age=31+i*7,phone=f'900000000{i+1}',region=regions[i],village=f'Demo Village {i+1}'); db.add(f); farmers.append(f)
  db.flush(); hives=[]
  for i in range(10):
   h=Hive(farmer_id=farmers[i%3].id,hive_code=f'HIVE-{i+1:02d}',location=f'Apiary Zone {i%4+1}'); db.add(h); hives.append(h)
  db.flush(); scenarios=[(27,58,42,20),(39,48,38,35),(29,86,40,42),(26,55,12,24),(31,74,28,91)]
  for i,(t,h,w,a) in enumerate(scenarios):
    p=predict(t,h,w,a); db.add(AIResult(hive_id=hives[i].id,temperature=t,humidity=h,weight=w,audio_feature=a,health_score=p.health_score,health_status=p.health_status,disease_risk=p.disease_risk,predicted_yield_kg=p.predicted_yield_kg,environmental_stress=p.environmental_stress,explanation=p.explanation))
  db.flush()
  for i in range(5):
   b=HoneyBatch(batch_id=f'DEMO-{i+1:03d}',hive_id=hives[i].id,farmer_id=hives[i].farmer_id,honey_type=['Multifloral','Mustard','Litchi','Sundarbans','Forest'][i],quantity_kg=25+i*7,harvest_date=str(date.today()-timedelta(days=30-i*3)),current_location=f'{regions[i%4]} Collection Center',current_owner='Farmer',status='AVAILABLE',region=regions[i%4],ai_health_status=db.query(AIResult).filter_by(hive_id=hives[i].id).first().health_status,ai_disease_risk=db.query(AIResult).filter_by(hive_id=hives[i].id).first().disease_risk,ai_predicted_yield=db.query(AIResult).filter_by(hive_id=hives[i].id).first().predicted_yield_kg); db.add(b); db.flush(); db.add(TraceabilityEvent(batch_id=b.id,event_type='BATCH_CREATED',from_party='Farmer',to_party='Collection Center',location=b.current_location,event_metadata=json.dumps({'seed':True}))); db.add(LabReport(batch_id=b.id,report_number=f'LAB-{i+1:03d}',laboratory='Demo Food Testing Lab',test_date=str(date.today()-timedelta(days=20)),moisture=18.0+i*0.3,purity=98.5-i*0.4,quality_grade=['A','A','A','B','A'][i],report_content='DEMO LAB REPORT â€” simulated seed record'))
  db.commit(); print('Seeded 3 farmers, 10 hives, 5 batches.')
 finally: db.close()

if __name__=='__main__': run()