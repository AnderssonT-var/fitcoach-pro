import { C } from '../../constants/colors';

const VARIANTS = {
  primary: { background: C.accent,       color: C.bg,    border: "none" },
  ghost:   { background: "transparent",  color: C.accent, border: `1px solid ${C.accent}40` },
  danger:  { background: C.redDim,       color: C.red,   border: `1px solid ${C.red}40` },
  subtle:  { background: C.card,         color: C.text,  border: `1px solid ${C.border}` },
  warn:    { background: C.warnDim,      color: C.warn,  border: `1px solid ${C.warn}40` },
  green:   { background: C.greenDim,     color: C.green, border: `1px solid ${C.green}40` },
};

const SIZES = {
  sm: { padding: "5px 12px",  fontSize: 12 },
  md: { padding: "9px 18px",  fontSize: 13 },
  lg: { padding: "13px 26px", fontSize: 15 },
};

export default function Btn({ children, onClick, variant = "primary", size = "md", full, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...VARIANTS[variant],
        ...SIZES[size],
        borderRadius: 9,
        fontWeight: 600,
        fontFamily: "DM Sans",
        cursor: disabled ? "not-allowed" : "pointer",
        width: full ? "100%" : "auto",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
