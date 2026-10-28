import { useState } from "react";
import Icon from "../../ui/Icon";
import { Avatar, Confirm, Empty, run } from "../../ui/kit";
import { useApp } from "../../context";
import { addComment, addPost, clientById, deletePost, toggleLike, useDB, userById } from "../../store/db";
import { ago } from "../../lib/format";

export default function Community() {
  const db = useDB();
  const { me } = useApp();
  const coachId = me.role === "coach" ? me.id : clientById(db, me.id)?.coachId;
  const coach = userById(db, coachId);
  const posts = db.posts.filter((p) => p.coachId === coachId).sort((a, b) => new Date(b.at) - new Date(a.at));
  // Tabla del mes: entrenamientos registrados por cada miembro
  // (el asesorado recibe del servidor solo el conteo de sus compañeros)
  const now = new Date();
  const board = (db.ranking
    ? db.ranking.map((r) => ({ u: userById(db, r.userId), n: r.n }))
    : db.clients.filter((c) => c.coachId === coachId && c.active).map((c) => ({
      u: userById(db, c.userId),
      n: db.workouts.filter((w) => w.clientId === c.userId && new Date(w.finishedAt).getMonth() === now.getMonth() && new Date(w.finishedAt).getFullYear() === now.getFullYear()).length,
    }))).filter((x) => x.u).sort((a, b) => b.n - a.n);

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Comunidad</h1><p>{me.role === "coach" ? "Tu grupo: comparte retos, consejos y celebra los logros de tus clientes." : `El grupo de ${coach?.name.split(" ")[0]}: comparte tus logros y anima a los demás.`}</p></div>
      </div>
      <div className="split">
        <div className="stack-lg">
          <Composer coachId={coachId} />
          <section className="panel">
            {posts.length === 0 ? <Empty icon="community" title="Todavía no hay publicaciones" text="Escribe la primera para animar al grupo." /> : posts.map((p) => <Post key={p.id} p={p} board={board} />)}
          </section>
        </div>
        <section className="panel">
          <div className="panel-head"><h2>Tabla del mes</h2><span className="small muted">entrenamientos</span></div>
          <div className="list">
            {board.map((b, i) => (
              <div key={b.u.id} className="list-row">
                <span className="display num" style={{ width: 20, fontSize: 20, color: i === 0 ? "var(--yellow-ink)" : "var(--muted)" }}>{i + 1}</span>
                <Avatar name={b.u.name} id={b.u.id} size="sm" />
                <span className="grow ellipsis strong">{b.u.name}{b.u.id === me.id ? " (tú)" : ""}</span>
                <span className="display num" style={{ fontSize: 22 }}>{b.n}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Composer({ coachId }) {
  const { me } = useApp();
  const [text, setText] = useState("");
  const [kind, setKind] = useState("post");
  async function send() {
    if (!text.trim()) return;
    const r = await run(addPost(coachId, me.id, text, kind), kind === "challenge" ? "Reto publicado" : "Publicado", "community");
    if (!r?.error) { setText(""); setKind("post"); }
  }
  return (
    <section className="panel panel-pad stack">
      <div className="row" style={{ alignItems: "flex-start" }}>
        <Avatar name={me.name} id={me.id} />
        <div className="grow">
          <label className="sr-only" htmlFor="post-text">Escribe una publicación</label>
          <textarea id="post-text" className="textarea" rows={2} value={text} onChange={(e) => setText(e.target.value)}
            placeholder={me.role === "coach" ? "Comparte un consejo o lanza un reto al grupo" : "Cuenta cómo te fue hoy"} />
        </div>
      </div>
      <div className="row spread wrap gap-sm">
        {me.role === "coach" ? (
          <div className="seg" role="group" aria-label="Tipo de publicación">
            <button aria-pressed={kind === "post"} onClick={() => setKind("post")}>Publicación</button>
            <button aria-pressed={kind === "challenge"} onClick={() => setKind("challenge")}>Reto</button>
          </div>
        ) : <span />}
        <button className="btn btn-primary" disabled={!text.trim()} onClick={send}>Publicar</button>
      </div>
    </section>
  );
}

function Post({ p, board }) {
  const db = useDB();
  const { me } = useApp();
  const [open, setOpen] = useState(p.comments.length > 0 && p.comments.length <= 2);
  const [reply, setReply] = useState("");
  const [del, setDel] = useState(false);
  const author = userById(db, p.authorId);
  const liked = p.likes.includes(me.id);
  const canDelete = p.authorId === me.id || me.role === "coach";
  return (
    <article className="post">
      <div className="row">
        <Avatar name={author?.name || "?"} id={p.authorId} size="sm" />
        <div className="grow">
          <div className="strong small">{author?.name}{author?.role === "coach" && <span className="tag" style={{ marginLeft: 6 }}>Entrenador</span>}</div>
          <div className="tiny muted">{ago(p.at)}</div>
        </div>
        {p.kind === "challenge" && <span className="post-kind k-challenge"><Icon name="trophy" size={14} />Reto</span>}
        {p.kind === "workout" && <span className="post-kind k-workout"><Icon name="dumbbell" size={14} />Entrenamiento</span>}
        {canDelete && <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDel(true)} aria-label="Eliminar publicación"><Icon name="trash" size={16} /></button>}
      </div>
      <p className="post-text">{p.text}</p>
      {p.kind === "challenge" && board.length > 0 && (
        <div className="comment small">Va ganando <strong>{board[0].u.name.split(" ")[0]}</strong> con {board[0].n} entrenamientos este mes.</div>
      )}
      <div className="post-actions">
        <button className={liked ? "liked" : ""} onClick={() => toggleLike(p.id, me.id)} aria-pressed={liked}><Icon name="heart" size={17} />{p.likes.length || ""} Me gusta</button>
        <button onClick={() => setOpen(!open)} aria-expanded={open}><Icon name="chat" size={17} />{p.comments.length || ""} Comentar</button>
      </div>
      {open && (
        <div className="stack gap-sm">
          {p.comments.map((c) => {
            const a = userById(db, c.authorId);
            return (
              <div key={c.id} className="row" style={{ alignItems: "flex-start" }}>
                <Avatar name={a?.name || "?"} id={c.authorId} size="sm" />
                <div className="comment grow"><span className="strong">{a?.name.split(" ")[0]}</span> <span className="tiny muted">{ago(c.at)}</span><div>{c.text}</div></div>
              </div>
            );
          })}
          <form className="row" onSubmit={(e) => { e.preventDefault(); if (reply.trim()) { run(addComment(p.id, me.id, reply)); setReply(""); } }}>
            <label className="sr-only" htmlFor={`rep-${p.id}`}>Escribe un comentario</label>
            <input id={`rep-${p.id}`} className="input grow" placeholder="Escribe un comentario" value={reply} onChange={(e) => setReply(e.target.value)} />
            <button className="btn btn-quiet" type="submit" disabled={!reply.trim()} aria-label="Enviar comentario"><Icon name="send" size={17} /></button>
          </form>
        </div>
      )}
      {del && <Confirm title="Eliminar publicación" confirmLabel="Eliminar" onClose={() => setDel(false)} onConfirm={() => { run(deletePost(p.id), "Publicación eliminada", "trash"); }} text="La publicación y sus comentarios desaparecen del grupo." />}
    </article>
  );
}
