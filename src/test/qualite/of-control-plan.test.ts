import { describe, it, expect } from "vitest";
import {
  buildPlanRows,
  availableToAdd,
  type PlanIndicator,
  type OverrideRow,
  type CatalogIndicator,
} from "@/components/qualite/OfControlPlanManager";

const catalog: CatalogIndicator[] = [
  { id: "ph", code: "PH", name: "pH", category: "physico_chimique", unit: null },
  { id: "brix", code: "BRIX", name: "Brix", category: "physico_chimique", unit: "°Bx" },
  { id: "gel", code: "GEL", name: "Test de gélification", category: "process", unit: null },
];

const planItem = (id: string, scope: PlanIndicator["match_scope"]): PlanIndicator => ({
  indicator_id: id,
  code: catalog.find((c) => c.id === id)!.code,
  name: catalog.find((c) => c.id === id)!.name,
  category: "physico_chimique",
  unit: null,
  effective_is_required: true,
  effective_is_blocking: false,
  match_scope: scope,
});

const ov = (indicator_id: string, mode: "add" | "remove"): OverrideRow => ({
  id: `ov-${indicator_id}`,
  of_id: "of-1",
  indicator_id,
  mode,
  notes: null,
});

describe("plan de contrôle OF — héritage produit", () => {
  it("marque les contrôles issus du produit comme hérités", () => {
    const rows = buildPlanRows([planItem("ph", "product"), planItem("brix", "product")], [], catalog);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.origin === "inherited" && r.scope === "product")).toBe(true);
  });

  it("marque un ajout local comme local", () => {
    const rows = buildPlanRows([planItem("gel", "of")], [ov("gel", "add")], catalog);
    expect(rows[0].origin).toBe("local");
    expect(rows[0].removed).toBe(false);
  });

  it("affiche un contrôle hérité retiré comme supprimé localement et restaurable", () => {
    const rows = buildPlanRows([planItem("ph", "product")], [ov("brix", "remove")], catalog);
    const brix = rows.find((r) => r.indicator_id === "brix")!;
    expect(brix.removed).toBe(true);
    expect(brix.overrideId).toBe("ov-brix");
    // le contrôle hérité restant n'est pas impacté
    expect(rows.find((r) => r.indicator_id === "ph")!.removed).toBe(false);
  });

  it("place les contrôles retirés en fin de liste", () => {
    const rows = buildPlanRows([planItem("ph", "product")], [ov("brix", "remove")], catalog);
    expect(rows.map((r) => r.removed)).toEqual([false, true]);
  });
});

describe("availableToAdd", () => {
  it("exclut les contrôles déjà actifs sur l'OF", () => {
    const rows = buildPlanRows([planItem("ph", "product")], [], catalog);
    expect(availableToAdd(catalog, rows).map((c) => c.id)).toEqual(["brix", "gel"]);
  });

  it("réautorise l'ajout d'un contrôle retiré", () => {
    const rows = buildPlanRows([], [ov("ph", "remove")], catalog);
    expect(availableToAdd(catalog, rows).map((c) => c.id)).toContain("ph");
  });
});
