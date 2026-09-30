import json
import os
from pathlib import Path

from solcx import compile_standard, install_solc
from web3 import Web3


RPC_URL = os.getenv("BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545")
CHAIN_ID = int(os.getenv("BLOCKCHAIN_CHAIN_ID", "1337"))
PRIVATE_KEY = os.environ["BLOCKCHAIN_PRIVATE_KEY"]

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "contracts" / "HoneyTraceability.sol"
ARTIFACT_PATH = ROOT / "artifacts" / "HoneyTraceability.json"


# Install the Solidity compiler version used by the contract
install_solc("0.8.24")

# Read Solidity contract
source = CONTRACT_PATH.read_text(encoding="utf-8")


# Compile contract
compiled = compile_standard(
    {
        "language": "Solidity",
        "sources": {
            "HoneyTraceability.sol": {
                "content": source,
            },
        },
        "settings": {
            # Optimizer helps reduce contract bytecode/gas usage
            "optimizer": {
                "enabled": True,
                "runs": 200,
            },

            # Fixes "Stack too deep" compilation error
            "viaIR": True,

            "outputSelection": {
                "*": {
                    "*": [
                        "abi",
                        "evm.bytecode.object",
                    ],
                }
            },
        },
    },
    solc_version="0.8.24",
)


# Get compiled contract data
contract_data = compiled["contracts"]["HoneyTraceability.sol"]["HoneyTraceability"]

abi = contract_data["abi"]
bytecode = contract_data["evm"]["bytecode"]["object"]


# Connect to Ganache
w3 = Web3(Web3.HTTPProvider(RPC_URL))

if not w3.is_connected():
    raise RuntimeError(
        f"Unable to connect to blockchain RPC: {RPC_URL}"
    )


# Load Ganache account
account = w3.eth.account.from_key(PRIVATE_KEY)

print(f"Connected to blockchain: {RPC_URL}")
print(f"Deployer account: {account.address}")
print(f"Chain ID: {CHAIN_ID}")


# Create contract object
contract = w3.eth.contract(
    abi=abi,
    bytecode=bytecode,
)


# Get transaction nonce
nonce = w3.eth.get_transaction_count(account.address)


# Build deployment transaction
transaction = contract.constructor().build_transaction(
    {
        "from": account.address,
        "nonce": nonce,
        "chainId": CHAIN_ID,
        "gas": 3_000_000,
        "gasPrice": w3.eth.gas_price,
    }
)


# Sign transaction
signed = account.sign_transaction(transaction)


# Send transaction
tx_hash = w3.eth.send_raw_transaction(
    signed.raw_transaction
)


print(f"Deployment transaction sent: {tx_hash.hex()}")


# Wait for confirmation
receipt = w3.eth.wait_for_transaction_receipt(tx_hash)


# Create artifact
artifact = {
    "contractName": "HoneyTraceability",
    "sourceName": "HoneyTraceability.sol",
    "abi": abi,
    "bytecode": "0x" + bytecode,
    "networks": {
        str(CHAIN_ID): {
            "address": receipt.contractAddress,
            "transactionHash": tx_hash.hex(),
            "deployer": account.address,
            "chainId": CHAIN_ID,
        }
    },
    "address": receipt.contractAddress,
    "chainId": CHAIN_ID,
}


# Save artifact
ARTIFACT_PATH.parent.mkdir(
    parents=True,
    exist_ok=True,
)

ARTIFACT_PATH.write_text(
    json.dumps(artifact, indent=2),
    encoding="utf-8",
)


# Final output
print()
print("=" * 60)
print("BLOCKCHAIN CONTRACT DEPLOYED SUCCESSFULLY")
print("=" * 60)
print(f"Contract address: {receipt.contractAddress}")
print(f"Deployment transaction: {tx_hash.hex()}")
print(f"Artifact: {ARTIFACT_PATH}")
print("=" * 60)