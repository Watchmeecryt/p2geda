import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ethers, network } from "hardhat";

const DEFAULT_USDC_MOCK = "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF";
const DEFAULT_CUSDC_MOCK = "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639";

async function main() {
  if (network.name !== "sepolia") {
    throw new Error("This script deploys the production demo vault to Sepolia only.");
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer configured. Add PRIVATE_KEY to contracts/.env.");
  }

  const underlyingToken = process.env.USDC_MOCK_ADDRESS ?? DEFAULT_USDC_MOCK;
  const confidentialToken = process.env.CUSDC_MOCK_ADDRESS ?? DEFAULT_CUSDC_MOCK;
  const minPeriod = Number(process.env.MIN_PERIOD_SECONDS ?? "120");
  if (!Number.isSafeInteger(minPeriod) || minPeriod <= 0) {
    throw new Error("MIN_PERIOD_SECONDS must be a positive integer.");
  }

  for (const [label, address] of [
    ["USDC Mock", underlyingToken],
    ["cUSDCMock", confidentialToken],
  ] as const) {
    if ((await ethers.provider.getCode(address)) === "0x") {
      throw new Error(`${label} has no contract code at ${address} on Sepolia.`);
    }
  }

  console.log(`Deploying ConfiPool V5 vault from ${deployer.address}`);
  console.log(`Underlying USDC Mock: ${underlyingToken}`);
  console.log(`Confidential cUSDCMock: ${confidentialToken}`);
  console.log(`minPeriod: ${minPeriod}s`);

  const factory = await ethers.getContractFactory("ConfidentialPrizeVault", deployer);
  const vault = await factory.deploy(
    confidentialToken,
    underlyingToken,
    minPeriod,
    deployer.address,
  );
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  const receipt = await vault.deploymentTransaction()?.wait();

  // Demo-friendly Apex / Pulse / Ripple (6-decimal units).
  const UNIT = 10n ** 6n;
  await (
    await vault.setTiers([100n * UNIT, 25n * UNIT, 5n * UNIT], [100n, 10n, 1n])
  ).wait();
  console.log("setTiers Apex/Pulse/Ripple OK");

  const deployment = {
    chainId: 11155111,
    network: "sepolia",
    deployer: deployer.address,
    vault: vaultAddress,
    underlyingToken,
    confidentialToken,
    minPeriod,
    tiers: {
      apex: (100n * UNIT).toString(),
      pulse: (25n * UNIT).toString(),
      ripple: (5n * UNIT).toString(),
      k: [100, 10, 1],
    },
    deployedAt: new Date().toISOString(),
    transactionHash: receipt?.hash ?? null,
    note: "V5 TWAB vault. Attach ConfidentialVaultSource with deploy:vault-source:sepolia VAULT_ADDRESS=…",
  };

  const outputDir = resolve(__dirname, "..", "deployments");
  mkdirSync(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, "sepolia.json");
  writeFileSync(outputPath, `${JSON.stringify(deployment, null, 2)}\n`, "utf8");

  console.log(`ConfiPool vault deployed: ${vaultAddress}`);
  console.log(`Deployment written to ${outputPath}`);
  console.log(`Frontend env: VITE_CONFIPOOL_VAULT_ADDRESS=${vaultAddress}`);
  console.log(`Next: VAULT_ADDRESS=${vaultAddress} npm run deploy:vault-source:sepolia`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
