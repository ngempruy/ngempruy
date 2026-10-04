import type { ComponentType, SVGProps } from "react";
import {
  ArrowsRightLeftIcon,
  BanknotesIcon,
  BoltIcon,
  BuildingLibraryIcon,
  CreditCardIcon,
  CubeIcon,
  DocumentCheckIcon,
} from "@heroicons/react/24/outline";

type ModuleMeta = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** CSS gradient for the glow card and accents. */
  gradient: string;
  /** Hedera services and protocols the module builds on, shown as tags. */
  stack: string[];
};

// Presentation only: a module missing here (e.g. one you add) falls back to DEFAULT.
const META: Record<string, ModuleMeta> = {
  core: {
    icon: DocumentCheckIcon,
    gradient: "linear-gradient(137deg, #FFFFFF 0%, #7DD3FC 45%, #06B6D4 100%)",
    stack: ["HCS", "Mirror node"],
  },
  rwa: {
    icon: BuildingLibraryIcon,
    gradient: "linear-gradient(137deg, #FF3D77 0%, #FFB1CE 45%, #FF9D3C 100%)",
    stack: ["HTS", "KYC key", "HCS"],
  },
  dex: {
    icon: ArrowsRightLeftIcon,
    gradient: "linear-gradient(137deg, #4361EE 0%, #E0AEFF 45%, #F72585 100%)",
    stack: ["SaucerSwap", "HTS"],
  },
  payments: {
    icon: CreditCardIcon,
    gradient: "linear-gradient(137deg, #34EEB6 0%, #A7F3D0 45%, #2D84EB 100%)",
    stack: ["x402", "Blocky402"],
  },
  flashloan: {
    icon: BoltIcon,
    gradient: "linear-gradient(137deg, #FFCF72 0%, #FFF1C2 45%, #FF8863 100%)",
    stack: ["SaucerSwap", "Bonzo Lend"],
  },
  lending: {
    icon: BanknotesIcon,
    gradient: "linear-gradient(137deg, #8259EF 0%, #C8A0E0 45%, #B04090 100%)",
    stack: ["HIP-1215", "Chainlink"],
  },
};

const DEFAULT: ModuleMeta = {
  icon: CubeIcon,
  gradient: "linear-gradient(137deg, #8259EF 0%, #C8A0E0 50%, #2D84EB 100%)",
  stack: [],
};

export const moduleMeta = (id: string) => META[id] ?? DEFAULT;
