import { useEffect, useRef } from "react";

/** Bip d'alerte (WebAudio) — aucun asset externe requis. */
function beep(times = 2) {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.value = 0.06;
      osc.connect(gain).connect(ctx.destination);
      const t0 = ctx.currentTime + i * 0.35;
      osc.start(t0);
      osc.stop(t0 + 0.18);
    }
    setTimeout(() => ctx.close().catch(() => undefined), 1500);
  } catch {
    /* audio indisponible : l'alerte visuelle suffit */
  }
}

/**
 * Alerte sonore quand le nombre de retards critiques (bloquant > 2× la fréquence)
 * augmente. Répète au maximum toutes les `repeatMs` tant que le retard persiste.
 */
export function useCriticalOverdueAlarm(count: number, enabled = true, repeatMs = 120000) {
  const prev = useRef(0);
  const lastPlayed = useRef(0);

  useEffect(() => {
    if (!enabled) { prev.current = count; return; }
    const now = Date.now();
    const increased = count > prev.current;
    const shouldRepeat = count > 0 && now - lastPlayed.current > repeatMs;
    if (count > 0 && (increased || shouldRepeat)) {
      beep(count > 2 ? 3 : 2);
      lastPlayed.current = now;
    }
    prev.current = count;
  }, [count, enabled, repeatMs]);
}
