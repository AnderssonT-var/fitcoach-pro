/* Reseñas de los asesorados: el asesorado la escribe desde su perfil, al entrenador le llega
   un aviso y la aprueba (sale en su página de presentación) o la rechaza (se borra).
   Una reseña por asesorado: si la edita, vuelve a quedar pendiente. */
import { z } from "zod";
import { knex, J, S } from "./db.js";
import { bad, nowISO, parse, uid, notFound } from "./util.js";
import { notifyLater } from "./notify.js";
import { bump } from "./versions.js";
import { dropCache } from "./landing.js";

export const reviewOut = (r) => ({ id: r.id, coachId: r.coach_id, clientId: r.client_id, rating: r.rating, text: r.text, detail: r.detail || "",
  status: r.status, createdAt: r.created_at, reviewedAt: r.reviewed_at || null });

/** «Camila R.»: nombre y la inicial del apellido, para mostrar en público. */
export function publicName(name) {
  const parts = String(name || "").trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.` : parts[0] || "Asesorado";
}

/** Reseñas aprobadas de un entrenador, listas para la página. */
export async function approvedReviews(coachId) {
  const rows = await knex("reviews").where({ coach_id: coachId, status: "approved" }).orderBy("reviewed_at", "desc").limit(60);
  if (!rows.length) return [];
  const users = await knex("users").whereIn("id", rows.map((r) => r.client_id)).select("id", "name", "profile");
  return rows.map((r) => {
    const u = users.find((x) => x.id === r.client_id);
    const photo = J(u?.profile, {}).photo;
    return { id: r.id, title: publicName(u?.name), detail: r.detail || "", rating: r.rating, text: r.text,
      photo: typeof photo === "string" && photo.length < 400_000 && /^data:image\/(png|jpeg|jpg|webp);base64,/.test(photo) ? photo : "" };
  });
}

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(10, "Escribe al menos unas palabras (10 letras).").max(700),
  detail: z.string().trim().max(70).optional().default(""),
});

/* ---------- asesorado ---------- */
export function clientReviewRoutes(router) {
  router.put("/review", async (req, res, next) => {
    try {
      const body = parse(reviewSchema, req.body);
      const c = await knex("clients").where({ user_id: req.user.id }).first();
      if (!c) throw bad("No tienes entrenador asignado.");
      const prev = await knex("reviews").where({ client_id: req.user.id }).first();
      const row = { coach_id: c.coach_id, rating: body.rating, text: body.text, detail: body.detail, status: "pending", created_at: nowISO(), reviewed_at: null };
      if (prev) await knex("reviews").where({ id: prev.id }).update(row);
      else await knex("reviews").insert({ id: uid("rv-"), client_id: req.user.id, ...row });
      if (prev?.status === "approved") dropCache(); // deja de mostrarse hasta que la apruebe de nuevo
      notifyLater(c.coach_id, { title: "⭐ Nueva reseña para aprobar", body: `${publicName(req.user.name)}: ${"★".repeat(body.rating)} “${body.text.slice(0, 90)}${body.text.length > 90 ? "…" : ""}”`,
        page: "pagina", tag: `review-${req.user.id}`, kind: "review" });
      await bump(`c:${c.coach_id}`);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });
  router.delete("/review", async (req, res, next) => {
    try {
      const prev = await knex("reviews").where({ client_id: req.user.id }).first();
      if (prev) { await knex("reviews").where({ id: prev.id }).delete(); if (prev.status === "approved") dropCache(); }
      res.json({ ok: true });
    } catch (e) { next(e); }
  });
}

/* ---------- entrenador ---------- */
export function coachReviewRoutes(router) {
  router.post("/reviews/:id/approve", async (req, res, next) => {
    try {
      const r = await knex("reviews").where({ id: req.params.id, coach_id: req.user.id }).first();
      if (!r) throw notFound("Esa reseña ya no existe.");
      await knex("reviews").where({ id: r.id }).update({ status: "approved", reviewed_at: nowISO() });
      // Si su página aún no tiene sección de reseñas, se agrega antes del bloque final
      const pg = await knex("coach_pages").where({ coach_id: req.user.id }).first();
      if (pg) {
        const data = J(pg.data, {});
        const list = Array.isArray(data.sections) ? data.sections : [];
        if (!list.some((s) => s.type === "reviews")) {
          const sec = { id: uid("s").slice(0, 20), type: "reviews", visible: true, title: "Lo que dicen mis asesorados", subtitle: "", bg: "alt", fromClients: true, items: [] };
          const cta = list.findIndex((s) => s.type === "cta");
          list.splice(cta >= 0 ? cta : list.length, 0, sec);
          await knex("coach_pages").where({ coach_id: req.user.id }).update({ data: S({ ...data, sections: list }), updated_at: nowISO() });
        }
      }
      dropCache();
      notifyLater(r.client_id, { title: "Tu reseña ya está publicada", body: "Gracias por compartir tu experiencia 💪", page: "perfil", tag: "review", kind: "review" });
      res.json({ ok: true });
    } catch (e) { next(e); }
  });
  router.delete("/reviews/:id", async (req, res, next) => {
    try {
      const r = await knex("reviews").where({ id: req.params.id, coach_id: req.user.id }).first();
      if (!r) throw notFound("Esa reseña ya no existe.");
      await knex("reviews").where({ id: r.id }).delete();
      if (r.status === "approved") dropCache();
      await bump(`u:${r.client_id}`);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });
}
