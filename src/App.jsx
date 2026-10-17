import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppCtx } from "./context";
import Shell from "./layout/Shell";
import { Toasts } from "./ui/kit";
import { brandOf, coachCanWork, fetchBrand, logout, startWorkout, useDB, userById } from "./store/db";
import { isNative, needsServer } from "./store/api";
import { applyBrandColor } from "./lib/brand";

import Login from "./pages/auth/Login";
import { BlockedScreen, ChangePasswordScreen, ConsentScreen, OfflineScreen, ServerSetup, Splash } from "./pages/auth/Gates";
import { LegalPage } from "./pages/legal/Legal";
import AdminHome from "./pages/admin/AdminHome";
import Licenses from "./pages/admin/Licenses";
import Coaches from "./pages/admin/Coaches";
import Billing from "./pages/admin/Billing";
import CoachHome from "./pages/coach/CoachHome";
import Clients from "./pages/coach/Clients";
import ClientDetail from "./pages/coach/ClientDetail";
import Payments from "./pages/coach/Payments";
import Library from "./pages/coach/Library";
import LicenseLock from "./pages/coach/LicenseLock";
import Subscription from "./pages/coach/Subscription";
import ClientHome from "./pages/client/ClientHome";
import MyRoutine from "./pages/client/MyRoutine";
import Progress from "./pages/client/Progress";
import MyPayments from "./pages/client/MyPayments";
import Community from "./pages/shared/Community";
import Messages from "./pages/shared/Messages";
import WorkoutSession from "./workout/WorkoutSession";
import CoachProfile from "./pages/coach/CoachProfile";
import ClientProfile from "./pages/client/ClientProfile";

/** Enlace de acceso con marca: …/#mendez-strength · páginas legales: #privacidad, #terminos */
const readHash = () => { try { return decodeURIComponent(window.location.hash.slice(1)).toLowerCase(); } catch { return ""; } };
function writeHash(v) {
  try { window.history.replaceState(null, "", v ? `#${v}` : window.location.pathname + window.location.search); } catch { /* sin historial */ }
}
const LEGAL = ["privacidad", "terminos"];

export default function App() {
  const db = useDB();
  const me = db.status === "ready" ? userById(db, db.sessionUserId) : null;
  const [route, setRoute] = useState({ page: "inicio", params: {} });
  const [training, setTraining] = useState(false);
  const [hash, setHash] = useState(readHash);
  const [legalBack, setLegalBack] = useState("");
  const slug = LEGAL.includes(hash) ? legalBack : hash;
  const [loginBrand, setLoginBrand] = useState({ slug: "", data: null, loading: false });

  useEffect(() => {
    const on = () => setHash(readHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  // Marca del enlace de acceso (se consulta al servidor)
  useEffect(() => {
    if (me || !slug) { setLoginBrand({ slug: "", data: null, loading: false }); return; }
    let live = true;
    setLoginBrand({ slug, data: null, loading: true });
    fetchBrand(slug).then((data) => { if (live) setLoginBrand({ slug, data, loading: false }); });
    return () => { live = false; };
  }, [slug, me?.id]);

  const brandColor = me ? brandOf(db, me)?.color : loginBrand.data?.color;
  useEffect(() => { applyBrandColor(brandColor || null); }, [brandColor]);

  // Al salir, se vuelve al acceso con la marca del entrenador
  const signOut = useCallback(() => {
    const b = brandOf(db, me);
    const next = b?.slug && (b.name || b.logo) ? b.slug : "";
    writeHash(next); setHash(next);
    logout();
  }, [db, me]);
  const chooseBrand = useCallback((next) => { writeHash(next); setHash(next); }, []);
  const openLegal = useCallback((kind) => { setLegalBack(slug); writeHash(kind); setHash(kind); }, [slug]);
  const closeLegal = useCallback(() => { writeHash(legalBack); setHash(legalBack); }, [legalBack]);

  const go = useCallback((page, params = {}) => {
    setRoute({ page, params });
    document.getElementById("content")?.scrollTo({ top: 0 });
  }, []);

  useEffect(() => { setRoute({ page: "inicio", params: {} }); setTraining(false); }, [me?.id]);

  const openWorkout = useCallback((dayId) => {
    if (!me) return;
    startWorkout(me.id, dayId);
    setTraining(true);
  }, [me]);

  // Botón «atrás» de Android: cierra ventanas, vuelve al inicio o minimiza la app
  const routeRef = useRef(route);
  routeRef.current = route;
  useEffect(() => {
    if (!isNative()) return;
    let handle;
    import("@capacitor/app").then(({ App: Cap }) => {
      handle = Cap.addListener("backButton", () => {
        if (document.querySelector(".modal, .lightbox")) {
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        } else if (document.querySelector(".workout")) {
          document.querySelector('.workout-head [aria-label="Salir del entrenamiento"], .workout-head [aria-label="Volver al entrenamiento"]')?.click();
        } else if (routeRef.current.page !== "inicio" || routeRef.current.params?.id) {
          go(routeRef.current.params?.id ? routeRef.current.page : "inicio");
        } else Cap.minimizeApp();
      });
    });
    return () => { handle?.then?.((h) => h.remove()); };
  }, [go]);

  const ctx = useMemo(() => ({ me, page: route.page, params: route.params, go, openWorkout, signOut, openLegal }), [me, route, go, openWorkout, signOut, openLegal]);

  const bare = (node) => <AppCtx.Provider value={ctx}>{node}<Toasts /></AppCtx.Provider>;

  if (LEGAL.includes(hash)) return bare(<LegalPage kind={hash} onBack={closeLegal} />);
  if (needsServer()) return bare(<ServerSetup />);
  if (db.status === "boot") return bare(<Splash />);
  if (db.status === "offline") return bare(<OfflineScreen message={db.error} />);
  if (!me) return bare(<Login slug={slug} brand={loginBrand} onBrand={chooseBrand} />);

  // Pasos obligatorios antes de usar la app
  if (me.mustChangePassword) return bare(<ChangePasswordScreen forced />);
  if (me.role !== "admin" && !me.consentCurrent) return bare(<ConsentScreen />);
  if (me.role === "client" && db.access && !db.access.ok) return bare(<BlockedScreen message={db.access.message} />);

  let view;
  const { page, params } = route;
  if (me.role === "admin") {
    view = { licencias: <Licenses />, entrenadores: <Coaches />, cobros: <Billing /> }[page] || <AdminHome />;
  } else if (me.role === "coach") {
    if (page === "perfil") view = <CoachProfile />;
    else if (page === "suscripcion") view = <Subscription />;
    else if (!coachCanWork(db, me.id)) view = <LicenseLock />;
    else if (page === "clientes" && params.id) view = <ClientDetail clientId={params.id} tab={params.tab} />;
    else view = {
      clientes: <Clients />, pagos: <Payments />, biblioteca: <Library />,
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
