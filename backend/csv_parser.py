import re
import json
import csv
import io
from datetime import datetime


MONTH_MAP = {
    'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4,
    'MAY': 5, 'JUN': 6, 'JUL': 7, 'AUG': 8,
    'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12
}

# Futures multipliers ($ per point)
FUTURES_MULTIPLIERS = {
    '/ES': 50, '/MES': 5, '/NQ': 20, '/MNQ': 2,
    '/YM': 5, '/MYM': 0.5, '/RTY': 50, '/M2K': 5,
}


def normalize_date(date_str: str) -> str:
    """Convert M/D/YY or M/D/YYYY to YYYY-MM-DD."""
    parts = date_str.strip().split('/')
    if len(parts) != 3:
        return date_str
    m, d, y = parts
    if len(y) == 2:
        y = '20' + y
    return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"


def trade_group_key(date_str: str, ticker: str, instrument_type: str, seq: int,
                    option_expiry: str | None = None, option_strike: float | None = None,
                    option_type: str | None = None) -> str:
    """Build trade group key. Options include contract details to avoid collisions."""
    base = f"{date_str}_{ticker}_{instrument_type}"
    if instrument_type == 'OPTION' and option_expiry:
        strike = int(option_strike) if option_strike and float(option_strike) == int(float(option_strike)) else (option_strike or 0)
        base += f"_{option_expiry}_{strike}_{option_type or ''}"
    return f"{base}_{seq}"


def parse_option_description(description: str) -> dict | None:
    """
    Parse option descriptions including vertical spreads:
    'SOLD -4 AMD 100 (Weeklys) 22 MAY 26 430 CALL @9.50 CBOE'
    'BOT +2 TSLA 100 21 MAR 25 250 PUT @3.40'
    'BOT +1 VERTICAL MSFT 100 (Weeklys) 27 FEB 26 400/405 CALL @1.85 CBOE'
    """
    DATE_PART = (r'.*?(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{2})')

    # Vertical spread: ticker follows "VERTICAL", strike is "400/405"
    vertical = re.compile(
        r'^(BOT|SOLD)\s+[+-]?(\d+)\s+VERTICAL\s+([A-Z]+)\s+100'
        + DATE_PART +
        r'\s+([\d.]+)/([\d.]+)\s+(CALL|PUT)\s+@([\d.]+)',
        re.IGNORECASE
    )
    m = vertical.match(description.strip())
    if m:
        action, qty, ticker, day, month_str, year_2d, lower_strike, upper_strike, opt_type, price = m.groups()
        year = 2000 + int(year_2d)
        month = MONTH_MAP[month_str.upper()]
        expiry = f"{year:04d}-{month:02d}-{int(day):02d}"
        return {
            'action': action.upper(),
            'qty': int(qty),
            'ticker': ticker.upper(),
            'price': float(price),
            'instrument_type': 'OPTION',
            'option_expiry': expiry,
            'option_strike': float(lower_strike),
            'option_type': opt_type.upper(),
        }

    # Single-leg option
    single = re.compile(
        r'^(BOT|SOLD)\s+[+-]?(\d+)\s+([A-Z]+)\s+100'
        + DATE_PART +
        r'\s+([\d.]+)\s+(CALL|PUT)\s+@([\d.]+)',
        re.IGNORECASE
    )
    m = single.match(description.strip())
    if not m:
        return None

    action, qty, ticker, day, month_str, year_2d, strike, opt_type, price = m.groups()
    year = 2000 + int(year_2d)
    month = MONTH_MAP[month_str.upper()]
    expiry = f"{year:04d}-{month:02d}-{int(day):02d}"

    return {
        'action': action.upper(),
        'qty': int(qty),
        'ticker': ticker.upper(),
        'price': float(price),
        'instrument_type': 'OPTION',
        'option_expiry': expiry,
        'option_strike': float(strike),
        'option_type': opt_type.upper(),
    }


