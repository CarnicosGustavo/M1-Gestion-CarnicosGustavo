-- Configuración del agente Christopher (atención al cliente)
CREATE TABLE IF NOT EXISTS christopher_config (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_uid varchar(255) NOT NULL UNIQUE,
  system_prompt text NOT NULL DEFAULT '',
  disabled_tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  custom_tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  model varchar(100) NOT NULL DEFAULT 'claude-opus-4-8',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Memoria propia de Christopher (preferencias de clientes, notas de entrega)
CREATE TABLE IF NOT EXISTS christopher_memories (
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
CREATE INDEX IF NOT EXISTS idx_christopher_mem_user ON christopher_memories(user_uid);
