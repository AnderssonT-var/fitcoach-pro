/* Página del personaje para la app Android (se abre dentro de la app).
   La app le pasa los datos con setAvatar({...}) y recibe avisos por el canal «VytraAvatar». */
import { mountAvatarCard } from "./card.js";
import { computeProgress, normalizeStyle } from "./progress.js";
import { EXERCISE_LIBRARY } from "../store/exercises.js";

const q = new URLSearchParams(location.hash.slice(1));
const dark = q.get("dark") === "1";
const bg = q.get("bg") || (dark ? "#070a12" : "#f3f4f8");
document.documentElement.style.background = bg;
document.body.style.background = bg;
const root = document.getElementById("root");
root.style.setProperty("--av-bg", bg);
if (q.get("ink")) root.style.setProperty("--av-ink", q.get("ink"));
const card = mountAvatarCard(root, { dark, accent: q.get("accent") || "#5856d6" });
const send = (m) => { try { window.VytraAvatar?.postMessage(m); } catch { /* fuera de la app */ } };

const muscles = new Map(EXERCISE_LIBRARY.map((e) => [e.id, e.muscle]));
window.setAvatar = (p) => {
  for (const [id, m] of Object.entries(p.custom || {})) muscles.set(+id, m);
  const progress = computeProgress({ bests: p.bests || {}, workouts: p.workouts || [], muscleOf: (id) => muscles.get(id) || "" });
  card.update(normalizeStyle(p.style, p.body), progress);
  requestAnimationFrame(() => send(`h:${Math.ceil(document.documentElement.scrollHeight)}`));
};
window.flexAvatar = () => card.flex();
new ResizeObserver(() => send(`h:${Math.ceil(document.documentElement.scrollHeight)}`)).observe(document.body);
send("ready");
