import React, { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const AnomalyAlerts = () => {
  const { user } = useAuth();
  const { symbol } = useCurrency();
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('dismissedAnomalies') || '[]')); }
    catch { return new Set(); }
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/api/coach/anomalies/${user.id}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.success) setAnomalies(data.anomalies || []);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [user]);

  const visible = anomalies.filter(a => !dismissed.has(a.id));

  const dismiss = (id) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    localStorage.setItem('dismissedAnomalies', JSON.stringify([...next]));
  };

  if (loading) return null;

  if (visible.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-green-600 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-green-800">No unusual spending detected</p>
          <p className="text-xs text-green-700">Your recent expenses look normal vs your 90-day baseline.</p>
        </div>
      </div>
    );
  }

  const fmt = (n) => `${symbol}${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const shown = expanded ? visible : visible.slice(0, 2);

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="bg-amber-500 p-2 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-amber-900">Unusual Spending</h3>
          <p className="text-xs text-amber-700">{visible.length} expense{visible.length === 1 ? '' : 's'} flagged in the last 14 days</p>
        </div>
      </div>

      <div className="space-y-2">
        {shown.map(a => (
          <div key={a.id} className="bg-white rounded-lg p-3 border border-amber-100 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="font-semibold text-gray-900 truncate">{a.description}</p>
                <span className="text-[10px] uppercase tracking-wide bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">{a.category}</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">{a.reason}</p>
              <p className="text-[10px] text-gray-400 mt-1">{a.date} · Typical: {fmt(a.baselineMedian)}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-bold text-amber-700">{fmt(a.amount)}</p>
              <button onClick={() => dismiss(a.id)} className="text-[10px] text-gray-400 hover:text-gray-700">dismiss</button>
            </div>
          </div>
        ))}
      </div>

      {visible.length > 2 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-3 w-full text-xs text-amber-700 hover:text-amber-900 font-medium flex items-center justify-center gap-1"
        >
          {expanded ? 'Show less' : `Show ${visible.length - 2} more`}
          <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
};

export default AnomalyAlerts;
