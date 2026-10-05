import qrcode
from ..config import get_settings

def create_qr(batch_id):
    s = get_settings()
    s.qr_path.mkdir(parents=True, exist_ok=True)
    
    # Yahan localhost ki jagah tera live Vercel URL daal diya hai
    # Note: Agar tera frontend hash routing (#) use karta hai, toh URL ko uske hisaab se adjust kar lena
    url = f"https://6minions-frontend.vercel.app/verify/{batch_id}"
    
    p = s.qr_path / f"{batch_id}.png"
    qrcode.make(url).save(p)
    
    return str(p), url