import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("RwaNavOracle", function () {
  const ONE_DAY = 86_400;
  const nav = (usd: string) => ethers.parseUnits(usd, 18);

  async function fixture(maxDeviationBps = 1_000) {
    const [admin, outsider] = await ethers.getSigners();
    const oracle = await (await ethers.getContractFactory("RwaNavOracle")).deploy(admin.address, maxDeviationBps);
    return { oracle, admin, outsider };
  }

  it("reverts reads until a NAV is posted", async function () {
    const { oracle } = await fixture();
    await expect(oracle.navPerUnit(ONE_DAY)).to.be.revertedWithCustomError(oracle, "NoNav");
  });

  it("posts NAV rounds and serves fresh values", async function () {
    const { oracle, admin } = await fixture();
    await expect(oracle.postNav(nav("100"), "ipfs://report-1"))
      .to.emit(oracle, "NavPosted")
      .withArgs(1, nav("100"), "ipfs://report-1", admin.address);
    expect(await oracle.navPerUnit(ONE_DAY)).to.equal(nav("100"));
    await oracle.postNav(nav("105"), "ipfs://report-2");
    expect(await oracle.round()).to.equal(2);
  });

  it("reverts on stale NAV", async function () {
    const { oracle } = await fixture();
    await oracle.postNav(nav("100"), "");
    await time.increase(ONE_DAY + 1);
    await expect(oracle.navPerUnit(ONE_DAY)).to.be.revertedWithCustomError(oracle, "StaleNav");
  });

  it("rejects zero and moves beyond the deviation limit", async function () {
    const { oracle } = await fixture(1_000);
    await expect(oracle.postNav(0, "")).to.be.revertedWithCustomError(oracle, "ZeroNav");
    await oracle.postNav(nav("100"), "");
    await expect(oracle.postNav(nav("111"), ""))
      .to.be.revertedWithCustomError(oracle, "DeviationTooHigh")
      .withArgs(nav("100"), nav("111"), 1_000);
    await expect(oracle.postNav(nav("89"), "")).to.be.revertedWithCustomError(oracle, "DeviationTooHigh");
    await oracle.postNav(nav("110"), "");
  });

  it("lets only the admin change the limit and only appraisers post", async function () {
    const { oracle, outsider } = await fixture();
    await expect(oracle.connect(outsider).postNav(nav("1"), "")).to.be.revertedWithCustomError(
      oracle,
      "AccessControlUnauthorizedAccount",
    );
    await expect(oracle.connect(outsider).setMaxDeviationBps(0)).to.be.revertedWithCustomError(
      oracle,
      "AccessControlUnauthorizedAccount",
    );
    await oracle.setMaxDeviationBps(0);
    await oracle.postNav(nav("100"), "");
    await oracle.postNav(nav("1000"), "");
  });
});
