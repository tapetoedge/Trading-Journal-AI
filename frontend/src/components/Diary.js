import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, BookOpen, Trash2 } from 'lucide-react';
import { diaryApi } from '../api';

const BACKEND = 'http://localhost:8010';

function ConfidenceDot({ level }) {
  return (
    <span
      className={`confidence-dot confidence-${level || 'unmatched'}`}
      style={{ marginRight: 6 }}
      title={`Match: ${level}`}
    />
  );
}

function DeleteButton({ onDelete, small }) {
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleClick = async (e) => {
    e.stopPropagation();
    if (!confirm) { setConfirm(true); return; }
    setDeleting(true);
    await onDelete().catch(() => { setDeleting(false); setConfirm(false); });
  };

  if (confirm) {
    return (
      <span style={{ display: 'inline-flex', gap: 4 }} onClick={e => e.stopPropagation()}>
        <button
          onClick={handleClick}
          disabled={deleting}
          className="btn btn-danger"
          style={{ fontSize: 11, padding: small ? '1px 8px' : '2px 10px' }}
        >
          {deleting ? '…' : 'Confirm'}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setConfirm(false); }}
          className="btn btn-ghost"
          style={{ fontSize: 11, padding: small ? '1px 6px' : '2px 8px' }}
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="btn btn-ghost"
      style={{ padding: small ? '1px 5px' : '2px 6px', color: 'var(--text-muted)', opacity: 0.6 }}
      title="Delete"
    >
      <Trash2 size={small ? 12 : 14} />
    </button>
  );
}

function DiaryCard({ entry, onDeleted }) {
  const [expanded, setExpanded] = useState(false);
  const analysis = entry.ai_analysis;

  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div
        style={{ display: 'flex', alignItems: 'flex-start', gap: 16, cursor: 'pointer' }}
        onClick={() => setExpanded(v => !v)}
      >
        {/* Thumbnail */}
        {entry.image_path ? (
          <img
            src={`${BACKEND}/uploads/${entry.image_path}`}
            alt="Diary thumbnail"
            style={{ width: 72, height: 54, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', flexShrink: 0 }}
            onError={e => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div style={{ width: 72, height: 54, background: 'var(--bg-hover)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BookOpen size={18} color="var(--text-muted)" />
          </div>
        )}

        {/* Summary */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Entry #{entry.id}
              {analysis && (
                <span style={{ marginLeft: 8, background: 'var(--bg-hover)', padding: '1px 7px', borderRadius: 999 }}>
                  {analysis.trade_analyses?.length || 0} trades
                </span>
              )}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
              <DeleteButton onDelete={() => diaryApi.delete(entry.id).then(() => onDeleted(entry.id))} />
              {expanded ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
            </div>
          </div>
          {analysis?.overall_summary ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4, display: '-webkit-box', WebkitLineClamp: expanded ? 'none' : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {analysis.overall_summary}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>No AI analysis available.</div>
          )}
        </div>
      </div>

      {expanded && analysis && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>

          {entry.image_path && (
            <div style={{ marginBottom: 16, textAlign: 'center' }}>
              <img
                src={`${BACKEND}/uploads/${entry.image_path}`}
                alt="Diary"
                style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)' }}
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {analysis.patterns_identified?.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Patterns Identified</div>
                <ul style={{ paddingLeft: 20, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.8 }}>
                  {analysis.patterns_identified.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}
            {analysis.improvement_areas?.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Improvement Areas</div>
                <ul style={{ paddingLeft: 20, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.8 }}>
                  {analysis.improvement_areas.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}
          </div>

          {analysis.trade_analyses?.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Trade Analyses</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {analysis.trade_analyses.map((ta, i) => (
                  <div key={i} style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{ta.ticker}</span>
                      {ta.strategy && (
                        <span style={{ fontSize: 12, background: 'var(--purple-dim)', color: 'var(--purple)', padding: '1px 8px', borderRadius: 999 }}>
                          {ta.strategy}
                        </span>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', gap: 6 }}>
                        <ConfidenceDot level={ta.match_confidence} />
                        {ta.match_confidence}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, fontSize: 13 }}>
                      {ta.entry_reason && (
                        <div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>Entry Reason</div>
                          <div>{ta.entry_reason}</div>
                        </div>
                      )}
                      {ta.exit_reason && (
                        <div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>Exit Reason</div>
                          <div>{ta.exit_reason}</div>
                        </div>
                      )}
                      {ta.emotional_state && (
                        <div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>Emotional State</div>
                          <div>{ta.emotional_state}</div>
                        </div>
                      )}
                      {ta.r_multiple != null && (
                        <div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>R Multiple</div>
                          <div style={{ color: ta.r_multiple >= 0 ? 'var(--green)' : 'var(--red)' }}>{Number(ta.r_multiple).toFixed(2)}R</div>
                        </div>
                      )}
                      {ta.mistakes && (
                        <div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>Mistakes</div>
                          <div style={{ color: 'var(--red)' }}>{ta.mistakes}</div>
                        </div>
                      )}
                    </div>

                    {ta.ai_feedback && (
                      <div style={{
                        marginTop: 10, padding: '8px 12px',
                        background: 'var(--accent-dim)',
                        border: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)',
                        borderRadius: 6, fontSize: 12, color: 'var(--text)'
                      }}>
                        {ta.ai_feedback}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Diary({ accountId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (accountId != null) params.account_id = accountId;
    diaryApi.list(params)
      .then(r => { setEntries(r.data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [accountId]);

  const removeEntry = (id) => setEntries(prev => prev.filter(e => e.id !== id));

  const removeDate = (date) => setEntries(prev => prev.filter(e => e.entry_date !== date));

  // Group by date descending
  const byDate = entries.reduce((acc, e) => {
    (acc[e.entry_date] = acc[e.entry_date] || []).push(e);
    return acc;
  }, {});
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Diary</h2>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 100 }} />)}
        </div>
      )}

      {error && (
        <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{error}</div>
      )}

      {!loading && entries.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
          <BookOpen size={40} style={{ marginBottom: 16, opacity: 0.5 }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No diary entries yet</div>
          <div style={{ fontSize: 13 }}>Upload a diary screenshot on the Import page to get started.</div>
        </div>
      )}

      {dates.map(date => (
        <div key={date} style={{ marginBottom: 28 }}>
          {/* Date group header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>{date}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '1px 8px', borderRadius: 999 }}>
                {byDate[date].length} {byDate[date].length === 1 ? 'entry' : 'entries'}
              </span>
            </div>
            {byDate[date].length > 1 && (
              <DeleteButton
                onDelete={() => diaryApi.deleteByDate(date, accountId).then(() => removeDate(date))}
                small
              />
            )}
          </div>

          {/* Individual entry cards */}
          {byDate[date].map(entry => (
            <DiaryCard
              key={entry.id}
              entry={entry}
              onDeleted={removeEntry}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
