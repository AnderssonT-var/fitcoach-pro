import { useCallback, useEffect, useMemo, useState } from "react";
import { AppCtx } from "./context";
import Shell from "./layout/Shell";
import { Toasts } from "./ui/kit";
import { coachCanWork, startWorkout, useDB, userById } from "./store/db";

import Login from "./pages/auth/Login";
import AdminHome from "./pages/admin/AdminHome";
import Licenses from "./pages/admin/Licenses";
import Coaches from "./pages/admin/Coaches";
import CoachHome from "./pages/coach/CoachHome";
import Clients from "./pages/coach/Clients";
import ClientDetail from "./pages/coach/ClientDetail";
import Payments from "./pages/coach/Payments";
import Library from "./pages/coach/Library";
import LicenseLock from "./pages/coach/LicenseLock";
import ClientHome from "./pages/client/ClientHome";
import MyRoutine from "./pages/client/MyRoutine";
import Progress from "./pages/client/Progress";
import MyPayments from "./pages/client/MyPayments";
import Community from "./pages/shared/Community";
import Messages from "./pages/shared/Messages";
import WorkoutSession from "./workout/WorkoutSession";

export default function App() {
  const db = useDB();
  const me = db.sessionUserId ? userById(db, db.sessionUserId) : null;
  const [route, setRoute] = useState({ page: "inicio", params: {} });
  const [training, setTraining] = useState(false);

  const go = useCallback((page, params = {}) => {
    setRoute({ page, params });
    document.getElementById("content")?.scrollTo({ top: 0 });
  }, []);

  // Al cambiar de usuario, volver al inicio
  useEffect(() => { setRoute({ page: "inicio", params: {} }); setTraining(false); }, [me?.id]);

  // Si el cliente tiene un entrenamiento a medias, se puede retomar
  const openWorkout = useCallback((dayId) => {
    if (!me) return;
    startWorkout(me.id, dayId);
    setTraining(true);
  }, [me]);

  const ctx = useMemo(() => ({ me, page: route.page, params: route.params, go, openWorkout }), [me, route, go, openWorkout]);

  if (!me) return <><Login /><Toasts /></>;

  let view;
  const { page, params } = route;
  if (me.role === "admin") {
    view = page === "licencias" ? <Licenses /> : page === "entrenadores" ? <Coaches /> : <AdminHome />;
  } else if (me.role === "coach") {
    if (!coachCanWork(db, me.id)) view = <LicenseLock />;
    else if (page === "clientes" && params.id) view = <ClientDetail clientId={params.id} tab={params.tab} />;
    else view = {
      clientes: <Clients />, pagos: <Payments />, biblioteca: <Library />,
      comunidad: <Community />, mensajes: <Messages />,
    }[page] || <CoachHome />;
  } else {
    view = {
      rutina: <MyRoutine />, progreso: <Progress />, pagos: <MyPayments />,
      comunidad: <Community />, mensajes: <Messages />,
    }[page] || <ClientHome />;
  }

  return (
    <AppCtx.Provider value={ctx}>
      <Shell>{view}</Shell>
      {training && me.role === "client" && (
        <WorkoutSession clientId={me.id} onClose={() => setTraining(false)} />
      )}
      <Toasts />
    </AppCtx.Provider>
  );
}
