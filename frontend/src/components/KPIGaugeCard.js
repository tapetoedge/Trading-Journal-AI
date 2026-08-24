import { PieChart, Pie, Cell } from 'recharts';
import { GoalBar } from './KPICard';

const fmt$ = (v) => {
  const n = Number(v || 0);
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return (n < 0 ? '-$' : '$') + abs;
};

function compBadge(curr, prev, type = 'number') {
  if (prev == null || curr == null) return null;
  const delta = Number(curr) - Number(prev);
  if (Math.abs(delta) < 0.001) return null;
  const up = delta > 0;
  const c = up ? 'var(--green)' : 'var(--red)';
  let label;
  if (type === 'percent') {
    label = `${up ? '↑ +' : '↓ '}${Math.abs(delta).toFixed(1)} pp`;
  } else if (type === 'currency') {
    const abs = Math.abs(delta);
    label = (up ? '↑ +$' : '↓ -$') + (abs >= 1000 ? `${(abs / 1000).toFixed(1)}K` : Math.round(abs).toString());
  } else {
    label = `${up ? '↑ +' : '↓ '}${Math.abs(delta).toFixed(2)}`;
  }
  return <div style={{ fontSize: 13, color: c, fontWeight: 600, marginTop: 6 }}>{label} vs prev</div>;
}

// Semi-circular gauge (180° arc)
function SemiGauge({ value, max = 100, color = 'var(--purple)', size = 110 }) {
  const pct = Math.min(Math.max(value / max, 0), 1);
  const filled = pct * 100;
  const empty = 100 - filled;
  return (
    <PieChart width={size} height={size / 2 + 8}>
      <Pie
        data={[{ v: filled }, { v: empty }]}
        cx={size / 2}
        cy={size / 2}
        startAngle={180}
        endAngle={0}
        innerRadius={size * 0.32}
        outerRadius={size * 0.46}
        dataKey="v"
        strokeWidth={0}
        paddingAngle={filled > 0 && filled < 100 ? 2 : 0}
      >
        <Cell fill={color} />
        <Cell fill="var(--border)" />
      </Pie>
    </PieChart>
  );
}

// Full circle gauge
function CircleGauge({ value, max = 3, color = 'var(--blue)', size = 90 }) {
  const pct = Math.min(Math.max(value / max, 0), 1);
  const filled = pct * 100;
  return (
    <PieChart width={size} height={size}>
      <Pie
        data={[{ v: filled }, { v: 100 - filled }]}
        cx={size / 2}
        cy={size / 2}
        startAngle={90}
        endAngle={-270}
        innerRadius={size * 0.34}
        outerRadius={size * 0.46}
        dataKey="v"
        strokeWidth={0}
        paddingAngle={filled > 0 && filled < 100 ? 2 : 0}
      >
        <Cell fill={color} />
        <Cell fill="var(--border)" />
      </Pie>
    </PieChart>
  );
}

// Win Rate card — semi gauge + W/L counts
export function WinRateCard({ winRate, winningTrades, losingTrades, prevWinRate, goal }) {
  const color = winRate >= 50 ? 'var(--green)' : 'var(--red)';
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 140 }}>
      <div className="kpi-label" style={{ alignSelf: 'flex-start' }}>Trade Win %</div>
      <SemiGauge value={winRate} max={100} color={color} size={110} />
      <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: -10, textAlign: 'center' }}>
        {Number(winRate || 0).toFixed(1)}%
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 14 }}>
        <span style={{ color: 'var(--green)', fontWeight: 600 }}>{winningTrades}W</span>
        <span style={{ color: 'var(--text-muted)' }}>|</span>
        <span style={{ color: 'var(--red)', fontWeight: 600 }}>{losingTrades}L</span>
      </div>
      {compBadge(winRate, prevWinRate, 'percent')}
      <div style={{ width: '100%', marginTop: 'auto', paddingTop: 4 }}>
        <GoalBar value={winRate} goal={goal} label={goal != null ? `${goal}%` : undefined} />
      </div>
    </div>
  );
}

