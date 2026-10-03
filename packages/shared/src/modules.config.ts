// Selected modules and integration recipes. `yarn configure` rewrites this file.
import type { IntegrationRecipe, ModuleManifest } from "./define";
import { rwaPayments } from "./integrations/rwa+payments";
import { core } from "./modules/core";
import { dex } from "./modules/dex";
import { flashloan } from "./modules/flashloan";
import { payments } from "./modules/payments";
import { rwa } from "./modules/rwa";

export const modules: ModuleManifest[] = [core, rwa, dex, flashloan, payments];
export const integrations: IntegrationRecipe[] = [rwaPayments];
