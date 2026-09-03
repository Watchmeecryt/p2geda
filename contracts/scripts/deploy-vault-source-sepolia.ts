// SPDX-License-Identifier: BSD-3-Clause-Clear
/**
 * Deploy ConfidentialVaultSource against Zama Sepolia batchers and optionally
 * attach it to an already-deployed V5 prize vault via setYieldSource.
 *
 * Env:
 *   PRIVATE_KEY
 *   SEPOLIA_RPC_URL
 *   VAULT_ADDRESS          — optional; if set, calls setYieldSource
 *   RATE_BPS               — optional, default 500 (5%)
 */
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const addrsPath = path.join(__dirname, "..", "deployments", "sepolia-confidential-vault.json");
  const addrs = JSON.parse(fs.readFileSync(addrsPath, "utf8")) as {
    cUSDC: string;
    depositBatcher: string;
    redeemBatcher: string;
  };

  const vaultAddress = process.env.VAULT_ADDRESS?.trim() || "";
  const rateBps = BigInt(process.env.RATE_BPS?.trim() || "500");
  const controller = vaultAddress || deployer.address;

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Controller (prize vault): ${controller}`);

  const source = await ethers.deployContract("ConfidentialVaultSource", [
    addrs.cUSDC,
    addrs.depositBatcher,
    addrs.redeemBatcher,
    rateBps,
    controller,
  ]);
  await source.waitForDeployment();
  const sourceAddress = await source.getAddress();
  console.log(`ConfidentialVaultSource: ${sourceAddress}`);

  if (vaultAddress) {
    const vault = await ethers.getContractAt("ConfidentialPrizeVault", vaultAddress);
    const tx = await vault.setYieldSource(sourceAddress);
    await tx.wait();
    console.log(`setYieldSource → ${sourceAddress}`);
  } else {
    console.log("VAULT_ADDRESS not set — deploy the V5 vault first, then re-run with VAULT_ADDRESS=…");
  }

  const out = {
    network: "sepolia",
    confidentialVaultSource: sourceAddress,
    controller,
    rateBps: rateBps.toString(),
    ...addrs,
    deployedAt: new Date().toISOString(),
  };
  const outPath = path.join(__dirname, "..", "deployments", "sepolia-vault-source.json");
  fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`Wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
