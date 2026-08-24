import { useState, useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { brainApi } from '../api';

// ── Markdown renderer ─────────────────────────────────────────────────────────

function parseLine(text) {
  const parts = [];
  let remaining = text;
  let key = 0;
  while (remaining.length) {
    const bold = remaining.match(/^([\s\S]*?)\*\*([\s\S]*?)\*\*([\s\S]*)$/);
    const code = remaining.match(/^([\s\S]*?)`([^`]+)`([\s\S]*)$/);
    if (bold && (!code || bold[1].length <= code[1].length)) {
      if (bold[1]) parts.push(bold[1]);
      parts.push(<strong key={key++}>{bold[2]}</strong>);
      remaining = bold[3];
    } else if (code) {
      if (code[1]) parts.push(code[1]);
      parts.push(
        <code key={key++} style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: 3, fontFamily: 'monospace', fontSize: 11 }}>
          {code[2]}
        </code>
      );
      remaining = code[3];
    } else {
      parts.push(remaining);
      break;
    }
  }
  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
}

function Markdown({ text }) {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.65 }}>
      {(text || '').split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <div key={i} style={{ fontWeight: 700, marginTop: 10, marginBottom: 3 }}>{parseLine(line.slice(4))}</div>;
        if (line.startsWith('## ')) return <div key={i} style={{ fontWeight: 700, fontSize: 14, marginTop: 12, marginBottom: 4, color: 'var(--purple)' }}>{parseLine(line.slice(3))}</div>;
        if (line.startsWith('# ')) return <div key={i} style={{ fontWeight: 800, fontSize: 15, marginTop: 12, marginBottom: 4, color: 'var(--purple)' }}>{parseLine(line.slice(2))}</div>;
        if (line.startsWith('- ') || line.startsWith('* ')) return <div key={i} style={{ paddingLeft: 12, marginTop: 2 }}>• {parseLine(line.slice(2))}</div>;
        if (/^\d+\. /.test(line)) {
          const num = line.match(/^\d+/)[0];
          return <div key={i} style={{ paddingLeft: 12, marginTop: 2 }}>{num}. {parseLine(line.replace(/^\d+\. /, ''))}</div>;
        }
        if (line === '') return <div key={i} style={{ height: 6 }} />;
        return <div key={i} style={{ marginTop: 2 }}>{parseLine(line)}</div>;
      })}
    </div>
  );
}

// ── Suggested prompts ─────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'What is my best performing strategy?',
  'Show my win rate by ticker',
  'Where am I losing the most money?',
  'How is my risk management?',
];

// ── Brain component ───────────────────────────────────────────────────────────

export default function Brain({ accountId }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg = { role: 'user', content: msg };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const res = await brainApi.chat(nextMessages, accountId);
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.response }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.response?.data?.detail || e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}>
      {open ? (
        <div style={{
          width: 400, height: 560,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}>
          {/* Header */}
          <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '16px 16px 0 0', background: 'linear-gradient(135deg, color-mix(in oklch, var(--accent) 16%, transparent), color-mix(in oklch, var(--green) 10%, transparent))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, var(--green), var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🧠</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Brain</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>AI Trading Coach</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 && (
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
                  Hi! I'm Brain, your AI trading coach. Ask me anything about your performance, patterns, or strategy.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => send(s)}
                      style={{
                        textAlign: 'left', padding: '7px 12px', borderRadius: 8, fontSize: 12,
                        background: 'rgba(91,176,215,0.08)', border: '1px solid rgba(91,176,215,0.2)',
                        color: 'var(--text)', cursor: 'pointer',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '88%',
                  padding: '8px 12px',
                  borderRadius: msg.role === 'user' ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                  background: msg.role === 'user' ? 'var(--purple)' : 'var(--bg-primary)',
                  border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                  color: 'var(--text)',
                }}>
                  {msg.role === 'assistant' ? <Markdown text={msg.content} /> : <div style={{ fontSize: 13 }}>{msg.content}</div>}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ alignSelf: 'flex-start', padding: '10px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '14px 14px 14px 3px', display: 'flex', gap: 4, alignItems: 'center' }}>
                {[0, 1, 2].map(j => (
                  <div key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--purple)', animation: `pulse 1s ${j * 0.2}s infinite` }} />
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 14px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask Brain anything..."
              disabled={loading}
              style={{ flex: 1, fontSize: 13 }}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              style={{
                background: 'var(--purple)', border: 'none', borderRadius: 8,
                padding: '8px 12px', cursor: 'pointer', color: 'white',
                opacity: loading || !input.trim() ? 0.5 : 1,
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          title="Open Brain — AI Trading Coach"
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--green), var(--accent))',
            border: 'none', cursor: 'pointer', fontSize: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px oklch(0.72 0.10 230 / 0.4)',
            transition: 'transform 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          🧠
        </button>
      )}
    </div>
  );
}
