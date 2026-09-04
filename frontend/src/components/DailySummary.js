import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, RotateCcw, Calendar,
  TrendingUp, TrendingDown, CheckCircle, XCircle, Target, Brain,
  BookOpen, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import { tradesApi, kpisApi, diaryApi, dailySummaryApi, weeklySummaryApi } from '../api';
import KPICard from './KPICard';
import {
  BarChart, Bar, XAxis, YAxis, ReferenceLine,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';

// ── date helpers ──────────────────────────────────────────────────────────────
function prevTradingDay(iso) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}
function nextTradingDay(iso) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}
function formatDateLabel(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
function fmt$(v) {
  const n = Number(v || 0);
  return (n >= 0 ? '+$' : '-$') + Math.abs(n).toFixed(2);
}

// ── discipline score (client-side) ────────────────────────────────────────────
function computeDiscipline(trades) {
  let score = 100;
  const notes = [];
  for (const t of trades) {
    if (t.mistakes) { score -= 15; notes.push({ label: `${t.ticker}: mistakes noted`, delta: -15 }); }
    const emo = (t.emotional_state || '').toLowerCase();
    if (['revenge', 'frustrated', 'anxious'].some(e => emo.includes(e))) {
      score -= 10;
      notes.push({ label: `${t.ticker}: negative emotional state`, delta: -10 });
    }
    if (!t.stop_loss) { score -= 10; notes.push({ label: `${t.ticker}: no stop loss`, delta: -10 }); }
    if (!t.strategy) { score -= 5; notes.push({ label: `${t.ticker}: no strategy tagged`, delta: -5 }); }
    if (t.r_multiple > 1) { score += 5; notes.push({ label: `${t.ticker}: R > 1`, delta: +5 }); }
  }
  return { score: Math.max(0, Math.min(100, score)), notes };
}
function disciplineLabel(s) {
  if (s >= 85) return { text: 'Excellent', color: 'var(--green)' };
  if (s >= 70) return { text: 'Good', color: 'var(--blue)' };
  if (s >= 50) return { text: 'Needs Work', color: 'var(--orange)' };
  return { text: 'Review Day', color: 'var(--red)' };
}

// ── grade color ───────────────────────────────────────────────────────────────
function gradeColor(g) {
  if (!g) return 'var(--text-muted)';
  if (g.startsWith('A')) return 'var(--green)';
  if (g.startsWith('B')) return 'var(--blue)';
  if (g.startsWith('C')) return 'var(--orange)';
  return 'var(--red)';
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function Sk({ w = '100%', h = 16, style = {} }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: 4, ...style }} />;
}

// ── Timeline bar ─────────────────────────────────────────────────────────────
const MARKET_OPEN = 9 * 60 + 30; // 9:30 in minutes
const MARKET_CLOSE = 16 * 60;    // 16:00
const MARKET_MINS = MARKET_CLOSE - MARKET_OPEN;

