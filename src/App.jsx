import { useState } from "react";
import { C } from './constants/colors';
import { gfont } from './constants/fonts';
import { initClients } from './constants/data';
import Sidebar from './components/layout/Sidebar';
import CoachClients from './components/clients/CoachClients';
import PaymentModule from './components/payments/PaymentModule';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminLicencias from './pages/admin/AdminLicencias';
import CoachDashboard from './pages/coach/CoachDashboard';
import ClientDashboard from './pages/user/ClientDashboard';
import Placeholder from './pages/Placeholder';
import Login from './pages/Login';

export default function App() {
  const [session, setSession] = useState(null); // { role, name, email, page }
  const [role, setRole] = useState("coach");
  const [page, setPage] = useState("clientes");

  function handleLogin(sess) {
    setSession(sess);
    setRole(sess.role);
    setPage(sess.page);
  }

  function handleLogout() {
    setSession(null);
    setRole("coach");
    setPage("clientes");
  }

  function changeRole(r) {
    setRole(r);
    setPage("dashboard");
  }

  function renderPage() {
    if (role === "admin") {
      if (page === "dashboard") return <AdminDashboard />;
      if (page === "licencias") return <AdminLicencias />;
      return <Placeholder />;
    }
    if (role === "coach") {
      if (page === "dashboard") return <CoachDashboard />;
      if (page === "clientes")  return <CoachClients />;
      if (page === "pagos")     return <PaymentModule initialClients={initClients} />;
      return <Placeholder />;
    }
    if (role === "user") {
      if (page === "dashboard") return <ClientDashboard />;
      return <Placeholder />;
    }
  }

  return (
    <>
      <style>{`
        ${gfont}
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.bg}; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${C.surface}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
        button:hover { opacity: .85; }
        input:focus, select:focus { border-color: ${C.accent} !important; }
        select option { background: ${C.card}; }
      `}</style>

      {!session ? (
        <Login onLogin={handleLogin} />
      ) : (
        <div style={{ display: "flex", height: "100vh", background: C.bg, overflow: "hidden" }}>
          <Sidebar role={role} active={page} onNav={setPage} onRoleChange={changeRole} onLogout={handleLogout} />
          <main style={{ flex: 1, overflowY: "auto", padding: "30px 34px" }}>
            {renderPage()}
          </main>
        </div>
      )}
    </>
  );
}
