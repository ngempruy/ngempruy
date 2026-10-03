// Selected modules and integration recipes. `npm run configure` rewrites this file.
import { core } from "./core";
import type { IntegrationRecipe, ModuleManifest } from "./define";

export const modules: ModuleManifest[] = [core];
export const integrations: IntegrationRecipe[] = [];
