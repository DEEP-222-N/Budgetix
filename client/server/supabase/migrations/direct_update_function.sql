-- Direct function to update financial overview total expenses
-- This can be called directly from your frontend code

-- Create a simple RPC function to update total expenses (current month only)
CREATE OR REPLACE FUNCTION public.update_total_expenses(user_id_param UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_expense DECIMAL(15, 2);
  result JSONB;
BEGIN
  -- Calculate total expenses for this user for the CURRENT MONTH only
  SELECT COALESCE(SUM(amount), 0) INTO total_expense
  FROM expenses
  WHERE user_id = user_id_param
    AND DATE_TRUNC('month', date::date) = DATE_TRUNC('month', CURRENT_DATE);
  
  -- Update the financial_overview table
  UPDATE financial_overview
  SET 
    total_expenses = total_expense,
    updated_at = now()
  WHERE user_id = user_id_param
  RETURNING to_jsonb(financial_overview) INTO result;
  
  -- If no row exists, insert one
  IF result IS NULL THEN
    INSERT INTO financial_overview (user_id, total_expenses)
    VALUES (user_id_param, total_expense)
    RETURNING to_jsonb(financial_overview) INTO result;
  END IF;
  
  RETURN result;
END;
$$;
