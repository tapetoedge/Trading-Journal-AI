import { useState, useEffect, useRef } from 'react';
import { createChart, ColorType, CrosshairMode, LineStyle } from 'lightweight-charts';
import { chartApi } from '../api';

// lightweight-charts always renders its axis and crosshair labels using UTC getters,
// with no timezone option. Alpaca's bars come back as true UTC ("...T14:07:00Z" for
// 10:07 ET), so feeding them straight in shows UTC hours on the axis while execution
// times are already stored as ET wall-clock. Fix: shift bar timestamps by the market's
// UTC offset so the "UTC" the library reads back out is actually ET. Hardcoded to EDT
// (UTC-4) for now, matching the rest of this file — no winter DST handling yet.
const ET_UTC_OFFSET_SEC = 4 * 3600;

const toTs = (isoUtcStr) => Math.floor(new Date(isoUtcStr).getTime() / 1000) - ET_UTC_OFFSET_SEC;

// Daily/weekly bars are stamped at session open, already whole calendar days —
// no ET/UTC shift needed there, just a straight epoch conversion.
const toDayTs = (isoUtcStr) => Math.floor(new Date(isoUtcStr).getTime() / 1000);

const execToTs = (dateStr, timeStr, bucketMin = 5) => {
  if (!timeStr) return null;
  const [h, m] = timeStr.slice(0, 5).split(':').map(Number);
  const totalMin = Math.floor((h * 60 + m) / bucketMin) * bucketMin;
  const rh = Math.floor(totalMin / 60);
  const rm = totalMin % 60;
  // Already ET wall-clock — parse as literal UTC so it lands in the same shifted
  // timeline as toTs() above, instead of applying the offset a second time.
  return Math.floor(
    new Date(`${dateStr}T${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}:00Z`).getTime() / 1000
  );
};

const avgPrice = (fills) => {
  const qty = fills.reduce((s, f) => s + (f.qty || 0), 0);
  if (!qty) return null;
  return fills.reduce((s, f) => s + (f.qty || 0) * (f.price || 0), 0) / qty;
};

const TIMEFRAMES = [
  { id: '1Min', label: '1m' },
  { id: '3Min', label: '3m' },
  { id: '5Min', label: '5m' },
  { id: '10Min', label: '10m' },
  { id: '15Min', label: '15m' },
  { id: '30Min', label: '30m' },
  { id: '1Hour', label: '1H' },
  { id: '1Day', label: 'Daily' },
  { id: '1Week', label: 'Weekly' },
];
const TF_MINUTES = { '1Min': 1, '3Min': 3, '5Min': 5, '10Min': 10, '15Min': 15, '30Min': 30, '1Hour': 60 };
const WIDE_RANGE_TFS = new Set(['1Day', '1Week']);
// How many calendar days of backward history each timeframe will load before
// the lazy-load-on-zoom-out gives up. Finer intraday bars get a small cap so a
// single request doesn't balloon (1-min bars for 90 days would be ~35k bars);
// daily/weekly can go much further back since even a decade of daily bars is
// only ~2500 rows.
const MAX_DAYS_BACK = {
  '1Min': 5, '3Min': 10, '5Min': 20, '10Min': 30, '15Min': 45, '30Min': 60, '1Hour': 90,
  '1Day': 3650, '1Week': 5475,
};
// Daily/weekly start already zoomed to a useful multi-month/year window rather
// than the 1-day default intraday timeframes use — nobody wants a weekly chart
// that opens showing a single week.
const INITIAL_DAYS_BACK = { '1Day': 240, '1Week': 730 };

