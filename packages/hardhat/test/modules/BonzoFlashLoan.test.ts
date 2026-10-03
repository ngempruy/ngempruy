import { expect } from "chai";
import { ethers } from "hardhat";

const LOAN = 1_000_000n;
const PREMIUM = (LOAN * 9n) / 10_000n; // 900

describe("BonzoFlashLoan", function () {
  async function deployFixture() {
    const [owner, alice, borrower] = await ethers.getSigners();
    const whbar = await ethers.deployContract("MockERC20", ["WHBAR", 8]);
    const usdc = await ethers.deployContract("MockERC20", ["USDC", 6]);
    const pool = await ethers.deployContract("MockBonzoLendingPool");
    const adapter = await ethers.deployContract("MockSwapAdapter");
    const flash = await ethers.deployContract("BonzoFlashLoan", [
      owner.address,
      await pool.getAddress(),
      await adapter.getAddress(),
    ]);

    for (const token of [whbar, usdc]) {
      await token.mint(await pool.getAddress(), 10n * LOAN);
      await token.mint(await adapter.getAddress(), 10n * LOAN);
    }
    const [w, u] = [await whbar.getAddress(), await usdc.getAddress()];
    return { owner, alice, borrower, whbar, usdc, pool, adapter, flash, w, u };
  }

  describe("flashArbitrage", function () {
    it("repays amount + premium and sends the profit to the owner", async function () {
      const { owner, whbar, pool, adapter, flash, w, u } = await deployFixture();
      await adapter.setRate(w, u, 10_000);
      await adapter.setRate(u, w, 10_100); // +1% on the way back
      const profit = LOAN / 100n - PREMIUM; // 9100

      await expect(flash.flashArbitrage(w, LOAN, [w, u], [u, w], profit))
        .to.emit(flash, "FlashLoanExecuted")
        .withArgs(0, w, LOAN, PREMIUM, profit);

      expect(await whbar.balanceOf(owner.address)).to.equal(profit);
      expect(await whbar.balanceOf(await pool.getAddress())).to.equal(10n * LOAN + PREMIUM);
      expect(await whbar.balanceOf(await flash.getAddress())).to.equal(0n);
    });

    it("reverts when the PnL is below minPnl", async function () {
      const { adapter, flash, w, u } = await deployFixture();
      await adapter.setRate(w, u, 10_000);
      await adapter.setRate(u, w, 10_000); // flat: loses the premium
      await expect(flash.flashArbitrage(w, LOAN, [w, u], [u, w], 0))
        .to.be.revertedWithCustomError(flash, "PnlBelowMinimum")
        .withArgs(-PREMIUM, 0);
    });

    it("pulls a bounded loss from the owner when minPnl is negative", async function () {
      const { owner, whbar, adapter, flash, w, u } = await deployFixture();
      await adapter.setRate(w, u, 10_000);
      await adapter.setRate(u, w, 10_000);
      await whbar.mint(owner.address, PREMIUM);
      await whbar.approve(await flash.getAddress(), PREMIUM);

      await expect(flash.flashArbitrage(w, LOAN, [w, u], [u, w], -PREMIUM))
        .to.emit(flash, "FlashLoanExecuted")
        .withArgs(0, w, LOAN, PREMIUM, -PREMIUM);
      expect(await whbar.balanceOf(owner.address)).to.equal(0n);
    });
  });

  describe("flashLiquidate", function () {
    it("liquidates, swaps the collateral back and keeps the bonus", async function () {
      const { owner, borrower, usdc, pool, adapter, flash, w, u } = await deployFixture();
      await pool.setCollateralPerDebtBps(10_500); // 5% liquidation bonus, priced 1:1
      await adapter.setRate(w, u, 10_000);
      const pnl = LOAN / 20n - PREMIUM;

      await expect(flash.flashLiquidate(u, LOAN, w, borrower.address, [w, u], pnl))
        .to.emit(flash, "FlashLoanExecuted")
        .withArgs(1, u, LOAN, PREMIUM, pnl);
      expect(await usdc.balanceOf(owner.address)).to.equal(pnl);
    });
  });

  describe("access", function () {
    it("only lets the owner start a flash loan or associate tokens", async function () {
      const { alice, borrower, flash, w, u } = await deployFixture();
      const asAlice = flash.connect(alice);
      await expect(asAlice.flashArbitrage(w, LOAN, [w, u], [u, w], 0)).to.be.revertedWithCustomError(
        flash,
        "OwnableUnauthorizedAccount",
      );
      await expect(asAlice.flashLiquidate(u, LOAN, w, borrower.address, [w, u], 0)).to.be.revertedWithCustomError(
        flash,
        "OwnableUnauthorizedAccount",
      );
      await expect(asAlice.associate(w)).to.be.revertedWithCustomError(flash, "OwnableUnauthorizedAccount");
    });

    it("rejects callbacks not from the pool or not initiated by itself", async function () {
      const { alice, flash, pool, w } = await deployFixture();
      await expect(
        flash.connect(alice).executeOperation([w], [LOAN], [PREMIUM], await flash.getAddress(), "0x"),
      ).to.be.revertedWithCustomError(flash, "NotPool");

      // A third party asking the real pool to flash-loan *to* this contract.
      await expect(
        pool.connect(alice).flashLoan(await flash.getAddress(), [w], [LOAN], [0], alice.address, "0x", 0),
      ).to.be.revertedWithCustomError(flash, "NotSelfInitiated");
    });
  });
});
