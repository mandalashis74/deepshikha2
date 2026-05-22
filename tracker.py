import sys
import tkinter as tk
from tkinter import messagebox

def emergency_error_handler(exc_type, exc_value, exc_traceback):
    import traceback
    error_msg = "".join(traceback.format_exception(exc_type, exc_value, exc_traceback))
    root = tk.Tk()
    root.withdraw()
    messagebox.showerror("Application Error", f"An unexpected issue occurred:\n\n{error_msg}")
    sys.exit(1)

sys.excepthook = emergency_error_handler

import os
import sqlite3
import datetime
from tkinter import ttk, filedialog

try:
    import pandas as pd
except ImportError:
    pd = None

class DeepsikhaTrackerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Deepsikha Residency - Block 2 Pro Tracker")
        self.root.geometry("1050x800")
        self.root.configure(bg="#f4f6f9")
        
        self.setup_database()
        self.load_owners_fallback()
        self.create_widgets()
        self.update_dashboard()

    def setup_database(self):
        # Clean database file connection to bypass any previous locked states completely
        self.conn = sqlite3.connect("deepsikha_residency_clean.db")
        self.cursor = self.conn.cursor()
        
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS income (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                flat_no TEXT, 
                year TEXT, 
                month TEXT, 
                amount REAL, 
                date_received TEXT
            )
        ''')
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                year TEXT, 
                month TEXT, 
                description TEXT, 
                amount REAL, 
                date_spent TEXT
            )
        ''')
        self.conn.commit()

    def load_owners_fallback(self):
        self.flat_display_list = []
        fallback_flats = {}
        for f in ['1','2','3','4','5','6','7','8']:
            for l in ['A','B','C','D','E','F','G','H']:
                fallback_flats[f"{f}{l}"] = f"Flat {f}{l}"

        if pd is not None:
            excel_file = None
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
                            if flat_val and flat_val != "NAN" and flat_val in fallback_flats:
                                if name_val and name_val != "nan":
                                    fallback_flats[flat_val] = name_val
                except Exception as e:
                    print(f"Data mapping notice: {e}")

        for fid in sorted(fallback_flats.keys()):
            self.flat_display_list.append(f"{fid} - {fallback_flats[fid]}")

    def create_widgets(self):
        title_frame = tk.Frame(self.root, bg="#2c3e50", pady=10)
        title_frame.pack(fill=tk.X)
        tk.Label(title_frame, text="DEEPSIKHA RESIDENCY (BLOCK 2) LEDGER MANAGER", font=("Arial", 14, "bold"), fg="#f1c40f", bg="#2c3e50").pack()

        main_frame = tk.Frame(self.root, bg="#f4f6f9", padx=15, pady=10)
        main_frame.pack(fill=tk.BOTH, expand=True)

        db_frame = tk.LabelFrame(main_frame, text=" Balance Sheets & Filters ", font=("Arial", 10, "bold"), bg="white", pady=8, padx=10, relief=tk.SOLID, bd=1)
        db_frame.pack(fill=tk.X, side=tk.TOP, pady=(0, 10))

        tk.Label(db_frame, text="Year:", bg="white").grid(row=0, column=0, padx=2)
        self.years_list = ["2025", "2026", "2027", "2028", "2029", "2030"]
        self.dash_year_cb = ttk.Combobox(db_frame, values=self.years_list, width=6, state="readonly")
        self.dash_year_cb.set("2026")
        self.dash_year_cb.grid(row=0, column=1, padx=4)
        self.dash_year_cb.bind("<<ComboboxSelected>>", self.update_dashboard)

        tk.Label(db_frame, text="Month:", bg="white").grid(row=0, column=2, padx=2)
        self.months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
        self.dash_month_cb = ttk.Combobox(db_frame, values=self.months, width=10, state="readonly")
        self.dash_month_cb.set("May")
        self.dash_month_cb.grid(row=0, column=3, padx=4)
        self.dash_month_cb.bind("<<ComboboxSelected>>", self.update_dashboard)

        self.lbl_total_income = tk.Label(db_frame, text="Income: Rs. 0.00", font=("Arial", 10, "bold"), fg="#27ae60", bg="white")
        self.lbl_total_income.grid(row=0, column=4, padx=10)

        self.lbl_total_expense = tk.Label(db_frame, text="Expense: Rs. 0.00", font=("Arial", 10, "bold"), fg="#c0392b", bg="white")
        self.lbl_total_expense.grid(row=0, column=5, padx=10)

        self.lbl_cash_in_hand = tk.Label(db_frame, text="Cash: Rs. 0.00", font=("Arial", 10, "bold"), fg="#2980b9", bg="white")
        self.lbl_cash_in_hand.grid(row=0, column=6, padx=10)

        tk.Button(db_frame, text="📥 Import Ledger File", bg="#27ae60", fg="white", font=("Arial", 9, "bold"), command=self.import_combined_excel).grid(row=0, column=7, padx=5)
        tk.Button(db_frame, text="📤 Export Balance Sheet", bg="#34495e", fg="white", font=("Arial", 9, "bold"), command=self.export_to_excel).grid(row=0, column=8, padx=5)

        entry_container = tk.Frame(main_frame, bg="#f4f6f9")
        entry_container.pack(fill=tk.X, pady=(0, 10))

        inc_frame = tk.LabelFrame(entry_container, text=" Collect Maintenance Fee (Income) ", font=("Arial", 10, "bold"), bg="white", padx=10, pady=10, relief=tk.SOLID, bd=1)
        inc_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 5))

        tk.Label(inc_frame, text="Flat Profiler:", bg="white").grid(row=0, column=0, sticky="w", pady=3)
        self.flat_cb = ttk.Combobox(inc_frame, values=self.flat_display_list, width=32)
        self.flat_cb.grid(row=0, column=1, pady=3, sticky="w")
        self.flat_cb.set("Select Room & Tenant")

        tk.Label(inc_frame, text="For Period (Y/M):", bg="white").grid(row=1, column=0, sticky="w", pady=3)
        inc_ym_frame = tk.Frame(inc_frame, bg="white")
        inc_ym_frame.grid(row=1, column=1, sticky="w", pady=3)
        self.inc_year_cb = ttk.Combobox(inc_ym_frame, values=self.years_list, width=6, state="readonly")
        self.inc_year_cb.set("2026")
        self.inc_year_cb.pack(side=tk.LEFT, padx=(0, 5))
        self.inc_month_cb = ttk.Combobox(inc_ym_frame, values=self.months, width=9, state="readonly")
        self.inc_month_cb.set("May")
        self.inc_month_cb.pack(side=tk.LEFT)

        tk.Label(inc_frame, text="Amount Paid (Rs.):", bg="white").grid(row=2, column=0, sticky="w", pady=3)
        self.ent_inc_amt = tk.Entry(inc_frame, width=15)
        self.ent_inc_amt.grid(row=2, column=1, pady=3, sticky="w")

        tk.Label(inc_frame, text="Receipt Date:", bg="white").grid(row=3, column=0, sticky="w", pady=3)
        self.ent_inc_date = tk.Entry(inc_frame, width=15)
        self.ent_inc_date.insert(0, datetime.date.today().strftime("%Y-%m-%d"))
        self.ent_inc_date.grid(row=3, column=1, pady=3, sticky="w")

        tk.Button(inc_frame, text="Save Collection Entry", bg="#2ecc71", fg="white", font=("Arial", 9, "bold"), command=self.add_income).grid(row=4, column=0, columnspan=2, pady=8)

        exp_frame = tk.LabelFrame(entry_container, text=" Maintenance Outflow (Expenses) ", font=("Arial", 10, "bold"), bg="white", padx=10, pady=10, relief=tk.SOLID, bd=1)
        exp_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(5, 0))

        tk.Label(exp_frame, text="Billing Period:", bg="white").grid(row=0, column=0, sticky="w", pady=3)
        exp_ym_frame = tk.Frame(exp_frame, bg="white")
        exp_ym_frame.grid(row=0, column=1, sticky="w", pady=3)
        self.exp_year_cb = ttk.Combobox(exp_ym_frame, values=self.years_list, width=6, state="readonly")
        self.exp_year_cb.set("2026")
        self.exp_year_cb.pack(side=tk.LEFT, padx=(0, 5))
        self.exp_month_cb = ttk.Combobox(exp_ym_frame, values=self.months, width=9, state="readonly")
        self.exp_month_cb.set("May")
        self.exp_month_cb.pack(side=tk.LEFT)

        tk.Label(exp_frame, text="Voucher Details:", bg="white").grid(row=1, column=0, sticky="w", pady=3)
        self.ent_exp_desc = tk.Entry(exp_frame, width=22)
        self.ent_exp_desc.grid(row=1, column=1, pady=3, sticky="w")

        tk.Label(exp_frame, text="Amount Spent (Rs.):", bg="white").grid(row=2, column=0, sticky="w", pady=3)
        self.ent_exp_amt = tk.Entry(exp_frame, width=15)
        self.ent_exp_amt.grid(row=2, column=1, pady=3, sticky="w")

        tk.Label(exp_frame, text="Payment Date:", bg="white").grid(row=3, column=0, sticky="w", pady=3)
        self.ent_exp_date = tk.Entry(exp_frame, width=15)
        self.ent_exp_date.insert(0, datetime.date.today().strftime("%Y-%m-%d"))
        self.ent_exp_date.grid(row=3, column=1, pady=3, sticky="w")

        tk.Button(exp_frame, text="Save Expense Entry", bg="#e74c3c", fg="white", font=("Arial", 9, "bold"), command=self.add_expense).grid(row=4, column=0, columnspan=2, pady=8)

        log_frame = tk.LabelFrame(main_frame, text=" Live Ledger Statement ", font=("Arial", 10, "bold"), bg="white", pady=8, padx=10, relief=tk.SOLID, bd=1)
        log_frame.pack(fill=tk.BOTH, expand=True)

        cols = ("ID", "Type", "Flat / Expense Description", "Ledger Year", "Ledger Month", "Amount (Rs.)", "Record Date")
        self.tree = ttk.Treeview(log_frame, columns=cols, show="headings", height=12)
        for col in cols:
            self.tree.heading(col, text=col)
        self.tree.column("ID", width=40, anchor="center")
        self.tree.column("Type", width=90, anchor="center")
        self.tree.column("Flat / Expense Description", width=280, anchor="w")
        self.tree.column("Ledger Year", width=80, anchor="center")
        self.tree.column("Ledger Month", width=90, anchor="center")
        self.tree.column("Amount (Rs.)", width=120, anchor="e")
        self.tree.column("Record Date", width=130, anchor="center")

        scrollbar = ttk.Scrollbar(log_frame, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscroll=scrollbar.set)
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        btn_action_frame = tk.Frame(main_frame, bg="#f4f6f9")
        btn_action_frame.pack(fill=tk.X, pady=5)

        tk.Button(btn_action_frame, text="❌ Delete Selected Entry", bg="#c0392b", fg="white", font=("Arial", 10, "bold"), padx=12, command=self.delete_selected).pack(side=tk.RIGHT)

    def import_combined_excel(self):
        if pd is None:
            messagebox.showerror("Error", "Excel framework offline.")
            return

        file_path = filedialog.askopenfilename(
            title="Select Main Maintenance Ledger Excel File",
            filetypes=[("Excel Files", "*.xlsx *.xls")]
        )
        if not file_path:
            return

        try:
            excel_obj = pd.ExcelFile(file_path)
            sheet_names = excel_obj.sheet_names
            
            income_sheet = None
            expense_sheet = None
            
            for s in sheet_names:
                s_clean = s.strip().upper()
                if "DETAIL" in s_clean or "MC" in s_clean:
                    income_sheet = s
                if "EXPENSE" in s_clean:
                    expense_sheet = s

            if not income_sheet:
                income_sheet = sheet_names[0]

            self.cursor.execute("DELETE FROM income")
            self.cursor.execute("DELETE FROM expenses")
            
            imported_income = 0
            imported_expenses = 0
            
            # --- INCOME SHEET PARSER ---
            df_inc_raw = pd.read_excel(file_path, sheet_name=income_sheet, header=None)
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
                                
                                # Ignore non-numeric mismatches layout blocks completely
                                try:
                                    if pd.isna(raw_amt) or str(raw_amt).strip() == "" or "ROOM" in str(raw_amt).upper() or "TYPE" in str(raw_amt).upper():
                                        amt_val = 0.0
                                    else:
                                        amt_val = float(raw_amt)
                                except Exception:
                                    amt_val = 0.0
                                    
                                if amt_val > 0:
                                    date_str = str(raw_dt).split(" ")[0].strip() if pd.notna(raw_dt) else f"{yr}-05-01"
                                    if len(date_str) < 5 or "ROOM" in date_str.upper() or "TYPE" in date_str.upper():
                                        date_str = f"{yr}-05-01"
                                    
                                    self.cursor.execute(
                                        "INSERT INTO income (flat_no, year, month, amount, date_received) VALUES (?, ?, ?, ?, ?)",
                                        (flat_val, yr, mn, amt_val, date_str)
                                    )
                                    imported_income += 1

            # --- EXPENSES SHEET PARSER ---
            if expense_sheet:
                df_exp_raw = pd.read_excel(file_path, sheet_name=expense_sheet, header=None)
                exp_header_idx = None
                
                for idx, row in df_exp_raw.iterrows():
                    row_txt = "".join([str(v) for v in row.values]).upper()
                    if "DESCRIPTION" in row_txt:
                        exp_header_idx = idx
                        break

                if exp_header_idx is not None:
                    df_exp_data = df_exp_raw.iloc[exp_header_idx+1:]
                    
                    exp_months = [
                        ("2025", "April", 2), ("2025", "May", 4), ("2025", "June", 7),
                        ("2025", "July", 10), ("2025", "August", 13), ("2025", "September", 16),
                        ("2025", "October", 20), ("2025", "November", 24), ("2025", "December", 28),
                        ("2026", "January", 32), ("2026", "February", 36), ("2026", "March", 40),
                        ("2026", "April", 44), ("2026", "May", 48)
                    ]
                    
                    for _, row in df_exp_data.iterrows():
                        if len(row) < 3:
                            continue
                        desc = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ""
                        if not desc or "SR." in desc.upper() or "TOTAL" in desc.upper() or len(desc) < 3:
                            continue
                        
                        for yr, mn, col_idx in exp_months:
                            if col_idx < len(row):
                                amt_val = row.iloc[col_idx]
                                dt_val = row.iloc[col_idx+1] if (col_idx+1) < len(row) else ""
                                
                                try:
                                    if pd.isna(amt_val) or str(amt_val).strip() == "" or "ROOM" in str(amt_val).upper() or "TYPE" in str(amt_val).upper():
                                        parsed_amt = 0.0
                                    else:
                                        parsed_amt = float(amt_val)
                                except Exception:
                                    parsed_amt = 0.0
                                    
                                if parsed_amt > 0:
                                    date_str = str(dt_val).split(" ")[0].strip() if pd.notna(dt_val) else f"{yr}-05-01"
                                    if len(date_str) < 4 or "ROOM" in date_str.upper() or "TYPE" in date_str.upper():
                                        date_str = f"{yr}-05-01"
                                        
                                    self.cursor.execute(
                                        "INSERT INTO expenses (year, month, description, amount, date_spent) VALUES (?, ?, ?, ?, ?)",
                                        (yr, mn, desc, parsed_amt, date_str)
                                    )
                                    imported_expenses += 1

            self.conn.commit()
            self.update_dashboard()
            messagebox.showinfo("Import Complete", f"Data records imported perfectly!\n\n💰 Income Items: {imported_income}\n💸 Expense Vouchers: {imported_expenses}")

        except Exception as e:
            messagebox.showerror("Error", f"Failed parsing document structure:\n{e}")

    def add_income(self):
        flat = self.flat_cb.get().strip()
        year = self.inc_year_cb.get()
        month = self.inc_month_cb.get()
        amount = self.ent_inc_amt.get().strip()
        date_str = self.ent_inc_date.get().strip()

        if not flat or flat == "Select Room & Tenant" or not amount or not date_str:
            messagebox.showerror("Error", "Please fill up all fields.")
            return
        try:
            amt_val = float(amount)
            self.cursor.execute("INSERT INTO income (flat_no, year, month, amount, date_received) VALUES (?, ?, ?, ?, ?)",
                                (flat.split(" - ")[0], year, month, amt_val, date_str))
            self.conn.commit()
            messagebox.showinfo("Success", f"Payment logged for {flat}")
            self.ent_inc_amt.delete(0, tk.END)
            self.update_dashboard()
        except ValueError:
            messagebox.showerror("Error", "Amount must be clean numbers.")

    def add_expense(self):
        year = self.exp_year_cb.get()
        month = self.exp_month_cb.get()
        desc = self.ent_exp_desc.get().strip()
        amount = self.ent_exp_amt.get().strip()
        date_str = self.ent_exp_date.get().strip()

        if not desc or not amount or not date_str:
            messagebox.showerror("Error", "Please fill up all fields.")
            return
        try:
            amt_val = float(amount)
            self.cursor.execute("INSERT INTO expenses (year, month, description, amount, date_spent) VALUES (?, ?, ?, ?, ?)",
                                (year, month, desc, amt_val, date_str))
            self.conn.commit()
            messagebox.showinfo("Success", f"Expense saved: {desc}")
            self.ent_exp_desc.delete(0, tk.END)
            self.ent_exp_amt.delete(0, tk.END)
            self.update_dashboard()
        except ValueError:
            messagebox.showerror("Error", "Amount must be clean numbers.")

    def delete_selected(self):
        selected_item = self.tree.selection()
        if not selected_item:
            messagebox.showwarning("Select Entry", "Please select a row from the table first.")
            return
            
        values = self.tree.item(selected_item, "values")
        row_id = values[0]
        entry_type = values[1]
        detail_text = values[2]
        
        confirm = messagebox.askyesno("Confirm Delete", f"Are you sure you want to completely delete this entry?\n\n{detail_text}")
        if confirm:
            if entry_type == "INCOME":
                self.cursor.execute("DELETE FROM income WHERE id = ?", (row_id,))
            else:
                self.cursor.execute("DELETE FROM expenses WHERE id = ?", (row_id,))
            self.conn.commit()
            messagebox.showinfo("Success", "Entry removed from local history.")
            self.update_dashboard()

    def update_dashboard(self, event=None):
        selected_year = self.dash_year_cb.get()
        selected_month = self.dash_month_cb.get()

        self.cursor.execute("SELECT SUM(amount) FROM income WHERE year = ? AND month = ?", (selected_year, selected_month))
        inc_res = self.cursor.fetchone()[0]
        total_inc = inc_res if inc_res else 0.0

        self.cursor.execute("SELECT SUM(amount) FROM expenses WHERE year = ? AND month = ?", (selected_year, selected_month))
        exp_res = self.cursor.fetchone()[0]
        total_exp = exp_res if exp_res else 0.0

        cash_in_hand = total_inc - total_exp
        self.lbl_total_income.config(text=f"Income: Rs. {total_inc:,.2f}")
        self.lbl_total_expense.config(text=f"Expense: Rs. {total_exp:,.2f}")
        self.lbl_cash_in_hand.config(text=f"Cash: Rs. {cash_in_hand:,.2f}")

        for item in self.tree.get_children():
            self.tree.delete(item)

        self.cursor.execute("SELECT id, flat_no, year, month, amount, date_received FROM income WHERE year = ? AND month = ?", (selected_year, selected_month))
        for r in self.cursor.fetchall():
            self.tree.insert("", tk.END, values=(r[0], "INCOME", f"Flat {r[1]} Maintenance Fee", r[2], r[3], f"{r[4]:,.2f}", r[5]))

        self.cursor.execute("SELECT id, description, year, month, amount, date_spent FROM expenses WHERE year = ? AND month = ?", (selected_year, selected_month))
        for r in self.cursor.fetchall():
            self.tree.insert("", tk.END, values=(r[0], "EXPENSE", r[1], r[2], r[3], f"{r[4]:,.2f}", r[5]))

    def export_to_excel(self):
        if pd is None:
            messagebox.showerror("Error", "Excel framework offline.")
            return
        try:
            df_inc = pd.read_sql_query("SELECT id as 'ID', flat_no as 'Flat Details', year as 'Year', month as 'Month', amount as 'Amount Paid (Rs.)', date_received as 'Date Received' FROM income", self.conn)
            df_exp = pd.read_sql_query("SELECT id as 'ID', year as 'Year', month as 'Month', description as 'Description', amount as 'Amount Spent (Rs.)', date_spent as 'Date Spent' FROM expenses", self.conn)
            fn = f"Deepsikha_Ledger_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
            with pd.ExcelWriter(fn, engine='openpyxl') as writer:
                df_inc.to_excel(writer, sheet_name="Income Summary", index=False)
                df_exp.to_excel(writer, sheet_name="Expense Summary", index=False)
            messagebox.showinfo("Export Successful", f"Saved successfully as:\n{fn}")
        except Exception as e:
            messagebox.showerror("Error", f"Could not export file: {e}")

    def __del__(self):
        try: self.conn.close()
        except: pass

if __name__ == "__main__":
    root = tk.Tk()
    app = DeepsikhaTrackerApp(root)
    root.mainloop()