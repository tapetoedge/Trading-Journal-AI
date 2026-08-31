import { useState, useEffect } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, PlusCircle, Trash2, Pencil } from 'lucide-react';
import { tradesApi, chartApi } from '../api';
import TradingChart from './TradingChart';

const fmt$ = (v) => {
  if (v == null) return '—';
  const n = Number(v);
  return (n >= 0 ? '' : '-') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtSigned$ = (v) => {
  if (v == null) return '—';
  const n = Number(v);
  return (n >= 0 ? '+$' : '-$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function parseExecs(trade) {
  const raw = trade.executions;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

function computeStats(trade) {
  const execs = parseExecs(trade);
  const side = trade.side;
  const entryFills = execs.filter(e => side === 'LONG' ? e.action === 'BOT' : e.action === 'SOLD');
  const exitFills  = execs.filter(e => side === 'LONG' ? e.action === 'SOLD' : e.action === 'BOT');

  const avgPrice = (fills) => {
    const qty = fills.reduce((s, f) => s + (f.qty || 0), 0);
    if (!qty) return null;
    return fills.reduce((s, f) => s + (f.qty || 0) * (f.price || 0), 0) / qty;
  };

  const avgEntry = avgPrice(entryFills);
  const avgExit  = avgPrice(exitFills);
  const totalQty = entryFills.reduce((s, f) => s + (f.qty || 0), 0);
  const adjustedCost = avgEntry ? avgEntry * totalQty : null;
  const netRoi = adjustedCost ? (trade.net_pnl / adjustedCost * 100) : null;

  const sortedTimes = [...execs].map(e => e.time).filter(Boolean).sort();
  const openTime  = sortedTimes[0];
  const closeTime = sortedTimes[sortedTimes.length - 1];

  let holdMinutes = null;
  if (openTime && closeTime && exitFills.length > 0) {
    const [oh, om] = openTime.split(':').map(Number);
    const [ch, cm] = closeTime.split(':').map(Number);
    holdMinutes = (ch * 60 + cm) - (oh * 60 + om);
  }

  const fmtHold = (m) => {
    if (m == null) return '—';
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  const isClosed = exitFills.length > 0;
  const isWin = (trade.net_pnl || 0) > 0;

  return { avgEntry, avgExit, totalQty, adjustedCost, netRoi, openTime, closeTime, holdMinutes, fmtHold, isClosed, isWin, entryFills, exitFills };
}

// ── Stat row helper ────────────────────────────────────────────────────────────

function StatRow({ label, value, valueColor }) {
  if (value == null || value === '—' || value === '') return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: valueColor || 'var(--text)' }}>{value}</span>
    </div>
  );
}

// ── Shared edit-field helpers ──────────────────────────────────────────────────

const inputStyle = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '5px 8px', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box',
};

function EditField({ label, value, onChange, type = 'text', options }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      {options ? (
        <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
          <option value="">—</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} style={inputStyle} />
      )}
    </div>
  );
}

function EditTextarea({ label, value, onChange }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
        style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
    </div>
  );
}

const EMOTIONAL_STATES = ['Focused', 'Confident', 'Calm', 'Anxious', 'FOMO', 'Frustrated', 'Greedy', 'Fearful', 'Undisciplined', 'Overconfident'];
const DEFAULT_SOURCES   = ['Watchlist', 'Scanner', 'Alert', 'News', 'Social Media', 'Own Research'];
const TAG_TYPES = ['strategy', 'setup', 'execution', 'mistake', 'emotion', 'outcome', 'source'];

// ── Dropdown with add-new option ──────────────────────────────────────────────

function SelectWithAdd({ value, onChange, options, placeholder = '— Select —' }) {
  const [adding, setAdding] = useState(false);
  const [newVal, setNewVal] = useState('');

  // Always include current value even if not in options list yet
  const merged = value && !options.includes(value) ? [value, ...options] : options;

  const handleAdd = () => {
    const trimmed = newVal.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setAdding(false);
    setNewVal('');
  };

  if (adding) {
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          autoFocus
          type="text"
          value={newVal}
          onChange={e => setNewVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setNewVal(''); } }}
          placeholder="Type new value…"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button onClick={handleAdd} className="btn btn-primary" style={{ fontSize: 11, padding: '3px 10px', whiteSpace: 'nowrap' }}>Add</button>
        <button onClick={() => { setAdding(false); setNewVal(''); }} className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}>✕</button>
      </div>
    );
  }

  return (
    <select
      value={value || ''}
      onChange={e => e.target.value === '__add__' ? setAdding(true) : onChange(e.target.value)}
      style={inputStyle}
    >
      <option value="">{placeholder}</option>
      {merged.map(o => <option key={o} value={o}>{o}</option>)}
      <option value="__add__">+ Add new…</option>
    </select>
  );
}

const editPanelStyle = { marginTop: 10, padding: 12, background: 'rgba(91,176,215,0.07)', borderRadius: 8, border: '1px solid rgba(91,176,215,0.2)' };
const editGridStyle  = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 };

// ── Tag badge ─────────────────────────────────────────────────────────────────

const TAG_COLORS = {
  strategy: '#5bb0d7', setup: '#8f9297', execution: '#6bc987',
  mistake: '#ea6a64', emotion: '#e8a95c', outcome: '#5fb8b0', source: '#7f8a99',
};

