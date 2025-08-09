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
        // Determine current month/year
        const now = new Date();
        const monthNames = [
          'January','February','March','April','May','June',
          'July','August','September','October','November','December'
        ];
        const currentMonth = monthNames[now.getMonth()];
        const currentYear = now.getFullYear();

        // Fetch the most recent budget for the current month/year
        const { data, error } = await supabase
          .from('budgets')
          .select('monthly_budget_total, budget_month, budget_year, updated_at')
          .eq('user_id', user.id)
          .eq('budget_month', currentMonth)
          .eq('budget_year', currentYear)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

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

  // Subscribe to realtime changes on the budgets table for this user to keep monthlyBudget in sync
  useEffect(() => {
    if (!user) return;

    const monthNames = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December'
    ];
    const now = new Date();
    const currentMonth = monthNames[now.getMonth()];
    const currentYear = now.getFullYear();

    const channel = supabase.channel('budgets-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budgets', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new || payload.old;
          if (!row) return;
          // Only react to current month/year
          if (row.budget_month === currentMonth && Number(row.budget_year) === Number(currentYear)) {
            if (payload.eventType === 'DELETE') {
              // Reset to null if the current month budget was removed
              setMonthlyBudget(null);
            } else {
              setMonthlyBudget(row.monthly_budget_total ?? null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <BudgetContext.Provider value={{ monthlyBudget, setMonthlyBudget, loading }}>
      {children}
    </BudgetContext.Provider>
  );
};

export const useBudget = () => useContext(BudgetContext);