-- Fix for total expenses calculation

-- First, check if the expenses table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'expenses') THEN
    RAISE EXCEPTION 'The expenses table does not exist. Please create it first.';
  END IF;
END $$;

-- Recreate the function to calculate total expenses for a user
CREATE OR REPLACE FUNCTION calculate_total_expenses(user_uuid UUID)
RETURNS DECIMAL(15, 2) AS $$
DECLARE
  total DECIMAL(15, 2);
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total
  FROM expenses
  WHERE user_id = user_uuid;
  
  RETURN total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger function to update total_expenses whenever expenses are modified
CREATE OR REPLACE FUNCTION update_financial_overview_expenses()
RETURNS TRIGGER AS $$
DECLARE
  user_uuid UUID;
  total_expense DECIMAL(15, 2);
BEGIN
  -- For INSERT/UPDATE operations, use NEW record's user_id
  -- For DELETE operations, use OLD record's user_id
  IF TG_OP = 'DELETE' THEN
    user_uuid := OLD.user_id;
  ELSE
    user_uuid := NEW.user_id;
  END IF;
  
  -- Calculate total expenses for this user
  total_expense := calculate_total_expenses(user_uuid);
  
  -- Update the financial_overview table
  UPDATE financial_overview
  SET 
    total_expenses = total_expense,
    updated_at = now()
  WHERE user_id = user_uuid;
  
  -- If no row exists, insert one
  IF NOT FOUND THEN
    INSERT INTO financial_overview (user_id, total_expenses)
    VALUES (user_uuid, total_expense);
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate triggers on the expenses table
DROP TRIGGER IF EXISTS expenses_insert_update_trigger ON expenses;
CREATE TRIGGER expenses_insert_update_trigger
AFTER INSERT OR UPDATE ON expenses
FOR EACH ROW
EXECUTE FUNCTION update_financial_overview_expenses();

DROP TRIGGER IF EXISTS expenses_delete_trigger ON expenses;
CREATE TRIGGER expenses_delete_trigger
AFTER DELETE ON expenses
FOR EACH ROW
EXECUTE FUNCTION update_financial_overview_expenses();

-- Create a function to manually recalculate total expenses for a specific user
CREATE OR REPLACE FUNCTION recalculate_user_expenses(user_uuid UUID)
RETURNS VOID AS $$
DECLARE
  total_expense DECIMAL(15, 2);
BEGIN
  -- Calculate total expenses for this user
  SELECT COALESCE(SUM(amount), 0) INTO total_expense
  FROM expenses
  WHERE user_id = user_uuid;
  
  -- Update the financial_overview table
  UPDATE financial_overview
  SET 
    total_expenses = total_expense,
    updated_at = now()
  WHERE user_id = user_uuid;
  
  -- If no row exists, insert one
  IF NOT FOUND THEN
    INSERT INTO financial_overview (user_id, total_expenses)
    VALUES (user_uuid, total_expense);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Manually recalculate total expenses for all users
DO $$
DECLARE
  user_rec RECORD;
BEGIN
  FOR user_rec IN SELECT DISTINCT user_id FROM financial_overview LOOP
    PERFORM recalculate_user_expenses(user_rec.user_id);
  END LOOP;
END $$;

-- Create a function to manually update total expenses for a specific user
CREATE OR REPLACE FUNCTION refresh_total_expenses(user_uuid UUID)
RETURNS VOID AS $$
DECLARE
  total_expense DECIMAL(15, 2);
BEGIN
  -- Calculate total expenses for this user
  total_expense := calculate_total_expenses(user_uuid);
  
  -- Update the financial_overview table
  UPDATE financial_overview
  SET 
    total_expenses = total_expense,
    updated_at = now()
  WHERE user_id = user_uuid;
  
  -- If no row exists, insert one
  IF NOT FOUND THEN
    INSERT INTO financial_overview (user_id, total_expenses)
    VALUES (user_uuid, total_expense);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
