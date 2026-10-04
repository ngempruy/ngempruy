import type { ReactNode } from "react";

/** Labelled value tile used across module pages. */
export const Stat = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="bg-base-100 border-base-300 rounded-2xl border p-5">
    <p className="text-base-content/60 m-0 text-xs uppercase tracking-wider">{label}</p>
    <div className="mt-1 font-semibold">{children}</div>
  </div>
);

/** Secondary line under a Stat value. */
export const Small = ({ children }: { children: ReactNode }) => (
  <span className="text-base-content/60 mt-0.5 block text-xs font-normal">{children}</span>
);

/** Titled action block used across module pages. */
export const Panel = ({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) => (
  <section className="bg-base-100 border-base-300 flex flex-col gap-3 rounded-2xl border p-5">
    <div>
      <h3 className="m-0 font-bold">{title}</h3>
      {hint && <p className="text-base-content/70 m-0 mt-1 text-sm">{hint}</p>}
    </div>
    {children}
  </section>
);
