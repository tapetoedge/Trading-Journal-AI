# Trading Journal AI

## Watch the walkthrough

[![Watch: I built my own AI trading journal and stopped paying monthly](https://img.youtube.com/vi/LTR4HOfS_hc/maxresdefault.jpg)](https://www.youtube.com/watch?v=LTR4HOfS_hc)

A full tour of the app, an install from an empty folder, and three prompts that change it while
the camera is running. Every prompt used in the video is in the video description, ready to paste.

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
- **Import**: Thinkorswim account statement CSV (default)

## Quick start

Requirements: Python 3.11+, Node 18+.

```bash
# 1. Python environment + backend dependencies
python -m venv .venv
.venv\Scripts\activate         # Windows (source .venv/bin/activate on Mac/Linux)
pip install -r backend/requirements.txt

# 2. Frontend dependencies
cd frontend
npm install
cd ..

# 3. Run both (Windows; launch.bat picks up .venv automatically)
launch.bat
```

`launch.bat` starts the FastAPI backend on http://localhost:8010 and the React frontend on http://localhost:3010. On Mac/Linux run them manually: `uvicorn main:app --reload --port 8000` from `backend/`, and `npm start` from `frontend/`.

This is a clean install: zero accounts, zero trades. Add your first account in the app, then import your broker's CSV or use `scripts/sample_import.csv` on the Import page to see the shape of an import (one demo day, remove it after).

**Want to explore with realistic data first?** Run `python scripts/seed_demo.py` before `launch.bat` to seed 12 weeks of synthetic trades across 3 demo accounts. It's the same data the screenshots use. Delete `backend/trading_journal.db` afterward to reset to a clean install.

## Environment variables

Copy `.env.example` to `backend/.env` and fill in the keys yourself, or ask Claude Code to do it:

**Add your API keys:**

> Copy backend/.env.example to backend/.env. Then ask me for my Anthropic API key, and after that my Alpaca key ID and secret key, one at a time. Write each one into the matching line in backend/.env exactly as I paste it. Do not print any of them back to me or log them anywhere else. When all three are in, tell me to restart launch.bat.

Everything is optional; the app runs without any keys and tells you exactly which feature each missing key disables.

| Variable | Enables |
|---|---|
| `ANTHROPIC_API_KEY` | Diary analysis, Day Review, Weekly Summary, Insights, and the Brain chat |
| `APCA_API_KEY_ID` / `APCA_API_SECRET_KEY` | Intraday price charts on each trade (free Alpaca account works) |
| `ALPACA_DATA_FEED` | Optional, defaults to `iex` (free-tier data). Set to `sip` only if your key has a paid market-data subscription. |

## Make it yours with Claude Code

This repo is meant to be adapted, and the fastest way is to point Claude Code at it. A ready-to-paste prompt:

**Adapt the importer to your broker:**

> Read backend/csv_parser.py. It parses Thinkorswim account statement CSVs: it splits the file into sections, reads execution rows (date, time, buy/sell, quantity, symbol, price, fees), and groups them into round-trip trades by position open/close cycles. Here is a sample CSV export from my broker (pasted below / attached). Write a parser for my broker's format that returns the same execution dict shape (action BOT/SOLD, qty, ticker, price, instrument_type, date, iso_date, time, amount, commission), wire it into parse_thinkorswim_csv or add it as a new function called from backend/main.py's /api/import-csv, and update the Import page label. Keep the duplicate-detection fingerprints working.

## License

MIT. See [LICENSE](LICENSE).