def parse_stock_description(description: str) -> dict | None:
    """
    Parse stock descriptions like:
    'BOT +400 INTC @107.67'
    'SOLD -397 INTC @106.93'
    """
    pattern = re.compile(
        r'^(BOT|SOLD)\s+[+-]?(\d[\d,]*)\s+([A-Z]+(?:\.[A-Z]+)?)\s+@([\d.]+)',
        re.IGNORECASE
    )
    m = pattern.match(description.strip())
    if not m:
        return None

    action, qty_str, ticker, price = m.groups()
    qty = int(qty_str.replace(',', ''))

    return {
        'action': action.upper(),
        'qty': qty,
        'ticker': ticker.upper(),
        'price': float(price),
        'instrument_type': 'STOCK',
        'option_expiry': None,
        'option_strike': None,
        'option_type': None,
    }


def parse_futures_description(description: str) -> dict | None:
    """
    Parse futures descriptions like:
    'BOT 1 /ES @5200.00'
    'SOLD -2 /NQH26 @19500.00'
    """
    pattern = re.compile(
        r'^(BOT|SOLD|BUY|SELL)\s+[+-]?(\d+)\s+(\/[A-Z]+[A-Z0-9]*)(?::[A-Z0-9]+)?\s+@([\d.]+)',
        re.IGNORECASE
    )
    m = pattern.match(description.strip())
    if not m:
        return None

    action, qty, ticker, price = m.groups()
    # Normalize futures action
    action_map = {'BUY': 'BOT', 'SELL': 'SOLD'}
    action = action_map.get(action.upper(), action.upper())

    return {
        'action': action,
        'qty': int(qty),
        'ticker': ticker.upper(),
        'price': float(price),
        'instrument_type': 'FUTURE',
        'option_expiry': None,
        'option_strike': None,
        'option_type': None,
    }


def parse_cash_description(description: str) -> dict | None:
    """Try option first (more specific), then stock."""
    result = parse_option_description(description)
    if result:
        return result
    return parse_stock_description(description)


def clean_amount(value: str) -> float:
    """Convert '$1,234.56' or '-1,234.56' or '($1,234.56)' to float."""
    if not value or not value.strip():
        return 0.0
    s = value.strip().replace('$', '').replace(',', '').replace('"', '')
    if s.startswith('(') and s.endswith(')'):
        s = '-' + s[1:-1]
    try:
        return float(s)
    except ValueError:
        return 0.0


def split_csv_sections(content: str) -> dict[str, list[list[str]]]:
    """
    Split Thinkorswim CSV into named sections.
    Returns dict: section_name -> list of rows (each row is list of strings).
    Sections are separated by blank lines + new header row.
    """
    sections = {}
    current_name = None
    current_rows = []

    lines = content.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Blank line = potential section boundary. Excel-saved exports pad an
        # empty row with commas out to the column count, so a line that is
        # nothing but commas counts as blank too.
        if not line or not line.replace(',', '').strip():
            if current_name and current_rows:
                sections[current_name] = current_rows
            current_name = None
            current_rows = []
            i += 1
            continue

        # Detect section headers (lines that contain known header keywords but no data-like content)
        # Section name lines: "Cash Balance", "Futures Statements", "Account Order History", etc.
        if current_name is None:
            # This line could be a section title or a header row
            # Look ahead: if the NEXT non-blank line looks like a CSV header, treat this as section name
            # Actually Thinkorswim format: section title on its own line, then header row, then data
            # e.g.:
            #   "Cash Balance"
            #   "DATE,TIME,TYPE,REF #,..."
            #   data rows...
            # OR the section header IS the first line and the column headers follow
            # We identify sections by looking for lines that are NOT comma-separated data

            # Check if this looks like a section title (few commas, no @ signs, not a data row).
            # Ignore trailing empty fields (Excel padding) so a title like
            # "Cash Balance,,,,,,,," still counts as zero real commas.
            comma_count = line.rstrip(',').count(',')
            if comma_count <= 2 and not line.startswith('"5/') and not line.startswith('5/'):
                # Likely a section title
                current_name = line.strip('"').strip()
                i += 1
                continue
            else:
                # It's a header row for an unnamed section
                current_name = 'unknown'

        # Parse as CSV row
        try:
            reader = csv.reader(io.StringIO(line))
            row = next(reader)
            current_rows.append(row)
        except Exception:
            pass
        i += 1

    if current_name and current_rows:
        sections[current_name] = current_rows

    return sections


