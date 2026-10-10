-- Memorias: hechos, detalles, preferencias, estadísticas que Antonella recuerda
CREATE TABLE IF NOT EXISTS antonella_memories (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_uid varchar(255) NOT NULL,
  category varchar(80) NOT NULL DEFAULT 'general',
  title varchar(200) NOT NULL,
  content text NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  importance integer NOT NULL DEFAULT 1,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_antonella_memories_user ON antonella_memories(user_uid);
CREATE INDEX IF NOT EXISTS idx_antonella_memories_cat ON antonella_memories(user_uid, category);

-- Datasets: "bases de datos" que Antonella crea para memorizar cosas cotidianas
CREATE TABLE IF NOT EXISTS antonella_datasets (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_uid varchar(255) NOT NULL,
  name varchar(120) NOT NULL,
  description text NOT NULL DEFAULT '',
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE (user_uid, name)
);

-- Filas de cada dataset (estructura flexible en jsonb)
CREATE TABLE IF NOT EXISTS antonella_dataset_rows (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  dataset_id integer NOT NULL REFERENCES antonella_datasets(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_antonella_rows_dataset ON antonella_dataset_rows(dataset_id);
