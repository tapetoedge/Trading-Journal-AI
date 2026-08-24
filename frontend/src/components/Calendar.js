import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { calendarApi, kpisApi, yearlyKpisApi } from '../api';
import CalendarGrid from './CalendarGrid';

const fmtPnl = (v) => {
  const n = Number(v || 0);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1000) {
    const k = abs / 1000;
    return `${sign}$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(2).replace(/\.?0+$/, '')}K`;
  }
  return `${sign}$${abs % 1 === 0 ? abs.toFixed(0) : abs.toFixed(1)}`;
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getDaysInMonth(year, month) { return new Date(year, month, 0).getDate(); }
function getFirstDayOfMonth(year, month) {
  const d = new Date(year, month - 1, 1).getDay();
  return (d + 6) % 7;
}
const pad = (n) => String(n).padStart(2, '0');

function Divider() {
  return <span style={{ width: 1, height: 22, background: 'var(--border)', flexShrink: 0 }} />;
}

function Stat({ label, value, color, large }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>{label}</span>
      <span className="mono" style={{ fontSize: large ? 18 : 15, fontWeight: 700, color: color || 'var(--text)', lineHeight: 1 }}>{value}</span>
    </div>
  );
}

// ── Year view: grid of 12 month cards ─────────────────────────────────────────

