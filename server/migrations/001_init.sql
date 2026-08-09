CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  friend_code text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_jobs (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_name text NOT NULL,
  level int NOT NULL CHECK (level BETWEEN 0 AND 155),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_name)
);

CREATE TABLE friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id)
);