def find_cash_balance_section(sections: dict) -> list[list[str]] | None:
    """Find the Cash Balance section rows."""
    for name, rows in sections.items():
        if 'cash' in name.lower() or (rows and 'DESCRIPTION' in str(rows[0])):
            return rows
    return None


def find_futures_section(sections: dict) -> list[list[str]] | None:
    """Find the Futures Statements section rows."""
    for name, rows in sections.items():
        if 'future' in name.lower():
            return rows
    return None


def find_trade_history_section(sections: dict) -> list[list[str]] | None:
    """Find the Account Trade History section (not Order History)."""
    for name, rows in sections.items():
        if 'trade history' in name.lower() and 'order' not in name.lower():
            return rows
    return None


def _parse_trade_history_expiry(exp_str: str) -> str | None:
    """Parse '22 MAY 26' → '2026-05-22'."""
    if not exp_str or not exp_str.strip():
        return None
    parts = exp_str.strip().split()
    if len(parts) != 3:
        return None
    day, month_str, year_2d = parts
    month = MONTH_MAP.get(month_str.upper())
    if not month:
        return None
    year = 2000 + int(year_2d)
    return f"{year:04d}-{month:02d}-{int(day):02d}"


def parse_trade_history_section(rows: list[list[str]]) -> list[dict]:
    """
    Parse Account Trade History section.
    Header: ,Exec Time,Spread,Side,Qty,Pos Effect,Symbol,Exp,Strike,Type,Price,Net Price,Order Type
    Returns executions with computed amounts (price × qty × multiplier).
    """
    if not rows:
        return []

    header_idx = None
    for i, row in enumerate(rows):
        joined = ','.join(row).upper()
        if 'EXEC TIME' in joined and 'SYMBOL' in joined:
            header_idx = i
            break

    if header_idx is None:
        return []

    header = [h.strip().upper() for h in rows[header_idx]]
    col = {h: i for i, h in enumerate(header)}

    executions = []
    for row in rows[header_idx + 1:]:
        if len(row) < 7:
            continue

        exec_time_str = row[col.get('EXEC TIME', 1)].strip() if col.get('EXEC TIME', 1) < len(row) else ''
        if not exec_time_str or ' ' not in exec_time_str:
            continue
        date_part, time_part = exec_time_str.split(' ', 1)

        side_str = row[col.get('SIDE', 3)].strip().upper() if col.get('SIDE', 3) < len(row) else ''
        if side_str not in ('BUY', 'SELL'):
            continue
        action = 'BOT' if side_str == 'BUY' else 'SOLD'

        qty_str = row[col.get('QTY', 4)].strip().lstrip('+-').replace(',', '') if col.get('QTY', 4) < len(row) else '0'
        try:
            qty = abs(int(qty_str))
        except ValueError:
            continue
        if qty == 0:
            continue

        symbol = row[col.get('SYMBOL', 6)].strip().upper() if col.get('SYMBOL', 6) < len(row) else ''
        if not symbol:
            continue

        exp_str    = row[col.get('EXP', 7)].strip()    if col.get('EXP', 7)    < len(row) else ''
        strike_str = row[col.get('STRIKE', 8)].strip() if col.get('STRIKE', 8) < len(row) else ''
        type_str   = row[col.get('TYPE', 9)].strip().upper() if col.get('TYPE', 9) < len(row) else 'STOCK'
        price_str  = row[col.get('PRICE', 10)].strip() if col.get('PRICE', 10) < len(row) else '0'

        try:
            # Thinkorswim sometimes prints a negative price on multi-lot fills in this
            # section (e.g. "-236.54"). A fill price is never negative; take abs()
            # so the cross-section dedup against Cash Balance matches correctly.
            price = abs(float(price_str))
        except ValueError:
            continue

        iso_date = normalize_date(date_part)

        if type_str in ('CALL', 'PUT'):
            instrument_type = 'OPTION'
            option_expiry = _parse_trade_history_expiry(exp_str)
            try:
                option_strike = float(strike_str)
            except ValueError:
                option_strike = None
            option_type = type_str
            multiplier = 100
        else:
            instrument_type = 'STOCK'
            option_expiry = None
            option_strike = None
            option_type = None
            multiplier = 1

        amount = price * qty * multiplier
        if action == 'BOT':
            amount = -amount

        executions.append({
            'action': action,
            'qty': qty,
            'ticker': symbol,
            'price': price,
            'instrument_type': instrument_type,
            'option_expiry': option_expiry,
            'option_strike': option_strike,
            'option_type': option_type,
            'date': date_part,
            'iso_date': iso_date,
            'time': time_part,
            'amount': round(amount, 2),
            'commission': 0.0,
        })

    return executions


