import { useState } from 'react';
import { tradesApi } from '../api';
import { Edit2, Trash2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import TradingChart from './TradingChart';

const fmt$ = (v) => {
  if (v == null) return '—';
  const n = Number(v);
  return (n >= 0 ? '' : '-') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function ConfidenceDot({ level }) {
  return (
    <span
      className={`confidence-dot confidence-${level || 'unmatched'}`}
      title={`Match confidence: ${level || 'unmatched'}`}
    />
  );
}


export default function TradeRow({ trade, openTime, onEdit, onDeleted, onOpenDetail, customSetups = [], onCustomSetupsChanged }) {
  const [expanded, setExpanded] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [tags, setTags] = useState([]);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const pnl = trade.net_pnl ?? 0;
  const pnlColor = pnl >= 0 ? 'var(--green)' : 'var(--red)';

  const loadAnalysis = async () => {
    if (analysis !== null || loadingAnalysis) return;
    setLoadingAnalysis(true);
    try {
      const res = await tradesApi.getAnalysis(trade.trade_group);
      setAnalysis(res.data.analysis || {});
      setTags(res.data.tags || []);
    } catch (e) {
      setAnalysis({});
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) loadAnalysis();
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await tradesApi.delete(trade.id);
      onDeleted(trade.id);
    } catch (e) {
      alert('Delete failed: ' + e.message);
      setDeleting(false);
    }
  };

  const tagColors = {
    strategy: '#5bb0d7', setup: '#8f9297', execution: '#6bc987',
    mistake: '#ea6a64', emotion: '#e8a95c', outcome: '#5fb8b0'
  };

  // Playbook setup tag: set by hand from the dropdown below.
  const ADD_NEW = '__add_new__';

  /** Setup cell: shows the badge, click to tag. Stock trades only. */
  function SetupEditor({ trade }) {
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [local, setLocal] = useState({
      setup: trade.setup, grade: trade.setup_grade,
      notes: trade.setup_notes, source: trade.setup_source,
    });

    if (trade.instrument_type && trade.instrument_type !== 'STOCK') {
      return <span style={{ color: 'var(--text-faint)', fontSize: 13 }} title="Setups are tagged on stock trades only">—</span>;
    }

    const save = async (value) => {
      if (value === ADD_NEW) {
        const name = window.prompt(
          'Name your setup, e.g. "Bookmap absorption read".\n\n'
          + 'It gets added to the dropdown for every trade.');
        if (!name || !name.trim()) { setEditing(false); return; }
        setSaving(true);
        try {
          await tradesApi.createCustomSetup({ name: name.trim() });
          if (onCustomSetupsChanged) await onCustomSetupsChanged();
          value = name.trim();
        } catch (e) {
          alert('Could not add setup: ' + (e?.response?.data?.detail || e.message));
          setSaving(false); setEditing(false); return;
        }
      }
      setSaving(true);
      try {
        const { data } = await tradesApi.setSetup(trade.id, value === '' ? null : value);
        setLocal({
          setup: data.setup,
          grade: data.setup_grade !== undefined ? data.setup_grade : local.grade,
          notes: null,
          source: data.setup_source,
        });
        setEditing(false);
      } catch (e) {
        alert('Could not save setup: ' + (e?.response?.data?.detail || e.message));
      } finally {
        setSaving(false);
      }
    };

    if (editing) {
      return (
        <select
          autoFocus
          disabled={saving}
          defaultValue={local.setup === 'NONE' ? 'NONE' : (local.setup || '')}
          onChange={e => save(e.target.value)}
          onBlur={() => setEditing(false)}
          style={{
            background: 'var(--bg-card)', color: 'var(--text)',
            border: '1px solid var(--blue, #5bb0d7)', borderRadius: 4,
            fontSize: 12, padding: '3px 6px', maxWidth: 260,
          }}
        >
          <option value="">(clear tag)</option>
          {customSetups.length > 0 && (
            <optgroup label="Playbook">
              {customSetups.map(cs => (
                <option key={cs.id} value={cs.name}>
                  {cs.name}{cs.side ? ` (${cs.side.toLowerCase()})` : ''}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Other">
            <option value="NONE">No setup</option>
            <option value={ADD_NEW}>+ Add a new setup…</option>
          </optgroup>
        </select>
      );
    }

    return (
      <span
        onClick={() => setEditing(true)}
        title="Click to set the setup manually"
        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
      >
        <SetupBadge
          setup={local.setup}
          grade={local.grade}
          notes={local.notes}
          strategy={trade.strategy}
          source={local.source}
        />
        {local.source === 'manual' && (
          <span
            title="Manually tagged"
            style={{ fontSize: 9, color: 'var(--text-faint)', fontFamily: 'var(--font-mono, monospace)' }}
          >
            ✎
          </span>
        )}
      </span>
    );
  }
  /** MFE / MAE / exit efficiency — how much of the move was there, and how much was taken. */
  function Excursion({ trade }) {
    const { mfe_pct: mfe, mae_pct: mae, exit_efficiency: eff } = trade;
    if (mfe == null && mae == null) {
      return <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>—</span>;
    }
    // Green when most of the available move was captured, red when little was.
    const effColor = eff == null ? 'var(--text-muted)'
      : eff >= 60 ? '#4ade80' : eff >= 35 ? '#fcd34d' : '#ea6a64';
    const title = [
      `MFE  ${mfe >= 0 ? '+' : ''}${Number(mfe).toFixed(2)}%  — best unrealised gain while open (the opportunity)`,
      `MAE  ${Number(mae).toFixed(2)}%  — worst unrealised loss while open (the heat taken)`,
      eff != null ? `Exit efficiency ${Number(eff).toFixed(0)}% — share of the available move you captured` : null,
    ].filter(Boolean).join('\n');
    return (
      <span title={title} style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline', fontFamily: 'var(--font-mono, monospace)', fontSize: 11 }}>
        <span style={{ color: '#4ade80' }}>{mfe >= 0 ? '+' : ''}{Number(mfe).toFixed(1)}%</span>
        <span style={{ color: 'var(--text-faint)' }}>/</span>
        <span style={{ color: '#ea6a64' }}>{Number(mae).toFixed(1)}%</span>
        {eff != null && (
          <span style={{ color: effColor, fontWeight: 700 }}>{Number(eff).toFixed(0)}%</span>
        )}
      </span>
    );
  }

  const GRADE_COLOR = {
    'A++': '#4ade80', 'A+': '#4ade80', A: '#4ade80', B: '#8bd97f',
    C: '#fcd34d', D: '#f0a860', F: '#8f9297',
  };
  const GRADE_MEANING = {
    'A++': 'textbook execution',
    'A+': 'excellent execution',
    A: 'good execution, one minor slip',
    B: 'solid, minor execution warnings',
    C: 'one clear rule broken',
    D: 'multiple rules broken',
    F: 'no qualifying setup',
  };

  function SetupBadge({ setup, grade, notes, strategy, source }) {
    // No auto-classified setup: fall back to the manually tagged strategy.
    if (!setup || setup === 'NONE') {
      return strategy
        ? <span style={{ color: 'var(--text-muted)', fontSize: 15 }}>{strategy}</span>
        : <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>—</span>;
    }
    let violations = [];
    try {
      const parsed = typeof notes === 'string' ? JSON.parse(notes) : notes;
      violations = parsed?.violations || [];
    } catch { /* notes may be absent or malformed; badge still renders */ }
    const highs = violations.filter(v => v.severity === 'high').length;
    // Colour-code by grade when one is present, neutral blue otherwise.
    const color = grade ? (GRADE_COLOR[grade] || '#8f9297') : '#5bb0d7';
    const title = [
      setup + '  (playbook setup)',
      grade ? `Grade ${grade}${GRADE_MEANING[grade] ? ` — ${GRADE_MEANING[grade]}` : ''}` : null,
      strategy ? `Tagged strategy: ${strategy}` : null,
      violations.length ? '' : null,
      ...violations.map(v => `${v.severity === 'high' ? '✕' : '!'} ${v.msg}`),
    ].filter(x => x !== null).join('\n');
    return (
      <span title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
        <span style={{
          fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, fontSize: 11,
          color, border: `1px solid ${color}55`, background: `${color}14`,
          padding: '1px 6px', borderRadius: 3, whiteSpace: 'nowrap',
        }}>{setup}</span>
        {grade && (
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, fontSize: 11, color }}>
            {grade}
          </span>
        )}
        {highs > 0 && (
          <span style={{ color: '#ea6a64', fontSize: 11, fontWeight: 700 }} title={title}>
            ✕{highs}
          </span>
        )}
      </span>
    );
  }

  return (
    <>
      <tr
        onClick={handleExpand}
        style={{ cursor: 'pointer' }}
      >
        <td style={{ color: 'var(--text-muted)', fontSize: 15 }}>
          <div>{trade.date}</div>
          {openTime && <div style={{ fontSize: 13, color: 'var(--text-muted)', opacity: 0.7 }}>{openTime.slice(0, 5)}</div>}
        </td>
        <td>
          <span style={{ fontWeight: 600 }}>{trade.ticker}</span>
        </td>
        <td>
          <span className={`badge badge-${trade.instrument_type?.toLowerCase()}`}>
            {trade.instrument_type}
          </span>
        </td>
        <td>
          <span className={`badge badge-${trade.side?.toLowerCase()}`}>
            {trade.side}
          </span>
        </td>
        <td style={{ color: pnlColor, fontWeight: 600 }}>{fmt$(pnl)}</td>
        <td onClick={e => e.stopPropagation()}>
          <SetupEditor trade={trade} />
        </td>
        <td><Excursion trade={trade} /></td>
        <td style={{ color: 'var(--text-muted)', fontSize: 15 }}>
          {trade.r_multiple != null ? `${Number(trade.r_multiple).toFixed(2)}R` : '—'}
        </td>
        <td style={{ textAlign: 'right' }}>
          <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center' }}>
            {trade.match_confidence && <ConfidenceDot level={trade.match_confidence} />}
            &nbsp;
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={9} style={{ background: 'rgba(91,176,215,0.04)', padding: 0 }}>
            <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

              {/* Left: AI Analysis */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>Trade Analysis</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {onOpenDetail && (
                      <button className="btn btn-primary" style={{ padding: '5px 10px', fontSize: 14 }} onClick={(e) => { e.stopPropagation(); onOpenDetail(trade); }}>
                        <ExternalLink size={12} /> Details
                      </button>
                    )}
                    <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 14 }} onClick={(e) => { e.stopPropagation(); onEdit(trade); }}>
                      <Edit2 size={12} /> Edit
                    </button>
                    <button className="btn btn-danger" style={{ padding: '5px 10px', fontSize: 14 }} onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}>
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>

                {confirmDelete && (
                  <div style={{ background: 'rgba(234,106,100,0.1)', border: '1px solid rgba(234,106,100,0.3)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                    <div style={{ marginBottom: 8 }}>Delete this trade? This cannot be undone.</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-danger" style={{ padding: '4px 12px' }} onClick={handleDelete} disabled={deleting}>
                        {deleting ? 'Deleting...' : 'Confirm Delete'}
                      </button>
                      <button className="btn btn-secondary" style={{ padding: '4px 12px' }} onClick={() => setConfirmDelete(false)}>Cancel</button>
                    </div>
                  </div>
                )}

                {loadingAnalysis && <div className="spinner" />}

                {analysis && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {analysis.match_confidence && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <ConfidenceDot level={analysis.match_confidence} />
                        <span style={{ color: 'var(--text-muted)' }}>Match:</span>
                        <span>{analysis.match_confidence}</span>
                        {analysis.match_notes && <span style={{ color: 'var(--text-muted)' }}>— {analysis.match_notes}</span>}
                      </div>
                    )}

                    {[
                      ['Strategy', analysis.strategy],
                      ['Entry Reason', analysis.entry_reason],
                      ['Exit Reason', analysis.exit_reason],
                      ['Stop Loss', analysis.stop_loss ? `$${analysis.stop_loss}` : null],
                      ['Risk/Trade', analysis.risk_per_trade ? `$${analysis.risk_per_trade}` : null],
                      ['R:R Planned', analysis.risk_reward ? `1:${analysis.risk_reward}` : null],
                      ['R Multiple', analysis.r_multiple != null ? `${Number(analysis.r_multiple).toFixed(2)}R` : null],
                      ['Emotional State', analysis.emotional_state],
                      ['Mistakes', analysis.mistakes],
                    ].filter(([, v]) => v).map(([label, val]) => (
                      <div key={label} style={{ display: 'flex', gap: 8, fontSize: 15 }}>
                        <span style={{ color: 'var(--text-muted)', minWidth: 110 }}>{label}</span>
                        <span style={{ color: label === 'Mistakes' ? 'var(--red)' : 'var(--text)' }}>{val}</span>
                      </div>
                    ))}

                    {analysis.ai_feedback && (
                      <div style={{
                        background: 'var(--accent-dim)',
                        border: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)',
                        borderRadius: 8, padding: '10px 12px', fontSize: 15,
                        color: 'var(--text)', marginTop: 4
                      }}>
                        {analysis.ai_feedback}
                      </div>
                    )}

                    {tags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                        {tags.map((tag, i) => (
                          <span key={i} style={{
                            padding: '2px 10px',
                            borderRadius: 999,
                            fontSize: 13,
                            background: `${tagColors[tag.tag_type] || '#8888aa'}22`,
                            color: tagColors[tag.tag_type] || 'var(--text-muted)',
                            border: `1px solid ${tagColors[tag.tag_type] || '#8888aa'}44`,
                          }}>
                            {tag.tag_value}
                          </span>
                        ))}
                      </div>
                    )}

                    {!analysis.strategy && tags.length === 0 && !analysis.ai_feedback && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 15 }}>
                        No analysis yet. Upload a diary screenshot on the Import page to get AI insights for this trade.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right: Price chart */}
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>5-Min Chart</div>
                <TradingChart
                  ticker={trade.ticker}
                  date={trade.date}
                  timeframe="5Min"
                  executions={trade.executions || []}
                  side={trade.side}
                  height={240}
                />
                {trade.instrument_type === 'OPTION' && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
                    Showing underlying {trade.ticker} chart
                    {trade.option_expiry && ` | ${trade.option_type} ${trade.option_strike} exp ${trade.option_expiry}`}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
