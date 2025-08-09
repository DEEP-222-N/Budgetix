-- Guard financial_overview updates/inserts to only run for existing auth users
-- and clean up orphan recurring expenses

-- Drop existing related triggers to avoid conflicts
DROP TRIGGER IF EXISTS expenses_after_insert_update ON expenses;
DROP TRIGGER IF EXISTS expenses_after_delete ON expenses;
DROP TRIGGER IF EXISTS expenses_insert_update_trigger ON expenses;
DROP TRIGGER IF EXISTS expenses_delete_trigger ON expenses;

-- Canonical trigger function with guard
CREATE OR REPLACE FUNCTION update_financial_overview_on_expense_change()
RETURNS TRIGGER AS $$
DECLARE
  user_uuid UUID;
  total_expense DECIMAL(15, 2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    user_uuid := OLD.user_id;
  ELSE
    user_uuid := NEW.user_id;
  END IF;

  -- Guard: skip if the user does not exist in auth.users to avoid FK violations
  IF NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = user_uuid) THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO total_expense
  FROM expenses
  WHERE user_id = user_uuid;

  UPDATE financial_overview
  SET total_expenses = total_expense,
      updated_at = now()
  WHERE user_id = user_uuid;

  IF NOT FOUND THEN
    INSERT INTO financial_overview (user_id, total_expenses)
    VALUES (user_uuid, total_expense);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate triggers to use the guarded function
CREATE TRIGGER expenses_after_insert_update
AFTER INSERT OR UPDATE ON expenses
FOR EACH ROW
EXECUTE FUNCTION update_financial_overview_on_expense_change();

CREATE TRIGGER expenses_after_delete
AFTER DELETE ON expenses
FOR EACH ROW
EXECUTE FUNCTION update_financial_overview_on_expense_change();

-- One-time cleanup: mark orphan recurring templates inactive to prevent future processing
UPDATE expenses
SET is_recurring = false
WHERE is_recurring = true
  AND user_id NOT IN (SELECT id FROM auth.users);


