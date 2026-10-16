import { useRef, useState } from "react";
import Icon from "./Icon";
import { toast } from "./kit";

/** Botón + zona para soltar archivos de imagen. Llama onFiles(File[]). */
export function ImageDrop({ onFiles, multiple, label = "Elegir imagen", hint, compact }) {
  const input = useRef(null);
  const [drag, setDrag] = useState(false);
  const pick = (list) => {
    const files = [...(list || [])].filter((f) => f.type.startsWith("image/"));
    if (!files.length) return toast("Elige un archivo de imagen (JPG, PNG, HEIC convertido o SVG)", "alert");
    onFiles(multiple ? files : [files[0]]);
  };
  const field = (
    <input ref={input} type="file" accept="image/*" multiple={multiple} hidden
      onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
  );
  if (compact) {
    return (
      <>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => input.current?.click()}><Icon name="plus" size={15} />{label}</button>
        {field}
      </>
    );
  }
  return (
    <div
      className={`dropzone ${drag ? "drag" : ""}`}
      role="button" tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), input.current?.click())}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files); }}
    >
      <Icon name="plus" size={26} />
      <span className="strong" style={{ color: "var(--blue-ink)" }}>{label}</span>
      <span className="small">{hint || "o arrastra el archivo aquí"}</span>
      {field}
    </div>
  );
}

/** Lista editable de etiquetas (especialidades, certificaciones…). */
export function TagInput({ id, value = [], onChange, placeholder, max = 12 }) {
  const [text, setText] = useState("");
  function add(raw = text) {
    const next = [...value];
    raw.split(",").map((t) => t.trim()).filter(Boolean).forEach((t) => {
      if (next.length >= max) return toast(`Máximo ${max} elementos`, "alert");
      if (!next.some((v) => v.toLowerCase() === t.toLowerCase())) next.push(t.slice(0, 60));
    });
    if (next.length !== value.length) onChange(next);
    setText("");
  }
  return (
    <div className="tag-input" onClick={() => document.getElementById(id)?.focus()}>
      {value.map((v) => (
        <span key={v} className="tag">
          {v}
          <button type="button" onClick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== v)); }} aria-label={`Quitar ${v}`}>×</button>
        </span>
      ))}
      <input id={id} value={text} placeholder={value.length ? "" : placeholder}
        onChange={(e) => (e.target.value.includes(",") ? add(e.target.value) : setText(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); add(); }
          if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => add()} />
    </div>
  );
}
