/* Política de privacidad y términos de uso.
   El responsable y el correo de contacto los define el administrador. */
import { useEffect, useState } from "react";
import Icon from "../../ui/Icon";
import { fetchInfo } from "../../store/db";
import { DevCredit } from "../../ui/kit";

export const LEGAL_UPDATED = "octubre de 2026";

export function useLegalInfo() {
  const [info, setInfo] = useState({ company: "VYTRAFIT", contactEmail: "", city: "Ecuador" });
  useEffect(() => { fetchInfo().then((r) => { if (!r.error) setInfo(r); }); }, []);
  return info;
}

const contact = (info) => info.contactEmail
  ? <a href={`mailto:${info.contactEmail}`}>{info.contactEmail}</a>
  : "el correo de soporte que te indique tu entrenador";

/** Resumen corto sobre fotos e información sensible (se muestra en el aviso de consentimiento). */
export function SensitiveSummary() {
  return (
    <ul className="legal-points">
      <li><Icon name="lock" size={18} /><span><strong>Solo tú y tu entrenador</strong> ven tus medidas, lesiones, entrenamientos y fotos. El administrador de la plataforma no los ve.</span></li>
      <li><Icon name="camera" size={18} /><span><strong>Las fotos de tu cuerpo son información sensible.</strong> Se guardan de forma privada, nunca se publican en la comunidad ni se comparten con terceros ni se usan para publicidad.</span></li>
      <li><Icon name="key" size={18} /><span>Las fotos solo se abren con enlaces temporales que vencen en pocas horas; tu contraseña se guarda cifrada.</span></li>
      <li><Icon name="trash" size={18} /><span>Puedes retirar el permiso de fotos, descargar tus datos o eliminar tu cuenta cuando quieras desde «Mi perfil».</span></li>
    </ul>
  );
}

export function PrivacyText({ info }) {
  return (
    <div className="legal-text">
      <p className="small muted">Última actualización: {LEGAL_UPDATED}</p>
      <h2>1. Quién es responsable</h2>
      <p>{info.company}{info.city ? ` (${info.city})` : ""} administra la plataforma VYTRAFIT. Cada entrenador que usa la plataforma decide qué datos registra de sus asesorados y responde por su uso dentro de la asesoría. Para cualquier pregunta sobre tus datos escribe a {contact(info)}.</p>

      <h2>2. Qué datos tratamos</h2>
      <ul>
        <li><strong>Cuenta:</strong> nombre, correo y contraseña (guardada cifrada, nadie puede leerla).</li>
        <li><strong>Perfil:</strong> foto de perfil, teléfono, presentación, año de nacimiento.</li>
        <li><strong>Datos de salud y físicos:</strong> peso, medidas corporales, porcentaje de grasa, lesiones o molestias que reportes.</li>
        <li><strong>Fotos de progreso:</strong> imágenes de tu cuerpo que subes tú o tu entrenador.</li>
        <li><strong>Actividad:</strong> rutinas, entrenamientos registrados, mensajes con tu entrenador, publicaciones en la comunidad y pagos de tu mensualidad.</li>
        <li><strong>Notificaciones:</strong> si las activas, un identificador de tu navegador o teléfono para enviarte avisos, y la hora y días de tu recordatorio. Puedes desactivarlas cuando quieras.</li>
        <li><strong>Registro técnico de errores:</strong> si la app falla, el mensaje del error y el tipo de navegador, para poder corregirlo.</li>
      </ul>

      <h2>3. Datos sensibles e imágenes de tu cuerpo</h2>
      <p>Tus datos de salud y las fotos de tu cuerpo son <strong>datos sensibles</strong> según la Ley Orgánica de Protección de Datos Personales del Ecuador. Por eso:</p>
      <ul>
        <li>Solo se registran si aceptas este aviso. Las fotos requieren además un <strong>permiso aparte</strong> que puedes dar o retirar cuando quieras desde «Mi perfil».</li>
        <li>Solo las ven <strong>tú y tu entrenador</strong>. No aparecen en la comunidad, no son públicas y no se comparten con terceros ni se usan para publicidad o para entrenar sistemas de inteligencia artificial.</li>
        <li>Se guardan en un almacenamiento privado del servidor y solo se abren con <strong>enlaces temporales</strong> que vencen en pocas horas.</li>
        <li>Si retiras el permiso, tu entrenador ya no podrá subir fotos nuevas; puedes pedirle que borre las existentes o borrarlas tú.</li>
      </ul>

      <h2>4. Para qué los usamos</h2>
      <p>Únicamente para prestar el servicio de entrenamiento: que tu entrenador arme tu rutina, siga tu progreso, se comunique contigo y registre tus pagos. No vendemos tus datos.</p>

      <h2>5. Quién puede verlos</h2>
      <ul>
        <li><strong>Tu entrenador:</strong> todo lo de tu asesoría.</li>
        <li><strong>Tu grupo:</strong> solo lo que tú publiques en la comunidad, tu nombre y tu foto de perfil.</li>
        <li><strong>El administrador:</strong> tu nombre y correo para dar soporte. No ve tus medidas, lesiones, entrenamientos ni fotos.</li>
        <li><strong>Proveedores:</strong> el servicio de alojamiento donde funciona el servidor, que no puede usar los datos para otros fines.</li>
      </ul>

      <h2>6. Cómo los protegemos</h2>
      <p>Conexión cifrada (HTTPS), contraseñas cifradas, bloqueo temporal tras varios intentos fallidos, sesiones que vencen y se pueden cerrar en todos los dispositivos, permisos revisados en el servidor en cada acción y fotos fuera del acceso público. Para que puedas entrenar sin señal, tu teléfono guarda una copia de tus datos y del entrenamiento en curso; esa copia se borra al cerrar sesión.</p>

      <h2>7. Cuánto tiempo</h2>
      <p>Mientras tu cuenta exista. Si eliminas tu cuenta, o tu entrenador te elimina, se borran tus datos, entrenamientos, mensajes y fotos. Los registros de pago pueden conservarse lo que exija la ley tributaria.</p>

      <h2>8. Tus derechos</h2>
      <p>Puedes acceder a tus datos y <strong>descargarlos</strong>, corregirlos, <strong>eliminarlos</strong>, oponerte a su tratamiento, pedir su portabilidad y <strong>retirar tu consentimiento</strong> en cualquier momento. Desde «Mi perfil» puedes descargar tus datos y eliminar tu cuenta. Para lo demás escribe a {contact(info)}. Si consideras que no atendimos tu pedido, puedes acudir a la Autoridad de Protección de Datos Personales del Ecuador.</p>

      <h2>9. Menores de edad</h2>
      <p>Si tienes menos de 18 años necesitas la autorización de tu madre, padre o representante para usar la plataforma.</p>

      <h2>10. Cambios</h2>
      <p>Si cambiamos este aviso te lo mostraremos al entrar para que lo aceptes de nuevo.</p>
    </div>
  );
}

