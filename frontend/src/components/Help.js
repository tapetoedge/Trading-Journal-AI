import { useState } from 'react';

const METRICS = [
  {
    category: 'Dashboard KPIs',
    items: [
      {
        name: 'Net P&L',
        formula: 'Sum of all closed trade P&L after commissions',
        description: 'Your total realized profit or loss for the selected period.',
        why: 'The bottom line. Every other metric is just an explanation for why this number is what it is.',
        target: null,
      },
      {
        name: 'Total Trades',
        formula: 'Count of completed round-trip positions',
        description: 'Number of trades that opened and closed within the period.',
        why: 'Provides denominator context. A 70% win rate on 10 trades is very different from 70% on 300 trades.',
        target: null,
      },
      {
        name: 'Trade Win %',
        formula: 'Winning trades / Total trades × 100',
        description: 'Percentage of individual trades that closed with a positive net P&L.',
        why: 'High win rate feels good but is meaningless without knowing your average win vs. loss size. A 40% win rate with a 3:1 reward:risk ratio beats a 70% win rate with 0.5:1.',
        target: '55-65% for momentum setups; 40%+ acceptable if avg win/loss > 2',
      },
      {
        name: 'Profit Factor',
        formula: 'Gross winning P&L / Gross losing P&L',
        description: 'Ratio of total money made on winners to total money lost on losers.',
        why: 'A profit factor above 1.0 means you make more than you lose. Below 1.0 is a losing system regardless of win rate. Values above 1.5 indicate a solid edge; above 2.0 is exceptional.',
        target: '1.5 or above',
      },
      {
        name: 'Day Win %',
        formula: 'Positive P&L days / Total trading days × 100',
        description: 'Percentage of trading sessions where you ended the day profitable.',
        why: 'Measures consistency at the session level, not just the trade level. A trader with 80% day win rate but a few large blowup days is a different risk profile than steady 60%.',
        target: '70-80%',
      },
      {
        name: 'Avg Win / Loss',
        formula: 'Average winning trade $ / Average losing trade $',
        description: 'How much you make on a typical winner relative to how much you lose on a typical loser.',
        why: 'Combined with win rate, this determines expectancy. If your ratio is below 1.0, you need a very high win rate just to break even. Most prop traders target 1.5-2.5.',
        target: '1.5 or above',
      },
      {
        name: 'Expectancy',
        formula: '(Win% × Avg Win) + (Loss% × Avg Loss)',
        description: 'Expected dollar value earned per trade, on average, over many trades.',
        why: 'The single most important metric for knowing if you have a real edge. Positive expectancy means the system makes money over time. Negative means it loses no matter how good your individual setups feel. $39/trade across 1,000 trades = $39,000.',
        target: 'Positive; $25+ per trade is strong for intraday',
      },
    ],
  },
  {
    category: 'Reports & Edge Analytics',
    items: [
      {
        name: 'Time-of-Day P&L',
        formula: 'Net P&L summed per 30-minute bucket (9:30 - 4:00)',
        description: 'Aggregate profit and loss broken down by the 30-minute window when the trade was entered.',
        why: 'Most intraday traders discover they lose money after a specific time. If your 1:00-2:30 PM bar is reliably red, that is a simple rule: stop trading after lunch. High-probability windows usually cluster in the first 90 minutes.',
        target: 'Identify your highest and lowest P&L windows, then focus or avoid accordingly',
      },
      {
        name: 'Day-of-Week P&L',
        formula: 'Net P&L summed per calendar day (Mon-Fri)',
        description: 'Aggregate profit and loss by day of the week across all traded sessions.',
        why: 'Many traders have consistent biases - bad Mondays (low conviction on thin pre-market), bad Fridays (profit-taking pressure), strong Thursdays. If the pattern persists over 100+ days, it is structural and tradeable.',
        target: 'Any day that is reliably negative over 30+ samples is worth sizing down or skipping',
      },
      {
        name: 'R-Multiple Distribution',
        formula: 'Actual P&L / Planned risk per trade, binned into 0.5R steps',
        description: 'A histogram of trade outcomes expressed as multiples of your planned risk. A 2R trade returned twice your stop loss distance; a -1R trade hit your stop.',
        why: 'This tells you whether your execution matches your plan. If you plan 2R targets but most trades are 0.3R scratches, you are cutting winners early. If there is a fat tail on the left side, you are not respecting stops. Requires R-multiple to be logged per trade.',
        target: 'Mode should be positive; distribution should be right-skewed (more positive outcomes than negative)',
      },
      {
        name: 'Emotion vs. Outcome',
        formula: 'Win rate and avg P&L grouped by logged emotional state',
        description: 'A breakdown of performance by the emotional state you logged: calm, anxious, overconfident, disciplined, frustrated, revenge.',
        why: '"Revenge" and "frustrated" rows almost always show the worst numbers. Seeing the actual dollar cost of trading angry is more powerful than any rule about not revenge trading. Requires emotional state to be logged per trade.',
        target: '"Calm" and "disciplined" rows should outperform your overall average; "revenge" should be a red flag',
      },
      {
        name: 'Hold Time (Winners vs. Losers)',
        formula: 'Avg minutes from first fill to last fill, split by outcome',
        description: 'Average time you hold winning trades vs. losing trades. Computed from execution timestamps.',
        why: 'The #1 behavioral bias of retail traders is holding losers too long and cutting winners too early. If your losers are held 2x longer than winners, you are hoping for recovery instead of respecting your plan.',
        target: 'Winners held longer than losers is a sign of good discipline',
      },
      {
        name: 'Mistake Frequency',
        formula: 'Count of each mistake tag from trade analysis and diary entries',
        description: 'A ranked list of the mistakes you make most often, sourced from your trade journal notes and AI tagging.',
        why: 'Repetition is the signal. You already know your rules. This chart shows which ones you break most. Fix one mistake at a time - the highest bar first.',
        target: 'Bars should shrink over time as you address each mistake systematically',
      },
    ],
  },
];

