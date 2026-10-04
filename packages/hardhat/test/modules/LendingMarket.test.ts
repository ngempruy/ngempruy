import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, network } from "hardhat";

const HSS_ADDRESS = "0x000000000000000000000000000000000000016b";
const HBAR = 100_000_000n; // 1 WHBAR, 8 decimals
const USDC = 1_000_000n; // 1 USDC, 6 decimals
const INTERVAL = 3600;

describe("LendingMarket", function () {
  async function deployFixture() {
    const [owner, alice, bob] = await ethers.getSigners();
    const mock = await ethers.deployContract("MockScheduleService");
    await network.provider.send("hardhat_setCode", [
      HSS_ADDRESS,
      await ethers.provider.getCode(await mock.getAddress()),
    ]);
    const hss = await ethers.getContractAt("MockScheduleService", HSS_ADDRESS);

    const whbar = await ethers.deployContract("MockERC20", ["WHBAR", 8]);
    const usdc = await ethers.deployContract("MockERC20", ["USDC", 6]);
    const oracle = await ethers.deployContract("MockOracleAdapter", [owner.address]);
    await oracle.setPrice(await whbar.getAddress(), ethers.parseUnits("0.1", 18)); // $0.10 per HBAR

    // 50% max LTV, liquidation above 80%, checks every hour
    const market = await ethers.deployContract("LendingMarket", [
      owner.address,
      await whbar.getAddress(),
      8,
      await usdc.getAddress(),
      await oracle.getAddress(),
      5_000,
      8_000,
      INTERVAL,
    ]);
    const m = await market.getAddress();
    await usdc.mint(owner.address, 100n * USDC);
    await usdc.approve(m, ethers.MaxUint256);
    await market.supplyLiquidity(100n * USDC);

    await whbar.mint(alice.address, 1_000n * HBAR);
    await whbar.connect(alice).approve(m, ethers.MaxUint256);
    await usdc.connect(alice).approve(m, ethers.MaxUint256);
    // 100 HBAR = $10 of collateral
    await market.connect(alice).deposit(100n * HBAR);
    return { owner, alice, bob, hss, whbar, usdc, oracle, market };
  }

  it("lends up to the max LTV and schedules a health check through HIP-1215", async function () {
    const { alice, hss, usdc, market } = await loadFixture(deployFixture);
    await expect(market.connect(alice).borrow(5n * USDC)).to.emit(market, "CheckScheduled");

    expect(await usdc.balanceOf(alice.address)).to.equal(5n * USDC);
    expect(await market.ltvBps(alice.address)).to.equal(5_000n);
    expect(await hss.count()).to.equal(1n);
    const [to, expiry, gas, data] = await hss.scheduled(0);
    expect(to).to.equal(await market.getAddress());
    expect(expiry).to.equal(BigInt((await time.latest()) + INTERVAL));
    expect(gas).to.equal(await market.CHECK_GAS());
    expect(data).to.equal(market.interface.encodeFunctionData("checkPosition", [alice.address]));

    await expect(market.connect(alice).borrow(1n)).to.be.revertedWithCustomError(market, "ExceedsLtv");
  });

  it("schedules once per loan, not on every borrow", async function () {
    const { alice, hss, market } = await loadFixture(deployFixture);
    await market.connect(alice).borrow(USDC);
    await market.connect(alice).borrow(USDC);
    expect(await hss.count()).to.equal(1n);
  });

  it("re-schedules a healthy position when its check runs", async function () {
    const { alice, hss, market } = await loadFixture(deployFixture);
    await market.connect(alice).borrow(2n * USDC);
    await time.increase(INTERVAL);

    await expect(hss.execute(0)).to.emit(market, "CheckScheduled");
    expect(await hss.count()).to.equal(2n);
    expect((await market.positions(alice.address)).debt).to.equal(2n * USDC);
  });

  it("an early manual check neither liquidates a healthy loan nor double-schedules", async function () {
    const { alice, bob, hss, market } = await loadFixture(deployFixture);
    await market.connect(alice).borrow(2n * USDC);
    await market.connect(bob).checkPosition(alice.address);
    expect(await hss.count()).to.equal(1n);
    expect((await market.positions(alice.address)).debt).to.equal(2n * USDC);
  });

  it("liquidates in the scheduled check once the price drops below the threshold", async function () {
    const { alice, hss, whbar, oracle, market } = await loadFixture(deployFixture);
    await market.connect(alice).borrow(5n * USDC);
    await oracle.setPrice(await whbar.getAddress(), ethers.parseUnits("0.06", 18)); // 5 / 6 = 83% > 80%
    await time.increase(INTERVAL);

    await expect(hss.execute(0))
      .to.emit(market, "Liquidated")
      .withArgs(alice.address, 100n * HBAR, 5n * USDC);
    const position = await market.positions(alice.address);
    expect([position.collateral, position.debt, position.nextCheck]).to.deep.equal([0n, 0n, 0n]);
    expect(await market.reserves()).to.equal(100n * HBAR);
    expect(await hss.count()).to.equal(1n); // no further checks for a closed position
  });

  it("does not liquidate or stop checking when the price is unavailable", async function () {
    const { alice, hss, whbar, oracle, market } = await loadFixture(deployFixture);
    await market.connect(alice).borrow(5n * USDC);
    await oracle.setPrice(await whbar.getAddress(), 0); // no price → getPrice reverts NoFeed
    await time.increase(INTERVAL);

    await expect(hss.execute(0))
      .to.emit(market, "PositionChecked")
      .withArgs(alice.address, 5n * USDC * 10n ** 12n, 0n, false);
    expect((await market.positions(alice.address)).debt).to.equal(5n * USDC);
    expect(await hss.count()).to.equal(2n);
    expect(await whbar.balanceOf(await market.getAddress())).to.equal(100n * HBAR);
  });

  it("refuses to open a loan it cannot schedule a check for", async function () {
    const { alice, hss, market } = await loadFixture(deployFixture);
    await hss.setBusy(true);
    await expect(market.connect(alice).borrow(USDC))
      .to.be.revertedWithCustomError(market, "ScheduleFailed")
      .withArgs(366);
  });

  it("stops checking once the loan is repaid", async function () {
    const { alice, hss, usdc, market } = await loadFixture(deployFixture);
    await market.connect(alice).borrow(2n * USDC);
    await expect(market.connect(alice).repay(10n * USDC))
      .to.emit(market, "Repaid")
      .withArgs(alice.address, 2n * USDC);
    expect(await usdc.balanceOf(alice.address)).to.equal(0n);
    await time.increase(INTERVAL);
    await hss.execute(0);
    expect(await hss.count()).to.equal(1n);
  });

  it("only lets collateral out while the loan stays within the max LTV", async function () {
    const { alice, whbar, market } = await loadFixture(deployFixture);
    await market.connect(alice).borrow(4n * USDC); // needs $8 of the $10 at 50%
    await expect(market.connect(alice).withdraw(30n * HBAR)).to.be.revertedWithCustomError(market, "ExceedsLtv");
    await market.connect(alice).withdraw(20n * HBAR);
    expect(await whbar.balanceOf(alice.address)).to.equal(920n * HBAR);
  });

  it("caps borrowing at the available liquidity", async function () {
    const { alice, market } = await loadFixture(deployFixture);
    await market.withdrawLiquidity(99n * USDC);
    await expect(market.connect(alice).borrow(2n * USDC))
      .to.be.revertedWithCustomError(market, "InsufficientLiquidity")
      .withArgs(USDC);
  });

  it("validates risk params and keeps admin functions owner-only", async function () {
    const { alice, market } = await loadFixture(deployFixture);
    await expect(market.setRiskParams(9_000, 8_000, INTERVAL)).to.be.revertedWithCustomError(
      market,
      "InvalidRiskParams",
    );
    await expect(market.setRiskParams(5_000, 8_000, 0)).to.be.revertedWithCustomError(market, "InvalidRiskParams");
    for (const call of [
      market.connect(alice).setRiskParams(5_000, 8_000, INTERVAL),
      market.connect(alice).supplyLiquidity(1n),
      market.connect(alice).withdrawLiquidity(1n),
      market.connect(alice).withdrawReserves(1n),
      market.connect(alice).associate(ethers.ZeroAddress),
    ]) {
      await expect(call).to.be.revertedWithCustomError(market, "OwnableUnauthorizedAccount");
    }
  });
});
