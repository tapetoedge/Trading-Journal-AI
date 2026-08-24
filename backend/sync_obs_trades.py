"""
sync_obs_trades.py
==================
Reads today's (or a given date's) Obsidian daily note, parses the ## Trades
section, and syncs plan fields (stop_loss, target_price, strategy, idea_source,
mistakes, emotional_state, notes) into trade_analysis in the journal DB.

Matching: ticker + closest avg_entry within a configurable price tolerance.
Only non-empty note fields are written; existing DB values are not overwritten
unless --force is passed.

Usage
-----
    python sync_obs_trades.py                 # today
    python sync_obs_trades.py --date 2026-06-04
    python sync_obs_trades.py --date 2026-06-04 --force
    python sync_obs_trades.py --dry-run
"""

import argparse
import json
import os
import re
import sqlite3
from datetime import date
from pathlib import Path

from dotenv import load_dotenv

from database import DB_PATH

load_dotenv()

# ── config ────────────────────────────────────────────────────────────────────
# The vault path comes from the OBSIDIAN_VAULT_PATH env var (backend/.env).
# Leave it empty to keep the Obsidian sync feature off.

_VAULT_ENV = os.getenv("OBSIDIAN_VAULT_PATH", "").strip()
VAULT = Path(_VAULT_ENV) if _VAULT_ENV else None
DB = Path(DB_PATH)
PRICE_TOLERANCE = 5.00   # max $/share difference to still count as a match

# ── parse daily note ──────────────────────────────────────────────────────────

def _extract_number(text: str | None) -> float | None:
    """First numeric value in free text, or None.

    Requires a leading digit so stray commas/words (e.g. 'Calls,', 'None')
    can't match and crash float(). Tolerates $, thousands separators, decimals.
    """
    if not text:
        return None
    m = re.search(r"\$?\s*(\d[\d,]*(?:\.\d+)?)", text)
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", ""))
    except ValueError:
        return None


def parse_obs_trades(note_date: str) -> list[dict]:
    """Return list of trade dicts parsed from the ## Trades section."""
    if VAULT is None:
        raise FileNotFoundError(
            "Obsidian sync is off. Set OBSIDIAN_VAULT_PATH in backend/.env to "
            "your vault folder to enable it.")
    # Look for the daily note in the vault root and in a "01 Daily" subfolder.
    candidates = [VAULT / f"{note_date}.md", VAULT / "01 Daily" / f"{note_date}.md"]
    path = next((c for c in candidates if c.exists()), None)
    if path is None:
        raise FileNotFoundError(
            f"Daily note not found: {candidates[0]} (also tried '01 Daily/')")

    text = path.read_text(encoding="utf-8")

    # Extract the ## Trades section (stop at next ## heading)
    m = re.search(r"^## Trades\s*\n(.+?)(?=^## |\Z)", text, re.MULTILINE | re.DOTALL)
    if not m:
        return []
    section = m.group(1)

    trades = []
    # Each trade block starts with ### Trade N — TICKER ...
    blocks = re.split(r"^### Trade \d+", section, flags=re.MULTILINE)
    for block in blocks:
        if not block.strip():
            continue

        # Ticker from header line: " — MRVL (attempt 1)\n- ..."
        ticker_m = re.match(r"\s*[—-]+\s*([A-Z]+)", block)
        if not ticker_m:
            continue
        ticker = ticker_m.group(1).upper()

        # Parse block line-by-line: "- LABEL: VALUE" (value may be blank)
        parsed = {}
        for line in block.splitlines():
            lm = re.match(r"^-\s+([^:]+):\s*(.*?)\s*$", line)
            if lm:
                key = lm.group(1).strip()
                val = lm.group(2).strip()
                parsed[key.lower()] = val if val else None

        def get(label: str) -> str | None:
            return parsed.get(label.lower())

        def price(label: str) -> float | None:
            return _extract_number(get(label))

        # Entry: "Long $286.90" -> 286.90.  For an option line like
        # "Calls, $205 strike @ $0.68" prefer the premium after the "@".
        entry_raw = get("direction / entry")
        if entry_raw and "@" in entry_raw:
            entry_price = _extract_number(entry_raw.rsplit("@", 1)[-1])
        else:
            entry_price = _extract_number(entry_raw)

        trades.append({
            "ticker":          ticker,
            "entry_price":     entry_price,
            "stop_loss":       price("stop loss"),
            "target_price":    price("target"),
            "strategy":        get("strategy"),
            "idea_source":     get("source"),
            "mistakes":        get("mistakes"),
            "emotional_state": get("emotion"),
            "notes":           get("notes"),
        })

    return trades

