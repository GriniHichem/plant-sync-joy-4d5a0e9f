import { describe, it, expect } from "vitest";
import {
  buildIndicatorPayload,
  validateIndicator,
  CATEGORIES,
  INDICATOR_TYPES,
  FREQUENCIES,
} from "@/pages/qualite/QualiteIndicateurs";

const base = () => ({
  code: "IND_TEST",
  name: "Test",
  description: "",
  indicator_type: "numeric" as const,
  category: "poids",
  frequency_type: "shift",
  unit: "",
  target_value: "",
  min_value: "",
  max_value: "",
  tolerance_minus: "",
  tolerance_plus: "",
  select_options: "",
  is_required: false,
  is_blocking: false,
  is_active: true,
});

describe("validateIndicator", () => {
  it("requires code and name", () => {
    expect(validateIndicator({ ...base(), code: "" })).toMatch(/Code/);
    expect(validateIndicator({ ...base(), name: "" })).toMatch(/Nom/);
  });

  it("rejects invalid code format", () => {
    expect(validateIndicator({ ...base(), code: "bad code" })).toMatch(/Code invalide/);
  });

  it("enforces min <= max for numeric", () => {
    const f = { ...base(), min_value: "10", max_value: "5" };
    expect(validateIndicator(f)).toMatch(/min/);
  });

  it("rejects negative tolerances", () => {
    expect(validateIndicator({ ...base(), tolerance_minus: "-1" })).toMatch(/Tolérance/);
    expect(validateIndicator({ ...base(), tolerance_plus: "-2" })).toMatch(/Tolérance/);
  });

  it("accepts a valid numeric indicator", () => {
    expect(validateIndicator({
      ...base(), unit: "g", target_value: "100", min_value: "95", max_value: "105",
      tolerance_minus: "2", tolerance_plus: "3",
    })).toBeNull();
  });
});

describe("buildIndicatorPayload", () => {
  it("creates a numeric indicator with unit g", () => {
    const p = buildIndicatorPayload({
      ...base(),
      code: "POIDS_NET",
      name: "Poids net",
      unit: "g",
      target_value: "250",
      min_value: "245",
      max_value: "255",
      tolerance_minus: "1",
      tolerance_plus: "1,5", // comma decimal
      category: "poids",
      frequency_type: "per_lot",
    });
    expect(p.indicator_type).toBe("numeric");
    expect(p.unit).toBe("g");
    expect(p.target_value).toBe(250);
    expect(p.min_value).toBe(245);
    expect(p.max_value).toBe(255);
    expect(p.tolerance_plus).toBe(1.5);
    expect(p.select_options).toBeNull();
  });

  it("creates a boolean indicator and nulls numeric fields", () => {
    const p = buildIndicatorPayload({
      ...base(),
      code: "VISUEL_OK",
      name: "Contrôle visuel OK",
      indicator_type: "boolean",
      unit: "should be ignored",
      target_value: "1",
      min_value: "0",
      max_value: "1",
      tolerance_minus: "5",
      tolerance_plus: "5",
    });
    expect(p.indicator_type).toBe("boolean");
    expect(p.unit).toBeNull();
    expect(p.target_value).toBeNull();
    expect(p.min_value).toBeNull();
    expect(p.max_value).toBeNull();
    expect(p.tolerance_minus).toBeNull();
    expect(p.tolerance_plus).toBeNull();
    expect(p.select_options).toBeNull();
  });

  it("parses select options into array", () => {
    const p = buildIndicatorPayload({
      ...base(),
      indicator_type: "select",
      select_options: "Conforme, Non conforme , À revoir",
    });
    expect(p.select_options).toEqual(["Conforme", "Non conforme", "À revoir"]);
  });

  it("modifies an indicator (deactivate)", () => {
    const p = buildIndicatorPayload({ ...base(), is_active: false });
    expect(p.is_active).toBe(false);
  });

  it("flags required and blocking", () => {
    const p = buildIndicatorPayload({ ...base(), is_required: true, is_blocking: true });
    expect(p.is_required).toBe(true);
    expect(p.is_blocking).toBe(true);
  });
});

describe("reference lists", () => {
  it("exposes the base categories", () => {
    expect(CATEGORIES.map((c) => c.value)).toEqual(
      expect.arrayContaining([
        "produit_fini","emballage","process","hygiene","poids","controle_visuel","autre",
      ]),
    );
  });
  it("exposes the 4 indicator types", () => {
    expect(INDICATOR_TYPES.map((t) => t.value)).toEqual(["numeric","boolean","text","select"]);
  });
  it("exposes the 6 frequencies", () => {
    expect(FREQUENCIES.map((f) => f.value)).toEqual(["hourly","shift","daily","per_of","per_lot","manual"]);
  });
});

describe("filter logic", () => {
  type Row = { code: string; name: string; description: string | null; category: string; indicator_type: string; is_active: boolean };
  const rows: Row[] = [
    { code: "A1", name: "Poids net", description: null, category: "poids", indicator_type: "numeric", is_active: true },
    { code: "B2", name: "Visuel OK", description: "contrôle", category: "controle_visuel", indicator_type: "boolean", is_active: false },
    { code: "C3", name: "pH", description: null, category: "process", indicator_type: "numeric", is_active: true },
  ];
  const filter = (q: string, cat: string, type: string, status: string) => rows.filter((r) => {
    if (cat !== "__all__" && r.category !== cat) return false;
    if (type !== "__all__" && r.indicator_type !== type) return false;
    if (status === "active" && !r.is_active) return false;
    if (status === "inactive" && r.is_active) return false;
    if (q) {
      const hay = `${r.code} ${r.name} ${r.description ?? ""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  it("combines category + type + status", () => {
    expect(filter("", "poids", "numeric", "active").map((r) => r.code)).toEqual(["A1"]);
  });
  it("filters inactive only", () => {
    expect(filter("", "__all__", "__all__", "inactive").map((r) => r.code)).toEqual(["B2"]);
  });
  it("text search hits description", () => {
    expect(filter("contrôle", "__all__", "__all__", "__all__").map((r) => r.code)).toEqual(["B2"]);
  });
  it("reset returns all rows", () => {
    expect(filter("", "__all__", "__all__", "__all__")).toHaveLength(3);
  });
});
