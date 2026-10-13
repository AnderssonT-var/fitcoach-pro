import { useState } from "react";
import Icon from "../ui/Icon";
import { Avatar } from "../ui/kit";
import { doneSetCount, exerciseById, sessionVolume, useDB, userById } from "../store/db";
import { ago, clock, kg, tons, weekdayDate } from "../lib/format";

export const DIFFICULTY = [
  { v: 1, l: "Muy fácil" }, { v: 2, l: "Fácil" }, { v: 3, l: "Justo" }, { v: 4, l: "Duro" }, { v: 5, l: "Al límite" },
];
const DIFF_TONE = { 1: "ok", 2: "ok", 3: "info", 4: "warn", 5: "bad" };

export function DiffBar({ v }) {
  const c = { 1: "var(--green)", 2: "var(--green)", 3: "var(--blue)", 4: "var(--yellow)", 5: "var(--red)" }[v];
  return (
    <span className="row gap-xs tiny strong" style={{ color: "var(--ink-2)", whiteSpace: "nowrap" }} title="Dificultad percibida">
      <span className="diff-bar" aria-hidden="true">{[1, 2, 3, 4, 5].map((i) => <i key={i} style={{ background: i <= v ? c : undefined }} />)}</span>
      {DIFFICULTY[v - 1]?.l}
    </span>
  );
}

/** Lista de entrenamientos con detalle por serie al expandir. */
export default function SessionList({ sessions, showClient, limit, onReply }) {
  const db = useDB();
  const [open, setOpen] = useState(null);
  const list = limit ? sessions.slice(0, limit) : sessions;
  if (!list.length) return <div className="panel-body muted">Aún no hay entrenamientos registrados.</div>;
  return (
    <div className="list">
      {list.map((w) => {
        const isOpen = open === w.id;
        const u = userById(db, w.clientId);
        return (
          <div key={w.id} className="list-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
            <button className="row" onClick={() => setOpen(isOpen ? null : w.id)} aria-expanded={isOpen}
              style={{ background: "none", border: 0, padding: 0, textAlign: "left", width: "100%" }}>
              {showClient && u && <Avatar name={u.name} id={u.id} size="sm" />}
              <div className="grow">
                <div className="strong ellipsis">
                  {showClient && u ? `${u.name.split(" ")[0]} · ` : ""}{w.dayName}
                  {w.prs?.length > 0 && <span style={{ color: "var(--yellow-ink)" }}> · <Icon name="trophy" size={14} /> {w.prs.length} récord{w.prs.length > 1 ? "s" : ""}</span>}
                </div>
                <div className="small muted num">
                  {showClient ? ago(w.finishedAt) : weekdayDate(w.finishedAt)} · {clock(w.durationSec)} · {doneSetCount(w)} series · {tons(sessionVolume(w))}
                </div>
              </div>
              <span className="m-hide"><DiffBar v={w.difficulty} /></span>
              <Icon name={isOpen ? "up" : "down"} size={18} />
            </button>
            {w.comment && (
              <div className="row" style={{ alignItems: "flex-start", gap: 8 }}>
                <div className="comment grow">“{w.comment}”</div>
                {onReply && <button className="btn btn-quiet btn-sm" onClick={() => onReply(w.clientId)}>Responder</button>}
              </div>
            )}
            {isOpen && (
              <div className="stack gap-sm" style={{ paddingTop: 4 }}>
                <span className="d-hide"><DiffBar v={w.difficulty} /></span>
                {w.exercises.map((e, i) => (
                  <div key={i}>
                    <div className="small strong">{exerciseById(db, e.exId).name}</div>
                    <div className="row wrap gap-xs" style={{ marginTop: 4 }}>
                      {e.sets.map((x, j) => (
                        <span key={j} className="tag num" style={x.done ? null : { textDecoration: "line-through", opacity: .6 }}>
                          {kg(x.weight)} × {x.reps}
                        </span>
                      ))}
                      {w.prs?.some((p) => p.exId === e.exId) && <span className="tag" style={{ background: "var(--yellow-soft)", color: "var(--yellow-ink)" }}><Icon name="trophy" size={13} />Récord</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export { DIFF_TONE };