export default function TradingChart({
  ticker, date, defaultTimeframe = '5Min',
  executions = [], side = 'LONG', analysis = null,
  height = 320,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const [timeframe, setTimeframe] = useState(defaultTimeframe);
  const [bars, setBars] = useState([]);
  const [daysBack, setDaysBack] = useState(() => INITIAL_DAYS_BACK[defaultTimeframe] || 1);
  const [warning, setWarning] = useState(null);
  const [loading, setLoading] = useState(true);
  const isWide = WIDE_RANGE_TFS.has(timeframe);
  // Set right before a zoom-out-triggered fetch, holding the visible window so
  // it can be restored once the wider dataset lands — otherwise the chart would
  // jump back to fitContent() every time more history streams in.
  const savedRangeRef = useRef(null);
  const loadingMoreRef = useRef(false);
  // True only for the very first fetch after a ticker/date/timeframe change —
  // distinct from daysBack itself, since daily/weekly start at a large
  // default (240/730) rather than 1, so "daysBack === 1" can't tell an
  // initial load apart from a background zoom-out extension for those.
  const isInitialFetchRef = useRef(true);
  // Identifies the current ticker/date/timeframe selection, so a single effect
  // can tell "this is a new selection" apart from "daysBack grew from a
  // zoom-out" without needing a second effect — two effects both reacting to
  // a timeframe change fire in the same commit before state settles, which
  // fired the fetch once with the stale daysBack and again with the reset
  // value once it caught up.
  const selectionKeyRef = useRef(null);

  useEffect(() => {
    const key = `${ticker}|${date}|${timeframe}`;
    const isNewSelection = selectionKeyRef.current !== key;

    if (isNewSelection) {
      selectionKeyRef.current = key;
      savedRangeRef.current = null;
      loadingMoreRef.current = false;
      isInitialFetchRef.current = true;
      const initialDaysBack = INITIAL_DAYS_BACK[timeframe] || 1;
      if (initialDaysBack !== daysBack) {
        // Resolve daysBack first and let the re-render (with settled state)
        // do the actual fetch, instead of fetching now with the stale value.
        setDaysBack(initialDaysBack);
        return;
      }
    }

    const isInitialLoad = isInitialFetchRef.current;
    if (isInitialLoad) { setLoading(true); setBars([]); setWarning(null); }
    chartApi.get(ticker, date, timeframe, daysBack)
      .then(r => { setBars(r.data.bars || []); setWarning(r.data.warning || null); })
      .catch(() => { if (isInitialLoad) setWarning('Failed to load chart data'); })
      .finally(() => {
        if (isInitialLoad) setLoading(false);
        isInitialFetchRef.current = false;
        loadingMoreRef.current = false;
      });
  }, [ticker, date, timeframe, daysBack]);

  useEffect(() => {
    if (loading || !bars.length || !containerRef.current) return;

    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    const barTs = isWide ? toDayTs : toTs;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0c0e12' },
        textColor: '#8f9297',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#272a2f' },
        horzLines: { color: '#272a2f' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: '#272a2f',
        scaleMargins: { top: 0.1, bottom: 0.22 },
      },
      timeScale: {
        borderColor: '#272a2f',
        timeVisible: !isWide,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height,
    });
    chartRef.current = chart;

    // ── Candlestick series ────────────────────────────────────────────────
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#6bc987',
      downColor: '#ea6a64',
      borderUpColor: '#6bc987',
      borderDownColor: '#ea6a64',
      wickUpColor: '#6bc987',
      wickDownColor: '#ea6a64',
    });

    const candleData = bars.map(b => ({
      time: barTs(b.t),
      open: b.o, high: b.h, low: b.l, close: b.c,
    }));
    candleSeries.setData(candleData);

    // ── VWAP line ─────────────────────────────────────────────────────────
    // Alpaca's per-bar `vw` is just that bar's own volume-weighted price, which
    // tracks the candles almost exactly and isn't a useful indicator on its own.
    // A session VWAP is the running cumulative average from the open, so it's
    // built here as a running sum rather than plotted bar-by-bar. Only meaningful
    // within a single session, so skip it on the daily/weekly wide-context view.
    if (!isWide) {
      let cumPV = 0;
      let cumVol = 0;
      const vwapData = [];
      for (const b of bars) {
        if (b.vw != null && b.v) {
          cumPV += b.vw * b.v;
          cumVol += b.v;
        }
        if (cumVol > 0) vwapData.push({ time: barTs(b.t), value: cumPV / cumVol });
      }
      if (vwapData.length) {
        const vwapSeries = chart.addLineSeries({
          color: '#8f9297',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          priceLineVisible: false,
          lastValueVisible: true,
          title: 'VWAP',
        });
        vwapSeries.setData(vwapData);
      }
    }

    // ── Volume histogram ──────────────────────────────────────────────────
    const volSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
      borderVisible: false,
    });
    volSeries.setData(bars.map(b => ({
      time: barTs(b.t),
      value: b.v,
      color: b.c >= b.o ? 'rgba(107,201,135,0.32)' : 'rgba(234,106,100,0.32)',
    })));

    // ── Price lines: entry, exit, stop, target ────────────────────────────
    const entryFills = executions.filter(e => side === 'LONG' ? e.action === 'BOT' : e.action === 'SOLD');
    const exitFills  = executions.filter(e => side === 'LONG' ? e.action === 'SOLD' : e.action === 'BOT');
    const ae = avgPrice(entryFills);
    const ax = avgPrice(exitFills);

    if (ae) candleSeries.createPriceLine({ price: ae, color: '#6bc987', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'Entry' });
    if (ax) candleSeries.createPriceLine({ price: ax, color: '#ea6a64', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'Exit' });
    if (analysis?.stop_loss) candleSeries.createPriceLine({ price: Number(analysis.stop_loss), color: '#e8a95c', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: 'SL' });
    if (analysis?.target_price) candleSeries.createPriceLine({ price: Number(analysis.target_price), color: '#5bb0d7', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: 'Target' });

    // ── Execution markers ────────────────────────────────────────────────
    // Colored and shaped by the actual fill action (matches the Buy/Sell legend
    // below the chart), not by entry/exit role — a short's opening fill is a SELL,
    // so styling it as "entry = green/up" made it look like a buy. Only meaningful
    // at intraday resolution: on the daily/weekly view a 35-minute trade is a
    // fraction of one bar, so there's nothing sensible to anchor a marker to.
    if (!isWide) {
      const bucketMin = TF_MINUTES[timeframe] || 5;
      const markers = executions
        .filter(f => f.time)
        .map(f => {
          const ts = execToTs(date, f.time, bucketMin);
          if (!ts) return null;
          const isBuy = f.action === 'BOT';
          return {
            time: ts,
            position: isBuy ? 'belowBar' : 'aboveBar',
            color: isBuy ? '#6bc987' : '#ea6a64',
            shape: isBuy ? 'arrowUp' : 'arrowDown',
            text: `${f.qty}@${f.price}`,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.time - b.time);
      if (markers.length) candleSeries.setMarkers(markers);
    }

    // Restore the pre-fetch window when this render is a background history
    // extension (below), so the view holds still instead of snapping back to
    // fitContent() every time more bars land.
    if (savedRangeRef.current) {
      chart.timeScale().setVisibleRange(savedRangeRef.current);
      savedRangeRef.current = null;
    } else {
      chart.timeScale().fitContent();
    }

    // Zoom-out-to-load-more-history: barsBefore counts real bars between the
    // left edge of the visible window and the first loaded bar. Right after
    // fitContent() it's exactly 0 — the window's left edge sits precisely on
    // the first bar, showing only what's loaded (a single session for the
    // fine intraday timeframes, by design). It only goes NEGATIVE once the
    // user actually zooms or pans past the start of the data and blank space
    // is on screen — that's the real trigger. A positive threshold like the
    // "< 10" this used to be misfires on every initial load, since a fresh
    // fitContent() view already satisfies it at 0.
    const maxDays = MAX_DAYS_BACK[timeframe] || 30;
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!range || loadingMoreRef.current || daysBack >= maxDays) return;
      const barsInfo = candleSeries.barsInLogicalRange(range);
      if (barsInfo != null && barsInfo.barsBefore < 0) {
        loadingMoreRef.current = true;
        savedRangeRef.current = chart.timeScale().getVisibleRange();
        setDaysBack(d => Math.min(maxDays, Math.max(d * 3, d + 4)));
      }
    });

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; };
  }, [bars, executions, side, analysis, height, loading, date, timeframe, isWide, daysBack]);

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8, flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>
          {ticker} · {TIMEFRAMES.find(t => t.id === timeframe)?.label} Chart · {date}
        </div>
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg-hover)', borderRadius: 6, padding: 2 }}>
          {TIMEFRAMES.map(tf => (
            <button
              key={tf.id}
              onClick={() => setTimeframe(tf.id)}
              style={{
                border: 'none', cursor: 'pointer', borderRadius: 4,
                padding: '4px 9px', fontSize: 12, fontWeight: 600,
                background: timeframe === tf.id ? 'var(--purple)' : 'transparent',
                color: timeframe === tf.id ? '#fff' : 'var(--text-muted)',
              }}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height, borderRadius: 8 }} />
      ) : warning && !bars.length ? (
        <div style={{
          height, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', fontSize: 13, textAlign: 'center',
          background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: 16,
        }}>
          {warning}
        </div>
      ) : (
        <>
          {warning && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{warning}</div>}
          <div style={{ display: 'flex', gap: 14, marginBottom: 6, fontSize: 11, color: 'var(--text-muted)' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#6bc987', marginRight: 4, verticalAlign: 'middle' }} />Buy</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#ea6a64', marginRight: 4, verticalAlign: 'middle' }} />Sell</span>
            {!isWide && <span><span style={{ display: 'inline-block', width: 16, height: 2, background: '#8f9297', marginRight: 4, verticalAlign: 'middle' }} />VWAP</span>}
            {analysis?.stop_loss && <span><span style={{ display: 'inline-block', width: 16, height: 2, background: '#e8a95c', marginRight: 4, verticalAlign: 'middle' }} />SL</span>}
            {analysis?.target_price && <span><span style={{ display: 'inline-block', width: 16, height: 2, background: '#5bb0d7', marginRight: 4, verticalAlign: 'middle' }} />Target</span>}
          </div>
          <div ref={containerRef} style={{ width: '100%', background: '#0c0e12', borderRadius: 6 }} />
        </>
      )}
    </div>
  );
}
