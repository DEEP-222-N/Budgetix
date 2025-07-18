
-- Create a new budget table in Supabase
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_budget_total DECIMAL(10, 2) NOT NULL,
  food DECIMAL(10, 2) DEFAULT 0,
  transportation & fuel DECIMAL(10, 2) DEFAULT 0,
  entertainment DECIMAL(10, 2) DEFAULT 0,
  utilities DECIMAL(10, 2) DEFAULT 0,
  grocery DECIMAL(10, 2) DEFAULT 0,
  housing DECIMAL(10, 2) DEFAULT 0,
  healthcare DECIMAL(10, 2) DEFAULT 0,
  education DECIMAL(10, 2) DEFAULT 0,
  shopping DECIMAL(10, 2) DEFAULT 0,
  personal_care DECIMAL(10, 2) DEFAULT 0,
  travel DECIMAL(10, 2) DEFAULT 0,
  savings & investments DECIMAL(10, 2) DEFAULT 0,
  other DECIMAL(10, 2) DEFAULT 0,
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

