import { FhevmType } from "@fhevm/hardhat-plugin";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers as Ethers } from "ethers";
import { ethers, fhevm } from "hardhat";
import type {
  ConfidentialPrizeVaultHarness,
  ConfidentialVaultSource,
  MockConfidentialZama,
  MockDepositBatcher,
  MockRedeemBatcher,
  MockZama,
} from "../types";

const UNIT = 10n ** 6n;
const MIN_PERIOD = 60;
const TIER_PRIZES: [bigint, bigint, bigint] = [100n * UNIT, 25n * UNIT, 5n * UNIT];
const TIER_K: [bigint, bigint, bigint] = [100n, 10n, 1n];

async function encrypt64(contract: string, signer: HardhatEthersSigner, value: bigint) {
  const input = fhevm.createEncryptedInput(contract, signer.address);
  input.add64(value);
  return input.encrypt();
}

async function decrypt64(
  handle: string,
  contract: string,
  signer: HardhatEthersSigner,
): Promise<bigint> {
  return fhevm.userDecryptEuint(
    FhevmType.euint64,
    handle,
    contract,
    signer as unknown as Ethers.Signer,
  );
}

describe("ConfidentialVaultSource (Morpho/Zama composition)", function () {
  it("rejects a redeem batcher that does not return the pool asset", async function () {
    const [owner] = await ethers.getSigners();
    const usdc = await ethers.deployContract("MockZama");
    const cUsdc = await ethers.deployContract("MockConfidentialZama", [await usdc.getAddress()]);
    const shareUnderlying = await ethers.deployContract("MockZama");
    const shareToken = await ethers.deployContract("MockConfidentialZama", [
      await shareUnderlying.getAddress(),
    ]);
    const otherUnderlying = await ethers.deployContract("MockZama");
    const otherToken = await ethers.deployContract("MockConfidentialZama", [
      await otherUnderlying.getAddress(),
    ]);

    const depositBatcher = await ethers.deployContract("MockDepositBatcher", [
      await cUsdc.getAddress(),
      await shareToken.getAddress(),
    ]);
    const badRedeem = await ethers.deployContract("MockRedeemBatcher", [
      await shareToken.getAddress(),
      await otherToken.getAddress(),
    ]);

    const factory = await ethers.getContractFactory("ConfidentialVaultSource");
    await expect(
      factory.deploy(
        await cUsdc.getAddress(),
        await depositBatcher.getAddress(),
        await badRedeem.getAddress(),
        500,
        owner.address,
      ),
    ).to.be.revertedWithCustomError(factory, "BatcherMismatch");
  });

  it("routes prize-vault deposits into the adapter and redeems principal from the buffer", async function () {
    const [owner, alice] = await ethers.getSigners();

    const usdc = (await ethers.deployContract("MockZama")) as unknown as MockZama;
    const cUsdc = (await ethers.deployContract("MockConfidentialZama", [
      await usdc.getAddress(),
    ])) as unknown as MockConfidentialZama;
    const shareUnderlying = (await ethers.deployContract("MockZama")) as unknown as MockZama;
    const shareToken = (await ethers.deployContract("MockConfidentialZama", [
      await shareUnderlying.getAddress(),
    ])) as unknown as MockConfidentialZama;

    const depositBatcher = (await ethers.deployContract("MockDepositBatcher", [
      await cUsdc.getAddress(),
      await shareToken.getAddress(),
    ])) as unknown as MockDepositBatcher;
    const redeemBatcher = (await ethers.deployContract("MockRedeemBatcher", [
      await shareToken.getAddress(),
      await cUsdc.getAddress(),
    ])) as unknown as MockRedeemBatcher;

    const vault = (await ethers.deployContract("ConfidentialPrizeVaultHarness", [
      await cUsdc.getAddress(),
      await usdc.getAddress(),
      MIN_PERIOD,
      owner.address,
    ])) as unknown as ConfidentialPrizeVaultHarness;
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();

    const source = (await ethers.deployContract("ConfidentialVaultSource", [
      await cUsdc.getAddress(),
      await depositBatcher.getAddress(),
      await redeemBatcher.getAddress(),
      500,
      vaultAddress,
    ])) as unknown as ConfidentialVaultSource;
    await source.waitForDeployment();
    const sourceAddress = await source.getAddress();

    await fhevm.assertCoprocessorInitialized(cUsdc, "MockConfidentialZama");
    await fhevm.assertCoprocessorInitialized(shareToken, "MockConfidentialZama");
    await fhevm.assertCoprocessorInitialized(vault, "ConfidentialPrizeVaultHarness");
    await fhevm.assertCoprocessorInitialized(source, "ConfidentialVaultSource");
    await fhevm.assertCoprocessorInitialized(depositBatcher, "MockDepositBatcher");
    await fhevm.assertCoprocessorInitialized(redeemBatcher, "MockRedeemBatcher");

    await (await vault.connect(owner).setTiers(TIER_PRIZES, TIER_K)).wait();
    await (await vault.connect(owner).setYieldSource(sourceAddress)).wait();

    const cUsdcAddress = await cUsdc.getAddress();

    async function mintWrap(signer: HardhatEthersSigner, amount: bigint) {
      await (await usdc.mint(signer.address, amount)).wait();
      await (await usdc.connect(signer).approve(cUsdcAddress, amount)).wait();
      await (await cUsdc.connect(signer).wrap(signer.address, amount)).wait();
    }

    async function deposit(signer: HardhatEthersSigner, amount: bigint) {
      const encrypted = await encrypt64(cUsdcAddress, signer, amount);
      await (
        await cUsdc
          .connect(signer)
          ["confidentialTransferAndCall(address,bytes32,bytes,bytes)"](
            vaultAddress,
            encrypted.handles[0],
            encrypted.inputProof,
            "0x",
          )
      ).wait();
    }

    // Seed adapter yield pot (replica harvest pays from spare cUSDC).
    await mintWrap(owner, 1_000n * UNIT);
    const seed = await encrypt64(cUsdcAddress, owner, 200n * UNIT);
    await (
      await cUsdc.connect(owner)["confidentialTransfer(address,bytes32,bytes)"](
        sourceAddress,
        seed.handles[0],
        seed.inputProof,
      )
    ).wait();

    await mintWrap(alice, 1_000n * UNIT);
    await deposit(alice, 400n * UNIT);

    expect(
      await decrypt64(await vault.confidentialBalanceOf(alice.address), vaultAddress, alice),
    ).to.equal(400n * UNIT);

    // Join half of idle principal into the mock deposit batcher.
    await (await source.joinVault()).wait();
    const batchId = await depositBatcher.currentBatchId();

    // Fund deposit batcher with shares so claim can pay 1:1.
    await (await shareUnderlying.mint(owner.address, 10_000n * UNIT)).wait();
    await (
      await shareUnderlying.connect(owner).approve(await shareToken.getAddress(), 10_000n * UNIT)
    ).wait();
    await (await shareToken.connect(owner).wrap(owner.address, 10_000n * UNIT)).wait();
    const sharesToBatcher = await encrypt64(await shareToken.getAddress(), owner, 1_000n * UNIT);
    await (
      await shareToken.connect(owner)["confidentialTransfer(address,bytes32,bytes)"](
        await depositBatcher.getAddress(),
        sharesToBatcher.handles[0],
        sharesToBatcher.inputProof,
      )
    ).wait();

    await (await source.claimShares(batchId)).wait();

    // Withdraw from buffer (remaining idle half + any unclaimed liquidity).
    const withdrawal = await encrypt64(vaultAddress, alice, 50n * UNIT);
    await (
      await vault.connect(alice).withdraw(withdrawal.handles[0], withdrawal.inputProof)
    ).wait();

    expect(
      await decrypt64(await vault.confidentialBalanceOf(alice.address), vaultAddress, alice),
    ).to.equal(350n * UNIT);

    // Accrue replica yield into the prize reserve.
    await time.increase(30 * 24 * 60 * 60);
    await (await vault.harvest()).wait();
    const reserve = await decrypt64(
      await vault.confidentialPrizeReserve(),
      vaultAddress,
      owner,
    );
    expect(reserve).to.be.gt(0n);
  });
});
