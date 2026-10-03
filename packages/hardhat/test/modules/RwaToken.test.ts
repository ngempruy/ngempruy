import { installMockHts } from "../helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("RwaToken", function () {
  async function fixture() {
    const [admin, investor, outsider] = await ethers.getSigners();
    const hts = await installMockHts();
    const rwa = await (await ethers.getContractFactory("RwaToken")).deploy(admin.address);
    await rwa.createToken("Jakarta Office Tower", "JOT", 6, "appraised quarterly");
    const token = await rwa.token();
    return { rwa, hts, token, admin, investor, outsider };
  }

  it("creates the HTS token once, with the contract as treasury", async function () {
    const { rwa, hts, token } = await fixture();
    expect(await hts.treasuryOf(token)).to.equal(await rwa.getAddress());
    await expect(rwa.createToken("x", "X", 0, "")).to.be.revertedWithCustomError(rwa, "TokenAlreadyCreated");
  });

  it("issues to an investor only after KYC is granted", async function () {
    const { rwa, hts, token, investor } = await fixture();
    await hts.setAssociated(token, investor.address);

    await expect(rwa.issue(investor.address, 1_000_000))
      .to.be.revertedWithCustomError(rwa, "KycRequired")
      .withArgs(investor.address);

    await expect(rwa.grantKyc(investor.address)).to.emit(rwa, "KycGranted").withArgs(investor.address);
    await expect(rwa.issue(investor.address, 1_000_000)).to.emit(rwa, "Issued").withArgs(investor.address, 1_000_000);
    expect(await hts.balance(token, investor.address)).to.equal(1_000_000);
  });

  it("surfaces the HTS code when KYC is granted before association", async function () {
    const { rwa, investor } = await fixture();
    const grantSelector = ethers.id("grantTokenKyc(address,address)").slice(0, 10);
    await expect(rwa.grantKyc(investor.address))
      .to.be.revertedWithCustomError(rwa, "HtsCallFailed")
      .withArgs(grantSelector, 184);
  });

  it("blocks issuance after KYC is revoked", async function () {
    const { rwa, hts, token, investor } = await fixture();
    await hts.setAssociated(token, investor.address);
    await rwa.grantKyc(investor.address);
    await expect(rwa.revokeKyc(investor.address)).to.emit(rwa, "KycRevoked");
    await expect(rwa.issue(investor.address, 1)).to.be.revertedWithCustomError(rwa, "KycRequired");
  });

  it("enforces roles and amount bounds", async function () {
    const { rwa, hts, token, investor, outsider } = await fixture();
    await hts.setAssociated(token, investor.address);
    await expect(rwa.connect(outsider).grantKyc(investor.address)).to.be.revertedWithCustomError(
      rwa,
      "AccessControlUnauthorizedAccount",
    );
    await expect(rwa.connect(outsider).issue(investor.address, 1)).to.be.revertedWithCustomError(
      rwa,
      "AccessControlUnauthorizedAccount",
    );
    await expect(rwa.issue(investor.address, 0)).to.be.revertedWithCustomError(rwa, "ZeroAmount");
    await expect(rwa.issue(investor.address, 2n ** 63n)).to.be.revertedWithCustomError(rwa, "AmountTooLarge");
  });

  it("refuses KYC actions before the token exists", async function () {
    const [admin, investor] = await ethers.getSigners();
    await installMockHts();
    const rwa = await (await ethers.getContractFactory("RwaToken")).deploy(admin.address);
    await expect(rwa.grantKyc(investor.address)).to.be.revertedWithCustomError(rwa, "TokenNotCreated");
  });
});
