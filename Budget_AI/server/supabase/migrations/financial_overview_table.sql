-- Create financial_overview table
CREATE TABLE IF NOT EXISTS financial_overview (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_monthly_income DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_savings DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_investment_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_expenses DECIMAL(15, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create a function to calculate total expenses for a user
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

-- Create a trigger to update total_expenses whenever expenses are modified
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

-- Create triggers on the expenses table
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

-- Add Row Level Security (RLS) policies
ALTER TABLE financial_overview ENABLE ROW LEVEL SECURITY;

-- Policy for select: users can only view their own data
CREATE POLICY select_financial_overview ON financial_overview
  FOR SELECT USING (auth.uid() = user_id);

-- Policy for insert: users can only insert their own data
CREATE POLICY insert_financial_overview ON financial_overview
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for update: users can only update their own data
CREATE POLICY update_financial_overview ON financial_overview
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy for delete: users can only delete their own data
CREATE POLICY delete_financial_overview ON financial_overview
  FOR DELETE USING (auth.uid() = user_id);
