import { useState, useEffect, useCallback } from 'react';
import { Search, ChevronUp, ChevronDown } from 'lucide-react';
import { tradesApi } from '../api';
import TradeRow from './TradeRow';

const fmt$ = (v) => {
  const n = Number(v || 0);
  return (n >= 0 ? '' : '-') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const PAGE_SIZE = 25;

function getOpenTime(trade) {
  const execs = trade.executions || [];
  if (!execs.length) return '';
  return [...execs].sort((a, b) => (a.time || '').localeCompare(b.time || ''))[0].time || '';
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ChevronDown size={11} style={{ opacity: 0.25, marginLeft: 3 }} />;
  return sortDir === 'asc'
    ? <ChevronUp size={11} style={{ marginLeft: 3, color: 'var(--purple)' }} />
    : <ChevronDown size={11} style={{ marginLeft: 3, color: 'var(--purple)' }} />;
}

export default function Trades({ accountId, initialDateFrom = '', initialDateTo = '', onOpenDetail }) {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [, setEditTrade] = useState(null);
  const [page, setPage] = useState(1);

  const [customSetups, setCustomSetups] = useState([]);
  const reloadCustomSetups = useCallback(async () => {
    try {
      const res = await tradesApi.listCustomSetups();
      setCustomSetups(res.data || []);
    } catch { /* dropdown still works with the built-in setups */ }
  }, []);
  useEffect(() => { reloadCustomSetups(); }, [reloadCustomSetups]);

  const [sortCol, setSortCol] = useState('datetime');
  const [sortDir, setSortDir] = useState('desc');

  const [ticker, setTicker] = useState('');
  const [instrType, setInstrType] = useState('');
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (accountId != null) params.account_id = accountId;
      if (ticker) params.ticker = ticker;
      if (instrType) params.instrument_type = instrType;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await tradesApi.list(params);
      setTrades(res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [accountId, ticker, instrType, dateFrom, dateTo]);

  useEffect(() => { load(); setPage(1); }, [load]);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir(col === 'datetime' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const sorted = [...trades].sort((a, b) => {
    let av, bv;
    switch (sortCol) {
      case 'datetime':
        av = (a.date || '') + '|' + getOpenTime(a);
        bv = (b.date || '') + '|' + getOpenTime(b);
        break;
      case 'ticker': av = a.ticker || ''; bv = b.ticker || ''; break;
      case 'side': av = a.side || ''; bv = b.side || ''; break;
      case 'type': av = a.instrument_type || ''; bv = b.instrument_type || ''; break;
      case 'net_pnl': av = a.net_pnl ?? 0; bv = b.net_pnl ?? 0; break;
      case 'r_multiple': av = a.r_multiple ?? -999; bv = b.r_multiple ?? -999; break;
      default: av = a.date || ''; bv = b.date || '';
    }
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalNet = trades.reduce((s, t) => s + (t.net_pnl || 0), 0);
  const winners = trades.filter(t => (t.net_pnl || 0) > 0).length;
  const winRate = trades.length ? (winners / trades.length * 100).toFixed(1) : 0;

  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

  const thStyle = (col) => ({
    cursor: 'pointer',
    userSelect: 'none',
    color: sortCol === col ? 'var(--purple)' : undefined,
    whiteSpace: 'nowrap',
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Trade View</h2>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)' }}>
          <span>{trades.length} trades</span>
          <span style={{ color: totalNet >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt$(totalNet)} net P&L</span>
          <span>{winRate}% win rate</span>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            placeholder="Ticker..."
            value={ticker}
            onChange={e => setTicker(e.target.value)}
            style={{ paddingLeft: 30, width: 120 }}
          />
        </div>
        <select value={instrType} onChange={e => setInstrType(e.target.value)} style={{ width: 120 }}>
          <option value="">All Types</option>
          <option value="STOCK">Stock</option>
          <option value="OPTION">Option</option>
          <option value="FUTURE">Future</option>
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 140 }} />
        <span style={{ color: 'var(--text-muted)' }}>to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 140 }} />
        {(ticker || instrType || dateFrom || dateTo) && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: '6px 10px' }}
            onClick={() => { setTicker(''); setInstrType(''); setDateFrom(''); setDateTo(''); }}
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('datetime')} style={thStyle('datetime')}>
                  Date / Time <SortIcon col="datetime" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th onClick={() => handleSort('ticker')} style={thStyle('ticker')}>
                  Ticker <SortIcon col="ticker" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th onClick={() => handleSort('type')} style={thStyle('type')}>
                  Type <SortIcon col="type" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th onClick={() => handleSort('side')} style={thStyle('side')}>
                  Side <SortIcon col="side" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th onClick={() => handleSort('net_pnl')} style={thStyle('net_pnl')}>
                  Net P&L <SortIcon col="net_pnl" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th>Setup / Strategy</th>
                <th title="MFE / MAE / exit efficiency — best gain reached, worst loss reached, and the share of the move you captured">MFE / MAE</th>
                <th onClick={() => handleSort('r_multiple')} style={thStyle('r_multiple')}>
                  R <SortIcon col="r_multiple" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th style={{ textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(8)].map((_, j) => (
                      <td key={j}><div className="skeleton" style={{ height: 16, width: '80%' }} /></td>
                    ))}
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                    No trades found. Import a CSV to get started.
                  </td>
                </tr>
              ) : (
                paginated.map(trade => (
                  <TradeRow
                    key={trade.id}
                    trade={trade}
                    openTime={getOpenTime(trade)}
                    onEdit={setEditTrade}
                    onDeleted={(id) => setTrades(prev => prev.filter(t => t.id !== id))}
                    onOpenDetail={(t) => onOpenDetail(t, paginated)}
                    customSetups={customSetups}
                    onCustomSetupsChanged={reloadCustomSetups}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, padding: '12px', borderTop: '1px solid var(--border)'
          }}>
            <button className="btn btn-secondary" style={{ padding: '4px 12px' }} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              ← Prev
            </button>
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Page {page} of {totalPages}</span>
            <button className="btn btn-secondary" style={{ padding: '4px 12px' }} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
