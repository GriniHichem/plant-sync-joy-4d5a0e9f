import { describe, it, expect } from "vitest";
import { isCriticalOverdue, countCriticalOverdue, type ApplicableIndicator } from "@/lib/qualityShiftLogic";
import { buildDraftNcPayload, ncTypeFromCategory, readableMeasure } from "@/lib/qualityNc";

const NOW = new Date("2026-08-01T10:00:00.000Z").getTime();
const minsAgo = (m: number) => new Date(NOW - m * 60000).toISOString();

const ind = (over: Partial<ApplicableIndicator> = {}): ApplicableIndicator => ({
  indicator_id: "i-1",
  code: "POIDS",
  name: "Poids net",
  indicator_type: "numeric",
  category: "poids",
  unit: "g",
  target_value: 100,
  min_value: 95,
  max_value: 105,
  effective_frequency_minutes: 60,
  effective_is_required: true,
  effective_is_blocking: true,
  ...over,
});

describe("isCriticalOverdue — alerte retard > 2× la fréquence", () => {
  it("bloquant, retard 2× → critique", () => {
    expect(isCriticalOverdue(ind(), minsAgo(130), NOW)).toBe(true);
  });
  it("bloquant, retard simple → non critique", () => {
    expect(isCriticalOverdue(ind(), minsAgo(70), NOW)).toBe(false);
  });
  it("non bloquant → jamais critique", () => {
    expect(isCriticalOverdue(ind({ effective_is_blocking: false }), minsAgo(600), NOW)).toBe(false);
  });
  it("sans fréquence ou jamais saisi → non critique", () => {
    expect(isCriticalOverdue(ind({ effective_frequency_minutes: null }), minsAgo(600), NOW)).toBe(false);
    expect(isCriticalOverdue(ind(), null, NOW)).toBe(false);
  });
  it("compte uniquement les obligatoires bloquants", () => {
    const list = [
      ind({ indicator_id: "a" }),
      ind({ indicator_id: "b", effective_is_blocking: false }),
      ind({ indicator_id: "c", effective_is_required: false }),
    ];
    const last = { a: minsAgo(200), b: minsAgo(200), c: minsAgo(200) };
    expect(countCriticalOverdue(list, last, NOW)).toBe(1);
  });
});

describe("qualityNc — NC brouillon automatique", () => {
  it("mappe la catégorie de l'indicateur vers un type de NC valide", () => {
    expect(ncTypeFromCategory("poids")).toBe("poids");
    expect(ncTypeFromCategory("controle_visuel")).toBe("aspect");
    expect(ncTypeFromCategory("conditionnement")).toBe("emballage");
    expect(ncTypeFromCategory("physico_chimique")).toBe("process");
    expect(ncTypeFromCategory(undefined)).toBe("autre");
  });

  it("affiche la mesure quel que soit le type", () => {
    expect(readableMeasure({ id: "c", measured_value_numeric: 92.4 })).toBe("92.4");
    expect(readableMeasure({ id: "c", measured_value_boolean: false })).toBe("Non conforme");
    expect(readableMeasure({ id: "c", selected_value: "Sale" })).toBe("Sale");
    expect(readableMeasure({ id: "c" })).toBe("—");
  });

  it("construit une NC brouillon tracée sur le contrôle et le shift", () => {
    const p = buildDraftNcPayload({
      check: {
        id: "chk-1", of_id: "of-1", product_id: "p-1", production_line_id: "l-1",
        shift_id: "ps-1", team_id: "t-1", quality_shift_id: "qs-1", measured_value_numeric: 92.4,
      },
      indicator: ind(),
      ofNumero: "OF-2026-001",
      declaredBy: "u-1",
    });
    expect(p.status).toBe("draft");
    expect(p.severity).toBe("major");
    expect(p.nc_type).toBe("poids");
    expect(p.quality_check_id).toBe("chk-1");
    expect(p.quality_shift_id).toBe("qs-1");
    expect(p.of_id).toBe("of-1");
    expect(p.declared_by).toBe("u-1");
    expect(p.title).toMatch(/OF-2026-001/);
    expect(p.description).toMatch(/92.4/);
    expect(p.description).toMatch(/min 95/);
  });
});
