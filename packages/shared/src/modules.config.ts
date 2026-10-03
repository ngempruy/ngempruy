// Selected modules and integration recipes. `yarn configure` rewrites this file.
import type { IntegrationRecipe, ModuleManifest } from "./define";
import { rwaPayments } from "./integrations/rwa+payments";
import { core } from "./modules/core";
import { dex } from "./modules/dex";
import { payments } from "./modules/payments";
import { rwa } from "./modules/rwa";

export const modules: ModuleManifest[] = [core, rwa, dex, payments];
export const integrations: IntegrationRecipe[] = [rwaPayments];
