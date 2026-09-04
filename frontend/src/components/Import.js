import { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Image, CheckCircle, AlertCircle } from 'lucide-react';
import { importApi } from '../api';

function TextPreview({ file }) {
  const [text, setText] = useState('');
  useEffect(() => {
    const reader = new FileReader();
    reader.onload = e => setText(e.target.result);
    reader.readAsText(file);
  }, [file]);
  return (
    <div style={{ background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border)', padding: 10, fontSize: 11, color: 'var(--text)', fontFamily: 'monospace', maxHeight: 160, overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
      {text || 'Loading preview...'}
    </div>
  );
}

function DropZone({ label, accept, onFile, file, icon: Icon }) {
  const [active, setActive] = useState(false);
  const inputRef = useRef();

  const handleDrop = (e) => {
    e.preventDefault();
    setActive(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };

  return (
    <div
      className={`dropzone ${active ? 'active' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setActive(true); }}
      onDragLeave={() => setActive(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current.click()}
    >
      <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={e => onFile(e.target.files[0])} />
      {file ? (
        <div>
          <Icon size={24} style={{ marginBottom: 8, color: 'var(--purple)' }} />
          <div style={{ fontWeight: 500, color: 'var(--text)' }}>{file.name}</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>{(file.size / 1024).toFixed(0)} KB</div>
        </div>
      ) : (
        <div>
          <Icon size={28} style={{ marginBottom: 10 }} />
          <div style={{ fontWeight: 500 }}>{label}</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Drag & drop or click to browse</div>
        </div>
      )}
    </div>
  );
}

export default function Import({ accounts, accountId }) {
  // CSV import state
  const [csvFile, setCsvFile] = useState(null);
  const [csvAccountId, setCsvAccountId] = useState(accountId || '');
  const [importing, setImporting] = useState(false);
  const [csvResult, setCsvResult] = useState(null);
  const [csvError, setCsvError] = useState(null);

  // Diary upload state
  const [diaryFile, setDiaryFile] = useState(null);
  const [diaryDate, setDiaryDate] = useState(new Date().toISOString().slice(0, 10));
  const [diaryAccountId, setDiaryAccountId] = useState(accountId || '');
  const [analyzing, setAnalyzing] = useState(false);
  const [diaryResult, setDiaryResult] = useState(null);
  const [diaryError, setDiaryError] = useState(null);

  const handleCsvImport = async () => {
    if (!csvFile || !csvAccountId) {
      setCsvError('Please select a file and an account.');
      return;
    }
    setImporting(true);
    setCsvResult(null);
    setCsvError(null);
    const fd = new FormData();
    fd.append('file', csvFile);
    fd.append('account_id', csvAccountId);
    try {
      const res = await importApi.importCsv(fd);
      setCsvResult(res.data);
    } catch (e) {
      setCsvError(e.response?.data?.error || e.message);
    } finally {
      setImporting(false);
    }
  };

  const handleDiaryUpload = async () => {
    if (!diaryFile || !diaryAccountId || !diaryDate) {
      setDiaryError('Please select an image, account, and date.');
      return;
    }
    setAnalyzing(true);
    setDiaryResult(null);
    setDiaryError(null);
    const fd = new FormData();
    fd.append('file', diaryFile);
    fd.append('account_id', diaryAccountId);
    fd.append('date', diaryDate);
    try {
      const res = await importApi.uploadDiary(fd);
      setDiaryResult(res.data);
      if (res.data.analysis_error) {
        setDiaryError('Diary saved, but AI analysis failed: ' + res.data.analysis_error);
      }
    } catch (e) {
      setDiaryError(e.response?.data?.error || e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Import</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* CSV Import */}
        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} color="var(--purple)" />
            Import Thinkorswim CSV
          </div>

          <DropZone
            label="Drop Thinkorswim account statement CSV"
            accept=".csv"
            onFile={setCsvFile}
            file={csvFile}
            icon={FileText}
          />

          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>Account</label>
            <select
              value={csvAccountId}
              onChange={e => setCsvAccountId(e.target.value)}
              style={{ width: '100%' }}
              required
            >
              <option value="">Select account...</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
            onClick={handleCsvImport}
            disabled={importing || !csvFile || !csvAccountId}
          >
            {importing ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Importing...</> : <><Upload size={16} /> Import Trades</>}
          </button>

          {csvResult && (
            <div style={{ marginTop: 12, padding: 12, background: 'rgba(107,201,135,0.1)', border: '1px solid rgba(107,201,135,0.3)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--green)', fontWeight: 600, marginBottom: 4 }}>
                <CheckCircle size={16} /> Import Complete
              </div>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>{csvResult.message}</div>
              {csvResult.errors?.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>
                  {csvResult.errors.length} DB error(s)
                </div>
              )}
            </div>
          )}

          {csvError && (
            <div style={{ marginTop: 12, padding: 12, background: 'rgba(234,106,100,0.1)', border: '1px solid rgba(234,106,100,0.3)', borderRadius: 8, color: 'var(--red)', fontSize: 13 }}>
              <AlertCircle size={14} style={{ marginRight: 6 }} />{csvError}
            </div>
          )}

          <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
            Export from Thinkorswim desktop: <em>Monitor → Account Statement → export icon → Export to File (CSV)</em>
          </div>
        </div>

        {/* Diary Upload */}
        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Image size={18} color="var(--purple)" />
            Analyze Trading Diary
          </div>

          {diaryFile ? (
            <div style={{ marginBottom: 12 }}>
              {/\.(txt|csv)$/i.test(diaryFile.name) ? (
                <TextPreview file={diaryFile} />
              ) : /\.(heic|heif)$/i.test(diaryFile.name) ? (
                // Browsers cannot render HEIC; the server converts it to JPEG on upload.
                <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                  {diaryFile.name} (iPhone photo, will be converted on upload)
                </div>
              ) : (
                <img src={URL.createObjectURL(diaryFile)} alt="Diary preview"
                  style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
              )}
              <button className="btn btn-ghost" style={{ fontSize: 12, marginTop: 6 }} onClick={() => setDiaryFile(null)}>Remove</button>
            </div>
          ) : (
            <DropZone
              label="Drop a photo of handwritten notes, a screenshot, or a .txt / .csv file"
              accept=".png,.jpg,.jpeg,.webp,.gif,.heic,.heif,.txt,.csv"
              onFile={setDiaryFile}
              file={null}
              icon={Image}
            />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>Date</label>
              <input
                type="date"
                value={diaryDate}
                onChange={e => setDiaryDate(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>Account</label>
              <select
                value={diaryAccountId}
                onChange={e => setDiaryAccountId(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">Select account...</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
            onClick={handleDiaryUpload}
            disabled={analyzing || !diaryFile || !diaryAccountId || !diaryDate}
          >
            {analyzing
              ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Analyzing with Claude AI...</>
              : <><Upload size={16} /> Analyze Diary</>
            }
          </button>

          {analyzing && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              Claude is reading your diary. This takes 10 to 20 seconds...
            </div>
          )}

          {diaryResult && !diaryResult.analysis_error && (
            <div style={{ marginTop: 12, padding: 12, background: 'rgba(107,201,135,0.1)', border: '1px solid rgba(107,201,135,0.3)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--green)', fontWeight: 600, marginBottom: 4 }}>
                <CheckCircle size={16} /> Analysis Complete
              </div>
              {diaryResult.trade_count != null && (
                <div style={{ fontSize: 13 }}>Found {diaryResult.trade_count} trade(s) in your diary.</div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>View full analysis in the Diary page.</div>
            </div>
          )}

          {diaryError && (
            <div style={{ marginTop: 12, padding: 12, background: 'rgba(234,106,100,0.1)', border: '1px solid rgba(234,106,100,0.3)', borderRadius: 8, color: 'var(--red)', fontSize: 13 }}>
              <AlertCircle size={14} style={{ marginRight: 6 }} />{diaryError}
            </div>
          )}

          <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
            Claude AI will read your handwritten or typed notes and extract strategy, stops, R-multiples, emotional state, and more.
          </div>
        </div>
      </div>
    </div>
  );
}
