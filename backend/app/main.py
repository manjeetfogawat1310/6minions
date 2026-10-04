from pathlib import Path
from datetime import datetime, timezone
import json, os, hashlib, secrets
import qrcode
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import desc
from .config import get_settings
from .database import get_db, init_db
from .models import *
from .schemas import *
from .services.ai_service import predict
from .services.hash_service import sha256_text, sha256_bytes
from .services.qr_service import create_qr
from .services.blockchain_service import BlockchainService, BlockchainUnavailableError
from .schemas import FarmerCreate

s=get_settings(); app=FastAPI(title=s.app_name,version='1.0.0')
cors_origins = s.cors_origin_list

if isinstance(cors_origins, list):
    origins = [
        x.strip()
        for x in cors_origins
        if x.strip()
    ]
else:
    origins = [
        x.strip()
        for x in cors_origins.split(",")
        if x.strip()
    ]
@app.on_event('startup')
def startup():
    init_db()
    s.qr_path.mkdir(parents=True, exist_ok=True)
    s.upload_path.mkdir(parents=True, exist_ok=True)

    # Automatically anchor all DEMO records on the blockchain.
    sync_demo_blockchain()


def sync_demo_blockchain():
    db = next(get_db())

    try:
        bc = BlockchainService()

        if not bc.available:
            print("BLOCKCHAIN SYNC: unavailable")
            print(f"BLOCKCHAIN ERROR: {bc.error}")
            return

        demo_batches = (
            db.query(HoneyBatch)
            .filter(HoneyBatch.batch_id.like("DEMO-%"))
            .all()
        )

        print(f"BLOCKCHAIN SYNC: found {len(demo_batches)} demo batches")

        for batch in demo_batches:

            # -------------------------------------------------
            # 1. DEMO BATCH
            # -------------------------------------------------
            try:
                chain_batch = bc.get_batch(batch.batch_id)

                # Contract returns empty batch_id when it does not exist
                batch_exists = bool(
                    chain_batch
                    and len(chain_batch) >= 6
                    and chain_batch[0] == batch.batch_id
                    and chain_batch[5] is True
                )

                if not batch_exists:
                    tx_hash, block_number = bc.create_batch(
                        batch.batch_id,
                        batch.farmer_id,
                        batch.honey_type,
                        batch.quantity_kg,
                        batch.harvest_date,
                    )

                    existing_record = (
                        db.query(BlockchainRecord)
                        .filter_by(
                            batch_id=batch.id,
                            record_type="BATCH_CREATED",
                        )
                        .first()
                    )

                    if existing_record:
                        existing_record.blockchain_tx_hash = tx_hash
                        existing_record.block_number = block_number
                    else:
                        db.add(
                            BlockchainRecord(
                                batch_id=batch.id,
                                record_type="BATCH_CREATED",
                                blockchain_tx_hash=tx_hash,
                                block_number=block_number,
                            )
                        )

                    db.commit()

                    print(
                        f"BLOCKCHAIN SYNC: {batch.batch_id} batch anchored"
                    )

                else:
                    print(
                        f"BLOCKCHAIN SYNC: {batch.batch_id} already exists"
                    )

            except Exception as e:
                db.rollback()
                print(
                    f"BLOCKCHAIN SYNC: batch {batch.batch_id} failed: {e}"
                )

            # -------------------------------------------------
            # 2. DEMO LAB REPORTS
            # -------------------------------------------------
            reports = (
                db.query(LabReport)
                .filter(LabReport.batch_id == batch.id)
                .all()
            )

            for report in reports:

                if not report.sha256_hash:
                    continue

                try:
                    chain_lab = bc.get_lab_hash(
                        batch.batch_id,
                        report.report_number,
                    )

                    lab_exists = bool(
                        chain_lab
                        and len(chain_lab) >= 3
                        and chain_lab[2] == report.sha256_hash
                    )

                    if not lab_exists:

                        tx_hash, block_number = bc.add_lab_hash(
                            batch.batch_id,
                            report.report_number,
                            report.sha256_hash,
                        )

                        report.blockchain_tx_hash = tx_hash

                        record = (
                            db.query(BlockchainRecord)
                            .filter_by(
                                batch_id=batch.id,
                                record_type="LAB_REPORT_ADDED",
                                data_hash=report.sha256_hash,
                            )
                            .first()
                        )

                        if record:
                            record.blockchain_tx_hash = tx_hash
                            record.block_number = block_number
                        else:
                            db.add(
                                BlockchainRecord(
                                    batch_id=batch.id,
                                    record_type="LAB_REPORT_ADDED",
                                    data_hash=report.sha256_hash,
                                    blockchain_tx_hash=tx_hash,
                                    block_number=block_number,
                                )
                            )

                        db.commit()

                        print(
                            f"BLOCKCHAIN SYNC: "
                            f"{batch.batch_id}/{report.report_number} "
                            f"lab hash anchored"
                        )

                    else:
                        if not report.blockchain_tx_hash:
                            # Blockchain already contains the hash,
                            # so we don't create another transaction.
                            report.blockchain_tx_hash = "EXISTING_ON_CHAIN"
                            db.commit()

                        print(
                            f"BLOCKCHAIN SYNC: "
                            f"{batch.batch_id}/{report.report_number} "
                            f"lab already exists"
                        )

                except Exception as e:
                    db.rollback()
                    print(
                        f"BLOCKCHAIN SYNC: "
                        f"{batch.batch_id}/{report.report_number} "
                        f"failed: {e}"
                    )

    finally:
        db.close()
