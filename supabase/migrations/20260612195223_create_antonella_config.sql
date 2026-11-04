CREATE TABLE IF NOT EXISTS antonella_config (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_uid varchar(255) NOT NULL UNIQUE,
  system_prompt text NOT NULL DEFAULT '',
  disabled_tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  custom_tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  model varchar(100) NOT NULL DEFAULT 'claude-opus-4-8',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