def aggregate_executions(fills: list[dict]) -> dict:
    """
    Aggregate individual fills into a single trade group summary.
    Returns: side, gross_pnl, net_pnl, commissions, executions JSON.
    Uses AMOUNT from CSV (already signed — sells positive, buys negative).
    """
    if not fills:
        return {
            'side': 'LONG', 'gross_pnl': 0.0, 'net_pnl': 0.0,
            'commissions': 0.0, 'executions': '[]'
        }

    # Determine side from first fill
    first_action = fills[0]['action']
    side = 'SHORT' if first_action == 'SOLD' else 'LONG'

    commissions = sum(abs(f.get('commission', 0.0)) for f in fills)

    # Detect open positions: shares bought != shares sold means no realized P&L yet
    qty_bot = sum(f['qty'] for f in fills if f['action'] == 'BOT')
    qty_sold = sum(f['qty'] for f in fills if f['action'] != 'BOT')
    is_open = qty_bot != qty_sold

    if is_open:
        # Open trade: no realized gain/loss, commissions are the only real cost
        gross_pnl = 0.0
        net_pnl = 0.0
    else:
        # Closed trade: sum signed amounts (buys negative, sells positive in AMOUNT col)
        gross_pnl = sum(f.get('amount', 0.0) for f in fills)
        net_pnl = gross_pnl - commissions

    # Serialize executions (drop 'amount' internal field, keep display fields)
    execs = []
    for f in fills:
        execs.append({
            'date': f.get('iso_date', f.get('date', '')),
            'time': f.get('time', ''),
            'action': f.get('action', ''),
            'qty': f.get('qty', 0),
            'price': f.get('price', 0.0),
            'commission': f.get('commission', 0.0),
        })

    return {
        'side': side,
        'gross_pnl': round(gross_pnl, 2),
        'net_pnl': round(net_pnl, 2),
        'commissions': round(commissions, 2),
        'executions': json.dumps(execs),
    }


def parse_cash_balance_section(rows: list[list[str]], date_filter: str | None = None) -> list[dict]:
    """
    Parse rows from the Cash Balance section.
    Expects header: DATE,TIME,TYPE,REF #,DESCRIPTION,Misc Fees,Commissions & Fees,AMOUNT,BALANCE
    Returns list of execution dicts.
    """
    if not rows:
        return []

    # Find header row
    header_idx = None
    for i, row in enumerate(rows):
        if len(row) >= 5 and 'DATE' in row[0].upper() and 'DESCRIPTION' in str(row):
            header_idx = i
            break

    if header_idx is None:
        return []

    header = [h.strip().upper() for h in rows[header_idx]]

    # Map column names to indices
    col = {}
    for i, h in enumerate(header):
        col[h] = i

    executions = []
    for row in rows[header_idx + 1:]:
        if len(row) < 5:
            continue

        row_type = row[col.get('TYPE', 2)].strip() if col.get('TYPE', 2) < len(row) else ''
        if row_type != 'TRD':
            continue

        date_val = row[col.get('DATE', 0)].strip() if col.get('DATE', 0) < len(row) else ''
        time_val = row[col.get('TIME', 1)].strip() if col.get('TIME', 1) < len(row) else ''
        desc = row[col.get('DESCRIPTION', 4)].strip().strip('"') if col.get('DESCRIPTION', 4) < len(row) else ''

        # Remove Excel formula wrapper: ="value"
        if desc.startswith('="') and desc.endswith('"'):
            desc = desc[2:-1]

        misc_fees_idx = col.get('MISC FEES', 5)
        comm_idx = col.get('COMMISSIONS & FEES', 6)
        amount_idx = col.get('AMOUNT', 7)

        misc_fees = clean_amount(row[misc_fees_idx]) if misc_fees_idx < len(row) else 0.0
        commission = clean_amount(row[comm_idx]) if comm_idx < len(row) else 0.0
        amount = clean_amount(row[amount_idx]) if amount_idx < len(row) else 0.0

        # Total commission = misc fees + commissions & fees
        total_commission = abs(misc_fees) + abs(commission)

        parsed = parse_cash_description(desc)
        if not parsed:
            continue

        parsed.update({
            'date': date_val,
            'iso_date': normalize_date(date_val),
            'time': time_val,
            'amount': amount,
            'commission': total_commission,
            'raw_description': desc,
        })
        executions.append(parsed)

    return executions