export function TermsText({ info }) {
  return (
    <div className="legal-text">
      <p className="small muted">Última actualización: {LEGAL_UPDATED}</p>
      <h2>1. El servicio</h2>
      <p>VYTRAFIT es una plataforma para que entrenadores gestionen a sus asesorados: rutinas, entrenamientos, seguimiento, mensajes y pagos. La administra {info.company}.</p>
      <h2>2. Cuentas</h2>
      <p>Cada persona usa su propia cuenta y es responsable de mantener su contraseña en secreto. Los entrenadores crean las cuentas de sus asesorados, que deben cambiar la contraseña temporal al primer ingreso.</p>
      <h2>3. Licencias y pagos de entrenadores</h2>
      <p>El entrenador usa la plataforma con una licencia por periodo (1, 3, 6 o 12 meses) al precio vigente que fija el administrador. La licencia se activa con un código o cuando el administrador aprueba el pago enviado. Al vencer, el entrenador no puede seguir trabajando y sus asesorados pierden el acceso hasta que renueve; sus datos se conservan.</p>
      <h2>4. Responsabilidades del entrenador</h2>
      <p>El entrenador se compromete a registrar solo los datos necesarios de sus asesorados, a subir fotos únicamente con su permiso, a no compartirlas fuera de la plataforma y a atender los pedidos de sus asesorados sobre sus datos.</p>
      <h2>5. Salud</h2>
      <p>Las rutinas y recomendaciones no reemplazan la evaluación de un médico. Consulta a un profesional de salud antes de empezar un programa de ejercicio, sobre todo si tienes lesiones o condiciones médicas.</p>
      <h2>6. Uso aceptable</h2>
      <p>No está permitido publicar contenido ofensivo, intentar acceder a cuentas o datos de otras personas, ni usar la plataforma para fines ilegales. El administrador puede suspender cuentas que incumplan estas reglas.</p>
      <h2>7. Privacidad</h2>
      <p>El tratamiento de datos personales se rige por la <a href="#privacidad">política de privacidad</a>.</p>
      <h2>8. Contacto</h2>
      <p>Escribe a {contact(info)}.</p>
    </div>
  );
}

export function LegalPage({ kind, onBack }) {
  const info = useLegalInfo();
  return (
    <div className="auth legal-page">
      <div className="auth-card" style={{ maxWidth: 760 }}>
        <button type="button" className="link-btn row gap-xs" onClick={onBack} style={{ alignSelf: "flex-start" }}><Icon name="left" size={18} />Volver</button>
        <h1 style={{ fontSize: 34 }}>{kind === "privacidad" ? "Política de privacidad" : "Términos de uso"}</h1>
        {kind === "privacidad" ? <PrivacyText info={info} /> : <TermsText info={info} />}
        <DevCredit />
      </div>
    </div>
  );
}
