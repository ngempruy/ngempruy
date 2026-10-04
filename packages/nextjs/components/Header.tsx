"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bars2Icon, BugAntIcon, ChevronDownIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { modules } from "@sh/shared";
import { moduleMeta } from "~~/components/kit/moduleMeta";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-hbar";
import { useOutsideClick } from "~~/hooks/scaffold-hbar";

type Menu = "modules" | "dev";

const DEV_TOOLS = [
  { label: "Debug Contracts", href: "/debug", hint: "Read and write any deployed kit contract", icon: BugAntIcon },
  {
    label: "Block Explorer",
    href: "/blockexplorer",
    hint: "Local transactions and addresses",
    icon: MagnifyingGlassIcon,
  },
];

/**
 * Site header. The module list is generated from the selected manifests, so it lives in a dropdown
 * (and a sheet on small screens) instead of the bar: it grows with every module you add.
 */
export const Header = () => {
  const pathname = usePathname();
  const [open, setOpen] = useState<Menu | null>(null);
  const [sheet, setSheet] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  useOutsideClick(navRef, () => setOpen(null));

  useEffect(() => {
    setOpen(null);
    setSheet(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(null);
      setSheet(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggle = (menu: Menu) => setOpen(current => (current === menu ? null : menu));
  const inModules = pathname.startsWith("/modules/");
  const inDev = DEV_TOOLS.some(t => pathname.startsWith(t.href));

  return (
    <header className="border-base-content/10 bg-base-100/80 sticky top-0 z-30 border-b backdrop-blur-xl">
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto] items-center gap-4 px-4 lg:grid-cols-[1fr_auto_1fr]">
        <Link href="/" className="flex w-fit shrink-0 items-center gap-3">
          <div className="relative h-8 w-8">
            <Image alt="ngempruy logo" className="dark:hidden" fill sizes="32px" src="/logo-black.png" />
            <Image alt="ngempruy logo" className="hidden dark:block" fill sizes="32px" src="/logo-white.png" />
          </div>
          <div className="flex flex-col">
            <span className="whitespace-nowrap text-[15px] font-bold leading-tight">Hedera DeFi Kit</span>
            <span className="text-base-content/50 hidden text-[10px] font-medium uppercase tracking-wider sm:block">
              Built on Hedera
            </span>
          </div>
        </Link>

        <nav ref={navRef} aria-label="Main" className="relative hidden items-center gap-1 lg:flex">
          <NavLink href="/" active={pathname === "/"}>
            Home
          </NavLink>
          <Trigger label="Modules" active={inModules} expanded={open === "modules"} onClick={() => toggle("modules")} />
          <Trigger label="Dev tools" active={inDev} expanded={open === "dev"} onClick={() => toggle("dev")} />

          {open === "modules" && (
            <div className="glass-panel dropdown-pop absolute left-1/2 top-12 w-[600px] -translate-x-1/2 rounded-2xl p-2">
              <ul className="m-0 grid list-none grid-cols-2 gap-1 p-0">
                {modules.map(m => {
                  const { icon: Icon, gradient } = moduleMeta(m.id);
                  return (
                    <li key={m.id}>
                      <Link
                        href={`/modules/${m.id}`}
                        className={`hover:bg-base-content/5 flex gap-3 rounded-xl p-3 transition-colors ${
                          pathname === `/modules/${m.id}` ? "bg-base-content/5" : ""
                        }`}
                      >
                        <span
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white"
                          style={{ background: gradient }}
                        >
                          <Icon className="h-5 w-5 text-black/70" />
                        </span>
                        <span className="min-w-0">
                          <strong className="block text-sm font-semibold">{m.title}</strong>
                          <span className="text-base-content/60 line-clamp-2 text-xs leading-snug">
                            {m.description}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {open === "dev" && (
            <div className="glass-panel dropdown-pop absolute left-1/2 top-12 w-72 -translate-x-1/4 rounded-2xl p-2">
              {DEV_TOOLS.map(({ label, href, hint, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="hover:bg-base-content/5 flex items-center gap-3 rounded-xl p-3 transition-colors"
                >
                  <Icon className="text-base-content/70 h-5 w-5 shrink-0" />
                  <span>
                    <strong className="block text-sm font-semibold">{label}</strong>
                    <span className="text-base-content/60 text-xs">{hint}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </nav>

        <div className="flex items-center justify-end gap-2">
          <RainbowKitCustomConnectButton />
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle lg:hidden"
            aria-label={sheet ? "Close menu" : "Open menu"}
            aria-expanded={sheet}
            onClick={() => setSheet(s => !s)}
          >
            {sheet ? <XMarkIcon className="h-5 w-5" /> : <Bars2Icon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {sheet && (
        <div className="glass-panel dropdown-pop absolute left-3 right-3 top-[4.25rem] max-h-[calc(100svh-6rem)] overflow-auto rounded-2xl p-3 lg:hidden">
          <SheetGroup title="Modules">
            {modules.map(m => (
              <SheetLink key={m.id} href={`/modules/${m.id}`}>
                {m.title}
              </SheetLink>
            ))}
          </SheetGroup>
          <SheetGroup title="Dev tools">
            {DEV_TOOLS.map(t => (
              <SheetLink key={t.href} href={t.href}>
                {t.label}
              </SheetLink>
            ))}
          </SheetGroup>
        </div>
      )}
    </header>
  );
};

const navItem = "rounded-full px-3.5 py-1.5 text-sm transition-colors";

const NavLink = ({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) => (
  <Link
    href={href}
    className={`${navItem} ${active ? "text-base-content font-semibold" : "text-base-content/70 hover:text-base-content"}`}
  >
    {children}
  </Link>
);

const Trigger = ({
  label,
  active,
  expanded,
  onClick,
}: {
  label: string;
  active: boolean;
  expanded: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-expanded={expanded}
    onClick={onClick}
    className={`${navItem} inline-flex items-center gap-1.5 ${
      active || expanded ? "text-base-content font-semibold" : "text-base-content/70 hover:text-base-content"
    }`}
  >
    {label}
    <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
  </button>
);

const SheetGroup = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-2">
    <h3 className="text-base-content/50 m-0 px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wider">{title}</h3>
    {children}
  </div>
);

const SheetLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="hover:bg-base-content/5 block rounded-lg px-3 py-2.5 text-[15px]">
    {children}
  </Link>
);
