import { describe, it, expect } from "vitest";
import fs from "fs";
import {
  dueInfo,
  requiredIndicators,
  lastCheckByIndicator,
  computeOfDueCounts,
  sortOfsByPriority,
  parseMeasure,
  validateDraft,
  buildQualityCheckPayload,
  isOfCovered,
  computeShiftKpis,
  requiresNonConformity,
  ApplicableIndicator,
} from "@/lib/qualityShiftLogic";

const ind = (over: Partial<ApplicableIndicator> = {}): ApplicableIndicator => ({
  indicator_id: over.indicator_id ?? "i-1",
  code: "POIDS",
  name: "Poids net",
  indicator_type: over.indicator_type ?? "numeric",
  unit: "g",
  target_value: 100,
  min_value: 95,
  max_value: 105,
  effective_frequency_minutes: 60,
  effective_is_required: true,
  effective_is_blocking: false,
  ...over,
});

const NOW = new Date("2026-08-01T10:00:00.000Z").getTime();
const minsAgo = (m: number) => new Date(NOW - m * 60000).toISOString();

describe("dueInfo — échéance des contrôles en shift", () => {
  it("jamais saisi + fréquence → à saisir maintenant", () => {
    const d = dueInfo(null, 60, NOW);
    expect(d.level).toBe("todo");
    expect(d.minsLeft).toBe(0);
  });
  it("jamais saisi + sans fréquence → à saisir (à la demande)", () => {
    expect(dueInfo(null, null, NOW).level).toBe("todo");
  });
  it("déjà saisi + sans fréquence → ok / à la demande", () => {
    const d = dueInfo(minsAgo(500), 0, NOW);
    expect(d.level).toBe("ok");
    expect(d.label).toBe("À la demande");
  });
  it("dans la fenêtre → ok avec minutes restantes", () => {
    const d = dueInfo(minsAgo(20), 60, NOW);
    expect(d.level).toBe("ok");
    expect(d.minsLeft).toBe(40);
  });
  it("fenêtre dépassée → overdue avec retard", () => {
    const d = dueInfo(minsAgo(75), 60, NOW);
    expect(d.level).toBe("overdue");
    expect(d.label).toMatch(/15 min/);
  });
  it("pile à l'échéance → overdue (jamais de trou de couverture)", () => {
    expect(dueInfo(minsAgo(60), 60, NOW).level).toBe("overdue");
  });
});

describe("requiredIndicators — seuls les obligatoires sont exigés", () => {
  it("filtre les non obligatoires et les null", () => {
    const list = [
      ind({ indicator_id: "a", effective_is_required: true }),
      ind({ indicator_id: "b", effective_is_required: false }),
      ind({ indicator_id: "c", effective_is_required: null }),
    ];
    expect(requiredIndicators(list).map((i) => i.indicator_id)).toEqual(["a"]);
  });
  it("tolère null/undefined", () => {
    expect(requiredIndicators(null)).toEqual([]);
    expect(requiredIndicators(undefined)).toEqual([]);
  });
});

describe("lastCheckByIndicator — dernier relevé par indicateur", () => {
  it("garde la valeur la plus récente quel que soit l'ordre reçu", () => {
    const last = lastCheckByIndicator([
      { indicator_id: "i-1", control_time: minsAgo(90) },
      { indicator_id: "i-1", control_time: minsAgo(10) },
      { indicator_id: "i-2", control_time: minsAgo(5) },
    ]);
    expect(last["i-1"]).toBe(minsAgo(10));
    expect(last["i-2"]).toBe(minsAgo(5));
  });
  it("ignore les lignes incomplètes", () => {
    expect(lastCheckByIndicator([{ indicator_id: "", control_time: "" } as any])).toEqual({});
  });
});

describe("computeOfDueCounts — pilotage du tableau de shift", () => {
  const list = [
    ind({ indicator_id: "a", effective_frequency_minutes: 60 }),
    ind({ indicator_id: "b", effective_frequency_minutes: 60 }),
    ind({ indicator_id: "c", effective_frequency_minutes: null }),
    ind({ indicator_id: "d", effective_is_required: false }),
  ];
  it("compte les jamais-saisis et les en retard", () => {
    const r = computeOfDueCounts(list, { b: minsAgo(120), c: minsAgo(300) }, NOW);
    expect(r.total).toBe(3); // "d" non obligatoire exclu
    expect(r.overdue).toBe(1); // b
    expect(r.due).toBe(2); // a (jamais) + b (retard) ; c à la demande déjà fait
  });
  it("tout à jour → 0 due", () => {
    const r = computeOfDueCounts(list, { a: minsAgo(5), b: minsAgo(5), c: minsAgo(5) }, NOW);
    expect(r).toEqual({ due: 0, overdue: 0, total: 3 });
  });
  it("aucun indicateur → compteurs à zéro", () => {
    expect(computeOfDueCounts([], {}, NOW)).toEqual({ due: 0, overdue: 0, total: 0 });
  });
});