@app.get('/health')
def health(db:Session=Depends(get_db)):
 return {'status':'ok','service':'Honey Chain','database':'connected','blockchain_configured':BlockchainService().available}
@app.get('/api/health')
def api_health(): return health()

def hash_password(password):
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000
    ).hex()
    return f"{salt}${hashed}"

def verify_password(password, stored_hash):
    if not stored_hash or "$" not in stored_hash:
        return False

    salt, expected_hash = stored_hash.split("$", 1)

    actual_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000
    ).hex()

    return secrets.compare_digest(actual_hash, expected_hash)

def farmer_dict(f):
    return {
        'id': f.id,
        'name': f.name,
        'age': f.age,
        'phone': f.phone,
        'region': f.region,
        'district': f.district or '',
        'village': f.village or ''
    }
# =========================
# FARMER MANAGEMENT
# =========================

@app.get('/api/farmers')
def get_farmers(db: Session = Depends(get_db)):
    farmers = db.query(Farmer).order_by(Farmer.id).all()

    return [
        {
            "id": farmer.id,
            "name": farmer.name,
            "age": farmer.age,
            "phone": farmer.phone,
            "region": farmer.region,
            "district": farmer.district or "",
            "village": farmer.village or "",
            "created_at": (
                farmer.created_at.isoformat()
                if farmer.created_at
                else None
            ),
        }
        for farmer in farmers
    ]


@app.post('/api/farmers')
def create_farmer(
    data: FarmerCreate,
    db: Session = Depends(get_db)
):

    farmer = Farmer(
        name=data.name,
        age=data.age,
        phone=data.phone,
        region=data.region,
        district=data.district,
        village=data.village,
        password_hash=hash_password(data.password),
    )

    db.add(farmer)
    db.commit()
    db.refresh(farmer)

    return {
        "id": farmer.id,
        "name": farmer.name,
        "age": farmer.age,
        "phone": farmer.phone,
        "region": farmer.region,
        "district": farmer.district or "",
        "village": farmer.village or "",
        "created_at": (
            farmer.created_at.isoformat()
            if farmer.created_at
            else None
        ),
    }
@app.post('/api/auth/farmer/login')
def farmer_login(
    data: FarmerLogin,
    db: Session = Depends(get_db)
):
    farmer = db.query(Farmer).filter(
        Farmer.id == data.farmer_id
    ).first()

    if not farmer:
        raise HTTPException(
            status_code=401,
            detail="Invalid Farmer ID or password"
        )

    if not verify_password(
        data.password,
        farmer.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid Farmer ID or password"
        )

    return {
        "success": True,
        "user_type": "farmer",
        "farmer": farmer_dict(farmer)
    }


@app.post('/api/admin/create')
def create_admin(
    data: AdminCreate,
    db: Session = Depends(get_db)
):
    existing = db.query(Admin).filter(
        Admin.admin_id == data.admin_id
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Admin ID already exists"
        )

    admin = Admin(
        admin_id=data.admin_id,
        state=data.state,
        district=data.district,
        password_hash=hash_password(data.password),
    )

    db.add(admin)
    db.commit()
    db.refresh(admin)

    return {
        "success": True,
        "admin": {
            "id": admin.id,
            "admin_id": admin.admin_id,
            "state": admin.state,
            "district": admin.district,
        }
    }


@app.post('/api/auth/admin/login')
def admin_login(
    data: AdminLogin,
    db: Session = Depends(get_db)
):
    admin = db.query(Admin).filter(
        Admin.admin_id == data.admin_id
    ).first()

    if not admin:
        raise HTTPException(
            status_code=401,
            detail="Invalid Admin ID or password"
        )

    if not verify_password(
        data.password,
        admin.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid Admin ID or password"
        )

    return {
        "success": True,
        "user_type": "admin",
        "admin": {
            "id": admin.id,
            "admin_id": admin.admin_id,
            "state": admin.state,
            "district": admin.district,
        }
    }
def hive_dict(h,db):
 latest=db.query(AIResult).filter(AIResult.hive_id==h.id).order_by(desc(AIResult.created_at)).first()
 return {'id':h.id,'hive_id':h.id,'hive_code':h.hive_code,'name':h.hive_code,'farmer_id':h.farmer_id,'farmer_name':h.farmer.name if h.farmer else None,'region':h.farmer.region if h.farmer else None,'location':h.location,'latest_ai':ai_dict(latest) if latest else None}


