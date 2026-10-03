"use client";

import React, { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bars3Icon, BugAntIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { modules } from "@sh/shared";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-hbar";
import { useOutsideClick } from "~~/hooks/scaffold-hbar";

type HeaderMenuLink = {
  label: string;
  href: string;
  icon?: React.ReactNode;
};

export const menuLinks: HeaderMenuLink[] = [
  {
    label: "Home",
    href: "/",
  },
  ...modules.map(m => ({ label: m.title, href: `/modules/${m.id}` })),
  {
    label: "Debug Contracts",
    href: "/debug",
    icon: <BugAntIcon className="h-4 w-4" />,
  },
  {
    label: "Block Explorer",
    href: "/blockexplorer",
    icon: <MagnifyingGlassIcon className="h-4 w-4" />,
  },
];

export const HeaderMenuLinks = () => {
  const pathname = usePathname();

  return (
    <>
      {menuLinks.map(({ label, href, icon }) => {
        const isActive = pathname === href;
        return (
          <li key={href}>
            <Link
              href={href}
              passHref
              className={`${
                isActive ? "bg-primary/10 text-primary font-semibold" : "hover:bg-primary/5"
              } grid grid-flow-col gap-2 rounded-full px-3 py-1.5 text-sm transition-colors`}
            >
              {icon}
              <span>{label}</span>
            </Link>
          </li>
        );
      })}
    </>
  );
};

/**
 * Site header
 */
export const Header = () => {
  const burgerMenuRef = useRef<HTMLDetailsElement>(null);
  useOutsideClick(burgerMenuRef, () => {
    burgerMenuRef?.current?.removeAttribute("open");
  });

  return (
    <div className="navbar bg-base-100 border-base-300 sticky top-0 z-20 min-h-0 shrink-0 justify-between border-b px-0 shadow-sm sm:px-2 lg:static">
      <div className="navbar-start w-auto lg:w-1/2">
        <details className="dropdown" ref={burgerMenuRef}>
          <summary className="btn btn-ghost ml-1 hover:bg-transparent lg:hidden">
            <Bars3Icon className="h-1/2" />
          </summary>
          <ul
            className="menu menu-compact dropdown-content bg-base-100 rounded-box mt-3 w-52 p-2 shadow-sm"
            onClick={() => {
              burgerMenuRef?.current?.removeAttribute("open");
            }}
          >
            <HeaderMenuLinks />
          </ul>
        </details>
        <Link href="/" passHref className="ml-4 mr-6 hidden shrink-0 items-center gap-3 lg:flex">
          <div className="relative flex h-9 w-9">
            <Image alt="ngempruy logo" className="cursor-pointer dark:hidden" fill sizes="36px" src="/logo-black.png" />
            <Image
              alt="ngempruy logo"
              className="hidden cursor-pointer dark:block"
              fill
              sizes="36px"
              src="/logo-white.png"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold leading-tight">Hedera DeFi Kit</span>
            <span className="text-base-content/50 text-[10px] font-medium uppercase tracking-wider">
              Built on Hedera
            </span>
          </div>
        </Link>
        <ul className="menu menu-horizontal hidden gap-2 px-1 lg:flex lg:flex-nowrap">
          <HeaderMenuLinks />
        </ul>
      </div>
      <div className="navbar-end mr-4 grow">
        <RainbowKitCustomConnectButton />
      </div>
    </div>
  );
};