function parseTimeMins(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function TradeTimeline({ trades }) {
  const tradesWithTime = trades.filter(t => {
    const execs = t.executions || [];
    return execs.some(e => e.time);
  });
  if (!tradesWithTime.length) return null;

  return (
    <div className="card" style={{ padding: '20px 24px 24px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
        Trade Timeline
      </div>
      <div style={{ position: 'relative', height: 64, background: 'var(--bg-primary)', borderRadius: 8, overflow: 'visible' }}>
        {/* Hour ticks */}
        {[10, 11, 12, 13, 14, 15].map(h => {
          const mins = h * 60 - MARKET_OPEN;
          const pct = (mins / MARKET_MINS) * 100;
          return (
            <div key={h} style={{
              position: 'absolute', left: `${pct}%`, top: 0, bottom: 0,
              borderLeft: '1px dashed var(--border)', opacity: 0.5,
            }}>
              <span style={{ position: 'absolute', bottom: -18, fontSize: 11, color: 'var(--text-muted)', transform: 'translateX(-50%)' }}>
                {h > 12 ? `${h - 12}pm` : `${h}am`}
              </span>
            </div>
          );
        })}
        {/* Trade bars */}
        {tradesWithTime.map(t => {
          const execs = t.executions || [];
          const times = execs.map(e => parseTimeMins(e.time)).filter(Boolean);
          if (!times.length) return null;
          const first = Math.min(...times);
          const last = Math.max(...times);
          const leftMin = Math.max(first - MARKET_OPEN, 0);
          const widthMin = Math.max(last - first, 5); // min 5 min width
          const leftPct = (leftMin / MARKET_MINS) * 100;
          const widthPct = (widthMin / MARKET_MINS) * 100;
          const pnl = Number(t.net_pnl || 0);
          const color = pnl >= 0 ? 'var(--green)' : 'var(--red)';
          return (
            <div
              key={t.trade_group}
              title={`${t.ticker} ${fmt$(pnl)}`}
              style={{
                position: 'absolute',
                left: `${leftPct}%`,
                width: `${widthPct}%`,
                top: 12, bottom: 12,
                background: color,
                opacity: 0.75,
                borderRadius: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#fff',
                overflow: 'hidden',
                cursor: 'default',
              }}
            >
              {widthPct > 3 ? t.ticker : ''}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22, fontSize: 11, color: 'var(--text-muted)' }}>
        <span>9:30am</span><span>4:00pm</span>
      </div>
    </div>
  );
}

// ── R-Multiple chart ──────────────────────────────────────────────────────────
function RMultipleChart({ trades }) {
  const data = trades.filter(t => t.r_multiple != null).map(t => ({
    name: t.ticker,
    r: Number(t.r_multiple),
  }));
  if (!data.length) return null;
  return (
    <div className="card" style={{ padding: '20px 24px 24px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
        R-Multiple by Trade
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
          <ReferenceLine y={0} stroke="var(--border)" />
          <Tooltip
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
            formatter={(v) => [`${v.toFixed(2)}R`, 'R-Multiple']}
          />
          <Bar dataKey="r" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.r >= 0 ? 'var(--green)' : 'var(--red)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Discipline Score card ─────────────────────────────────────────────────────
function DisciplineCard({ trades }) {
  const { score, notes } = computeDiscipline(trades);
  const { text, color } = disciplineLabel(score);
  return (
    <div className="card" style={{ padding: '20px 24px 24px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
        Discipline Score
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 52, fontWeight: 800, color, lineHeight: 1 }}>{score}</div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color }}>{text}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>out of 100</div>
        </div>
      </div>
      <div style={{
        height: 8, borderRadius: 4, background: 'var(--bg-primary)',
        marginBottom: 16, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${score}%`, borderRadius: 4,
          background: color, transition: 'width 0.6s ease',
        }} />
      </div>
      {notes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {notes.map((n, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ color: n.delta > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600, minWidth: 32 }}>
                {n.delta > 0 ? '+' : ''}{n.delta}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>{n.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Historical Comparison ─────────────────────────────────────────────────────
function HistoricalComparison({ kpis, allTimeKpis }) {
  if (!kpis || !allTimeKpis) return null;
  const items = [
    {
      label: 'Win Rate',
      day: kpis.win_rate,
      all: allTimeKpis.win_rate,
      fmt: v => `${Number(v || 0).toFixed(1)}%`,
      delta: (d, a) => `${(d - a) >= 0 ? '+' : ''}${(d - a).toFixed(1)}pp`,
    },
    {
      label: 'Profit Factor',
      day: kpis.profit_factor,
      all: allTimeKpis.profit_factor,
      fmt: v => v == null ? '∞' : Number(v).toFixed(2),
      delta: (d, a) => d == null || a == null ? '' : `${(d - a) >= 0 ? '+' : ''}${(d - a).toFixed(2)}x`,
    },
    {
      label: 'Avg Win',
      day: kpis.avg_win,
      all: allTimeKpis.avg_win,
      fmt: v => `$${Number(v || 0).toFixed(0)}`,
      delta: (d, a) => `${(d - a) >= 0 ? '+' : ''}$${Math.abs(d - a).toFixed(0)}`,
    },
    {
      label: 'Net P&L',
      day: kpis.total_net_pnl,
      all: null,
      fmt: v => (v >= 0 ? '+$' : '-$') + Math.abs(Number(v || 0)).toFixed(2),
      delta: null,
    },
  ];
  return (
    <div style={{
      display: 'flex', gap: 12, flexWrap: 'wrap',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '14px 20px',
      marginBottom: 24,
    }}>
      {items.map(it => {
        const diff = it.all != null ? (Number(it.day || 0) - Number(it.all || 0)) : null;
        const pos = diff >= 0;
        return (
          <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 140px' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{it.label}:</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{it.fmt(it.day)}</span>
            {diff != null && (
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: pos ? 'var(--green)' : 'var(--red)',
                display: 'flex', alignItems: 'center', gap: 2,
              }}>
                {pos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {it.delta(Number(it.day || 0), Number(it.all || 0))} vs avg
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── AI Summary panel ──────────────────────────────────────────────────────────
function AISummaryPanel({ summary, loading }) {
  if (loading) {
    return (
      <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Brain size={16} color="var(--purple)" />
          <span style={{ fontWeight: 700, fontSize: 15 }}>AI Summary</span>
        </div>
        <Sk h={14} />
        <Sk h={14} w="85%" />
        <Sk h={14} w="70%" />
        <Sk h={14} style={{ marginTop: 8 }} />
        <Sk h={14} w="90%" />
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>Analyzing your trades...</div>
      </div>
    );
  }
  if (!summary) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Brain size={16} color="var(--purple)" />
          <span style={{ fontWeight: 700, fontSize: 15 }}>AI Summary</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No trades to summarize for this day.</div>
      </div>
    );
  }

  const tradeGradeMap = {};
  (summary.trade_grades || []).forEach(g => { tradeGradeMap[g.trade_group] = g; });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Overall grade + narrative */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Brain size={16} color="var(--purple)" />
          <span style={{ fontWeight: 700, fontSize: 15 }}>AI Coaching Report</span>
          <div style={{
            marginLeft: 'auto',
            fontSize: 22, fontWeight: 800,
            color: gradeColor(summary.overall_grade),
            background: 'var(--bg-primary)', borderRadius: 8,
            padding: '4px 12px', lineHeight: 1.4,
          }}>
            {summary.overall_grade || '?'}
          </div>
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)', marginBottom: 12 }}>{summary.narrative}</p>
        {summary.mental_game && (
          <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-muted)', fontStyle: 'italic' }}>{summary.mental_game}</p>
        )}
      </div>

      {/* Strengths */}
      {summary.strengths?.length > 0 && (
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Strengths
          </div>
          {summary.strengths.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13 }}>
              <CheckCircle size={14} color="var(--green)" style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}

      {/* Mistakes */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Mistakes
        </div>
        {(summary.mistakes?.length > 0) ? summary.mistakes.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13 }}>
            <XCircle size={14} color="var(--red)" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{m}</span>
          </div>
        )) : (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No mistakes flagged.</div>
        )}
      </div>

      {/* Coaching / Tomorrow's Focus */}
      {summary.coaching?.length > 0 && (
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Tomorrow's Focus
          </div>
          {summary.coaching.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13 }}>
              <Target size={14} color="var(--purple)" style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{c}</span>
            </div>
          ))}
        </div>
      )}

      {/* Patterns */}
      {summary.patterns?.length > 0 && (
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Patterns
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {summary.patterns.map((p, i) => (
              <span key={i} style={{
                fontSize: 12, padding: '4px 10px',
                background: 'var(--purple-dim)', color: 'var(--purple)',
                borderRadius: 20, border: '1px solid rgba(91,176,215,0.3)',
              }}>{p}</span>
            ))}
          </div>
        </div>
      )}

      {/* Trade Grades */}
      {summary.trade_grades?.length > 0 && (
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Trade Grades
          </div>
          {summary.trade_grades.map((tg, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <span style={{
                fontSize: 12, fontWeight: 700,
                background: 'var(--bg-primary)', borderRadius: 6,
                padding: '2px 8px', color: 'var(--text)',
                flexShrink: 0,
              }}>{tg.ticker}</span>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: gradeColor(tg.grade),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0,
              }}>{tg.grade?.[0] || '?'}</div>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{tg.one_line}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DailySummary({ accountId, date, onDateChange, onOpenDetail }) {
  const [trades, setTrades] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [diary, setDiary] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [cbDismissed, setCbDismissed] = useState(false);
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const allTimeKpisRef = useRef(null);

  const today = new Date().toISOString().split('T')[0];

  const fetchAllTimeKpis = useCallback(async () => {
    if (allTimeKpisRef.current) return;
    try {
      const params = {};
      if (accountId != null) params.account_id = accountId;
      const res = await kpisApi.get(params);
      allTimeKpisRef.current = res.data;
    } catch (e) {
      console.error('Failed to load all-time kpis', e);
    }
  }, [accountId]);

  const fetchDay = useCallback(async (d) => {
    setLoading(true);
    setSummaryLoading(true);
    setSummary(null);
    setCbDismissed(false);
    setWeeklySummary(null);
    setWeeklyOpen(false);
    try {
      const params = { date_from: d, date_to: d };
      if (accountId != null) params.account_id = accountId;

      const [tradesRes, kpisRes, diaryRes] = await Promise.all([
        tradesApi.list(params),
        kpisApi.get(params),
        diaryApi.list(accountId != null ? { account_id: accountId } : {}),
      ]);

      // Merge trade_analysis fields if present
      const rawTrades = tradesRes.data || [];
      setTrades(rawTrades);
      setKpis(kpisRes.data || null);

      const diaryEntries = diaryRes.data || [];
      const dayDiary = diaryEntries.find(e => e.entry_date === d) || null;
      setDiary(dayDiary);
    } catch (e) {
      console.error('Failed to load day data', e);
    } finally {
      setLoading(false);
    }

    // Fetch AI summary separately (can be slow)
    try {
      const sumParams = { date: d };
      if (accountId != null) sumParams.account_id = accountId;
      const sumRes = await dailySummaryApi.get(sumParams);
      setSummary(sumRes.data);
    } catch (e) {
      console.error('Failed to load summary', e);
    } finally {
      setSummaryLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchAllTimeKpis();
  }, [fetchAllTimeKpis]);

  useEffect(() => {
    fetchDay(date);
  }, [date, fetchDay]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    setSummaryLoading(true);
    setSummary(null);
    try {
      const params = { date, force: true };
      if (accountId != null) params.account_id = accountId;
      const res = await dailySummaryApi.get(params);
      setSummary(res.data);
    } catch (e) {
      console.error('Regenerate failed', e);
    } finally {
      setRegenerating(false);
      setSummaryLoading(false);
    }
  };

  const handleGenerateWeekly = async (force = false) => {
    setWeeklyLoading(true);
    setWeeklyOpen(true);
    try {
      const params = { date, force };
      if (accountId != null) params.account_id = accountId;
      const res = await weeklySummaryApi.get(params);
      setWeeklySummary(res.data);
    } catch (e) {
      console.error('Weekly summary failed', e);
    } finally {
      setWeeklyLoading(false);
    }
  };

  // Consecutive losing trades from end of today's list
  const consecutiveLosses = (() => {
    let count = 0;
    for (let i = trades.length - 1; i >= 0; i--) {
      if ((trades[i].net_pnl || 0) < 0) count++;
      else break;
    }
    return count;
  })();

  // Build grade map for trades table
  const tradeGradeMap = {};
  if (summary?.trade_grades) {
    summary.trade_grades.forEach(g => { tradeGradeMap[g.trade_group] = g; });
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => onDateChange(prevTradingDay(date))}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => onDateChange(nextTradingDay(date))}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-body)', lineHeight: 1.2 }}>
            Day Review
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 2 }}>
            <Calendar size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {formatDateLabel(date)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {date !== today && (
            <button
              onClick={() => onDateChange(today)}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', fontSize: 13, color: 'var(--text-muted)' }}
            >
              Today
            </button>
          )}
          <button
            onClick={handleRegenerate}
            disabled={regenerating || loading}
            style={{
              background: 'var(--purple-dim)', border: '1px solid rgba(91,176,215,0.4)',
              borderRadius: 8, padding: '6px 14px',
              fontSize: 13, fontWeight: 600, color: 'var(--purple)',
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: (regenerating || loading) ? 0.5 : 1,
            }}
          >
            <RotateCcw size={13} style={{ animation: regenerating ? 'spin 1s linear infinite' : 'none' }} />
            {regenerating ? 'Regenerating...' : 'Regenerate AI'}
          </button>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      {loading ? (
        <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ flex: 1, height: 90, borderRadius: 12 }} />)}
        </div>
      ) : kpis ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 16 }}>
          <KPICard title="Net P&L" value={(Number(kpis.total_net_pnl || 0) >= 0 ? '+$' : '-$') + Math.abs(Number(kpis.total_net_pnl || 0)).toFixed(2)} color={Number(kpis.total_net_pnl || 0) >= 0 ? 'var(--green)' : 'var(--red)'} />
          <KPICard title="Total Trades" value={kpis.total_trades || 0} />
          <KPICard title="Win Rate" value={`${Number(kpis.win_rate || 0).toFixed(1)}%`} color={Number(kpis.win_rate || 0) >= 50 ? 'var(--green)' : 'var(--red)'} />
          <KPICard title="Profit Factor" value={kpis.profit_factor == null ? '∞' : Number(kpis.profit_factor).toFixed(2)} color={kpis.profit_factor == null || Number(kpis.profit_factor) >= 1 ? 'var(--green)' : 'var(--red)'} />
          <KPICard title="Avg Win vs Loss" value={`$${Number(kpis.avg_win || 0).toFixed(0)} / $${Math.abs(Number(kpis.avg_loss || 0)).toFixed(0)}`} />
        </div>
      ) : null}

      {/* ── Historical Comparison ── */}
      {!loading && kpis && allTimeKpisRef.current && (
        <HistoricalComparison kpis={kpis} allTimeKpis={allTimeKpisRef.current} />
      )}

      {/* ── Circuit Breaker Banner ── */}
      {!loading && !cbDismissed && consecutiveLosses >= 3 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 16,
        }}>
          <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600, flex: 1 }}>
            {consecutiveLosses} losses in a row. Consider stepping back and reviewing before the next trade.
          </span>
          <button
            onClick={() => setCbDismissed(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', padding: 4 }}
          >
            X
          </button>
        </div>
      )}

      {/* ── Main 2-column grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>
        {/* ── Left column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Trades Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Trades
              </span>
            </div>
            {loading ? (
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1,2,3].map(i => <Sk key={i} h={40} />)}
              </div>
            ) : trades.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                No trades on this day.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Ticker', 'Side', 'Strategy', 'R', 'P&L', 'Grade'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trades.map(t => {
                    const pnl = Number(t.net_pnl || 0);
                    const grade = tradeGradeMap[t.trade_group];
                    return (
                      <tr
                        key={t.id}
                        onClick={() => onOpenDetail && onOpenDetail(t, trades)}
                        style={{ cursor: 'pointer', transition: 'background 0.12s' }}
                        className="table-row-hover"
                      >
                        <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                          {t.ticker}
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{t.instrument_type}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className={`badge badge-${t.side === 'LONG' ? 'green' : 'red'}`}>{t.side}</span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)' }}>{t.strategy || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: t.r_multiple != null ? (t.r_multiple >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--text-muted)' }}>
                          {t.r_multiple != null ? `${Number(t.r_multiple).toFixed(2)}R` : '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {summaryLoading ? (
                            <Sk w={28} h={28} style={{ borderRadius: '50%' }} />
                          ) : grade ? (
                            <div style={{
                              width: 28, height: 28, borderRadius: '50%',
                              background: gradeColor(grade.grade),
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 12, fontWeight: 800, color: '#fff',
                            }}>{grade.grade?.[0] || '?'}</div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Trade Timeline */}
          {!loading && <TradeTimeline trades={trades} />}

          {/* R-Multiple Chart */}
          {!loading && <RMultipleChart trades={trades} />}

          {/* Discipline Score */}
          {!loading && trades.length > 0 && <DisciplineCard trades={trades} />}
        </div>

        {/* ── Right column ── */}
        <div style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <AISummaryPanel summary={summary} loading={summaryLoading} />

          {/* Diary card */}
          {!loading && (
            <div className="card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <BookOpen size={14} color="var(--text-muted)" />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Diary
                </span>
              </div>
              {diary ? (() => {
                let parsed = null;
                try { parsed = JSON.parse(diary.ai_analysis || '{}'); } catch {}
                return (
                  <div>
                    {parsed?.overall_summary && (
                      <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)', marginBottom: 10 }}>{parsed.overall_summary}</p>
                    )}
                    {parsed?.patterns_identified?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {parsed.patterns_identified.map((p, i) => (
                          <span key={i} style={{ fontSize: 11, padding: '3px 8px', background: 'var(--bg-primary)', color: 'var(--text-muted)', borderRadius: 12, border: '1px solid var(--border)' }}>{p}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  No diary for this day. Upload on the Import page.
                </div>
              )}
            </div>
          )}
          {/* Weekly Summary card */}
          <div className="card" style={{ padding: '16px 20px' }}>
            <button
              onClick={() => weeklyOpen ? setWeeklyOpen(false) : handleGenerateWeekly(false)}
              style={{
                width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8, padding: 0,
              }}
            >
              <Brain size={14} color="var(--purple)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1, textAlign: 'left' }}>
                Weekly Summary
              </span>
              {weeklyOpen ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
            </button>
            {weeklyOpen && (
              <div style={{ marginTop: 14 }}>
                {weeklyLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="skeleton" style={{ height: 12 }} />
                    <div className="skeleton" style={{ height: 12, width: '85%' }} />
                    <div className="skeleton" style={{ height: 12, width: '70%' }} />
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Analyzing the week...</div>
                  </div>
                ) : weeklySummary?.error ? (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{weeklySummary.error}</div>
                ) : weeklySummary ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)', margin: 0 }}>{weeklySummary.week_narrative}</p>
                    {weeklySummary.anchor_mistake && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Anchor Mistake</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{weeklySummary.anchor_mistake}</div>
                      </div>
                    )}
                    {weeklySummary.weekly_edge && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Weekly Edge</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{weeklySummary.weekly_edge}</div>
                      </div>
                    )}
                    {weeklySummary.next_week_rule && (
                      <div style={{ background: 'var(--purple-dim)', border: '1px solid rgba(91,176,215,0.25)', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Rule for Next Week</div>
                        <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{weeklySummary.next_week_rule}</div>
                      </div>
                    )}
                    <button
                      onClick={() => handleGenerateWeekly(true)}
                      style={{
                        background: 'none', border: '1px solid var(--border)',
                        borderRadius: 6, padding: '5px 10px', fontSize: 11,
                        color: 'var(--text-muted)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
                      }}
                    >
                      <RotateCcw size={11} /> Regenerate
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .table-row-hover:hover { background: var(--bg-hover); }
      `}</style>
    </div>
  );
}
