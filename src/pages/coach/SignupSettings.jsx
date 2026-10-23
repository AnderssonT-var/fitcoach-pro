/* Inscripción desde el enlace del entrenador: los nuevos asesorados se registran solos. */
import { useState } from "react";
import Icon from "../../ui/Icon";
import { CopyButton, Field, run } from "../../ui/kit";
import { updateBrand, useDB } from "../../store/db";
import { TRIAL_OPTIONS } from "../../lib/trial";
import { brandUrl } from "./CoachProfile";
import { money } from "../../lib/format";

export default function SignupSettings({ u }) {
  const db = useDB();
  const saved = { open: false, fee: 0, trialDays: 0, trialFee: 0, templateId: null, ...(u.brand?.signup || {}) };
  const [f, setF] = useState({ ...saved, fee: String(saved.fee), trialFee: String(saved.trialFee) });
  const templates = db.templates.filter((t) => t.coachId === u.id);
  const norm = (x) => ({ open: !!x.open, fee: +x.fee || 0, trialDays: +x.trialDays || 0, trialFee: +x.trialFee || 0, templateId: x.templateId || null });
  const dirty = JSON.stringify(norm(f)) !== JSON.stringify(norm(saved));
  const link = brandUrl(u.brand?.slug || "");
  return (
    <section className="panel">
      <div className="panel-head"><h2>Inscripción desde tu enlace</h2>{saved.open && <span className="pill ok">Abierta</span>}</div>
      <div className="panel-body stack">
        <p className="small muted" style={{ margin: 0 }}>Comparte tu enlace en Instagram o WhatsApp: los nuevos asesorados se registran solos, aceptan el aviso de privacidad y empiezan su prueba. Te llega un aviso con cada inscripción.</p>
        <label className="toggle"><input type="checkbox" checked={f.open} onChange={(e) => setF({ ...f, open: e.target.checked })} />
          <span><strong>Permitir que se inscriban solos</strong><br /><span className="small muted">Si está apagado, solo tú creas las cuentas.</span></span></label>
        {f.open && (
          <>
            <div className="form-grid">
              <Field label="Mensualidad" id="su-fee"><input id="su-fee" className="input num" type="number" min="0" inputMode="decimal" value={f.fee} onChange={(e) => setF({ ...f, fee: e.target.value })} /></Field>
              <Field label="Rutina inicial" id="su-tpl" hint={templates.length ? "Se copia al inscribirse" : "Guarda una rutina como plantilla para usarla aquí"}>
                <select id="su-tpl" className="select" value={f.templateId || ""} onChange={(e) => setF({ ...f, templateId: e.target.value || null })}>
                  <option value="">Ninguna: la armo yo</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select></Field>
              <div className="field full">
                <span className="label">Plan de prueba</span>
                <div className="chips" role="group" aria-label="Plan de prueba al inscribirse">
                  {[0, ...TRIAL_OPTIONS].map((d) => <button key={d} type="button" className="chip" aria-pressed={+f.trialDays === d} onClick={() => setF({ ...f, trialDays: d })}>{d === 0 ? "Sin prueba" : d === 30 ? "1 mes" : `${d} días`}</button>)}
                </div>
              </div>
              {+f.trialDays > 0 && <Field label="Precio de la prueba" id="su-tfee" hint="0 si es gratis"><input id="su-tfee" className="input num" type="number" min="0" inputMode="decimal" value={f.trialFee} onChange={(e) => setF({ ...f, trialFee: e.target.value })} /></Field>}
            </div>
            <div className="note-box small"><Icon name="users" size={16} /><span>
              Al inscribirse {+f.trialDays > 0 ? <>empieza una prueba de {+f.trialDays === 30 ? "1 mes" : `${f.trialDays} días`} ({+f.trialFee > 0 ? `cobro de ${money(+f.trialFee)}` : "gratis"}) y luego paga {money(+f.fee || 0)} al mes</> : <>se registra su mensualidad de {money(+f.fee || 0)}</>}.
              {f.templateId ? " Recibe la rutina inicial al instante." : " Le armas la rutina después."}</span></div>
          </>
        )}
        {saved.open && link && <div className="row gap-sm" style={{ minWidth: 0 }}><code className="ellipsis grow small">{link}</code><CopyButton text={link} small /></div>}
        <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={!dirty}
          onClick={() => run(updateBrand(u.id, { signup: norm(f) }), f.open ? "Inscripción abierta" : "Inscripción cerrada", "users")}>Guardar</button>
      </div>
    </section>
  );
}