def ai_dict(x): return {'id':x.id,'hive_id':x.hive_id,'temperature':x.temperature,'humidity':x.humidity,'weight':x.weight,'audio_feature':x.audio_feature,'health_score':x.health_score,'health_status':x.health_status,'disease_risk':x.disease_risk,'predicted_yield_kg':x.predicted_yield_kg,'environmental_stress':x.environmental_stress,'explanation':x.explanation,'created_at':x.created_at.isoformat() if x.created_at else None}
def batch_dict(b,db):
 labs=db.query(LabReport).filter(LabReport.batch_id==b.id).all(); ev=db.query(TraceabilityEvent).filter(TraceabilityEvent.batch_id==b.id).order_by(TraceabilityEvent.timestamp).all(); br=db.query(BlockchainRecord).filter(BlockchainRecord.batch_id==b.id).all()
 return {'id':b.id,'batch_id':b.batch_id,'hive_id':b.hive_id,'farmer_id':b.farmer_id,'honey_type':b.honey_type,'quantity':b.quantity_kg,'quantity_kg':b.quantity_kg,'available_quantity':b.quantity_kg if b.status=='AVAILABLE' else 0,'harvest_date':b.harvest_date,'location':b.current_location,'current_location':b.current_location,'region':b.region,'current_owner':b.current_owner,'status':b.status,'ai_health_status':b.ai_health_status,'ai_disease_risk':b.ai_disease_risk,'ai_predicted_yield':b.ai_predicted_yield,'qr_url':f"{s.public_base_url.rstrip('/')}/verify/{b.batch_id}",'qr_code':f"/api/batches/{b.batch_id}/qr",'lab_status':'Verified' if labs else 'Pending','lab_report':lab_dict(labs[-1]) if labs else None,'blockchain_status':'VERIFIED' if br else 'NOT_VERIFIED','transaction_hash':br[-1].blockchain_tx_hash if br else None,'traceability':event_dicts(ev)}
def lab_dict(l): return {'id':l.id,'batch_id':l.batch_id,'report_number':l.report_number,'laboratory':l.laboratory,'test_date':l.test_date,'moisture':l.moisture,'purity':l.purity,'quality_grade':l.quality_grade,'report_file_name':l.report_file_name,'sha256_hash':l.sha256_hash,'blockchain_tx_hash':l.blockchain_tx_hash}
def event_dicts(es): return [{'id':e.id,'event_type':e.event_type,'from_party':e.from_party,'to_party':e.to_party,'location':e.location,'timestamp':e.timestamp.isoformat() if e.timestamp else None,'metadata':json.loads(e.event_metadata) if e.event_metadata else {},'blockchain_tx_hash':e.blockchain_tx_hash} for e in es]

@app.get('/api/hives')
def hives(db:Session=Depends(get_db)): return {'hives':[hive_dict(h,db) for h in db.query(Hive).all()]}
@app.post('/api/hives')
def create_hive(payload:dict,db:Session=Depends(get_db)):
 if not db.get(Farmer,payload.get('farmer_id')): raise HTTPException(404,'Farmer not found')
 h=Hive(farmer_id=payload['farmer_id'],hive_code=payload.get('hive_code') or payload.get('name') or f'HIVE-{datetime.now().timestamp():.0f}',location=payload.get('location','')); db.add(h); db.commit(); db.refresh(h); return hive_dict(h,db)
@app.get('/api/hives/{hive_id}/history')
def hive_history(hive_id:int,db:Session=Depends(get_db)):
 if not db.get(Hive,hive_id): raise HTTPException(404,'Hive not found')
 return {'history':[ai_dict(x) for x in db.query(AIResult).filter(AIResult.hive_id==hive_id).order_by(AIResult.created_at).all()]}

@app.get('/api/hives/{hive_id}')
def get_hive(hive_id:int,db:Session=Depends(get_db)):
    h=db.get(Hive,hive_id)
    if not h:
        raise HTTPException(404,'Hive not found')
    return hive_dict(h,db)

@app.post('/api/ai/predict')
def ai_predict(payload:AIPredictRequest,db:Session=Depends(get_db)):
 p=predict(payload.temperature,payload.humidity,payload.weight,payload.audio_feature)
 if payload.hive_id:
  h=db.get(Hive,payload.hive_id)
  if not h: raise HTTPException(404,'Hive not found')
  row=AIResult(hive_id=h.id,temperature=payload.temperature,humidity=payload.humidity,weight=payload.weight,audio_feature=payload.audio_feature,health_score=p.health_score,health_status=p.health_status,disease_risk=p.disease_risk,predicted_yield_kg=p.predicted_yield_kg,environmental_stress=p.environmental_stress,explanation=p.explanation); db.add(row); db.commit()
 return p.__dict__
