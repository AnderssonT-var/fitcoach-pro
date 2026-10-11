import { C } from '../../constants/colors';

export default function Pill({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: active ? C.accent : C.card,
      color: active ? C.bg : C.muted,
      border: `1px solid ${active ? C.accent : C.border}`,
      borderRadius: 20, padding: "5px 14px",
      fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "DM Sans",
    }}>
      {children}
    </button>
  );
}