const FEATURES = [
  {
    name: 'Dashboard',
    icon: '🗂',
    description: 'Real-time overview of all KPIs, cumulative and daily P&L charts, a calendar heatmap, open positions, recent trades, and Time-of-Day and Day-of-Week charts.',
    tips: [
      'Use the date range picker to compare any period (e.g., this month vs. last month).',
      'Click any calendar day to jump directly to Day Review for that session.',
      'Click the gear icon next to the title to edit your performance goals.',
    ],
  },
  {
    name: 'Goals',
    icon: '🎯',
    description: 'Editable performance targets for each KPI card. A progress bar appears below each metric showing how close you are to your goal, turning green when met.',
    tips: [
      'Open the Goals panel with the gear icon in the Dashboard header.',
      'Goals are saved per account - you can set different targets for your day trading vs. swing account.',
      'Default targets: Win Rate 65%, Profit Factor 1.5, Day Win Rate 75%, Expectancy $50, Avg Win/Loss 1.5.',
    ],
  },
  {
    name: 'Trade View',
    icon: '📋',
    description: 'Full trade log with filtering by date range, ticker, side, and strategy. Click any row to open execution detail and AI-generated coaching.',
    tips: [
      'Use the date filter to isolate a specific setup or time period.',
      'The AI coaching tab inside each trade pulls context from your diary and provides specific feedback.',
    ],
  },
  {
    name: 'Calendar',
    icon: '📅',
    description: 'Monthly heatmap with color-coded P&L per day. Week and month totals shown in the margins.',
    tips: [
      'Green days are profitable, red days are losses. Shade intensity reflects magnitude.',
      'Click any day to navigate directly to the Day Review for that session.',
    ],
  },
  {
    name: 'Day Review',
    icon: '📆',
    description: 'Deep dive into a single trading session. Shows all trades, individual P&L, AI daily coaching report, and the Weekly Summary generator.',
    tips: [
      'The AI coaching report grades your session based on execution quality, not just P&L.',
      'Use the Weekly Summary button to generate a cross-week behavioral synthesis (cached after first generation).',
      'The Circuit Breaker banner fires automatically after 3 consecutive losing trades in the session.',
    ],
  },
  {
    name: 'Edge',
    icon: '🎯',
    description: 'Four behavioral analytics charts: R-Multiple Distribution, Emotion vs. Outcome, Mistake Frequency, and Hold Time. These reveal patterns invisible in raw P&L.',
    tips: [
      'R-Multiple and Emotion data require filling in the analysis fields on each trade.',
      'Mistake frequency comes from both diary AI tagging and manual trade notes.',
      'Hold Time is computed automatically from execution timestamps - no manual logging needed.',
    ],
  },
  {
    name: 'Import',
    icon: '📤',
    description: 'CSV importer for Thinkorswim account statements. Automatically parses executions, groups them into trades, and detects duplicates on re-import. See the README for a Claude Code prompt that adapts it to any other broker.',
    tips: [
      'Re-importing a file is safe - duplicates are detected by trade group and skipped.',
      'If you deleted a bad trade and need to re-import it, the re-import will restore it cleanly.',
    ],
  },
  {
    name: 'Strategies',
    icon: '📊',
    description: 'P&L, win rate, and trade count broken down by strategy name. Strategy names come from your diary AI analysis.',
    tips: [
      'Upload diary entries to start populating strategy data.',
      'Strategies with negative P&L across 10+ trades are signals to reduce size or stop trading that setup.',
    ],
  },
  {
    name: 'Diary',
    icon: '📓',
    description: 'AI-powered trade diary. Upload handwritten notes, screenshots, or typed text. Claude extracts setup, entry/exit reason, emotional state, mistakes, and R-multiple.',
    tips: [
      'The more detail you write in your pre/post-market notes, the better the AI extraction.',
      'Diary entries are matched to trades automatically by ticker and date.',
    ],
  },
  {
    name: 'Brain',
    icon: '🧠',
    description: 'AI chatbot with full context of your trade history. Ask any question about your performance and patterns.',
    tips: [
      'Ask: "What is my best performing setup?" or "When do I tend to revenge trade?"',
      'Brain has access to all your trades, P&L, and analysis - it answers from your actual data, not generic advice.',
    ],
  },
  {
    name: 'Weekly Summary',
    icon: '📝',
    description: 'AI-generated behavioral synthesis for the week. Available as a collapsible card in Day Review. Identifies the week\'s anchor mistake, standout edge, and one rule to carry forward.',
    tips: [
      'Generated on demand, cached after the first generation.',
      'Best run at the end of the trading week (Friday) to capture the full picture.',
      'Use "Force regenerate" to get a fresh analysis if you logged more trades or diary entries.',
    ],
  },
  {
    name: 'Circuit Breaker',
    icon: '🔶',
    description: 'An orange banner that appears automatically in Day Review when you have 3 or more consecutive losing trades in the current session.',
    tips: [
      'This is not a hard stop - it is a pause prompt. The research on this is clear: a brief pause after 3 losses significantly reduces revenge trading.',
      'Dismiss it with the X if you have consciously reviewed and decided to continue.',
    ],
  },
];