@app.post('/api/ai/estimate-weight')
def estimate_weight(payload:AIPredictRequest):
 from .services.ai_service import estimate_weight
 return {'estimated_weight_kg':round(estimate_weight(payload.temperature,payload.humidity,payload.weight,payload.audio_feature),2),'method_note':'Operational 4-sensor estimator; not a reproduction of the Apis-Prime 36→23-feature trained model.'}


@app.post('/api/ai/predict-yield')
def predict_yield(payload: dict):
    """Phenotype-model endpoint; feature order is phenotype_col_4 through _19."""
    from .services.ai_service import predict_yield_from_phenotype
    features = payload.get('features')
    if not isinstance(features, list):
        raise HTTPException(400, "Send JSON with a 'features' array of 16 values.")
    try:
        value = predict_yield_from_phenotype(features)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except RuntimeError as exc:
        raise HTTPException(503, str(exc))
    except (TypeError, OverflowError) as exc:
        raise HTTPException(400, "Feature values must be numeric or null.")
    return {
        'predicted_yield_kg': value,
        'model': 'phenotypic RandomForest prototype',
        'feature_order': [f'phenotype_col_{i}' for i in range(4, 20)],
        'note': 'Exploratory model trained on 46 labeled hives; not validated for deployment.'
    }

@app.get('/api/ai/history/{hive_id}')
def ai_history(hive_id:int,db:Session=Depends(get_db)): return {'history':[ai_dict(x) for x in db.query(AIResult).filter(AIResult.hive_id==hive_id).order_by(AIResult.created_at).all()]}
@app.get('/api/ai/scenarios')
def scenarios(): return {'scenarios':[{'name':'Healthy Hive','temperature':27,'humidity':58,'weight':42,'audio_feature':20},{'name':'Heat Stress','temperature':39,'humidity':48,'weight':38,'audio_feature':35},{'name':'High Humidity','temperature':29,'humidity':86,'weight':40,'audio_feature':42},{'name':'Low Weight','temperature':26,'humidity':55,'weight':12,'audio_feature':24},{'name':'Disease Risk','temperature':31,'humidity':74,'weight':28,'audio_feature':91}]}

@app.get('/api/batches')
def batches(db:Session=Depends(get_db)): return {'batches':[batch_dict(b,db) for b in db.query(HoneyBatch).all()]}
@app.get('/api/batches/{batch_id}')
def get_batch(batch_id:str,db:Session=Depends(get_db)):
 b=db.query(HoneyBatch).filter(HoneyBatch.batch_id==batch_id).first();
 if not b: raise HTTPException(404,'Batch not found')
 return {'batch':batch_dict(b,db)}
@app.get('/api/batches/{batch_id}/qr')
def batch_qr(batch_id:str,db:Session=Depends(get_db)):
 b=db.query(HoneyBatch).filter(HoneyBatch.batch_id==batch_id).first();
 if not b: raise HTTPException(404,'Batch not found')
 p,_=create_qr(b.batch_id); return FileResponse(p,media_type='image/png')
@app.post('/api/batches')
def create_batch(payload:dict,db:Session=Depends(get_db)):
 if 'farmer_id' not in payload or 'hive_id' not in payload:
  farmer=db.query(Farmer).first(); hive=db.query(Hive).first()
  if not farmer or not hive: raise HTTPException(404,'Seed farmer/hive not found')
  payload=payload.copy(); payload['farmer_id']=farmer.id; payload['hive_id']=hive.id; payload['batch_id']=payload.get('batch_id') or payload.get('batch_code'); payload['quantity']=payload.get('quantity',payload.get('quantity_kg',1)); payload['location']=payload.get('location','West Bengal'); payload['region']=payload.get('region',farmer.region); payload['status']=str(payload.get('status','AVAILABLE')).upper(); payload['current_owner']='Farmer'; payload['honey_type']=payload.get('honey_type','Honey'); payload['harvest_date']=payload.get('harvest_date',str(datetime.now().date()))
 payload=BatchCreate(**payload)
 if not db.get(Farmer,payload.farmer_id): raise HTTPException(404,'Farmer not found')
 if not db.get(Hive,payload.hive_id): raise HTTPException(404,'Hive not found')
 bid=payload.batch_id or f'HC-{datetime.now().strftime("%Y%m%d%H%M%S")}-{os.urandom(2).hex().upper()}'
 if db.query(HoneyBatch).filter_by(batch_id=bid).first(): raise HTTPException(409,'Batch ID already exists')
 latest=db.query(AIResult).filter_by(hive_id=payload.hive_id).order_by(desc(AIResult.created_at)).first()
 b=HoneyBatch(batch_id=bid,hive_id=payload.hive_id,farmer_id=payload.farmer_id,honey_type=payload.honey_type,quantity_kg=payload.quantity,harvest_date=payload.harvest_date,current_location=payload.location,current_owner=payload.current_owner,status=payload.status,region=payload.region,ai_health_status=latest.health_status if latest else None,ai_disease_risk=latest.disease_risk if latest else None,ai_predicted_yield=latest.predicted_yield_kg if latest else None); db.add(b); db.commit(); db.refresh(b); create_qr(b.batch_id)
 bc=BlockchainService(); br=None
 try:
  if bc.available:
   tx,bn=bc.create_batch(b.batch_id,b.farmer_id,b.honey_type,b.quantity_kg,b.harvest_date); br=BlockchainRecord(batch_id=b.id,record_type='BATCH_CREATED',blockchain_tx_hash=tx,block_number=bn); db.add(br)
  elif s.blockchain_required: raise HTTPException(503,'Blockchain is required but unavailable')
 except BlockchainUnavailableError:
  if s.blockchain_required: raise HTTPException(503,'Blockchain unavailable')
 db.add(TraceabilityEvent(batch_id=b.id,event_type='BATCH_CREATED',from_party='Farmer',to_party='Collection Center',location=b.current_location,event_metadata=json.dumps({'source':'Honey Chain application'})))
 db.commit(); return {'batch':batch_dict(b,db)}
