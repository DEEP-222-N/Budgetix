-- Add month column to budget table for monthly budget tracking
-- This allows users to have different budgets for different months

-- First, remove the unique constraint on user_id since we'll have multiple rows per user (one per month)
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS unique_user_budget;

-- Handle existing month column - check if it exists and what type it is
DO $$
BEGIN
    -- Check if month column exists and is DATE type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'budgets' AND column_name = 'month' AND data_type = 'date'
    ) THEN
        -- Drop the existing unique constraint if it exists
        IF EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'unique_user_month_budget'
        ) THEN
            ALTER TABLE budgets DROP CONSTRAINT unique_user_month_budget;
        END IF;
        
        -- Change column type from DATE to TEXT using USING clause to convert values
        ALTER TABLE budgets ALTER COLUMN month TYPE TEXT USING TRIM(TO_CHAR(month, 'Month'));
    END IF;
    
    -- Add month column if it doesn't exist at all
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'budgets' AND column_name = 'month'
    ) THEN
        ALTER TABLE budgets ADD COLUMN month TEXT NOT NULL DEFAULT TRIM(TO_CHAR(CURRENT_DATE, 'Month'));
    END IF;
END $$;

-- Create a new unique constraint on user_id + month combination (if it doesn't exist)
-- This ensures each user can only have one budget per month
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_user_month_budget'
    ) THEN
        ALTER TABLE budgets ADD CONSTRAINT unique_user_month_budget UNIQUE (user_id, month);
    END IF;
END $$;

-- Create an index for better performance when querying by user and month
CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets (user_id, month);

-- Update existing rows to have the current month name if they don't have a month set
UPDATE budgets 
SET month = TRIM(TO_CHAR(CURRENT_DATE, 'Month'))
WHERE month IS NULL OR month = '';

-- Drop existing functions if they exist (to avoid return type conflicts)
DROP FUNCTION IF EXISTS get_or_create_monthly_budget(UUID);
DROP FUNCTION IF EXISTS update_monthly_budget(UUID, JSONB);

-- Create a function to get or create budget for current month
CREATE OR REPLACE FUNCTION get_or_create_monthly_budget(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  month TEXT,
  monthly_budget_total DECIMAL(10, 2),
  food DECIMAL(10, 2),
  transportation_and_fuel DECIMAL(10, 2),
  entertainment DECIMAL(10, 2),
  utilities DECIMAL(10, 2),
  grocery DECIMAL(10, 2),
  housing DECIMAL(10, 2),
  healthcare DECIMAL(10, 2),
  education DECIMAL(10, 2),
  shopping DECIMAL(10, 2),
  personal_care DECIMAL(10, 2),
  travel DECIMAL(10, 2),
  savings_and_investments DECIMAL(10, 2),
  other DECIMAL(10, 2),
  monthly_savings_goal DECIMAL(10, 2),
  monthly_investment_goal DECIMAL(10, 2),
  achievable_goal TEXT,
  months_to_achieve_goal INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  current_month_name TEXT := TRIM(TO_CHAR(CURRENT_DATE, 'Month'));
  budget_record RECORD;
BEGIN
  -- Try to get existing budget for current month
  SELECT * INTO budget_record FROM budgets 
  WHERE budgets.user_id = p_user_id AND budgets.month = current_month_name;
  
  -- If no budget exists for current month, create one
  IF NOT FOUND THEN
    -- Get the most recent budget for this user to copy values
    SELECT * INTO budget_record FROM budgets 
    WHERE budgets.user_id = p_user_id 
    ORDER BY budgets.month DESC 
    LIMIT 1;
    
    -- If user has previous budgets, copy the values to new month
    IF FOUND THEN
      INSERT INTO budgets (
        user_id, month, monthly_budget_total, food, transportation_and_fuel,
        entertainment, utilities, grocery, housing, healthcare, education,
        shopping, personal_care, travel, savings_and_investments, other,
        monthly_savings_goal, monthly_investment_goal, achievable_goal,
        months_to_achieve_goal
      ) VALUES (
        p_user_id, current_month_name, budget_record.monthly_budget_total,
        budget_record.food, budget_record.transportation_and_fuel,
        budget_record.entertainment, budget_record.utilities, budget_record.grocery,
        budget_record.housing, budget_record.healthcare, budget_record.education,
        budget_record.shopping, budget_record.personal_care, budget_record.travel,
        budget_record.savings_and_investments, budget_record.other,
        budget_record.monthly_savings_goal, budget_record.monthly_investment_goal,
        budget_record.achievable_goal, budget_record.months_to_achieve_goal
      );
    ELSE
      -- First time user, create with default values
      INSERT INTO budgets (user_id, month) VALUES (p_user_id, current_month_name);
    END IF;
  END IF;
  
  -- Return the budget for current month
  RETURN QUERY
  SELECT b.* FROM budgets b 
  WHERE b.user_id = p_user_id AND b.month = current_month_name;
END;
$$ LANGUAGE plpgsql;

-- Create a function to update budget for current month
CREATE OR REPLACE FUNCTION update_monthly_budget(
  p_user_id UUID,
  p_updates JSONB
) RETURNS TABLE (
  id UUID,
  user_id UUID,
  month TEXT,
  monthly_budget_total DECIMAL(10, 2),
  food DECIMAL(10, 2),
  transportation_and_fuel DECIMAL(10, 2),
  entertainment DECIMAL(10, 2),
  utilities DECIMAL(10, 2),
  grocery DECIMAL(10, 2),
  housing DECIMAL(10, 2),
  healthcare DECIMAL(10, 2),
  education DECIMAL(10, 2),
  shopping DECIMAL(10, 2),
  personal_care DECIMAL(10, 2),
  travel DECIMAL(10, 2),
  savings_and_investments DECIMAL(10, 2),
  other DECIMAL(10, 2),
  monthly_savings_goal DECIMAL(10, 2),
  monthly_investment_goal DECIMAL(10, 2),
  achievable_goal TEXT,
  months_to_achieve_goal INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  current_month_name TEXT := TRIM(TO_CHAR(CURRENT_DATE, 'Month'));
  update_query TEXT;
  key TEXT;
  value TEXT;
BEGIN
  -- Ensure budget exists for current month
  PERFORM get_or_create_monthly_budget(p_user_id);
  
  -- Build dynamic update query
  update_query := 'UPDATE budgets SET updated_at = NOW()';
  
  -- Add each field from the JSONB updates
  FOR key, value IN SELECT * FROM jsonb_each_text(p_updates)
  LOOP
    -- Only update valid budget columns
    IF key IN ('monthly_budget_total', 'food', 'transportation_and_fuel', 'entertainment', 
               'utilities', 'grocery', 'housing', 'healthcare', 'education', 'shopping',
               'personal_care', 'travel', 'savings_and_investments', 'other',
               'monthly_savings_goal', 'monthly_investment_goal', 'achievable_goal',
               'months_to_achieve_goal') THEN
      update_query := update_query || ', ' || key || ' = ' || quote_literal(value);
    END IF;
  END LOOP;
  
  update_query := update_query || ' WHERE user_id = ' || quote_literal(p_user_id) || 
                  ' AND month = ' || quote_literal(current_month_name);
  
  -- Execute the update
  EXECUTE update_query;
  
  -- Return the updated budget
  RETURN QUERY
  SELECT b.* FROM budgets b 
  WHERE b.user_id = p_user_id AND b.month = current_month_name;
END;
$$ LANGUAGE plpgsql;
