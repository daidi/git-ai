CREATE TABLE daily_activity (
  day TEXT NOT NULL CHECK (length(day) = 10),
  installation_hash TEXT NOT NULL CHECK (length(installation_hash) = 64),
  source TEXT NOT NULL,
  PRIMARY KEY (day, installation_hash, source)
) WITHOUT ROWID;
