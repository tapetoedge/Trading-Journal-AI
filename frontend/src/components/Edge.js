import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { edgeReportApi } from '../api';
import DateRangePicker from './DateRangePicker';

const fmt$ = (v) =>
  `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function Section({ title, children }) {
  return (
    <div className="card" style={{ padding: '20px 24px 24px' }}>
      <div style={{
        fontSize: 13, fontWeight: 600, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function NoData({ msg }) {
  return (
    <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>
      {msg || 'Not enough data yet.'}
    </div>
  );
}

const barTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value || 0;
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '8px 12px', fontSize: 12,
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{v}</div>
    </div>
  );
};


export function RMultipleDist({ data }) {
  if (!data || data.every(d => d.count === 0)) return <NoData msg="No R-multiple data. Log stop loss and fill in R-multiple per trade." />;
  const filtered = data.filter(d => d.count > 0);
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={filtered} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="bucket" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false}
          tickFormatter={v => `${Number(v) >= 0 ? '+' : ''}${v}R`} />
        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <ReferenceLine x="0" stroke="var(--border)" />
        <Tooltip content={barTip} />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {filtered.map((entry, i) => (
            <Cell key={i} fill={Number(entry.bucket) >= 0 ? 'var(--green)' : 'var(--red)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function EmotionTable({ data }) {
  if (!data || data.length === 0) return <NoData msg="No emotion data. Log emotional state per trade." />;

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr>
          {['State', 'Trades', 'Win Rate', 'Avg P&L', 'Avg R'].map(h => (
            <th key={h} style={{
              textAlign: h === 'State' ? 'left' : 'right',
              color: 'var(--text-muted)', fontWeight: 500,
              padding: '4px 8px 10px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => {
          const pnlColor = row.avg_pnl >= 0 ? 'var(--green)' : 'var(--red)';
          const wr = row.win_rate;
          const wrColor = wr >= 55 ? 'var(--green)' : wr >= 40 ? 'var(--yellow, #f59e0b)' : 'var(--red)';
          return (
            <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '9px 8px 9px 0', textTransform: 'capitalize', fontWeight: 600 }}>
                {row.state}
              </td>
              <td style={{ textAlign: 'right', padding: '9px 8px' }}>{row.trade_count}</td>
              <td style={{ textAlign: 'right', padding: '9px 8px', color: wrColor, fontWeight: 700 }}>
                {wr.toFixed(1)}%
              </td>
              <td style={{ textAlign: 'right', padding: '9px 8px', color: pnlColor, fontWeight: 600 }}>
                {row.avg_pnl >= 0 ? '+' : ''}{fmt$(row.avg_pnl)}
              </td>
              <td style={{ textAlign: 'right', padding: '9px 0', color: row.avg_r != null ? (row.avg_r >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--text-muted)' }}>
                {row.avg_r != null ? `${row.avg_r >= 0 ? '+' : ''}${row.avg_r.toFixed(2)}R` : 'n/a'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function MistakeFreq({ data }) {
  if (!data || data.length === 0) return <NoData msg="No mistake data. Tag mistakes per trade." />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="mistake" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={160} />
        <Tooltip content={barTip} />
        <Bar dataKey="count" fill="var(--red)" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HoldTime({ data }) {
  if (!data || (data.winners_avg_min == null && data.losers_avg_min == null)) {
    return <NoData msg="Not enough trade timing data yet." />;
  }
  const bars = [
    { label: 'Winners', value: data.winners_avg_min, fill: 'var(--green)' },
    { label: 'Losers', value: data.losers_avg_min, fill: 'var(--red)' },
  ].filter(b => b.value != null);

  const fmtMin = (m) => {
    if (m == null) return 'n/a';
    if (m < 60) return `${Math.round(m)}m`;
    return `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;
  };

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap', paddingTop: 8 }}>
      {bars.map(b => (
        <div key={b.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: '1 1 120px' }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: b.fill, lineHeight: 1 }}>
            {fmtMin(b.value)}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Avg hold ({b.label.toLowerCase()})</div>
        </div>
      ))}
      {bars.length === 2 && bars[1].value != null && bars[0].value != null && (
        <div style={{ flex: '1 1 160px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {bars[1].value > bars[0].value
            ? `You hold losers ${(bars[1].value / bars[0].value).toFixed(1)}x longer than winners. Consider cutting losses faster.`
            : `You hold winners ${(bars[0].value / bars[1].value).toFixed(1)}x longer than losers. Good discipline, letting winners run.`}
        </div>
      )}
    </div>
  );
}

export default function Edge({ accountId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (accountId != null) params.account_id = accountId;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    edgeReportApi.get(params)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => { setData(null); setLoading(false); });
  }, [accountId, dateFrom, dateTo]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Edge Analytics</h2>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {data ? `${data.total_trades || 0} trades` : 'Loading...'}
            {data?.expectancy != null && (
              <span style={{ marginLeft: 12, color: data.expectancy >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                Expectancy: {data.expectancy >= 0 ? '+' : ''}{fmt$(data.expectancy)}/trade
              </span>
            )}
          </div>
        </div>
        <DateRangePicker
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={({ dateFrom: f, dateTo: t }) => { setDateFrom(f); setDateTo(t); }}
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 220 }} />)}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Section title="R-Multiple Distribution">
              <RMultipleDist data={data?.r_multiple_dist} />
            </Section>
            <Section title="Hold Time, Winners vs. Losers">
              <HoldTime data={data?.hold_time} />
            </Section>
          </div>

          <Section title="Emotion vs. Outcome">
            <EmotionTable data={data?.emotion_outcomes} />
          </Section>

          <Section title="Mistake Frequency">
            <MistakeFreq data={data?.mistake_frequency} />
          </Section>
        </div>
      )}
    </div>
  );
}
