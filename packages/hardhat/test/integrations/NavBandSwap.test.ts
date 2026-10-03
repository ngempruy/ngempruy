import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("NavBandSwap (dex+rwa)", function () {
  const DAY = 86_400;
  const BAND_BPS = 100; // pay at most 1% above NAV
  const usdc = (n: string) => ethers.parseUnits(n, 6);

  /** NAV is $100 per unit; `rateBps` is how many RWA units (in bps) one USDC unit buys on the mock DEX. */
  async function fixture(rateBps: number) {
    const [admin, buyer] = await ethers.getSigners();
    const quote = await ethers.deployContract("MockERC20", ["USDC", 6]);
    const rwa = await ethers.deployContract("MockERC20", ["KRES", 6]);
    const adapter = await ethers.deployContract("MockSwapAdapter");
    const oracle = await ethers.deployContract("RwaNavOracle", [admin.address, 0]);
    await oracle.postNav(ethers.parseUnits("100", 18), "ipfs://appraisal");
    await adapter.setRate(await quote.getAddress(), await rwa.getAddress(), rateBps);
    await rwa.mint(await adapter.getAddress(), usdc("1000"));

    const guard = await ethers.deployContract("NavBandSwap", [
      await adapter.getAddress(),
      await oracle.getAddress(),
      await rwa.getAddress(),
      6,
      await quote.getAddress(),
      6,
      DAY,
      BAND_BPS,
    ]);
    await quote.mint(buyer.address, usdc("1000"));
    await quote.connect(buyer).approve(await guard.getAddress(), usdc("1000"));
    const deadline = (await time.latest()) + 600;
    return { guard, oracle, rwa, buyer, deadline };
  }

  it("previews the premium against NAV", async function () {
    const { guard } = await fixture(100); // 1 USDC → 0.01 unit = exactly $100/unit
    const [rwaOut, nav, premium] = await guard.previewBuy(usdc("100"));
    expect(rwaOut).to.equal(usdc("1"));
    expect(nav).to.equal(ethers.parseUnits("100", 18));
    expect(premium).to.equal(0);
  });

  it("buys when the pool price is within the band and sends units to the buyer", async function () {
    const { guard, rwa, buyer, deadline } = await fixture(100);
    await expect(guard.connect(buyer).buy(usdc("100"), usdc("1"), deadline))
      .to.emit(guard, "BoughtNearNav")
      .withArgs(buyer.address, usdc("100"), usdc("1"), ethers.parseUnits("100", 18), 0);
    expect(await rwa.balanceOf(buyer.address)).to.equal(usdc("1"));
  });

  it("allows buying below NAV", async function () {
    const { guard, buyer, deadline } = await fixture(105); // ≈ $95.24/unit
    const [, , premium] = await guard.previewBuy(usdc("100"));
    expect(premium).to.be.lessThan(0);
    await guard.connect(buyer).buy(usdc("100"), 0, deadline);
  });

  it("refuses to pay more than the band above NAV", async function () {
    const { guard, buyer, deadline } = await fixture(98); // ≈ $102.04/unit, 2% premium
    await expect(guard.connect(buyer).buy(usdc("100"), 0, deadline))
      .to.be.revertedWithCustomError(guard, "AboveNavBand")
      .withArgs(204, BAND_BPS);
  });

  it("refuses stale NAV and empty pools", async function () {
    const { guard, buyer, deadline } = await fixture(100);
    await time.increase(DAY + 1);
    await expect(guard.connect(buyer).buy(usdc("100"), 0, deadline + DAY)).to.be.revertedWithCustomError(
      await ethers.getContractFactory("RwaNavOracle"),
      "StaleNav",
    );

    const empty = await fixture(0);
    await expect(empty.guard.previewBuy(usdc("100"))).to.be.revertedWithCustomError(empty.guard, "NoLiquidity");
  });
});