function TagBadge({ tag, onDelete }) {
  const color = TAG_COLORS[tag.tag_type] || '#8888aa';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px 3px 10px', borderRadius: 999, fontSize: 12,
      background: `${color}22`, color, border: `1px solid ${color}44`,
    }}>
      {tag.tag_value}
      {onDelete && (
        <button onClick={onDelete} title="Remove"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color, opacity: 0.65, padding: '0 2px', lineHeight: 1, fontSize: 16, display: 'flex', alignItems: 'center' }}>
          ×
        </button>
      )}
    </span>
  );
}

// ── What If helpers ───────────────────────────────────────────────────────────

const TABS = ['Stats', 'Strategy', 'Tags', 'Executions', 'What If'];

const SCENARIOS = [
  { label: '+5 min',    offsetMin: 5 },
  { label: '+10 min',   offsetMin: 10 },
  { label: '+30 min',   offsetMin: 30 },
  { label: '+1 hour',   offsetMin: 60 },
  { label: 'End of day', offsetMin: null },
];

function getPriceAt(bars, hhmm) {
  if (!bars.length) return null;
  const firstD = new Date(bars[0].t);
  const firstUTCMin = firstD.getUTCHours() * 60 + firstD.getUTCMinutes();
  const etOffset = firstUTCMin >= 780 ? -4 : -5;
  const [h, m] = hhmm.split(':').map(Number);
  const scenarioUTCMin = (h - etOffset) * 60 + m;
  for (const bar of bars) {
    const d = new Date(bar.t);
    if (d.getUTCHours() * 60 + d.getUTCMinutes() >= scenarioUTCMin) return bar.c;
  }
  return bars[bars.length - 1].c;
}

function computeWhatIf(bars, stats, trade) {
  if (!bars.length || !stats.isClosed || !stats.avgExit || !stats.closeTime) return null;
  const [exitH, exitM] = stats.closeTime.split(':').map(Number);
  const isStock  = !trade.instrument_type || trade.instrument_type === 'STOCK';
  const sideSign = trade.side === 'LONG' ? 1 : -1;

  return SCENARIOS.map(({ label, offsetMin }) => {
    let scenarioHHMM;
    if (offsetMin === null) {
      scenarioHHMM = '16:00';
    } else {
      const total = exitH * 60 + exitM + offsetMin;
      scenarioHHMM = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    }
    const price = getPriceAt(bars, scenarioHHMM);
    if (price == null) return { label, scenarioHHMM, price: null, deltaPnl: null, whatIfPnl: null };
    const deltaPnl  = isStock ? (price - stats.avgExit) * stats.totalQty * sideSign : null;
    const whatIfPnl = deltaPnl != null ? (trade.net_pnl ?? 0) + deltaPnl : null;
    return { label, scenarioHHMM, price, deltaPnl, whatIfPnl };
  });
}

const EMPTY_EXEC = { action: 'BOT', qty: '', price: '0.00', commission: '0.00', date: '', time: '' };

// ── Main TradeDetail component ────────────────────────────────────────────────

function getDayTradeTime(t, which) {
  const execs = Array.isArray(t.executions) ? t.executions : [];
  const times = execs.map(e => e.time).filter(Boolean).sort();
  return which === 'open' ? times[0]?.slice(0, 5) : times[times.length - 1]?.slice(0, 5);
}

