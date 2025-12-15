-- Migration: Data Integrity Constraints
-- This migration adds critical data integrity constraints for production

-- ============================================================================
-- 1. BANK TRANSACTION DUPLICATE CLEANUP AND UNIQUE CONSTRAINT
-- Prevents duplicate bank transactions from being imported
-- ============================================================================

-- First, identify and remove duplicate bank transactions (keep oldest)
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY bank_account_id, transaction_date, amount, description
           ORDER BY created_at ASC, id ASC
         ) as rn
  FROM bank_transactions
)
DELETE FROM bank_transactions
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Now add the unique constraint to prevent future duplicates
-- Note: The constraint name matches the schema definition
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bank_transactions_unique_txn'
  ) THEN
    ALTER TABLE bank_transactions
    ADD CONSTRAINT bank_transactions_unique_txn
    UNIQUE (bank_account_id, transaction_date, amount, description);

    RAISE NOTICE 'Added bank_transactions_unique_txn constraint';
  ELSE
    RAISE NOTICE 'bank_transactions_unique_txn constraint already exists';
  END IF;
END $$;

-- ============================================================================
-- 2. PAYMENT ALLOCATION VALIDATION TRIGGER
-- Ensures sum of allocations never exceeds payment amount
-- ============================================================================

-- Create the validation function
CREATE OR REPLACE FUNCTION validate_payment_allocation()
RETURNS TRIGGER AS $$
DECLARE
  payment_amount DECIMAL(15,2);
  total_allocated DECIMAL(15,2);
  new_total DECIMAL(15,2);
BEGIN
  -- Get the payment amount
  SELECT CAST(amount AS DECIMAL(15,2)) INTO payment_amount
  FROM payments
  WHERE id = NEW.payment_id;

  IF payment_amount IS NULL THEN
    RAISE EXCEPTION 'Payment not found: %', NEW.payment_id;
  END IF;

  -- Calculate current total allocated (excluding this record if updating)
  SELECT COALESCE(SUM(CAST(allocated_amount AS DECIMAL(15,2))), 0) INTO total_allocated
  FROM payment_allocations
  WHERE payment_id = NEW.payment_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- Calculate new total
  new_total := total_allocated + CAST(NEW.allocated_amount AS DECIMAL(15,2));

  -- Check if over-allocated (allow 0.01 tolerance for rounding)
  IF new_total > payment_amount + 0.01 THEN
    RAISE EXCEPTION 'Payment allocation would exceed payment amount. Payment: %, Already allocated: %, New allocation: %, Total would be: %',
      payment_amount, total_allocated, NEW.allocated_amount, new_total;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS check_payment_allocation ON payment_allocations;

-- Create the trigger
CREATE TRIGGER check_payment_allocation
  BEFORE INSERT OR UPDATE ON payment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION validate_payment_allocation();

-- ============================================================================
-- 3. QUOTATION NUMBER UNIQUE CONSTRAINT
-- Prevents duplicate quotation numbers per user (like invoices)
-- ============================================================================

-- Handle any existing duplicates first
WITH duplicates AS (
  SELECT id, user_id, quotation_number,
         ROW_NUMBER() OVER (PARTITION BY user_id, quotation_number ORDER BY created_at) as rn
  FROM quotations
  WHERE quotation_number IS NOT NULL
)
UPDATE quotations q
SET quotation_number = CONCAT(q.quotation_number, '-DUP-', d.rn)
FROM duplicates d
WHERE q.id = d.id AND d.rn > 1;

-- Add unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quotations_user_quotation_number_unique'
  ) THEN
    ALTER TABLE quotations
    ADD CONSTRAINT quotations_user_quotation_number_unique
    UNIQUE (user_id, quotation_number);

    RAISE NOTICE 'Added quotations_user_quotation_number_unique constraint';
  END IF;
END $$;

-- ============================================================================
-- 4. BILL NUMBER UNIQUE CONSTRAINT
-- Prevents duplicate bill numbers per user
-- ============================================================================

