import { describe, it, expect } from "vitest";
import {
  dueInfo,
  countDue,
  validateControlDraft,
  emptyControlDraft,
  resolveShiftContext,
  buildCheckPayload,
  filterIndicators,
  sortWithPins,
  lastCheckByIndicator,
  blockingNonConformities,
  type ControlIndicator,
} from "@/lib/qualityShiftControl";
import { computeConformity } from "@/pages/qualite/QualiteControles";
import { parseDecimal } from "@/pages/qualite/QualiteIndicateurs";

const NOW = new Date("2026-08-01T10:00:00.000Z").getTime();
const minsAgo = (m: number) => new Date(NOW - m * 60000).toISOString();

const ind = (o: Partial<ControlIndicator> & { indicator_id: string }): ControlIndicator => ({
  code: o.indicator_id.toUpperCase(),
  name: o.indicator_id,
  indicator_type: "numeric",
  category: "physico_chimique",
  unit: null,
  target_value: null,
  min_value: null,
  max_value: null,
  tolerance_minus: null,
  tolerance_plus: null,
  select_options: null,
  effective_frequency_minutes: null,
  effective_is_required: true,
  effective_is_blocking: false,
  ...o,
});

describe("fréquence des contrôles (dueInfo)", () => {
  it("sans fréquence : à saisir tant qu'aucun contrôle, puis à la demande", () => {
    expect(dueInfo(null, null, NOW)).toMatchObject({ level: "todo", minsLeft: null });
    expect(dueInfo(minsAgo(500), null, NOW)).toMatchObject({ level: "ok", label: "À la demande" });
  });

  it("avec fréquence et aucun contrôle : à saisir maintenant", () => {
    expect(dueInfo(null, 60, NOW)).toMatchObject({ level: "todo", minsLeft: 0 });
  });

  it("dans la période : ok avec minutes restantes", () => {
    const d = dueInfo(minsAgo(20), 60, NOW);
    expect(d.level).toBe("ok");
    expect(d.minsLeft).toBe(40);
    expect(d.label).toBe("Prochain dans 40 min");
  });

  it("période dépassée : en retard", () => {
    const d = dueInfo(minsAgo(75), 60, NOW);
    expect(d.level).toBe("overdue");
    expect(d.minsLeft).toBe(-15);
    expect(d.label).toBe("En retard de 15 min");
  });

  it("pile à l'échéance : compté comme en retard (pas d'angle mort)", () => {
    expect(dueInfo(minsAgo(60), 60, NOW).level).toBe("overdue");
  });

  it("countDue additionne todo + overdue uniquement", () => {
    const list = [
      ind({ indicator_id: "a", effective_frequency_minutes: 60 }), // jamais saisi -> todo
      ind({ indicator_id: "b", effective_frequency_minutes: 60 }), // en retard
      ind({ indicator_id: "c", effective_frequency_minutes: 60 }), // ok
    ];
    const last = { b: minsAgo(90), c: minsAgo(5) };
    expect(countDue(list, last, NOW)).toBe(2);
  });
});

describe("validation de saisie par type d'indicateur", () => {
  const d = emptyControlDraft;
  it("numérique refuse le vide et le texte, accepte la virgule décimale", () => {
    expect(validateControlDraft({ indicator_type: "numeric" }, d(), parseDecimal).ok).toBe(false);
    expect(validateControlDraft({ indicator_type: "numeric" }, { ...d(), value_text: "abc" }, parseDecimal).ok).toBe(false);
    expect(validateControlDraft({ indicator_type: "numeric" }, { ...d(), value_text: "3,5" }, parseDecimal).ok).toBe(true);
  });
  it("numérique accepte 0", () => {
    expect(validateControlDraft({ indicator_type: "numeric" }, { ...d(), value_text: "0" }, parseDecimal).ok).toBe(true);
  });
  it("booléen exige un choix explicite", () => {
    expect(validateControlDraft({ indicator_type: "boolean" }, d(), parseDecimal).ok).toBe(false);
    expect(validateControlDraft({ indicator_type: "boolean" }, { ...d(), value_boolean: "false" }, parseDecimal).ok).toBe(true);
  });
  it("select exige une option", () => {
    expect(validateControlDraft({ indicator_type: "select" }, d(), parseDecimal).ok).toBe(false);
    expect(validateControlDraft({ indicator_type: "select" }, { ...d(), selected_value: "OK" }, parseDecimal).ok).toBe(true);
  });
  it("texte refuse les espaces seuls", () => {
    expect(validateControlDraft({ indicator_type: "text" }, { ...d(), value_text: "   " }, parseDecimal).ok).toBe(false);
    expect(validateControlDraft({ indicator_type: "text" }, { ...d(), value_text: "aspect ok" }, parseDecimal).ok).toBe(true);
  });
});

