-- Migration 046: Product Master
-- Adds merchant_products (product catalog) and credit_log_items (line items).
-- Does NOT modify credit_logs — existing balance logic is untouched.

-- ============================================================
-- Table: merchant_products
-- Per-merchant product catalog. Business-type agnostic.
-- ============================================================
CREATE TABLE merchant_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'piece',
  default_rate NUMERIC NOT NULL CHECK (default_rate >= 0),
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_merchant_products_merchant ON merchant_products(merchant_id);
CREATE INDEX idx_merchant_products_active ON merchant_products(merchant_id, is_active) WHERE is_active = true;

ALTER TABLE merchant_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage own products" ON merchant_products
  FOR ALL USING (merchant_id = auth.uid());

-- ============================================================
-- Table: credit_log_items
-- Line items for credit_logs. One credit_log → N items.
-- Schema supports multi-item; initial UI creates one item per transaction.
-- ============================================================
CREATE TABLE credit_log_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_log_id UUID NOT NULL REFERENCES credit_logs(id) ON DELETE CASCADE,
  product_id UUID REFERENCES merchant_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'piece',
  unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_log_items_log ON credit_log_items(credit_log_id);
CREATE INDEX idx_credit_log_items_product ON credit_log_items(product_id) WHERE product_id IS NOT NULL;

ALTER TABLE credit_log_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see items for accessible logs" ON credit_log_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM credit_logs cl
      WHERE cl.id = credit_log_items.credit_log_id
      AND (cl.merchant_id = auth.uid() OR cl.customer_id = auth.uid())
    )
  );

CREATE POLICY "Merchants insert items for own logs" ON credit_log_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM credit_logs cl
      WHERE cl.id = credit_log_items.credit_log_id
      AND cl.merchant_id = auth.uid()
    )
  );

-- ============================================================
-- Updated_at trigger for merchant_products
-- ============================================================
CREATE OR REPLACE FUNCTION update_merchant_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_merchant_products_updated_at
  BEFORE UPDATE ON merchant_products
  FOR EACH ROW
  EXECUTE FUNCTION update_merchant_products_updated_at();
