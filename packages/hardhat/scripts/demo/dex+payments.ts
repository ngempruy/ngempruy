import { ensureAssociated } from "../../utils/hts";
import { SAUCERSWAP_TESTNET } from "../../utils/saucerswap";
import type { DemoContext } from "../demo";

const PRICE = 500_000n; // 0.5 USDC
const TINYBAR_TO_WEIBAR = 10_000_000_000n;

/** A fresh payer holding only WHBAR pays a 0.5 USDC order; the merchant (the deployer) receives exactly the price. */
export default async function dexPaymentsDemo({ hre, send }: DemoContext) {
  const { ethers, deployments } = hre;
  const [merchant] = await ethers.getSigners();
  const { usdc, whbar, whbarContract } = SAUCERSWAP_TESTNET;
  const checkoutAddress = (await deployments.get("SwapCheckout")).address;
  const adapter = await ethers.getContractAt("SaucerSwapAdapter", (await deployments.get("SaucerSwapAdapter")).address);
  await ensureAssociated(merchant.address, [usdc]);

  const payer = ethers.Wallet.createRandom().connect(ethers.provider);
  await send(
    `fund payer ${payer.address} with 10 HBAR`,
    merchant.sendTransaction({ to: payer.address, value: ethers.parseEther("10") }),
  );
  for (const [name, address] of [
    ["WHBAR", whbar],
    ["USDC (for the refund)", usdc],
  ]) {
    const hrc719 = new ethers.Contract(address, ["function associate() returns (uint256)"], payer);
    await send(`payer associates ${name} (HIP-719)`, hrc719.associate({ gasLimit: 1_000_000 }));
  }

  // Size the payment from the live rate with a 3% buffer; SwapCheckout refunds whatever exceeds the price.
  const oneWhbar = 100_000_000n;
  const usdcPerWhbar = await adapter.quote(oneWhbar, [whbar, usdc]);
  const amountIn = (PRICE * oneWhbar * 103n) / (usdcPerWhbar * 100n);
  const wrapper = new ethers.Contract(whbarContract, ["function deposit() payable"], payer);
  await send(
    `payer wraps ${ethers.formatUnits(amountIn, 8)} HBAR`,
    wrapper.deposit({ value: amountIn * TINYBAR_TO_WEIBAR, gasLimit: 300_000 }),
  );
  const whbarToken = new ethers.Contract(whbar, ["function approve(address,uint256) returns (bool)"], payer);
  await send("payer approves SwapCheckout", whbarToken.approve(checkoutAddress, amountIn, { gasLimit: 1_000_000 }));

  const checkout = await ethers.getContractAt("SwapCheckout", checkoutAddress, payer);
  const deadline = Math.floor(Date.now() / 1000) + 600;
  // Pin the legacy gas price: hashio's EIP-1559 fee data is sometimes below the network minimum.
  const { gasPrice } = await ethers.provider.getFeeData();
  await send(
    `payer pays order demo-1 (0.5 USDC) with WHBAR`,
    checkout.pay(ethers.id("demo-1"), merchant.address, PRICE, [whbar, usdc], amountIn, deadline, {
      gasLimit: 2_000_000,
      gasPrice,
    }),
    { name: "SwapCheckout", contract: checkout },
  );
}