def parse_futures_section_rows(rows: list[list[str]]) -> list[dict]:
    """
    Parse rows from the Futures Statements section.
    Header: Trade Date,Exec Date,Exec Time,Type,Ref #,Description,Misc Fees,Commissions & Fees,Amount,Balance
    """
    if not rows:
        return []

    header_idx = None
    for i, row in enumerate(rows):
        joined = ','.join(row).upper()
        if 'EXEC TIME' in joined or 'EXEC DATE' in joined:
            header_idx = i
            break

    if header_idx is None:
        return []

    header = [h.strip().upper() for h in rows[header_idx]]
    col = {h: i for i, h in enumerate(header)}

    executions = []
    for row in rows[header_idx + 1:]:
        if len(row) < 5:
            continue

        row_type = row[col.get('TYPE', 3)].strip() if col.get('TYPE', 3) < len(row) else ''
        if row_type not in ('TRD', 'TRADE'):
            continue

        trade_date = row[col.get('TRADE DATE', 0)].strip() if col.get('TRADE DATE', 0) < len(row) else ''
        exec_time = row[col.get('EXEC TIME', 2)].strip() if col.get('EXEC TIME', 2) < len(row) else ''
        desc = row[col.get('DESCRIPTION', 5)].strip().strip('"') if col.get('DESCRIPTION', 5) < len(row) else ''

        misc_fees_idx = col.get('MISC FEES', 6)
        comm_idx = col.get('COMMISSIONS & FEES', 7)
        amount_idx = col.get('AMOUNT', 8)

        misc_fees = clean_amount(row[misc_fees_idx]) if misc_fees_idx < len(row) else 0.0
        commission = clean_amount(row[comm_idx]) if comm_idx < len(row) else 0.0
        amount = clean_amount(row[amount_idx]) if amount_idx < len(row) else 0.0
        total_commission = abs(misc_fees) + abs(commission)

        parsed = parse_futures_description(desc)
        if not parsed:
            continue

        parsed.update({
            'date': trade_date,
            'iso_date': normalize_date(trade_date),
            'time': exec_time,
            'amount': amount,
            'commission': total_commission,
            'raw_description': desc,
        })
        executions.append(parsed)

    return executions


def execution_fingerprint(exec_dict: dict) -> str:
    """Create a unique key for duplicate detection. Uses iso_date so it matches stored executions."""
    date = exec_dict.get('iso_date') or exec_dict.get('date', '')
    return f"{date}|{exec_dict.get('time','')}|{exec_dict.get('ticker','')}|{exec_dict.get('action','')}|{exec_dict.get('qty','')}|{exec_dict.get('price','')}"


