import { C } from '../constants/colors';

export default function Placeholder() {
  return (
    <div style={{ textAlign: "center", paddingTop: 60, color: C.muted }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>🚧</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6, fontFamily: "Syne" }}>
        Sección en desarrollo
      </div>
      <div style={{ fontSize: 13 }}>Esta pantalla se construirá en la fase de desarrollo</div>
    </div>
  );
}
