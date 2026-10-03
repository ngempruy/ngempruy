import { TokenId } from "@hiero-ledger/sdk";
import type { DeployFunction } from "hardhat-deploy/types";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { MIRROR_NODE, writeHederaResources } from "../utils/hedera";

/** NAV moves above 10% per post need the admin to raise the limit first. */
const MAX_NAV_DEVIATION_BPS = 1_000;
/** HTS token creation costs ~$1; the unused part stays in the RwaToken contract balance. */
const TOKEN_CREATE_FEE = "20";

const deployRwa: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("RwaNavOracle", { from: deployer, args: [deployer, MAX_NAV_DEVIATION_BPS], log: true });
  const { address } = await deploy("RwaToken", { from: deployer, args: [deployer], log: true });

  const chainId = Number(await hre.getChainId());
  if (!MIRROR_NODE[chainId]) return; // local network: tests create tokens against MockHts

  const rwa = await hre.ethers.getContractAt("RwaToken", address, await hre.ethers.getSigner(deployer));
  let token = await rwa.token();
  if (token === hre.ethers.ZeroAddress) {
    const tx = await rwa.createToken("Kit Real Estate Share", "KRES", 6, "hedera-defi-kit demo RWA", {
      value: hre.ethers.parseEther(TOKEN_CREATE_FEE),
      gasLimit: 2_500_000,
    });
    await tx.wait();
    token = await rwa.token();
  }
  const tokenId = TokenId.fromSolidityAddress(token).toString();
  writeHederaResources(chainId, { rwaTokenId: tokenId });
  console.log(`RWA token ${tokenId}: https://hashscan.io/${chainId === 295 ? "mainnet" : "testnet"}/token/${tokenId}`);
};

deployRwa.tags = ["rwa"];
export default deployRwa;