@app.post('/api/batches/{batch_id}/harvest')
def harvest(batch_id:str,payload:dict,db:Session=Depends(get_db)):
 b=db.query(HoneyBatch).filter_by(batch_id=batch_id).first();
 if not b: raise HTTPException(404,'Batch not found')
 b.quantity_kg=float(payload.get('quantity',b.quantity_kg)); b.harvest_date=payload.get('harvest_date',b.harvest_date); b.current_location=payload.get('location',b.current_location); b.status='AVAILABLE'; db.add(TraceabilityEvent(batch_id=b.id,event_type='BATCH_CREATED',from_party='Hive',to_party='Collection Center',location=b.current_location,event_metadata=json.dumps({'harvest_quantity_kg':b.quantity_kg}))); db.commit(); return {'batch':batch_dict(b,db)}

@app.post('/api/lab/reports')
def add_lab(payload:LabReportCreate,db:Session=Depends(get_db)):
 b=db.query(HoneyBatch).filter_by(batch_id=payload.report_number.split('-')[0]).first()
 # normal route uses batch_id query/form, retained below; this endpoint is a simple JSON convenience
 raise HTTPException(400,'Use /api/lab/reports/{batch_id} for a lab report')
@app.post('/api/lab/reports/{batch_id}')
def lab_report(batch_id:str,payload:LabReportCreate,db:Session=Depends(get_db)):
 b=db.query(HoneyBatch).filter_by(batch_id=batch_id).first();
 if not b: raise HTTPException(404,'Batch not found')
 content=payload.report_content or json.dumps(payload.model_dump(),sort_keys=True); h=sha256_text(content); l=LabReport(batch_id=b.id,report_number=payload.report_number,laboratory=payload.laboratory,test_date=payload.test_date,moisture=payload.moisture,purity=payload.purity,quality_grade=payload.quality_grade,report_file_name=payload.report_file_name,report_content=content,sha256_hash=h); db.add(l); db.commit(); db.refresh(l)
 bc=BlockchainService()
 if bc.available:
  try: tx,bn=bc.add_lab_hash(batch_id,l.report_number,h); l.blockchain_tx_hash=tx; db.add(BlockchainRecord(batch_id=b.id,record_type='LAB_REPORT_ADDED',data_hash=h,blockchain_tx_hash=tx,block_number=bn)); db.commit()
  except Exception: pass
 db.add(TraceabilityEvent(batch_id=b.id,event_type='LAB_REPORT_ADDED',from_party='Laboratory',to_party='Processor',location=b.current_location,metadata=json.dumps({'report_number':l.report_number,'sha256':h}))); db.commit()
 return {'report':lab_dict(l),'hash':h,'blockchain_verified':bool(l.blockchain_tx_hash)}
@app.get('/api/lab/reports/{batch_id}')
def lab_reports(batch_id:str,db:Session=Depends(get_db)):
 b=db.query(HoneyBatch).filter_by(batch_id=batch_id).first();
 if not b: raise HTTPException(404,'Batch not found')
 return {'reports':[lab_dict(x) for x in db.query(LabReport).filter_by(batch_id=b.id).all()]}
