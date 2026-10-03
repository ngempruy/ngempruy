import { ethers, network } from "hardhat";

export const HTS_ADDRESS = "0x0000000000000000000000000000000000000167";

/** Replaces the HTS system contract with MockHts for the current test run. */
export async function installMockHts() {
  const mock = await (await ethers.getContractFactory("MockHts")).deploy();
  await network.provider.send("hardhat_setCode", [HTS_ADDRESS, await ethers.provider.getCode(await mock.getAddress())]);
  return ethers.getContractAt("MockHts", HTS_ADDRESS);
}
