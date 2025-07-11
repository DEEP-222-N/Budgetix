import React, { createContext, useContext, useState } from "react";

const BudgetContext = createContext();

export const BudgetProvider = ({ children }) => {
  const [monthlyBudget, setMonthlyBudget] = useState(2500);
  return (
    <BudgetContext.Provider value={{ monthlyBudget, setMonthlyBudget }}>
      {children}
    </BudgetContext.Provider>
  );
};

export const useBudget = () => useContext(BudgetContext); 