def get_existing_fingerprints(conn, account_id: int) -> set[str]:
    """Load all existing execution fingerprints for an account.
    Reads ticker from the trade row (not stored in executions JSON) to match execution_fingerprint format.
    """
    cursor = conn.execute(
        "SELECT ticker, executions FROM trades WHERE account_id = ?", (account_id,)
    )
    fingerprints = set()
    for row in cursor:
        ticker = row[0] or ''
        try:
            execs = json.loads(row[1] or '[]')
            for e in execs:
                fp = f"{e.get('date','')}|{e.get('time','')}|{ticker}|{e.get('action','')}|{e.get('qty','')}|{e.get('price','')}"
                fingerprints.add(fp)
        except Exception:
            pass
    return fingerprints


def _make_group_meta(date_str: str, ticker: str, instr: str, fills: list[dict]) -> dict:
    return {
        'date': normalize_date(date_str),
        'raw_date': date_str,
        'ticker': ticker,
        'instrument_type': instr,
        'option_expiry': fills[0].get('option_expiry'),
        'option_strike': fills[0].get('option_strike'),
        'option_type': fills[0].get('option_type'),
    }


def group_executions_by_position(executions: list[dict]) -> tuple[dict, dict]:
    """
    Group executions into trades based on position open/close cycles.
    Each time a position returns to 0 shares/contracts, that completes one trade.
    Fills spanning multiple days are matched correctly (e.g., buy Monday, sell Wednesday).
    The trade date is the CLOSING fill's date so P&L is realized on the exit day.
    Multiple cycles per ticker produce separate numbered trades (_1, _2, ...).
    """
    # Sort all fills chronologically so multi-day positions process in order
    executions_sorted = sorted(
        executions,
        key=lambda ex: (ex.get('iso_date', ex['date']), ex.get('time', ''))
    )

    # Key by (ticker, instrument_type) — no date — so multi-day trades stay together.
    # Options are keyed by their specific contract to avoid mixing different strikes/expiries.
    by_ticker: dict[tuple, list[dict]] = {}
    for ex in executions_sorted:
        if ex['instrument_type'] == 'OPTION':
            k = (ex['ticker'], ex['instrument_type'],
                 ex.get('option_expiry', ''), ex.get('option_strike', ''), ex.get('option_type', ''))
        else:
            k = (ex['ticker'], ex['instrument_type'])
        by_ticker.setdefault(k, []).append(ex)

    groups: dict[str, list[dict]] = {}
    group_meta: dict[str, dict] = {}

    for key_tuple, fills in by_ticker.items():
        ticker = key_tuple[0]
        instr = key_tuple[1]

        position = 0
        seq = 0
        current_fills: list[dict] = []

        for fill in fills:
            if position == 0:
                seq += 1
                current_fills = []

            qty = fill['qty']
            if fill['action'] == 'BOT':
                position += qty
            else:
                position -= qty

            current_fills.append(fill)

            if position == 0:
                close_date = current_fills[-1]['date']
                key = trade_group_key(close_date, ticker, instr, seq,
                                      current_fills[0].get('option_expiry'),
                                      current_fills[0].get('option_strike'),
                                      current_fills[0].get('option_type'))
                groups[key] = list(current_fills)
                group_meta[key] = _make_group_meta(close_date, ticker, instr, current_fills)

        # Open/unclosed position — use date of the most recent fill
        if current_fills and position != 0:
            last_date = current_fills[-1]['date']
            key = trade_group_key(last_date, ticker, instr, seq,
                                  current_fills[0].get('option_expiry'),
                                  current_fills[0].get('option_strike'),
                                  current_fills[0].get('option_type'))
            groups[key] = list(current_fills)
            group_meta[key] = _make_group_meta(last_date, ticker, instr, current_fills)

    return groups, group_meta


def _option_pos_key(ticker: str, instr: str, expiry, strike, opt_type) -> tuple:
    return (ticker, instr, expiry or '', strike or 0, opt_type or '')


def _stock_pos_key(ticker: str, instr: str) -> tuple:
    return (ticker, instr)


def _exec_pos_key(ex: dict) -> tuple:
    instr = ex.get('instrument_type', 'STOCK')
    if instr == 'OPTION':
        return _option_pos_key(ex['ticker'], instr,
                                ex.get('option_expiry'), ex.get('option_strike'), ex.get('option_type'))
    return _stock_pos_key(ex['ticker'], instr)


