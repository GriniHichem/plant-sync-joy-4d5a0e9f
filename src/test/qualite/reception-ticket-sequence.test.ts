import { describe, expect, it } from "vitest";
import { getTicketSequenceWarning } from "@/pages/qualite/reception/ticketSequence";

describe("Alerte de continuité des tickets de réception", () => {
  it("ne signale pas le premier ticket d'une campagne", () => {
    expect(getTicketSequenceWarning(null, "001412")).toBeNull();
  });

  it("ne signale pas les écarts normaux de +1 et +2", () => {
    expect(getTicketSequenceWarning("001412", "001413")).toBeNull();
    expect(getTicketSequenceWarning("001412", "001414")).toBeNull();
  });

  it("signale un écart supérieur ou égal à +3", () => {
    expect(getTicketSequenceWarning("001412", "001415")).toEqual({
      previousTicketNumber: "001412",
      gap: 3,
    });
    expect(getTicketSequenceWarning("001412", "001417")).toEqual({
      previousTicketNumber: "001412",
      gap: 5,
    });
  });

  it("ne signale pas un numéro identique ou inférieur", () => {
    expect(getTicketSequenceWarning("001412", "001412")).toBeNull();
    expect(getTicketSequenceWarning("001412", "001410")).toBeNull();
  });

  it("ignore les numéros non numériques", () => {
    expect(getTicketSequenceWarning("001412", "ABC-1417")).toBeNull();
  });
});