-- Handle any existing duplicates first
WITH duplicates AS (
  SELECT id, user_id, bill_number,
         ROW_NUMBER() OVER (PARTITION BY user_id, bill_number ORDER BY created_at) as rn
  FROM bills
  WHERE bill_number IS NOT NULL
)
UPDATE bills b
SET bill_number = CONCAT(b.bill_number, '-DUP-', d.rn)
FROM duplicates d
WHERE b.id = d.id AND d.rn > 1;

-- Add unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bills_user_bill_number_unique'
  ) THEN
    ALTER TABLE bills
    ADD CONSTRAINT bills_user_bill_number_unique
    UNIQUE (user_id, bill_number);

    RAISE NOTICE 'Added bills_user_bill_number_unique constraint';
  END IF;
END $$;

-- ============================================================================
-- 5. CREDIT NOTE / DEBIT NOTE UNIQUE CONSTRAINTS
-- ============================================================================

-- Credit Note unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'credit_notes_user_number_unique'
  ) THEN
    -- Handle duplicates first
    WITH duplicates AS (
      SELECT id, user_id, credit_note_number,
             ROW_NUMBER() OVER (PARTITION BY user_id, credit_note_number ORDER BY created_at) as rn
      FROM credit_notes
      WHERE credit_note_number IS NOT NULL
    )
    UPDATE credit_notes cn
    SET credit_note_number = CONCAT(cn.credit_note_number, '-DUP-', d.rn)
    FROM duplicates d
    WHERE cn.id = d.id AND d.rn > 1;

    ALTER TABLE credit_notes
    ADD CONSTRAINT credit_notes_user_number_unique
    UNIQUE (user_id, credit_note_number);

    RAISE NOTICE 'Added credit_notes_user_number_unique constraint';
  END IF;
END $$;

-- Debit Note unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'debit_notes_user_number_unique'
  ) THEN
    -- Handle duplicates first
    WITH duplicates AS (
      SELECT id, user_id, debit_note_number,
             ROW_NUMBER() OVER (PARTITION BY user_id, debit_note_number ORDER BY created_at) as rn
      FROM debit_notes
      WHERE debit_note_number IS NOT NULL
    )
    UPDATE debit_notes dn
    SET debit_note_number = CONCAT(dn.debit_note_number, '-DUP-', d.rn)
    FROM duplicates d
    WHERE dn.id = d.id AND d.rn > 1;

    ALTER TABLE debit_notes
    ADD CONSTRAINT debit_notes_user_number_unique
    UNIQUE (user_id, debit_note_number);

    RAISE NOTICE 'Added debit_notes_user_number_unique constraint';
  END IF;
END $$;

-- ============================================================================
-- 6. MISSING PERFORMANCE INDEXES
-- ============================================================================

-- Index for dashboard overdue invoices query
CREATE INDEX IF NOT EXISTS invoices_user_status_due_date_idx
ON invoices (user_id, status, due_date)
WHERE deleted_at IS NULL;

-- Index for customer aging report
CREATE INDEX IF NOT EXISTS invoices_customer_status_idx
ON invoices (customer_id, status)
WHERE deleted_at IS NULL;

-- Index for bill payments due
CREATE INDEX IF NOT EXISTS bills_user_status_due_date_idx
ON bills (user_id, status, due_date)
WHERE deleted_at IS NULL;

-- Index for payment lookups by date
CREATE INDEX IF NOT EXISTS payments_user_date_idx
ON payments (user_id, payment_date)
WHERE deleted_at IS NULL;

-- ============================================================================
-- 7. DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION validate_payment_allocation() IS
'Validates that sum of payment allocations does not exceed payment amount';

COMMENT ON TRIGGER check_payment_allocation ON payment_allocations IS
'Prevents over-allocation of payments to invoices/bills';

COMMENT ON CONSTRAINT bank_transactions_unique_txn ON bank_transactions IS
'Prevents duplicate bank transactions from being imported';
