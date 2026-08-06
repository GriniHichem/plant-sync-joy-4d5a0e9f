import { describe, it, expect } from "vitest";
import { evaluateConditions } from "@/lib/notifications";

describe("evaluateConditions (notification rule engine)", () => {
  it("returns true when conditions are null/undefined", () => {
    expect(evaluateConditions({}, null)).toBe(true);
    expect(evaluateConditions({}, undefined)).toBe(true);
  });

  it("evaluates eq / neq", () => {
    expect(evaluateConditions({ a: 1 }, { all: [{ field: "a", op: "eq", value: 1 }] })).toBe(true);
    expect(evaluateConditions({ a: 1 }, { all: [{ field: "a", op: "neq", value: 2 }] })).toBe(true);
    expect(evaluateConditions({ a: 1 }, { all: [{ field: "a", op: "eq", value: 2 }] })).toBe(false);
  });

  it("evaluates gt / gte / lt / lte", () => {
    const d = { n: 10 };
    expect(evaluateConditions(d, { all: [{ field: "n", op: "gt", value: 5 }] })).toBe(true);
    expect(evaluateConditions(d, { all: [{ field: "n", op: "gte", value: 10 }] })).toBe(true);
    expect(evaluateConditions(d, { all: [{ field: "n", op: "lt", value: 5 }] })).toBe(false);
    expect(evaluateConditions(d, { all: [{ field: "n", op: "lte", value: 10 }] })).toBe(true);
  });

  it("coerces numeric strings but rejects non-numeric text", () => {
    expect(evaluateConditions({ n: "10" }, { all: [{ field: "n", op: "gt", value: 5 }] })).toBe(true);
    expect(evaluateConditions({ n: "abc" }, { all: [{ field: "n", op: "gt", value: 5 }] })).toBe(false);
  });


  it("evaluates in / nin", () => {
    expect(evaluateConditions({ p: "high" }, { all: [{ field: "p", op: "in", value: ["high", "critical"] }] })).toBe(true);
    expect(evaluateConditions({ p: "low" }, { all: [{ field: "p", op: "nin", value: ["high"] }] })).toBe(true);
  });

  it("evaluates contains case-insensitively", () => {
    expect(evaluateConditions({ s: "Hello World" }, { all: [{ field: "s", op: "contains", value: "world" }] })).toBe(true);
    expect(evaluateConditions({ s: "abc" }, { all: [{ field: "s", op: "contains", value: "z" }] })).toBe(false);
  });

  it("evaluates any group (OR)", () => {
    const c = { any: [{ field: "a", op: "eq" as const, value: 1 }, { field: "b", op: "eq" as const, value: 2 }] };
    expect(evaluateConditions({ a: 1, b: 99 }, c)).toBe(true);
    expect(evaluateConditions({ a: 0, b: 2 }, c)).toBe(true);
    expect(evaluateConditions({ a: 0, b: 0 }, c)).toBe(false);
  });

  it("evaluates nested all > any > leaf", () => {
    const c = {
      all: [
        { field: "active", op: "eq" as const, value: true },
        { any: [{ field: "p", op: "eq" as const, value: "high" }, { field: "p", op: "eq" as const, value: "critical" }] },
      ],
    };
    expect(evaluateConditions({ active: true, p: "high" }, c)).toBe(true);
    expect(evaluateConditions({ active: true, p: "low" }, c)).toBe(false);
    expect(evaluateConditions({ active: false, p: "critical" }, c)).toBe(false);
  });

  it("supports nested field paths", () => {
    const data = { metadata: { criticality: "A" } };
    expect(evaluateConditions(data, { all: [{ field: "metadata.criticality", op: "eq", value: "A" }] })).toBe(true);
  });

  it("missing field yields false on equality", () => {
    expect(evaluateConditions({}, { all: [{ field: "x", op: "eq", value: 1 }] })).toBe(false);
  });
});
