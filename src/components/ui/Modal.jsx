import { C } from '../../constants/colors';

export default function Modal({ title, children, onClose, wide }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "#000C", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20,
          padding: 28, width: "100%", maxWidth: wide ? 780 : 500,
          maxHeight: "88vh", overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontFamily: "Syne", color: C.text, fontSize: 17 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 20 }}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
