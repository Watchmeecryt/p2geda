# ConfiPool indexer / keeper

## Keeper (V5)

```bash
cp .env.example .env   # if present, or create .env
```

Required:

```
OWNER_PRIVATE_KEY=0x…   # must be vault.owner()
RPC_URL=https://…
VAULT_ADDRESS=0x335339161E31fD94fF5A5d0595eC7526AFe9373F
CHAIN_ID=11155111
KEEPER_POLL_INTERVAL_MS=30000
```

```bash
npm run keeper          # loop
npm run keeper:once     # single tick
```

Each tick: `harvest` → `openDraw` → `revealDraw` (FHE publicDecrypt of R + totalWeight) → `accrueMany`.

For Sepolia demos, fund the prize reserve from the Admin UI first so accrue can pay.
