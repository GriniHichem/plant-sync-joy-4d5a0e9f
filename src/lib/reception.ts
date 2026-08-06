// Helpers du module Réception Fruits & Légumes frais

export function computeDurationMinutes(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((v) => Number.isNaN(v))) return null;
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // gère le passage minuit
  return mins;
}

/**
 * Normalise une durée : une valeur négative signifie un passage à minuit
 * (heure_fin < heure_début) → on rattrape en ajoutant 24 h.
 */
export function normalizeDurationMinutes(min?: number | null): number | null {
  if (min == null || Number.isNaN(Number(min))) return null;
  let m = Number(min);
  while (m < 0) m += 24 * 60;
  return Math.round(m);
}

export function formatDuration(min?: number | null): string {
  const n = normalizeDurationMinutes(min);
  if (n == null) return "—";
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")} min`;
}

/** > 20 minutes = hors délai. 20 min inclus reste conforme. */
export function isOverdue(min?: number | null): boolean {
  const n = normalizeDurationMinutes(min);
  return n != null && n > 20;
}


/** Consigne affichée à l'agent avant la prise de vue (pas un texte imprimé sur l'image). */
export function photoSlotGuidance(slot: number | null | undefined): { title: string; hint: string } {
  switch (Number(slot)) {
    case 1:
      return { title: "Photo 1 — Arrivée du camion", hint: "Prenez la photo à l'ouverture, chargement intact (≈ 100 % restant)." };
    case 2:
      return { title: "Photo 2 — En cours de déchargement", hint: "Prenez la photo lorsqu'il reste environ 60 % du chargement dans le camion." };
    case 3:
      return { title: "Photo 3 — Fin de déchargement", hint: "Prenez la photo lorsqu'il reste environ 30 % du chargement dans le camion." };
    default:
      return { title: "", hint: "" };
  }
}


export function computeAbattementKg(brut: number, tauxPct: number): number {
  if (!brut || !tauxPct) return 0;
  return (brut * tauxPct) / 100;
}

export function computeNetKg(brut: number, tauxPct: number): number {
  return brut - computeAbattementKg(brut, tauxPct);
}

export function kgToTonnes(kg?: number | null, digits = 3): string {
  if (kg == null) return "—";
  return (kg / 1000).toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatKg(kg?: number | null): string {
  if (kg == null) return "—";
  return kg.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " kg";
}

/** Poids en kg entier avec séparateur de milliers FR. */
export function formatKgInt(kg?: number | null): string {
  if (kg == null) return "—";
  return Math.round(Number(kg)).toLocaleString("fr-FR") + " kg";
}

/** Poids en tonnes entières. */
export function formatTonnesInt(kg?: number | null): string {
  if (kg == null) return "—";
  return Math.round(Number(kg) / 1000).toLocaleString("fr-FR") + " t";
}

/** Tronque une heure "HH:mm[:ss[.ms]]" en "HH:mm". */
export function formatHm(t?: string | null): string {
  if (!t) return "—";
  return String(t).slice(0, 5);
}

/**
 * Compression canvas d'une image (retourne Blob JPEG).
 * Vise la meilleure qualité possible sans dépasser `targetMaxBytes` (défaut 5 Mo).
 * Réduit progressivement la qualité puis la taille si nécessaire.
 */
export async function compressImage(
  file: File,
  maxSize = 2560,
  quality = 0.92,
  targetMaxBytes = 5 * 1024 * 1024,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const render = (size: number, q: number) =>
    new Promise<Blob>((resolve, reject) => {
      const ratio = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * ratio);
      canvas.height = Math.round(bitmap.height * ratio);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Compression échouée"))),
        "image/jpeg",
        q,
      );
    });

  let size = maxSize;
  let q = quality;
  let blob = await render(size, q);

  // Réduit d'abord la qualité (min 0.6), puis la taille (min 1280) si toujours trop lourd.
  while (blob.size > targetMaxBytes && q > 0.6) {
    q = Math.max(0.6, q - 0.07);
    blob = await render(size, q);
  }
  while (blob.size > targetMaxBytes && size > 1280) {
    size = Math.max(1280, size - 320);
    blob = await render(size, q);
  }
  return blob;
}
