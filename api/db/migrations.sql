-- Schema for the Vakaros Atlas Sailing Analytics app (MariaDB 10.6+).
-- Bulk track samples are NOT stored here; they live as gzip JSON in storage/tracks.

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS boats (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  name        VARCHAR(120) NOT NULL,
  boat_class  VARCHAR(120) NOT NULL DEFAULT '',   -- boat type / class (metadata, not in raw data)
  sail_number VARCHAR(40)  NOT NULL DEFAULT '',
  notes       TEXT         NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_boats_user (user_id),
  CONSTRAINT fk_boats_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS polars (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  boat_id    INT UNSIGNED NOT NULL,
  name       VARCHAR(120) NOT NULL,
  source     VARCHAR(120) NOT NULL DEFAULT '',
  data       JSON NOT NULL,                        -- { twsValues, twaValues, speeds[][] }
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_polars_boat (boat_id),
  CONSTRAINT fk_polars_boat FOREIGN KEY (boat_id) REFERENCES boats (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sessions (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED NOT NULL,
  boat_id       INT UNSIGNED NULL,
  name          VARCHAR(200) NOT NULL,
  sailed_at     DATETIME NULL,
  source_format VARCHAR(10)  NOT NULL DEFAULT 'vkx',
  duration_s    INT UNSIGNED NOT NULL DEFAULT 0,
  stats         JSON NULL,                          -- SessionStats
  wind_meta     JSON NULL,                          -- { source, twd, tws, input }
  analysis      JSON NULL,                          -- cached legs/maneuvers/start summary
  track_file    VARCHAR(120) NOT NULL,              -- storage/tracks/*.json.gz
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sessions_user (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_sessions_boat FOREIGN KEY (boat_id) REFERENCES boats (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
