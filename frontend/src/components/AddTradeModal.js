import { useState } from 'react';
import { X } from 'lucide-react';
import { tradesApi } from '../api';

export default function AddTradeModal({ accounts, defaultAccountId, onClose, onSaved }) {
  const [form, setForm] = useState({
    account_id: defaultAccountId || (accounts[0]?.id || ''),
    date: new Date().toISOString().slice(0, 10),
    time: '',
    ticker: '',
    instrument_type: 'STOCK',
    side: 'LONG',
    entry_price: '',
    exit_price: '',
    quantity: 1,
    commissions: 0,
    strategy: '',
    stop_loss: '',
    risk_per_trade: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const update = (field, value) => setForm(p => ({ ...p, [field]: value }));

  const previewPnl = () => {
    const entry = parseFloat(form.entry_price);
    const exit = parseFloat(form.exit_price);
    const qty = parseInt(form.quantity);
    const comm = parseFloat(form.commissions) || 0;
    if (!entry || !exit || !qty) return null;
    const gross = form.side === 'LONG' ? (exit - entry) * qty : (entry - exit) * qty;
    return (gross - comm).toFixed(2);
  };

  const pnl = previewPnl();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.account_id) { setError('Please select an account.'); return; }
    if (!form.ticker.trim()) { setError('Ticker is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        ticker: form.ticker.toUpperCase(),
        quantity: parseInt(form.quantity),
        commissions: parseFloat(form.commissions) || 0,
        entry_price: parseFloat(form.entry_price),
        exit_price: form.exit_price ? parseFloat(form.exit_price) : null,
        stop_loss: form.stop_loss ? parseFloat(form.stop_loss) : null,
        account_id: parseInt(form.account_id),
      };
      await tradesApi.create(payload);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setSaving(false);
    }
  };

  const fieldStyle = { width: '100%', marginBottom: 0 };
  const labelStyle = { display: 'block', color: 'var(--text-muted)', fontSize: 12, marginBottom: 5 };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontWeight: 700, fontSize: 17 }}>Add Trade</h3>
          <button className="btn btn-ghost" style={{ padding: 4 }} onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

            <div>
              <label style={labelStyle}>Account</label>
              <select style={fieldStyle} value={form.account_id} onChange={e => update('account_id', e.target.value)} required>
                <option value="">Select account...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Ticker</label>
              <input style={fieldStyle} placeholder="AAPL" value={form.ticker} onChange={e => update('ticker', e.target.value)} required />
            </div>

            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" style={fieldStyle} value={form.date} onChange={e => update('date', e.target.value)} required />
            </div>

            <div>
              <label style={labelStyle}>Time (optional)</label>
              <input type="time" style={fieldStyle} value={form.time} onChange={e => update('time', e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Instrument Type</label>
              <select style={fieldStyle} value={form.instrument_type} onChange={e => update('instrument_type', e.target.value)}>
                <option value="STOCK">Stock</option>
                <option value="OPTION">Option</option>
                <option value="FUTURE">Future</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Side</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['LONG', 'SHORT'].map(s => (
                  <button
                    key={s} type="button"
                    className={`btn ${form.side === s ? (s === 'LONG' ? 'btn-primary' : 'btn-danger') : 'btn-secondary'}`}
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => update('side', s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Entry Price</label>
              <input type="number" step="0.01" style={fieldStyle} placeholder="0.00" value={form.entry_price} onChange={e => update('entry_price', e.target.value)} required />
            </div>

            <div>
              <label style={labelStyle}>Exit Price</label>
              <input type="number" step="0.01" style={fieldStyle} placeholder="0.00 (optional)" value={form.exit_price} onChange={e => update('exit_price', e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Quantity</label>
              <input type="number" min="1" style={fieldStyle} value={form.quantity} onChange={e => update('quantity', e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Commissions ($)</label>
              <input type="number" step="0.01" min="0" style={fieldStyle} value={form.commissions} onChange={e => update('commissions', e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Stop Loss</label>
              <input type="number" step="0.01" style={fieldStyle} placeholder="Price level" value={form.stop_loss} onChange={e => update('stop_loss', e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Strategy</label>
              <input style={fieldStyle} placeholder="VWAP Support..." value={form.strategy} onChange={e => update('strategy', e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>Notes</label>
            <textarea
              rows={3}
              style={{ width: '100%', resize: 'vertical' }}
              placeholder="Trade notes..."
              value={form.notes}
              onChange={e => update('notes', e.target.value)}
            />
          </div>

          {pnl != null && (
            <div style={{
              marginTop: 14, padding: '10px 14px',
              background: Number(pnl) >= 0 ? 'rgba(107,201,135,0.1)' : 'rgba(234,106,100,0.1)',
              border: `1px solid ${Number(pnl) >= 0 ? 'rgba(107,201,135,0.3)' : 'rgba(234,106,100,0.3)'}`,
              borderRadius: 8, fontSize: 14,
              color: Number(pnl) >= 0 ? 'var(--green)' : 'var(--red)',
            }}>
              Estimated Net P&L: ${Number(pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          )}

          {error && (
            <div style={{ marginTop: 12, color: 'var(--red)', fontSize: 13 }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={saving}>
              {saving ? 'Saving...' : 'Save Trade'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
