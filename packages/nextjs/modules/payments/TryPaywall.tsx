"use client";

import { useState } from "react";

/** Calls the paid endpoint without paying and shows the decoded 402 payment requirements. */
export const TryPaywall = ({ endpoint }: { endpoint: string }) => {
  const [result, setResult] = useState<string>();

  const probe = async () => {
    const res = await fetch(endpoint);
    const header = res.headers.get("PAYMENT-REQUIRED");
    setResult(
      header
        ? `HTTP ${res.status}\n${JSON.stringify(JSON.parse(atob(header)).accepts, null, 2)}`
        : `HTTP ${res.status}\n${await res.text()}`,
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <button className="btn btn-sm btn-outline self-start" onClick={probe}>
        Call without paying
      </button>
      {result && <pre className="bg-base-200 m-0 overflow-x-auto rounded-lg p-3 text-xs">{result}</pre>}
    </div>
  );
};
