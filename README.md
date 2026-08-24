# TradeJournal Demo

An AI-powered trading journal you run locally on your own machine. Import your broker's CSV, and the journal groups executions into round-trip trades, tracks your KPIs (win rate, profit factor, expectancy, drawdown, exit efficiency), and uses Claude to analyze your trading diary, grade your days, and answer questions about your own data.

This whole app was built by describing problems to Claude Code, one session at a time: "my spreadsheet can't group partial fills", "I want my handwritten diary matched to my trades", "show me when in the day I lose money". No web framework expertise required to get here, and none required to make it yours.

**What this is not:** Not financial advice. Not a signal service. All data in the screenshots and seed is synthetic.

## What's inside

- **Dashboard**: P&L curve, KPI gauges vs your goals, calendar heatmap
- **Trade View**: every trade with executions, playbook setup tags, MFE/MAE and exit efficiency, expandable AI analysis and an intraday chart
- **Reports**: breakdowns by day of week, time of day, hold time, setup, grade, symbol, side, emotion
- **Diary**: upload handwritten notes, screenshots, or typed text; Claude extracts strategy, stops, R-multiples, emotional state, and mistakes, and matches them to your actual trades
- **Day Review / Weekly Summary**: AI coaching reports graded on process, not just P&L
- **Brain**: a chat that answers questions against your full trading history
- **Import**: Thinkorswim account statement CSV (default), plus an optional Obsidian daily-note sync

## Quick start

Requirements: Python 3.11+, Node 18+.

```bash
# 1. Python environment + backend dependencies
python -m venv .venv
.venv\Scripts\activate         # Windows (source .venv/bin/activate on Mac/Linux)
pip install -r backend/requirements.txt

# 2. Seed the demo database (synthetic trades, reproducible)
python scripts/seed_demo.py

# 3. Frontend dependencies
cd frontend
npm install
cd ..

# 4. Run both (Windows; launch.bat picks up .venv automatically)
launch.bat
```

`launch.bat` starts the FastAPI backend on http://localhost:8000 and the React frontend on http://localhost:3000. On Mac/Linux run them manually: `uvicorn main:app --reload --port 8000` from `backend/`, and `npm start` from `frontend/`.

To try the import flow, use `scripts/sample_import.csv` on the Import page (it contains one fresh demo day).

## Environment variables

Copy `.env.example` to `backend/.env`. Everything is optional; the app runs without any keys and tells you exactly which feature each missing key disables.

| Variable | Enables |
|---|---|
| `ANTHROPIC_API_KEY` | Diary analysis, Day Review, Weekly Summary, Insights, and the Brain chat |
| `APCA_API_KEY_ID` / `APCA_API_SECRET_KEY` | Intraday price charts on each trade (free Alpaca account works) |
| `OBSIDIAN_VAULT_PATH` | Syncing trade plans from your Obsidian daily note into the journal |

## Make it yours with Claude Code

This repo is meant to be adapted, and the fastest way is to point Claude Code at it. Two ready-to-paste prompts:

**Adapt the importer to your broker:**

> Read backend/csv_parser.py. It parses Thinkorswim account statement CSVs: it splits the file into sections, reads execution rows (date, time, buy/sell, quantity, symbol, price, fees), and groups them into round-trip trades by position open/close cycles. Here is a sample CSV export from my broker (pasted below / attached). Write a parser for my broker's format that returns the same execution dict shape (action BOT/SOLD, qty, ticker, price, instrument_type, date, iso_date, time, amount, commission), wire it into parse_thinkorswim_csv or add it as a new function called from backend/main.py's /api/import-csv, and update the Import page label. Keep the duplicate-detection fingerprints working.

**Point the Obsidian sync at your vault layout:**

> Read backend/sync_obs_trades.py. It reads OBSIDIAN_VAULT_PATH from backend/.env, looks for a daily note named YYYY-MM-DD.md in the vault root or in "01 Daily/", and parses a "## Trades" section where each trade block is "### Trade N - TICKER" followed by "- Label: value" lines (Stop Loss, Target, Strategy, Source, Mistakes, Emotion, Notes). My daily notes live in a different folder and use a different section format (example pasted below). Update the parser to match my layout, keep the ticker + entry price matching logic, and do not overwrite existing journal values unless force is passed.

## License

MIT. See [LICENSE](LICENSE).
