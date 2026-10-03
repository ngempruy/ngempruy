import { notFound } from "next/navigation";
import { missingEnv, modules } from "@sh/shared";
import { ModuleSetupHint } from "~~/components/ModuleSetupHint";
import { moduleViews } from "~~/modules";

// Env is read per request so a restart after editing .env.local is enough.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return { title: modules.find(m => m.id === id)?.title ?? "Module" };
}

export default async function ModulePage({ params }: Props) {
  const { id } = await params;
  const mod = modules.find(m => m.id === id);
  if (!mod) notFound();

  const missing = missingEnv(mod, process.env);
  const View = moduleViews[mod.id];

  return (
    <div className="w-full max-w-4xl mx-auto px-5 py-10 flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">{mod.title}</h1>
        <p className="m-0 text-base-content/70">{mod.description}</p>
      </div>
      {missing.length > 0 ? <ModuleSetupHint missing={missing} /> : View && <View />}
    </div>
  );
}
