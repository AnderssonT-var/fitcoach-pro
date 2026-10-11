import { C } from '../../constants/colors';

export default function Select({ label, children, value, onChange }) {
  return (
    <div style={{ marginBottom: 13 }}>
      {label && (
        <label style={{
          display: "block", fontSize: 11, color: C.muted, marginBottom: 5,
          fontFamily: "DM Sans", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase",
        }}>
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={onChange}
        style={{
          width: "100%", background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 9, padding: "10px 13px", color: C.text,
          fontSize: 13, fontFamily: "DM Sans", outline: "none",
        }}
      >
        {children}
      </select>
    </div>
  );
}
