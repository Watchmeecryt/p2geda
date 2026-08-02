import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ethers, network } from "hardhat";

const DEFAULT_USDC_MOCK = "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF";
const DEFAULT_CUSDC_MOCK = "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639";

/**
 * Deploys MockYield4626 and a fresh ConfidentialPrizeVault with yield wired.
 * Uses official Zama Sepolia USDC Mock + cUSDCMock (6 decimals, rate = 1).
 */
async function main() {
  if (network.name !== "sepolia") {
    throw new Error("This script deploys the yield stack to Sepolia only.");
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer configured. Add PRIVATE_KEY to contracts/.env.");
  }

  const underlyingToken = process.env.USDC_MOCK_ADDRESS ?? DEFAULT_USDC_MOCK;
  const confidentialToken = process.env.CUSDC_MOCK_ADDRESS ?? DEFAULT_CUSDC_MOCK;
  const depositWindow = Number(process.env.DEPOSIT_WINDOW_SECONDS ?? "120");
  const drawInterval = Number(process.env.DRAW_INTERVAL_SECONDS ?? "60");
  const aprBps = Number(process.env.YIELD_APR_BPS ?? "8000");

  console.log(`Deploying yield stack from ${deployer.address}`);
  console.log(`Underlying USDC Mock: ${underlyingToken}`);
  console.log(`Confidential cUSDCMock: ${confidentialToken}`);
  console.log(
    `Deposit window: ${depositWindow}s · draw delay after close: ${drawInterval}s · APR: ${aprBps} bps`,
  );

  const MockYield4626 = await ethers.getContractFactory("MockYield4626", deployer);
  const yieldVault = await MockYield4626.deploy(
    underlyingToken,
    "ConfiPool Mock Yield USDC",
    "cyUSDC",
    deployer.address,
    aprBps,
  );
  await yieldVault.waitForDeployment();
  const yieldVaultAddress = await yieldVault.getAddress();
  console.log(`MockYield4626: ${yieldVaultAddress}`);

  const PrizeVault = await ethers.getContractFactory("ConfidentialPrizeVault", deployer);
  const prizeVault = await PrizeVault.deploy(
    confidentialToken,
    underlyingToken,
    depositWindow,
    drawInterval,
    deployer.address,
  );
  await prizeVault.waitForDeployment();
  const prizeVaultAddress = await prizeVault.getAddress();
  console.log(`ConfidentialPrizeVault: ${prizeVaultAddress}`);

  await (await prizeVault.setYieldVault(yieldVaultAddress)).wait();
  console.log("setYieldVault OK");

  const deployment = {
    chainId: 11155111,
    network: "sepolia",
    deployer: deployer.address,
    vault: prizeVaultAddress,
    yieldVault: yieldVaultAddress,
    underlyingToken,
    confidentialToken,
    depositWindow,
    drawInterval,
    yieldAprBps: aprBps,
    deployedAt: new Date().toISOString(),
    note: "Batch deposit window + delayed draw. Update VITE_CONFIPOOL_VAULT_ADDRESS and indexer VAULT_ADDRESS / DEPLOYMENT_BLOCK.",
  };

  const outputDir = resolve(__dirname, "..", "deployments");
  mkdirSync(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, "sepolia-yield.json");
  writeFileSync(outputPath, `${JSON.stringify(deployment, null, 2)}\n`, "utf8");

  const mainPath = resolve(outputDir, "sepolia.json");
  try {
    const previous = JSON.parse(readFileSync(mainPath, "utf8")) as Record<string, unknown>;
    writeFileSync(
      mainPath,
      `${JSON.stringify({ ...previous, ...deployment, previousVault: previous.vault }, null, 2)}\n`,
      "utf8",
    );
  } catch {
    writeFileSync(mainPath, `${JSON.stringify(deployment, null, 2)}\n`, "utf8");
  }

  console.log(`Wrote ${outputPath}`);
  console.log(`VITE_CONFIPOOL_VAULT_ADDRESS=${prizeVaultAddress}`);
  console.log(`VITE_YIELD_VAULT_ADDRESS=${yieldVaultAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
