import { useEffect, useRef, useState } from "react";
import Icon from "../../ui/Icon";
import { Avatar, Empty, toast } from "../../ui/kit";
import { useApp } from "../../context";
import { clientById, clientsOf, exerciseById, markThreadRead, sendMessage, thread, useDB, userById } from "../../store/db";
import { ExerciseDetail } from "../../ui/exercises";
import { ExerciseChip, ExercisePicker, tagInfo } from "./ExerciseTag";
import { ago, date, sameDay, time } from "../../lib/format";

export default function Messages() {
  const db = useDB();
  const { me, params } = useApp();
  const isCoach = me.role === "coach";
  const [sel, setSel] = useState(params.clientId || null);
  const [q, setQ] = useState("");
  useEffect(() => { if (params.clientId) setSel(params.clientId); }, [params]);

  if (!isCoach) {
    const c = clientById(db, me.id);
    const coach = userById(db, c.coachId);
    return (
      <div className="page">
        <div className="page-head"><div><h1>Tu entrenador</h1><p>Escríbele a {coach.name.split(" ")[0]} tus dudas, molestias o cómo te sientes.</p></div></div>
        <section className="panel chat has-thread" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
          <div className="chat-thread"><Thread coachId={c.coachId} clientId={me.id} other={coach} initialRef={params.exId ? { exId: params.exId, tag: params.tag } : null} /></div>
        </section>
      </div>
    );
  }

  const convs = clientsOf(db, me.id).map((c) => {
    const t = thread(db, me.id, c.userId);
    return { c, last: t.at(-1), unread: t.filter((m) => !m.read && m.from !== me.id).length };
  }).filter((x) => !q || x.c.user.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => new Date(b.last?.at || 0) - new Date(a.last?.at || 0));
  const other = sel ? userById(db, sel) : null;

  return (
    <div className="page">
      <div className="page-head"><div><h1>Mensajes</h1><p>Conversaciones con tus clientes. Aquí también llegan sus comentarios al terminar un entrenamiento.</p></div></div>
      <section className={`panel chat ${sel ? "has-thread" : ""}`}>
        <div className="chat-list">
          <div style={{ padding: 12, borderBottom: "1px solid var(--line)" }}>
            <div className="search" style={{ maxWidth: "none" }}>
              <Icon name="search" size={18} />
              <label className="sr-only" htmlFor="msg-q">Buscar conversación</label>
              <input id="msg-q" className="input" placeholder="Buscar cliente" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="list">
            {convs.map(({ c, last, unread }) => (
              <button key={c.userId} className="list-row" onClick={() => setSel(c.userId)} aria-current={sel === c.userId ? "true" : undefined}
                style={sel === c.userId ? { background: "var(--blue-soft)" } : null}>
                <Avatar name={c.user.name} id={c.userId} size="sm" />
                <div className="grow">
                  <div className="row spread gap-sm"><span className={`ellipsis ${unread ? "strong" : ""}`}>{c.user.name}</span>{last && <span className="tiny muted" style={{ whiteSpace: "nowrap" }}>{ago(last.at)}</span>}</div>
                  <div className={`small ellipsis ${unread ? "" : "muted"}`}>{last ? `${last.from === me.id ? "Tú: " : ""}${last.exId ? `[${exerciseById(db, last.exId).name}] ` : ""}${last.text}` : "Sin mensajes"}</div>
                </div>
                {unread > 0 && <span className="nav-count" style={{ marginLeft: 0 }}>{unread}</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="chat-thread">
          {other ? <Thread key={sel} coachId={me.id} clientId={sel} other={other} onBack={() => setSel(null)} initialRef={params.exId && params.clientId === sel ? { exId: params.exId, tag: params.tag } : null} />
            : <Empty icon="chat" title="Elige una conversación" text="Selecciona un cliente para ver sus mensajes." />}
        </div>
      </section>
    </div>
  );
}

function Thread({ coachId, clientId, other, onBack, initialRef }) {
  const db = useDB();
  const { me } = useApp();
  const [text, setText] = useState("");
  const [ref, setRef] = useState(initialRef || null);
  const [picking, setPicking] = useState(false);
  const [view, setView] = useState(null);
  const input = useRef(null);
  useEffect(() => { if (initialRef?.exId) { setRef(initialRef); input.current?.focus(); } }, [initialRef?.exId, initialRef?.tag]);
  const msgs = thread(db, coachId, clientId);
  const box = useRef(null);
  useEffect(() => { markThreadRead(coachId, clientId, me.id); }, [coachId, clientId, me.id, msgs.length]);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs.length, clientId]);

  function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    sendMessage(coachId, clientId, me.id, text, ref).then((r) => { if (r?.error) toast(r.error, "alert"); });
    setText(""); setRef(null);
  }
  return (
    <>
      <div className="row" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
        {onBack && <button className="btn btn-ghost btn-icon btn-sm d-hide" onClick={onBack} aria-label="Volver a conversaciones"><Icon name="left" /></button>}
        <Avatar name={other.name} id={other.id} size="sm" />
        <div className="grow"><div className="strong ellipsis">{other.name}</div><div className="tiny muted">{other.role === "coach" ? "Tu entrenador" : "Cliente"}</div></div>
      </div>
      <div className="chat-msgs" aria-live="polite" ref={box}>
        {msgs.length === 0 && <div className="chat-day">Escribe el primer mensaje</div>}
        {msgs.map((m, i) => (
          <div key={m.id} style={{ display: "contents" }}>
            {(i === 0 || !sameDay(msgs[i - 1].at, m.at)) && <div className="chat-day">{sameDay(m.at, new Date()) ? "Hoy" : date(m.at, { weekday: "long", day: "numeric", month: "short" })}</div>}
            <div className={`bubble ${m.from === me.id ? "me" : ""} ${m.exId ? "tagged" : ""}`}>
              {m.exId && <ExerciseChip exId={m.exId} tag={m.tag} mine={m.from === me.id} onOpen={() => setView(exerciseById(db, m.exId))} />}
              {m.text}<time dateTime={m.at}>{time(m.at)}{m.from === me.id && m.read ? " · Visto" : ""}</time></div>
          </div>
        ))}
      </div>
      {ref && <div className="chat-ref"><ExerciseChip exId={ref.exId} tag={ref.tag} onOpen={() => setPicking(true)} onRemove={() => setRef(null)} /></div>}
      <form className="chat-input" onSubmit={send}>
        <button type="button" className="btn btn-ghost chat-tag-btn" onClick={() => setPicking(true)} aria-label="Etiquetar un ejercicio" title="Etiquetar un ejercicio"><Icon name="dumbbell" size={19} /></button>
        <label className="sr-only" htmlFor="chat-text">Mensaje</label>
        <input id="chat-text" ref={input} className="input grow" placeholder={ref ? `${tagInfo(ref.tag).l} sobre ${exerciseById(db, ref.exId).name}` : `Escribe a ${other.name.split(" ")[0]}`} value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
        <button className="btn btn-primary" type="submit" disabled={!text.trim()} aria-label="Enviar"><Icon name="send" size={18} /></button>
      </form>
      {picking && <ExercisePicker coachId={coachId} clientId={clientId} initial={ref} onClose={() => setPicking(false)}
        onPick={(r) => { setRef(r); setPicking(false); setTimeout(() => input.current?.focus(), 50); }} />}
      {view && <ExerciseDetail ex={view} coachName={userById(db, coachId)?.name.split(" ")[0]} onClose={() => setView(null)} />}
    </>
  );
}
