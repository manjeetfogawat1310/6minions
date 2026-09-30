import hashlib
def sha256_text(text): return hashlib.sha256(text.encode()).hexdigest()
def sha256_bytes(data): return hashlib.sha256(data).hexdigest()
