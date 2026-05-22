import os
import sqlite3
import datetime
import re
import tempfile
from io import BytesIO
from flask import Flask, jsonify, request, send_file, render_template

from reportlab.lib.pagesizes import A5
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

try:
    import pandas as pd
except ImportError:
    pd = None

app = Flask(__name__, template_folder='templates', static_folder='static')

DB_PATH = "deepsikha_residency_clean.db"
OWNERS_EXCEL = "owners.xlsx"

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def setup_database():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS income (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            flat_no TEXT, 
            year TEXT, 
            month TEXT, 
            amount REAL, 
            date_received TEXT
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year TEXT, 
            month TEXT, 
            description TEXT, 
            amount REAL, 
            date_spent TEXT
        )
    ''')
    conn.commit()
    conn.close()

# Initialize Database
setup_database()

def get_owners_map():
    # Fallback default flats
    flats_map = {}
    for f in ['1','2','3','4','5','6','7','8']:
        for l in ['A','B','C','D','E','F','G','H']:
            flats_map[f"{f}{l}"] = f"Flat {f}{l}"

    # Try loading from owners.xlsx
    if pd is not None:
        excel_file = None
        # Check current directory for owners.xlsx
        for filename in os.listdir("."):
            if filename.lower().startswith("owners") and (filename.endswith(".xlsx") or filename.endswith(".xls")):
                excel_file = filename
                break

        if excel_file and os.path.exists(excel_file):
            try:
                df = pd.read_excel(excel_file)
                header_row_idx = 0
                for idx, row in df.iterrows():
                    row_str = str(row.values).upper()
                    if "FLAT NO" in row_str or "FLAT" in row_str:
                        header_row_idx = idx + 1
                        break
                        
                if header_row_idx > 0:
                    df = pd.read_excel(excel_file, skiprows=header_row_idx)

                for _, row in df.iterrows():
                    if len(row.values) >= 3:
                        name_val = str(row.values[1]).strip()
                        flat_val = str(row.values[2]).strip().upper().replace(" ", "")
                        if flat_val and flat_val != "NAN" and flat_val in flats_map:
                            if name_val and name_val != "nan":
                                flats_map[flat_val] = f"{flat_val} - {name_val}"
            except Exception as e:
                print(f"Error reading owners excel: {e}")

    # Format the list for dropdown consumption
    formatted_list = []
    for fid in sorted(flats_map.keys()):
        # If the map only contains the fallback, format it as "1A - Flat 1A"
        val = flats_map[fid]
        if val == f"Flat {fid}":
            formatted_list.append(f"{fid} - Flat {fid}")
        else:
            formatted_list.append(val)
    return formatted_list

def number_to_words(number):
    try:
        val = round(float(number), 2)
    except (ValueError, TypeError):
        return ""
    
    rupees = int(val)
    paise = int(round((val - rupees) * 100))
    
    def convert_below_thousand(n):
        units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", 
                 "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
        tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]
        
        res = ""
        if n >= 100:
            res += units[n // 100] + " Hundred "
            n %= 100
        if n >= 20:
            res += tens[n // 10] + " "
            n %= 10
        if n > 0:
            res += units[n] + " "
        return res.strip()

    def convert_whole_number(num):
        if num == 0:
            return "Zero"
        crore = num // 10000000
        num %= 10000000
        lakh = num // 100000
        num %= 100000
        thousand = num // 1000
        num %= 1000
        
        parts = []
        if crore > 0:
            parts.append(convert_below_thousand(crore) + " Crore")
        if lakh > 0:
            parts.append(convert_below_thousand(lakh) + " Lakh")
        if thousand > 0:
            parts.append(convert_below_thousand(thousand) + " Thousand")
        if num > 0:
            parts.append(convert_below_thousand(num))
        return " ".join(parts).strip()

    if rupees == 0 and paise == 0:
        return "Zero Rupees Only"
        
    words = ""
    if rupees > 0:
        words += convert_whole_number(rupees) + " Rupees"
    
    if paise > 0:
        if rupees > 0:
            words += " and "
        words += convert_below_thousand(paise) + " Paise"
        
    return words.strip() + " Only"

def get_owner_name_for_flat(flat_no):
    owners = get_owners_map()
    flat_prefix = f"{flat_no.strip().upper()} - "
    for o in owners:
        if o.startswith(flat_prefix):
            return o[len(flat_prefix):].strip()
    return f"Flat {flat_no}"

def draw_receipt_background(canvas, doc):
    canvas.saveState()
    width, height = doc.pagesize
    
    # Outer thin border
    canvas.setStrokeColor(colors.HexColor("#0f172a")) # Dark Slate
    canvas.setLineWidth(1)
    canvas.rect(10, 10, width - 20, height - 20)
    
    # Inner thin border
    canvas.setStrokeColor(colors.HexColor("#0284c7")) # Teal/Sky blue
    canvas.setLineWidth(1.5)
    canvas.rect(14, 14, width - 28, height - 28)
    
    # Add light grey watermark pattern in background (e.g. "DEEPSIKHA RESIDENCY")
    canvas.setFont("Helvetica-Bold", 36)
    canvas.setFillColor(colors.HexColor("#f8fafc")) # extremely light slate
    canvas.drawCentredString(width / 2.0, height / 2.0 - 10, "DEEPSIKHA RESIDENCY")
    
    canvas.restoreState()

def generate_pdf_receipt(filename, receipt_id, flat_no, owner_name, amount, date_str, year, month, logo_path):
    # Landscape A5 pagesize: width = 595.27, height = 419.53
    doc = SimpleDocTemplate(filename, pagesize=(595.27, 419.53),
                            leftMargin=30, rightMargin=30, topMargin=30, bottomMargin=30)
    
    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle(
        'ReceiptTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#0f172a") # Dark Slate
    )
    
    subtitle_style = ParagraphStyle(
        'ReceiptSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#475569") # Muted Slate
    )
    
    label_style = ParagraphStyle(
        'ReceiptLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#334155")
    )
    
    value_style = ParagraphStyle(
        'ReceiptValue',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#0f172a")
    )
    
    amount_label_style = ParagraphStyle(
        'ReceiptAmountLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#0f172a")
    )
    
    amount_value_style = ParagraphStyle(
        'ReceiptAmountValue',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=18,
        textColor=colors.HexColor("#059669") # Emerald green
    )
    
    word_style = ParagraphStyle(
        'ReceiptWords',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#475569")
    )
    
    sign_style = ParagraphStyle(
        'ReceiptSign',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        alignment=1, # Center
        textColor=colors.HexColor("#334155")
    )

    story = []
    
    # 1. Header Section (Logo on left, Title & subtitle on right)
    logo_flowable = ""
    if os.path.exists(logo_path):
        logo_flowable = Image(logo_path, width=50, height=50)
    else:
        logo_flowable = Paragraph("<b>[LOGO]</b>", title_style)
        
    title_text = "<b>DEEPSIKHA RESIDENCY (BLOCK - 2)</b>"
    sub_text = "Flat Owners Association<br/>Deepsikha Residency, Block 2, Flat 1-8 A-H, Asansol"
    
    header_title_p = Paragraph(title_text, title_style)
    header_sub_p = Paragraph(sub_text, subtitle_style)
    
    text_table = Table([[header_title_p], [header_sub_p]], colWidths=[380])
    text_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
    ]))
    
    header_table = Table([[logo_flowable, text_table]], colWidths=[65, 470])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('LINEBELOW', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")), # light separator
    ]))
    story.append(header_table)
    story.append(Spacer(1, 12))
    
    # 2. Receipt metadata
    meta_left = Paragraph("<b>MONEY RECEIPT</b>", title_style)
    
    meta_right_data = [
        [Paragraph("<b>Receipt No:</b>", label_style), Paragraph(receipt_id, value_style)],
        [Paragraph("<b>Date:</b>", label_style), Paragraph(date_str, value_style)]
    ]
    meta_right_table = Table(meta_right_data, colWidths=[80, 100])
    meta_right_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('TOPPADDING', (0,0), (-1,-1), 2),
    ]))
    
    meta_table = Table([[meta_left, meta_right_table]], colWidths=[355, 180])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 8))
    
    # 3. Receipt body
    body_data = [
        [Paragraph("<b>Received From:</b>", label_style), Paragraph(owner_name, value_style),
         Paragraph("<b>Flat No:</b>", label_style), Paragraph(flat_no, value_style)],
        
        [Paragraph("<b>For Period:</b>", label_style), Paragraph(f"{month} {year}", value_style),
         Paragraph("<b>Purpose:</b>", label_style), Paragraph("Maintenance Charge Collection", value_style)]
    ]
    
    body_table = Table(body_data, colWidths=[100, 200, 80, 155])
    body_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#fafafa")),
    ]))
    story.append(body_table)
    story.append(Spacer(1, 15))
    
    # 4. Financial totals
    amt_words = number_to_words(amount)
    amt_words_p = Paragraph(f"<b>Amount in Words:</b> {amt_words}", word_style)
    
    totals_left_data = [
        [Paragraph("<b>Total Paid:</b>", amount_label_style), Paragraph(f"Rs. {amount:,.2f}", amount_value_style)],
        [amt_words_p, ""]
    ]
    
    totals_left_table = Table(totals_left_data, colWidths=[100, 235])
    totals_left_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('SPAN', (0,1), (1,1)),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
    ]))
    
    # Signature line
    sign_p = Paragraph("<font color='#cbd5e1'>_______________________</font><br/><b>Authorized Signatory</b><br/>Deepsikha Residency", sign_style)
    
    totals_table = Table([[totals_left_table, sign_p]], colWidths=[355, 180])
    totals_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ALIGN', (1,0), (1,0), 'CENTER'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(totals_table)
    
    doc.build(story, onFirstPage=draw_receipt_background)


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/flats', methods=['GET'])
def get_flats():
    return jsonify(get_owners_map())

@app.route('/api/receipt/<int:entry_id>', methods=['GET'])
def get_receipt(entry_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, flat_no, year, month, amount, date_received FROM income WHERE id = ?", (entry_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return jsonify({"error": "Receipt not found."}), 404
        
    flat_no = row["flat_no"]
    year = row["year"]
    month = row["month"]
    amount = row["amount"]
    date_received = row["date_received"]
    
    owner_name = get_owner_name_for_flat(flat_no)
    
    try:
        y_int = int(year[:4])
        receipt_year = f"{y_int}-{str(y_int+1)[2:]}"
    except Exception:
        receipt_year = year
        
    receipt_id = f"DR-{receipt_year}-{row['id']:04d}"
    
    buffer = BytesIO()
    logo_path = os.path.join(app.static_folder, "logo.png")
    
    try:
        generate_pdf_receipt(buffer, receipt_id, flat_no, owner_name, amount, date_received, year, month, logo_path)
    except Exception as e:
        return jsonify({"error": f"Failed to generate PDF: {str(e)}"}), 500
        
    buffer.seek(0)
    
    return send_file(
        buffer,
        mimetype='application/pdf',
        as_attachment=False,
        download_name=f"Receipt_{receipt_id}.pdf"
    )

@app.route('/api/history', methods=['GET'])
def get_history():
    search_query = request.args.get('search', '').strip()
    flat_no = request.args.get('flat_no', '').strip()
    entry_type = request.args.get('type', 'ALL').strip().upper()
    year = request.args.get('year', '').strip()
    month = request.args.get('month', '').strip()
    start_date = request.args.get('start_date', '').strip()
    end_date = request.args.get('end_date', '').strip()

    if flat_no and " - " in flat_no:
        flat_no = flat_no.split(" - ")[0].strip()
    if flat_no.upper() == "ALL":
        flat_no = ""

    conn = get_db_connection()
    cursor = conn.cursor()

    entries = []

    if entry_type in ('ALL', 'INCOME'):
        income_query = "SELECT id, flat_no, year, month, amount, date_received FROM income WHERE 1=1"
        income_args = []

        if flat_no:
            income_query += " AND flat_no = ?"
            income_args.append(flat_no)
        if year and year.upper() != "ALL":
            income_query += " AND year = ?"
            income_args.append(year)
        if month and month.upper() != "ALL":
            income_query += " AND month = ?"
            income_args.append(month)
        if start_date:
            income_query += " AND date_received >= ?"
            income_args.append(start_date)
        if end_date:
            income_query += " AND date_received <= ?"
            income_args.append(end_date)
        if search_query:
            search_clauses = ["flat_no LIKE ?", "amount LIKE ?", "date_received LIKE ?", "month LIKE ?", "year LIKE ?"]
            search_args = [f"%{search_query}%", f"%{search_query}%", f"%{search_query}%", f"%{search_query}%", f"%{search_query}%"]
            
            matching_flats = []
            for item in get_owners_map():
                if search_query.lower() in item.lower():
                    parts = item.split(" - ")
                    if parts:
                        matching_flats.append(parts[0].strip())
            
            if matching_flats:
                placeholders = ",".join("?" for _ in matching_flats)
                search_clauses.append(f"flat_no IN ({placeholders})")
                search_args.extend(matching_flats)

            income_query += f" AND ({' OR '.join(search_clauses)})"
            income_args.extend(search_args)

        cursor.execute(income_query, tuple(income_args))
        for r in cursor.fetchall():
            entries.append({
                "id": r["id"],
                "type": "INCOME",
                "flat_no": r["flat_no"],
                "owner_name": get_owner_name_for_flat(r["flat_no"]),
                "description": f"Flat {r['flat_no']} Maintenance Fee",
                "year": r["year"],
                "month": r["month"],
                "amount": r["amount"],
                "date": r["date_received"]
            })

    if entry_type in ('ALL', 'EXPENSE') and not flat_no:
        expense_query = "SELECT id, year, month, description, amount, date_spent FROM expenses WHERE 1=1"
        expense_args = []

        if year and year.upper() != "ALL":
            expense_query += " AND year = ?"
            expense_args.append(year)
        if month and month.upper() != "ALL":
            expense_query += " AND month = ?"
            expense_args.append(month)
        if start_date:
            expense_query += " AND date_spent >= ?"
            expense_args.append(start_date)
        if end_date:
            expense_query += " AND date_spent <= ?"
            expense_args.append(end_date)
        if search_query:
            search_clauses = ["description LIKE ?", "amount LIKE ?", "date_spent LIKE ?", "month LIKE ?", "year LIKE ?"]
            search_args = [f"%{search_query}%", f"%{search_query}%", f"%{search_query}%", f"%{search_query}%", f"%{search_query}%"]
            
            expense_query += f" AND ({' OR '.join(search_clauses)})"
            expense_args.extend(search_args)

        cursor.execute(expense_query, tuple(expense_args))
        for r in cursor.fetchall():
            entries.append({
                "id": r["id"],
                "type": "EXPENSE",
                "flat_no": "",
                "owner_name": "",
                "description": r["description"],
                "year": r["year"],
                "month": r["month"],
                "amount": r["amount"],
                "date": r["date_spent"]
            })

    conn.close()
    entries.sort(key=lambda x: x["date"], reverse=True)
    return jsonify(entries)

@app.route('/api/dashboard', methods=['GET'])
def get_dashboard():
    year = request.args.get('year', '2026')
    month = request.args.get('month', 'May')

    conn = get_db_connection()
    cursor = conn.cursor()

    # Get total income
    cursor.execute("SELECT SUM(amount) FROM income WHERE year = ? AND month = ?", (year, month))
    inc_row = cursor.fetchone()
    total_income = inc_row[0] if inc_row and inc_row[0] is not None else 0.0

    # Get total expenses
    cursor.execute("SELECT SUM(amount) FROM expenses WHERE year = ? AND month = ?", (year, month))
    exp_row = cursor.fetchone()
    total_expense = exp_row[0] if exp_row and exp_row[0] is not None else 0.0

    cash_in_hand = total_income - total_expense

    # Get combined ledger entries
    entries = []

    cursor.execute("SELECT id, flat_no, year, month, amount, date_received FROM income WHERE year = ? AND month = ?", (year, month))
    for r in cursor.fetchall():
        entries.append({
            "id": r["id"],
            "type": "INCOME",
            "description": f"Flat {r['flat_no']} Maintenance Fee",
            "year": r["year"],
            "month": r["month"],
            "amount": r["amount"],
            "date": r["date_received"]
        })

    cursor.execute("SELECT id, description, year, month, amount, date_spent FROM expenses WHERE year = ? AND month = ?", (year, month))
    for r in cursor.fetchall():
        entries.append({
            "id": r["id"],
            "type": "EXPENSE",
            "description": r["description"],
            "year": r["year"],
            "month": r["month"],
            "amount": r["amount"],
            "date": r["date_spent"]
        })

    # Sort entries by date (newest first, then type)
    entries.sort(key=lambda x: x["date"], reverse=True)

    conn.close()

    return jsonify({
        "total_income": total_income,
        "total_expense": total_expense,
        "cash_in_hand": cash_in_hand,
        "entries": entries
    })

@app.route('/api/income', methods=['POST'])
def add_income():
    data = request.json
    flat = data.get('flat_no', '').strip()
    year = data.get('year', '')
    month = data.get('month', '')
    amount = data.get('amount')
    date_str = data.get('date', datetime.date.today().strftime("%Y-%m-%d"))

    if not flat or flat == "Select Room & Tenant" or not amount or not date_str:
        return jsonify({"error": "Please fill out all fields."}), 400

    try:
        # Extract flat number if given in format "1A - Name"
        flat_no = flat.split(" - ")[0].strip()
        amt_val = float(amount)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO income (flat_no, year, month, amount, date_received) VALUES (?, ?, ?, ?, ?)",
            (flat_no, year, month, amt_val, date_str)
        )
        conn.commit()
        entry_id = cursor.lastrowid
        conn.close()
        return jsonify({"status": "success", "message": f"Payment logged for Flat {flat_no}", "id": entry_id})
    except ValueError:
        return jsonify({"error": "Amount must be a valid number."}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/expense', methods=['POST'])
def add_expense():
    data = request.json
    year = data.get('year', '')
    month = data.get('month', '')
    desc = data.get('description', '').strip()
    amount = data.get('amount')
    date_str = data.get('date', datetime.date.today().strftime("%Y-%m-%d"))

    if not desc or not amount or not date_str:
        return jsonify({"error": "Please fill out all fields."}), 400

    try:
        amt_val = float(amount)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO expenses (year, month, description, amount, date_spent) VALUES (?, ?, ?, ?, ?)",
            (year, month, desc, amt_val, date_str)
        )
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "message": f"Expense saved: {desc}"})
    except ValueError:
        return jsonify({"error": "Amount must be a valid number."}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/entry/<type_name>/<int:entry_id>', methods=['DELETE'])
def delete_entry(type_name, entry_id):
    if type_name not in ('INCOME', 'EXPENSE'):
        return jsonify({"error": "Invalid entry type."}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        if type_name == 'INCOME':
            cursor.execute("DELETE FROM income WHERE id = ?", (entry_id,))
        else:
            cursor.execute("DELETE FROM expenses WHERE id = ?", (entry_id,))
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "message": "Entry removed successfully."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/upload-owners', methods=['POST'])
def upload_owners():
    if pd is None:
        return jsonify({"error": "Excel framework offline (pandas not available)."}), 500

    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded."}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected."}), 400

    if not (file.filename.endswith('.xlsx') or file.filename.endswith('.xls')):
        return jsonify({"error": "Invalid file format. Please upload an Excel file."}), 400

    try:
        # Save as owners.xlsx (overwrites existing)
        file.save(OWNERS_EXCEL)
        return jsonify({"status": "success", "message": "Owners spreadsheet uploaded successfully!"})
    except Exception as e:
        return jsonify({"error": f"Failed to save file: {str(e)}"}), 500

@app.route('/api/import-ledger', methods=['POST'])
def import_ledger():
    if pd is None:
        return jsonify({"error": "Excel framework offline (pandas not available)."}), 500

    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded."}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected."}), 400

    try:
        # Save to a temporary file
        fd, temp_path = tempfile.mkstemp(suffix='.xlsx')
        os.close(fd)
        file.save(temp_path)

        excel_obj = pd.ExcelFile(temp_path)
        sheet_names = excel_obj.sheet_names
        
        income_sheet = None
        expense_sheet = None
        
        for s in sheet_names:
            s_clean = s.strip().upper()
            if "DETAIL" in s_clean:
                income_sheet = s
            elif "MC" in s_clean and "WISE" not in s_clean and income_sheet is None:
                income_sheet = s
                
            if "EXPENSE" in s_clean and "INCOME" not in s_clean:
                expense_sheet = s

        if not income_sheet:
            income_sheet = sheet_names[0]

        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM income")
        cursor.execute("DELETE FROM expenses")
        
        imported_income = 0
        imported_expenses = 0
        
        def parse_month_label(label):
            m = re.match(r"([A-Za-z]+)'\s*(\d+)", label)
            if m:
                month_name = m.group(1).strip().capitalize()
                year_short = m.group(2).strip()
                year = f"20{year_short}"
                return year, month_name
            return None

        def clean_date(raw_dt, yr, mn):
            month_nums = {
                "January": "01", "February": "02", "March": "03", "April": "04",
                "May": "05", "June": "06", "July": "07", "August": "08",
                "September": "09", "October": "10", "November": "11", "December": "12"
            }
            month_num = month_nums.get(mn, "05")
            fallback = f"{yr}-{month_num}-01"
            
            if pd.isna(raw_dt) or str(raw_dt).strip() == "" or str(raw_dt).lower() in ("nan", "nat", "none"):
                return fallback
                
            if isinstance(raw_dt, (datetime.datetime, datetime.date)):
                return raw_dt.strftime("%Y-%m-%d")
                
            val_str = str(raw_dt).strip()
            if re.match(r"^\d{4}-\d{2}-\d{2}", val_str):
                return val_str.split(" ")[0]
                
            val_str = val_str.split(" ")[0]
            for sep in ("/", ".", "-"):
                parts = val_str.split(sep)
                if len(parts) == 3:
                    day, month, year = parts[0].strip(), parts[1].strip(), parts[2].strip()
                    if len(day) < 2: day = "0" + day
                    if len(month) < 2: month = "0" + month
                    if len(year) == 2: year = f"20{year}"
                    if len(day) == 2 and len(month) == 2 and len(year) == 4:
                        try:
                            d, m, y = int(day), int(month), int(year)
                            if 1 <= d <= 31 and 1 <= m <= 12 and 1900 <= y <= 2100:
                                return f"{year}-{month}-{day}"
                        except ValueError:
                            pass
            return fallback

        # --- INCOME SHEET PARSER ---
        df_inc_raw = pd.read_excel(temp_path, sheet_name=income_sheet, header=None)
        header_row_idx = None
        
        for idx, row in df_inc_raw.iterrows():
            row_str_list = [str(v).strip().upper() for v in row.values if pd.notna(v)]
            if "FLAT NO." in row_str_list or "FLAT NO" in row_str_list:
                header_row_idx = idx
                break
        
        if header_row_idx is not None:
            columns_row = df_inc_raw.iloc[header_row_idx].values
            data_rows = df_inc_raw.iloc[header_row_idx+1:]
            
            flat_col_idx = None
            for c_idx, c_val in enumerate(columns_row):
                if "FLAT" in str(c_val).upper():
                    flat_col_idx = c_idx
                    break
            
            month_pairs = []
            if header_row_idx > 0:
                month_row = df_inc_raw.iloc[header_row_idx - 1]
                for i in range(5, len(month_row)):
                    val = month_row.iloc[i]
                    if pd.notna(val):
                        try:
                            dt = pd.to_datetime(val)
                            yr = str(dt.year)
                            mn = dt.strftime("%B")
                            month_pairs.append((yr, mn, i, i + 1))
                        except Exception:
                            pass
            
            if not month_pairs:
                month_pairs = [
                    ("2025", "April", 5, 6), ("2025", "May", 7, 8), ("2025", "June", 9, 10),
                    ("2025", "July", 11, 12), ("2025", "August", 13, 14), ("2025", "September", 15, 16),
                    ("2025", "October", 17, 18), ("2025", "November", 19, 20), ("2025", "December", 21, 22),
                    ("2026", "January", 23, 24), ("2026", "February", 25, 26), ("2026", "March", 27, 28),
                    ("2026", "April", 29, 30), ("2026", "May", 31, 32)
                ]

            if flat_col_idx is not None:
                for _, row in data_rows.iterrows():
                    flat_val = str(row.iloc[flat_col_idx]).strip().upper().replace(" ", "")
                    if not flat_val or flat_val == "NAN" or "FLOOR" in flat_val or len(flat_val) > 4:
                        continue
                        
                    for yr, mn, amt_idx, dt_idx in month_pairs:
                        if amt_idx < len(row):
                            raw_amt = row.iloc[amt_idx]
                            raw_dt = row.iloc[dt_idx] if dt_idx < len(row) else ""
                            
                            try:
                                if pd.isna(raw_amt) or str(raw_amt).strip() == "" or "ROOM" in str(raw_amt).upper() or "TYPE" in str(raw_amt).upper():
                                    amt_val = 0.0
                                else:
                                    amt_val = float(raw_amt)
                            except Exception:
                                amt_val = 0.0
                                
                            if amt_val > 0:
                                date_str = clean_date(raw_dt, yr, mn)
                                cursor.execute(
                                    "INSERT INTO income (flat_no, year, month, amount, date_received) VALUES (?, ?, ?, ?, ?)",
                                    (flat_val, yr, mn, amt_val, date_str)
                                )
                                imported_income += 1

        # --- EXPENSES SHEET PARSER ---
        if expense_sheet:
            df_exp_raw = pd.read_excel(temp_path, sheet_name=expense_sheet, header=None)
            exp_header_idx = None
            
            for idx, row in df_exp_raw.iterrows():
                row_txt = "".join([str(v) for v in row.values]).upper()
                if "DESCRIPTION" in row_txt:
                    exp_header_idx = idx
                    break

            if exp_header_idx is not None:
                df_exp_data = df_exp_raw.iloc[exp_header_idx+1:]
                
                row1 = df_exp_raw.iloc[1].values
                row2 = df_exp_raw.iloc[2].values
                
                current_month = None
                exp_month_cols = []
                
                for i in range(2, len(row1)):
                    val1 = row1[i]
                    val2 = row2[i]
                    if pd.notna(val1) and str(val1).strip() != "":
                        current_month = str(val1).strip()
                    if current_month:
                        if pd.notna(val2):
                            val2_clean = str(val2).strip().upper()
                            if "AMOUNT" in val2_clean:
                                date_idx = None
                                if i + 1 < len(row2):
                                    next_val = row2[i+1]
                                    if pd.notna(next_val):
                                        next_val_clean = str(next_val).strip().upper()
                                        if any(x in next_val_clean for x in ("DATE", "DT OF", "PAYMENT")):
                                            date_idx = i + 1
                                parsed = parse_month_label(current_month)
                                if parsed:
                                    yr, mn = parsed
                                    exp_month_cols.append((yr, mn, i, date_idx))

                for _, row in df_exp_data.iterrows():
                    if len(row) < 3:
                        continue
                    desc = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ""
                    if not desc or "SR." in desc.upper() or "TOTAL" in desc.upper() or len(desc) < 3:
                        continue
                    
                    for yr, mn, amt_col, dt_col in exp_month_cols:
                        if amt_col < len(row):
                            amt_val = row.iloc[amt_col]
                            dt_val = row.iloc[dt_col] if dt_col is not None and dt_col < len(row) else ""
                            
                            try:
                                if pd.isna(amt_val) or str(amt_val).strip() == "":
                                    parsed_amt = 0.0
                                else:
                                    parsed_amt = float(amt_val)
                            except Exception:
                                parsed_amt = 0.0
                                
                            if parsed_amt > 0:
                                date_str = clean_date(dt_val, yr, mn)
                                cursor.execute(
                                    "INSERT INTO expenses (year, month, description, amount, date_spent) VALUES (?, ?, ?, ?, ?)",
                                    (yr, mn, desc, parsed_amt, date_str)
                                )
                                imported_expenses += 1

        conn.commit()
        conn.close()
        
        # Close Excel file handle
        try:
            excel_obj.close()
        except:
            pass
            
        # Clean up temp file
        try:
            os.remove(temp_path)
        except:
            pass

        return jsonify({
            "status": "success", 
            "message": f"Excel imports finished successfully! \nParsed {imported_income} income entries and {imported_expenses} expense vouchers."
        })
    except Exception as e:
        return jsonify({"error": f"Failed parsing document structure: {str(e)}"}), 500

@app.route('/api/export-ledger', methods=['GET'])
def export_ledger():
    if pd is None:
        return jsonify({"error": "Excel framework offline (pandas not available)."}), 500
    try:
        conn = get_db_connection()
        # Query datasets
        df_inc = pd.read_sql_query("SELECT id as 'ID', flat_no as 'Flat Details', year as 'Year', month as 'Month', amount as 'Amount Paid (Rs.)', date_received as 'Date Received' FROM income", conn)
        df_exp = pd.read_sql_query("SELECT id as 'ID', year as 'Year', month as 'Month', description as 'Description', amount as 'Amount Spent (Rs.)', date_spent as 'Date Spent' FROM expenses", conn)
        conn.close()

        # Write to temporary file
        fd, temp_path = tempfile.mkstemp(suffix='.xlsx')
        os.close(fd)

        with pd.ExcelWriter(temp_path, engine='openpyxl') as writer:
            df_inc.to_excel(writer, sheet_name="Income Summary", index=False)
            df_exp.to_excel(writer, sheet_name="Expense Summary", index=False)

        fn = f"Deepsikha_Ledger_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        # Send file and then remove it asynchronously
        return send_file(temp_path, as_attachment=True, download_name=fn)
    except Exception as e:
        return jsonify({"error": f"Could not export ledger: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
