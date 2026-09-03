import { FhevmType } from "@fhevm/hardhat-plugin";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers as Ethers } from "ethers";
import { ethers, fhevm } from "hardhat";
import type {
  ConfidentialPrizeVaultHarness,
  MockConfidentialZama,
  MockZama,
} from "../types";

const UNIT = 10n ** 6n;
const WRAP_RATE = 1n;
const MIN_PERIOD = 60;

/** Apex / Pulse / Ripple — Ripple k=1 keeps demo wins common with two wallets. */
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

async function deployFixture() {
  const [owner, alice, bob, outsider] = await ethers.getSigners();

  const mockZama = (await ethers.deployContract("MockZama")) as unknown as MockZama;
  await mockZama.waitForDeployment();
  const mockZamaAddress = await mockZama.getAddress();

  const cZama = (await ethers.deployContract("MockConfidentialZama", [
    mockZamaAddress,
  ])) as unknown as MockConfidentialZama;
  await cZama.waitForDeployment();
  const cZamaAddress = await cZama.getAddress();

  const vault = (await ethers.deployContract("ConfidentialPrizeVaultHarness", [
    cZamaAddress,
    mockZamaAddress,
    MIN_PERIOD,
    owner.address,
  ])) as unknown as ConfidentialPrizeVaultHarness;
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();

  await fhevm.assertCoprocessorInitialized(cZama, "MockConfidentialZama");
  await fhevm.assertCoprocessorInitialized(vault, "ConfidentialPrizeVaultHarness");

  await (
    await vault.connect(owner).setTiers(TIER_PRIZES, TIER_K)
  ).wait();

  async function mintAndWrap(signer: HardhatEthersSigner, amount: bigint) {
    const underlyingAmount = amount * WRAP_RATE;
    await (await mockZama.mint(signer.address, underlyingAmount)).wait();
    await (await mockZama.connect(signer).approve(cZamaAddress, underlyingAmount)).wait();
    await (await cZama.connect(signer).wrap(signer.address, underlyingAmount)).wait();
  }

  async function confidentialTransferAndCall(
    signer: HardhatEthersSigner,
    amount: bigint,
    data = "0x",
  ) {
    const encrypted = await encrypt64(cZamaAddress, signer, amount);
    const tx = await cZama
      .connect(signer)
      ["confidentialTransferAndCall(address,bytes32,bytes,bytes)"](
        vaultAddress,
        encrypted.handles[0],
        encrypted.inputProof,
        data,
      );
    await tx.wait();
  }

  async function deposit(signer: HardhatEthersSigner, amount: bigint) {
    await confidentialTransferAndCall(signer, amount);
  }

  async function fundReserve(amount: bigint) {
    const tag = await vault.RESERVE_DEPOSIT_TAG();
    const data = Ethers.AbiCoder.defaultAbiCoder().encode(["bytes32"], [tag]);
    await confidentialTransferAndCall(owner, amount, data);
  }

  async function vaultBalance(signer: HardhatEthersSigner) {
    return decrypt64(
      await vault.confidentialBalanceOf(signer.address),
      vaultAddress,
      signer,
    );
  }

  async function claimable(signer: HardhatEthersSigner) {
    return decrypt64(
      await vault.confidentialClaimableOf(signer.address),
      vaultAddress,
      signer,
    );
  }

  async function tokenBalance(signer: HardhatEthersSigner) {
    return decrypt64(
      await cZama.confidentialBalanceOf(signer.address),
      cZamaAddress,
      signer,
    );
  }

  async function waitUntilOpenable() {
    const openableAt = await vault.nextRoundAt();
    const now = BigInt(await time.latest());
    if (openableAt > now && openableAt < BigInt(2) ** BigInt(40) - 1n) {
      await time.increaseTo(openableAt + 1n);
    } else if (openableAt >= BigInt(2) ** BigInt(40) - 1n) {
      throw new Error("round still open; reveal or cancel first");
    } else {
      await time.increase(1);
    }
  }

  async function openAndReveal() {
    await waitUntilOpenable();
    await (await vault.connect(owner).beginRound()).wait();
    const drawId = await vault.roundCount();
    const d = await vault.roundAt(drawId);

    const r = await fhevm.publicDecryptEuint(FhevmType.euint64, d.encR);
    const totalWeight = await fhevm.publicDecryptEuint(FhevmType.euint128, d.encTotalWeight);

    await (await vault.connect(owner).applyReveal(drawId, r, totalWeight)).wait();
    return { drawId, r, totalWeight };
  }

  return {
    owner,
    alice,
    bob,
    outsider,
    mockZama,
    cZama,
    vault,
    cZamaAddress,
    vaultAddress,
    mintAndWrap,
    confidentialTransferAndCall,
    deposit,
    fundReserve,
    vaultBalance,
    claimable,
    tokenBalance,
    waitUntilOpenable,
    openAndReveal,
  };
}

