import json
from pathlib import Path
from ..config import get_settings
class BlockchainUnavailableError(Exception): pass
class BlockchainService:
 def __init__(self): self.s=get_settings(); self.w3=self.contract=self.account=None; self.reason='Not configured'; self._connect()
 def _connect(self):
  if not (self.s.blockchain_private_key and self.s.blockchain_contract_address): return
  try:
   from web3 import Web3
   self.w3=Web3(Web3.HTTPProvider(self.s.blockchain_rpc_url,request_kwargs={'timeout':5}))
   if not self.w3.is_connected(): self.w3=None; self.reason='RPC unavailable'; return
   self.account=self.w3.eth.account.from_key(self.s.blockchain_private_key)
   root_dir = Path(__file__).resolve().parents[3]
   true_path = root_dir / "blockchain" / "artifacts" / "HoneyTraceability.json"
   artifact = json.loads(true_path.read_text())
   self.contract = self.w3.eth.contract(address=Web3.to_checksum_address(self.s.blockchain_contract_address), abi=artifact['abi'])
  except Exception as e: self.w3=None; self.reason=str(e)
 @property
 def available(self): return bool(self.w3 and self.contract and self.account)
 def _send(self,fn):
  if not self.available: raise BlockchainUnavailableError(self.reason)
  n=self.w3.eth.get_transaction_count(self.account.address,'pending'); tx=fn.build_transaction({'from':self.account.address,'nonce':n,'chainId':self.s.blockchain_chain_id,'gas':1000000,'gasPrice':self.w3.eth.gas_price}); signed=self.account.sign_transaction(tx); h=self.w3.eth.send_raw_transaction(signed.raw_transaction); r=self.w3.eth.wait_for_transaction_receipt(h,timeout=120); return h.hex(),r.blockNumber
 def create_batch(self,*a): return self._send(self.contract.functions.createBatch(a[0],a[1],a[2],int(round(a[3]*1000)),a[4]))
 def add_event(self,*a): return self._send(self.contract.functions.addEvent(*a))
 def add_lab_hash(self,*a): return self._send(self.contract.functions.addLabHash(*a))
 def get_batch(self,b): return self.contract.functions.getBatch(b).call() if self.available else None
 def get_events(self,b): return self.contract.functions.getEvents(b).call() if self.available else []
 def get_lab_hash(self,b,r): return self.contract.functions.getLabHash(b,r).call() if self.available else None
