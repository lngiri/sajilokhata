CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_customers_name_trgm
  ON customers
  USING gin (name gin_trgm_ops);