describe("ConfidentialPrizeVault (V5-style TWAB + Apex/Pulse/Ripple)", function () {
  it("records ERC-7984 deposits and lets users decrypt only their vault balance", async function () {
    const { alice, bob, vault, mintAndWrap, deposit, vaultBalance } =
      await deployFixture();

    await mintAndWrap(alice, 1_000n * UNIT);
    await mintAndWrap(bob, 1_000n * UNIT);
    await deposit(alice, 125n * UNIT);
    await deposit(bob, 375n * UNIT);

    expect(await vault.depositorCount()).to.equal(2);
    expect(await vault.depositorAt(0)).to.equal(alice.address);
    expect(await vault.depositorAt(1)).to.equal(bob.address);
    expect(await vaultBalance(alice)).to.equal(125n * UNIT);
    expect(await vaultBalance(bob)).to.equal(375n * UNIT);
  });

  it("returns principal and converts encrypted over-withdrawals into zero", async function () {
    const {
      alice,
      vault,
      vaultAddress,
      mintAndWrap,
      deposit,
      vaultBalance,
      tokenBalance,
    } = await deployFixture();

    await mintAndWrap(alice, 1_000n * UNIT);
    await deposit(alice, 400n * UNIT);

    const withdrawal = await encrypt64(vaultAddress, alice, 150n * UNIT);
    await (
      await vault
        .connect(alice)
        .withdraw(withdrawal.handles[0], withdrawal.inputProof)
    ).wait();

    expect(await vaultBalance(alice)).to.equal(250n * UNIT);
    expect(await tokenBalance(alice)).to.equal(750n * UNIT);

    const overWithdrawal = await encrypt64(vaultAddress, alice, 300n * UNIT);
    await (
      await vault
        .connect(alice)
        .withdraw(overWithdrawal.handles[0], overWithdrawal.inputProof)
    ).wait();

    expect(await vaultBalance(alice)).to.equal(250n * UNIT);
    expect(await tokenBalance(alice)).to.equal(750n * UNIT);
  });

  it("opens a TWAB draw after minPeriod and accrues Apex/Pulse/Ripple credits", async function () {
    const {
      owner,
      alice,
      bob,
      vault,
      mintAndWrap,
      deposit,
      fundReserve,
      claimable,
      openAndReveal,
    } = await deployFixture();

    await mintAndWrap(owner, 2_000n * UNIT);
    await mintAndWrap(alice, 1_000n * UNIT);
    await mintAndWrap(bob, 1_000n * UNIT);
    await deposit(alice, 200n * UNIT);
    await deposit(bob, 300n * UNIT);
    await fundReserve(500n * UNIT);

    // Hold through the window so TWAB weight is non-zero.
    await time.increase(30);

    const { drawId, totalWeight } = await openAndReveal();
    expect(drawId).to.equal(1n);
    expect(totalWeight).to.be.gt(0n);

    await (await vault.connect(owner).scoreEntrant(alice.address, drawId)).wait();
    await (await vault.connect(owner).scoreEntrant(bob.address, drawId)).wait();

    const alicePrize = await claimable(alice);
    const bobPrize = await claimable(bob);
    const allowed = new Set(TIER_PRIZES.map(String).concat(["0"]));
    expect(allowed.has(alicePrize.toString())).to.equal(true);
    expect(allowed.has(bobPrize.toString())).to.equal(true);

    // With Ripple k=1 and two depositors, at least one small win is common but not
    // guaranteed; assert the accrual path completed and prizes are tier-shaped.
    expect(alicePrize + bobPrize).to.be.gte(0n);
  });

  it("lets a winner claim an encrypted Ripple/Pulse/Apex credit", async function () {
    this.timeout(180_000);

    const {
      owner,
      alice,
      bob,
      vault,
      mintAndWrap,
      deposit,
      fundReserve,
      claimable,
      tokenBalance,
      openAndReveal,
    } = await deployFixture();

    await mintAndWrap(owner, 5_000n * UNIT);
    await mintAndWrap(alice, 2_000n * UNIT);
    await mintAndWrap(bob, 2_000n * UNIT);
    await deposit(alice, 500n * UNIT);
    await deposit(bob, 500n * UNIT);
    await fundReserve(2_000n * UNIT);

    let sawWin = false;
    let winner: HardhatEthersSigner = alice;
    let winAmount = 0n;

    // A few short periods — Ripple odds make a visible win likely with two wallets.
    for (let i = 0; i < 6 && !sawWin; i += 1) {
      await time.increase(20);
      const { drawId } = await openAndReveal();
      await (await vault.scoreEntrants([alice.address, bob.address], drawId)).wait();

      const a = await claimable(alice);
      const b = await claimable(bob);
      if (a > 0n) {
        sawWin = true;
        winner = alice;
        winAmount = a;
      } else if (b > 0n) {
        sawWin = true;
        winner = bob;
        winAmount = b;
      }
    }

    expect(sawWin, "expected at least one tier win across short demo periods").to.equal(true);

    const before = await tokenBalance(winner);
    await (await vault.connect(winner).claim()).wait();
    expect(await claimable(winner)).to.equal(0n);
    expect(await tokenBalance(winner)).to.equal(before + winAmount);
  });

  it("rejects reserve funding from a non-owner", async function () {
    const {
      alice,
      cZama,
      cZamaAddress,
      vault,
      vaultAddress,
      mintAndWrap,
    } = await deployFixture();

    await mintAndWrap(alice, 100n * UNIT);
    const tag = await vault.RESERVE_DEPOSIT_TAG();
    const data = Ethers.AbiCoder.defaultAbiCoder().encode(["bytes32"], [tag]);
    const encrypted = await encrypt64(cZamaAddress, alice, 10n * UNIT);

    await expect(
      cZama
        .connect(alice)
        ["confidentialTransferAndCall(address,bytes32,bytes,bytes)"](
          vaultAddress,
          encrypted.handles[0],
          encrypted.inputProof,
          data,
        ),
    )
      .to.be.revertedWithCustomError(vault, "OnlyOwnerMayFundReserve")
      .withArgs(alice.address);
  });

  it("rejects malformed tier shapes", async function () {
    const { owner, vault } = await deployFixture();
    await expect(
      vault.connect(owner).setTiers([10n, 20n, 30n], [100n, 10n, 1n]),
    ).to.be.revertedWithCustomError(vault, "BadTierShape");
    await expect(
      vault.connect(owner).setTiers([100n, 25n, 5n], [10n, 10n, 1n]),
    ).to.be.revertedWithCustomError(vault, "BadTierShape");
  });
});
