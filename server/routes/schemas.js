import { z } from "zod";
import { knex, J } from "../db.js";
import { deleteFile } from "../files.js";

const str = (max) => z.string().trim().max(max);
const MUSCLES = ["chest", "shoulders", "biceps", "triceps", "forearms", "abdominals", "lats", "middle back", "lower back", "traps", "glutes", "quadriceps", "hamstrings", "adductors", "abductors", "calves", "neck"];

/* Drop set: bajadas de peso sin descanso al final de la serie */
const dropSchema = z.object({ count: z.number().int().min(1).max(4), pct: z.number().int().min(5).max(50), on: z.enum(["last", "all"]) });

/* Intensidad objetivo (RIR o RPE) y tempo (bajada-pausa-subida-pausa) */
const effortSchema = z.object({ type: z.enum(["rir", "rpe"]), value: z.number().min(0).max(10) });
const tempoSchema = z.string().trim().toUpperCase().max(11).refine((t) => t === "" || /^[0-9X]{1,2}(-[0-9X]{1,2}){2,3}$/.test(t), "El tempo va como 3-1-1-0 (X = explosivo).");

export const MESSAGE_TAGS = ["comentario", "nota", "tecnica", "molestia"];

export const routineSchema = z.object({
  name: str(80).default(""), goal: str(40).default(""), frequency: z.number().int().min(1).max(7), notes: str(1000).default(""),
  days: z.array(z.object({
    id: str(40), name: str(60),
    exercises: z.array(z.object({
      uid: str(40).optional(), exId: z.number().int().positive(), sets: z.number().int().min(1).max(20),
      reps: z.union([z.string(), z.number()]).transform((v) => String(v).slice(0, 20)), rest: z.number().int().min(0).max(900),
      notes: str(300).optional().default(""),
      technique: z.enum(["normal", "dropset"]).optional().default("normal"),
      drops: dropSchema.optional(),
      linkNext: z.boolean().optional(), effort: effortSchema.optional(), tempo: tempoSchema.optional(),
    }).transform((e) => (e.technique === "dropset" && e.drops ? e : { ...e, technique: "normal", drops: undefined }))).max(40),
  })).min(1).max(7),
});

const num = (max) => z.union([z.number(), z.string()]).optional().nullable()
  .transform((v) => (v === "" || v == null || Number.isNaN(+v) ? null : +v)).refine((v) => v == null || (v >= 0 && v <= max), "Revisa los números de las medidas.");
export const measurementSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(), note: str(300).optional().default(""),
  weight: num(400), fat: num(80), waist: num(300), hip: num(300), chest: num(300), arm: num(150), thigh: num(200),
});

export const photosSchema = z.object({
  photos: z.array(z.object({
    src: z.string().max(6_000_000), pose: str(20).optional().default(""),
    note: str(300).optional().default(""), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  })).min(1).max(6),
});

export const exerciseSchema = z.object({
  name: str(80).min(2, "Escribe el nombre del ejercicio."), muscle: str(40), equipment: str(40), level: str(20).optional().default("Intermedio"),
  type: str(20).optional().default("Fuerza"), primary: z.array(z.enum(MUSCLES)).max(6).default([]), secondary: z.array(z.enum(MUSCLES)).max(8).default([]),
  steps: z.array(str(300)).max(10).default([]), cues: str(300).optional().default(""), sets: z.number().int().min(1).max(20).default(3),
  reps: z.union([z.string(), z.number()]).transform((v) => String(v).slice(0, 20)).default("12"), rest: z.number().int().min(0).max(900).default(60),
  photo: z.string().max(3_000_000).nullable().optional(),
});

export const profileSchema = z.object({
  name: str(120).min(2, "Escribe tu nombre."), photo: z.string().max(400_000).nullable(), phone: str(30), city: str(60), headline: str(80),
  years: z.number().int().min(0).max(70).nullable(), instagram: str(60), bio: str(800),
  specialties: z.array(str(60)).max(12), certifications: z.array(str(80)).max(12), services: z.array(str(100)).max(12),
  injuries: str(400), birthYear: z.number().int().min(1920).max(new Date().getFullYear() - 10).nullable(), body: z.enum(["m", "f"]),
  // Recordatorio de entrenamiento: días (0 = domingo) y hora local
  notif: z.object({ reminder: z.object({ on: z.boolean(), days: z.array(z.number().int().min(0).max(6)).max(7), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }) }),
}).partial();

/* Sesión de entrenamiento en curso: estructura conocida y tamaño acotado */
const setSchema = z.object({
  weight: z.union([z.string(), z.number()]).transform((v) => String(v).slice(0, 10)),
  reps: z.union([z.string(), z.number()]).transform((v) => String(v).slice(0, 10)),
  prevWeight: z.number().nullable().optional(), prevReps: z.number().nullable().optional(), done: z.boolean(),
  drops: z.array(z.object({
    weight: z.union([z.string(), z.number()]).transform((v) => String(v).slice(0, 10)),
    reps: z.union([z.string(), z.number()]).transform((v) => String(v).slice(0, 10)),
    prevReps: z.number().nullable().optional(), done: z.boolean(),
  })).max(4).optional(),
});
export const sessionSchema = z.object({
  id: str(40), clientId: z.number().int(), dayId: str(40), dayName: str(60), routineName: str(80).optional().default(""),
  startedAt: z.string().max(30), restEndsAt: z.number().nullable().optional(), restTotal: z.number().optional().default(0),
  focus: z.number().int().min(0).max(60).optional(),
  exercises: z.array(z.object({
    exId: z.number().int().positive(), notes: str(300).optional().default(""),
    target: z.object({ sets: z.number(), reps: z.string().max(20), rest: z.number(), drop: dropSchema.optional(),
      linkNext: z.boolean().optional(), effort: effortSchema.optional(), tempo: tempoSchema.optional() }),
    sets: z.array(setSchema).max(30),
  })).max(40),
});

/** Borra a un asesorado y todo lo suyo (derecho de eliminación de datos). */
export async function deleteClientData(userId) {
  const photos = await knex("photos").where({ client_id: userId });
  const receipts = await knex("files").where({ owner_id: userId }).select("id");
  const coachId = (await knex("clients").where({ user_id: userId }).first())?.coach_id;
  await knex.transaction(async (trx) => {
    await trx("photos").where({ client_id: userId }).delete();
    await trx("workouts").where({ client_id: userId }).delete();
    await trx("active_workouts").where({ client_id: userId }).delete();
    await trx("messages").where({ client_id: userId }).delete();
    await trx("payments").where({ client_id: userId }).delete();
    await trx("posts").where({ author_id: userId }).delete();
    await trx("refresh_tokens").where({ user_id: userId }).delete();
    await trx("clients").where({ user_id: userId }).delete();
    await trx("users").where({ id: userId }).delete();
  });
  // Quita sus comentarios y "me gusta" de las publicaciones del grupo
  for (const p of coachId ? await knex("posts").where({ coach_id: coachId }).select("id", "likes", "comments") : []) {
    const likes = J(p.likes, []), comments = J(p.comments, []);
    const nl = likes.filter((x) => x !== userId), nc = comments.filter((x) => x.authorId !== userId);
    if (nl.length !== likes.length || nc.length !== comments.length) await knex("posts").where({ id: p.id }).update({ likes: JSON.stringify(nl), comments: JSON.stringify(nc) });
  }
  for (const p of photos) await deleteFile(p.file_id);
  for (const f of receipts) await deleteFile(f.id);
}
