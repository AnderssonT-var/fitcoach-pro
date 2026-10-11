import { C } from '../../constants/colors';

export default function StatCard({ label, value, icon, color = C.accent }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
      padding: "16px 20px", flex: 1, minWidth: 120, position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, right: 0, width: 60, height: 60,
        background: color + "10", borderRadius: "0 0 0 60px",
      }} />
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: "Syne" }}>{value}</div>
      <div style={{ fontSize: 12, color: C.muted, fontFamily: "DM Sans" }}>{label}</div>
    </div>
  );
}
