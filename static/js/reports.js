// --- FINANCIAL REPORTS CONTROLLERS ---

window.openReportsModal = function() {
    openModal('reportsModal');
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const todayStr = now.toISOString().split('T')[0];
    const currentMonthPad = String(now.getMonth() + 1).padStart(2, '0');
    const startOfMonthStr = `${currentYear}-${currentMonthPad}-01`;
    
    const repStartDateInput = document.getElementById("rep-start-date");
    const repEndDateInput = document.getElementById("rep-end-date");
    const repYearSelect = document.getElementById("rep-year");
    
    if (repStartDateInput) repStartDateInput.value = startOfMonthStr;
    if (repEndDateInput) repEndDateInput.value = todayStr;
    if (repYearSelect) repYearSelect.value = currentYear.toString();
    
    switchReportTab('date-wise-cashbook');
};

window.switchReportTab = function(tabId) {
    window.activeReportTab = tabId;
    
    document.querySelectorAll('.report-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeTabBtn = document.getElementById(`tab-${tabId}`);
    if (activeTabBtn) activeTabBtn.classList.add('active');
    
    const filterDates = document.getElementById('rep-filter-dates');
    const filterYear = document.getElementById('rep-filter-year');
    
    if (tabId === 'date-wise-cashbook') {
        if (filterDates) filterDates.classList.remove('hidden');
        if (filterYear) filterYear.classList.add('hidden');
    } else if (tabId === 'helpdesk-stats') {
        if (filterDates) filterDates.classList.add('hidden');
        if (filterYear) filterYear.classList.add('hidden');
    } else {
        if (filterDates) filterDates.classList.add('hidden');
        if (filterYear) filterYear.classList.remove('hidden');
    }
    
    loadActiveReport();
};

window.loadActiveReport = async function() {
    const sheet = document.getElementById("report-sheet");
    if (!sheet) return;
    
    sheet.innerHTML = `
        <div class="text-center" style="padding: 40px; color: var(--text-muted);">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 12px; display: block;"></i>
            Generating report, please wait...
        </div>
    `;
    
    try {
        if (window.activeReportTab === 'date-wise-cashbook') {
            const startDate = document.getElementById("rep-start-date").value;
            const endDate = document.getElementById("rep-end-date").value;
            if (!startDate || !endDate) {
                sheet.innerHTML = `<div class="text-center" style="padding: 30px; color: #e11d48;">Please select both Start and End dates.</div>`;
                return;
            }
            const data = await getCashbookDatewise(startDate, endDate);
            renderDateWiseCashbook(data);
        } else if (window.activeReportTab === 'month-wise-cashbook') {
            const year = document.getElementById("rep-year").value;
            const data = await getCashbookMonthwise(year);
            renderMonthWiseCashbook(data);
        } else if (window.activeReportTab === 'income-expenditure') {
            const year = document.getElementById("rep-year").value;
            const data = await getIncomeExpenditure(year);
            renderIncomeExpenditure(data);
        } else if (window.activeReportTab === 'helpdesk-stats') {
            await renderHelpdeskReport();
        }
    } catch (err) {
        console.error("Report loader error:", err);
        sheet.innerHTML = `<div class="text-center" style="padding: 30px; color: #e11d48;"><i class="fa-solid fa-triangle-exclamation"></i> Error loading report. Please try again.</div>`;
    }
};

window.printActiveReport = function() {
    window.print();
};

window.formatDateDisplay = function(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

// Generate Date-Wise Cash Book calculation via Supabase client
async function getCashbookDatewise(startDate, endDate) {
    const { data: incData, error: incErr } = await sbClient.from('income').select('amount').or('status.eq.approved,status.is.null').lt('date_received', startDate);
    if (incErr) throw incErr;
    const incBefore = incData.reduce((sum, item) => sum + parseFloat(item.amount), 0.0);
    
    const { data: expData, error: expErr } = await sbClient.from('expenses').select('amount').lt('date_spent', startDate);
    if (expErr) throw expErr;
    const expBefore = expData.reduce((sum, item) => sum + parseFloat(item.amount), 0.0);
    
    const openingBalance = incBefore - expBefore;
    
    const { data: incomes, error: incRangeErr } = await sbClient.from('income')
        .select('id, flat_no, year, amount, date_received, category, event_name, remarks')
        .or('status.eq.approved,status.is.null')
        .gte('date_received', startDate)
        .lte('date_received', endDate);
    if (incRangeErr) throw incRangeErr;
    
    const { data: expenses, error: expRangeErr } = await sbClient.from('expenses')
        .select('id, expense_head, description, amount, date_spent')
        .gte('date_spent', startDate)
        .lte('date_spent', endDate);
    if (expRangeErr) throw expRangeErr;
    
    const { data: owners } = await sbClient.from('owners').select('flat_no, owner_name');
    const ownersMap = {};
    if (owners) {
        owners.forEach(o => {
            ownersMap[o.flat_no] = o.owner_name;
        });
    }
    
    const transactions = [];
    
    incomes.forEach(r => {
        let receiptYear = r.year;
        try {
            const yInt = parseInt(r.year.substring(0, 4), 10);
            receiptYear = `${yInt}-${String(yInt+1).substring(2)}`;
        } catch (e) {}
        const receiptId = `DR-${receiptYear}-${String(r.id).padStart(4, '0')}`;
        const ownerName = ownersMap[r.flat_no] || `Flat ${r.flat_no}`;
        
        let particulars = `Flat ${r.flat_no} - ${ownerName}`;
        if (r.category === 'Special Event') {
            particulars += ` (${r.event_name} Subscription)`;
        } else if (r.category === 'Other') {
            particulars += ` (Other: ${r.remarks || 'Misc'})`;
        } else {
            particulars += ` (Maintenance)`;
        }
        
        transactions.push({
            id: r.id,
            date: r.date_received,
            type: "INCOME",
            particulars: particulars,
            ref_no: receiptId,
            debit: parseFloat(r.amount),
            credit: 0.0
        });
    });
    
    expenses.forEach(r => {
        transactions.push({
            id: r.id,
            date: r.date_spent,
            type: "EXPENSE",
            particulars: `[${r.expense_head}] ${r.description}`,
            ref_no: `EXP-${String(r.id).padStart(4, '0')}`,
            debit: 0.0,
            credit: parseFloat(r.amount)
        });
    });
    
    transactions.sort((a, b) => {
        if (a.date !== b.date) {
            return a.date.localeCompare(b.date);
        }
        return a.type === "INCOME" ? -1 : 1;
    });
    
    const totalDebit = transactions.reduce((sum, t) => sum + t.debit, 0.0);
    const totalCredit = transactions.reduce((sum, t) => sum + t.credit, 0.0);
    
    return {
        start_date: startDate,
        end_date: endDate,
        opening_balance: openingBalance,
        transactions: transactions,
        total_debit: totalDebit,
        total_credit: totalCredit,
        closing_balance: openingBalance + totalDebit - totalCredit
    };
}

// Generate Month-Wise Cash Book calculation via Supabase client
async function getCashbookMonthwise(year) {
    const startOfYear = `${year}-01-01`;
    
    const { data: incData, error: incErr } = await sbClient.from('income').select('amount').or('status.eq.approved,status.is.null').lt('date_received', startOfYear);
    if (incErr) throw incErr;
    const incBefore = incData.reduce((sum, item) => sum + parseFloat(item.amount), 0.0);
    
    const { data: expData, error: expErr } = await sbClient.from('expenses').select('amount').lt('date_spent', startOfYear);
    if (expErr) throw expErr;
    const expBefore = expData.reduce((sum, item) => sum + parseFloat(item.amount), 0.0);
    
    const openingBalance = incBefore - expBefore;
    
    const { data: incomes, error: incRangeErr } = await sbClient.from('income').select('amount, month').or('status.eq.approved,status.is.null').eq('year', year);
    if (incRangeErr) throw incRangeErr;
    
    const { data: expenses, error: expRangeErr } = await sbClient.from('expenses').select('amount, month').eq('year', year);
    if (expRangeErr) throw expRangeErr;
    
    const incByMonth = {};
    const expByMonth = {};
    
    incomes.forEach(r => {
        incByMonth[r.month] = (incByMonth[r.month] || 0.0) + parseFloat(r.amount);
    });
    
    expenses.forEach(r => {
        expByMonth[r.month] = (expByMonth[r.month] || 0.0) + parseFloat(r.amount);
    });
    
    const monthsList = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthlySummaries = [];
    let runningBal = openingBalance;
    
    monthsList.forEach(m => {
        const receipts = incByMonth[m] || 0.0;
        const payments = expByMonth[m] || 0.0;
        
        const mOpening = runningBal;
        const mClosing = mOpening + receipts - payments;
        runningBal = mClosing;
        
        monthlySummaries.push({
            month: m,
            opening_balance: mOpening,
            receipts: receipts,
            payments: payments,
            closing_balance: mClosing
        });
    });
    
    return {
        year: year,
        opening_balance_year: openingBalance,
        monthly_summaries: monthlySummaries,
        total_receipts: monthlySummaries.reduce((sum, m) => sum + m.receipts, 0.0),
        total_payments: monthlySummaries.reduce((sum, m) => sum + m.payments, 0.0),
        closing_balance_year: runningBal
    };
}

// Generate Income and Expenditure report calculation via Supabase client
async function getIncomeExpenditure(year) {
    const { data: incomes, error: incErr } = await sbClient.from('income').select('flat_no, amount, category, event_name').or('status.eq.approved,status.is.null').eq('year', year);
    if (incErr) throw incErr;
    
    const { data: expenses, error: expErr } = await sbClient.from('expenses').select('expense_head, amount').eq('year', year);
    if (expErr) throw expErr;
    
    const incomeByFlat = {};
    const incomeByGroup = {};
    incomes.forEach(r => {
        incomeByFlat[r.flat_no] = (incomeByFlat[r.flat_no] || 0.0) + parseFloat(r.amount);
        
        let groupName = "Monthly Maintenance Charge Collections";
        if (r.category === "Special Event") {
            groupName = `${r.event_name} Collections`;
        } else if (r.category === "Other") {
            groupName = "Other Collections";
        }
        incomeByGroup[groupName] = (incomeByGroup[groupName] || 0.0) + parseFloat(r.amount);
    });
    
    const expenseByGroup = {};
    expenses.forEach(r => {
        const head = r.expense_head || "Miscellaneous";
        expenseByGroup[head] = (expenseByGroup[head] || 0.0) + parseFloat(r.amount);
    });
    
    const { data: owners } = await sbClient.from('owners').select('flat_no, owner_name');
    const ownersMap = {};
    if (owners) {
        owners.forEach(o => {
            ownersMap[o.flat_no] = o.owner_name;
        });
    }
    
    const incomeDetails = [];
    Object.keys(incomeByFlat).forEach(flat => {
        const amount = incomeByFlat[flat];
        incomeDetails.push({
            flat_no: flat,
            owner_name: ownersMap[flat] || `Flat ${flat}`,
            amount: amount
        });
    });
    incomeDetails.sort((a, b) => a.flat_no.localeCompare(b.flat_no));
    
    const expenditures = [];
    let totalExpenditure = 0.0;
    Object.keys(expenseByGroup).forEach(head => {
        const amount = expenseByGroup[head];
        totalExpenditure += amount;
        expenditures.push({
            category: head,
            amount: amount
        });
    });
    expenditures.sort((a, b) => a.category.localeCompare(b.category));
    
    const finalIncomes = [];
    let totalIncome = 0.0;
    Object.keys(incomeByGroup).forEach(group => {
        const amount = incomeByGroup[group];
        totalIncome += amount;
        finalIncomes.push({
            category: group,
            amount: amount
        });
    });
    finalIncomes.sort((a, b) => a.category.localeCompare(b.category));
    
    const surplus = totalIncome - totalExpenditure;
    
    return {
        year: year,
        incomes: finalIncomes,
        income_details: incomeDetails,
        expenditures: expenditures,
        total_income: totalIncome,
        total_expenditure: totalExpenditure,
        surplus_deficit: surplus
    };
}

function renderDateWiseCashbook(data) {
    const sheet = document.getElementById("report-sheet");
    if (!sheet) return;
    
    let rowsHTML = "";
    let runningBal = data.opening_balance;
    
    rowsHTML += `
        <tr class="row-opening">
            <td>${window.formatDateDisplay(data.start_date)}</td>
            <td>-</td>
            <td>Opening Balance B/F</td>
            <td class="text-right">-</td>
            <td class="text-right">-</td>
            <td class="text-right rep-bal">${formatCurrency(runningBal)}</td>
        </tr>
    `;
    
    if (data.transactions.length === 0) {
        rowsHTML += `
            <tr>
                <td colspan="6" class="text-center" style="color: #64748b; padding: 20px;">
                    No transactions recorded during this period.
                </td>
            </tr>
        `;
    } else {
        data.transactions.forEach(t => {
            runningBal = runningBal + t.debit - t.credit;
            
            const drText = t.debit > 0 ? formatCurrency(t.debit) : "-";
            const crText = t.credit > 0 ? formatCurrency(t.credit) : "-";
            
            rowsHTML += `
                <tr>
                    <td>${window.formatDateDisplay(t.date)}</td>
                    <td><code>${t.ref_no}</code></td>
                    <td>${t.particulars}</td>
                    <td class="text-right ${t.debit > 0 ? 'amt-dr' : ''}">${drText}</td>
                    <td class="text-right ${t.credit > 0 ? 'amt-cr' : ''}">${crText}</td>
                    <td class="text-right rep-bal">${formatCurrency(runningBal)}</td>
                </tr>
            `;
        });
    }
    
    rowsHTML += `
        <tr class="row-closing">
            <td>${window.formatDateDisplay(data.end_date)}</td>
            <td>-</td>
            <td>Closing Balance C/F</td>
            <td class="text-right">-</td>
            <td class="text-right">-</td>
            <td class="text-right rep-bal">${formatCurrency(data.closing_balance)}</td>
        </tr>
    `;
    
    sheet.innerHTML = `
        <div class="report-header">
            <h2>${getBuildingName().toUpperCase()}${getBlockName() ? ` (${getBlockName().toUpperCase()})` : ''}</h2>
            <p><strong>DATE-WISE CASH BOOK</strong></p>
            <p>Period: ${window.formatDateDisplay(data.start_date)} to ${window.formatDateDisplay(data.end_date)}</p>
        </div>
        
        <div class="report-summary-cards">
            <div class="report-sum-card">
                <h4>Opening Balance</h4>
                <p>${formatCurrency(data.opening_balance)}</p>
            </div>
            <div class="report-sum-card sum-debit">
                <h4>Total Receipts (+)</h4>
                <p>${formatCurrency(data.total_debit)}</p>
            </div>
            <div class="report-sum-card sum-credit">
                <h4>Total Payments (-)</h4>
                <p>${formatCurrency(data.total_credit)}</p>
            </div>
        </div>
        
        <table class="report-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Voucher/Ref No</th>
                    <th>Particulars</th>
                    <th class="text-right">Receipts (Dr)</th>
                    <th class="text-right">Payments (Cr)</th>
                    <th class="text-right">Balance</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHTML}
            </tbody>
        </table>
    `;
}

function renderMonthWiseCashbook(data) {
    const sheet = document.getElementById("report-sheet");
    if (!sheet) return;
    
    let rowsHTML = "";
    data.monthly_summaries.forEach(m => {
        const rcptText = m.receipts > 0 ? formatCurrency(m.receipts) : "-";
        const pymtText = m.payments > 0 ? formatCurrency(m.payments) : "-";
        
        rowsHTML += `
            <tr>
                <td><strong>${m.month}</strong></td>
                <td class="text-right">${formatCurrency(m.opening_balance)}</td>
                <td class="text-right amt-dr">${rcptText}</td>
                <td class="text-right amt-cr">${pymtText}</td>
                <td class="text-right rep-bal">${formatCurrency(m.closing_balance)}</td>
            </tr>
        `;
    });
    
    sheet.innerHTML = `
        <div class="report-header">
            <h2>${getBuildingName().toUpperCase()}${getBlockName() ? ` (${getBlockName().toUpperCase()})` : ''}</h2>
            <p><strong>MONTH-WISE CASH BOOK SUMMARY</strong></p>
            <p>Year: ${data.year}</p>
        </div>
        
        <div class="report-summary-cards">
            <div class="report-sum-card">
                <h4>Year Opening</h4>
                <p>${formatCurrency(data.opening_balance_year)}</p>
            </div>
            <div class="report-sum-card sum-debit">
                <h4>Total Receipts</h4>
                <p>${formatCurrency(data.total_receipts)}</p>
            </div>
            <div class="report-sum-card sum-credit">
                <h4>Total Payments</h4>
                <p>${formatCurrency(data.total_payments)}</p>
            </div>
        </div>
        
        <table class="report-table">
            <thead>
                <tr>
                    <th>Month</th>
                    <th class="text-right">Opening Balance</th>
                    <th class="text-right">Receipts (Dr)</th>
                    <th class="text-right">Payments (Cr)</th>
                    <th class="text-right">Closing Balance</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHTML}
            </tbody>
        </table>
    `;
}

function renderIncomeExpenditure(data) {
    const sheet = document.getElementById("report-sheet");
    if (!sheet) return;
    
    let incRowsHTML = "";
    if (data.incomes.length === 0) {
        incRowsHTML += `<tr><td colspan="2" class="text-center" style="color: #64748b;">No Income Recorded</td></tr>`;
    } else {
        data.incomes.forEach(inc => {
            incRowsHTML += `
                <tr>
                    <td>${inc.category}</td>
                    <td class="text-right amt-dr">${formatCurrency(inc.amount)}</td>
                </tr>
            `;
        });
    }
    
    let expRowsHTML = "";
    if (data.expenditures.length === 0) {
        expRowsHTML += `<tr><td colspan="2" class="text-center" style="color: #64748b;">No Expenditures Recorded</td></tr>`;
    } else {
        data.expenditures.forEach(exp => {
            expRowsHTML += `
                <tr>
                    <td>${exp.category}</td>
                    <td class="text-right amt-cr">${formatCurrency(exp.amount)}</td>
                </tr>
            `;
        });
    }
    
    const isSurplus = data.surplus_deficit >= 0;
    const absVal = Math.abs(data.surplus_deficit);
    
    let detailsRowsHTML = "";
    if (data.income_details.length === 0) {
        detailsRowsHTML += `<tr><td colspan="3" class="text-center" style="color: #64748b;">No Flat collections found.</td></tr>`;
    } else {
        data.income_details.forEach(det => {
            detailsRowsHTML += `
                <tr>
                    <td><strong>Flat ${det.flat_no}</strong></td>
                    <td>${det.owner_name}</td>
                    <td class="text-right amt-dr">${formatCurrency(det.amount)}</td>
                </tr>
            `;
        });
    }
    
    sheet.innerHTML = `
        <div class="report-header">
            <h2>${getBuildingName().toUpperCase()}${getBlockName() ? ` (${getBlockName().toUpperCase()})` : ''}</h2>
            <p><strong>INCOME AND EXPENDITURE ACCOUNT</strong></p>
            <p>For the Year Ended: 31st December ${data.year}</p>
        </div>
        
        <div class="inc-exp-grid">
            <div class="inc-exp-column col-expense">
                <h3>Expenditure (Debit)</h3>
                <table class="inc-exp-table">
                    <tbody>
                        ${expRowsHTML}
                        <tr class="total-row">
                            <td><strong>Total Expenditure</strong></td>
                            <td class="text-right">${formatCurrency(data.total_expenditure)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="inc-exp-column col-income">
                <h3>Income (Credit)</h3>
                <table class="inc-exp-table">
                    <tbody>
                        ${incRowsHTML}
                        <tr class="total-row">
                            <td><strong>Total Income</strong></td>
                            <td class="text-right">${formatCurrency(data.total_income)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="surplus-card ${isSurplus ? 'positive' : 'negative'}">
            ${isSurplus 
                ? `<i class="fa-solid fa-circle-arrow-up"></i> Excess of Income over Expenditure (Surplus): <strong>${formatCurrency(absVal)}</strong>`
                : `<i class="fa-solid fa-circle-arrow-down"></i> Excess of Expenditure over Income (Deficit): <strong>${formatCurrency(absVal)}</strong>`
            }
        </div>
        
        <div style="margin-top: 30px;">
            <h4 style="color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin-bottom: 12px; font-weight: 700;">
                <i class="fa-solid fa-list-ul"></i> Flat Collections Detailed breakdown:
            </h4>
            <table class="report-table" style="font-size: 0.8rem;">
                <thead>
                    <tr>
                        <th>Flat No</th>
                        <th>Owner / Tenant Name</th>
                        <th class="text-right">Total Maintenance Paid (Rs.)</th>
                    </tr>
                </thead>
                <tbody>
                    ${detailsRowsHTML}
                </tbody>
            </table>
        </div>
    `;
}

// Convert numbers into words for PDF receipts
window.numberToWords = function numberToWords(number) {
    try {
        const val = Math.round(parseFloat(number) * 100) / 100;
        if (isNaN(val)) return "";
        const rupees = Math.floor(val);
        const paise = Math.round((val - rupees) * 100);
        
        function convertBelowThousand(n) {
            const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", 
                           "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
            const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
            
            let res = "";
            if (n >= 100) {
                res += units[Math.floor(n / 100)] + " Hundred ";
                n %= 100;
            }
            if (n >= 20) {
                res += tens[Math.floor(n / 10)] + " ";
                n %= 10;
            }
            if (n > 0) {
                res += units[n] + " ";
            }
            return res.trim();
        }
        
        function convertWholeNumber(num) {
            if (num === 0) return "Zero";
            let crore = Math.floor(num / 10000000);
            num %= 10000000;
            let lakh = Math.floor(num / 100000);
            num %= 100000;
            let thousand = Math.floor(num / 1000);
            num %= 1000;
            
            let parts = [];
            if (crore > 0) parts.push(convertBelowThousand(crore) + " Crore");
            if (lakh > 0) parts.push(convertBelowThousand(lakh) + " Lakh");
            if (thousand > 0) parts.push(convertBelowThousand(thousand) + " Thousand");
            if (num > 0) parts.push(convertBelowThousand(num));
            return parts.join(" ").trim();
        }
        
        if (rupees === 0 && paise === 0) {
            return "Zero Rupees Only";
        }
        
        let words = "";
        if (rupees > 0) {
            words += convertWholeNumber(rupees) + " Rupees";
        }
        if (paise > 0) {
            if (rupees > 0) {
                words += " and ";
            }
            words += convertBelowThousand(paise) + " Paise";
        }
        return words.trim() + " Only";
    } catch (e) {
        console.error("Number to words conversion failed:", e);
        return "";
    }
}

// Clean date attributes extracted from Excel files
function cleanSpreadsheetDate(rawVal, year, monthName) {
    const monthMap = {
        "January": "01", "February": "02", "March": "03", "April": "04",
        "May": "05", "June": "06", "July": "07", "August": "08",
        "September": "09", "October": "10", "November": "11", "December": "12"
    };
    const fallbackMonthNum = monthMap[monthName] || "05";
    const fallback = `${year}-${fallbackMonthNum}-01`;
    
    if (!rawVal) return fallback;
    
    if (rawVal instanceof Date) {
        if (isNaN(rawVal.getTime())) return fallback;
        const day = 86400000;
        const nearestUtcMidnight = new Date(Math.round(rawVal.getTime() / day) * day);
        const y = nearestUtcMidnight.getUTCFullYear();
        const m = String(nearestUtcMidnight.getUTCMonth() + 1).padStart(2, '0');
        const d = String(nearestUtcMidnight.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    
    const valStr = String(rawVal).trim();
    if (!valStr || valStr.toLowerCase() === "nan" || valStr.toLowerCase() === "null") {
        return fallback;
    }
    
    if (/^\d{4}-\d{2}-\d{2}$/.test(valStr)) {
        return valStr;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(valStr)) {
        return valStr.split(' ')[0];
    }
    
    const cleanStr = valStr.split(' ')[0];
    const seps = ['/', '.', '-'];
    for (let sep of seps) {
        const parts = cleanStr.split(sep);
        if (parts.length === 3) {
            let day, month, yr;
            if (parts[0].length === 4) {
                yr = parts[0];
                month = parts[1];
                day = parts[2];
            } else {
                day = parts[0];
                month = parts[1];
                yr = parts[2];
            }
            if (day.length < 2) day = "0" + day;
            if (month.length < 2) month = "0" + month;
            if (yr.length === 2) yr = "20" + yr;
            if (day.length === 2 && month.length === 2 && yr.length === 4) {
                const d = parseInt(day, 10);
                const m = parseInt(month, 10);
                const y = parseInt(yr, 10);
                if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
                    return `${yr}-${month}-${day}`;
                }
            }
        }
    }
    
    return fallback;
}

// Parse month details out of a column header string
function parseMonthLabel(label) {
    if (!label) return null;
    const cleanLabel = String(label).trim();
    const m = cleanLabel.match(/([A-Za-z]+)['\-\s]*(\d+)/);
    if (m) {
        let monthName = m[1].trim();
        monthName = monthName.charAt(0).toUpperCase() + monthName.slice(1).toLowerCase();
        let yearShort = m[2].trim();
        if (yearShort.length === 2) {
            yearShort = "20" + yearShort;
        }
        return { year: yearShort, month: monthName };
    }
    return null;
}

// Handle bulk ledger imports via SheetJS
window.handleImportSubmit = async function(e) {
    e.preventDefault();
    if (!sbClient) {
        showToast("Database not connected.", "error");
        return;
    }
    
    if (!hasPermission('ledger:import')) {
        showToast("Access Denied: You don't have permission to import ledgers.", "error");
        return;
    }
    
    const fileInput = document.getElementById("import-file");
    if (!fileInput.files || !fileInput.files[0]) return;
    
    const btn = document.getElementById("btn-import-submit");
    btn.disabled = true;
    btn.textContent = "Uploading & Parsing...";
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = async function(event) {
        try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const sheetNames = workbook.SheetNames;
            
            let incomeSheetName = null;
            let expenseSheetName = null;
            
            sheetNames.forEach(s => {
                const sClean = s.trim().toUpperCase();
                if (sClean.includes("DETAIL")) {
                    incomeSheetName = s;
                } else if (sClean.includes("MC") && !sClean.includes("WISE") && !incomeSheetName) {
                    incomeSheetName = s;
                }
                
                if (sClean.includes("EXPENSE") && !sClean.includes("INCOME")) {
                    expenseSheetName = s;
                }
            });
            
            if (!incomeSheetName) {
                incomeSheetName = sheetNames[0];
            }
            
            const replaceChecked = document.getElementById('import-replace')?.checked;
            
            if (replaceChecked) {
                const { error: delIncError } = await sbClient.from('income').delete().gt('id', -1);
                if (delIncError) throw delIncError;
                
                const { error: delExpError } = await sbClient.from('expenses').delete().gt('id', -1);
                if (delExpError) throw delExpError;
            }
            
            let importedIncomeCount = 0;
            let importedExpensesCount = 0;
            
            // --- 1. PARSE INCOME SHEET ---
            const incSheet = workbook.Sheets[incomeSheetName];
            const incRows = XLSX.utils.sheet_to_json(incSheet, { header: 1 });
            
            let headerRowIdx = -1;
            let isSimpleIncome = false;
            let simpleFlatIdx = -1, simpleDateIdx = -1, simpleAmtIdx = -1, simpleMonthIdx = -1, simpleYearIdx = -1;

            for (let r = 0; r < incRows.length; r++) {
                const rowCells = incRows[r].map(v => String(v || '').toUpperCase().trim());
                
                const fIdx = rowCells.findIndex(v => v === "FLAT NO" || v === "FLAT NO.");
                const dIdx = rowCells.findIndex(v => v === "DATE RECEIVED" || v === "DATE");
                const aIdx = rowCells.findIndex(v => v === "AMOUNT");
                const mIdx = rowCells.findIndex(v => v === "MONTH");
                const yIdx = rowCells.findIndex(v => v === "YEAR");
                
                if (fIdx !== -1 && dIdx !== -1 && aIdx !== -1) {
                    isSimpleIncome = true;
                    simpleFlatIdx = fIdx;
                    simpleDateIdx = dIdx;
                    simpleAmtIdx = aIdx;
                    simpleMonthIdx = mIdx;
                    simpleYearIdx = yIdx;
                    headerRowIdx = r;
                    break;
                }
                
                if (rowCells.includes("FLAT NO.") || rowCells.includes("FLAT NO")) {
                    headerRowIdx = r;
                    break;
                }
            }
            
            if (headerRowIdx !== -1) {
                const columnsRow = incRows[headerRowIdx];
                const dataRows = incRows.slice(headerRowIdx + 1);
                const incomeInserts = [];
                
                let flatColIdx = -1;
                for (let c = 0; c < columnsRow.length; c++) {
                    if (String(columnsRow[c] || '').toUpperCase().includes("FLAT")) {
                        flatColIdx = c;
                        break;
                    }
                }
                
                let monthPairs = [];
                if (headerRowIdx > 0) {
                    const monthRow = incRows[headerRowIdx - 1];
                    for (let i = 5; i < monthRow.length; i++) {
                        const val = monthRow[i];
                        if (val) {
                            let parsedDate = null;
                            if (val instanceof Date) {
                                parsedDate = val;
                            } else {
                                const d = new Date(val);
                                if (!isNaN(d.getTime())) {
                                    parsedDate = d;
                                }
                            }
                            if (parsedDate) {
                                const yr = String(parsedDate.getFullYear());
                                const mn = parsedDate.toLocaleString('en-US', { month: 'long' });
                                monthPairs.push({ year: yr, month: mn, amtIdx: i, dtIdx: i + 1 });
                            }
                        }
                    }
                }
                
                if (monthPairs.length === 0) {
                    monthPairs = [
                        { year: "2025", month: "April", amtIdx: 5, dtIdx: 6 },
                        { year: "2025", month: "May", amtIdx: 7, dtIdx: 8 },
                        { year: "2025", month: "June", amtIdx: 9, dtIdx: 10 },
                        { year: "2025", month: "July", amtIdx: 11, dtIdx: 12 },
                        { year: "2025", month: "August", amtIdx: 13, dtIdx: 14 },
                        { year: "2025", month: "September", amtIdx: 15, dtIdx: 16 },
                        { year: "2025", month: "October", amtIdx: 17, dtIdx: 18 },
                        { year: "2025", month: "November", amtIdx: 19, dtIdx: 20 },
                        { year: "2025", month: "December", amtIdx: 21, dtIdx: 22 },
                        { year: "2026", month: "January", amtIdx: 23, dtIdx: 24 },
                        { year: "2026", month: "February", amtIdx: 25, dtIdx: 26 },
                        { year: "2026", month: "March", amtIdx: 27, dtIdx: 28 },
                        { year: "2026", month: "April", amtIdx: 29, dtIdx: 30 },
                        { year: "2026", month: "May", amtIdx: 31, dtIdx: 32 }
                    ];
                }
                
                if (isSimpleIncome) {
                    dataRows.forEach(row => {
                        const flatVal = String(row[simpleFlatIdx] || '').trim().toUpperCase().replace(/\s+/g, '');
                        if (!flatVal || flatVal === "NAN" || flatVal.includes("FLOOR") || flatVal.length > 8) return;
                        
                        const rawAmt = row[simpleAmtIdx];
                        const rawDt = row[simpleDateIdx];
                        let amtVal = parseFloat(rawAmt);
                        if (!isNaN(amtVal) && amtVal > 0) {
                            const dateStr = cleanSpreadsheetDate(rawDt, "2026", "May");
                            let actualYear, actualMonth;
                            if (simpleYearIdx !== -1 && simpleMonthIdx !== -1) {
                                actualYear = String(row[simpleYearIdx] || '').trim();
                                actualMonth = String(row[simpleMonthIdx] || '').trim();
                            } else {
                                const parsedD = new Date(dateStr);
                                actualYear = String(parsedD.getUTCFullYear());
                                const monthsArr = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                                actualMonth = monthsArr[parsedD.getUTCMonth()] || "May";
                            }
                            incomeInserts.push({
                                flat_no: flatVal,
                                year: actualYear,
                                month: actualMonth,
                                amount: amtVal,
                                date_received: dateStr
                            });
                        }
                    });
                } else if (flatColIdx !== -1) {
                    dataRows.forEach(row => {
                        const flatVal = String(row[flatColIdx] || '').trim().toUpperCase().replace(/\s+/g, '');
                        if (!flatVal || flatVal === "NAN" || flatVal.includes("FLOOR") || flatVal.length > 8) {
                            return;
                        }
                        
                        monthPairs.forEach(mp => {
                            if (mp.amtIdx < row.length) {
                                const rawAmt = row[mp.amtIdx];
                                const rawDt = mp.dtIdx < row.length ? row[mp.dtIdx] : "";
                                
                                let amtVal = parseFloat(rawAmt);
                                if (isNaN(amtVal) || String(rawAmt).toUpperCase().includes("ROOM") || String(rawAmt).toUpperCase().includes("TYPE")) {
                                    amtVal = 0.0;
                                }
                                
                                if (amtVal > 0) {
                                    const dateStr = cleanSpreadsheetDate(rawDt, mp.year, mp.month);
                                    incomeInserts.push({
                                        flat_no: flatVal,
                                        year: mp.year,
                                        month: mp.month,
                                        amount: amtVal,
                                        date_received: dateStr
                                    });
                                }
                            }
                        });
                    });
                }
                    
                    if (incomeInserts.length > 0) {
                        const uniqueFlats = [...new Set(incomeInserts.map(i => i.flat_no))];
                        const ownerUpserts = uniqueFlats.map(f => ({ flat_no: f, owner_name: `Flat ${f}` }));
                        const { error: ownErr } = await sbClient.from('owners').upsert(ownerUpserts, { onConflict: 'flat_no', ignoreDuplicates: true });
                        if (ownErr) console.warn("Owner upsert warning:", ownErr);

                        const chunkSize = 200;
                        for (let i = 0; i < incomeInserts.length; i += chunkSize) {
                            const chunk = incomeInserts.slice(i, i + chunkSize);
                            const { error: insErr } = await sbClient.from('income').insert(chunk);
                            if (insErr) throw insErr;
                        }
                        importedIncomeCount = incomeInserts.length;
                    }
            }
            
            // --- 2. PARSE EXPENSE SHEET ---
            if (expenseSheetName) {
                const expSheet = workbook.Sheets[expenseSheetName];
                const expRows = XLSX.utils.sheet_to_json(expSheet, { header: 1 });
                
                let expHeaderIdx = -1;
                let isSimpleExpense = false;
                let expDescIdx = -1, expDateIdx = -1, expAmtIdx = -1, expMonthIdx = -1, expYearIdx = -1;

                for (let r = 0; r < expRows.length; r++) {
                    const rowCells = expRows[r].map(v => String(v || '').toUpperCase().trim());
                    
                    const dIdx = rowCells.findIndex(v => v === "DESCRIPTION");
                    const dateIdx = rowCells.findIndex(v => v === "DATE SPENT" || v === "DATE");
                    const aIdx = rowCells.findIndex(v => v === "AMOUNT");
                    const mIdx = rowCells.findIndex(v => v === "MONTH");
                    const yIdx = rowCells.findIndex(v => v === "YEAR");

                    if (dIdx !== -1 && dateIdx !== -1 && aIdx !== -1) {
                        isSimpleExpense = true;
                        expDescIdx = dIdx;
                        expDateIdx = dateIdx;
                        expAmtIdx = aIdx;
                        expMonthIdx = mIdx;
                        expYearIdx = yIdx;
                        expHeaderIdx = r;
                        break;
                    }

                    const rowTxt = expRows[r].map(v => String(v || '')).join('').toUpperCase();
                    if (rowTxt.includes("DESCRIPTION")) {
                        expHeaderIdx = r;
                        break;
                    }
                }
                
                if (expHeaderIdx !== -1 && (isSimpleExpense || expRows.length > 2)) {
                    const dfExpData = expRows.slice(expHeaderIdx + 1);
                    const expenseInserts = [];
                    const row1 = expRows[1] || [];
                    const row2 = expRows[2] || [];
                    
                    let currentMonth = null;
                    const expMonthCols = [];
                    
                    for (let i = 2; i < row1.length; i++) {
                        const val1 = row1[i];
                        const val2 = row2[i];
                        if (val1 && String(val1).trim() !== "") {
                            currentMonth = String(val1).trim();
                        }
                        if (currentMonth) {
                            if (val2) {
                                const val2Clean = String(val2).trim().toUpperCase();
                                if (val2Clean.includes("AMOUNT")) {
                                    let dateIdx = null;
                                    if (i + 1 < row2.length) {
                                        const nextVal = row2[i+1];
                                        if (nextVal) {
                                            const nextValClean = String(nextVal).trim().toUpperCase();
                                            if (nextValClean.includes("DATE") || nextValClean.includes("DT OF") || nextValClean.includes("PAYMENT")) {
                                                dateIdx = i + 1;
                                            }
                                        }
                                    }
                                    const parsed = parseMonthLabel(currentMonth);
                                    if (parsed) {
                                        expMonthCols.push({
                                            year: parsed.year,
                                            month: parsed.month,
                                            amtCol: i,
                                            dtCol: dateIdx
                                        });
                                    }
                                }
                            }
                        }
                    }
                    
                    if (isSimpleExpense) {
                        dfExpData.forEach(row => {
                            const desc = String(row[expDescIdx] || '').trim();
                            if (!desc || desc.toUpperCase().includes("SR.") || desc.toUpperCase().includes("TOTAL") || desc.length < 3) return;
                            
                            const rawAmt = row[expAmtIdx];
                            const rawDt = row[expDateIdx];
                            let parsedAmt = parseFloat(rawAmt);
                            
                            if (!isNaN(parsedAmt) && parsedAmt > 0) {
                                const dateStr = cleanSpreadsheetDate(rawDt, "2026", "May");
                                let actualYear, actualMonth;
                                if (expYearIdx !== -1 && expMonthIdx !== -1) {
                                    actualYear = String(row[expYearIdx] || '').trim();
                                    actualMonth = String(row[expMonthIdx] || '').trim();
                                } else {
                                    const parsedD = new Date(dateStr);
                                    actualYear = String(parsedD.getUTCFullYear());
                                    const monthsArr = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                                    actualMonth = monthsArr[parsedD.getUTCMonth()] || "May";
                                }
                                expenseInserts.push({
                                    year: actualYear,
                                    month: actualMonth,
                                    expense_head: 'Uncategorized',
                                    description: desc,
                                    amount: parsedAmt,
                                    date_spent: dateStr
                                });
                            }
                        });
                    } else {
                        dfExpData.forEach(row => {
                            if (row.length < 3) return;
                            const desc = String(row[1] || '').trim();
                            if (!desc || desc.toUpperCase().includes("SR.") || desc.toUpperCase().includes("TOTAL") || desc.length < 3) {
                                return;
                            }
                            
                            expMonthCols.forEach(emc => {
                                if (emc.amtCol < row.length) {
                                    const amtValRaw = row[emc.amtCol];
                                    const dtValRaw = (emc.dtCol !== null && emc.dtCol < row.length) ? row[emc.dtCol] : "";
                                    
                                    let parsedAmt = parseFloat(amtValRaw);
                                    if (isNaN(parsedAmt)) {
                                        parsedAmt = 0.0;
                                    }
                                    
                                    if (parsedAmt > 0) {
                                        const dateStr = cleanSpreadsheetDate(dtValRaw, emc.year, emc.month);
                                        expenseInserts.push({
                                            year: emc.year,
                                            month: emc.month,
                                            expense_head: 'Uncategorized',
                                            description: desc,
                                            amount: parsedAmt,
                                            date_spent: dateStr
                                        });
                                    }
                                }
                            });
                        });
                    }
                    
                    if (expenseInserts.length > 0) {
                        const chunkSize = 200;
                        for (let i = 0; i < expenseInserts.length; i += chunkSize) {
                            const chunk = expenseInserts.slice(i, i + chunkSize);
                            const { error: insErr } = await sbClient.from('expenses').insert(chunk);
                            if (insErr) throw insErr;
                        }
                        importedExpensesCount = expenseInserts.length;
                    }
                }
            }
            
            showToast(`Excel imports finished successfully!\nParsed ${importedIncomeCount} income collections and ${importedExpensesCount} expense vouchers.`, "success");
            closeModal("importModal");
            refreshDashboard();
            
        } catch (err) {
            console.error("Ledger import error:", err);
            showToast(err.message || "Failed parsing document structure.", "error");
        } finally {
            btn.disabled = false;
            btn.textContent = "Upload & Parse";
        }
    };
    
    reader.readAsArrayBuffer(file);
};

// Handle owners registry updates via SheetJS
window.handleOwnersSubmit = async function(e) {
    e.preventDefault();
    if (!sbClient) {
        showToast("Database not connected.", "error");
        return;
    }
    
    if (!hasPermission('owners:upload')) {
        showToast("Access Denied: You don't have permission to upload owner mappings.", "error");
        return;
    }
    
    const fileInput = document.getElementById("owners-file");
    if (!fileInput.files || !fileInput.files[0]) return;
    
    const btn = document.getElementById("btn-owners-submit");
    btn.disabled = true;
    btn.textContent = "Uploading...";
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = async function(event) {
        try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            
            let headerRowIdx = -1;
            for (let r = 0; r < rows.length; r++) {
                const rowStr = rows[r].map(v => String(v || '').toUpperCase()).join(' ');
                if (rowStr.includes("FLAT NO") || rowStr.includes("FLAT")) {
                    headerRowIdx = r;
                    break;
                }
            }
            
            let startIdx = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
            const upsertData = [];
            
            for (let r = startIdx; r < rows.length; r++) {
                const row = rows[r];
                if (!row || row.length < 3) continue;
                
                const nameVal = String(row[1] || '').trim();
                const flatVal = String(row[2] || '').trim().toUpperCase().replace(/\s+/g, '');
                
                if (flatVal && flatVal !== "NAN" && flatVal !== "UNDEFINED") {
                    const ownerName = (nameVal && nameVal !== "nan" && nameVal !== "undefined") ? nameVal : `Flat ${flatVal}`;
                    upsertData.push({
                        flat_no: flatVal,
                        owner_name: ownerName
                    });
                }
            }
            
            if (upsertData.length === 0) {
                throw new Error("No valid owner mappings found in the spreadsheet.");
            }
            
            const { error } = await sbClient.from('owners').upsert(upsertData, { onConflict: 'flat_no' });
            if (error) throw error;
            
            showToast(`Successfully loaded ${upsertData.length} owner mappings!`);
            closeModal("ownersModal");
            loadFlats();
        } catch (err) {
            console.error("Owners import error:", err);
            showToast(err.message || "Failed parsing owners spreadsheet.", "error");
        } finally {
            btn.disabled = false;
            btn.textContent = "Upload Mapping";
        }
    };
    
    reader.readAsArrayBuffer(file);
};

// Export entire ledger dynamically using SheetJS
window.exportLedgerToExcel = async function() {
    if (!sbClient) {
        showToast("Database not connected.", "error");
        return;
    }
    
    try {
        showToast("Generating spreadsheet...", "success");
        
        const { data: incomeData, error: incErr } = await sbClient.from('income').select('id, flat_no, year, month, amount, date_received').or('status.eq.approved,status.is.null').order('id');
        if (incErr) throw incErr;
        
        const { data: expenseData, error: expErr } = await sbClient.from('expenses').select('id, year, month, description, amount, date_spent').order('id');
        if (expErr) throw expErr;
        
        const formattedIncome = incomeData.map(item => ({
            "ID": item.id,
            "Flat Details": item.flat_no,
            "Year": item.year,
            "Month": item.month,
            "Amount Paid (Rs.)": item.amount,
            "Date Received": item.date_received
        }));
        
        const formattedExpense = expenseData.map(item => ({
            "ID": item.id,
            "Year": item.year,
            "Month": item.month,
            "Description": item.description,
            "Amount Spent (Rs.)": item.amount,
            "Date Spent": item.date_spent
        }));
        
        const wb = XLSX.utils.book_new();
        const wsInc = XLSX.utils.json_to_sheet(formattedIncome);
        const wsExp = XLSX.utils.json_to_sheet(formattedExpense);
        
        XLSX.utils.book_append_sheet(wb, wsInc, "Income Summary");
        XLSX.utils.book_append_sheet(wb, wsExp, "Expense Summary");
        
        const dateStr = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '');
        const buildingSlug = getBuildingName().replace(/\s+/g, '_').toLowerCase();
        const filename = `${buildingSlug}_ledger_${dateStr}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        showToast("Spreadsheet downloaded successfully!");
    } catch (err) {
        console.error("Export ledger error:", err);
        showToast("Could not export ledger.", "error");
    }
};

