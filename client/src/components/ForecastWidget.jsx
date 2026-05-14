import React, { useEffect, useState } from 'react';
import { TrendingUp, AlertTriangle, CheckCircle2, Calendar, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ForecastWidget = () => {
  const { user } = useAuth();
  const { symbol } = useCurrency();
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/api/coach/forecast/${user.id}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.success) setForecast(data.forecast);
        else setError(data.error || 'Failed to load forecast');
      })
      .catch(err => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [user]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Computing forecast…
        </div>
      </div>
    );
  }

  if (error || !forecast) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <p className="text-sm text-gray-500">Forecast unavailable: {error || 'no data'}</p>
      </div>
    );
  }

  const fmt = (n) => `${symbol}${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const overBudget = forecast.willOverBudget;
  const overCats = forecast.categoryForecasts.filter(c => c.willOverBudget).slice(0, 3);
  const hasBudget = forecast.monthlyBudget > 0;

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Month-End Forecast</h3>
              <p className="text-xs text-orange-100">Where you'll land at the current pace</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs bg-white/20 px-2.5 py-1 rounded-full">
            <Calendar className="h-3 w-3" />
            <span>{forecast.daysRemaining} days left</span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Spent so far" value={fmt(forecast.spentSoFar)} sub={`day ${forecast.daysElapsed}`} />
          <Stat label="Projected total" value={fmt(forecast.projectedTotal)} sub="end of month"
                tone={overBudget ? 'red' : 'green'} />
          <Stat label={hasBudget ? 'Budget' : 'No budget set'} value={hasBudget ? fmt(forecast.monthlyBudget) : '—'} sub="this month" />
        </div>

        {hasBudget && (
          <div className={`rounded-xl p-4 flex items-start gap-3 ${
            overBudget ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
          }`}>
            {overBudget
              ? <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              : <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />}
            <div className="text-sm">
              <p className={`font-semibold ${overBudget ? 'text-red-800' : 'text-green-800'}`}>
                {overBudget
                  ? `Projected to exceed budget by ${fmt(forecast.overByAmount)}`
                  : `On track — ${fmt(forecast.monthlyBudget - forecast.projectedTotal)} headroom`}
              </p>
              <p className={`text-xs mt-0.5 ${overBudget ? 'text-red-700' : 'text-green-700'}`}>
                Based on a {fmt(forecast.spentSoFar / Math.max(1, forecast.daysElapsed))}/day average over the first {forecast.daysElapsed} day{forecast.daysElapsed === 1 ? '' : 's'}.
              </p>
            </div>
          </div>
        )}

        {overCats.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Categories trending over</h4>
            <div className="space-y-2">
              {overCats.map(c => (
                <div key={c.category} className="flex items-center justify-between bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{c.category}</p>
                    <p className="text-xs text-gray-500">{fmt(c.spentSoFar)} of {fmt(c.categoryBudget)} so far</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-600">+{fmt(c.overByAmount)}</p>
                    <p className="text-[10px] text-red-500">projected over</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Stat = ({ label, value, sub, tone }) => (
  <div className="bg-gray-50 rounded-xl p-3">
    <p className="text-[11px] text-gray-500 font-medium">{label}</p>
    <p className={`text-lg font-bold ${tone === 'red' ? 'text-red-600' : tone === 'green' ? 'text-green-600' : 'text-gray-900'}`}>
      {value}
    </p>
    <p className="text-[10px] text-gray-400">{sub}</p>
  </div>
);

export default ForecastWidget;
