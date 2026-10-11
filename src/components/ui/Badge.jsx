import { C } from '../../constants/colors';

export default function Badge({ children, color = C.accent }) {
  return (
    <span style={{
      background: color + "20", color, border: `1px solid ${color}40`,
      borderRadius: 6, padding: "2px 9px", fontSize: 11, fontWeight: 600,
      fontFamily: "DM Sans", letterSpacing: 0.4, textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}
