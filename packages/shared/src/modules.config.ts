// Selected modules and integration recipes. `yarn configure` rewrites this file.
import type { IntegrationRecipe, ModuleManifest } from "./define";
import { core } from "./modules/core";
import { payments } from "./modules/payments";
import { rwa } from "./modules/rwa";

export const modules: ModuleManifest[] = [core, rwa, payments];
export const integrations: IntegrationRecipe[] = [];
