import Link from "next/link";
import { integrations, missingEnvFor, modules } from "@sh/shared";

// Module status depends on env, which is read per request.
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="flex grow flex-col">
      <div className="hedera-gradient dark:bg-hedera-charcoal w-full px-5 py-14 dark:bg-none">
        <div className="mx-auto max-w-4xl text-white">
          <h1 className="mb-3 text-4xl font-bold">Hedera DeFi Kit</h1>
          <p className="m-0 text-lg text-white/80">
            Modular DeFi building blocks on Hedera. Pick modules, swap providers, and let integration recipes compose
            them. Every module works without a wallet or <code>.env</code> until you need to sign.
          </p>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-10">
        <section>
          <h2 className="mb-4 text-xl font-bold">Modules</h2>
          <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2">
            {modules.map(m => {
              const ready = missingEnvFor(m.id, modules, process.env).length === 0;
              return (
                <li key={m.id}>
                  <Link
                    href={`/modules/${m.id}`}
                    className="bg-base-100 border-base-300 block h-full rounded-2xl border p-6 transition-shadow hover:shadow-md"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="m-0 text-lg font-bold">{m.title}</h3>
                      <span className={`badge ${ready ? "badge-success" : "badge-warning"}`}>
                        {ready ? "ready" : "needs setup"}
                      </span>
                    </div>
                    <p className="text-base-content/70 m-0 text-sm">{m.description}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {integrations.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-bold">Active integration recipes</h2>
            <ul className="m-0 list-disc pl-5">
              {integrations.map(r => (
                <li key={r.id}>
                  <span className="font-semibold">{r.title}</span>: {r.description}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