describe("sortOfsByPriority — les OF du périmètre du shift d'abord", () => {
  it("ordonne couverture > retard > dû", () => {
    const items = [
      { id: "x", onCoveredLine: false, overdue: 9, due: 9 },
      { id: "y", onCoveredLine: true, overdue: 0, due: 1 },
      { id: "z", onCoveredLine: true, overdue: 2, due: 3 },
    ];
    expect(sortOfsByPriority(items).map((i) => i.id)).toEqual(["z", "y", "x"]);
  });
  it("ne mute pas le tableau d'origine", () => {
    const items = [
      { id: "a", onCoveredLine: false, overdue: 0, due: 0 },
      { id: "b", onCoveredLine: true, overdue: 0, due: 0 },
    ];
    sortOfsByPriority(items);
    expect(items[0].id).toBe("a");
  });
});

describe("isOfCovered", () => {
  it("vrai si la ligne de l'OF est dans le périmètre", () => {
    expect(isOfCovered("l-1", ["l-1", "l-2"])).toBe(true);
    expect(isOfCovered("l-3", ["l-1"])).toBe(false);
    expect(isOfCovered(null, ["l-1"])).toBe(false);
  });
});

describe("parseMeasure / validateDraft", () => {
  it("accepte virgule, point et espaces", () => {
    expect(parseMeasure("12,5")).toBe(12.5);
    expect(parseMeasure("12.5")).toBe(12.5);
    expect(parseMeasure(" 1 200,25 ")).toBe(1200.25);
  });
  it("rejette vide et non numérique", () => {
    expect(parseMeasure("")).toBeNull();
    expect(parseMeasure("abc")).toBeNull();
    expect(parseMeasure(null)).toBeNull();
  });
  it("numeric exige une valeur numérique", () => {
    expect(validateDraft("numeric", { value_text: "" })).toMatch(/numérique/i);
    expect(validateDraft("numeric", { value_text: "0" })).toBeNull();
  });
  it("boolean exige un choix explicite", () => {
    expect(validateDraft("boolean", { value_boolean: "" })).toMatch(/Conforme/);
    expect(validateDraft("boolean", { value_boolean: "false" })).toBeNull();
  });
  it("select exige une option", () => {
    expect(validateDraft("select", {})).toMatch(/Choix/);
    expect(validateDraft("select", { selected_value: "A" })).toBeNull();
  });
  it("text exige un texte non vide", () => {
    expect(validateDraft("text", { value_text: "   " })).toMatch(/Valeur/);
    expect(validateDraft("text", { value_text: "RAS" })).toBeNull();
  });
});

describe("buildQualityCheckPayload — traçabilité shift complète", () => {
  const shift = {
    qualityShiftId: "qs-1",
    teamId: "team-1",
    productionShiftId: "ps-1",
    controllerId: "user-1",
  };
  const of = { of_id: "of-1", product_id: "p-1", line_id: "l-1" };

  it("rattache shift qualité, équipe, shift production, OF, produit et ligne", () => {
    const p = buildQualityCheckPayload({
      of, indicator: ind(), draft: { value_text: "100" }, shift,
      controlTime: "2026-08-01T10:00:00.000Z",
    });
    expect(p.quality_shift_id).toBe("qs-1");
    expect(p.team_id).toBe("team-1");
    expect(p.shift_id).toBe("ps-1");
    expect(p.of_id).toBe("of-1");
    expect(p.product_id).toBe("p-1");
    expect(p.production_line_id).toBe("l-1");
    expect(p.controlled_by).toBe("user-1");
    expect(p.status).toBe("submitted");
    expect(p.validation_status).toBe("not_required");
  });

  it("numeric : valeur convertie, autres champs à null", () => {
    const p = buildQualityCheckPayload({ of, indicator: ind(), draft: { value_text: "99,5" }, shift });
    expect(p.measured_value_numeric).toBe(99.5);
    expect(p.measured_value_text).toBeNull();
    expect(p.measured_value_boolean).toBeNull();
    expect(p.selected_value).toBeNull();
  });

  it("boolean : true/false uniquement", () => {
    const i = ind({ indicator_type: "boolean" });
    expect(buildQualityCheckPayload({ of, indicator: i, draft: { value_boolean: "true" }, shift }).measured_value_boolean).toBe(true);
    expect(buildQualityCheckPayload({ of, indicator: i, draft: { value_boolean: "false" }, shift }).measured_value_boolean).toBe(false);
  });

  it("select et text remplissent le bon champ", () => {
    const s = buildQualityCheckPayload({ of, indicator: ind({ indicator_type: "select" }), draft: { selected_value: "OK" }, shift });
    expect(s.selected_value).toBe("OK");
    const t = buildQualityCheckPayload({ of, indicator: ind({ indicator_type: "text" }), draft: { value_text: " RAS " }, shift });
    expect(t.measured_value_text).toBe("RAS");
  });

  it("recopie la norme de l'indicateur (cible / min / max / unité)", () => {
    const p = buildQualityCheckPayload({ of, indicator: ind(), draft: { value_text: "100" }, shift });
    expect(p).toMatchObject({ target_value: 100, min_value: 95, max_value: 105, unit: "g" });
  });

  it("hors shift actif : les champs de contexte sont null mais l'insert reste valide", () => {
    const p = buildQualityCheckPayload({
      of: { of_id: "of-2" },
      indicator: ind(),
      draft: { value_text: "100" },
      shift: { qualityShiftId: null, teamId: null, productionShiftId: null, controllerId: "u" },
    });
    expect(p.quality_shift_id).toBeNull();
    expect(p.product_id).toBeNull();
    expect(p.of_id).toBe("of-2");
  });
});

