/* Hilo de trabajo para contraseñas (ver pwpool.js). */
const { parentPort } = require("node:worker_threads");
const bcrypt = require("bcryptjs");
parentPort.on("message", async ({ id, op, a, b, cost }) => {
  try {
    const r = op === "hash" ? await bcrypt.hash(a, cost) : await bcrypt.compare(a, b);
    parentPort.postMessage({ id, r });
  } catch (e) { parentPort.postMessage({ id, e: String((e && e.message) || e) }); }
});
