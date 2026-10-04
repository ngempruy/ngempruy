// Selected modules and integration recipes. `yarn configure` rewrites this file.
import type { IntegrationRecipe, ModuleManifest } from "./define";
import { dexPayments } from "./integrations/dex+payments";
import { dexRwa } from "./integrations/dex+rwa";
import { rwaPayments } from "./integrations/rwa+payments";
import { core } from "./modules/core";
import { dex } from "./modules/dex";
import { flashloan } from "./modules/flashloan";
import { lending } from "./modules/lending";
import { payments } from "./modules/payments";
import { rwa } from "./modules/rwa";

export const modules: ModuleManifest[] = [core, rwa, dex, payments, flashloan, lending];
export const integrations: IntegrationRecipe[] = [dexPayments, dexRwa, rwaPayments];