function DaySidebar({ currentTrade, onOpenDetail }) {
  const [dayTrades, setDayTrades] = useState([]);

  useEffect(() => {
    tradesApi.list({ date_from: currentTrade.date, date_to: currentTrade.date, account_id: currentTrade.account_id })
      .then(r => setDayTrades(r.data))
      .catch(() => {});
  }, [currentTrade.date, currentTrade.account_id]);

  const dayPnl = dayTrades.reduce((s, t) => s + (t.net_pnl || 0), 0);
  const dayPnlColor = dayPnl >= 0 ? 'var(--green)' : 'var(--red)';

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>{currentTrade.date}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: dayPnlColor, lineHeight: 1.1 }}>
          {dayPnl >= 0 ? '+' : '-'}${Math.abs(dayPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          {dayTrades.length} trades
        </div>
      </div>
      <div style={{ overflowY: 'auto', maxHeight: 600 }}>
        {dayTrades.map(t => {
          const pnl = t.net_pnl ?? 0;
          const isActive = t.id === currentTrade.id;
          const openT = getDayTradeTime(t, 'open');
          const closeT = getDayTradeTime(t, 'close');
          return (
            <div
              key={t.id}
              onClick={() => onOpenDetail && onOpenDetail(t)}
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--border)',
                borderLeft: isActive ? '3px solid var(--purple)' : '3px solid transparent',
                background: isActive ? 'var(--purple-dim)' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.12s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{t.ticker}</span>
                <span style={{ color: pnl >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 13, fontWeight: 600 }}>
                  {pnl >= 0 ? '+' : '-'}${Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
              {(openT || closeT) && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {openT}{closeT && openT !== closeT ? ` – ${closeT}` : ''}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TradeDetail({ trade: initialTrade, tradeNavList = [], onBack, onTradeUpdate, onNavigate, onOpenDetail }) {
  const [trade, setTrade] = useState(initialTrade);
  const [tab, setTab] = useState('Stats');
  const [analysis, setAnalysis] = useState(null);
  const [tags, setTags] = useState([]);

  // Executions
  const [showAddExec, setShowAddExec]     = useState(false);
  const [execForm, setExecForm]           = useState(EMPTY_EXEC);
  const [addingExec, setAddingExec]       = useState(false);
  const [execError, setExecError]         = useState(null);
  const [editingExecIdx, setEditingExecIdx] = useState(null);
  const [editExecForm, setEditExecForm]   = useState(null);
  const [savingEditExec, setSavingEditExec] = useState(false);

  // What If
  const [whatIfBars, setWhatIfBars]       = useState(null);
  const [whatIfLoading, setWhatIfLoading] = useState(false);

  // Stats edit
  const [editingStats, setEditingStats]   = useState(false);
  const [statsForm, setStatsForm]         = useState({});
  const [savingStats, setSavingStats]     = useState(false);

  // Strategy edit
  const [editingStrategy, setEditingStrategy] = useState(false);
  const [strategyForm, setStrategyForm]       = useState({});
  const [savingStrategy, setSavingStrategy]   = useState(false);

  // Tags
  const [addingTag, setAddingTag]   = useState(false);
  const [tagForm, setTagForm]       = useState({ tag_type: 'strategy', tag_value: '' });
  const [savingTag, setSavingTag]   = useState(false);

  // Dropdown options (fetched from DB)
  const [analysisOptions, setAnalysisOptions] = useState({ strategies: [], idea_sources: [] });

  useEffect(() => {
    tradesApi.getAnalysisOptions().then(r => setAnalysisOptions(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    tradesApi.getAnalysis(trade.trade_group).then(r => {
      setAnalysis(r.data.analysis || {});
      setTags(r.data.tags || []);
    }).catch(() => setAnalysis({}));
  }, [trade.trade_group]);

  // ── Execution handlers ────────────────────────────────────────────────────

  const handleAddExecution = async () => {
    if (!execForm.qty || execForm.price === '') return;
    setAddingExec(true);
    setExecError(null);
    try {
      const res = await tradesApi.addExecution(trade.id, {
        ...execForm,
        qty: Number(execForm.qty),
        price: Number(execForm.price),
        commission: Number(execForm.commission || 0),
        date: execForm.date || trade.date,
      });
      setTrade(res.data);
      if (onTradeUpdate) onTradeUpdate(res.data);
      setShowAddExec(false);
      setExecForm(EMPTY_EXEC);
    } catch (e) {
      setExecError(e.response?.data?.detail || e.message);
    } finally {
      setAddingExec(false);
    }
  };

  const handleDeleteExecution = async (idx) => {
    try {
      const res = await tradesApi.deleteExecution(trade.id, idx);
      setTrade(res.data);
      if (onTradeUpdate) onTradeUpdate(res.data);
    } catch (e) {
      setExecError(e.response?.data?.detail || e.message);
    }
  };

  const handleSaveEditExec = async () => {
    if (!editExecForm) return;
    setSavingEditExec(true);
    setExecError(null);
    try {
      const res = await tradesApi.updateExecution(trade.id, editingExecIdx, {
        ...editExecForm,
        qty: Number(editExecForm.qty),
        price: Number(editExecForm.price),
        commission: Number(editExecForm.commission || 0),
        date: editExecForm.date || trade.date,
      });
      setTrade(res.data);
      if (onTradeUpdate) onTradeUpdate(res.data);
      setEditingExecIdx(null);
      setEditExecForm(null);
    } catch (e) {
      setExecError(e.response?.data?.detail || e.message);
    } finally {
      setSavingEditExec(false);
    }
  };

  // ── Analysis handlers ─────────────────────────────────────────────────────

  const toNum = v => (v === '' || v == null) ? null : (parseFloat(v) || null);

  const handleSaveStats = async () => {
    setSavingStats(true);
    try {
      const res = await tradesApi.updateAnalysis(trade.trade_group, {
        strategy: statsForm.strategy || null,
        idea_source: statsForm.idea_source || null,
        stop_loss: toNum(statsForm.stop_loss),
        target_price: toNum(statsForm.target_price),
        emotional_state: statsForm.emotional_state || null,
      });
      setAnalysis(res.data);
      setEditingStats(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingStats(false);
    }
  };

  const handleSaveStrategy = async () => {
    setSavingStrategy(true);
    try {
      const res = await tradesApi.updateAnalysis(trade.trade_group, {
        entry_reason: strategyForm.entry_reason || null,
        exit_reason:  strategyForm.exit_reason  || null,
        mistakes:     strategyForm.mistakes     || null,
      });
      setAnalysis(res.data);
      setEditingStrategy(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingStrategy(false);
    }
  };

  // ── Tag handlers ──────────────────────────────────────────────────────────

  const handleAddTag = async () => {
    if (!tagForm.tag_value.trim()) return;
    setSavingTag(true);
    try {
      const res = await tradesApi.addTag(trade.trade_group, tagForm);
      setTags(prev => [...prev, res.data]);
      setTagForm({ tag_type: 'strategy', tag_value: '' });
      setAddingTag(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingTag(false);
    }
  };

  const handleDeleteTag = async (tagId) => {
    try {
      await tradesApi.deleteTag(tagId);
      setTags(prev => prev.filter(t => t.id !== tagId));
    } catch (e) {
      console.error(e);
    }
  };

  // ── Computed values ───────────────────────────────────────────────────────

  const stats = computeStats(trade);

  useEffect(() => {
    if (whatIfBars !== null) return;
    if (!stats.isClosed) { setWhatIfBars([]); return; }
    setWhatIfLoading(true);
    chartApi.get(trade.ticker, trade.date, '1Min')
      .then(r => setWhatIfBars(r.data.bars || []))
      .catch(() => setWhatIfBars([]))
      .finally(() => setWhatIfLoading(false));
  }, [whatIfBars, trade.ticker, trade.date, stats.isClosed]);

  const pnl = trade.net_pnl ?? 0;
  const pnlColor = pnl >= 0 ? 'var(--green)' : 'var(--red)';

  const riskPerShare = analysis?.stop_loss && stats.avgEntry
    ? Math.abs(stats.avgEntry - analysis.stop_loss) : null;
  const tradeRisk = riskPerShare && stats.totalQty
    ? -(riskPerShare * stats.totalQty) : analysis?.risk_per_trade ? -Math.abs(analysis.risk_per_trade) : null;
  const plannedR  = analysis?.risk_reward ? `${Number(analysis.risk_reward).toFixed(2)}R` : null;
  const realizedR = analysis?.r_multiple != null ? `${Number(analysis.r_multiple).toFixed(2)}R` : null;

  // ── Render ────────────────────────────────────────────────────────────────

  const navIdx = tradeNavList.findIndex(t => t.id === trade.id);
  const hasPrev = navIdx > 0;
  const hasNext = navIdx !== -1 && navIdx < tradeNavList.length - 1;

  const goTo = (idx) => {
    const t = tradeNavList[idx];
    if (!t || !onNavigate) return;
    onNavigate(t);
    if (onTradeUpdate) onTradeUpdate(t);
  };

  return (
    <div>
      {/* Back nav + prev/next */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <button onClick={onBack} className="btn btn-ghost" style={{ gap: 6, fontSize: 13 }}>
          <ArrowLeft size={15} /> Back to trades
        </button>
        {tradeNavList.length > 1 && (
          <>
            <div style={{ width: 1, height: 20, background: 'var(--border)', marginLeft: 4 }} />
            <button
              className="btn btn-ghost"
              onClick={() => goTo(navIdx - 1)}
              disabled={!hasPrev}
              style={{ padding: '4px 8px', opacity: hasPrev ? 1 : 0.35 }}
              title="Previous trade"
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 50, textAlign: 'center' }}>
              {navIdx + 1} / {tradeNavList.length}
            </span>
            <button
              className="btn btn-ghost"
              onClick={() => goTo(navIdx + 1)}
              disabled={!hasNext}
              style={{ padding: '4px 8px', opacity: hasNext ? 1 : 0.35 }}
              title="Next trade"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}
      </div>

      {/* Trade header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 22, fontWeight: 700 }}>{trade.ticker}</span>
          <span className={`badge badge-${trade.side?.toLowerCase()}`}>{trade.side}</span>
          <span style={{ padding: '2px 10px', borderRadius: 6, fontSize: 12, background: 'rgba(107,201,135,0.1)', color: 'var(--green)', border: '1px solid rgba(107,201,135,0.3)' }}>
            {stats.isClosed ? 'Closed' : 'Open'}
          </span>
          {stats.isClosed && (
            <span style={{ padding: '2px 10px', borderRadius: 6, fontSize: 12, background: stats.isWin ? 'rgba(107,201,135,0.1)' : 'rgba(234,106,100,0.1)', color: stats.isWin ? 'var(--green)' : 'var(--red)', border: `1px solid ${stats.isWin ? 'rgba(107,201,135,0.3)' : 'rgba(234,106,100,0.3)'}` }}>
              {stats.isWin ? 'Win' : 'Loss'}
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {trade.date}
          {stats.openTime && <> · Opened {stats.openTime.slice(0, 5)}</>}
          {stats.closeTime && stats.isClosed && <> · Closed {stats.closeTime.slice(0, 5)}</>}
          {stats.holdMinutes != null && <> · Held {stats.fmtHold(stats.holdMinutes)}</>}
        </div>
      </div>

      {/* P&L hero */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 36, fontWeight: 800, color: pnlColor }}>{fmtSigned$(pnl)}</div>
        {stats.netRoi != null && (
          <div style={{ padding: '4px 12px', borderRadius: 20, background: pnl >= 0 ? 'rgba(107,201,135,0.1)' : 'rgba(234,106,100,0.1)', color: pnlColor, fontSize: 13, fontWeight: 600 }}>
            ROI {stats.netRoi >= 0 ? '+' : ''}{stats.netRoi.toFixed(2)}%
          </div>
        )}
        {trade.gross_pnl != null && (
          <div style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(91,176,215,0.1)', color: 'var(--text-muted)', fontSize: 13 }}>
            Gross {fmtSigned$(trade.gross_pnl)}
          </div>
        )}
      </div>

      {/* Main layout: day sidebar + tabs + chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 340px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Day sidebar */}
        <DaySidebar currentTrade={trade} onOpenDetail={onOpenDetail} />

        {/* Middle: tabs + content */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '10px 0', border: 'none', background: 'none', fontSize: 13,
                color: tab === t ? 'var(--purple)' : 'var(--text-muted)',
                fontWeight: tab === t ? 600 : 400,
                borderBottom: tab === t ? '2px solid var(--purple)' : '2px solid transparent',
                cursor: 'pointer',
              }}>
                {t}
              </button>
            ))}
          </div>

          <div style={{ padding: '4px 16px 16px' }}>

            {/* ── Stats tab ─────────────────────────────────────────────── */}
            {tab === 'Stats' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 6 }}>
                  {!editingStats ? (
                    <button
                      onClick={() => {
                        setStatsForm({
                          strategy: analysis?.strategy || '',
                          idea_source: analysis?.idea_source || 'Watchlist',
                          stop_loss: analysis?.stop_loss ?? '',
                          target_price: analysis?.target_price ?? '',
                          emotional_state: analysis?.emotional_state || '',
                        });
                        setEditingStats(true);
                      }}
                      className="btn btn-ghost"
                      style={{ fontSize: 11, padding: '2px 8px', gap: 4, color: 'var(--text-muted)' }}
                    >
                      <Pencil size={11} /> Edit
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={handleSaveStats} disabled={savingStats} className="btn btn-primary" style={{ fontSize: 11, padding: '2px 10px' }}>{savingStats ? 'Saving…' : 'Save'}</button>
                      <button onClick={() => setEditingStats(false)} className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }}>Cancel</button>
                    </div>
                  )}
                </div>

                <StatRow label="Side" value={trade.side} valueColor={trade.side === 'LONG' ? 'var(--green)' : 'var(--red)'} />
                <StatRow label="Stocks traded" value={stats.totalQty || '—'} />
                <StatRow label="Commissions & Fees" value={trade.commissions ? fmt$(trade.commissions) : '—'} />
                <StatRow label="Net ROI" value={stats.netRoi != null ? `${stats.netRoi >= 0 ? '+' : ''}${stats.netRoi.toFixed(2)}%` : '—'} valueColor={stats.netRoi != null ? (stats.netRoi >= 0 ? 'var(--green)' : 'var(--red)') : undefined} />
                <StatRow label="Gross P&L" value={trade.gross_pnl != null ? fmt$(trade.gross_pnl) : '—'} valueColor={trade.gross_pnl >= 0 ? 'var(--green)' : 'var(--red)'} />
                <StatRow label="Adjusted Cost" value={stats.adjustedCost ? fmt$(stats.adjustedCost) : '—'} />
                <StatRow label="Average Entry" value={stats.avgEntry ? `$${stats.avgEntry.toFixed(2)}` : '—'} />
                <StatRow label="Average Exit" value={stats.avgExit ? `$${stats.avgExit.toFixed(2)}` : '—'} />
                <StatRow label="Entry Time" value={stats.openTime?.slice(0, 5) || '—'} />
                <StatRow label="Exit Time" value={(stats.isClosed && stats.closeTime?.slice(0, 5)) || '—'} />
                <StatRow label="Hold Time" value={stats.fmtHold(stats.holdMinutes)} />

                {editingStats ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Strategy</div>
                      <SelectWithAdd
                        value={statsForm.strategy}
                        onChange={v => setStatsForm(f => ({ ...f, strategy: v }))}
                        options={analysisOptions.strategies}
                        placeholder="— Select strategy —"
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Source (idea origin)</div>
                      <SelectWithAdd
                        value={statsForm.idea_source}
                        onChange={v => setStatsForm(f => ({ ...f, idea_source: v }))}
                        options={[...new Set([...DEFAULT_SOURCES, ...analysisOptions.idea_sources])]}
                        placeholder="— Select source —"
                      />
                    </div>
                    <EditField label="Stop Loss ($)" type="number" value={String(statsForm.stop_loss)} onChange={v => setStatsForm(f => ({ ...f, stop_loss: v }))} />
                    <EditField label="Profit Target ($)" type="number" value={String(statsForm.target_price)} onChange={v => setStatsForm(f => ({ ...f, target_price: v }))} />
                    <EditField label="Emotional State" value={statsForm.emotional_state} onChange={v => setStatsForm(f => ({ ...f, emotional_state: v }))} options={EMOTIONAL_STATES} />
                  </div>
                ) : analysis && (
                  <>
                    <StatRow label="Strategy" value={analysis.strategy} valueColor="var(--purple)" />
                    <StatRow label="Source" value={analysis.idea_source} valueColor="var(--text-muted)" />
                    <StatRow label="Stop Loss" value={analysis.stop_loss ? `$${analysis.stop_loss}` : null} valueColor="var(--red)" />
                    <StatRow label="Profit Target" value={analysis.target_price ? `$${analysis.target_price}` : null} valueColor="var(--green)" />
                    <StatRow label="Trade Risk" value={tradeRisk ? fmt$(tradeRisk) : (analysis.risk_per_trade ? fmt$(-Math.abs(analysis.risk_per_trade)) : null)} valueColor="var(--red)" />
                    <StatRow label="Planned R-Multiple" value={plannedR} />
                    <StatRow label="Realized R-Multiple" value={realizedR} valueColor={analysis?.r_multiple >= 0 ? 'var(--green)' : 'var(--red)'} />
                    <StatRow label="Emotional State" value={analysis.emotional_state} />
                  </>
                )}
              </div>
            )}

            {/* ── Strategy tab ──────────────────────────────────────────── */}
            {tab === 'Strategy' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  {!editingStrategy ? (
                    <button
                      onClick={() => {
                        setStrategyForm({
                          entry_reason: analysis?.entry_reason || '',
                          exit_reason:  analysis?.exit_reason  || '',
                          mistakes:     analysis?.mistakes     || '',
                        });
                        setEditingStrategy(true);
                      }}
                      className="btn btn-ghost"
                      style={{ fontSize: 11, padding: '2px 8px', gap: 4, color: 'var(--text-muted)' }}
                    >
                      <Pencil size={11} /> Edit
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={handleSaveStrategy} disabled={savingStrategy} className="btn btn-primary" style={{ fontSize: 11, padding: '2px 10px' }}>{savingStrategy ? 'Saving…' : 'Save'}</button>
                      <button onClick={() => setEditingStrategy(false)} className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }}>Cancel</button>
                    </div>
                  )}
                </div>

                {editingStrategy ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <EditTextarea label="Entry Reason" value={strategyForm.entry_reason} onChange={v => setStrategyForm(f => ({ ...f, entry_reason: v }))} />
                    <EditTextarea label="Exit Reason"  value={strategyForm.exit_reason}  onChange={v => setStrategyForm(f => ({ ...f, exit_reason: v }))} />
                    <EditTextarea label="Mistakes"     value={strategyForm.mistakes}     onChange={v => setStrategyForm(f => ({ ...f, mistakes: v }))} />
                  </div>
                ) : (
                  <>
                    {(analysis?.strategy || analysis?.idea_source) && (
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        {analysis?.strategy && <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Strategy</div><div style={{ color: 'var(--purple)', fontWeight: 600 }}>{analysis.strategy}</div></div>}
                        {analysis?.idea_source && <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Source</div><div style={{ color: 'var(--text)', fontSize: 13 }}>{analysis.idea_source}</div></div>}
                      </div>
                    )}
                    {analysis?.entry_reason && <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Entry Reason</div><div style={{ fontSize: 13 }}>{analysis.entry_reason}</div></div>}
                    {analysis?.exit_reason  && <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Exit Reason</div><div style={{ fontSize: 13 }}>{analysis.exit_reason}</div></div>}
                    {analysis?.mistakes     && <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Mistakes</div><div style={{ fontSize: 13, color: 'var(--red)' }}>{analysis.mistakes}</div></div>}
                    {analysis?.ai_feedback  && (
                      <div style={{ background: 'var(--accent-dim)', border: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text)' }}>
                        {analysis.ai_feedback}
                      </div>
                    )}
                    {!analysis?.strategy && !analysis?.entry_reason && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No strategy notes yet. Click Edit to add.</div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Tags tab ──────────────────────────────────────────────── */}
            {tab === 'Tags' && (
              <div style={{ paddingTop: 8 }}>
                {tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {tags.map(tag => (
                      <TagBadge key={tag.id} tag={tag} onDelete={() => handleDeleteTag(tag.id)} />
                    ))}
                  </div>
                )}
                {!addingTag ? (
                  <button onClick={() => setAddingTag(true)} className="btn btn-ghost" style={{ fontSize: 12, gap: 6, color: 'var(--purple)' }}>
                    <PlusCircle size={14} /> Add Tag
                  </button>
                ) : (
                  <div style={editPanelStyle}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: 'var(--purple)' }}>Add Tag</div>
                    <div style={editGridStyle}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Type</div>
                        <select value={tagForm.tag_type} onChange={e => setTagForm(f => ({ ...f, tag_type: e.target.value }))} style={inputStyle}>
                          {TAG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Value</div>
                        <input
                          type="text" placeholder="tag value" value={tagForm.tag_value}
                          onChange={e => setTagForm(f => ({ ...f, tag_value: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleAddTag} disabled={savingTag} className="btn btn-primary" style={{ fontSize: 12, padding: '5px 14px' }}>{savingTag ? 'Saving…' : 'Add'}</button>
                      <button onClick={() => { setAddingTag(false); setTagForm({ tag_type: 'strategy', tag_value: '' }); }} className="btn btn-ghost" style={{ fontSize: 12 }}>Cancel</button>
                    </div>
                  </div>
                )}
                {tags.length === 0 && !addingTag && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>No tags yet.</div>
                )}
              </div>
            )}

            {/* ── Executions tab ────────────────────────────────────────── */}
            {tab === 'Executions' && (
              <div style={{ paddingTop: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Date', 'Time', 'Action', 'Qty', 'Price', 'Commission', ''].map(h => (
                        <th key={h} style={{ textAlign: h === 'Date' || h === 'Time' || h === 'Action' ? 'left' : 'right', color: 'var(--text-muted)', fontWeight: 500, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parseExecs(trade).map((ex, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 0', color: 'var(--text-muted)', fontSize: 11 }}>{ex.date || '—'}</td>
                        <td style={{ padding: '6px 0' }}>{ex.time?.slice(0, 5) || '—'}</td>
                        <td style={{ color: ex.action === 'BOT' ? 'var(--green)' : 'var(--red)' }}>{ex.action}</td>
                        <td style={{ textAlign: 'right' }}>{ex.qty}</td>
                        <td style={{ textAlign: 'right' }}>${Number(ex.price ?? 0).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{ex.commission ? `$${Number(ex.commission).toFixed(2)}` : '—'}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            title="Edit"
                            onClick={() => {
                              setEditingExecIdx(i);
                              setEditExecForm({ ...ex, qty: String(ex.qty), price: String(ex.price), commission: String(ex.commission || ''), date: ex.date || trade.date, time: ex.time || '' });
                              setShowAddExec(false);
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px', opacity: 0.7 }}
                          >
                            <Pencil size={11} />
                          </button>
                          <button onClick={() => handleDeleteExecution(i)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: '2px 4px', opacity: 0.7 }}>
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Edit Execution inline panel */}
                {editingExecIdx !== null && editExecForm && (
                  <div style={editPanelStyle}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: 'var(--purple)' }}>Edit Execution #{editingExecIdx + 1}</div>
                    <div style={editGridStyle}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Action</div>
                        <select value={editExecForm.action} onChange={e => setEditExecForm(f => ({ ...f, action: e.target.value }))} style={inputStyle}>
                          <option value="BOT">BOT (Buy)</option>
                          <option value="SOLD">SOLD (Sell)</option>
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Qty</div>
                        <input type="number" min="1" value={editExecForm.qty} onChange={e => setEditExecForm(f => ({ ...f, qty: e.target.value }))} style={inputStyle} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Price</div>
                        <input type="number" min="0" step="0.01" value={editExecForm.price} onChange={e => setEditExecForm(f => ({ ...f, price: e.target.value }))} style={inputStyle} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Commission</div>
                        <input type="number" min="0" step="0.01" value={editExecForm.commission} onChange={e => setEditExecForm(f => ({ ...f, commission: e.target.value }))} style={inputStyle} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Date</div>
                        <input type="date" value={editExecForm.date} onChange={e => setEditExecForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Time</div>
                        <input type="time" value={editExecForm.time} onChange={e => setEditExecForm(f => ({ ...f, time: e.target.value }))} style={inputStyle} />
                      </div>
                    </div>
                    {execError && <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 6 }}>{execError}</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleSaveEditExec} disabled={savingEditExec} className="btn btn-primary" style={{ fontSize: 12, padding: '5px 14px' }}>{savingEditExec ? 'Saving…' : 'Save'}</button>
                      <button onClick={() => { setEditingExecIdx(null); setEditExecForm(null); setExecError(null); }} className="btn btn-ghost" style={{ fontSize: 12 }}>Cancel</button>
                    </div>
                  </div>
                )}

                {/* Add Execution */}
                {!showAddExec ? (
                  <button
                    onClick={() => { setShowAddExec(true); setEditingExecIdx(null); setEditExecForm(null); }}
                    className="btn btn-ghost"
                    style={{ marginTop: 12, fontSize: 12, gap: 6, color: 'var(--purple)' }}
                  >
                    <PlusCircle size={14} /> Add Execution
                  </button>
                ) : (
                  <div style={editPanelStyle}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: 'var(--purple)' }}>Add Execution</div>
                    <div style={editGridStyle}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Action</div>
                        <select value={execForm.action} onChange={e => setExecForm(f => ({ ...f, action: e.target.value }))} style={inputStyle}>
                          <option value="BOT">BOT (Buy)</option>
                          <option value="SOLD">SOLD (Sell)</option>
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Qty</div>
                        <input type="number" min="1" value={execForm.qty} placeholder="0" onChange={e => setExecForm(f => ({ ...f, qty: e.target.value }))} style={inputStyle} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Price</div>
                        <input type="number" min="0" step="0.01" value={execForm.price} onChange={e => setExecForm(f => ({ ...f, price: e.target.value }))} style={inputStyle} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Commission</div>
                        <input type="number" min="0" step="0.01" value={execForm.commission} onChange={e => setExecForm(f => ({ ...f, commission: e.target.value }))} style={inputStyle} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Date</div>
                        <input type="date" value={execForm.date || trade.date} onChange={e => setExecForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Time</div>
                        <input type="time" value={execForm.time} onChange={e => setExecForm(f => ({ ...f, time: e.target.value }))} style={inputStyle} />
                      </div>
                    </div>
                    {execError && <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 6 }}>{execError}</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleAddExecution} disabled={addingExec} className="btn btn-primary" style={{ fontSize: 12, padding: '5px 14px' }}>{addingExec ? 'Saving…' : 'Save'}</button>
                      <button onClick={() => { setShowAddExec(false); setExecForm(EMPTY_EXEC); setExecError(null); }} className="btn btn-ghost" style={{ fontSize: 12 }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── What If tab ───────────────────────────────────────────── */}
            {tab === 'What If' && (
              <div style={{ paddingTop: 8 }}>
                {!stats.isClosed ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Available for closed trades only.</div>
                ) : whatIfLoading ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading 1-min bar data…</div>
                ) : whatIfBars !== null && whatIfBars.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Chart data unavailable — Alpaca market data required for this feature.</div>
                ) : whatIfBars !== null && (() => {
                  const isStock  = !trade.instrument_type || trade.instrument_type === 'STOCK';
                  const scenarios = computeWhatIf(whatIfBars, stats, trade);
                  if (!scenarios) return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Insufficient trade data.</div>;
                  return (
                    <div>
                      {!isStock && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, padding: '6px 10px', background: 'rgba(91,176,215,0.08)', borderRadius: 6, border: '1px solid rgba(91,176,215,0.2)' }}>
                          Prices shown are the <strong>underlying stock</strong>. Option P&L depends on delta, theta, and time value — estimated P&L not computed.
                        </div>
                      )}
                      <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                        Actual exit: <strong style={{ color: 'var(--text)' }}>{stats.closeTime?.slice(0, 5)}</strong> @ <strong style={{ color: 'var(--text)' }}>${stats.avgExit?.toFixed(2)}</strong>
                        {isStock && <> · Net P&L: <strong style={{ color: (trade.net_pnl ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtSigned$(trade.net_pnl)}</strong></>}
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>Scenario</th>
                            <th style={{ textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>Price</th>
                            {isStock && <>
                              <th style={{ textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>Est. P&L</th>
                              <th style={{ textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>vs Actual</th>
                            </>}
                          </tr>
                        </thead>
                        <tbody>
                          {scenarios.map((s, i) => {
                            const better = s.deltaPnl != null && s.deltaPnl > 0;
                            const worse  = s.deltaPnl != null && s.deltaPnl < 0;
                            return (
                              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '7px 0', fontWeight: 500 }}>{s.label}</td>
                                <td style={{ padding: '7px 0', textAlign: 'right' }}>{s.price != null ? `$${s.price.toFixed(2)}` : '—'}</td>
                                {isStock && <>
                                  <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 600, color: s.whatIfPnl != null ? (s.whatIfPnl >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--text-muted)' }}>
                                    {s.whatIfPnl != null ? fmtSigned$(s.whatIfPnl) : '—'}
                                  </td>
                                  <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 600, color: better ? 'var(--green)' : worse ? 'var(--red)' : 'var(--text-muted)' }}>
                                    {s.deltaPnl != null ? (s.deltaPnl === 0 ? '—' : (better ? '↑ +' : '↓ ') + '$' + Math.abs(s.deltaPnl).toFixed(0)) : '—'}
                                  </td>
                                </>}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}

          </div>
        </div>

        {/* Right: chart + detail sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <TradingChart
              ticker={trade.ticker}
              date={trade.date}
              executions={parseExecs(trade)}
              side={trade.side}
              analysis={analysis}
              height={520}
            />
          </div>

          {/* Strategy & notes */}
          {analysis && (analysis.entry_reason || analysis.exit_reason || analysis.mistakes) && (
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Strategy Notes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {analysis.entry_reason && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Entry Reason</div>
                    <div style={{ fontSize: 13 }}>{analysis.entry_reason}</div>
                  </div>
                )}
                {analysis.exit_reason && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Exit Reason</div>
                    <div style={{ fontSize: 13 }}>{analysis.exit_reason}</div>
                  </div>
                )}
                {analysis.mistakes && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Mistakes</div>
                    <div style={{ fontSize: 13, color: 'var(--red)' }}>{analysis.mistakes}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {tags.map(tag => <TagBadge key={tag.id} tag={tag} />)}
              </div>
            </div>
          )}

          {/* AI Feedback — only shown when diary analysis exists */}
          {analysis?.ai_feedback && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>AI Analysis</div>
                {analysis.match_confidence && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '2px 8px', borderRadius: 999 }}>
                    <span className={`confidence-dot confidence-${analysis.match_confidence}`} style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block', flexShrink: 0 }} />
                    {analysis.match_confidence} match
                  </span>
                )}
              </div>
              <div style={{ background: 'var(--accent-dim)', border: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
                {analysis.ai_feedback}
              </div>
              {analysis.r_multiple != null && (
                <div style={{ marginTop: 12, display: 'flex', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Trade Quality (R)</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: analysis.r_multiple >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {Number(analysis.r_multiple).toFixed(2)}R
                    </div>
                  </div>
                  {analysis.risk_reward && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Planned R:R</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>1:{Number(analysis.risk_reward).toFixed(1)}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* What-if scenarios */}
          {stats.isClosed && whatIfBars !== null && whatIfBars.length > 0 && (() => {
            const isStock = !trade.instrument_type || trade.instrument_type === 'STOCK';
            const scenarios = computeWhatIf(whatIfBars, stats, trade);
            if (!scenarios) return null;
            return (
              <div className="card">
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>What If Scenarios</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Actual exit: <strong style={{ color: 'var(--text)' }}>{stats.closeTime?.slice(0, 5)}</strong> @ <strong style={{ color: 'var(--text)' }}>${stats.avgExit?.toFixed(2)}</strong>
                  {isStock && <> · Net P&L: <strong style={{ color: pnlColor }}>{fmtSigned$(trade.net_pnl)}</strong></>}
                </div>
                {!isStock && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, padding: '6px 10px', background: 'rgba(91,176,215,0.08)', borderRadius: 6, border: '1px solid rgba(91,176,215,0.2)' }}>
                    Prices shown are the underlying stock. Option P&L not estimated.
                  </div>
                )}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>Scenario</th>
                      <th style={{ textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>Price</th>
                      {isStock && <>
                        <th style={{ textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>Est. P&L</th>
                        <th style={{ textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>vs Actual</th>
                      </>}
                    </tr>
                  </thead>
                  <tbody>
                    {scenarios.map((s, i) => {
                      const better = s.deltaPnl != null && s.deltaPnl > 0;
                      const worse = s.deltaPnl != null && s.deltaPnl < 0;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 0', fontWeight: 500 }}>{s.label}</td>
                          <td style={{ padding: '8px 0', textAlign: 'right' }}>{s.price != null ? `$${s.price.toFixed(2)}` : '—'}</td>
                          {isStock && <>
                            <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: s.whatIfPnl != null ? (s.whatIfPnl >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--text-muted)' }}>
                              {s.whatIfPnl != null ? fmtSigned$(s.whatIfPnl) : '—'}
                            </td>
                            <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: better ? 'var(--green)' : worse ? 'var(--red)' : 'var(--text-muted)' }}>
                              {s.deltaPnl != null ? (s.deltaPnl === 0 ? '—' : (better ? '↑ +' : '↓ ') + '$' + Math.abs(s.deltaPnl).toFixed(0)) : '—'}
                            </td>
                          </>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