# ── db helpers ────────────────────────────────────────────────────────────────

def avg_entry(executions_json: str, side: str) -> float | None:
    try:
        execs = json.loads(executions_json or "[]")
    except Exception:
        return None
    fills = [e for e in execs
             if (side == "LONG" and e.get("action") == "BOT") or
                (side == "SHORT" and e.get("action") == "SOLD")]
    qty = sum(e.get("qty", 0) for e in fills)
    if not qty:
        return None
    return sum(e.get("price", 0) * e.get("qty", 0) for e in fills) / qty

def load_db_trades(conn: sqlite3.Connection, trade_date: str) -> list[dict]:
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """SELECT t.trade_group, t.ticker, t.side, t.executions,
                  ta.stop_loss, ta.target_price, ta.strategy,
                  ta.idea_source, ta.mistakes, ta.emotional_state, ta.notes
           FROM trades t
           LEFT JOIN trade_analysis ta ON t.trade_group = ta.trade_group
           WHERE t.date = ?
           ORDER BY t.id""",
        (trade_date,),
    ).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["avg_entry"] = avg_entry(d.pop("executions", None), d["side"])
        result.append(d)
    return result

def upsert_analysis(conn: sqlite3.Connection, trade_group: str,
                    ticker: str, trade_date: str, updates: dict):
    existing = conn.execute(
        "SELECT id FROM trade_analysis WHERE trade_group=?", (trade_group,)
    ).fetchone()
    if not existing:
        conn.execute(
            "INSERT INTO trade_analysis (trade_group, ticker, date) VALUES (?,?,?)",
            (trade_group, ticker, trade_date),
        )
    set_clause = ", ".join(f"{k}=?" for k in updates)
    conn.execute(
        f"UPDATE trade_analysis SET {set_clause} WHERE trade_group=?",
        list(updates.values()) + [trade_group],
    )
    conn.commit()

# ── matching ──────────────────────────────────────────────────────────────────

def match_trades(note_trades: list[dict], db_trades: list[dict],
                 tolerance: float) -> list[tuple]:
    """
    Returns list of (note_trade, db_trade) pairs.
    Greedy nearest-price match per ticker; unmatched note trades get db=None.
    """
    remaining = list(db_trades)
    pairs = []

    for nt in note_trades:
        candidates = [d for d in remaining if d["ticker"] == nt["ticker"]]
        if not candidates:
            pairs.append((nt, None))
            continue

        # Score by price distance (prefer exact match)
        if nt["entry_price"] is None:
            best = candidates[0]
            dist = 0.0
        else:
            scored = []
            for c in candidates:
                dist = abs((c["avg_entry"] or 0) - nt["entry_price"])
                scored.append((dist, c))
            scored.sort(key=lambda x: x[0])
            dist, best = scored[0]
            if dist > tolerance:
                pairs.append((nt, None))
                continue

        pairs.append((nt, best))
        remaining.remove(best)

    return pairs

# ── main ──────────────────────────────────────────────────────────────────────

PLAN_FIELDS = ["stop_loss", "target_price", "strategy", "idea_source",
               "mistakes", "emotional_state", "notes"]

