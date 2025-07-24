-- Fix for expenses trigger not updating financial_overview table

-- First, check if both tables exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'expenses') THEN
    RAISE EXCEPTION 'The expenses table does not exist. Please create it first.';
  END IF;
  
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'financial_overview') THEN
    RAISE EXCEPTION 'The financial_overview table does not exist. Please create it first.';
  END IF;
END $$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS expenses_insert_update_trigger ON expenses;
DROP TRIGGER IF EXISTS expenses_delete_trigger ON expenses;

-- Create a simpler function to update financial_overview when expenses change
CREATE OR REPLACE FUNCTION update_financial_overview_on_expense_change()
RETURNS TRIGGER AS $$
DECLARE
  user_uuid UUID;
  total_expense DECIMAL(15, 2);
BEGIN
  -- Determine which user's expenses changed
  IF TG_OP = 'DELETE' THEN
    user_uuid := OLD.user_id;
  ELSE
    user_uuid := NEW.user_id;
  END IF;
  
  -- Calculate the new total expenses for this user
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
  
  -- Return the appropriate record based on operation type
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new triggers on the expenses table
CREATE TRIGGER expenses_after_insert_update
AFTER INSERT OR UPDATE ON expenses
FOR EACH ROW
EXECUTE FUNCTION update_financial_overview_on_expense_change();

CREATE TRIGGER expenses_after_delete
AFTER DELETE ON expenses
FOR EACH ROW
EXECUTE FUNCTION update_financial_overview_on_expense_change();

-- Create a function to manually update a user's total expenses
CREATE OR REPLACE FUNCTION update_user_total_expenses(user_uuid UUID)
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

-- Run this to update all users' total expenses
DO $$
DECLARE
  user_rec RECORD;
BEGIN
  FOR user_rec IN SELECT DISTINCT user_id FROM expenses LOOP
    PERFORM update_user_total_expenses(user_rec.user_id);
  END LOOP;
END $$;
