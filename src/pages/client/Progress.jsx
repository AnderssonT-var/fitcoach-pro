import { useState } from "react";
import Icon from "../../ui/Icon";
import { Stat } from "../../ui/kit";
import SessionList from "../../workout/SessionList";
import { AdherenceChart, Records, VolumeChart, WeightChart, quickStats } from "../../workout/ProgressWidgets";
import { WeightModal } from "../coach/ClientDetail";
import { Measurements, Photos } from "../coach/Tracking";
import { MuscleLoadPanel } from "../../workout/MuscleLoad";
import { useApp } from "../../context";
import { useDB, weekStreak, workoutsOf } from "../../store/db";

export default function Progress() {
  const db = useDB();
  const { me } = useApp();
  const [weight, setWeight] = useState(false);
  const s = quickStats(db, me.id);
  const streak = weekStreak(db, me.id, s.goal);
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Tu progreso</h1><p>Todo sale de lo que registras al entrenar. Tu entrenador ve lo mismo.</p></div>
        <button className="btn btn-quiet" onClick={() => setWeight(true)}><Icon name="scale" size={18} />Registrar peso</button>
      </div>
      <div className="stats">
        <Stat label="Entrenamientos" value={s.total} sub={`${s.month} este mes`} icon="dumbbell" />
        <Stat label="Esta semana" value={`${s.week}/${s.goal}`} tone={s.week >= s.goal ? "ok" : ""} sub="de tu meta" icon="calendar" />
        <Stat label="Racha" value={streak} sub={streak === 1 ? "semana cumpliendo" : "semanas cumpliendo"} icon="flame" />
        <Stat label="Volumen del mes" value={s.tonsLabel} sub={`${s.avgMin} min por sesión`} icon="trend" />
      </div>
      <MuscleLoadPanel clientId={me.id} />
      <div className="grid-2">
        <VolumeChart clientId={me.id} />
        <WeightChart clientId={me.id} />
      </div>
      <div className="grid-2">
        <Records clientId={me.id} />
        <AdherenceChart clientId={me.id} />
      </div>
      <Measurements clientId={me.id} />
      <Photos clientId={me.id} canUpload />
      <section className="panel">
        <div className="panel-head"><h2>Historial</h2><span className="small muted">Toca una sesión para ver cada serie</span></div>
        <SessionList sessions={workoutsOf(db, me.id)} />
      </section>
      {weight && <WeightModal clientId={me.id} onClose={() => setWeight(false)} />}
    </div>
  );
}
