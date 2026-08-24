import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function toStr(d) {
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}


function fmtLabel(s) {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${MONTHS[Number(m) - 1].slice(0, 3)} ${d}, ${y}`;
}

function getPresets() {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const dow = t.getDay();
  const monday = new Date(t); monday.setDate(t.getDate() - ((dow + 6) % 7));
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const mStart = new Date(t.getFullYear(), t.getMonth(), 1);
  const mEnd = new Date(t.getFullYear(), t.getMonth() + 1, 0);
  const l30 = new Date(t); l30.setDate(t.getDate() - 29);
  const lmStart = new Date(t.getFullYear(), t.getMonth() - 1, 1);
  const lmEnd = new Date(t.getFullYear(), t.getMonth(), 0);
  const qm = Math.floor(t.getMonth() / 3) * 3;
  const qStart = new Date(t.getFullYear(), qm, 1);
  const qEnd = new Date(t.getFullYear(), qm + 3, 0);
  const ytd = new Date(t.getFullYear(), 0, 1);
  return [
    { label: 'Today',              from: t,      to: t      },
    { label: 'This week',          from: monday, to: sunday },
    { label: 'This month',         from: mStart, to: mEnd   },
    { label: 'Last 30 days',       from: l30,    to: t      },
    { label: 'Last month',         from: lmStart,to: lmEnd  },
    { label: 'This quarter',       from: qStart, to: qEnd   },
    { label: 'YTD (year to date)', from: ytd,    to: t      },
  ];
}

function CalendarMonth({ year, month, fromStr, toStr: toS, hoverStr, selecting, onDayClick, onDayHover }) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const todayStr = toStr(new Date());

  function dayStr(d) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function rangeEnd() {
    if (selecting && hoverStr) return hoverStr > selecting ? hoverStr : selecting;
    return toS;
  }
  function rangeStart() {
    if (selecting && hoverStr) return hoverStr < selecting ? hoverStr : selecting;
    return fromStr;
  }

  const rStart = rangeStart();
  const rEnd = rangeEnd();

  return (
    <div style={{ minWidth: 220 }}>
      <div style={{ fontWeight: 600, fontSize: 14, textAlign: 'center', marginBottom: 8 }}>
        {MONTHS[month]} {year}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px 0' }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, padding: '4px 0' }}>{d}</div>
        ))}
        {weeks.map((week, wi) => week.map((d, di) => {
          if (!d) return <div key={`e${wi}-${di}`} />;
          const ds = dayStr(d);
          const isStart = ds === fromStr || ds === selecting;
          const isEnd = ds === toS || (selecting && hoverStr && ds === rangeEnd());
          const inRange = rStart && rEnd && ds > rStart && ds < rEnd;
          const isToday = ds === todayStr;
          const isSelected = ds === fromStr || ds === toS;

          return (
            <div
              key={ds}
              onClick={() => onDayClick(ds)}
              onMouseEnter={() => onDayHover(ds)}
              style={{
                textAlign: 'center',
                fontSize: 13,
                padding: '6px 2px',
                cursor: 'pointer',
                borderRadius: isStart || isEnd ? 6 : 0,
                background: isStart || isEnd
                  ? 'var(--purple)'
                  : inRange
                  ? 'var(--purple-dim)'
                  : 'transparent',
                color: isStart || isEnd
                  ? 'white'
                  : isToday
                  ? 'var(--purple)'
                  : inRange
                  ? 'var(--text)'
                  : 'var(--text)',
                fontWeight: isToday || isSelected ? 700 : 400,
                outline: isToday && !isSelected ? '1px solid var(--purple)' : 'none',
                outlineOffset: '-2px',
                transition: 'background 0.1s',
              }}
              onMouseLeave={() => {}}
            >
              {d}
            </div>
          );
        }))}
      </div>
    </div>
  );
}

export default function DateRangePicker({ dateFrom, dateTo, onChange }) {
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState(null);
  const [hover, setHover] = useState(null);
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() === 0 ? 11 : today.getMonth() - 1);
  const [viewYearR, setViewYearR] = useState(today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear());
  const ref = useRef();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = new Date();
    const lm = t.getMonth() === 0 ? 11 : t.getMonth() - 1;
    const ly = t.getMonth() === 0 ? t.getFullYear() - 1 : t.getFullYear();
    setViewYear(ly);
    setViewMonth(lm);
    setViewYearR(lm === 11 ? ly + 1 : ly);
  }, []);

  const rightMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const rightYear = viewMonth === 11 ? viewYearR : viewYearR;

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSelecting(null);
        setHover(null);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); setViewYearR(y => y - 1); }
    else { setViewMonth(m => m - 1); }
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); setViewYearR(y => y + 1); }
    else { setViewMonth(m => m + 1); }
  }

  function handleDayClick(ds) {
    if (!selecting) {
      setSelecting(ds);
      setHover(null);
    } else {
      const from = ds < selecting ? ds : selecting;
      const to = ds < selecting ? selecting : ds;
      onChange({ dateFrom: from, dateTo: to });
      setSelecting(null);
      setHover(null);
      setOpen(false);
    }
  }

  function applyPreset(preset) {
    onChange({ dateFrom: toStr(preset.from), dateTo: toStr(preset.to) });
    setSelecting(null);
    setHover(null);
    setOpen(false);
  }

  function clearRange() {
    onChange({ dateFrom: '', dateTo: '' });
    setSelecting(null);
    setHover(null);
  }

  const hasRange = dateFrom || dateTo;
  const displayText = selecting
    ? `${fmtLabel(selecting)} → ...`
    : hasRange
    ? `${fmtLabel(dateFrom)}  →  ${fmtLabel(dateTo)}`
    : 'All time';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        onClick={() => { setOpen(v => !v); setSelecting(null); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 14px', borderRadius: 8,
          background: open ? 'var(--bg-hover)' : 'var(--bg-card)',
          border: `1px solid ${open ? 'var(--purple)' : 'var(--border)'}`,
          color: hasRange ? 'var(--text)' : 'var(--text-muted)',
          fontSize: 13, cursor: 'pointer', transition: 'border-color 0.15s',
          whiteSpace: 'nowrap',
        }}
      >
        <Calendar size={14} color="var(--text-muted)" />
        {displayText}
        {hasRange && (
          <span
            onClick={e => { e.stopPropagation(); clearRange(); }}
            style={{ marginLeft: 4, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
          >
            <X size={12} />
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 500,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: 'var(--shadow-dropdown)',
          display: 'flex', gap: 0, overflow: 'hidden',
          minWidth: 580,
        }}>
          {/* Calendars */}
          <div style={{ padding: '16px 20px', flex: 1 }}>
            {/* Selected range display */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, fontSize: 13 }}>
              <div style={{
                flex: 1, padding: '6px 12px', borderRadius: 6,
                background: 'var(--bg-primary)', border: '1px solid var(--border)',
                color: dateFrom ? 'var(--text)' : 'var(--text-muted)',
                borderColor: selecting ? 'var(--purple)' : 'var(--border)',
              }}>
                {selecting ? fmtLabel(selecting) : (dateFrom ? fmtLabel(dateFrom) : 'Start date')}
              </div>
              <span style={{ color: 'var(--text-muted)' }}>→</span>
              <div style={{
                flex: 1, padding: '6px 12px', borderRadius: 6,
                background: 'var(--bg-primary)', border: '1px solid var(--border)',
                color: dateTo && !selecting ? 'var(--text)' : 'var(--text-muted)',
              }}>
                {selecting && hover ? fmtLabel(hover) : (dateTo && !selecting ? fmtLabel(dateTo) : 'End date')}
              </div>
            </div>

            {/* Month nav */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: 4 }}>
                <ChevronLeft size={16} />
              </button>
              <div style={{ display: 'flex', gap: 32 }}>
                <CalendarMonth
                  year={viewYear} month={viewMonth}
                  fromStr={dateFrom} toStr={dateTo}
                  hoverStr={hover} selecting={selecting}
                  onDayClick={handleDayClick} onDayHover={setHover}
                />
                <CalendarMonth
                  year={rightYear} month={rightMonth}
                  fromStr={dateFrom} toStr={dateTo}
                  hoverStr={hover} selecting={selecting}
                  onDayClick={handleDayClick} onDayHover={setHover}
                />
              </div>
              <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: 4 }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Presets */}
          <div style={{
            borderLeft: '1px solid var(--border)',
            padding: '16px 0',
            minWidth: 170,
            display: 'flex', flexDirection: 'column',
          }}>
            {getPresets().map(p => {
              const active = dateFrom === toStr(p.from) && dateTo === toStr(p.to);
              return (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p)}
                  style={{
                    background: active ? 'var(--purple-dim)' : 'none',
                    border: 'none', cursor: 'pointer',
                    color: active ? 'var(--purple)' : 'var(--text)',
                    fontSize: 13, padding: '10px 20px',
                    textAlign: 'left', fontWeight: active ? 600 : 400,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'none'; }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
