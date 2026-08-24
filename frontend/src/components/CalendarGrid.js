// Shared trading-calendar grid (Mon–Fri) with filled day cells + week-summary
// cards the same width as a day column. Used by the Dashboard mini calendar
// and the full Calendar page. Pass size="mini" | "full".

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const fmtK = (v) => {
  const n = Number(v || 0);
  const s = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 1000) {
    const k = a / 1000;
    return `${s}$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
  }
  return `${s}$${Math.round(a)}`;
};

const SIZES = {
  mini: { rowH: 96, headH: 30, gap: 8, cardGap: 12, radius: 8,  pnl: 18, num: 12, meta: 11, wkPnl: 15 },
  full: { rowH: 150, headH: 40, gap: 8, cardGap: 14, radius: 12, pnl: 27, num: 14, meta: 12, wkPnl: 19 },
};

export default function CalendarGrid({ weeks, dayData, year, month, onDayClick, size = 'full' }) {
  const S = SIZES[size] || SIZES.full;
  const BORDER = '1px solid var(--border)';
  const today = new Date();

  const dateKey = (d) => d
    ? `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    : null;
  const isToday = (d) => d && year === today.getFullYear()
    && month === today.getMonth() + 1 && d === today.getDate();

  const weekStats = (week) => {
    let pnl = 0, days = 0;
    for (const d of week.slice(0, 5)) {
      const k = dateKey(d);
      if (k && dayData[k]) { pnl += dayData[k].net_pnl; days++; }
    }
    return { pnl, days };
  };

  return (
    <div style={{ display: 'flex', gap: S.cardGap, alignItems: 'flex-start' }}>

      {/* ── Day grid (Mon–Fri) ── */}
      <div style={{ flex: 5, border: BORDER, borderRadius: S.radius, overflow: 'hidden', background: 'var(--bg-card)' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', borderBottom: BORDER }}>
          {WEEKDAYS.map((d, i) => (
            <div key={d} style={{
              height: S.headH, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 600, letterSpacing: '0.03em', color: 'var(--text-muted)',
              borderRight: i < 4 ? BORDER : 'none',
            }}>{d}</div>
          ))}
        </div>

        {/* Week rows */}
        {weeks.map((week, wi) => (
          <div key={wi} style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
            borderBottom: wi < weeks.length - 1 ? BORDER : 'none',
          }}>
            {week.slice(0, 5).map((d, di) => {
              const key = dateKey(d);
              const data = key ? dayData[key] : null;
              const tod = isToday(d);
              const win = data ? data.net_pnl >= 0 : false;
              const bg = !d
                ? 'rgba(0,0,0,0.22)'
                : data
                  ? (win ? 'rgba(107,201,135,0.16)' : 'rgba(234,106,100,0.17)')
                  : 'transparent';

              return (
                <div
                  key={di}
                  className={`cal-day${data ? ' has-data' : ''}`}
                  onClick={() => data && onDayClick && onDayClick(key)}
                  style={{
                    height: S.rowH, borderRight: di < 4 ? BORDER : 'none',
                    background: bg, position: 'relative',
                  }}
                >
                  {d && (
                    <>
                      {/* Day number — top right */}
                      <div style={{ position: 'absolute', top: 7, right: 8, zIndex: 1 }}>
                        {tod ? (
                          <span style={{
                            display: 'grid', placeItems: 'center', width: 21, height: 21,
                            borderRadius: '50%', background: 'var(--accent)',
                            color: 'var(--bg-primary)', fontSize: S.num - 1, fontWeight: 700,
                          }}>{d}</span>
                        ) : (
                          <span style={{ fontSize: S.num, fontWeight: 500, color: 'var(--text-faint)' }}>{d}</span>
                        )}
                      </div>

                      {/* Filled content */}
                      {data && (
                        <div style={{
                          position: 'absolute', inset: 0,
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center', gap: 3,
                        }}>
                          <div className="mono" style={{
                            fontSize: S.pnl, fontWeight: 700, color: '#fff', lineHeight: 1.05,
                          }}>{fmtK(data.net_pnl)}</div>
                          <div style={{ fontSize: S.meta, color: 'rgba(255,255,255,0.62)' }}>
                            {data.trade_count} trade{data.trade_count !== 1 ? 's' : ''}
                          </div>
                          <div style={{ fontSize: S.meta, color: 'rgba(255,255,255,0.42)' }}>
                            {data.win_rate}% win
                          </div>
                          {data.has_diary && (
                            <div style={{
                              position: 'absolute', bottom: 8,
                              width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
                            }} />
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Week-summary cards (same width as one day column) ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: S.gap }}>
        {/* spacer aligns first card with the first week row */}
        <div style={{ height: S.headH - S.gap }} />
        {weeks.map((week, wi) => {
          const { pnl, days } = weekStats(week);
          return (
            <div key={wi} style={{
              height: S.rowH - S.gap,
              border: BORDER, borderRadius: S.radius, background: 'var(--bg-card)',
              display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 7,
              padding: `0 ${size === 'mini' ? 12 : 16}px`,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: 'var(--text-faint)',
              }}>Week {wi + 1}</div>
              <div className="mono" style={{
                fontSize: S.wkPnl, fontWeight: 700,
                color: days === 0 ? 'var(--text-faint)' : pnl >= 0 ? 'var(--green)' : 'var(--red)',
              }}>{fmtK(pnl)}</div>
              <div style={{
                fontSize: 11, color: 'var(--text-muted)',
                background: 'var(--accent-dim)', borderRadius: 5,
                padding: '2px 8px', width: 'fit-content',
              }}>{days} day{days !== 1 ? 's' : ''}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