describe("intégration shift qualité → contrôle", () => {
  const qs = { id: "qs-1", shift_team_id: "team-1", production_shift_ids: ["ps-1", "ps-2"] };

  it("hors shift : aucun contexte rattaché", () => {
    expect(resolveShiftContext(null)).toEqual({
      qualityShiftId: null, teamId: null, productionShiftId: null,
    });
  });

  it("en shift : shift qualité + équipe + 1er shift production lié", () => {
    expect(resolveShiftContext(qs)).toEqual({
      qualityShiftId: "qs-1", teamId: "team-1", productionShiftId: "ps-1",
    });
  });

  it("le shift production de la ligne de l'OF est prioritaire sur le lien par défaut", () => {
    expect(resolveShiftContext(qs, "ps-line").productionShiftId).toBe("ps-line");
  });

  it("équipe absente → team_id null (pas d'erreur)", () => {
    expect(resolveShiftContext({ id: "qs-2", shift_team_id: null }).teamId).toBeNull();
  });

  it("payload numérique complet avec contexte shift et bornes de l'indicateur", () => {
    const i = ind({
      indicator_id: "ph", indicator_type: "numeric", unit: "pH",
      target_value: 4, min_value: 3.8, max_value: 4.2,
    });
    const p = buildCheckPayload({
      ofId: "of-1", productId: "p-1", lineId: "l-1",
      indicator: i,
      draft: { ...emptyControlDraft(), value_text: "4,1", comment: "  ok  " },
      userId: "u-1",
      controlTime: "2026-08-01T10:00:00.000Z",
      shift: resolveShiftContext(qs, "ps-line"),
      parseNumber: parseDecimal,
    });
    expect(p).toMatchObject({
      of_id: "of-1", product_id: "p-1", production_line_id: "l-1",
      indicator_id: "ph", measured_value_numeric: 4.1,
      unit: "pH", target_value: 4, min_value: 3.8, max_value: 4.2,
      comment: "ok", controlled_by: "u-1",
      quality_shift_id: "qs-1", team_id: "team-1", shift_id: "ps-line",
      status: "submitted", validation_status: "not_required",
    });
    expect(p.measured_value_text).toBeNull();
    expect(p.measured_value_boolean).toBeNull();
    expect(p.selected_value).toBeNull();
  });

  it("payload booléen : seul measured_value_boolean est rempli", () => {
    const p = buildCheckPayload({
      ofId: "of-1", indicator: ind({ indicator_id: "gel", indicator_type: "boolean" }),
      draft: { ...emptyControlDraft(), value_boolean: "false" },
      controlTime: "t", shift: resolveShiftContext(qs), parseNumber: parseDecimal,
    });
    expect(p.measured_value_boolean).toBe(false);
    expect(p.measured_value_numeric).toBeNull();
  });

  it("payload select : selected_value seul", () => {
    const p = buildCheckPayload({
      ofId: "of-1", indicator: ind({ indicator_id: "asp", indicator_type: "select" }),
      draft: { ...emptyControlDraft(), selected_value: "Bon" },
      controlTime: "t", shift: resolveShiftContext(null), parseNumber: parseDecimal,
    });
    expect(p.selected_value).toBe("Bon");
    expect(p.quality_shift_id).toBeNull();
    expect(p.team_id).toBeNull();
  });

  it("payload texte : trim appliqué", () => {
    const p = buildCheckPayload({
      ofId: "of-1", indicator: ind({ indicator_id: "obs", indicator_type: "text" }),
      draft: { ...emptyControlDraft(), value_text: "  aspect ok  " },
      controlTime: "t", shift: resolveShiftContext(qs), parseNumber: parseDecimal,
    });
    expect(p.measured_value_text).toBe("aspect ok");
  });

  it("ne contient jamais de champ de production (isolation OF/production)", () => {
    const p = buildCheckPayload({
      ofId: "of-1", indicator: ind({ indicator_id: "ph" }),
      draft: { ...emptyControlDraft(), value_text: "4" },
      controlTime: "t", shift: resolveShiftContext(qs), parseNumber: parseDecimal,
    });
    expect(Object.keys(p)).not.toContain("statut");
    expect(Object.keys(p)).not.toContain("quantite_produite");
  });
});

