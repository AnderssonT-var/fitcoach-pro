#!/usr/bin/env python3
"""Genera la biblioteca de ejercicios de VYTRAFIT a partir del dataset
hasaneyldrm/exercises-dataset (datos MIT; animaciones © Gym visual, con licencia).

Uso:
  DATASET=/ruta/exercises-dataset NAMES=/ruta/nombres.txt MAP=/ruta/mapa.txt \
  MEDIA_OUT=/ruta/salida python3 tools/exercises/build.py

Escribe:
  src/store/exercises.js            biblioteca para la web
  mobile/assets/data/exercises.json biblioteca para la app
  server/exmap.json                 id viejo -> id nuevo (migración de rutinas e historial)
  $MEDIA_OUT/a/<id>.webp            animación (180x180)
  $MEDIA_OUT/t/<id>.webp            miniatura
"""
import json, os, sys
from concurrent.futures import ProcessPoolExecutor
from PIL import Image, ImageSequence

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATASET, NAMES, MAP, MEDIA_OUT = (os.environ[k] for k in ("DATASET", "NAMES", "MAP", "MEDIA_OUT"))
OFFSET = 10000  # ids nuevos: 10000 + id del dataset (los propios del coach empiezan en 100000)

TARGET = {  # músculo objetivo -> (grupo, clave del mapa muscular)
    "abs": ("Abdomen", "abdominals"), "pectorals": ("Pecho", "chest"), "biceps": ("Bíceps", "biceps"),
    "glutes": ("Glúteos", "glutes"), "delts": ("Hombros", "shoulders"), "triceps": ("Tríceps", "triceps"),
    "upper back": ("Espalda", "middle back"), "lats": ("Espalda", "lats"), "calves": ("Pantorrillas", "calves"),
    "quads": ("Cuádriceps", "quadriceps"), "forearms": ("Antebrazos", "forearms"),
    "cardiovascular system": ("Cardio", None), "hamstrings": ("Isquiotibiales", "hamstrings"),
    "spine": ("Espalda", "lower back"), "traps": ("Espalda", "traps"), "adductors": ("Cuádriceps", "adductors"),
    "serratus anterior": ("Pecho", "chest"), "abductors": ("Glúteos", "abductors"), "levator scapulae": ("Hombros", "neck"),
}
MUSCLE = {  # músculos secundarios -> clave del mapa muscular
    "shoulders": "shoulders", "deltoids": "shoulders", "rear deltoids": "shoulders", "rotator cuff": "shoulders",
    "hamstrings": "hamstrings", "forearms": "forearms", "wrist flexors": "forearms", "wrist extensors": "forearms",
    "wrists": "forearms", "grip muscles": "forearms", "hands": "forearms", "brachialis": "biceps",
    "triceps": "triceps", "biceps": "biceps", "quadriceps": "quadriceps", "calves": "calves", "soleus": "calves",
    "glutes": "glutes", "core": "abdominals", "obliques": "abdominals", "abdominals": "abdominals", "lower abs": "abdominals",
    "hip flexors": "quadriceps", "chest": "chest", "upper chest": "chest", "lower back": "lower back",
    "rhomboids": "middle back", "upper back": "middle back", "back": "middle back", "trapezius": "traps", "traps": "traps",
    "latissimus dorsi": "lats", "lats": "lats", "sternocleidomastoid": "neck", "inner thighs": "adductors", "groin": "adductors",
}
EQUIP = {
    "body weight": "Peso corporal", "dumbbell": "Mancuernas", "cable": "Polea", "barbell": "Barra",
    "olympic barbell": "Barra", "trap bar": "Barra", "leverage machine": "Máquina", "band": "Banda elástica",
    "resistance band": "Banda elástica", "smith machine": "Máquina Smith", "kettlebell": "Kettlebell", "weighted": "Disco",
    "stability ball": "Fitball", "ez barbell": "Barra Z", "assisted": "Máquina", "sled machine": "Máquina",
    "medicine ball": "Balón medicinal", "rope": "Cuerda", "upper body ergometer": "Máquina", "skierg machine": "Máquina",
    "stationary bike": "Máquina", "elliptical machine": "Máquina", "stepmill machine": "Máquina",
}
ADVANCED = ("planche", "lever", "maltese", "flag", "muscle up", "muscle-up", "handstand", "one arm chin", "one arm dip",
            "archer", "skin the cat", "impossible", "pistol", "dragon", "l-pull", "stalder", "elevator", "swing 360",
            "one hand pull up", "single arm push", "korean", "full planche")
BEGINNER_EQ = ("leverage machine", "band", "resistance band", "assisted", "stability ball", "cable", "smith machine", "sled machine")


def level(x):
    n = x["name"].lower()
    if any(k in n for k in ADVANCED): return "Avanzado"
    if "stretch" in n or x["equipment"] in BEGINNER_EQ: return "Principiante"
    return "Intermedio"