const CHANGELOG = [
  {
    version: 'v0.5',
    date: '2026-06-15',
    title: 'Goals and targets',
    changes: [
      'Added editable performance goals to all 5 KPI cards (Trade Win %, Profit Factor, Day Win %, Avg Win/Loss, Expectancy).',
      'Progress bar on each card shows percentage toward goal; turns green with a checkmark when goal is met.',
      'Goals panel opens from the gear icon in the Dashboard header. Values are editable inline.',
      'Goals persist per account in the settings table. Defaults applied on first load (Win Rate 65%, PF 1.5, Day Win 75%, Expectancy $50, Avg W/L 1.5).',
      'Help and Changelog page added (this page).',
    ],
  },
  {
    version: 'v0.4',
    date: '2026-06-15',
    title: 'Dashboard analytics and AI upgrades',
    changes: [
      'Added Expectancy as a 7th KPI card: (Win% x Avg Win) + (Loss% x Avg Loss). The most important aggregate metric.',
      'Time-of-Day P&L chart: 30-minute entry buckets from 9:30 to 4:00, showing your best and worst trading windows.',
      'Day-of-Week P&L chart: Mon-Fri aggregate, revealing systematic session biases.',
      'New Edge page with four behavioral analytics charts: R-Multiple Distribution, Emotion vs. Outcome, Mistake Frequency, and Hold Time.',
      'Weekly AI Summary: Claude synthesizes behavioral patterns across the full week (not per-day grading). Cached after first generation.',
      'Circuit Breaker: Orange dismissible banner fires when 3+ consecutive losing trades are detected in the current session.',
      'Max drawdown computation added to backend KPI endpoint.',
    ],
  },
  {
    version: 'v0.3',
    date: '2026-06-14',
    title: 'AI coaching and Brain chatbot',
    changes: [
      'Daily AI coaching report in Day Review: grades execution quality, flags mistakes, suggests one improvement.',
      'Brain chatbot: full-context AI assistant with access to all trades, P&L, and diary analysis.',
      'Obsidian sync: push daily trade notes to the Obsidian vault for second-brain integration.',
      'Weekly summary endpoint with behavioral pattern synthesis.',
    ],
  },
  {
    version: 'v0.2',
    date: '2026-06-13',
    title: 'Diary AI analysis and trade detail',
    changes: [
      'Diary upload and AI parsing: Claude extracts setup, entry/exit reason, emotional state, R-multiple, and mistakes from handwritten or typed notes.',
      'Trade detail panel with execution breakdown, AI coaching tab, and manual analysis fields.',
      'Strategy breakdown by P&L, win rate, and count (sourced from diary AI tagging).',
      'Insight panel: AI-generated setup-level patterns across all trades.',
    ],
  },
  {
    version: 'v0.1',
    date: '2026-06-11',
    title: 'Core trading journal',
    changes: [
      'CSV import for Thinkorswim account statement exports. Auto-groups executions into round-trip trades.',
      'Dashboard with 6 KPI cards, cumulative P&L area chart, and daily P&L bar chart.',
      'Calendar heatmap with monthly MTD and per-day win rate.',
      'Trade log with date and ticker filtering.',
      'Account management (multiple accounts, per-account color coding).',
      'Add trade manually modal.',
    ],
  },
];

