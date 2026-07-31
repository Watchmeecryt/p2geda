import { ethers, network } from "hardhat";

/**
 * Pulls allocated principal (+ any leftover shares) out of MockYield on an old vault
 * so capital is not stuck after the allocate-before-withdraw bug.
 */
async function main() {
  if (network.name !== "sepolia") throw new Error("sepolia only");

  const vaultAddress =
    process.env.OLD_VAULT_ADDRESS ?? "0x3e638A396abd072e0893993C1a735D49DA1f2178";
  const [signer] = await ethers.getSigners();
  if (!signer) throw new Error("No signer");

  const vault = await ethers.getContractAt("ConfidentialPrizeVault", vaultAddress, signer);
  const allocated = await vault.allocatedUnderlying();
  const yieldAddr = await vault.yieldVault();
  console.log(`vault ${vaultAddress}`);
  console.log(`yield ${yieldAddr}`);
  console.log(`allocatedUnderlying ${allocated.toString()}`);

  if (allocated > 0n) {
    const tx = await vault.redeemFromYield(allocated);
    console.log(`redeemFromYield ${allocated} → ${tx.hash}`);
    await tx.wait();
    console.log(`allocated now ${(await vault.allocatedUnderlying()).toString()}`);
  } else {
    console.log("nothing allocated — skip redeemFromYield");
  }

  // Any anonymity-buffer shares still on the yield vault: withdraw to owner as clear.
  const yieldVault = await ethers.getContractAt("MockYield4626", yieldAddr, signer);
  const shares = await yieldVault.balanceOf(vaultAddress);
  console.log(`remaining yield shares on vault ${shares.toString()}`);
  if (shares > 0n) {
    // Only the prize vault can withdraw its shares; use redeemFromYield path already cleared.
    // Leftover buffer shares: owner cannot pull without a vault helper — leave noted.
    console.log(
      "Note: leftover buffer shares (if any) stay owned by the prize vault until a future harvest/redeem.",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
