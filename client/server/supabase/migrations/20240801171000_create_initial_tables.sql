-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create financial_overview table
CREATE TABLE IF NOT EXISTS public.financial_overview (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  total_monthly_income DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_savings DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_investment_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_expenses DECIMAL(15, 2) NOT NULL DEFAULT 0,
  budgexp_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create budget_suggestions table
CREATE TABLE IF NOT EXISTS public.budget_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  suggestion JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_financial_overview_user_id ON public.financial_overview(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_suggestions_user_id ON public.budget_suggestions(user_id);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to update timestamps
CREATE TRIGGER update_users_modtime
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_financial_overview_modtime
BEFORE UPDATE ON public.financial_overview
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Enable Row Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_overview ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_suggestions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view their financial overview" ON public.financial_overview
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their financial overview" ON public.financial_overview
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their financial overview" ON public.financial_overview
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their budget suggestions" ON public.budget_suggestions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert budget suggestions" ON public.budget_suggestions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