function MetricCard({ item }) {
  return (
    <div style={{
      background: 'var(--bg-hover)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '14px 16px',
    }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{item.name}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontFamily: 'var(--font-mono)', background: 'var(--bg)', padding: '3px 7px', borderRadius: 4, display: 'inline-block' }}>
        {item.formula}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 8, lineHeight: 1.5 }}>{item.description}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: item.target ? 8 : 0 }}>
        <span style={{ color: 'var(--purple)', fontWeight: 600 }}>Why it matters: </span>{item.why}
      </div>
      {item.target && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <span style={{ color: 'var(--green)', fontWeight: 600 }}>Target: </span>{item.target}
        </div>
      )}
    </div>
  );
}

function FeatureCard({ feature }) {
  return (
    <div style={{
      background: 'var(--bg-hover)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>{feature.icon}</span>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{feature.name}</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, marginBottom: 10 }}>{feature.description}</div>
      {feature.tips.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          {feature.tips.map((tip, i) => <li key={i}>{tip}</li>)}
        </ul>
      )}
    </div>
  );
}

function ChangelogEntry({ entry }) {
  return (
    <div style={{ display: 'flex', gap: 20, marginBottom: 28 }}>
      <div style={{ width: 4, background: 'var(--purple)', borderRadius: 2, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{entry.title}</span>
          <span style={{ fontSize: 12, color: 'var(--purple)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{entry.version}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{entry.date}</span>
        </div>
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8 }}>
          {entry.changes.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      </div>
    </div>
  );
}

export default function Help() {
  const [tab, setTab] = useState('reference');

  const tabStyle = (id) => ({
    padding: '8px 18px',
    border: 'none',
    borderBottom: tab === id ? '2px solid var(--purple)' : '2px solid transparent',
    background: 'none',
    cursor: 'pointer',
    fontWeight: tab === id ? 700 : 400,
    color: tab === id ? 'var(--text)' : 'var(--text-muted)',
    fontSize: 14,
    marginBottom: -1,
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Help and Reference</h2>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 24, display: 'flex', gap: 4 }}>
        <button style={tabStyle('reference')} onClick={() => setTab('reference')}>Metrics and Features</button>
        <button style={tabStyle('changelog')} onClick={() => setTab('changelog')}>Changelog</button>
      </div>

      {tab === 'reference' && (
        <div>
          {METRICS.map(section => (
            <div key={section.category} style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>
                {section.category}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
                {section.items.map(item => <MetricCard key={item.name} item={item} />)}
              </div>
            </div>
          ))}

          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>
              Features
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
              {FEATURES.map(f => <FeatureCard key={f.name} feature={f} />)}
            </div>
          </div>
        </div>
      )}

      {tab === 'changelog' && (
        <div style={{ maxWidth: 700 }}>
          {CHANGELOG.map(entry => <ChangelogEntry key={entry.version} entry={entry} />)}
        </div>
      )}
    </div>
  );
}
