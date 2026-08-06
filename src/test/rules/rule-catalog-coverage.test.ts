import { describe, it, expect } from "vitest";
import {
  MODULES, MODULE_GROUPS, NOTIF_EVENTS_BY_MODULE, NOTIF_EVENT_LABEL,
  VALIDATION_ACTIONS_BY_MODULE, getConditionFields, getNotifEvent,
  operatorsForField, suggestedRolesForModule, ROLES,
} from "@/lib/ruleCatalog";
import { evaluateConditions } from "@/lib/notifications";
import { opsForKind } from "@/lib/conditionOps";

const NEW_MODULES = [
  "qualite_controles", "qualite_indicateurs", "qualite_nc", "qualite_actions",
  "qualite_enquetes", "qualite_tracabilite", "reception", "inventaire",
  "shifts", "pdr_requests", "validations", "direction",
];

describe("ruleCatalog coverage of every app module", () => {
  it("all recently added modules are declared", () => {
    const known = new Set(MODULES.map((m) => m.value));
    for (const m of NEW_MODULES) expect(known.has(m)).toBe(true);
  });

  it("every module group is represented", () => {
    expect(MODULE_GROUPS).toEqual(expect.arrayContaining(["Maintenance", "Production", "Qualité", "Stock", "Transverse", "Système"]));
  });

  it("each new module exposes notification events", () => {
    for (const m of NEW_MODULES) {
      if (m === "direction" || m === "validations") continue;
      expect(NOTIF_EVENTS_BY_MODULE[m]?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("event codes are globally unique", () => {
    const all = Object.values(NOTIF_EVENTS_BY_MODULE).flat().map((e) => e.value);
    expect(new Set(all).size).toBe(all.length);
    expect(Object.keys(NOTIF_EVENT_LABEL).length).toBe(all.length);
  });

  it("event default severities are valid", () => {
    for (const e of Object.values(NOTIF_EVENTS_BY_MODULE).flat()) {
      if (e.defaultSeverity) {
        expect(["info", "low", "medium", "high", "critical"]).toContain(e.defaultSeverity);
      }
    }
  });

  it("sample contexts evaluate against a matching condition without throwing", () => {
    for (const [module, events] of Object.entries(NOTIF_EVENTS_BY_MODULE)) {
      const fields = getConditionFields(module);
      for (const e of events) {
        for (const [k, v] of Object.entries(e.sampleContext)) {
          // sample keys should be declared as condition fields when the module has a custom set
          if (fields.some((f) => f.key === k)) {
            expect(evaluateConditions(e.sampleContext, { all: [{ field: k, op: "eq", value: v }] } as never)).toBe(true);
          }
        }
      }
    }
  });

  it("condition fields have unique keys and valid types per module", () => {
    for (const m of MODULES) {
      const fields = getConditionFields(m.value);
      const keys = fields.map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const f of fields) {
        expect(["number", "string", "enum", "boolean", "date"]).toContain(f.type);
        if (f.type === "enum") expect((f.values ?? []).length).toBeGreaterThan(0);
      }
    }
  });

  it("operatorsForField matches the field kind", () => {
    expect(operatorsForField("qualite_nc", "nc_severity")).toEqual(opsForKind("enum"));
    expect(operatorsForField("reception", "abattement_pct")).toEqual(opsForKind("number"));
    expect(operatorsForField("qualite_controles", "is_conforme")).toEqual(opsForKind("boolean"));
  });

  it("getNotifEvent resolves known events only", () => {
    expect(getNotifEvent("reception", "reception_abattement_high")?.label).toBeTruthy();
    expect(getNotifEvent("reception", "__nope__")).toBeUndefined();
  });

  it("suggested roles are real roles", () => {
    for (const m of MODULES) {
      for (const r of suggestedRolesForModule(m.value)) {
        expect(ROLES as readonly string[]).toContain(r);
      }
    }
  });

  it("validation actions exist for quality, reception and inventory", () => {
    for (const m of ["qualite_nc", "qualite_controles", "reception", "inventaire"]) {
      expect(VALIDATION_ACTIONS_BY_MODULE[m]?.length ?? 0).toBeGreaterThan(0);
    }
  });
});
