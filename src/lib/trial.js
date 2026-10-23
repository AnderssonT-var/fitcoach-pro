/* Estado del plan de prueba de un asesorado (ver server/trial.js). */
export const TRIAL_OPTIONS = [7, 14, 21, 30];
export const trialName = (days) => (days === 30 ? "Mes de prueba" : `Prueba de ${days} días`);

export function trialInfo(c) {
  const t = c?.trial;
  if (!t || !["active", "ended"].includes(t.status)) return null;
  const end = Date.parse(t.end), start = Date.parse(t.start);
  const left = Math.max(0, Math.ceil((end - Date.now()) / 864e5));
  const running = t.status === "active" && end > Date.now();
  return {
    ...t, running, ended: !running, daysLeft: left,
    pct: Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100)),
    label: running ? (left <= 1 ? "Prueba · termina hoy" : `Prueba · quedan ${left} días`) : "Prueba terminada",
  };
}
