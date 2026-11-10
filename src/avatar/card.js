/* Tarjeta del personaje (estilo neumórfico): el personaje 3D, el nivel y una barra por músculo.
   Se usa en la web (Progreso) y en la página que abre la app Android. */
import { createCharacter } from "./character.js";
import { GROUPS } from "./progress.js";

const CSS = `
.vf-av{--nb:var(--av-bg,#e9edf3);--nl:rgba(255,255,255,.9);--nd:rgba(163,177,198,.62);--tx:var(--av-ink,#1d1d1f);--mu:var(--av-muted,#6e6e73);--ac:var(--av-accent,#5856d6);
  background:var(--nb);color:var(--tx);border-radius:28px;padding:18px;box-shadow:9px 9px 20px var(--nd),-9px -9px 20px var(--nl);font-family:inherit;position:relative;overflow:hidden}
.vf-av.dark{--nb:var(--av-bg,#1c1c22);--nl:rgba(255,255,255,.045);--nd:rgba(0,0,0,.62);--tx:var(--av-ink,#f5f5f7);--mu:var(--av-muted,#98989d)}
.vf-av-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;align-items:center}
.vf-av-stage{position:relative;height:var(--av-h,380px);border-radius:22px;box-shadow:inset 7px 7px 16px var(--nd),inset -7px -7px 16px var(--nl);overflow:hidden}
.vf-av-stage canvas{border-radius:22px}
.vf-av-badge{position:absolute;left:10px;top:10px;display:flex;align-items:center;gap:8px;padding:6px 11px 6px 6px;border-radius:999px;background:var(--nb);box-shadow:4px 4px 10px var(--nd),-4px -4px 10px var(--nl);pointer-events:none}
.vf-av-ring{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font:800 15px/1 inherit;color:var(--ac);background:conic-gradient(var(--ac) calc(var(--p,0)*1turn),transparent 0);position:relative}
.vf-av-ring::before{content:"";position:absolute;inset:4px;border-radius:50%;background:var(--nb)}.vf-av-ring b{position:relative}
.vf-av-badge small{display:block;font-size:10px;color:var(--mu);line-height:1.1}.vf-av-badge strong{font-size:12px;line-height:1.2}
.vf-av-flex{position:absolute;right:12px;bottom:12px;border:0;cursor:pointer;padding:10px 14px;border-radius:999px;background:var(--nb);color:var(--ac);font:700 13px/1 inherit;box-shadow:4px 4px 10px var(--nd),-4px -4px 10px var(--nl)}
.vf-av-flex:active{box-shadow:inset 3px 3px 8px var(--nd),inset -3px -3px 8px var(--nl)}
.vf-av-hint{position:absolute;left:0;right:0;bottom:58px;text-align:center;font-size:11px;color:var(--mu);pointer-events:none}
.vf-av-side h3{margin:0 0 2px;font-size:18px}.vf-av-side p{margin:0 0 12px;color:var(--mu);font-size:13px;line-height:1.4}
.vf-av-bars{display:grid;gap:9px}
.vf-av-row{display:grid;grid-template-columns:92px minmax(0,1fr) 40px;align-items:center;gap:10px;font-size:13px}
.vf-av-row span:first-child{color:var(--mu)}.vf-av-row em{font-style:normal;text-align:right;font-weight:700;font-size:12px}
.vf-av-track{height:10px;border-radius:99px;box-shadow:inset 3px 3px 6px var(--nd),inset -3px -3px 6px var(--nl);overflow:hidden}
.vf-av-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,color-mix(in srgb,var(--ac) 65%,#fff),var(--ac));width:0;transition:width .9s cubic-bezier(.2,.8,.2,1)}
.vf-av-xp{margin-top:12px;font-size:12px;color:var(--mu)}
@media (max-width:640px){.vf-av-grid{grid-template-columns:1fr}.vf-av-row{grid-template-columns:84px minmax(0,1fr) 36px}}
`;

let cssDone = false;
function injectCss() {
  if (cssDone || document.getElementById("vf-av-css")) return;
  const st = document.createElement("style");
  st.id = "vf-av-css";
  st.textContent = CSS;
  document.head.appendChild(st);
  cssDone = true;
}

const pct = (v) => `${Math.round(v * 100)}%`;

/**
 * @param root   elemento donde se dibuja
 * @param opts   { dark, accent, compact }
 * @returns { update(style, progress, { levelUp }), flex(), dispose() }
 */
export function mountAvatarCard(root, { dark = false, accent = "#5856d6", compact = false } = {}) {
  injectCss();
  root.innerHTML = `
    <div class="vf-av ${dark ? "dark" : ""}" style="--av-accent:${accent}">
      <div class="vf-av-grid" ${compact ? 'style="grid-template-columns:1fr"' : ""}>
        <div class="vf-av-stage">
          <div class="vf-av-badge"><div class="vf-av-ring"><b>1</b></div><div><strong class="vf-av-title">Principiante</strong></div></div>
          <button type="button" class="vf-av-flex">💪 Flexionar</button>
          <div class="vf-av-hint">Desliza para girar</div>
        </div>
        <div class="vf-av-side" ${compact ? 'style="display:none"' : ""}>
          <h3 class="vf-av-name">Tu personaje</h3>
          <p>Crece con tu progreso: cada vez que subes peso en un ejercicio, el músculo que trabaja se desarrolla.</p>
          <div class="vf-av-bars">${GROUPS.map(([g, label]) => `<div class="vf-av-row" data-g="${g}"><span>${label}</span><div class="vf-av-track"><div class="vf-av-fill"></div></div><em>0%</em></div>`).join("")}</div>
          <div class="vf-av-xp"></div>
        </div>
      </div>
    </div>`;
  const stage = root.querySelector(".vf-av-stage");
  const ch = createCharacter(stage, { accent });
  root.querySelector(".vf-av-flex").addEventListener("click", () => ch.flex());
  setTimeout(() => { const h = root.querySelector(".vf-av-hint"); if (h) h.style.display = "none"; }, 4000);
  let lastLevel = null;
  return {
    update(style, progress) {
      const muscles = Object.fromEntries(GROUPS.map(([g]) => [g, progress.groups[g]?.level || 0]));
      ch.set(style, muscles);
      root.querySelector(".vf-av-ring").style.setProperty("--p", String(progress.next));
      root.querySelector(".vf-av-ring b").textContent = progress.level;
      root.querySelector(".vf-av-title").textContent = progress.title;
      root.querySelector(".vf-av-name").textContent = style.name || "Tu personaje";
      for (const [g] of GROUPS) {
        const row = root.querySelector(`.vf-av-row[data-g="${g}"]`);
        const v = progress.groups[g]?.level || 0;
        row.querySelector(".vf-av-fill").style.width = pct(v);
        row.querySelector("em").textContent = pct(v);
        const gr = progress.groups[g];
        row.title = gr ? `${gr.sessions} entrenamientos · fuerza +${Math.round(gr.gain * 100)}%` : "";
      }
      root.querySelector(".vf-av-xp").textContent = progress.total
        ? `${progress.total} entrenamientos registrados · ${Math.round(progress.next * 100)}% hacia el nivel ${progress.level + 1}`
        : "Registra tu primer entrenamiento para empezar a crecer.";
      if (lastLevel != null && progress.level > lastLevel) ch.flex(2600); // ¡subió de nivel!
      lastLevel = progress.level;
    },
    flex: (ms) => ch.flex(ms),
    dispose: () => ch.dispose(),
  };
}