def load_open_positions_from_db(conn, account_id: int) -> list[dict]:
    """
    Return open trade records from the DB (positions where qty_bot != qty_sold).
    Each record includes the parsed executions list.
    """
    rows = conn.execute(
        """SELECT id, trade_group, ticker, instrument_type,
                  option_expiry, option_strike, option_type, side, executions
           FROM trades WHERE account_id = ?""",
        (account_id,)
    ).fetchall()
    open_trades = []
    for row in rows:
        d = dict(row)
        execs = json.loads(d['executions'] or '[]')
        qty_bot = sum(e.get('qty', 0) for e in execs if e.get('action') == 'BOT')
        qty_sold = sum(e.get('qty', 0) for e in execs if e.get('action') == 'SOLD')
        if qty_bot != qty_sold:
            d['parsed_execs'] = execs
            open_trades.append(d)
    return open_trades


def _rebuild_fill_from_db_exec(e: dict, trade_meta: dict) -> dict:
    """Reconstruct a full fill dict from a stored execution + trade metadata."""
    instr = trade_meta['instrument_type']
    multiplier = 100 if instr == 'OPTION' else 1
    price = e.get('price', 0.0)
    qty = e.get('qty', 0)
    amount = price * qty * multiplier
    if e.get('action') == 'BOT':
        amount = -amount
    return {
        'action': e.get('action', ''),
        'qty': qty,
        'ticker': trade_meta['ticker'],
        'price': price,
        'instrument_type': instr,
        'option_expiry': trade_meta.get('option_expiry'),
        'option_strike': trade_meta.get('option_strike'),
        'option_type': trade_meta.get('option_type'),
        'date': e.get('date', ''),
        'iso_date': e.get('date', ''),
        'time': e.get('time', ''),
        'amount': round(amount, 2),
        'commission': e.get('commission', 0.0),
    }


def _cross_section_key(ex: dict) -> str:
    """Fingerprint for deduplicating across CSV sections (no time field — formats differ)."""
    return f"{ex.get('iso_date','')}|{ex.get('ticker','')}|{ex.get('action','')}|{ex.get('qty','')}|{ex.get('price','')}"


