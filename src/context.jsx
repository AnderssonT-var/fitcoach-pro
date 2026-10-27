import { createContext, useContext } from "react";

/** Contexto de navegación y usuario actual. */
export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export const NAV = {
  admin: [
    { id: "inicio", icon: "home", label: "Resumen" },
    { id: "cobros", icon: "wallet", label: "Cobros", badge: "pendingSubs" },
    { id: "licencias", icon: "key", label: "Licencias" },
    { id: "entrenadores", icon: "users", label: "Entrenadores" },
    { id: "sistema", icon: "activity", label: "Sistema" },
    { id: "cuenta", icon: "user", label: "Mi cuenta" },
  ],
  coach: [
    { id: "inicio", icon: "home", label: "Inicio" },
    { id: "clientes", icon: "users", label: "Clientes" },
    { id: "pagos", icon: "wallet", label: "Pagos" },
    { id: "mensajes", icon: "chat", label: "Mensajes", badge: "unread" },
    { id: "comunidad", icon: "community", label: "Comunidad" },
    { id: "biblioteca", icon: "book", label: "Biblioteca" },
    { id: "perfil", icon: "user", label: "Perfil y marca" },
    { id: "suscripcion", icon: "key", label: "Suscripción" },
  ],
  client: [
    { id: "inicio", icon: "home", label: "Inicio" },
    { id: "rutina", icon: "dumbbell", label: "Mi rutina" },
    { id: "progreso", icon: "chart", label: "Progreso" },
    { id: "mensajes", icon: "chat", label: "Entrenador", badge: "unread" },
    { id: "comunidad", icon: "community", label: "Comunidad" },
    { id: "pagos", icon: "wallet", label: "Pagos" },
    { id: "perfil", icon: "user", label: "Mi perfil" },
  ],
};

export const ROLE_LABEL = { admin: "Administrador", coach: "Entrenador", client: "Cliente" };
