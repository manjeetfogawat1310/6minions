import qrcode
from ..config import get_settings
def create_qr(batch_id):
 s=get_settings(); s.qr_path.mkdir(parents=True,exist_ok=True); url=f"{s.public_base_url.rstrip('/')}/verify/{batch_id}"; p=s.qr_path/f"{batch_id}.png"; qrcode.make(url).save(p); return str(p),url
