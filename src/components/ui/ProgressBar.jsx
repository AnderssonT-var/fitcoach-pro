import { C } from '../../constants/colors';

export default function ProgressBar({ value, color = C.accent }) {
  return (
    <div style={{ background: C.border, borderRadius: 99, height: 5 }}>
      <div style={{ width: `${value}%`, background: color, height: "100%", borderRadius: 99 }} />
    </div>
  );
}