def kind(x):
    n = x["name"].lower()
    if "stretch" in n or "pose" in n: return "Estiramiento"
    if x["target"] == "cardiovascular system": return "Cardio"
    if any(k in n for k in ("jump", "plyo", "burpee", "hops", "clap", "throw", "slam", "skater")): return "Pliometría"
    if any(k in n for k in ("snatch", "clean", "jerk")) and x["equipment"] in ("barbell", "olympic barbell", "dumbbell", "kettlebell"): return "Halterofilia"
    return "Fuerza"


def defaults(t):
    return {"Estiramiento": (2, "30 s", 30), "Cardio": (1, "10 min", 60), "Pliometría": (3, "10", 60)}.get(t, (3, "10-12", 90))


def convert(job):
    src_gif, src_jpg, nid = job
    a = os.path.join(MEDIA_OUT, "a", f"{nid}.webp")
    t = os.path.join(MEDIA_OUT, "t", f"{nid}.webp")
    if not os.path.exists(a):
        g = Image.open(src_gif)
        fr, du = [], []
        for f in ImageSequence.Iterator(g):
            fr.append(f.convert("RGB")); du.append(f.info.get("duration", 100) or 100)
        fr[0].save(a, save_all=True, append_images=fr[1:], duration=du, loop=0, quality=72, method=4)
    if not os.path.exists(t):
        Image.open(src_jpg).convert("RGB").save(t, quality=78, method=4)
    return nid


def main():
    data = json.load(open(os.path.join(DATASET, "data", "exercises.json")))
    names = dict(l.rstrip("\n").split("|", 1) for l in open(NAMES, encoding="utf-8") if "|" in l)
    old2ds = dict(l.strip().split("|") for l in open(MAP) if "|" in l)
    lib, jobs = [], []
    for x in data:
        nid = OFFSET + int(x["id"])
        grp, prim = TARGET.get(x["target"], ("Cuerpo completo", None))
        t = kind(x)
        if t == "Estiramiento": grp = "Estiramiento"
        primary = [prim] if prim else []
        secondary = []
        for m in x.get("secondary_muscles") or []:
            k = MUSCLE.get(m)
            if k and k not in primary and k not in secondary: secondary.append(k)
        steps = (x.get("instruction_steps") or {}).get("es") or []
        steps = [s.strip() for s in steps if s.strip() and not s.lower().startswith("repite")]
        sets, reps, rest = defaults(t)
        lib.append({
            "id": nid, "name": names[x["id"]], "muscle": grp, "equipment": EQUIP.get(x["equipment"], "Otro"),
            "level": level(x), "type": t, "primary": primary, "secondary": secondary, "cues": "",
            "steps": steps, "sets": sets, "reps": reps, "rest": rest, "images": 0, "media": 1,
        })
        jobs.append((os.path.join(DATASET, x["gif_url"]), os.path.join(DATASET, x["image"]), nid))
    lib.sort(key=lambda e: (e["muscle"], e["name"]))
    os.makedirs(os.path.join(MEDIA_OUT, "a"), exist_ok=True)
    os.makedirs(os.path.join(MEDIA_OUT, "t"), exist_ok=True)
    with ProcessPoolExecutor() as ex:
        done = sum(1 for _ in ex.map(convert, jobs, chunksize=16))
    print("medios:", done)

    head = ("/* Biblioteca de ejercicios precargada (1.324).\n"
            "   Datos: exercises-dataset de hasaneyldrm (MIT), nombres traducidos al español.\n"
            "   Animaciones: © Gym visual — https://gymvisual.com/ (con licencia), servidas en /media/ejercicios/a|t/<id>.webp\n"
            "   Generado con tools/exercises/build.py: no editar a mano. */\n\n")
    with open(os.path.join(ROOT, "src/store/exercises.js"), "w", encoding="utf-8") as f:
        f.write(head + "export const EXERCISE_LIBRARY = " + json.dumps(lib, ensure_ascii=False, separators=(",", ":")) + ";\n")
    with open(os.path.join(ROOT, "mobile/assets/data/exercises.json"), "w", encoding="utf-8") as f:
        json.dump(lib, f, ensure_ascii=False, separators=(",", ":"))
    ids = {e["id"] for e in lib}
    exmap = {}
    for old, ds in old2ds.items():
        nid = OFFSET + int(ds)
        if nid not in ids: sys.exit(f"mapa: {old} -> {ds} no existe")
        exmap[old] = nid
    with open(os.path.join(ROOT, "server/exmap.json"), "w") as f:
        json.dump(exmap, f, separators=(",", ":"))
    print("ejercicios:", len(lib), "· mapa:", len(exmap))


if __name__ == "__main__":
    main()
