import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const path = resolve(here, '..', 'deployments', 'sepolia.json');
const deployment = JSON.parse(readFileSync(path, 'utf8'));
const rpc = process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';

const response = await fetch(rpc, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_getTransactionReceipt',
    params: [deployment.transactionHash],
  }),
});

const { result } = await response.json();
if (!result) throw new Error('Deployment receipt not found on this RPC.');

deployment.deploymentBlock = Number.parseInt(result.blockNumber, 16);
writeFileSync(path, `${JSON.stringify(deployment, null, 2)}\n`);
console.log(`deploymentBlock: ${deployment.deploymentBlock}`);