def sync(trade_date: str, dry_run: bool = False, force: bool = False):
    print(f"\n=== Obsidian -> Journal sync  ({trade_date}) ===\n")

    note_trades = parse_obs_trades(trade_date)
    if not note_trades:
        print("No trades found in Obsidian note.")
        return

    print(f"Parsed {len(note_trades)} trade block(s) from Obsidian note.")

    conn = sqlite3.connect(str(DB))
    db_trades = load_db_trades(conn, trade_date)
    print(f"Found {len(db_trades)} trade record(s) in DB for {trade_date}.\n")

    pairs = match_trades(note_trades, db_trades, PRICE_TOLERANCE)

    any_change = False
    for nt, dt in pairs:
        ticker = nt["ticker"]
        ep = f"${nt['entry_price']:.2f}" if nt["entry_price"] else "?"

        if dt is None:
            print(f"  !  {ticker} @ {ep} — no DB match within ${PRICE_TOLERANCE:.2f} tolerance (skipped)")
            continue

        ae = f"${dt['avg_entry']:.2f}" if dt["avg_entry"] else "?"
        print(f"  OK  {ticker} @ {ep}  ->  {dt['trade_group']} (avg_entry {ae})")

        # Build updates: note fields that are non-empty
        updates = {}
        for f in PLAN_FIELDS:
            note_val = nt.get(f)
            db_val   = dt.get(f)
            if note_val is None:
                continue   # nothing in note -> leave DB alone
            if db_val is not None and not force:
                print(f"       {f}: already set ({db_val!r}) — skipping (use --force to overwrite)")
                continue
            updates[f] = note_val
            print(f"       {f}: {db_val!r}  ->  {note_val!r}")

        if updates and not dry_run:
            upsert_analysis(conn, dt["trade_group"], ticker, trade_date, updates)
            any_change = True
        elif updates and dry_run:
            print("       [dry-run: not written]")
        else:
            print("       (nothing to update)")

    conn.close()
    print()
    if dry_run:
        print("Dry run complete — no changes written.")
    elif any_change:
        print("Sync complete — DB updated.")
    else:
        print("Sync complete — no changes needed.")


def run_sync(trade_date: str, force: bool = False) -> dict:
    """
    Structured version of sync() — returns a result dict instead of printing.
    Called by the FastAPI endpoint so the frontend can display results.
    """
    try:
        note_trades = parse_obs_trades(trade_date)
    except FileNotFoundError as e:
        return {"error": str(e), "date": trade_date}

    conn = sqlite3.connect(str(DB))
    db_trades = load_db_trades(conn, trade_date)
    pairs = match_trades(note_trades, db_trades, PRICE_TOLERANCE)

    matched = []
    unmatched = []

    for nt, dt in pairs:
        ticker = nt["ticker"]
        ep = nt["entry_price"]

        if dt is None:
            unmatched.append({
                "ticker": ticker,
                "entry_price": ep,
                "reason": f"no DB trade within ${PRICE_TOLERANCE:.0f} price tolerance",
            })
            continue

        written = {}
        skipped = {}
        for f in PLAN_FIELDS:
            note_val = nt.get(f)
            db_val   = dt.get(f)
            if note_val is None:
                continue
            if db_val is not None and not force:
                skipped[f] = db_val
                continue
            written[f] = note_val

        if written:
            upsert_analysis(conn, dt["trade_group"], ticker, trade_date, written)

        matched.append({
            "ticker":       ticker,
            "trade_group":  dt["trade_group"],
            "entry_price":  ep,
            "avg_entry":    dt["avg_entry"],
            "written":      written,
            "skipped":      skipped,
            "status":       "updated" if written else "no_change",
        })

    conn.close()

    return {
        "date":         trade_date,
        "note_trades":  len(note_trades),
        "db_trades":    len(db_trades),
        "matched":      matched,
        "unmatched":    unmatched,
        "updated_count": sum(1 for m in matched if m["status"] == "updated"),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sync Obsidian trade plan -> journal DB")
    parser.add_argument("--date",    default=str(date.today()), help="YYYY-MM-DD (default: today)")
    parser.add_argument("--dry-run", action="store_true",       help="Parse and match but don't write")
    parser.add_argument("--force",   action="store_true",       help="Overwrite existing DB values")
    args = parser.parse_args()
    sync(args.date, dry_run=args.dry_run, force=args.force)
