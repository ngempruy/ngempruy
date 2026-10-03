// Selected modules and integration recipes. `yarn configure` rewrites this file.
import type { IntegrationRecipe, ModuleManifest } from "./define";
import { core } from "./modules/core";
import { rwa } from "./modules/rwa";

export const modules: ModuleManifest[] = [core, rwa];
export const integrations: IntegrationRecipe[] = [];
