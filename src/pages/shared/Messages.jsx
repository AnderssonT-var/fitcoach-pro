import { useEffect, useRef, useState } from "react";
import Icon from "../../ui/Icon";
import { Avatar, Empty, toast } from "../../ui/kit";
import { useApp } from "../../context";
import { clientById, clientsOf, markThreadRead, sendMessage, thread, useDB, userById } from "../../store/db";
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
          <div className="chat-thread"><Thread coachId={c.coachId} clientId={me.id} other={coach} /></div>
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
                  <div className={`small ellipsis ${unread ? "" : "muted"}`}>{last ? `${last.from === me.id ? "Tú: " : ""}${last.text}` : "Sin mensajes"}</div>
                </div>
                {unread > 0 && <span className="nav-count" style={{ marginLeft: 0 }}>{unread}</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="chat-thread">
          {other ? <Thread coachId={me.id} clientId={sel} other={other} onBack={() => setSel(null)} />
            : <Empty icon="chat" title="Elige una conversación" text="Selecciona un cliente para ver sus mensajes." />}
        </div>
      </section>
    </div>
  );
}

function Thread({ coachId, clientId, other, onBack }) {
  const db = useDB();
  const { me } = useApp();
  const [text, setText] = useState("");
  const msgs = thread(db, coachId, clientId);
  const box = useRef(null);
  useEffect(() => { markThreadRead(coachId, clientId, me.id); }, [coachId, clientId, me.id, msgs.length]);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs.length, clientId]);

  function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    sendMessage(coachId, clientId, me.id, text).then((r) => { if (r?.error) toast(r.error, "alert"); });
    setText("");
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
            <div className={`bubble ${m.from === me.id ? "me" : ""}`}>{m.text}<time dateTime={m.at}>{time(m.at)}{m.from === me.id && m.read ? " · Visto" : ""}</time></div>
          </div>
        ))}
      </div>
      <form className="chat-input" onSubmit={send}>
        <label className="sr-only" htmlFor="chat-text">Mensaje</label>
        <input id="chat-text" className="input grow" placeholder={`Escribe a ${other.name.split(" ")[0]}`} value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
        <button className="btn btn-primary" type="submit" disabled={!text.trim()} aria-label="Enviar"><Icon name="send" size={18} /></button>
      </form>
    </>
  );
}
