-- ============================================================
--  FitCoachPro — Esquema completo de base de datos
--  Motor:   MySQL 8.0+ (XAMPP / phpMyAdmin)
--  Charset: utf8mb4 (soporte completo de emojis y tildes)
--
--  REGLAS DE NEGOCIO clave:
--    · El ADMIN crea/gestiona entrenadores y licencias.
--    · El ENTRENADOR crea y gestiona sus propios clientes.
--    · El CLIENTE no puede auto-registrarse.
--    · El ADMIN puede ver y editar cualquier usuario
--      filtrando por entrenador desde su panel.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
DROP DATABASE IF EXISTS fitcoachpro;
CREATE DATABASE fitcoachpro
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE fitcoachpro;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 1. ROLES
-- ============================================================
CREATE TABLE roles (
  id         TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(30)      NOT NULL UNIQUE,   -- 'admin' | 'coach' | 'client'
  label      VARCHAR(60)      NOT NULL,
  created_at TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

INSERT INTO roles (name, label) VALUES
  ('admin',  'Administrador'),
  ('coach',  'Entrenador'),
  ('client', 'Cliente');

-- ============================================================
-- 2. USUARIOS  (tabla unificada — admin, entrenadores y clientes)
--    · created_by = NULL  → admin o seed inicial
--    · created_by = coach_id → cliente creado por un entrenador
-- ============================================================
CREATE TABLE users (
  id            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  role_id       TINYINT UNSIGNED NOT NULL,
  email         VARCHAR(180)     NOT NULL UNIQUE,
  password_hash VARCHAR(255)     NOT NULL,          -- bcrypt / argon2id
  first_name    VARCHAR(80)      NOT NULL,
  last_name     VARCHAR(80)      NOT NULL,
  phone         VARCHAR(25)      DEFAULT NULL,
  avatar_url    VARCHAR(512)     DEFAULT NULL,
  is_active     BOOLEAN          NOT NULL DEFAULT TRUE,
  created_by    INT UNSIGNED     DEFAULT NULL,       -- NULL = admin/sistema
  last_login_at TIMESTAMP        DEFAULT NULL,
  created_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                           ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_users_role       (role_id),
  INDEX idx_users_created_by (created_by),
  INDEX idx_users_active     (is_active),
  CONSTRAINT fk_users_role    FOREIGN KEY (role_id)
    REFERENCES roles(id),
  CONSTRAINT fk_users_creator FOREIGN KEY (created_by)
    REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- 3. LICENCIAS  (admin genera → asigna a un entrenador)
-- ============================================================
CREATE TABLE licenses (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  coach_id     INT UNSIGNED  NOT NULL UNIQUE,      -- 1 licencia activa por coach
  code         VARCHAR(30)   NOT NULL UNIQUE,       -- 'FIT-X7K2-2026'
  issued_at    DATE          NOT NULL,
  expires_at   DATE          NOT NULL,
  plan_months  TINYINT       NOT NULL DEFAULT 1,
  status       ENUM('active','expired','revoked') NOT NULL DEFAULT 'active',
  issued_by    INT UNSIGNED  NOT NULL,              -- admin que la generó
  revoked_at   TIMESTAMP     DEFAULT NULL,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                       ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_licenses_status (status),
  INDEX idx_licenses_expires (expires_at),
  CONSTRAINT fk_licenses_coach     FOREIGN KEY (coach_id)  REFERENCES users(id),
  CONSTRAINT fk_licenses_issued_by FOREIGN KEY (issued_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- ============================================================
-- 4. PERFIL EXTENDIDO DEL ENTRENADOR
-- ============================================================
CREATE TABLE coach_profiles (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED NOT NULL UNIQUE,
  bio            TEXT         DEFAULT NULL,
  specialty      VARCHAR(200) DEFAULT NULL,        -- 'Hipertrofia, Powerlifting…'
  certifications TEXT         DEFAULT NULL,
  experience_yrs TINYINT      DEFAULT NULL,
  max_clients    SMALLINT     NOT NULL DEFAULT 50,
  location       VARCHAR(120) DEFAULT NULL,
  website_url    VARCHAR(255) DEFAULT NULL,
  instagram      VARCHAR(80)  DEFAULT NULL,
  services       TEXT         DEFAULT NULL       COMMENT 'Lo que incluye su plan (lista)',
  -- Marca propia: cada entrenador tiene su login con logo, nombre y color
  brand_name     VARCHAR(80)  DEFAULT NULL       COMMENT 'Nombre comercial, p. ej. Méndez Strength',
  brand_slug     VARCHAR(40)  DEFAULT NULL       COMMENT 'Enlace de acceso: …/#mendez-strength',
  brand_color    CHAR(7)      DEFAULT NULL       COMMENT '#RRGGBB',
  brand_logo_url VARCHAR(512) DEFAULT NULL,
  brand_tagline  VARCHAR(120) DEFAULT NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_coach_brand_slug (brand_slug),
  CONSTRAINT fk_coach_profiles_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 5. PERFIL EXTENDIDO DEL CLIENTE
--    Creado exclusivamente por un entrenador (coach_id).
-- ============================================================
CREATE TABLE client_profiles (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED NOT NULL UNIQUE,
  coach_id       INT UNSIGNED NOT NULL,             -- entrenador dueño
  goal           VARCHAR(100) DEFAULT NULL,          -- 'Hipertrofia', 'Fuerza', etc.
  weight_kg      DECIMAL(5,2) DEFAULT NULL,
  height_cm      SMALLINT     DEFAULT NULL,
  birth_date     DATE         DEFAULT NULL,
  gender         ENUM('M','F','otro') DEFAULT NULL,
  bio            TEXT         DEFAULT NULL,          -- "Sobre mí" escrito por el cliente
  health_notes   TEXT         DEFAULT NULL,          -- lesiones, restricciones
  streak_days    SMALLINT     NOT NULL DEFAULT 0,
  progress_pct   TINYINT      NOT NULL DEFAULT 0     COMMENT '0-100',
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_client_coach  (coach_id),
  INDEX idx_client_active (is_active),
  CONSTRAINT fk_client_profiles_user  FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_client_profiles_coach FOREIGN KEY (coach_id)
    REFERENCES users(id)
) ENGINE=InnoDB;

-- ============================================================
-- 6. GRUPOS MUSCULARES
-- ============================================================
CREATE TABLE muscle_groups (
  id   SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(60)       NOT NULL UNIQUE,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

INSERT INTO muscle_groups (name) VALUES
  ('Pecho'),
  ('Espalda'),
  ('Hombros'),
  ('Bíceps'),
  ('Tríceps'),
  ('Piernas'),
  ('Glúteos'),
  ('Core / Abdomen'),
  ('Cardio'),
  ('Cuerpo completo');

-- ============================================================
-- 7. TIPOS DE EQUIPAMIENTO
-- ============================================================
CREATE TABLE equipment_types (
  id   SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(60)       NOT NULL UNIQUE,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

INSERT INTO equipment_types (name) VALUES
  ('Barra'),
  ('Mancuernas'),
  ('Polea'),
  ('Máquina guiada'),
  ('Peso corporal'),
  ('Barra fija'),
  ('Paralelas'),
  ('TRX / Suspensión'),
  ('Kettlebell'),
  ('Banda elástica'),
  ('Caminadora'),
  ('Bicicleta estática'),
  ('Sin equipo');

-- ============================================================
-- 8. CATÁLOGO DE EJERCICIOS
--    is_global = TRUE  → visible para todos los entrenadores
--    is_global = FALSE → ejercicio personalizado de un coach
-- ============================================================
CREATE TABLE exercises (
  id                INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  name              VARCHAR(120)      NOT NULL,
  muscle_group_id   SMALLINT UNSIGNED NOT NULL,
  secondary_muscles VARCHAR(200)      DEFAULT NULL,
  equipment_id      SMALLINT UNSIGNED DEFAULT NULL,
  description       TEXT              DEFAULT NULL,
  video_url         VARCHAR(512)      DEFAULT NULL,
  image_url         VARCHAR(512)      DEFAULT NULL,
  difficulty        ENUM('principiante','intermedio','avanzado')
                                      NOT NULL DEFAULT 'intermedio',
  is_global         BOOLEAN           NOT NULL DEFAULT TRUE,
  created_by        INT UNSIGNED      DEFAULT NULL,  -- NULL = sistema
  is_active         BOOLEAN           NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_exercises_muscle  (muscle_group_id),
  INDEX idx_exercises_global  (is_global),
  CONSTRAINT fk_exercises_muscle  FOREIGN KEY (muscle_group_id)
    REFERENCES muscle_groups(id),
  CONSTRAINT fk_exercises_equip   FOREIGN KEY (equipment_id)
    REFERENCES equipment_types(id),
  CONSTRAINT fk_exercises_creator FOREIGN KEY (created_by)
    REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Catálogo inicial (los 10 del sistema + extras comunes)
INSERT INTO exercises (name, muscle_group_id, equipment_id, difficulty) VALUES
  ('Press Banca',          1,  1,  'intermedio'),     -- id 1
  ('Sentadilla',           6,  1,  'intermedio'),     -- id 2
  ('Dominadas',            2,  6,  'intermedio'),     -- id 3
  ('Press Militar',        3,  1,  'intermedio'),     -- id 4
  ('Curl Bíceps',          4,  2,  'principiante'),   -- id 5
  ('Triceps Polea',        5,  3,  'principiante'),   -- id 6
  ('Peso Muerto',          2,  1,  'avanzado'),       -- id 7
  ('Hip Thrust',           7,  1,  'intermedio'),     -- id 8
  ('Remo con Barra',       2,  1,  'intermedio'),     -- id 9
  ('Fondos Paralelas',     1,  7,  'intermedio'),     -- id 10
  ('Press de Pecho Inclinado', 1, 2, 'intermedio'),   -- id 11
  ('Extensión Cuádriceps', 6,  4,  'principiante'),   -- id 12
  ('Curl Femoral',         6,  4,  'principiante'),   -- id 13
  ('Elevaciones Laterales',3,  2,  'principiante'),   -- id 14
  ('Jalón al Pecho',       2,  3,  'principiante'),   -- id 15
  ('Plancha Abdominal',    8,  13, 'principiante'),   -- id 16
  ('Zancadas',             6,  5,  'principiante'),   -- id 17
  ('Remo en Polea',        2,  3,  'principiante'),   -- id 18
  ('Press Arnold',         3,  2,  'intermedio'),     -- id 19
  ('Elevaciones de Talones',6, 5,  'principiante');   -- id 20

-- ============================================================
-- 9. PLANTILLAS GLOBALES DE RUTINA
--    Creadas por el admin (o entrenadores con is_global=FALSE).
--    Sirven como punto de partida para rutinas de clientes.
-- ============================================================
CREATE TABLE routine_templates (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(120) NOT NULL,
  category    VARCHAR(60)  NOT NULL,               -- 'Hipertrofia', 'Powerlifting'…
  days_week   TINYINT      NOT NULL DEFAULT 3,
  description TEXT         DEFAULT NULL,
  is_global   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by  INT UNSIGNED DEFAULT NULL,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                     ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_rt_global (is_global),
  CONSTRAINT fk_rt_creator FOREIGN KEY (created_by)
    REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- 10. EJERCICIOS DE UNA PLANTILLA
-- ============================================================
CREATE TABLE routine_template_exercises (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  template_id  INT UNSIGNED NOT NULL,
  exercise_id  INT UNSIGNED NOT NULL,
  sets         TINYINT      NOT NULL DEFAULT 3,
  reps         VARCHAR(20)  NOT NULL DEFAULT '10',  -- '8-10', 'AMRAP', '5'
  rest_seconds SMALLINT     NOT NULL DEFAULT 90,
  sort_order   TINYINT      NOT NULL DEFAULT 0,
  notes        VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (id),
  INDEX idx_rte_template (template_id),
  CONSTRAINT fk_rte_template FOREIGN KEY (template_id)
    REFERENCES routine_templates(id) ON DELETE CASCADE,
  CONSTRAINT fk_rte_exercise FOREIGN KEY (exercise_id)
    REFERENCES exercises(id)
) ENGINE=InnoDB;

-- ============================================================
-- 11. RUTINAS ASIGNADAS A CLIENTES
--    Un cliente puede tener varias rutinas pero solo
--    una activa (is_active = TRUE).
-- ============================================================
CREATE TABLE routines (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id   INT UNSIGNED NOT NULL,
  coach_id    INT UNSIGNED NOT NULL,
  name        VARCHAR(120) NOT NULL,
  category    VARCHAR(60)  NOT NULL,
  days_week   TINYINT      NOT NULL DEFAULT 3,
  template_id INT UNSIGNED DEFAULT NULL,            -- plantilla de origen
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  notes       TEXT         DEFAULT NULL,
  start_date  DATE         DEFAULT NULL,
  end_date    DATE         DEFAULT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                     ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_routines_client (client_id),
  INDEX idx_routines_coach  (coach_id),
  INDEX idx_routines_active (is_active),
  CONSTRAINT fk_routines_client   FOREIGN KEY (client_id)
    REFERENCES users(id),
  CONSTRAINT fk_routines_coach    FOREIGN KEY (coach_id)
    REFERENCES users(id),
  CONSTRAINT fk_routines_template FOREIGN KEY (template_id)
    REFERENCES routine_templates(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- 12. EJERCICIOS DE UNA RUTINA DE CLIENTE
-- ============================================================
CREATE TABLE routine_exercises (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  routine_id   INT UNSIGNED NOT NULL,
  exercise_id  INT UNSIGNED NOT NULL,
  day_index    TINYINT      NOT NULL DEFAULT 0   COMMENT 'Día de la rutina (0 = primero)',
  day_name     VARCHAR(60)  NOT NULL DEFAULT 'Día 1' COMMENT 'Ej.: Torso, Pierna, Día A',
  sets         TINYINT      NOT NULL DEFAULT 3,
  reps         VARCHAR(20)  NOT NULL DEFAULT '10',
  rest_seconds SMALLINT     NOT NULL DEFAULT 90,
  sort_order   TINYINT      NOT NULL DEFAULT 0,
  notes        VARCHAR(255) DEFAULT NULL,
  weight_kg    DECIMAL(6,2) DEFAULT NULL,           -- carga orientativa
  PRIMARY KEY (id),
  INDEX idx_re_routine (routine_id),
  CONSTRAINT fk_re_routine  FOREIGN KEY (routine_id)
    REFERENCES routines(id) ON DELETE CASCADE,
  CONSTRAINT fk_re_exercise FOREIGN KEY (exercise_id)
    REFERENCES exercises(id)
) ENGINE=InnoDB;

-- ============================================================
-- 13. MÉTODOS DE PAGO
-- ============================================================
CREATE TABLE payment_methods (
  id   TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(40)      NOT NULL UNIQUE,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

INSERT INTO payment_methods (name) VALUES
  ('Transferencia'),
  ('Efectivo'),
  ('Tarjeta de crédito/débito'),
  ('OXXO Pay'),
  ('PayPal'),
  ('MercadoPago'),
  ('Otro');

-- ============================================================
-- 14. PAGOS / COBROS
--    Creados por el entrenador al registrar cobros a sus clientes.
-- ============================================================
CREATE TABLE payments (
  id                INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  client_id         INT UNSIGNED     NOT NULL,
  coach_id          INT UNSIGNED     NOT NULL,
  payment_method_id TINYINT UNSIGNED DEFAULT NULL,
  concept           VARCHAR(200)     NOT NULL,
  amount            DECIMAL(10,2)    NOT NULL,
  due_date          DATE             DEFAULT NULL,
  paid_at           TIMESTAMP        DEFAULT NULL,
  status            ENUM('pending','paid','overdue','cancelled')
                                     NOT NULL DEFAULT 'pending',
  receipt_url       VARCHAR(512)     DEFAULT NULL,   -- comprobante
  notes             VARCHAR(255)     DEFAULT NULL,
  created_at        TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                              ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_payments_client  (client_id),
  INDEX idx_payments_coach   (coach_id),
  INDEX idx_payments_status  (status),
  INDEX idx_payments_due     (due_date),
  CONSTRAINT fk_payments_client FOREIGN KEY (client_id)
    REFERENCES users(id),
  CONSTRAINT fk_payments_coach  FOREIGN KEY (coach_id)
    REFERENCES users(id),
  CONSTRAINT fk_payments_method FOREIGN KEY (payment_method_id)
    REFERENCES payment_methods(id)
) ENGINE=InnoDB;

-- ============================================================
-- 15. SESIONES DE ENTRENAMIENTO
--    Cada vez que el cliente registra (o completa) un entreno.
-- ============================================================
CREATE TABLE workout_sessions (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id    INT UNSIGNED NOT NULL,
  routine_id   INT UNSIGNED NOT NULL,
  coach_id     INT UNSIGNED NOT NULL,
  started_at   TIMESTAMP    DEFAULT NULL,
  finished_at  TIMESTAMP    DEFAULT NULL,
  duration_min SMALLINT     DEFAULT NULL,
  day_name     VARCHAR(60)  DEFAULT NULL  COMMENT 'Día de la rutina que se entrenó',
  difficulty   TINYINT      DEFAULT NULL  COMMENT '1 muy fácil … 5 al límite (lo elige el cliente al terminar)',
  notes        TEXT         DEFAULT NULL  COMMENT 'Mensaje del cliente para su entrenador',
  status       ENUM('in_progress','completed','skipped')
                            NOT NULL DEFAULT 'completed',
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_ws_client (client_id),
  INDEX idx_ws_coach  (coach_id),
  INDEX idx_ws_date   (started_at),
  CONSTRAINT fk_ws_client  FOREIGN KEY (client_id)
    REFERENCES users(id),
  CONSTRAINT fk_ws_routine FOREIGN KEY (routine_id)
    REFERENCES routines(id),
  CONSTRAINT fk_ws_coach   FOREIGN KEY (coach_id)
    REFERENCES users(id)
) ENGINE=InnoDB;

-- ============================================================
-- 16. SERIES REGISTRADAS EN UNA SESIÓN
--    Detalle de cada set ejecutado durante el entrenamiento.
-- ============================================================
CREATE TABLE workout_sets (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id   INT UNSIGNED NOT NULL,
  exercise_id  INT UNSIGNED NOT NULL,
  set_number   TINYINT      NOT NULL,
  reps_done    TINYINT      DEFAULT NULL,
  weight_kg    DECIMAL(6,2) DEFAULT NULL,
  rpe          TINYINT      DEFAULT NULL  COMMENT 'Escala 1-10 de esfuerzo percibido',
  rest_seconds SMALLINT     DEFAULT NULL,
  is_completed BOOLEAN      NOT NULL DEFAULT TRUE,
  notes        VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (id),
  INDEX idx_wsets_session (session_id),
  INDEX idx_wsets_exercise (exercise_id),
  CONSTRAINT fk_wsets_session  FOREIGN KEY (session_id)
    REFERENCES workout_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_wsets_exercise FOREIGN KEY (exercise_id)
    REFERENCES exercises(id)
) ENGINE=InnoDB;

-- ============================================================
-- 17. REGISTROS DE PROGRESO FÍSICO
--    Peso corporal, composición, medidas antropométricas.
-- ============================================================
CREATE TABLE progress_records (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id      INT UNSIGNED NOT NULL,
  recorded_at    DATE         NOT NULL,
  weight_kg      DECIMAL(5,2) DEFAULT NULL,
  body_fat_pct   DECIMAL(4,1) DEFAULT NULL,
  muscle_mass_kg DECIMAL(5,2) DEFAULT NULL,
  waist_cm       DECIMAL(5,1) DEFAULT NULL,
  hip_cm         DECIMAL(5,1) DEFAULT NULL,
  chest_cm       DECIMAL(5,1) DEFAULT NULL,
  arm_cm         DECIMAL(5,1) DEFAULT NULL,
  thigh_cm       DECIMAL(5,1) DEFAULT NULL,
  notes          TEXT         DEFAULT NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_pr_client_date (client_id, recorded_at),
  CONSTRAINT fk_pr_client FOREIGN KEY (client_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 18. FOTOS DE PROGRESO
-- ============================================================
CREATE TABLE progress_photos (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id  INT UNSIGNED NOT NULL,
  photo_url  VARCHAR(512) NOT NULL,
  angle      ENUM('front','back','left','right','other')
                          DEFAULT 'front',
  taken_at   DATE         NOT NULL,
  notes      VARCHAR(255) DEFAULT NULL,
  uploaded_by INT UNSIGNED DEFAULT NULL           COMMENT 'Entrenador o el propio cliente',
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_pp_client (client_id),
  CONSTRAINT fk_pp_client FOREIGN KEY (client_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- NOTAS PRIVADAS DEL ENTRENADOR SOBRE CADA ASESORADO
--    El cliente no tiene acceso a esta tabla.
-- ============================================================
CREATE TABLE coach_notes (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  coach_id   INT UNSIGNED NOT NULL,
  client_id  INT UNSIGNED NOT NULL,
  category   ENUM('General','Técnica','Lesión','Nutrición','Pagos') NOT NULL DEFAULT 'General',
  body       TEXT         NOT NULL,
  is_pinned  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_cn_client (client_id, is_pinned),
  CONSTRAINT fk_cn_coach  FOREIGN KEY (coach_id)  REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_cn_client FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 19. RÉCORDS PERSONALES (PRs)
-- ============================================================
CREATE TABLE personal_records (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id   INT UNSIGNED NOT NULL,
  exercise_id INT UNSIGNED NOT NULL,
  weight_kg   DECIMAL(6,2) DEFAULT NULL,
  reps        TINYINT      DEFAULT NULL,
  achieved_at DATE         NOT NULL,
  notes       VARCHAR(255) DEFAULT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_pr_client_ex (client_id, exercise_id),
  CONSTRAINT fk_prs_client   FOREIGN KEY (client_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_prs_exercise FOREIGN KEY (exercise_id)
    REFERENCES exercises(id)
) ENGINE=InnoDB;

-- ============================================================
-- 20. CONVERSACIONES (chat 1:1 entrenador ↔ cliente)
-- ============================================================
CREATE TABLE conversations (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  coach_id   INT UNSIGNED NOT NULL,
  client_id  INT UNSIGNED NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_conversation (coach_id, client_id),
  CONSTRAINT fk_conv_coach  FOREIGN KEY (coach_id)
    REFERENCES users(id),
  CONSTRAINT fk_conv_client FOREIGN KEY (client_id)
    REFERENCES users(id)
) ENGINE=InnoDB;

-- ============================================================
-- 21. MENSAJES
-- ============================================================
CREATE TABLE messages (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id INT UNSIGNED NOT NULL,
  sender_id       INT UNSIGNED NOT NULL,
  body            TEXT         NOT NULL,
  is_read         BOOLEAN      NOT NULL DEFAULT FALSE,
  sent_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_msg_conv   (conversation_id),
  INDEX idx_msg_sender (sender_id),
  CONSTRAINT fk_msg_conversation FOREIGN KEY (conversation_id)
    REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_sender FOREIGN KEY (sender_id)
    REFERENCES users(id)
) ENGINE=InnoDB;

-- ============================================================
-- 22. NOTIFICACIONES
-- ============================================================
CREATE TABLE notifications (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  type        VARCHAR(60)  NOT NULL
              COMMENT 'payment_due | routine_updated | streak_broken | new_message | license_expiring',
  title       VARCHAR(120) NOT NULL,
  body        TEXT         DEFAULT NULL,
  related_url VARCHAR(255) DEFAULT NULL,
  is_read     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_notif_user_read (user_id, is_read),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 23. LOG DE ACTIVIDAD / AUDITORÍA
--    Registro inmutable de acciones críticas del sistema.
-- ============================================================
CREATE TABLE activity_logs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED    DEFAULT NULL,
  action      VARCHAR(100)    NOT NULL
              COMMENT 'login | logout | create_client | update_routine | mark_payment_paid | generate_license | revoke_license …',
  entity_type VARCHAR(60)     DEFAULT NULL  COMMENT 'user | routine | payment | license …',
  entity_id   INT UNSIGNED    DEFAULT NULL,
  description VARCHAR(255)    DEFAULT NULL,
  ip_address  VARCHAR(45)     DEFAULT NULL,
  user_agent  VARCHAR(255)    DEFAULT NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_log_user   (user_id),
  INDEX idx_log_action (action),
  INDEX idx_log_date   (created_at),
  CONSTRAINT fk_log_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- ── VISTAS ÚTILES PARA EL PANEL DE ADMIN ─────────────────────
-- ============================================================

-- Vista: todos los clientes con su entrenador asignado
CREATE OR REPLACE VIEW v_clients_by_coach AS
SELECT
  u.id            AS client_id,
  CONCAT(u.first_name, ' ', u.last_name) AS client_name,
  u.email         AS client_email,
  u.is_active     AS client_active,
  cp.goal,
  cp.weight_kg,
  cp.height_cm,
  cp.streak_days,
  cp.progress_pct,
  coach.id        AS coach_id,
  CONCAT(coach.first_name, ' ', coach.last_name) AS coach_name,
  coach.email     AS coach_email,
  u.created_at    AS registered_at
FROM users u
JOIN client_profiles cp   ON cp.user_id  = u.id
JOIN users coach          ON coach.id    = cp.coach_id
WHERE u.role_id = (SELECT id FROM roles WHERE name = 'client');

-- Vista: resumen financiero por entrenador
CREATE OR REPLACE VIEW v_payments_summary_by_coach AS
SELECT
  coach.id   AS coach_id,
  CONCAT(coach.first_name, ' ', coach.last_name) AS coach_name,
  COUNT(DISTINCT p.client_id)                     AS total_clients,
  SUM(CASE WHEN p.status = 'paid'    THEN p.amount ELSE 0 END) AS total_cobrado,
  SUM(CASE WHEN p.status = 'pending' THEN p.amount ELSE 0 END) AS total_pendiente,
  SUM(CASE WHEN p.status = 'overdue' THEN p.amount ELSE 0 END) AS total_vencido,
  COUNT(CASE WHEN p.status = 'overdue' THEN 1 END)             AS pagos_vencidos
FROM payments p
JOIN users coach ON coach.id = p.coach_id
GROUP BY coach.id, coach.first_name, coach.last_name;

-- Vista: estado de licencias con datos del entrenador
CREATE OR REPLACE VIEW v_licenses_status AS
SELECT
  l.id,
  l.code,
  CONCAT(u.first_name, ' ', u.last_name) AS coach_name,
  u.email AS coach_email,
  l.plan_months,
  l.issued_at,
  l.expires_at,
  l.status,
  DATEDIFF(l.expires_at, CURDATE()) AS days_remaining,
  CONCAT(admin.first_name, ' ', admin.last_name) AS issued_by_name
FROM licenses l
JOIN users u     ON u.id = l.coach_id
JOIN users admin ON admin.id = l.issued_by;

-- Vista: rutinas activas por cliente
CREATE OR REPLACE VIEW v_active_routines AS
SELECT
  r.id        AS routine_id,
  r.name      AS routine_name,
  r.category,
  r.days_week,
  CONCAT(cu.first_name, ' ', cu.last_name) AS client_name,
  cu.email    AS client_email,
  CONCAT(co.first_name, ' ', co.last_name) AS coach_name,
  COUNT(re.id) AS total_exercises,
  r.start_date,
  r.created_at
FROM routines r
JOIN users cu ON cu.id = r.client_id
JOIN users co ON co.id = r.coach_id
LEFT JOIN routine_exercises re ON re.routine_id = r.id
WHERE r.is_active = TRUE
GROUP BY r.id, r.name, r.category, r.days_week,
         cu.first_name, cu.last_name, cu.email,
         co.first_name, co.last_name,
         r.start_date, r.created_at;

-- Vista: resumen de progreso de clientes (para admin y coach)
CREATE OR REPLACE VIEW v_client_progress AS
SELECT
  u.id AS client_id,
  CONCAT(u.first_name, ' ', u.last_name) AS client_name,
  cp.coach_id,
  CONCAT(co.first_name, ' ', co.last_name) AS coach_name,
  cp.streak_days,
  cp.progress_pct,
  cp.weight_kg     AS current_weight,
  cp.goal,
  COUNT(DISTINCT ws.id)  AS total_sessions,
  MAX(ws.started_at)     AS last_session_at,
  COUNT(DISTINCT pr.id)  AS progress_records_count
FROM users u
JOIN client_profiles cp ON cp.user_id = u.id
JOIN users co           ON co.id = cp.coach_id
LEFT JOIN workout_sessions ws ON ws.client_id = u.id AND ws.status = 'completed'
LEFT JOIN progress_records pr ON pr.client_id = u.id
WHERE u.role_id = (SELECT id FROM roles WHERE name = 'client')
GROUP BY u.id, u.first_name, u.last_name,
         cp.coach_id, co.first_name, co.last_name,
         cp.streak_days, cp.progress_pct, cp.weight_kg, cp.goal;

-- ============================================================
-- ── DATOS DE PRUEBA (DEMO) ────────────────────────────────────
-- ============================================================

-- USUARIOS
-- NOTA: En producción los password_hash deben generarse con
--       bcrypt/argon2. Los hashes de abajo son solo marcadores.
INSERT INTO users (role_id, email, password_hash, first_name, last_name, created_by) VALUES
  -- Admin (id=1)
  (1, 'admin@fitcoach.com',
   '$2y$12$ADMIN_HASH_PLACEHOLDER_000000000000000000000000000000',
   'Admin', 'Sistema', NULL),
  -- Entrenadores (id=2,3)
  (2, 'carlos@fitcoach.com',
   '$2y$12$COACH_HASH_PLACEHOLDER_000000000000000000000000000000',
   'Carlos', 'Méndez', 1),
  (2, 'ana@fitcoach.com',
   '$2y$12$COACH_HASH_PLACEHOLDER_000000000000000000000000000000',
   'Ana', 'Torres', 1),
  -- Clientes de Carlos (id=4,5,6) — creados por el coach, no por admin
  (3, 'sofia@fitcoach.com',
   '$2y$12$USER_HASH_PLACEHOLDER_0000000000000000000000000000000',
   'Sofía', 'López', 2),
  (3, 'mario@fitcoach.com',
   '$2y$12$USER_HASH_PLACEHOLDER_0000000000000000000000000000000',
   'Mario', 'García', 2),
  (3, 'val@fitcoach.com',
   '$2y$12$USER_HASH_PLACEHOLDER_0000000000000000000000000000000',
   'Valeria', 'Cruz', 2);

-- PERFILES DE ENTRENADORES
INSERT INTO coach_profiles (user_id, specialty, experience_yrs) VALUES
  (2, 'Hipertrofia, Powerlifting', 5),
  (3, 'Funcional, Cardio',         3);

-- LICENCIAS
INSERT INTO licenses (coach_id, code, issued_at, expires_at, plan_months, status, issued_by) VALUES
  (2, 'FIT-X7K2-2026', '2026-02-01', '2026-08-01', 6, 'active',  1),
  (3, 'FIT-M9P4-2026', '2026-04-01', '2026-05-01', 1, 'expired', 1);

-- PERFILES DE CLIENTES
INSERT INTO client_profiles (user_id, coach_id, goal, weight_kg, height_cm, streak_days, progress_pct) VALUES
  (4, 2, 'Hipertrofia',  60.00, 162, 14, 78),
  (5, 2, 'Fuerza',       85.00, 178,  7, 45),
  (6, 2, 'Tonificación', 55.00, 165, 21, 92);

-- PLANTILLAS DE RUTINA
INSERT INTO routine_templates (name, category, days_week, is_global, created_by) VALUES
  ('Hipertrofia 5 días', 'Hipertrofia', 5, TRUE, 1),  -- id=1
  ('Fuerza Base 3 días', 'Powerlifting', 3, TRUE, 1), -- id=2
  ('Cardio & Tono',      'Funcional',    4, TRUE, 1); -- id=3

INSERT INTO routine_template_exercises
  (template_id, exercise_id, sets, reps, rest_seconds, sort_order, notes) VALUES
  -- Plantilla 1: Hipertrofia 5 días
  (1, 1, 4, '8-10', 90,  1, NULL),
  (1, 2, 4, '6-8',  120, 2, 'Bajar hasta paralelo'),
  (1, 9, 3, '10-12',90,  3, NULL),
  -- Plantilla 2: Fuerza Base 3 días
  (2, 7, 5, '5',    180, 1, 'Espalda recta'),
  (2, 4, 4, '6',    120, 2, NULL),
  -- Plantilla 3: Cardio & Tono
  (3, 5, 3, '15',   60,  1, NULL),
  (3, 8, 4, '12',   90,  2, NULL);

-- RUTINAS ASIGNADAS A CLIENTES
INSERT INTO routines (client_id, coach_id, name, category, days_week, template_id, start_date) VALUES
  (4, 2, 'Push/Pull/Legs — Sofía', 'Hipertrofia', 5, 1, '2026-03-01'),  -- id=1
  (5, 2, 'Fuerza Base — Mario',    'Powerlifting', 3, 2, '2026-03-15'); -- id=2
-- Valeria (id=6) no tiene rutina aún

-- EJERCICIOS EN RUTINA DE SOFÍA (routine_id=1)
INSERT INTO routine_exercises
  (routine_id, exercise_id, sets, reps, rest_seconds, sort_order, notes) VALUES
  (1, 1, 4, '8-10', 90,  1, 'Arqueo controlado'),
  (1, 2, 4, '6-8',  120, 2, NULL),
  (1, 9, 3, '10-12',90,  3, NULL);

-- EJERCICIOS EN RUTINA DE MARIO (routine_id=2)
INSERT INTO routine_exercises
  (routine_id, exercise_id, sets, reps, rest_seconds, sort_order, notes) VALUES
  (2, 7, 5, '5', 180, 1, 'PR objetivo: 140 kg'),
  (2, 4, 4, '6', 120, 2, NULL);

-- PAGOS
INSERT INTO payments
  (client_id, coach_id, payment_method_id, concept, amount, due_date, paid_at, status) VALUES
  (4, 2, 1, 'Mensualidad Abril 2026', 800.00, '2026-04-01', '2026-04-03 10:00:00', 'paid'),
  (4, 2, NULL,'Mensualidad Mayo 2026', 800.00, '2026-05-01', NULL,                  'pending'),
  (5, 2, 2, 'Mensualidad Abril 2026', 700.00, '2026-04-01', '2026-04-02 09:00:00', 'paid'),
  (5, 2, NULL,'Mensualidad Mayo 2026', 700.00, '2026-05-01', NULL,                  'overdue'),
  (6, 2, 3, 'Mensualidad Abril 2026', 650.00, '2026-04-01', '2026-04-01 14:00:00', 'paid');

-- SESIONES DE ENTRENAMIENTO (últimas sesiones de Sofía)
INSERT INTO workout_sessions (client_id, routine_id, coach_id, started_at, finished_at, duration_min, status) VALUES
  (4, 1, 2, '2026-05-28 08:00:00', '2026-05-28 09:15:00', 75, 'completed'),
  (4, 1, 2, '2026-05-27 08:00:00', '2026-05-27 09:05:00', 65, 'completed'),
  (4, 1, 2, '2026-05-26 07:45:00', '2026-05-26 08:50:00', 65, 'completed');

-- SETS REGISTRADOS (sesión id=1 de Sofía)
INSERT INTO workout_sets (session_id, exercise_id, set_number, reps_done, weight_kg, rpe) VALUES
  (1, 1, 1, 10, 50.00, 7),
  (1, 1, 2, 9,  52.50, 8),
  (1, 1, 3, 8,  55.00, 9),
  (1, 1, 4, 7,  55.00, 10),
  (1, 2, 1, 8,  60.00, 7),
  (1, 2, 2, 7,  62.50, 8);

-- REGISTROS DE PROGRESO FÍSICO
INSERT INTO progress_records (client_id, recorded_at, weight_kg, body_fat_pct, waist_cm) VALUES
  (4, '2026-03-01', 62.00, 24.0, 72.0),
  (4, '2026-04-01', 61.00, 23.0, 70.5),
  (4, '2026-05-01', 60.00, 22.0, 69.0),
  (5, '2026-03-15', 88.00, 18.0, 88.0),
  (5, '2026-04-15', 86.50, 17.5, 86.0),
  (5, '2026-05-15', 85.00, 17.0, 85.0);

-- RÉCORDS PERSONALES
INSERT INTO personal_records (client_id, exercise_id, weight_kg, reps, achieved_at) VALUES
  (4, 1, 57.50, 8,  '2026-05-10'),  -- Sofía: Press Banca
  (4, 2, 72.50, 6,  '2026-05-20'),  -- Sofía: Sentadilla
  (5, 7, 130.00, 3, '2026-05-22'),  -- Mario: Peso Muerto
  (5, 4, 75.00, 5,  '2026-05-18');  -- Mario: Press Militar

-- CONVERSACIONES Y MENSAJES
INSERT INTO conversations (coach_id, client_id) VALUES
  (2, 4),   -- Carlos ↔ Sofía  (id=1)
  (2, 5);   -- Carlos ↔ Mario  (id=2)

INSERT INTO messages (conversation_id, sender_id, body, is_read) VALUES
  (1, 2, '¡Hola Sofía! ¿Cómo te fue en el entrenamiento de hoy?',          TRUE),
  (1, 4, 'Muy bien Carlos, logré mis 4 series de press banca 💪',           TRUE),
  (1, 2, 'Perfecto, la próxima semana subimos 2.5 kg en press.',           FALSE),
  (2, 2, 'Mario, recuerda que mañana toca peso muerto. Calienta bien.',   TRUE),
  (2, 5, 'Entendido, llegaré 10 minutos antes.',                           FALSE);

-- NOTIFICACIONES DE PRUEBA
INSERT INTO notifications (user_id, type, title, body) VALUES
  (4, 'payment_due',       'Mensualidad Mayo pendiente',       'Tienes un pago de $800 pendiente con Carlos Méndez.'),
  (5, 'payment_due',       'Mensualidad Mayo vencida',         'Tu pago de $700 está vencido. Contáctate con tu entrenador.'),
  (2, 'payment_due',       'Mario García tiene un pago vencido','El pago de Mayo de Mario García está vencido.'),
  (2, 'license_expiring',  'Revisa el estado de tu licencia',  'La licencia de Ana Torres vence pronto.');

-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================
