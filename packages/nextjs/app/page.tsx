import Link from "next/link";
import { CircleStackIcon, CubeTransparentIcon, DocumentCheckIcon } from "@heroicons/react/24/outline";
import { integrations, missingEnvFor, modules } from "@sh/shared";
import { moduleMeta } from "~~/components/kit/moduleMeta";

// Module status depends on env, which is read per request.
export const dynamic = "force-dynamic";

const BUILT_ON = ["HTS", "HCS", "Schedule Service", "SaucerSwap", "Chainlink", "Pyth", "x402"];
const REPO = "https://github.com/ngempruy/ngempruy";

export default function Home() {
  return (
    <div className="flex grow flex-col gap-16 px-3 pb-16 pt-3 sm:px-4">
      <Hero />

      <section id="modules" className="mx-auto w-full max-w-6xl scroll-mt-24">
        <SectionTitle
          title="Modules"
          sub="Pick any combination with yarn configure. Each module works on its own and shows a setup hint until its env is set."
        />
        <ul className="m-0 grid list-none grid-cols-1 gap-8 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m, i) => {
            const ready = missingEnvFor(m.id, modules, process.env).length === 0;
            const { icon: Icon, gradient, stack } = moduleMeta(m.id);
            return (
              <li key={m.id} className="fade-up" style={{ animationDelay: `${0.08 * i}s` }}>
                <Link
                  href={`/modules/${m.id}`}
                  className="glow-card block"
                  style={{ "--glow": gradient } as React.CSSProperties}
                >
                  <div className="glow-card-inner flex flex-col gap-4 p-6">
                    <div className="flex items-start justify-between">
                      <Icon className="text-base-content/90 h-8 w-8" strokeWidth={1.75} />
                      <span className={`badge badge-sm ${ready ? "badge-success" : "badge-warning"}`}>
                        {ready ? "ready" : "needs setup"}
                      </span>
                    </div>
                    <div className="grow">
                      <h3 className="m-0 mb-2 text-xl font-medium tracking-tight">{m.title}</h3>
                      <p className="text-base-content/60 m-0 text-sm leading-relaxed">{m.description}</p>
                    </div>
                    {stack.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {stack.map(s => (
                          <span key={s} className="border-base-content/10 rounded-full border px-2.5 py-0.5 text-xs">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {integrations.length > 0 && (
        <section className="mx-auto w-full max-w-6xl">
          <SectionTitle
            title="Integration recipes"
            sub="Switched on automatically when every module they compose is selected."
          />
          <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2">
            {integrations.map(r => (
              <li key={r.id} className="bg-base-100 border-base-300 rounded-2xl border p-5">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {r.when.map((id, i) => (
                    <span key={id} className="flex items-center gap-2">
                      {i > 0 && <span className="text-base-content/40">+</span>}
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-medium text-black/80"
                        style={{ background: moduleMeta(id).gradient }}
                      >
                        {modules.find(m => m.id === id)?.title ?? id}
                      </span>
                    </span>
                  ))}
                </div>
                <h3 className="m-0 mb-1 text-lg font-semibold">{r.title}</h3>
                <p className="text-base-content/60 m-0 text-sm">{r.description}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const Hero = () => (
  <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
    <section className="hero-card flex w-full flex-col items-center rounded-[20px] px-6 pb-14 pt-20 text-center sm:pt-24">
      <div className="hero-grid" />

      <div className="mb-12 flex items-center" aria-hidden>
        <Node title="HTS">
          <CubeTransparentIcon className="h-5 w-5" />
        </Node>
        <div className="pipeline-line" />
        <div className="pipeline-node pipeline-node-center">
          <span className="text-2xl font-bold">ℏ</span>
        </div>
        <div className="pipeline-line right" />
        <Node title="HCS">
          <DocumentCheckIcon className="h-5 w-5" />
        </Node>
      </div>

      <span className="mb-5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-white/70">
        Hedera DeFi Kit · scaffold-hbar template
      </span>
      <h1 className="m-0 text-[clamp(2.4rem,5.5vw,4rem)] font-light leading-[1.1] tracking-tight">
        Composable DeFi,
        <strong className="hero-title-gradient mt-1 block font-normal">native to Hedera</strong>
      </h1>
      <p className="mx-auto mb-9 mt-5 max-w-xl text-[15px] leading-relaxed text-white/50">
        RWA tokens with on-chain compliance, SaucerSwap liquidity, x402 payments, flash loans and self-liquidating
        loans. Pick the modules you need; recipes wire them together.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="#modules"
          className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-[#0a0a0f] transition hover:-translate-y-px hover:opacity-90"
        >
          Explore modules
        </Link>
        <a
          href={REPO}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/10 bg-white/5 px-7 py-3 text-sm font-medium text-white transition hover:bg-white/10"
        >
          View on GitHub
        </a>
      </div>
    </section>
    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
      <span className="text-base-content/40 flex items-center gap-2 text-xs uppercase tracking-wider">
        <CircleStackIcon className="h-4 w-4" />
        Built on
      </span>
      {BUILT_ON.map(name => (
        <span key={name} className="text-base-content/55 text-sm font-medium">
          {name}
        </span>
      ))}
    </div>
  </div>
);

// The label hangs below the node so the beam lines meet the node's centre.
const Node = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="relative">
    <div className="pipeline-node">{children}</div>
    <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 text-[11px] font-medium tracking-wider text-white/40">
      {title}
    </span>
  </div>
);

const SectionTitle = ({ title, sub }: { title: string; sub: string }) => (
  <div className="mb-8">
    <h2 className="m-0 mb-2 text-3xl font-light tracking-tight">{title}</h2>
    <p className="text-base-content/60 m-0 max-w-2xl text-sm">{sub}</p>
  </div>
);
