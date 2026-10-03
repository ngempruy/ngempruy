import Link from "next/link";
import { integrations, missingEnv, modules } from "@sh/shared";

// Module status depends on env, which is read per request.
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="flex flex-col grow">
      <div className="hedera-gradient dark:bg-none dark:bg-hedera-charcoal w-full py-14 px-5">
        <div className="max-w-4xl mx-auto text-white">
          <h1 className="text-4xl font-bold mb-3">Hedera DeFi Kit</h1>
          <p className="m-0 text-lg text-white/80">
            Modular DeFi building blocks on Hedera. Pick modules, swap providers, and let integration recipes compose
            them. Every module works without a wallet or <code>.env</code> until you need to sign.
          </p>
        </div>
      </div>

      <div className="w-full max-w-4xl mx-auto px-5 py-10 flex flex-col gap-8">
        <section>
          <h2 className="text-xl font-bold mb-4">Modules</h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 m-0 p-0 list-none">
            {modules.map(m => {
              const ready = missingEnv(m, process.env).length === 0;
              return (
                <li key={m.id}>
                  <Link
                    href={`/modules/${m.id}`}
                    className="block h-full bg-base-100 rounded-2xl border border-base-300 p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="m-0 font-bold text-lg">{m.title}</h3>
                      <span className={`badge ${ready ? "badge-success" : "badge-warning"}`}>
                        {ready ? "ready" : "needs setup"}
                      </span>
                    </div>
                    <p className="m-0 text-sm text-base-content/70">{m.description}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {integrations.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4">Active integration recipes</h2>
            <ul className="m-0 pl-5 list-disc">
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
