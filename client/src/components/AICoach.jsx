import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Loader2, ChevronDown, Wrench, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const TOOL_LABELS = {
  get_spending_summary: 'Reading your spending',
  get_forecast: 'Calculating forecast',
  get_anomalies: 'Scanning for anomalies',
  get_subscriptions: 'Finding subscriptions',
  add_expense: 'Logging expense',
  update_category_budget: 'Updating budget'
};

const SUGGESTED_PROMPTS = [
  'How am I tracking this month?',
  'What are my biggest expenses?',
  'Forecast where I\'ll end up',
  'Find my subscriptions',
  'Anything unusual recently?'
];

const AICoach = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // [{role, content, toolEvents: [...]}]
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  if (!user) return null;

  const sendMessage = async (text) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput('');
    const newMessages = [...messages, { role: 'user', content }];
    setMessages(newMessages);
    setSending(true);

    // Append a placeholder assistant message we'll stream into
    const assistantIdx = newMessages.length;
    setMessages(m => [...m, { role: 'assistant', content: '', toolEvents: [] }]);

    try {
      const wireMessages = newMessages.map(({ role, content }) => ({ role, content }));
      const resp = await fetch(`${API_BASE}/api/coach/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, messages: wireMessages })
      });

      if (!resp.ok || !resp.body) {
        const errText = await resp.text().catch(() => '');
        throw new Error(errText || `HTTP ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        for (const block of lines) {
          const dataLine = block.split('\n').find(l => l.startsWith('data:'));
          if (!dataLine) continue;
          let event;
          try { event = JSON.parse(dataLine.slice(5).trim()); } catch { continue; }
          setMessages(m => {
            const copy = [...m];
            const msg = { ...copy[assistantIdx] };
            msg.toolEvents = msg.toolEvents || [];
            if (event.type === 'token') {
              msg.content = (msg.content || '') + event.content;
            } else if (event.type === 'tool_call') {
              msg.toolEvents.push({ name: event.name, args: event.args, status: 'running' });
            } else if (event.type === 'tool_result') {
              for (let i = msg.toolEvents.length - 1; i >= 0; i--) {
                if (msg.toolEvents[i].name === event.name && msg.toolEvents[i].status === 'running') {
                  msg.toolEvents[i] = { ...msg.toolEvents[i], status: 'done', result: event.result };
                  break;
                }
              }
            } else if (event.type === 'error') {
              msg.error = event.message;
            }
            copy[assistantIdx] = msg;
            return copy;
          });
        }
      }
    } catch (err) {
      setMessages(m => {
        const copy = [...m];
        copy[assistantIdx] = { ...(copy[assistantIdx] || {}), error: err.message || 'Failed to chat' };
        return copy;
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating launcher button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 group flex items-center gap-2 bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-2xl rounded-full px-5 py-3 transition-all duration-300 hover:scale-105"
          aria-label="Open AI Coach"
        >
          <div className="relative">
            <Sparkles className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
          </div>
          <span className="font-semibold text-sm">Ask Coach</span>
        </button>
      )}

      {/* Slide-in panel */}
      {open && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white shadow-2xl border-l border-gray-200 flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-br from-purple-600 to-blue-600 text-white px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Budgetix Coach</h2>
                <p className="text-xs text-purple-100">Your AI financial assistant</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-2 hover:bg-white/20 rounded-lg" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gradient-to-b from-slate-50 to-white">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full mb-3">
                  <Sparkles className="h-7 w-7 text-purple-600" />
                </div>
                <h3 className="font-bold text-gray-800 mb-1">Hi! I'm your financial coach.</h3>
                <p className="text-sm text-gray-600 mb-4">I know your expenses, budgets and goals. Ask me anything.</p>
                <div className="flex flex-col gap-2 max-w-xs mx-auto">
                  {SUGGESTED_PROMPTS.map(p => (
                    <button
                      key={p}
                      onClick={() => sendMessage(p)}
                      className="text-left text-sm px-4 py-2.5 bg-white border border-gray-200 hover:border-purple-400 hover:bg-purple-50 rounded-xl transition-all"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}

            {sending && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && !messages[messages.length - 1].content && (!messages[messages.length - 1].toolEvents || messages[messages.length - 1].toolEvents.length === 0) && (
              <div className="flex items-center gap-2 text-gray-500 text-sm pl-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking…
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-gray-200 p-3 bg-white">
            <form
              onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
              className="flex items-end gap-2"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
                placeholder="Ask about your spending, log an expense, set a budget…"
                rows={1}
                className="flex-1 resize-none px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 text-sm max-h-32"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="p-2.5 bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                aria-label="Send"
              >
                {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </form>
            <p className="text-[10px] text-gray-400 text-center mt-2">Coach can read your data and update budgets when you ask.</p>
          </div>
        </div>
      )}
    </>
  );
};

const MessageBubble = ({ msg }) => {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] ${isUser ? 'order-2' : ''}`}>
        {!isUser && msg.toolEvents && msg.toolEvents.length > 0 && (
          <div className="mb-2 space-y-1.5">
            {msg.toolEvents.map((te, j) => (
              <ToolEventChip key={j} event={te} />
            ))}
          </div>
        )}
        {(msg.content || msg.error || isUser) && (
          <div
            className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
              isUser
                ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-br-sm'
                : msg.error
                  ? 'bg-red-50 border border-red-200 text-red-700 rounded-bl-sm'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
            }`}
          >
            {msg.error ? `Error: ${msg.error}` : msg.content || (isUser ? '' : '…')}
          </div>
        )}
      </div>
    </div>
  );
};

const ToolEventChip = ({ event }) => {
  const [open, setOpen] = useState(false);
  const label = TOOL_LABELS[event.name] || event.name;
  return (
    <div className="bg-purple-50 border border-purple-200 rounded-xl text-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-purple-800 hover:bg-purple-100 transition-colors"
      >
        {event.status === 'running'
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <Check className="h-3.5 w-3.5 text-green-600" />}
        <Wrench className="h-3.5 w-3.5" />
        <span className="font-medium flex-1 text-left">{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && event.result && (
        <pre className="px-3 py-2 bg-white border-t border-purple-100 text-[10px] text-gray-700 overflow-x-auto max-h-40">
{JSON.stringify(event.result, null, 2)}
        </pre>
      )}
    </div>
  );
};

export default AICoach;
