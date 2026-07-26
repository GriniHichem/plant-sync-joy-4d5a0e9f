export interface TicketSequenceWarning {
  previousTicketNumber: string;
  gap: number;
}

function parseTicketNumber(value: string | null | undefined): number | null {
  const normalized = value?.trim() ?? "";
  if (!/^\d+$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function getTicketSequenceWarning(
  previousTicketNumber: string | null | undefined,
  nextTicketNumber: string | null | undefined,
): TicketSequenceWarning | null {
  const previous = parseTicketNumber(previousTicketNumber);
  const next = parseTicketNumber(nextTicketNumber);
  if (previous === null || next === null) return null;

  const gap = next - previous;
  if (gap < 3) return null;

  return {
    previousTicketNumber: previousTicketNumber!.trim(),
    gap,
  };
}
