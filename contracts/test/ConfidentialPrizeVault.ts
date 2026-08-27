import { FhevmType } from "@fhevm/hardhat-plugin";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers as Ethers } from "ethers";
import { ethers, fhevm } from "hardhat";
import type {
  ConfidentialPrizeVault,
  MockConfidentialZama,
  MockZama,
} from "../types";

/** cUSDCMock and USDC Mock are both 6 decimals, so the wrapper rate is 1. */
const UNIT = 10n ** 6n;
const WRAP_RATE = 1n;
const DEPOSIT_WINDOW = 30;
const DRAW_INTERVAL = 60;

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

/** Advance chain time until the current batch's draw is due. */
async function waitUntilDrawDue(vault: ConfidentialPrizeVault) {
  const closesAt = await vault.depositWindowClosesAt();
  expect(closesAt).to.not.equal(0n);
  const dueAt = closesAt + BigInt(DRAW_INTERVAL) + 1n;
  const now = BigInt(await time.latest());
  if (dueAt > now) {
    await time.increaseTo(dueAt);
  } else {
    await time.increase(1);
  }
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

  const vault = (await ethers.deployContract("ConfidentialPrizeVault", [
    cZamaAddress,
    mockZamaAddress,
    DEPOSIT_WINDOW,
    DRAW_INTERVAL,
    owner.address,
  ])) as unknown as ConfidentialPrizeVault;
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();

  await fhevm.assertCoprocessorInitialized(cZama, "MockConfidentialZama");
  await fhevm.assertCoprocessorInitialized(vault, "ConfidentialPrizeVault");

  /** `amount` is in confidential (6-decimal) units; the underlying leg is scaled by the rate. */
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

  async function configurePrize(amount: bigint) {
    const encrypted = await encrypt64(vaultAddress, owner, amount);
    await (
      await vault
        .connect(owner)
        .setPrizePerDraw(encrypted.handles[0], encrypted.inputProof)
    ).wait();
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
    configurePrize,
    vaultBalance,
    claimable,
    tokenBalance,
  };
}

describe("ConfidentialPrizeVault", function () {
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

  it("commits exactly one encrypted prize per draw across all depositors", async function () {
    const {
      owner,
      alice,
      bob,
      vault,
      mintAndWrap,
      deposit,
      fundReserve,
      configurePrize,
      claimable,
    } = await deployFixture();

    const prize = 50n * UNIT;
    await mintAndWrap(owner, 1_000n * UNIT);
    await mintAndWrap(alice, 1_000n * UNIT);
    await mintAndWrap(bob, 1_000n * UNIT);
    await deposit(alice, 100n * UNIT);
    await deposit(bob, 300n * UNIT);
    await fundReserve(500n * UNIT);
    await configurePrize(prize);

    await waitUntilDrawDue(vault);
    await (await vault.connect(owner).draw()).wait();

    const alicePrize = await claimable(alice);
    const bobPrize = await claimable(bob);
    expect(alicePrize + bobPrize).to.equal(prize);
    expect([alicePrize, bobPrize]).to.include(0n);
    expect([alicePrize, bobPrize]).to.include(prize);
  });

  it("distributes five draws, supports confidential claims, then publicly decrypts the paid aggregate", async function () {
    const {
      owner,
      alice,
      bob,
      vault,
      vaultAddress,
      mintAndWrap,
      deposit,
      fundReserve,
      configurePrize,
      claimable,
    } = await deployFixture();

    const prize = 20n * UNIT;
    await mintAndWrap(owner, 1_000n * UNIT);
    await mintAndWrap(alice, 1_000n * UNIT);
    await mintAndWrap(bob, 1_000n * UNIT);
    await deposit(alice, 200n * UNIT);
    await deposit(bob, 300n * UNIT);
    await fundReserve(200n * UNIT);
    await configurePrize(prize);

    await expect(vault.connect(owner).requestTotalPrizesPaidReveal())
      .to.be.revertedWithCustomError(vault, "RevealThresholdNotMet")
      .withArgs(0, 5);

    for (let draw = 0; draw < 5; draw += 1) {
      if (draw > 0) {
        // Draw resets the deposit window; a fresh deposit reopens the next batch.
        await deposit(alice, 1n);
      }
      await waitUntilDrawDue(vault);
      await (await vault.connect(owner).draw()).wait();
    }

    expect((await claimable(alice)) + (await claimable(bob))).to.equal(5n * prize);

    // Every depositor can claim. A non-winner for any draw transfers encrypted zero,
    // so claim transactions do not expose which draws each account won.
    await (await vault.connect(alice).claim()).wait();
    await (await vault.connect(bob).claim()).wait();
    expect(await claimable(alice)).to.equal(0);
    expect(await claimable(bob)).to.equal(0);

    const totalPaidHandle = await vault.confidentialTotalPrizesPaid();
    await (await vault.connect(owner).requestTotalPrizesPaidReveal()).wait();
    expect(
      await fhevm.publicDecryptEuint(FhevmType.euint64, totalPaidHandle),
    ).to.equal(5n * prize);

    await expect(
      vault.connect(owner).requestTotalPrizesPaidReveal(),
    ).to.be.revertedWithCustomError(vault, "RevealAlreadyRequested");
  });

  it("keeps the prize configuration and remaining reserve readable by the owner", async function () {
    const {
      owner,
      alice,
      vault,
      vaultAddress,
      mintAndWrap,
      deposit,
      fundReserve,
      configurePrize,
    } = await deployFixture();

    const prize = 25n * UNIT;
    await mintAndWrap(owner, 1_000n * UNIT);
    await mintAndWrap(alice, 1_000n * UNIT);
    await deposit(alice, 100n * UNIT);
    await fundReserve(300n * UNIT);
    await configurePrize(prize);

    expect(
      await decrypt64(await vault.confidentialPrizePerDraw(), vaultAddress, owner),
    ).to.equal(prize);
    expect(
      await decrypt64(await vault.confidentialPrizeReserve(), vaultAddress, owner),
    ).to.equal(300n * UNIT);

    await waitUntilDrawDue(vault);
    await (await vault.connect(owner).draw()).wait();

    // The draw rewrites the reserve handle; the owner must still be able to read it.
    expect(
      await decrypt64(await vault.confidentialPrizeReserve(), vaultAddress, owner),
    ).to.equal(275n * UNIT);
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
});
