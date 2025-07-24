-- Fix budget table column names to be valid SQL identifiers
-- Drop the existing table if it has invalid column names
DROP TABLE IF EXISTS budgets CASCADE;

-- Create a new budget table with proper column names
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_budget_total DECIMAL(10, 2) NOT NULL DEFAULT 0,
  food DECIMAL(10, 2) DEFAULT 0,
  transportation_and_fuel DECIMAL(10, 2) DEFAULT 0,
  entertainment DECIMAL(10, 2) DEFAULT 0,
  utilities DECIMAL(10, 2) DEFAULT 0,
  grocery DECIMAL(10, 2) DEFAULT 0,
  housing DECIMAL(10, 2) DEFAULT 0,
  healthcare DECIMAL(10, 2) DEFAULT 0,
  education DECIMAL(10, 2) DEFAULT 0,
  shopping DECIMAL(10, 2) DEFAULT 0,
  personal_care DECIMAL(10, 2) DEFAULT 0,
  travel DECIMAL(10, 2) DEFAULT 0,
  savings_and_investments DECIMAL(10, 2) DEFAULT 0,
  other DECIMAL(10, 2) DEFAULT 0,
  monthly_savings_goal DECIMAL(10, 2) DEFAULT 0,
  monthly_investment_goal DECIMAL(10, 2) DEFAULT 0,
  achievable_goal TEXT,
  months_to_achieve_goal INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_budget UNIQUE (user_id)
);

-- Add RLS (Row Level Security) policy
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to only see and modify their own budget
CREATE POLICY user_budget_policy ON budgets
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create an index for better performance
CREATE INDEX idx_budgets_user_id ON budgets(user_id);

-- Add a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_budgets_updated_at 
    BEFORE UPDATE ON budgets 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
