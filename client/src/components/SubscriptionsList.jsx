import React, { useEffect, useState } from 'react';
import { RefreshCw, Loader2, Inbox } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const CADENCE_COLORS = {
  weekly: 'bg-blue-100 text-blue-800',
  monthly: 'bg-purple-100 text-purple-800',
  quarterly: 'bg-amber-100 text-amber-800',
  yearly: 'bg-rose-100 text-rose-800'
};

const SubscriptionsList = () => {
  const { user } = useAuth();
  const { symbol } = useCurrency();
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    if (!user) return;
    setLoading(true);
    fetch(`${API_BASE}/api/coach/subscriptions/${user.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setSubs(data.subscriptions || []);
        else setError(data.error || 'Failed to load subscriptions');
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [user]);

  const fmt = (n) => `${symbol}${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const monthlyTotal = subs.reduce((s, x) => s + x.monthlyEquivalent, 0);

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Recurring Charges</h3>
            <p className="text-xs text-indigo-100">Detected from your expense history</p>
          </div>
        </div>
        <button onClick={load} className="p-2 hover:bg-white/20 rounded-lg" title="Refresh" disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Scanning expenses…</div>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : subs.length === 0 ? (
          <div className="text-center py-8">
            <Inbox className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No subscriptions detected yet.</p>
            <p className="text-xs text-gray-400 mt-1">We need at least 3 occurrences of a similar charge to flag it.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100">
              <p className="text-xs text-purple-700 font-medium">Estimated monthly spend on subscriptions</p>
              <p className="text-2xl font-bold text-purple-900">{fmt(monthlyTotal)}</p>
            </div>
            <div className="space-y-2">
              {subs.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 truncate">{s.name}</p>
                      <span className={`text-[10px] uppercase font-bold tracking-wide px-1.5 py-0.5 rounded ${CADENCE_COLORS[s.cadence] || 'bg-gray-100 text-gray-700'}`}>{s.cadence}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{s.occurrences} charges · last on {s.lastCharged} · {s.category}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-base font-bold text-gray-900">{fmt(s.averageAmount)}</p>
                    <p className="text-[10px] text-gray-500">≈ {fmt(s.monthlyEquivalent)}/mo</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SubscriptionsList;
