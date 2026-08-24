import { useState, useEffect } from 'react';
import {
  ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { ChevronLeft, ChevronRight, Circle, Settings, X } from 'lucide-react';
import { kpisApi, calendarApi, tradesApi, edgeReportApi, goalsApi } from '../api';
import KPICard from './KPICard';
import DateRangePicker from './DateRangePicker';
import { NetPnlCard, WinRateCard, ProfitFactorCard, DayWinCard, AvgWinLossCard, ExitEfficiencyCard } from './KPIGaugeCard';
import CalendarGrid from './CalendarGrid';

const fmt$ = (v) => `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtDate = (d) => {
  if (!d) return '';
  const [, m, day] = d.split('-');
  return `${m}/${day}`;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px', fontSize: 15,
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || 'var(--text)' }}>
          {p.name}: {fmt$(p.value)}
        </div>
      ))}
    </div>
  );
};

// ── Mini Calendar widget ───────────────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const fmtPnlMini = (v) => {
  const n = Number(v || 0);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1000) {
    const k = abs / 1000;
    return `${sign}$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1).replace(/\.?0+$/, '')}K`;
  }
  return `${sign}$${abs % 1 === 0 ? abs.toFixed(0) : abs.toFixed(0)}`;
};

function MiniCalendar({ accountId, onDayClick }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [dayData, setDayData] = useState({});

  useEffect(() => {
    const params = { year, month };
    if (accountId != null) params.account_id = accountId;
    calendarApi.get(params).then(r => {
      const map = {};
      for (const d of r.data) map[d.date] = d;
      setDayData(map);
    }).catch(() => {});
  }, [year, month, accountId]);

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); };

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = (new Date(year, month - 1, 1).getDay() + 6) % 7; // Mon=0

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const allWeeks = [];
  for (let i = 0; i < cells.length; i += 7) allWeeks.push(cells.slice(i, i + 7));
  const weeks = allWeeks.filter(w => w.slice(0, 5).some(d => d !== null));

  const allDays = Object.values(dayData);
  const monthPnl = allDays.reduce((s, d) => s + d.net_pnl, 0);
  const tradingDayCount = allDays.length;

  return (
    <div>
      {/* Month nav + monthly stats */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button className="cal-nav" onClick={prevMonth} aria-label="Previous month">
            <ChevronLeft size={15} />
          </button>
          <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: '0.01em', minWidth: 112, textAlign: 'center' }}>
            {MONTHS[month - 1]} <span style={{ color: 'var(--text-faint)', fontWeight: 500 }}>{year}</span>
          </span>
          <button className="cal-nav" onClick={nextMonth} aria-label="Next month">
            <ChevronRight size={15} />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>MTD</span>
            <span className="mono" style={{ fontSize: 15, fontWeight: 600, color: monthPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {fmtPnlMini(monthPnl)}
            </span>
          </div>
          <span style={{ width: 1, height: 14, background: 'var(--border)' }} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{tradingDayCount}</span>
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>days</span>
          </div>
        </div>
      </div>

      {/* Grid */}
      <CalendarGrid weeks={weeks} dayData={dayData} year={year} month={month} onDayClick={onDayClick} size="mini" />
    </div>
  );
}

// ── Goals Panel ───────────────────────────────────────────────────────────────

const GOAL_FIELDS = [
  { key: 'win_rate',         label: 'Trade Win %',     suffix: '%',  step: 1,   min: 0, max: 100 },
  { key: 'profit_factor',    label: 'Profit Factor',   suffix: '',   step: 0.1, min: 0 },
  { key: 'day_win_rate',     label: 'Day Win %',       suffix: '%',  step: 1,   min: 0, max: 100 },
  { key: 'expectancy',       label: 'Expectancy ($)',  prefix: '$',  suffix: '', step: 5, min: 0 },
  { key: 'avg_win_loss_ratio', label: 'Avg W/L Ratio', suffix: '',  step: 0.1, min: 0 },
];

function GoalsPanel({ draft, onChange, onSave, onCancel }) {
  return (
    <div className="card" style={{ marginBottom: 16, border: '1px solid var(--purple)', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>Goals</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>
            Cancel
          </button>
          <button onClick={onSave} style={{ background: 'var(--purple)', border: 'none', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: 13, color: '#fff', fontWeight: 600 }}>
            Save
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {GOAL_FIELDS.map(f => (
          <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{f.label}</span>
            <input
              type="number"
              step={f.step}
              min={f.min}
              max={f.max}
              value={draft?.[f.key] ?? ''}
              onChange={e => onChange({ ...draft, [f.key]: Number(e.target.value) })}
              style={{ fontSize: 14, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', width: '100%' }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

function getPrevPeriod(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return null;
  const f = new Date(dateFrom + 'T00:00:00');
  const t = new Date(dateTo + 'T00:00:00');
  const days = Math.round((t - f) / 86400000) + 1;
  const prevTo = new Date(f); prevTo.setDate(f.getDate() - 1);
  const prevFrom = new Date(prevTo); prevFrom.setDate(prevTo.getDate() - days + 1);
  const s = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { dateFrom: s(prevFrom), dateTo: s(prevTo) };
}

export default function Dashboard({ accountId, accounts = [], selectedAccountId, onSelectAccount, onDayClick, onOpenDetail, onViewAllTrades }) {
  const [kpis, setKpis] = useState(null);
  const [prevKpis, setPrevKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [openPositions, setOpenPositions] = useState([]);
  const [recentTrades, setRecentTrades] = useState([]);
  const [closingPos, setClosingPos] = useState(null);
  const [closePrice, setClosePrice] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [closeSubmitting, setCloseSubmitting] = useState(false);
  const [edgeReport, setEdgeReport] = useState(null);
  const [goals, setGoals] = useState(null);
  const [showGoals, setShowGoals] = useState(false);
  const [goalsDraft, setGoalsDraft] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = {};
    if (accountId != null) params.account_id = accountId;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;

    kpisApi.get(params)
      .then(r => { setKpis(r.data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });

    edgeReportApi.get(params)
      .then(r => setEdgeReport(r.data))
      .catch(() => setEdgeReport(null));

    const prev = getPrevPeriod(dateFrom, dateTo);
    if (prev) {
      const pp = { ...params, date_from: prev.dateFrom, date_to: prev.dateTo };
      kpisApi.get(pp).then(r => setPrevKpis(r.data)).catch(() => setPrevKpis(null));
    } else {
      setPrevKpis(null);
    }
  }, [accountId, dateFrom, dateTo]);

  useEffect(() => {
    const params = {};
    if (accountId != null) params.account_id = accountId;
    goalsApi.get(params).then(r => setGoals(r.data)).catch(() => {});
  }, [accountId]);

  const openCloseModal = (pos) => {
    const execs = pos.executions || [];
    const side = (pos.side || 'LONG').toUpperCase();
    const entryAction = side === 'LONG' ? 'BOT' : 'SOLD';
    const exitAction  = side === 'LONG' ? 'SOLD' : 'BOT';
    const entryQty = execs.filter(e => e.action === entryAction).reduce((s, e) => s + (e.qty || 0), 0);
    const exitQty  = execs.filter(e => e.action === exitAction).reduce((s, e) => s + (e.qty || 0), 0);
    setClosingPos({ id: pos.id, ticker: pos.ticker, side, openQty: entryQty - exitQty, exitAction });
    setClosePrice('');
    setCloseDate('2026-07-21');
  };

  const handleClosePosition = async () => {
    if (!closingPos || !closePrice || !closeDate) return;
    setCloseSubmitting(true);
    try {
      await tradesApi.addExecution(closingPos.id, {
        action: closingPos.exitAction,
        qty: closingPos.openQty,
        price: parseFloat(closePrice),
        date: closeDate,
        time: '16:00:00',
        commission: 0,
      });
      setOpenPositions(prev => prev.filter(p => p.id !== closingPos.id));
      setClosingPos(null);
    } catch (e) {
      alert('Failed to close position: ' + e.message);
    } finally {
      setCloseSubmitting(false);
    }
  };

  const handleSaveGoals = () => {
    const payload = { ...goalsDraft };
    if (accountId != null) payload.account_id = accountId;
    goalsApi.put(payload).then(r => { setGoals(r.data); setShowGoals(false); }).catch(() => {});
  };

  useEffect(() => {
    const params = { open_only: true };
    if (accountId != null) params.account_id = accountId;
    tradesApi.list(params)
      .then(r => setOpenPositions(r.data))
      .catch(() => setOpenPositions([]));

    const recentParams = { limit: 5 };
    if (accountId != null) recentParams.account_id = accountId;
    tradesApi.list(recentParams)
      .then(r => setRecentTrades(r.data))
      .catch(() => setRecentTrades([]));
  }, [accountId]);

  if (error) return (
    <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>
      Failed to load dashboard: {error}
    </div>
  );

  const {
    total_net_pnl, total_gross_pnl, total_commissions,
    win_rate, profit_factor, total_trades,
    winning_trades, losing_trades,
    avg_win, avg_loss,
    day_win_rate, trading_days, positive_days,
    daily_pnl = [], by_strategy = [],
    expectancy = 0,
    exit_efficiency, avg_mae_win, avg_mae_loss, excursion_n,
  } = kpis || {};

  const todBarTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const v = payload[0]?.value || 0;
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
        <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
        <div style={{ color: v >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{fmt$(v)}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{payload[0]?.payload?.trade_count || 0} trades</div>
      </div>
    );
  };

  return (
    <div>
      {/* Header + filters */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Dashboard</h2>
          <button
            onClick={() => { setGoalsDraft({ ...goals }); setShowGoals(v => !v); }}
            title="Edit goals"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: showGoals ? 'var(--purple)' : 'var(--text-muted)', padding: 4, display: 'flex', alignItems: 'center' }}
          >
            <Settings size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {accounts.length > 0 && (
            <select
              value={selectedAccountId ?? ''}
              onChange={e => onSelectAccount && onSelectAccount(e.target.value === '' ? null : Number(e.target.value))}
              style={{ fontSize: 13, padding: '6px 10px', width: 150 }}
            >
              <option value="">All Accounts</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <DateRangePicker
            dateFrom={dateFrom}
            dateTo={dateTo}
            onChange={({ dateFrom: f, dateTo: t }) => { setDateFrom(f); setDateTo(t); }}
          />
        </div>
      </div>

      {showGoals && (
        <GoalsPanel
          draft={goalsDraft}
          onChange={setGoalsDraft}
          onSave={handleSaveGoals}
          onCancel={() => setShowGoals(false)}
        />
      )}

      {loading ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[...Array(7)].map((_, i) => <div key={i} className="skeleton" style={{ height: 120 }} />)}
          </div>
          <div className="skeleton" style={{ height: 260, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 200 }} />
        </>
      ) : (
        <>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: 12, marginBottom: 20 }}>
            <NetPnlCard
              netPnl={total_net_pnl}
              grossPnl={total_gross_pnl}
              commissions={total_commissions}
              totalTrades={total_trades}
              prevNetPnl={prevKpis?.total_net_pnl}
            />
            <WinRateCard winRate={win_rate} winningTrades={winning_trades} losingTrades={losing_trades} prevWinRate={prevKpis?.win_rate} goal={goals?.win_rate} />
            <ProfitFactorCard profitFactor={profit_factor} prevProfitFactor={prevKpis?.profit_factor} goal={goals?.profit_factor} />
            <DayWinCard dayWinRate={day_win_rate} positiveDays={positive_days ?? 0} tradingDays={trading_days ?? 0} prevDayWinRate={prevKpis?.day_win_rate} goal={goals?.day_win_rate} />
            <AvgWinLossCard avgWin={avg_win} avgLoss={avg_loss} prevAvgWin={prevKpis?.avg_win} prevAvgLoss={prevKpis?.avg_loss} goal={goals?.avg_win_loss_ratio} />
            <ExitEfficiencyCard
              efficiency={exit_efficiency}
              maeWin={avg_mae_win}
              maeLoss={avg_mae_loss}
              n={excursion_n}
              prevEfficiency={prevKpis?.exit_efficiency}
              goal={goals?.exit_efficiency}
            />
            <KPICard
              title="Expectancy"
              value={expectancy}
              format="currency"
              color={Number(expectancy || 0) >= 0 ? 'var(--green)' : 'var(--red)'}
              prevValue={prevKpis?.expectancy}
              goal={goals?.expectancy}
              goalLabel={goals?.expectancy != null ? `$${goals.expectancy}` : undefined}
            />
          </div>

          {/* 3-column main grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>

            {/* ── Row 1 ─────────────────────────────────────────────────── */}

            {/* Cumulative P&L */}
            <div className="card">
              <div style={{ marginBottom: 12, fontWeight: 600 }}>Cumulative P&L</div>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={daily_pnl}>
                  <defs>
                    <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.72 0.10 230)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="oklch(0.72 0.10 230)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <YAxis tickFormatter={fmt$} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} width={60} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="cumulative" name="Cumulative P&L"
                    stroke="oklch(0.72 0.10 230)" fill="url(#pnlGrad)" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Daily P&L */}
            <div className="card">
              <div style={{ marginBottom: 12, fontWeight: 600 }}>Daily P&L</div>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={daily_pnl}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <YAxis tickFormatter={fmt$} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} width={60} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="net_pnl" name="Daily P&L">
                    {daily_pnl.map((entry, i) => (
                      <Cell key={i} fill={entry.net_pnl >= 0 ? 'var(--green)' : 'var(--red)'} />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Recent Trades */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 600 }}>Recent Trades</span>
                <button
                  onClick={() => onViewAllTrades && onViewAllTrades()}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--purple)', fontSize: 14 }}
                >
                  View all →
                </button>
              </div>
              {recentTrades.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 15 }}>No trades yet.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Ticker', 'Side', 'Date', 'P&L'].map(h => (
                        <th key={h} style={{ textAlign: h === 'P&L' ? 'right' : 'left', color: 'var(--text-muted)', fontSize: 13, padding: '4px 8px 4px 0', fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentTrades.map((t, i) => {
                      const pnl = t.net_pnl ?? 0;
                      const side = (t.side || '').toUpperCase();
                      return (
                        <tr
                          key={i}
                          onClick={() => onOpenDetail && onOpenDetail(t)}
                          style={{ borderTop: '1px solid var(--border)', cursor: onOpenDetail ? 'pointer' : 'default' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                        >
                          <td style={{ padding: '8px 8px 8px 0', fontSize: 15, fontWeight: 600 }}>{t.ticker}</td>
                          <td style={{ padding: '8px 8px 8px 0', fontSize: 14 }}>
                            <span style={{ color: side === 'LONG' ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{side}</span>
                          </td>
                          <td style={{ padding: '8px 8px 8px 0', fontSize: 14, color: 'var(--text-muted)' }}>{t.date}</td>
                          <td style={{ padding: '8px 0', fontSize: 15, textAlign: 'right', fontWeight: 600, color: pnl > 0 ? 'var(--green)' : pnl < 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                            {pnl === 0 ? '—' : (pnl > 0 ? '+' : '') + '$' + Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Row 2 ─────────────────────────────────────────────────── */}

            {/* Calendar — spans 2 columns */}
            <div className="card" style={{ gridColumn: 'span 2' }}>
              <div style={{ marginBottom: 8, fontWeight: 600 }}>Calendar</div>
              <MiniCalendar accountId={accountId} onDayClick={onDayClick} />
            </div>

            {/* Open Positions */}
            <div className="card" style={{ borderColor: openPositions.length > 0 ? 'rgba(245,158,11,0.35)' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Circle size={8} fill="var(--orange)" color="var(--orange)" />
                <span style={{ fontWeight: 600 }}>Open Positions</span>
                <span style={{ fontSize: 14, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {openPositions.length} position{openPositions.length !== 1 ? 's' : ''}
                </span>
              </div>
              {openPositions.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 15 }}>No open positions.</div>
              ) : (
                <>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Ticker', 'Side', 'Opened', 'Qty', 'Avg Entry', ''].map((h, hi) => (
                          <th key={hi} style={{ textAlign: h === 'Qty' || h === 'Avg Entry' ? 'right' : 'left', color: 'var(--text-muted)', fontSize: 13, padding: '4px 8px 4px 0', fontWeight: 500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {openPositions.map((pos, i) => {
                        const execs = pos.executions || [];
                        const side = (pos.side || 'LONG').toUpperCase();
                        const entryAction = side === 'LONG' ? 'BOT' : 'SOLD';
                        const entryFills = execs.filter(e => e.action === entryAction);
                        const totalQty = entryFills.reduce((s, e) => s + (e.qty || 0), 0);
                        const avgEntry = totalQty > 0
                          ? entryFills.reduce((s, e) => s + (e.qty || 0) * (e.price || 0), 0) / totalQty
                          : 0;
                        const openDate = execs.length > 0 ? (execs[0].date || pos.date) : pos.date;
                        return (
                          <tr
                            key={i}
                            onClick={() => onOpenDetail && onOpenDetail(pos)}
                            style={{ borderTop: '1px solid var(--border)', cursor: onOpenDetail ? 'pointer' : 'default' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                          >
                            <td style={{ padding: '8px 8px 8px 0', fontSize: 15, fontWeight: 600 }}>{pos.ticker}</td>
                            <td style={{ padding: '8px 8px 8px 0', fontSize: 14 }}>
                              <span style={{ color: side === 'LONG' ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{side}</span>
                            </td>
                            <td style={{ padding: '8px 8px 8px 0', fontSize: 14, color: 'var(--text-muted)' }}>{openDate}</td>
                            <td style={{ padding: '8px 8px 8px 0', fontSize: 15, textAlign: 'right' }}>{totalQty}</td>
                            <td style={{ padding: '8px 8px 8px 0', fontSize: 15, textAlign: 'right' }}>
                              ${avgEntry.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '8px 0', textAlign: 'right' }}>
                              <button
                                className="btn btn-ghost"
                                title="Close position"
                                style={{ padding: '2px 6px', fontSize: 12, color: 'var(--orange)' }}
                                onClick={e => { e.stopPropagation(); openCloseModal(pos); }}
                              >
                                Close
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {closingPos && (
                    <div style={{
                      marginTop: 14, padding: '14px 16px',
                      background: 'var(--bg-hover)', borderRadius: 8,
                      border: '1px solid var(--border)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>
                          Close {closingPos.ticker} {closingPos.side} ({closingPos.openQty} shares)
                        </span>
                        <button className="btn btn-ghost" style={{ padding: '2px 6px' }} onClick={() => setClosingPos(null)}>
                          <X size={14} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Close Date</div>
                          <input
                            type="date"
                            value={closeDate}
                            onChange={e => setCloseDate(e.target.value)}
                            style={{ width: 140 }}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Close Price</div>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={closePrice}
                            onChange={e => setClosePrice(e.target.value)}
                            style={{ width: 110 }}
                            onKeyDown={e => e.key === 'Enter' && handleClosePosition()}
                          />
                        </div>
                        <button
                          className="btn btn-primary"
                          style={{ padding: '7px 16px', fontSize: 13 }}
                          onClick={handleClosePosition}
                          disabled={closeSubmitting || !closePrice || !closeDate}
                        >
                          {closeSubmitting ? 'Saving...' : 'Save Close'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── Row 3 ─────────────────────────────────────────────────── */}

            {/* By Strategy */}
            <div className="card">
              <div style={{ marginBottom: 12, fontWeight: 600 }}>By Strategy</div>
              {by_strategy.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 15 }}>No strategy data yet. Upload a diary to get started.</div>
              ) : (
                <div style={{ overflowY: 'auto', maxHeight: 220 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 13, padding: '4px 0', fontWeight: 500 }}>Strategy</th>
                        <th style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 13, padding: '4px 0', fontWeight: 500 }}>P&L</th>
                        <th style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 13, padding: '4px 0', fontWeight: 500 }}>Win%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {by_strategy.map((s, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 0', fontSize: 15 }}>{s.strategy}</td>
                          <td style={{ textAlign: 'right', color: s.net_pnl >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 15 }}>
                            {fmt$(s.net_pnl)}
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 15 }}>{s.win_rate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Time-of-Day P&L */}
            <div className="card">
              <div style={{ marginBottom: 12, fontWeight: 600 }}>Time-of-Day P&L</div>
              {!edgeReport ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={edgeReport.time_of_day || []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="bucket" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} interval={1} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmt$} tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip content={todBarTooltip} />
                    <Bar dataKey="net_pnl" radius={[3, 3, 0, 0]}>
                      {(edgeReport.time_of_day || []).map((entry, i) => (
                        <Cell key={i} fill={entry.net_pnl >= 0 ? 'var(--green)' : 'var(--red)'} />
                      ))}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Day-of-Week P&L */}
            <div className="card">
              <div style={{ marginBottom: 12, fontWeight: 600 }}>Day-of-Week P&L</div>
              {!edgeReport ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={edgeReport.day_of_week || []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmt$} tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip content={todBarTooltip} />
                    <Bar dataKey="net_pnl" radius={[3, 3, 0, 0]}>
                      {(edgeReport.day_of_week || []).map((entry, i) => (
                        <Cell key={i} fill={entry.net_pnl >= 0 ? 'var(--green)' : 'var(--red)'} />
                      ))}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>

          </div>
        </>
      )}
    </div>
  );
}
