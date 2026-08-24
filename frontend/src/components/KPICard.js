export function GoalBar({ value, goal, label }) {
  if (goal == null) return null;
  const pct = Math.min((Number(value || 0) / Number(goal)) * 100, 100);
  const hit = Number(value || 0) >= Number(goal);
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 11, marginBottom: 3,
      }}>
        <span style={{ color: hit ? 'var(--green)' : 'var(--text-muted)', fontWeight: hit ? 600 : 400 }}>
          {hit ? '✓ Goal met' : `${Math.round(pct)}% of goal`}
        </span>
        <span style={{ color: 'var(--text-muted)' }}>Goal: {label}</span>
      </div>
      <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: hit ? 'var(--green)' : 'var(--purple)',
          borderRadius: 2,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

export default function KPICard({ title, value, subtitle, color, format = 'text', prevValue, goal, goalLabel }) {
  const fmt = (v) => {
    if (format === 'currency') return `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (format === 'percent') return `${Number(v || 0).toFixed(2)}%`;
    if (format === 'number') return Number(v || 0).toLocaleString();
    return v;
  };

  const displayColor = color || (
    format === 'currency' ? ((value || 0) >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--text)'
  );

  let comp = null;
  if (prevValue != null && value != null) {
    const delta = Number(value) - Number(prevValue);
    if (Math.abs(delta) > 0.001) {
      const up = delta > 0;
      const compColor = format === 'number' ? 'var(--purple)' : up ? 'var(--green)' : 'var(--red)';
      let label;
      if (format === 'currency') {
        const abs = Math.abs(delta);
        label = (up ? '↑ +$' : '↓ -$') + (abs >= 1000 ? `${(abs / 1000).toFixed(1)}K` : Math.round(abs).toString());
      } else if (format === 'percent') {
        label = `${up ? '↑ +' : '↓ '}${Math.abs(delta).toFixed(1)} pp`;
      } else {
        label = `${up ? '↑ +' : '↓ '}${Math.abs(delta).toFixed(0)}`;
      }
      comp = <div style={{ fontSize: 13, color: compColor, fontWeight: 600, marginTop: 6 }}>{label} vs prev</div>;
    }
  }

  return (
    <div className="card" style={{ minWidth: 140 }}>
      <div className="kpi-label">{title}</div>
      <div className="kpi-value" style={{ color: displayColor }}>
        {fmt(value)}
      </div>
      {subtitle && <div className="kpi-subtitle">{subtitle}</div>}
      {comp}
      <GoalBar value={value} goal={goal} label={goalLabel} />
    </div>
  );
}