@app.post('/api/lab/upload')
async def lab_upload(
    batch_id: str = Form(...),
    report_number: str = Form(...),
    laboratory: str = Form(...),
    test_date: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    data = await file.read()

    if len(data) > s.max_report_size_bytes:
        raise HTTPException(413, 'File too large')

    b = db.query(HoneyBatch).filter_by(batch_id=batch_id).first()

    if not b:
        raise HTTPException(404, 'Batch not found')

    # Calculate SHA-256
    h = sha256_bytes(data)

    # Save uploaded file
    s.upload_path.mkdir(parents=True, exist_ok=True)
    (s.upload_path / file.filename).write_bytes(data)

    # Create database lab report
    l = LabReport(
        batch_id=b.id,
        report_number=report_number,
        laboratory=laboratory,
        test_date=test_date,
        report_file_name=file.filename,
        report_content=data.decode('utf-8', 'replace'),
        sha256_hash=h
    )

    db.add(l)
    db.commit()
    db.refresh(l)

    # Anchor SHA-256 hash on blockchain
    blockchain_tx_hash = None

    try:
        bc = BlockchainService()

        if bc.available:
            blockchain_tx_hash, _ = bc.add_lab_hash(
                batch_id,
                report_number,
                h
            )

            # Store blockchain transaction hash in database
            l.blockchain_tx_hash = blockchain_tx_hash
            db.commit()
            db.refresh(l)

    except Exception as e:
        print(f"Blockchain lab anchoring failed: {e}")

    return {
    'report': lab_dict(l),
    'hash': h,
    'blockchain_tx_hash': blockchain_tx_hash,
    'blockchain_verified': bool(blockchain_tx_hash)
}


@app.get('/api/lab/verify/{batch_id}/{report_number}')
def verify_lab(batch_id: str, report_number: str, db: Session = Depends(get_db)):
    b = db.query(HoneyBatch).filter_by(batch_id=batch_id).first()

    if not b:
        raise HTTPException(404, 'Batch not found')

    l = (
        db.query(LabReport)
        .filter_by(
            batch_id=b.id,
            report_number=report_number
        )
        .order_by(LabReport.id.desc())
        .first()
    )

    if not l:
        raise HTTPException(404, 'Report not found')

    # ---------------------------------------------------------
    # IMPORTANT:
    # Uploaded files were originally hashed as RAW BYTES.
    # Therefore verification must hash the original file bytes,
    # NOT the decoded report_content text.
    # ---------------------------------------------------------

    calculated = None

    if l.report_file_name:
        file_path = s.upload_path / l.report_file_name

        if file_path.exists():
            calculated = sha256_bytes(
                file_path.read_bytes()
            )

    # Fallback for reports created through JSON/text endpoint
    if calculated is None:
        calculated = sha256_text(
            l.report_content or ''
        )

    # ---------------------------------------------------------
    # OFF-CHAIN VERIFICATION
    # ---------------------------------------------------------

    off_chain_verified = (
        calculated.lower() == (l.sha256_hash or '').lower()
    )

    # ---------------------------------------------------------
    # BLOCKCHAIN VERIFICATION
    # ---------------------------------------------------------

    bc = BlockchainService()

    chain = (
        bc.get_lab_hash(batch_id, report_number)
        if bc.available
        else None
    )

    blockchain_verified = bool(
        chain
        and len(chain) >= 3
        and str(chain[2]).lower() == str(l.sha256_hash).lower()
    )

    return {
        'verified_off_chain': off_chain_verified,
        'calculated_hash': calculated,
        'stored_hash': l.sha256_hash,
        'blockchain_verified': blockchain_verified,
        'blockchain_record': chain,
    }
@app.get('/api/traceability')
def trace_all(db:Session=Depends(get_db)):
 return {'events':[x for b in db.query(HoneyBatch).all() for x in event_dicts(db.query(TraceabilityEvent).filter_by(batch_id=b.id).order_by(TraceabilityEvent.timestamp).all())]}
@app.get('/api/traceability/batch/{batch_id}')
def trace_batch_compat(batch_id:int,db:Session=Depends(get_db)):
 b=db.get(HoneyBatch,batch_id)
 if not b: raise HTTPException(404,'Batch not found')
 return {'events':event_dicts(db.query(TraceabilityEvent).filter_by(batch_id=b.id).order_by(TraceabilityEvent.timestamp).all())}
@app.post('/api/traceability')
def trace_compat(payload:dict,db:Session=Depends(get_db)):
 b=db.get(HoneyBatch,payload.get('batch_id'))
 if not b: raise HTTPException(404,'Batch not found')
 e=TraceabilityEvent(batch_id=b.id,event_type=payload.get('event_type','EVENT'),from_party=payload.get('from_party','Unknown'),to_party=payload.get('to_party','Unknown'),location=payload.get('location','Unknown'),event_metadata=json.dumps({'description':payload.get('description','')})); db.add(e); db.commit(); db.refresh(e); return {'event':event_dicts([e])[0]}

@app.get('/api/traceability/{batch_id}')
def trace(batch_id:str,db:Session=Depends(get_db)):
 b=db.query(HoneyBatch).filter_by(batch_id=batch_id).first();
 if not b: raise HTTPException(404,'Batch not found')
 return {'events':event_dicts(db.query(TraceabilityEvent).filter_by(batch_id=b.id).order_by(TraceabilityEvent.timestamp).all())}
@app.post('/api/traceability/{batch_id}')
def add_trace(batch_id:str,payload:TraceabilityEventCreate,db:Session=Depends(get_db)):
 b=db.query(HoneyBatch).filter_by(batch_id=batch_id).first();
 if not b: raise HTTPException(404,'Batch not found')
 e=TraceabilityEvent(batch_id=b.id,event_type=payload.event_type,from_party=payload.from_party,to_party=payload.to_party,location=payload.location,event_metadata=json.dumps(payload.metadata)); db.add(e); db.commit(); db.refresh(e)
 bc=BlockchainService()
 if bc.available:
  try: tx,bn=bc.add_event(batch_id,payload.event_type,payload.from_party,payload.to_party,payload.location,int(datetime.now(timezone.utc).timestamp()),json.dumps(payload.metadata)); e.blockchain_tx_hash=tx; db.add(BlockchainRecord(batch_id=b.id,record_type=payload.event_type,blockchain_tx_hash=tx,block_number=bn)); db.commit()
  except Exception: pass
 return {'event':event_dicts([e])[0]}

@app.get('/verify/{batch_id}',response_class=HTMLResponse)
def public_verify(batch_id:str,db:Session=Depends(get_db)):
 b=db.query(HoneyBatch).filter_by(batch_id=batch_id).first();
 if not b: return HTMLResponse('<h1>Honey Chain</h1><p>Batch not found.</p>',status_code=404)
 d=batch_dict(b,db); labs=d['lab_report']; events=d['traceability']; chain=BlockchainService(); chain_batch=chain.get_batch(batch_id) if chain.available else None
 verified=bool(chain_batch and chain_batch[-1])
 timeline=''.join('<p>{}: {} → {} — {}</p>'.format(e['event_type'],e['from_party'],e['to_party'],e['location']) for e in events)
 verification='ON-CHAIN VERIFIED' if verified else 'Blockchain not connected — record is database-visible only'
 return HTMLResponse(f'''<!doctype html><html><head><meta charset="utf-8"><title>Honey Chain Verification</title><style>body{{font-family:Arial;max-width:760px;margin:40px auto;padding:20px}}.ok{{padding:14px;border-radius:10px;background:#e9f7ef}}.card{{border:1px solid #ddd;border-radius:12px;padding:16px;margin:12px 0}}</style></head><body><h1>🍯 Honey Chain</h1><div class="ok"><b>Batch: {d['batch_id']}</b><br>Consumer verification: {verification}</div><div class="card"><b>Honey:</b> {d['honey_type']}<br><b>Quantity:</b> {d['quantity']} kg<br><b>Harvest:</b> {d['harvest_date']}<br><b>Location:</b> {d['location']}<br><b>Health:</b> {d['ai_health_status'] or 'Not available'}<br><b>Disease risk:</b> {d['ai_disease_risk'] or 'Not available'}</div><div class="card"><b>Lab:</b> {labs['report_number'] if labs else 'Pending'}<br><b>Quality:</b> {labs['quality_grade'] if labs else 'Pending'}<br><b>SHA-256:</b> {labs['sha256_hash'] if labs else 'Not available'}</div><div class="card"><h3>Traceability</h3>{timeline}</div></body></html>''')
@app.get('/api/verify/{batch_id}')
def api_verify(batch_id:str,db:Session=Depends(get_db)):
 b=db.query(HoneyBatch).filter_by(batch_id=batch_id).first();
 if not b: raise HTTPException(404,'Batch not found')
 d=batch_dict(b,db); bc=BlockchainService(); chain=bc.get_batch(batch_id) if bc.available else None
 return {'batch':d,'verified':bool(chain and chain[-1]),'verification_source':'live blockchain' if chain else 'database only','blockchain_batch':chain}

@app.get('/api/marketplace/batches')
def market(region:str='',honey_type:str='',min_quantity:float=0,availability:str='',health_status:str='',lab_status:str='',db:Session=Depends(get_db)):
 rows=[]
 for b in db.query(HoneyBatch).all():
  d=batch_dict(b,db)
  if region and b.region.lower()!=region.lower(): continue
  if honey_type and honey_type.lower() not in (b.honey_type or '').lower(): continue
  if b.quantity_kg < min_quantity: continue
  if availability=='available' and b.status!='AVAILABLE': continue
  if availability=='unavailable' and b.status=='AVAILABLE': continue
  if health_status and health_status.lower().replace(' ','_') not in (b.ai_health_status or '').lower().replace(' ','_'): continue
  if lab_status and lab_status.lower()=='verified' and d['lab_status']!='Verified': continue
  d['simulated_price_inr_per_kg']=240+(b.id*73)%261; d['simulated_distance_km']=20+(b.id*47)%281; rows.append(d)
 return {'batches':rows,'demo_note':'Price and distance are simulated deterministic demo estimates.'}
@app.get('/api/marketplace')
def marketplace_alias(region:str='',honey_type:str='',min_quantity:float=0,availability:str='',health_status:str='',lab_status:str='',db:Session=Depends(get_db)): return market(region,honey_type,min_quantity,availability,health_status,lab_status,db)

@app.get('/api/admin/dashboard')
def admin_dashboard(db:Session=Depends(get_db)):
 farmers=db.query(Farmer).count(); hives=db.query(Hive).count(); batches_n=db.query(HoneyBatch).count(); healthy=db.query(AIResult).filter(AIResult.health_status=='Healthy').count(); at_risk=db.query(AIResult).filter(AIResult.health_status!='Healthy').count(); production=sum(x.quantity_kg or 0 for x in db.query(HoneyBatch).all());
 regions={}
 for b in db.query(HoneyBatch).all(): regions[b.region]=regions.get(b.region,0)+(b.quantity_kg or 0)
 return {'total_farmers':farmers,'total_hives':hives,'total_batches':batches_n,'healthy_hives':healthy,'at_risk_hives':at_risk,'total_honey_kg':round(production,2),'regional_production':regions,'batches':[batch_dict(b,db) for b in db.query(HoneyBatch).all()]}
@app.get('/api/admin/regions')
def admin_regions(db:Session=Depends(get_db)): return {'regions':admin_dashboard(db)['regional_production']}
@app.get('/api/admin/region/{region_name}')
def admin_region_dashboard(
    region_name: str,
    db: Session = Depends(get_db)
):
    # Selected region ke farmers
    farmers = (
        db.query(Farmer)
        .filter(Farmer.region == region_name)
        .all()
    )

    farmer_ids = [farmer.id for farmer in farmers]

    # Selected region ke hives
    hives = []

    if farmer_ids:
        hives = (
            db.query(Hive)
            .filter(Hive.farmer_id.in_(farmer_ids))
            .all()
        )

    # Selected region ke batches
    batches = []

    if farmer_ids:
        batches = (
            db.query(HoneyBatch)
            .filter(HoneyBatch.farmer_id.in_(farmer_ids))
            .all()
        )

    # Total honey
    total_honey = sum(
        float(batch.quantity_kg or 0)
        for batch in batches
    )

    # Hive health
    healthy_hives = 0
    at_risk_hives = 0
    unknown_hives = 0

    for hive in hives:

        latest = (
            db.query(AIResult)
            .filter(AIResult.hive_id == hive.id)
            .order_by(AIResult.created_at.desc())
            .first()
        )

        if not latest:
            unknown_hives += 1
            continue

        status = str(
            latest.health_status or "UNKNOWN"
        ).upper()

        if status == "HEALTHY":
            healthy_hives += 1
        else:
            at_risk_hives += 1

    # Farmer-wise details
    farmer_details = []

    for farmer in farmers:

        farmer_hives = [
            hive
            for hive in hives
            if hive.farmer_id == farmer.id
        ]

        farmer_batches = [
            batch
            for batch in batches
            if batch.farmer_id == farmer.id
        ]

        farmer_honey = sum(
            float(batch.quantity_kg or 0)
            for batch in farmer_batches
        )

        farmer_details.append({
            "id": farmer.id,
            "name": farmer.name,
            "age": farmer.age,
            "phone": farmer.phone,
            "region": farmer.region,
            "village": farmer.village,
            "hives": len(farmer_hives),
            "batches": len(farmer_batches),
            "honey_produced_kg": round(
                farmer_honey,
                2
            )
        })

    return {
        "region": region_name,

        "summary": {
            "farmers": len(farmers),
            "hives": len(hives),
            "batches": len(batches),
            "honey_produced_kg": round(
                total_honey,
                2
            ),
            "healthy_hives": healthy_hives,
            "at_risk_hives": at_risk_hives,
            "unknown_hives": unknown_hives
        },

        "farmers": farmer_details
    }
@app.get('/api/admin/hives')
def admin_hives(db:Session=Depends(get_db)): return hives(db)
@app.get('/api/admin/batches')
def admin_batches(db:Session=Depends(get_db)): return batches(db)
@app.get('/api/admin/traceability')
def admin_trace(db:Session=Depends(get_db)): return {'events':[x for b in db.query(HoneyBatch).all() for x in event_dicts(db.query(TraceabilityEvent).filter_by(batch_id=b.id).all())]}

# Serve frontend after API routes.
frontend=Path(__file__).resolve().parents[2]/'frontend'
if frontend.exists():
 app.mount('/static',StaticFiles(directory=frontend),name='static')
 app.mount('/css', StaticFiles(directory=frontend/'css'), name='css')
 app.mount('/js', StaticFiles(directory=frontend/'js'), name='js')
 @app.get('/',response_class=HTMLResponse)
 def home(): return (frontend/'index.html').read_text(encoding='utf-8')
