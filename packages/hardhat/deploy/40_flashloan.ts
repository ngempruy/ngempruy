import type { DeployFunction } from "hardhat-deploy/types";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { BONZO_TESTNET } from "../utils/bonzo";
import { getDeployGasPrice } from "../utils/getDeployGasPrice";
import { SAUCERSWAP_TESTNET } from "../utils/saucerswap";

/**
 * Deploys both flash loan providers on the SaucerSwap adapter. SaucerSwapFlashLoan borrows WHBAR from the
 * WHBAR/USDC pair; BonzoFlashLoan is ready for when Bonzo Lend is unpaused. Testnet only.
 */
const deployFlashLoan: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, execute, get, log } = hre.deployments;
  const gasPrice = await getDeployGasPrice(hre);
  const tx = { from: deployer, gasLimit: "1000000", gasPrice };
  const adapter = (await get("SaucerSwapAdapter")).address;
  const { whbar, usdc, sauce, whbarUsdcPair } = SAUCERSWAP_TESTNET;

  const providers = [
    { name: "SaucerSwapFlashLoan", args: [deployer, adapter, BONZO_TESTNET.lendingPool], tokens: [whbar, usdc, sauce] },
    { name: "BonzoFlashLoan", args: [deployer, BONZO_TESTNET.lendingPool, adapter], tokens: [whbar, usdc] },
  ];
  for (const { name, args, tokens } of providers) {
    const result = await deploy(name, {
      from: deployer,
      args,
      log: true,
      autoMine: true,
      gasLimit: "3000000",
      gasPrice,
    });
    if (result.newlyDeployed) {
      for (const token of tokens) await execute(name, tx, "associate", token);
      if (name === "SaucerSwapFlashLoan") {
        await execute(name, tx, "setFlashPair", whbar, whbarUsdcPair);
        // The demo route trades SAUCE, which the adapter holds mid-swap.
        await execute("SaucerSwapAdapter", tx, "associate", sauce);
      }
    }
    log(`${name}: https://hashscan.io/testnet/contract/${result.address}`);
  }
};

deployFlashLoan.tags = ["flashloan"];
deployFlashLoan.dependencies = ["dex"];
// Bonzo, SaucerSwap and the HTS precompile only exist on Hedera.
deployFlashLoan.skip = async hre => hre.network.name !== "hederaTestnet";
export default deployFlashLoan;
