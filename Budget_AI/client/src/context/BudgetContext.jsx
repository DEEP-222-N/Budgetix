import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "../lib/supabase";

const BudgetContext = createContext();

export const BudgetProvider = ({ children }) => {
  const [monthlyBudget, setMonthlyBudget] = useState(null); // Initialize as null to prevent flashing default value
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    // Fetch the monthly budget from Supabase when user changes
    const fetchBudget = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('budgets')
          .select('monthly_budget_total')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          console.error('Error fetching budget:', error);
        } else if (data) {
          // Update the monthly budget from Supabase
          setMonthlyBudget(data.monthly_budget_total);
        }
      } catch (err) {
        console.error('Unexpected error fetching budget:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBudget();
  }, [user]);

  return (
    <BudgetContext.Provider value={{ monthlyBudget, setMonthlyBudget, loading }}>
      {children}
    </BudgetContext.Provider>
  );
};

export const useBudget = () => useContext(BudgetContext);