// Profit Factor card — full circle gauge
export function ProfitFactorCard({ profitFactor, prevProfitFactor, goal }) {
  const color = profitFactor >= 1.5 ? 'var(--green)' : profitFactor >= 1 ? 'var(--blue)' : 'var(--red)';
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 140 }}>
      <div className="kpi-label" style={{ alignSelf: 'flex-start' }}>Profit Factor</div>
      <div style={{ position: 'relative', marginTop: 4 }}>
        <CircleGauge value={profitFactor} max={3} color={color} size={90} />
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          fontSize: 20, fontWeight: 700, color,
        }}>
          {Number(profitFactor || 0).toFixed(2)}
        </div>
      </div>
      {compBadge(profitFactor, prevProfitFactor, 'number')}
      <div style={{ width: '100%', marginTop: 'auto', paddingTop: 4 }}>
        <GoalBar value={profitFactor} goal={goal} label={goal != null ? `${goal}` : undefined} />
      </div>
    </div>
  );
}

// Day Win % card — semi gauge + day counts
export function DayWinCard({ dayWinRate, positiveDays, tradingDays, prevDayWinRate, goal }) {
  const negativeDays = tradingDays - positiveDays;
  const color = dayWinRate >= 50 ? 'var(--green)' : 'var(--red)';
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 140 }}>
      <div className="kpi-label" style={{ alignSelf: 'flex-start' }}>Day Win %</div>
      <SemiGauge value={dayWinRate} max={100} color={color} size={110} />
      <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: -10, textAlign: 'center' }}>
        {Number(dayWinRate || 0).toFixed(1)}%
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 14 }}>
        <span style={{ color: 'var(--green)', fontWeight: 600 }}>{positiveDays}W</span>
        <span style={{ color: 'var(--text-muted)' }}>|</span>
        <span style={{ color: 'var(--red)', fontWeight: 600 }}>{negativeDays}L</span>
      </div>
      {compBadge(dayWinRate, prevDayWinRate, 'percent')}
      <div style={{ width: '100%', marginTop: 'auto', paddingTop: 4 }}>
        <GoalBar value={dayWinRate} goal={goal} label={goal != null ? `${goal}%` : undefined} />
      </div>
    </div>
  );
}

// Avg Win/Loss card — horizontal bar
export function AvgWinLossCard({ avgWin, avgLoss, prevAvgWin, prevAvgLoss, goal }) {
  const win = Math.abs(avgWin || 0);
  const loss = Math.abs(avgLoss || 0);
  const total = win + loss || 1;
  const winPct = (win / total) * 100;
  const ratio = loss > 0 ? (win / loss).toFixed(2) : '∞';
  const currRatio = loss > 0 ? win / loss : null;
  const prevWin = Math.abs(prevAvgWin || 0);
  const prevLoss = Math.abs(prevAvgLoss || 0);
  const prevRatio = prevLoss > 0 ? prevWin / prevLoss : null;
  return (
    <div className="card" style={{ minWidth: 140 }}>
      <div className="kpi-label">Avg Win / Loss</div>
      <div className="kpi-value" style={{ color: 'var(--text)', marginBottom: 12 }}>{ratio}</div>
      <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ height: '100%', width: `${winPct}%`, background: 'var(--green)', borderRadius: 4, transition: 'width 0.4s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
        <span style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt$(win)}</span>
        <span style={{ color: 'var(--red)', fontWeight: 600 }}>-{fmt$(loss)}</span>
      </div>
      {compBadge(currRatio, prevRatio, 'number')}
      <GoalBar value={currRatio} goal={goal} label={goal != null ? `${goal}` : undefined} />
    </div>
  );
}

/**
 * Exit efficiency = share of the favourable move actually captured, averaged
 * over WINNERS (a loser has no favourable excursion to capture).
 * The MAE pair underneath is the stop-calibration read: the gap between the
 * heat winners take and the heat losers take is where the stop belongs.
 */
