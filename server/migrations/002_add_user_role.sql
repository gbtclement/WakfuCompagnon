ALTER TABLE users ADD COLUMN role text NOT NULL DEFAULT 'player'
  CHECK (role IN ('player', 'admin'));