import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, AreaChart, Area,
} from 'recharts';
import { reportsApi, edgeReportApi } from '../api';
import DateRangePicker from './DateRangePicker';
import { RMultipleDist, EmotionTable, MistakeFreq, HoldTime } from './Edge';

const fmt$ = (v) =>
  `${v < 0 ? '-' : ''}$${Math.abs(Number(v || 0)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'setups', label: 'Setups & Strategy' },
  { id: 'timing', label: 'Timing' },
  { id: 'execution', label: 'Execution' },
  { id: 'symbols', label: 'Symbols' },
  { id: 'psychology', label: 'Psychology' },
];

function Section({ title, hint, children }) {
  return (
    <div className="card" style={{ padding: '20px 24px 24px' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {title}
        </div>
        {hint && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, opacity: 0.8 }}>
            {hint}
          </div>
        )}
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

/* A stat pill for the summary strip. */
function Stat({ label, value, tone, sub }) {
  const color = tone === 'pos' ? 'var(--green)' : tone === 'neg' ? 'var(--red)' : 'var(--text)';
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{
        fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase',
        letterSpacing: '0.06em', marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

/* Every /api/reports bucket has the same shape, so one table renders all of them. */
function BucketTable({ rows, labelHead = 'Bucket', sortByPnl = false, max }) {
  if (!rows || !rows.length) return <NoData />;
  let data = sortByPnl ? [...rows].sort((a, b) => b.net_pnl - a.net_pnl) : rows;
  if (max) data = data.slice(0, max);

  const th = {
    textAlign: 'right', padding: '8px 10px', fontSize: 11, fontWeight: 600,
    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
  };
  const td = { textAlign: 'right', padding: '9px 10px', fontSize: 13, whiteSpace: 'nowrap' };
  const best = Math.max(...data.map(r => Math.abs(r.net_pnl)), 1);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left' }}>{labelHead}</th>
            <th style={th}>Trades</th>
            <th style={th}>Win %</th>
            <th style={th}>Net P&amp;L</th>
            <th style={th}>Avg</th>
            <th style={th}>Avg Win</th>
            <th style={th}>Avg Loss</th>
            <th style={th}>PF</th>
            <th style={th}>Exit Eff.</th>
            <th style={{ ...th, width: 110 }}></th>
          </tr>
        </thead>
        <tbody>
          {data.map(r => {
            const pos = r.net_pnl >= 0;
            return (
              <tr key={r.key} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ ...td, textAlign: 'left', fontWeight: 600 }}>{r.label}</td>
                <td style={{ ...td, color: 'var(--text-muted)' }}>{r.trades}</td>
                <td style={td}>{r.win_rate}%</td>
                <td style={{ ...td, fontWeight: 700, color: pos ? 'var(--green)' : 'var(--red)' }}>
                  {fmt$(r.net_pnl)}
                </td>
                <td style={{ ...td, color: r.avg_pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {fmt$(r.avg_pnl)}
                </td>
                <td style={{ ...td, color: 'var(--text-muted)' }}>{fmt$(r.avg_win)}</td>
                <td style={{ ...td, color: 'var(--text-muted)' }}>{fmt$(r.avg_loss)}</td>
                <td style={{ ...td, fontWeight: 600 }}>
                  {r.profit_factor == null ? '∞' : r.profit_factor.toFixed(2)}
                </td>
                <td style={{ ...td, color: 'var(--text-muted)' }}>
                  {r.exit_efficiency == null ? '-' : `${r.exit_efficiency}%`}
                </td>
                <td style={{ padding: '9px 10px' }}>
                  <div style={{ background: 'var(--border)', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.abs(r.net_pnl) / best * 100}%`, height: '100%',
                      background: pos ? 'var(--green)' : 'var(--red)', borderRadius: 3,
                    }} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* Net P&L bars for an ordered bucket list (timing charts read better than a table). */