export function ExitEfficiencyCard({ efficiency, maeWin, maeLoss, n, prevEfficiency, goal }) {
  const eff = efficiency == null ? null : Number(efficiency);
  const pct = eff == null ? 0 : Math.max(0, Math.min(100, eff));
  const color = eff == null ? 'var(--text-muted)'
    : eff >= 50 ? 'var(--green)' : eff >= 35 ? 'var(--yellow, #e8a95c)' : 'var(--red)';
  return (
    <div className="card" style={{ minWidth: 140 }}>
      <div
        className="kpi-label"
        title="Of the move available while you were in the trade, how much you actually booked. Winners only."
      >
        Exit Efficiency
      </div>
      <div className="kpi-value" style={{ color, marginBottom: 12 }}>
        {eff == null ? '—' : `${eff.toFixed(0)}%`}
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.4s' }} />
      </div>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}
        title="Average MAE — the worst unrealised loss reached. Winners vs losers: the wider the gap, the better a tight stop separates them."
      >
        <span style={{ color: 'var(--green)', fontWeight: 600 }}>
          MAE {maeWin == null ? '—' : `${Number(maeWin).toFixed(2)}%`}
        </span>
        <span style={{ color: 'var(--red)', fontWeight: 600 }}>
          {maeLoss == null ? '—' : `${Number(maeLoss).toFixed(2)}%`}
        </span>
      </div>
      {compBadge(eff, prevEfficiency == null ? null : Number(prevEfficiency), 'number')}
      <GoalBar value={eff} goal={goal} label={goal != null ? `${goal}%` : undefined} />
      {n != null && (
        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>{n} trades</div>
      )}
    </div>
  );
}

// Net P&L card — the headline number, with the trade count and the
// gross/commission split folded in. Values are split into their own
// nowrap columns so a narrow card wraps between fields, never mid-number.
export function NetPnlCard({ netPnl, grossPnl, commissions, totalTrades, prevNetPnl }) {
  const n = Number(netPnl || 0);
  const color = n >= 0 ? 'var(--green)' : 'var(--red)';

  // Dollars big, cents small — reads faster and keeps the number on one line.
  const abs = Math.abs(n);
  const dollars = Math.floor(abs).toLocaleString('en-US');
  const cents = abs.toFixed(2).split('.')[1];
  // Step the type down as digits are added so a seven-figure account still
  // fits on one line at the grid's 165px minimum column.
  const bigSize = dollars.length <= 7 ? 28 : dollars.length <= 9 ? 24 : 21;

  const foot = [
    grossPnl != null ? { label: 'Gross', value: fmt$(grossPnl), color: 'var(--text)' } : null,
    commissions != null ? { label: 'Comm', value: `-${fmt$(Math.abs(commissions))}`, color: 'var(--red)' } : null,
  ].filter(Boolean);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', minWidth: 140 }}>
      <div className="kpi-label">Net P&amp;L</div>

      <div style={{
        fontFamily: 'var(--font-mono)', fontFeatureSettings: '"tnum" 1',
        fontWeight: 600, color, lineHeight: 1.15, whiteSpace: 'nowrap',
        display: 'flex', alignItems: 'baseline', gap: 1, marginTop: 2,
      }}>
        <span style={{ fontSize: bigSize }}>{n < 0 ? '-' : ''}${dollars}</span>
        <span style={{ fontSize: Math.round(bigSize * 0.57), opacity: 0.55 }}>.{cents}</span>
      </div>

      {totalTrades != null && (
        <div style={{ marginTop: 8 }}>
          <span style={{
            display: 'inline-block', fontSize: 11, fontWeight: 600, letterSpacing: '0.02em',
            color: 'var(--text-muted)', background: 'var(--bg-hover)',
            border: '1px solid var(--border)', borderRadius: 999, padding: '2px 9px',
          }}>
            {Number(totalTrades).toLocaleString('en-US')} trades
          </span>
        </div>
      )}

      {compBadge(netPnl, prevNetPnl, 'currency')}

      {foot.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '10px 20px',
          marginTop: 'auto', paddingTop: 12,
          borderTop: '1px solid var(--border)',
        }}>
          {foot.map(f => (
            <div key={f.label} style={{ whiteSpace: 'nowrap' }}>
              <div style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2,
              }}>
                {f.label}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontFeatureSettings: '"tnum" 1',
                fontSize: 13, fontWeight: 600, color: f.color,
              }}>
                {f.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