describe("conformité cohérente avec la saisie shift", () => {
  const i = ind({ indicator_id: "ph", target_value: 4, min_value: 3.8, max_value: 4.2, tolerance_plus: 0.1, tolerance_minus: 0.1 });
  const verdict = (v: string) =>
    computeConformity({
      indicator_type: "numeric",
      measured_value_numeric: parseDecimal(v),
      target_value: i.target_value, min_value: i.min_value, max_value: i.max_value,
      tolerance_minus: i.tolerance_minus, tolerance_plus: i.tolerance_plus,
    });

  it("dans les bornes → conforme", () => expect(verdict("4,0").is_conform).toBe(true));
  it("hors bornes basses → non conforme", () => expect(verdict("3,5").is_conform).toBe(false));
  it("hors bornes hautes → non conforme", () => expect(verdict("4,5").is_conform).toBe(false));
  it("dans les bornes mais hors tolérance → conforme + alerte tolérance", () => {
    const r = verdict("4,15");
    expect(r.is_conform).toBe(true);
    expect(r.out_of_tolerance).toBe(true);
  });
});

describe("filtres, tri et épinglage du shift", () => {
  const list = [
    ind({ indicator_id: "a", code: "PH", name: "pH", category: "physico_chimique", effective_frequency_minutes: 60 }),
    ind({ indicator_id: "b", code: "BRIX", name: "Brix", category: "physico_chimique", effective_frequency_minutes: 60 }),
    ind({ indicator_id: "c", code: "GEL", name: "Gélification", category: "process", effective_frequency_minutes: 60 }),
  ];
  const last = { a: minsAgo(5), b: minsAgo(120) };

  it("filtre par catégorie", () => {
    expect(filterIndicators(list, { search: "", category: "process", status: "all" }, last, NOW).map((i) => i.indicator_id))
      .toEqual(["c"]);
  });
  it("recherche insensible à la casse sur code et nom", () => {
    expect(filterIndicators(list, { search: "brix", category: "all", status: "all" }, last, NOW)).toHaveLength(1);
    expect(filterIndicators(list, { search: "GÉL", category: "all", status: "all" }, last, NOW)).toHaveLength(1);
    expect(filterIndicators(list, { search: "Gél", category: "all", status: "all" }, last, NOW)).toHaveLength(1);
  });
  it("statut à saisir = todo + overdue", () => {
    expect(filterIndicators(list, { search: "", category: "all", status: "todo" }, last, NOW).map((i) => i.indicator_id))
      .toEqual(["b", "c"]);
  });
  it("statut en retard exclut les jamais saisis", () => {
    expect(filterIndicators(list, { search: "", category: "all", status: "overdue" }, last, NOW).map((i) => i.indicator_id))
      .toEqual(["b"]);
  });
  it("statut ok ne garde que les contrôles à jour", () => {
    expect(filterIndicators(list, { search: "", category: "all", status: "ok" }, last, NOW).map((i) => i.indicator_id))
      .toEqual(["a"]);
  });
  it("les contrôles épinglés du shift remontent en tête", () => {
    const pinned = new Set(["c"]);
    expect(sortWithPins(list, (id) => pinned.has(id)).map((i) => i.indicator_id)).toEqual(["c", "a", "b"]);
  });
  it("sans épinglage l'ordre est inchangé", () => {
    expect(sortWithPins(list, () => false).map((i) => i.indicator_id)).toEqual(["a", "b", "c"]);
  });
});

describe("dernier contrôle par indicateur", () => {
  it("retient le plus récent quel que soit l'ordre reçu", () => {
    const last = lastCheckByIndicator([
      { indicator_id: "a", control_time: minsAgo(10) },
      { indicator_id: "a", control_time: minsAgo(90) },
      { indicator_id: "b", control_time: minsAgo(30) },
    ]);
    expect(last.a).toBe(minsAgo(10));
    expect(last.b).toBe(minsAgo(30));
  });
  it("liste vide → objet vide", () => {
    expect(lastCheckByIndicator([])).toEqual({});
  });
});

describe("contrôles bloquants", () => {
  const list = [
    ind({ indicator_id: "a", effective_is_blocking: true }),
    ind({ indicator_id: "b", effective_is_blocking: false }),
  ];
  it("signale un NC sur indicateur bloquant", () => {
    expect(blockingNonConformities(list, [{ indicator_id: "a", is_conform: false }])).toEqual(["a"]);
  });
  it("ignore un NC sur indicateur non bloquant", () => {
    expect(blockingNonConformities(list, [{ indicator_id: "b", is_conform: false }])).toEqual([]);
  });
  it("ignore les conformes et les verdicts inconnus", () => {
    expect(blockingNonConformities(list, [
      { indicator_id: "a", is_conform: true },
      { indicator_id: "a", is_conform: null },
    ])).toEqual([]);
  });
  it("dédoublonne les répétitions", () => {
    expect(blockingNonConformities(list, [
      { indicator_id: "a", is_conform: false },
      { indicator_id: "a", is_conform: false },
    ])).toEqual(["a"]);
  });
});
