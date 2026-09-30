# Honey Chain Blockchain

Optional local Ethereum-compatible blockchain demo using Ganache.

```powershell
npm install --global ganache
ganache --host 127.0.0.1 --port 8545 --chain.chainId 31337
```
Use the first Ganache private key as `BLOCKCHAIN_PRIVATE_KEY` in `.env`, then:

```powershell
python blockchain\deploy\deploy.py
```
Set the printed contract address as `BLOCKCHAIN_CONTRACT_ADDRESS` and restart FastAPI.
