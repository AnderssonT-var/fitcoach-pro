/* Reduce y comprime imágenes en el navegador antes de guardarlas.
   En producción se subirían a un almacenamiento de archivos; en el
   demo se guardan como data URL, por eso se achican. */

function loadImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith("image/")) return reject(new Error("El archivo no es una imagen."));
    if (file.size > 15 * 1024 * 1024) return reject(new Error("La imagen pesa más de 15 MB."));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen.")); };
    img.src = url;
  });
}

/**
 * @param {File} file
 * @param {{max?: number, square?: boolean, type?: string, quality?: number}} opts
 * @returns {Promise<string>} data URL
 */
export async function compressImage(file, { max = 720, square = false, type = "image/jpeg", quality = 0.8 } = {}) {
  if (file.type === "image/svg+xml" && type === "image/png") {
    // Los logos SVG se guardan tal cual (pesan poco y no pierden nitidez)
    if (file.size > 200 * 1024) throw new Error("El SVG pesa más de 200 KB.");
    return await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  }
  const img = await loadImage(file);
  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
  if (square) {
    const side = Math.min(sw, sh);
    sx = (sw - side) / 2; sy = (sh - side) / 2; sw = sh = side;
  }
  const scale = Math.min(1, max / Math.max(sw, sh));
  const w = Math.round(sw * scale), h = Math.round(sh * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (type === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  return canvas.toDataURL(type, quality);
}

export const avatarImage = (file) => compressImage(file, { max: 320, square: true, quality: 0.82 });
export const logoImage = (file) => compressImage(file, { max: 320, type: "image/png" });
export const progressImage = (file) => compressImage(file, { max: 900, quality: 0.78 });