describe("computeShiftKpis — bilan de shift", () => {
  it("calcule contrôles, conformité et OF couverts", () => {
    const k = computeShiftKpis(
      [
        { is_conform: true, of_id: "of-1" },
        { is_conform: false, of_id: "of-1" },
        { is_conform: true, of_id: "of-2" },
        { is_conform: null, of_id: null },
      ],
      2,
    );
    expect(k.checks).toBe(4);
    expect(k.conforms).toBe(2);
    expect(k.nonConforms).toBe(1);
    expect(k.conformityRate).toBe(66.7);
    expect(k.ofs).toBe(2);
    expect(k.ncs).toBe(2);
  });
  it("aucun contrôle → taux null (pas de division par zéro)", () => {
    expect(computeShiftKpis([], 0).conformityRate).toBeNull();
  });
});

describe("requiresNonConformity", () => {
  it("non conforme + bloquant → NC obligatoire", () => {
    expect(requiresNonConformity({ effective_is_blocking: true }, false)).toBe(true);
  });
  it("non conforme non bloquant ou conforme → pas d'obligation", () => {
    expect(requiresNonConformity({ effective_is_blocking: false }, false)).toBe(false);
    expect(requiresNonConformity({ effective_is_blocking: true }, true)).toBe(false);
    expect(requiresNonConformity({ effective_is_blocking: true }, null)).toBe(false);
  });
});

describe("non-régression — intégration dans les écrans de shift", () => {
  const read = (p: string) => fs.readFileSync(p, "utf-8");

  it("le kiosque shift utilise le builder partagé (contexte shift garanti)", () => {
    const src = read("src/pages/shift/QualityShiftCheck.tsx");
    expect(src).toMatch(/buildQualityCheckPayload/);
    expect(src).toMatch(/validateDraft/);
    expect(src).toMatch(/quality_shift_id: qualityShift\.id|qualityShiftId: qualityShift\.id/);
  });

  it("la saisie en ligne utilise dueInfo et requiredIndicators partagés", () => {
    const src = read("src/pages/qualite/QualiteSaisieLigne.tsx");
    expect(src).toMatch(/from "@\/lib\/qualityShiftLogic"/);
    expect(src).not.toMatch(/^function dueInfo/m);
  });

  it("le tableau de shift utilise la RPC batch et le tri partagé", () => {
    const src = read("src/pages/qualite/QualiteShiftScreen.tsx");
    expect(src).toMatch(/get_quality_due_for_shift/);
    expect(src).toMatch(/sortOfsByPriority/);
    expect(src).toMatch(/computeShiftKpis/);
    expect(src).toMatch(/useCriticalOverdueAlarm/);
    expect(src).toMatch(/conformityRate/);
    // plus d'appel RPC par OF
    expect(src).not.toMatch(/get_quality_indicators_for_of/);
  });

  it("les saisies créent automatiquement une NC brouillon si bloquant non conforme", () => {
    ["src/components/qualite/OfControlsPanel.tsx",
     "src/pages/shift/QualityShiftCheck.tsx"].forEach((f) => {
      expect(read(f)).toMatch(/createDraftNcForCheck/);
    });
  });


  it("les écrans de shift lisent le plan de contrôle via la RPC unique", () => {
    ["src/pages/shift/QualityShiftCheck.tsx",
     "src/pages/qualite/QualiteSaisieLigne.tsx",
     "src/pages/qualite/QualiteShiftScreen.tsx"].forEach((f) => {
      expect(read(f)).toMatch(/get_quality_indicators_for_of/);
    });
  });

  it("aucun écran qualité n'écrit dans les tables de production", () => {
    ["src/pages/shift/QualityShiftCheck.tsx",
     "src/pages/qualite/QualiteSaisieLigne.tsx",
     "src/pages/qualite/QualiteShiftScreen.tsx"].forEach((f) => {
      const src = read(f);
      expect(src).not.toMatch(/from\(["']production_declarations["']\)/);
      expect(src).not.toMatch(/from\(["']consumptions["']\)\s*\.(insert|update|delete)/);
    });
  });
});
