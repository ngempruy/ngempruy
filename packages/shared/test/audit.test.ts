import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeAuditMessage, encodeAuditEntry } from "../src/audit";

const now = new Date("2026-10-03T00:00:00Z");

test("encodes with version and timestamp, and round-trips through base64", () => {
  const json = encodeAuditEntry({ module: "rwa", action: "nav.posted", ref: "0.0.123", data: { nav: 101 } }, now);
  const decoded = decodeAuditMessage(Buffer.from(json).toString("base64"));
  assert.deepEqual(decoded, {
    v: 1,
    ts: "2026-10-03T00:00:00.000Z",
    module: "rwa",
    action: "nav.posted",
    ref: "0.0.123",
    data: { nav: 101 },
  });
});

test("rejects entries over the single-chunk limit", () => {
  assert.throws(
    () => encodeAuditEntry({ module: "rwa", action: "x", data: { blob: "a".repeat(1100) } }),
    /limit is 1024/,
  );
});

test("rejects entries without module or action", () => {
  assert.throws(() => encodeAuditEntry({ module: "", action: "x" }), /module and an action/);
});

test("ignores foreign or malformed topic messages", () => {
  assert.equal(decodeAuditMessage(Buffer.from("hello").toString("base64")), null);
  assert.equal(decodeAuditMessage(Buffer.from('{"module":"x"}').toString("base64")), null);
});