def parse_thinkorswim_csv(content: str, account_id: int, conn=None) -> tuple[list[dict], int]:
    """
    Full CSV parse pipeline.
    Returns (list of trade dicts ready for DB insert, skipped_count).
    """
    content = content.lstrip('﻿')

    sections = split_csv_sections(content)
    cash_rows = find_cash_balance_section(sections)
    futures_rows = find_futures_section(sections)
    trade_history_rows = find_trade_history_section(sections)

    all_executions = []
    if cash_rows:
        all_executions.extend(parse_cash_balance_section(cash_rows))
    if futures_rows:
        all_executions.extend(parse_futures_section_rows(futures_rows))

    # Merge Trade History: add fills not already represented in Cash Balance / Futures.
    # Use (iso_date, ticker, action, qty, price) to match across sections — time formats differ.
    # Thinkorswim aggregates partial fills in Trade History (e.g., two CB fills of 40+60 appear as 100).
    # Check cumulative qty per (date, ticker, action, price) so those aggregated entries are skipped.
    if trade_history_rows:
        cb_exact_keys = {_cross_section_key(ex) for ex in all_executions}
        cb_qty_map: dict[tuple, int] = {}
        for ex in all_executions:
            k = (ex.get('iso_date', ''), ex.get('ticker', ''), ex.get('action', ''), ex.get('price', 0.0))
            cb_qty_map[k] = cb_qty_map.get(k, 0) + ex.get('qty', 0)
        for ex in parse_trade_history_section(trade_history_rows):
            if _cross_section_key(ex) in cb_exact_keys:
                continue
            k = (ex.get('iso_date', ''), ex.get('ticker', ''), ex.get('action', ''), ex.get('price', 0.0))
            if cb_qty_map.get(k, 0) >= ex.get('qty', 0):
                continue  # CB partial fills already cover this aggregated TH fill
            all_executions.append(ex)

    if not all_executions:
        return [], 0

    # DB-level dedup only — never dedupe within same file (Thinkorswim legitimately
    # emits identical time/price/qty fills for large split orders)
    existing_fps = get_existing_fingerprints(conn, account_id) if conn else set()
    skipped = 0
    unique_executions = []
    for exec_dict in all_executions:
        fp = execution_fingerprint(exec_dict)
        if fp in existing_fps:
            skipped += 1
        else:
            # Enrich with ticker/date for serialization
            exec_copy = dict(exec_dict)
            unique_executions.append(exec_copy)

    # Merge new fills into existing open OPTION positions from DB.
    # Options use a specific contract key (expiry/strike/type) so the match is unambiguous.
    # Stock positions are skipped here — day-trading cycles are too ambiguous to auto-merge.
    if conn:
        open_positions = load_open_positions_from_db(conn, account_id)
        open_by_key: dict[tuple, dict] = {}
        for pos in open_positions:
            if pos['instrument_type'] != 'OPTION':
                continue  # only merge options
            k = _option_pos_key(pos['ticker'], pos['instrument_type'],
                                pos.get('option_expiry'), pos.get('option_strike'), pos.get('option_type'))
            open_by_key[k] = pos

        absorbed = []
        remaining = []
        for ex in unique_executions:
            if ex.get('instrument_type') != 'OPTION':
                remaining.append(ex)
                continue
            k = _option_pos_key(ex['ticker'], ex['instrument_type'],
                                ex.get('option_expiry'), ex.get('option_strike'), ex.get('option_type'))
            if k in open_by_key:
                absorbed.append((ex, open_by_key[k]))
            else:
                remaining.append(ex)

        # Group absorbed fills by their matched open position
        pos_updates: dict[str, list[dict]] = {}
        for ex, pos in absorbed:
            tg = pos['trade_group']
            pos_updates.setdefault(tg, {'pos': pos, 'new_fills': []})['new_fills'].append(ex)

        for tg, update in pos_updates.items():
            pos = update['pos']
            new_fills = update['new_fills']
            old_fills = [_rebuild_fill_from_db_exec(e, pos) for e in pos['parsed_execs']]
            all_fills = sorted(old_fills + new_fills,
                               key=lambda f: (f.get('iso_date', ''), f.get('time', '')))
            agg = aggregate_executions(all_fills)

            # Use closing fill date for closed positions
            qty_b = sum(f['qty'] for f in all_fills if f['action'] == 'BOT')
            qty_s = sum(f['qty'] for f in all_fills if f['action'] == 'SOLD')
            if qty_b == qty_s and all_fills:
                side = pos['side']
                exit_action = 'SOLD' if side == 'LONG' else 'BOT'
                exit_fills = sorted([f for f in all_fills if f['action'] == exit_action],
                                    key=lambda f: (f.get('iso_date',''), f.get('time','')))
                new_date = exit_fills[-1].get('iso_date', all_fills[-1].get('iso_date', pos.get('date','')))
            else:
                new_date = max(f.get('iso_date', '') for f in all_fills) or pos.get('date', '')

            conn.execute(
                "UPDATE trades SET executions=?, gross_pnl=?, net_pnl=?, commissions=?, date=? WHERE trade_group=? AND account_id=?",
                (agg['executions'], agg['gross_pnl'], agg['net_pnl'], agg['commissions'],
                 new_date, tg, account_id)
            )

        conn.commit()
        unique_executions = remaining

    groups, group_meta = group_executions_by_position(unique_executions)

    trades = []
    for key, fills in groups.items():
        meta = group_meta[key]
        agg = aggregate_executions(fills)
        trades.append({
            'account_id': account_id,
            'trade_group': key,
            'date': meta['date'],
            'ticker': meta['ticker'],
            'instrument_type': meta['instrument_type'],
            'side': agg['side'],
            'gross_pnl': agg['gross_pnl'],
            'net_pnl': agg['net_pnl'],
            'commissions': agg['commissions'],
            'executions': agg['executions'],
            'option_expiry': meta['option_expiry'],
            'option_strike': meta['option_strike'],
            'option_type': meta['option_type'],
            'source': 'imported',
        })

    return trades, skipped
