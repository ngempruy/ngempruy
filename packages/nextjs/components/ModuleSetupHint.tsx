import type { EnvVar } from "@sh/shared";

/** Shown instead of a module's UI while its required env vars are missing. */
export const ModuleSetupHint = ({ missing }: { missing: EnvVar[] }) => (
  <div role="status" className="alert alert-warning flex flex-col items-start gap-3">
    <p className="m-0 font-semibold">Setup incomplete: actions that sign transactions are disabled.</p>
    <p className="m-0 text-sm">
      Add these to <code>packages/nextjs/.env.local</code> (see <code>.env.example</code>) and restart the dev server:
    </p>
    <ul className="m-0 list-disc pl-5 text-sm">
      {missing.map(v => (
        <li key={v.key}>
          <code>{v.key}</code>: {v.description}
        </li>
      ))}
    </ul>
  </div>
);
