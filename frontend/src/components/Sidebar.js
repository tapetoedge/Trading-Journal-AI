import { useState } from 'react';
import {
  LayoutDashboard, TrendingUp, Upload, BarChart2,
  BookOpen, Plus, ChevronDown, Circle, CalendarDays, Check, X, Pencil, CalendarCheck, HelpCircle
} from 'lucide-react';
import { accountsApi } from '../api';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'trades', label: 'Trade View', icon: TrendingUp },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'day-review', label: 'Day Review', icon: CalendarCheck },
  { id: 'reports', label: 'Reports', icon: BarChart2 },
  { id: 'import', label: 'Import', icon: Upload },
  { id: 'diary', label: 'Diary', icon: BookOpen },
  { id: 'help', label: 'Help', icon: HelpCircle },
];

export default function Sidebar({ page, onNavigate, accounts, selectedAccountId, onSelectAccount, onAddTrade, onAccountCreated }) {
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAcct, setNewAcct] = useState({ name: '', type: 'day_trading', color: '#6366f1', broker: 'Thinkorswim' });
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const displayName = selectedAccount ? selectedAccount.name : 'All Accounts';

  const startEdit = (e, acct) => {
    e.stopPropagation();
    setEditingId(acct.id);
    setEditName(acct.name);
  };

  const saveEdit = async (e, acctId) => {
    e.stopPropagation();
    if (!editName.trim()) return;
    try {
      await accountsApi.update(acctId, { name: editName.trim() });
      await onAccountCreated();
      setEditingId(null);
    } catch (err) {
      alert('Failed to rename: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!newAcct.name.trim()) return;
    setCreating(true);
    try {
      await accountsApi.create(newAcct);
      await onAccountCreated();
      setNewAcct({ name: '', type: 'day_trading', color: '#6366f1', broker: 'Thinkorswim' });
      setShowNewAccount(false);
      setShowAccountMenu(false);
    } catch (err) {
      alert('Failed to create account: ' + (err.response?.data?.error || err.message));
    } finally {
      setCreating(false);
    }
  };

  return (
    <aside style={{
      width: 220,
      minWidth: 220,
      background: 'var(--bg-card)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28,
            background: 'var(--purple)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: 'white'
          }}>T</div>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', fontFamily: 'var(--font-body)' }}>Trading Journal AI</span>
        </div>
      </div>

      {/* Account selector */}
      <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border)', position: 'relative' }}>
        <button
          onClick={() => setShowAccountMenu(v => !v)}
          style={{
            width: '100%',
            background: 'var(--bg-hover)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '8px 10px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            color: 'var(--text)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {selectedAccount && (
              <Circle size={8} fill={selectedAccount.color} color={selectedAccount.color} />
            )}
            <span style={{ fontSize: 13 }}>{displayName}</span>
          </div>
          <ChevronDown size={14} color="var(--text-muted)" />
        </button>

        {showAccountMenu && (
          <div style={{
            position: 'absolute', top: '100%', left: 12, right: 12,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 8, zIndex: 100, marginTop: 4,
            boxShadow: 'var(--shadow-dropdown)',
          }}>
            <div
              onClick={() => { onSelectAccount(null); setShowAccountMenu(false); }}
              className={`dropdown-item${selectedAccountId === null ? ' selected' : ''}`}
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              All Accounts
            </div>
            {accounts.map(acct => (
              <div
                key={acct.id}
                onClick={() => { if (editingId !== acct.id) { onSelectAccount(acct.id); setShowAccountMenu(false); } }}
                className={`dropdown-item${selectedAccountId === acct.id ? ' selected' : ''}`}
                style={{ cursor: editingId === acct.id ? 'default' : 'pointer' }}
              >
                <Circle size={8} fill={acct.color} color={acct.color} style={{ flexShrink: 0 }} />
                {editingId === acct.id ? (
                  <>
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(e, acct.id); if (e.key === 'Escape') setEditingId(null); }}
                      onClick={e => e.stopPropagation()}
                      autoFocus
                      style={{ flex: 1, fontSize: 12, padding: '2px 6px', height: 26 }}
                    />
                    <button onClick={e => saveEdit(e, acct.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--green)' }}>
                      <Check size={13} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); setEditingId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-muted)' }}>
                      <X size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1 }}>{acct.name}</span>
                    <button
                      onClick={e => startEdit(e, acct)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-muted)', opacity: 0.5 }}
                      title="Rename account"
                    >
                      <Pencil size={11} />
                    </button>
                  </>
                )}
              </div>
            ))}
            <div
              onClick={() => setShowNewAccount(v => !v)}
              className="dropdown-item selected"
              style={{ borderTop: '1px solid var(--border)', gap: 6 }}
            >
              <Plus size={14} /> New Account
            </div>

            {showNewAccount && (
              <form onSubmit={handleCreateAccount} style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
                <input
                  placeholder="Account name"
                  value={newAcct.name}
                  onChange={e => setNewAcct(p => ({ ...p, name: e.target.value }))}
                  style={{ width: '100%', marginBottom: 8 }}
                  required
                />
                <select
                  value={newAcct.type}
                  onChange={e => setNewAcct(p => ({ ...p, type: e.target.value }))}
                  style={{ width: '100%', marginBottom: 8 }}
                >
                  <option value="day_trading">Day Trading</option>
                  <option value="swing_trading">Swing Trading</option>
                  <option value="investment">Investment</option>
                </select>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="color"
                    value={newAcct.color}
                    onChange={e => setNewAcct(p => ({ ...p, color: e.target.value }))}
                    style={{ width: 36, padding: 2, height: 34 }}
                  />
                  <button type="submit" className="btn btn-primary" disabled={creating} style={{ flex: 1 }}>
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 8px' }}>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`nav-item${page === id ? ' active' : ''}`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>

      {/* Add Trade button */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={onAddTrade}
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          <Plus size={16} /> Add Trade
        </button>
      </div>
    </aside>
  );
}