function MonthCard({ data, monthIdx, year, onClick, isCurrent, isFuture }) {
  const name = MONTHS_SHORT[monthIdx];
  if (isFuture) {
    return (
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
        padding: '16px', opacity: 0.35, minHeight: 130,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>{name}</div>
      </div>
    );
  }

  if (!data || !data.has_data) {
    return (
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
        padding: '16px', opacity: 0.5, minHeight: 130,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>{name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 'auto' }}>No trades</div>
      </div>
    );
  }

  const pnlColor = data.net_pnl >= 0 ? 'var(--green)' : 'var(--red)';
  const pfColor = data.profit_factor == null || data.profit_factor >= 1.5 ? 'var(--green)' : data.profit_factor >= 1 ? 'var(--blue)' : 'var(--red)';
  const wrColor = data.win_rate >= 55 ? 'var(--green)' : 'var(--red)';
  const ratio = data.avg_loss !== 0 ? Math.abs(data.avg_win / data.avg_loss).toFixed(2) : '--';

  return (
    <div
      onClick={() => onClick(monthIdx + 1)}
      style={{
        background: 'var(--bg-card)',
        border: isCurrent ? '1px solid var(--purple)' : '1px solid var(--border)',
        borderRadius: 12, padding: '16px', cursor: 'pointer', minHeight: 130,
        display: 'flex', flexDirection: 'column', gap: 10,
        transition: 'border-color 0.15s, background 0.15s',
        boxShadow: isCurrent ? '0 0 0 1px var(--purple)' : 'none',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
    >
      {/* Month name + P&L */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>{name}</span>
        <span className="mono" style={{ fontSize: 18, fontWeight: 800, color: pnlColor, lineHeight: 1 }}>
          {fmtPnl(data.net_pnl)}
        </span>
      </div>

      {/* KPI row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-faint)' }}>Win %</span>
          <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: wrColor }}>{data.win_rate.toFixed(1)}%</span>
        </div>
        <div style={{ width: 1, background: 'var(--border)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-faint)' }}>Prof. F</span>
          <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: pfColor }}>{data.profit_factor == null ? '∞' : data.profit_factor.toFixed(2)}</span>
        </div>
        <div style={{ width: 1, background: 'var(--border)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-faint)' }}>Avg W/L</span>
          <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{ratio}</span>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-faint)' }}>
        <span>{data.total_trades} trades</span>
        <span>{data.trading_days} days</span>
      </div>
    </div>
  );
}

function YearView({ year, setYear, accountId, onMonthClick }) {
  const [yearData, setYearData] = useState(null);
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  useEffect(() => {
    setLoading(true);
    const params = { year };
    if (accountId != null) params.account_id = accountId;
    yearlyKpisApi.get(params)
      .then(r => { setYearData(r.data); setLoading(false); })
      .catch(() => { setYearData(null); setLoading(false); });
  }, [year, accountId]);

  // Compute year totals from months with data
  const monthsWithData = yearData ? yearData.filter(m => m.has_data) : [];
  const yearPnl = monthsWithData.reduce((s, m) => s + m.net_pnl, 0);
  const totalTrades = monthsWithData.reduce((s, m) => s + m.total_trades, 0);
  const totalWinners = monthsWithData.reduce((s, m) => s + m.winning_trades, 0);
  const yearWinRate = totalTrades > 0 ? (totalWinners / totalTrades * 100).toFixed(1) : '--';

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="cal-nav" onClick={() => setYear(y => y - 1)} aria-label="Previous year"><ChevronLeft size={18} /></button>
          <span style={{ fontWeight: 700, fontSize: 20, minWidth: 60, textAlign: 'center' }}>
            {year}
          </span>
          <button className="cal-nav" onClick={() => setYear(y => y + 1)} aria-label="Next year"><ChevronRight size={18} /></button>
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: '5px 12px', marginLeft: 6 }} onClick={() => setYear(currentYear)}>This year</button>
        </div>
        {monthsWithData.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Stat label="YTD P&L" value={fmtPnl(yearPnl)} color={yearPnl >= 0 ? 'var(--green)' : 'var(--red)'} large />
            <Divider />
            <Stat label="Win %" value={yearWinRate !== '--' ? `${yearWinRate}%` : '--'} color={Number(yearWinRate) >= 55 ? 'var(--green)' : 'var(--text)'} />
            <Divider />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{totalTrades}</span>
              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>trades</span>
            </div>
          </div>
        )}
      </div>

      {/* Month grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[...Array(12)].map((_, i) => <div key={i} className="skeleton" style={{ height: 130, borderRadius: 12 }} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {(yearData || []).map((mData, i) => {
            const isFuture = year > currentYear || (year === currentYear && i + 1 > currentMonth);
            const isCurrent = year === currentYear && i + 1 === currentMonth;
            return (
              <MonthCard
                key={i}
                data={mData}
                monthIdx={i}
                year={year}
                onClick={onMonthClick}
                isCurrent={isCurrent}
                isFuture={isFuture}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Month view ─────────────────────────────────────────────────────────────────

function MonthView({ year, month, setYear, setMonth, accountId, onDayClick }) {
  const today = new Date();
  const [dayData, setDayData] = useState({});
  const [loading, setLoading] = useState(true);
  const [monthKpis, setMonthKpis] = useState(null);

  useEffect(() => {
    setLoading(true);
    const lastDay = new Date(year, month, 0).getDate();
    const dateFrom = `${year}-${pad(month)}-01`;
    const dateTo = `${year}-${pad(month)}-${pad(lastDay)}`;
    const params = { year, month };
    const kpiParams = { date_from: dateFrom, date_to: dateTo };
    if (accountId != null) { params.account_id = accountId; kpiParams.account_id = accountId; }

    calendarApi.get(params)
      .then(r => {
        const map = {};
        for (const d of r.data) map[d.date] = d;
        setDayData(map);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    kpisApi.get(kpiParams)
      .then(r => setMonthKpis(r.data))
      .catch(() => setMonthKpis(null));
  }, [year, month, accountId]);

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const allWeeks = [];
  for (let i = 0; i < cells.length; i += 7) allWeeks.push(cells.slice(i, i + 7));
  const weeks = allWeeks.filter(w => w.slice(0, 5).some(d => d !== null));

  const allDays = Object.values(dayData);
  const monthPnl = allDays.reduce((s, d) => s + d.net_pnl, 0);
  const tradingDays = allDays.length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="cal-nav" onClick={prevMonth} aria-label="Previous month"><ChevronLeft size={18} /></button>
          <span style={{ fontWeight: 700, fontSize: 20, minWidth: 152, textAlign: 'center' }}>
            {MONTHS[month - 1]} <span style={{ color: 'var(--text-faint)', fontWeight: 500 }}>{year}</span>
          </span>
          <button className="cal-nav" onClick={nextMonth} aria-label="Next month"><ChevronRight size={18} /></button>
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: '5px 12px', marginLeft: 6 }} onClick={goToday}>This month</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Stat label="MTD P&L" value={fmtPnl(monthPnl)} color={monthPnl >= 0 ? 'var(--green)' : 'var(--red)'} large />
          <Divider />
          <Stat
            label="Win %"
            value={monthKpis ? `${Number(monthKpis.win_rate || 0).toFixed(1)}%` : '--'}
            color={monthKpis && monthKpis.win_rate >= 55 ? 'var(--green)' : 'var(--text)'}
          />
          <Divider />
          <Stat
            label="Prof. Factor"
            value={monthKpis ? (monthKpis.profit_factor == null ? '∞' : Number(monthKpis.profit_factor).toFixed(2)) : '--'}
            color={monthKpis && (monthKpis.profit_factor == null || monthKpis.profit_factor >= 1.5) ? 'var(--green)' : monthKpis && monthKpis.profit_factor >= 1 ? 'var(--blue)' : 'var(--text)'}
          />
          <Divider />
          <Stat
            label="Avg W/L"
            value={monthKpis && Math.abs(monthKpis.avg_loss || 0) > 0
              ? (Math.abs(monthKpis.avg_win || 0) / Math.abs(monthKpis.avg_loss)).toFixed(2)
              : '--'}
            color="var(--text)"
          />
          <Divider />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span className="mono" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{tradingDays}</span>
            <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>trading days</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-card)' }}>Loading...</div>
      ) : (
        <CalendarGrid weeks={weeks} dayData={dayData} year={year} month={month} onDayClick={onDayClick} size="full" />
      )}
    </div>
  );
}

// ── Main Calendar (view switcher) ──────────────────────────────────────────────

export default function Calendar({ accountId, onDayClick }) {
  const today = new Date();
  const [view, setView] = useState('month');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const switchToMonth = (m) => { setMonth(m); setView('month'); };

  const toggleStyle = (active) => ({
    padding: '5px 14px', fontSize: 12, fontWeight: active ? 700 : 500,
    border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer',
    background: active ? 'var(--purple)' : 'transparent',
    color: active ? '#fff' : 'var(--text-muted)',
  });

  return (
    <div>
      {/* View toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, gap: 4 }}>
        <button style={toggleStyle(view === 'month')} onClick={() => setView('month')}>Month</button>
        <button style={toggleStyle(view === 'year')} onClick={() => setView('year')}>Year</button>
      </div>

      {view === 'year' ? (
        <YearView year={year} setYear={setYear} accountId={accountId} onMonthClick={switchToMonth} />
      ) : (
        <MonthView year={year} month={month} setYear={setYear} setMonth={setMonth} accountId={accountId} onDayClick={onDayClick} />
      )}
    </div>
  );
}