function BucketBars({ rows, height = 240 }) {
  if (!rows || !rows.length) return <NoData />;
  const data = rows.map(r => ({ name: r.label, pnl: r.net_pnl, trades: r.trades, wr: r.win_rate }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}
               tickFormatter={(v) => fmt$(v)} width={62} />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '8px 12px', fontSize: 12,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
                <div style={{ color: d.pnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                  {fmt$(d.pnl)}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>{d.trades} trades · {d.wr}% win</div>
              </div>
            );
          }}
        />
        <ReferenceLine y={0} stroke="var(--border)" />
        <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.pnl >= 0 ? 'var(--green)' : 'var(--red)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function EquityCurve({ curve }) {
  if (!curve || curve.length < 2) return <NoData />;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={curve} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--green)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--green)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
               axisLine={false} tickLine={false} minTickGap={40} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false}
               tickLine={false} tickFormatter={(v) => fmt$(v)} width={68} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '8px 12px', fontSize: 12,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
                <div>Equity: <b>{fmt$(d.cumulative)}</b></div>
                <div style={{ color: d.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  Day: {fmt$(d.pnl)}
                </div>
                {d.drawdown < 0 && (
                  <div style={{ color: 'var(--red)' }}>Drawdown: {fmt$(d.drawdown)}</div>
                )}
              </div>
            );
          }}
        />
        <ReferenceLine y={0} stroke="var(--border)" />
        <Area type="monotone" dataKey="cumulative" stroke="var(--green)" strokeWidth={2}
              fill="url(#eqGrad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function DrawdownCurve({ curve }) {
  if (!curve || curve.length < 2) return <NoData />;
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={curve} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--red)" stopOpacity={0.05} />
            <stop offset="100%" stopColor="var(--red)" stopOpacity={0.35} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
               axisLine={false} tickLine={false} minTickGap={40} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false}
               tickLine={false} tickFormatter={(v) => fmt$(v)} width={68} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '8px 12px', fontSize: 12,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
                <div style={{ color: 'var(--red)' }}>{fmt$(payload[0].value)} off peak</div>
              </div>
            );
          }}
        />
        <Area type="monotone" dataKey="drawdown" stroke="var(--red)" strokeWidth={1.5}
              fill="url(#ddGrad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function Reports({ accountId }) {
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [edge, setEdge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (accountId != null) params.account_id = accountId;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    Promise.all([
      reportsApi.get(params).then(r => r.data).catch(() => null),
      edgeReportApi.get(params).then(r => r.data).catch(() => null),
    ]).then(([rep, edg]) => {
      setData(rep && rep.has_data ? rep : null);
      setEdge(edg);
      setLoading(false);
    });
  }, [accountId, dateFrom, dateTo]);

  const s = data?.summary;
  const gap = { display: 'flex', flexDirection: 'column', gap: 16 };
  const two = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, flexWrap: 'wrap', gap: 10,
      }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Reports</h2>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {loading ? 'Loading...' : data
              ? `${data.trade_count.toLocaleString('en-US')} trades across ${s.trading_days} sessions`
              : 'No trades in range'}
          </div>
        </div>
        <DateRangePicker
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={({ dateFrom: f, dateTo: t }) => { setDateFrom(f); setDateTo(t); }}
        />
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 16px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
              color: tab === t.id ? 'var(--text)' : 'var(--text-muted)',
              borderBottom: `2px solid ${tab === t.id ? 'var(--accent, #6366f1)' : 'transparent'}`,
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={gap}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 220 }} />)}
        </div>
      ) : !data ? (
        <div className="card" style={{ padding: 40 }}><NoData msg="Import trades to see reports." /></div>
      ) : (
        <div style={gap}>

          {tab === 'overview' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                <Stat label="Net P&L" value={fmt$(s.net_pnl)} tone={s.net_pnl >= 0 ? 'pos' : 'neg'} />
                <Stat label="Max Drawdown" value={fmt$(s.max_drawdown)} tone="neg" sub={s.max_drawdown_date} />
                <Stat label="Green Days" value={`${s.green_days} / ${s.trading_days}`}
                      sub={`${Math.round(s.green_days / s.trading_days * 100)}% of sessions`} />
                <Stat label="Best Day" value={fmt$(s.best_day)} tone="pos" />
                <Stat label="Worst Day" value={fmt$(s.worst_day)} tone="neg" />
                <Stat label="Avg Green Day" value={fmt$(s.avg_green_day)} tone="pos"
                      sub={`Avg red ${fmt$(s.avg_red_day)}`} />
                <Stat label="Longest Streak" value={`${s.longest_win_streak}W`}
                      sub={`Worst run ${s.longest_loss_streak}L`} />
                <Stat label="Trades / Day" value={s.avg_trades_per_day} />
              </div>

              <Section title="Equity Curve" hint="Cumulative net P&L by trading day.">
                <EquityCurve curve={data.equity_curve} />
              </Section>

              <Section title="Drawdown" hint="Distance below the running equity peak. This is the number a prop firm watches.">
                <DrawdownCurve curve={data.equity_curve} />
              </Section>

              <Section title="Monthly Performance">
                <BucketBars rows={data.by_month} height={260} />
                <div style={{ marginTop: 16 }}>
                  <BucketTable rows={data.by_month} labelHead="Month" />
                </div>
              </Section>
            </>
          )}

          {tab === 'setups' && (
            <>
              <Section title="By Setup" hint="Playbook setups you tagged on your trades.">
                <BucketTable rows={data.by_setup} labelHead="Setup" sortByPnl />
              </Section>
              <Section title="By Setup Grade" hint="A++ down to F. A monotonic ladder means the grading is real.">
                <BucketBars rows={data.by_grade} />
                <div style={{ marginTop: 16 }}>
                  <BucketTable rows={data.by_grade} labelHead="Grade" />
                </div>
              </Section>
              <Section title="By Strategy" hint="What the diary analysis tagged the trade as.">
                <BucketTable rows={data.by_strategy} labelHead="Strategy" sortByPnl max={20} />
              </Section>
              <div style={two}>
                <Section title="By Instrument">
                  <BucketTable rows={data.by_instrument} labelHead="Type" sortByPnl />
                </Section>
                <Section title="Long vs Short">
                  <BucketTable rows={data.by_side} labelHead="Side" sortByPnl />
                </Section>
              </div>
            </>
          )}

          {tab === 'timing' && (
            <>
              <Section title="By Day of Week">
                <BucketBars rows={data.by_day_of_week} />
                <div style={{ marginTop: 16 }}>
                  <BucketTable rows={data.by_day_of_week} labelHead="Day" />
                </div>
              </Section>
              <Section title="By Time of Day" hint="Bucketed on first entry. The 10:30-11:00 dead zone shows up here.">
                <BucketBars rows={data.by_session} />
                <div style={{ marginTop: 16 }}>
                  <BucketTable rows={data.by_session} labelHead="Entry window" />
                </div>
              </Section>
              <Section title="By Hold Time" hint="First entry to last exit. Short holds are usually stop-outs and chases.">
                <BucketBars rows={data.by_hold_time} />
                <div style={{ marginTop: 16 }}>
                  <BucketTable rows={data.by_hold_time} labelHead="Hold" />
                </div>
              </Section>
            </>
          )}

          {tab === 'execution' && (
            <>
              <Section title="Scaled Out vs All-or-Nothing"
                       hint="Trades with more than one exit fill vs a single exit.">
                <BucketBars rows={data.by_management} height={200} />
                <div style={{ marginTop: 16 }}>
                  <BucketTable rows={data.by_management} labelHead="Management" />
                </div>
              </Section>
              <div style={two}>
                <Section title="R-Multiple Distribution" hint="Realized R per trade, from the diary analysis.">
                  <RMultipleDist data={edge?.r_multiple_dist} />
                </Section>
                <Section title="Hold Time: Winners vs Losers">
                  <HoldTime data={edge?.hold_time} />
                </Section>
              </div>
              <Section title="Exit Efficiency by Setup"
                       hint="Percent of the maximum favorable excursion you actually captured, winners only. 40-60% is a normal band for a discretionary day trader.">
                <BucketTable rows={data.by_setup} labelHead="Setup" sortByPnl />
              </Section>
            </>
          )}

          {tab === 'symbols' && (
            <Section title="By Symbol" hint="Top 40 by net P&L. Watch for a single name carrying the account.">
              <BucketTable rows={data.by_symbol} labelHead="Symbol" sortByPnl />
            </Section>
          )}

          {tab === 'psychology' && (
            <>
              <Section title="By Emotional State" hint="Self-reported in the diary. Revenge and frustrated rows are the ones to read.">
                <BucketTable rows={data.by_emotion} labelHead="Emotion" sortByPnl />
              </Section>
              <Section title="Emotion vs Outcome">
                <EmotionTable data={edge?.emotion_outcomes} />
              </Section>
              <Section title="Mistake Frequency">
                <MistakeFreq data={edge?.mistake_frequency} />
              </Section>
            </>
          )}

        </div>
      )}
    </div>
  );
}
