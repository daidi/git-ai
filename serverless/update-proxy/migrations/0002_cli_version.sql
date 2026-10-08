CREATE TABLE daily_activity_with_version (
  day TEXT NOT NULL CHECK (length(day) = 10),
  installation_hash TEXT NOT NULL CHECK (length(installation_hash) = 64),
  source TEXT NOT NULL,
  cli_version TEXT NOT NULL DEFAULT 'unknown',
  PRIMARY KEY (day, installation_hash, source, cli_version)
) WITHOUT ROWID;

INSERT INTO daily_activity_with_version (day, installation_hash, source)
SELECT day, installation_hash, source FROM daily_activity;

DROP TABLE daily_activity;
ALTER TABLE daily_activity_with_version RENAME TO daily_activity;
