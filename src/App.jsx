import { useCallback, useEffect, useMemo, useState } from "react";
import { AppCtx } from "./context";
import Shell from "./layout/Shell";
import { Toasts } from "./ui/kit";
import { brandOf, coachBySlug, coachCanWork, logout, startWorkout, useDB, userById } from "./store/db";
import { applyBrandColor } from "./lib/brand";

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
import CoachProfile from "./pages/coach/CoachProfile";
import ClientProfile from "./pages/client/ClientProfile";

/** Enlace de acceso con marca: …/#mendez-strength */
const readSlug = () => { try { return decodeURIComponent(window.location.hash.slice(1)).toLowerCase(); } catch { return ""; } };
function writeSlug(slug) {
  try { window.history.replaceState(null, "", slug ? `#${slug}` : window.location.pathname + window.location.search); } catch { /* sin historial */ }
}

export default function App() {
  const db = useDB();
  const me = db.sessionUserId ? userById(db, db.sessionUserId) : null;
  const [route, setRoute] = useState({ page: "inicio", params: {} });
  const [training, setTraining] = useState(false);
  const [slug, setSlug] = useState(readSlug);

  useEffect(() => {
    const on = () => setSlug(readSlug());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  // Color de marca: el del entrenador del usuario, o el del enlace de acceso
  const loginBrand = coachBySlug(db, slug);
  const brandColor = me ? brandOf(db, me)?.color : loginBrand?.brand?.color;
  useEffect(() => { applyBrandColor(brandColor || null); }, [brandColor]);

  // Al salir, se vuelve al acceso con la marca del entrenador
  const signOut = useCallback(() => {
    const b = brandOf(db, me);
    const next = b?.slug && (b.name || b.logo) ? b.slug : "";
    writeSlug(next); setSlug(next);
    logout();
  }, [db, me]);
  const chooseBrand = useCallback((next) => { writeSlug(next); setSlug(next); }, []);

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

  const ctx = useMemo(() => ({ me, page: route.page, params: route.params, go, openWorkout, signOut }), [me, route, go, openWorkout, signOut]);

  if (!me) return <><Login slug={slug} onBrand={chooseBrand} /><Toasts /></>;

  let view;
  const { page, params } = route;
  if (me.role === "admin") {
    view = page === "licencias" ? <Licenses /> : page === "entrenadores" ? <Coaches /> : <AdminHome />;
  } else if (me.role === "coach") {
    if (!coachCanWork(db, me.id)) view = <LicenseLock />;
    else if (page === "clientes" && params.id) view = <ClientDetail clientId={params.id} tab={params.tab} />;
    else view = {
      clientes: <Clients />, pagos: <Payments />, biblioteca: <Library />, perfil: <CoachProfile />,
      comunidad: <Community />, mensajes: <Messages />,
    }[page] || <CoachHome />;
  } else {
    view = {
      rutina: <MyRoutine />, progreso: <Progress />, pagos: <MyPayments />, perfil: <ClientProfile />,
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
