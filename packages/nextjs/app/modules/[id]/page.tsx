import { notFound } from "next/navigation";
import { missingEnvFor, modules } from "@sh/shared";
import { ModuleSetupHint } from "~~/components/ModuleSetupHint";
import { moduleMeta } from "~~/components/kit/moduleMeta";
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

  const missing = missingEnvFor(mod.id, modules, process.env);
  const View = moduleViews[mod.id];
  const { icon: Icon, gradient, stack } = moduleMeta(mod.id);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl" style={{ background: gradient }}>
          <Icon className="h-7 w-7 text-black/70" />
        </span>
        <div>
          <h1 className="mb-2 text-3xl font-light tracking-tight">{mod.title}</h1>
          <p className="text-base-content/70 m-0 max-w-3xl">{mod.description}</p>
          {stack.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {stack.map(s => (
                <span key={s} className="border-base-content/10 rounded-full border px-2.5 py-0.5 text-xs">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {missing.length > 0 && <ModuleSetupHint missing={missing} />}
      {View && <View ready={missing.length === 0} />}
    </div>
  );
}
