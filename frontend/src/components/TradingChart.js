import { useState, useEffect, useRef } from 'react';
import { createChart, ColorType, CrosshairMode, LineStyle } from 'lightweight-charts';
import { chartApi } from '../api';

const toTs = (isoStr) => Math.floor(new Date(isoStr).getTime() / 1000);

const execToTs = (dateStr, timeStr) => {
  if (!timeStr) return null;
  const [h, m] = timeStr.slice(0, 5).split(':').map(Number);
  const rounded = Math.floor(m / 5) * 5;
  return Math.floor(
    new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(rounded).padStart(2, '0')}:00-04:00`).getTime() / 1000
  );
};

const avgPrice = (fills) => {
  const qty = fills.reduce((s, f) => s + (f.qty || 0), 0);
  if (!qty) return null;
  return fills.reduce((s, f) => s + (f.qty || 0) * (f.price || 0), 0) / qty;
};

export default function TradingChart({
  ticker, date, timeframe = '5Min',
  executions = [], side = 'LONG', analysis = null,
  height = 320,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const [bars, setBars] = useState([]);
  const [warning, setWarning] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setBars([]);
    setWarning(null);
    chartApi.get(ticker, date, timeframe)
      .then(r => { setBars(r.data.bars || []); setWarning(r.data.warning || null); })
      .catch(() => setWarning('Failed to load chart data'))
      .finally(() => setLoading(false));
  }, [ticker, date, timeframe]);

  useEffect(() => {
    if (loading || !bars.length || !containerRef.current) return;

    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

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
        timeVisible: true,
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
      time: toTs(b.t),
      open: b.o, high: b.h, low: b.l, close: b.c,
    }));
    candleSeries.setData(candleData);

    // ── VWAP line ─────────────────────────────────────────────────────────
    const vwapData = bars.filter(b => b.vw != null).map(b => ({ time: toTs(b.t), value: b.vw }));
    if (vwapData.length) {
      const vwapSeries = chart.addLineSeries({
        color: '#8f9297',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
        title: 'VWAP',
      });
      vwapSeries.setData(vwapData);
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
      time: toTs(b.t),
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

    // ── Execution markers ─────────────────────────────────────────────────
    const markers = [];
    for (const f of entryFills) {
      const ts = execToTs(date, f.time);
      if (ts) markers.push({ time: ts, position: 'belowBar', color: '#6bc987', shape: 'arrowUp', text: `${f.qty}@${f.price}` });
    }
    for (const f of exitFills) {
      const ts = execToTs(date, f.time);
      if (ts) markers.push({ time: ts, position: 'aboveBar', color: '#ea6a64', shape: 'arrowDown', text: `${f.qty}@${f.price}` });
    }
    if (markers.length) {
      markers.sort((a, b) => a.time - b.time);
      candleSeries.setMarkers(markers);
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; };
  }, [bars, executions, side, analysis, height, loading, date]);

  if (loading) return <div className="skeleton" style={{ height, borderRadius: 8 }} />;

  if (warning && !bars.length) return (
    <div style={{
      height, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-muted)', fontSize: 13, textAlign: 'center',
      background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: 16,
    }}>
      {warning}
    </div>
  );

  return (
    <div>
      {warning && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{warning}</div>}
      <div style={{ display: 'flex', gap: 14, marginBottom: 6, fontSize: 11, color: 'var(--text-muted)' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#6bc987', marginRight: 4, verticalAlign: 'middle' }} />Buy</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#ea6a64', marginRight: 4, verticalAlign: 'middle' }} />Sell</span>
        <span><span style={{ display: 'inline-block', width: 16, height: 2, background: '#8f9297', marginRight: 4, verticalAlign: 'middle' }} />VWAP</span>
        {analysis?.stop_loss && <span><span style={{ display: 'inline-block', width: 16, height: 2, background: '#e8a95c', marginRight: 4, verticalAlign: 'middle' }} />SL</span>}
        {analysis?.target_price && <span><span style={{ display: 'inline-block', width: 16, height: 2, background: '#5bb0d7', marginRight: 4, verticalAlign: 'middle' }} />Target</span>}
      </div>
      <div ref={containerRef} style={{ width: '100%', background: '#0c0e12', borderRadius: 6 }} />
    </div>
  );
}
