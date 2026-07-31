import { ethers, network } from "hardhat";

/** Bump MockYield4626 APR on the live Sepolia yield vault (no prize-vault redeploy). */
async function main() {
  if (network.name !== "sepolia") {
    throw new Error("Run with --network sepolia");
  }

  const yieldVaultAddress =
    process.env.YIELD_VAULT_ADDRESS ?? "0x751Dc0A1f4aCDd7EeC87f2f926919eD7F9Be03b9";
  const aprBps = Number(process.env.YIELD_APR_BPS ?? "8000"); // 80%

  const [signer] = await ethers.getSigners();
  if (!signer) throw new Error("No PRIVATE_KEY / signer");

  const yieldVault = await ethers.getContractAt("MockYield4626", yieldVaultAddress, signer);
  const before = await yieldVault.aprBps();
  console.log(`MockYield ${yieldVaultAddress}`);
  console.log(`owner ${signer.address} · aprBps ${before} → ${aprBps}`);

  const tx = await yieldVault.setAprBps(aprBps);
  console.log(`setAprBps tx ${tx.hash}`);
  await tx.wait();
  console.log(`aprBps now ${(await yieldVault.aprBps()).toString()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
