// JavaScript Controller - Deepsikha Ledger Manager Web

document.addEventListener("DOMContentLoaded", () => {
    // Set default dates to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("inc-date").value = today;
    document.getElementById("exp-date").value = today;

    // Load initial data
    loadFlats();
    refreshDashboard();

    // Bind filters
    document.getElementById("filter-year").addEventListener("change", refreshDashboard);
    document.getElementById("filter-month").addEventListener("change", refreshDashboard);
});

// Toast System
function showToast(message, type = "success", actionBtn = null) {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    const icon = type === "success" 
        ? '<i class="fa-solid fa-circle-check"></i>' 
        : '<i class="fa-solid fa-circle-exclamation"></i>';
        
    toast.innerHTML = `${icon} <span>${message}</span>`;
    
    if (actionBtn) {
        const btn = document.createElement("button");
        btn.className = "toast-btn";
        btn.innerHTML = actionBtn.text;
        btn.onclick = actionBtn.callback;
        toast.appendChild(btn);
    }
    
    container.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = "slideInRight 0.3s ease reverse";
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
}

// Load dropdown flats from database
async function loadFlats() {
    try {
        const response = await fetch('/api/flats');
        if (!response.ok) throw new Error("Failed to load flats");
        const flats = await response.ok ? await response.json() : [];
        
        const flatSelect = document.getElementById("inc-flat");
        
        // Save current selection value
        const currentVal = flatSelect.value;
        
        // Reset and rebuild options
        flatSelect.innerHTML = '<option value="" disabled selected>Select Room & Tenant</option>';
        flats.forEach(flat => {
            const opt = document.createElement("option");
            opt.value = flat;
            opt.textContent = flat;
            flatSelect.appendChild(opt);
        });

        // Restore if valid
        if (flats.includes(currentVal)) {
            flatSelect.value = currentVal;
        }
    } catch (err) {
        console.error("Flats loader error:", err);
        showToast("Could not load owners registry list.", "error");
    }
}

// Global cached entries list for local searching
let loadedEntries = [];

// Refresh dashboard stats and table
async function refreshDashboard() {
    const year = document.getElementById("filter-year").value;
    const month = document.getElementById("filter-month").value;

    try {
        const res = await fetch(`/api/dashboard?year=${year}&month=${month}`);
        if (!res.ok) throw new Error("Dashboard API returned error");
        
        const data = await res.json();
        
        // Update KPIs
        document.getElementById("stat-income").textContent = formatCurrency(data.total_income);
        document.getElementById("stat-expense").textContent = formatCurrency(data.total_expense);
        document.getElementById("stat-cash").textContent = formatCurrency(data.cash_in_hand);

        // Update local search cache
        loadedEntries = data.entries;
        
        // Render table
        renderTable(loadedEntries);
        
        // Update export link query parameters
        document.getElementById("btn-export").href = `/api/export-ledger?year=${year}&month=${month}`;

    } catch (err) {
        console.error("Dashboard refresh error:", err);
        showToast("Error loading financial dashboard.", "error");
    }
}

// Format number to currency (e.g. 1500 -> Rs. 1,500.00)
function formatCurrency(val) {
    return "Rs. " + Number(val).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Render entries into table
function renderTable(entries) {
    const tbody = document.getElementById("ledger-body");
    tbody.innerHTML = "";

    if (entries.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center" style="color: var(--text-muted); padding: 30px;">
                    <i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                    No ledger entries logged for this period.
                </td>
            </tr>
        `;
        return;
    }

    entries.forEach(entry => {
        const tr = document.createElement("tr");
        
        const typeBadge = entry.type === "INCOME" 
            ? `<span class="badge badge-income">Income</span>`
            : `<span class="badge badge-expense">Expense</span>`;

        const actions = entry.type === "INCOME"
            ? `<button class="btn-receipt" title="Generate PDF Receipt" onclick="generateReceipt(${entry.id})">
                   <i class="fa-solid fa-file-pdf"></i>
               </button>`
            : '';

        tr.innerHTML = `
            <td>#${entry.id}</td>
            <td>${typeBadge}</td>
            <td><strong>${entry.description}</strong></td>
            <td>${entry.month} ${entry.year}</td>
            <td class="text-right ${entry.type === "INCOME" ? "icon-emerald" : "icon-rose"}" style="font-weight: 600;">
                ${entry.type === "INCOME" ? "+" : "-"} ${Number(entry.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </td>
            <td class="text-center">${entry.date}</td>
            <td class="text-center">
                ${actions}
                <button class="btn-delete" title="Delete entry" onclick="deleteEntry('${entry.type}', ${entry.id}, '${entry.description.replace(/'/g, "\\'").replace(/"/g, "&quot;")}')">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Client-side local filtering in ledger table
function filterTable() {
    const query = document.getElementById("table-search").value.toLowerCase().trim();
    if (!query) {
        renderTable(loadedEntries);
        return;
    }

    const filtered = loadedEntries.filter(entry => {
        return entry.description.toLowerCase().includes(query) || 
               entry.type.toLowerCase().includes(query) ||
               String(entry.id).includes(query);
    });
    renderTable(filtered);
}

// Handle income form submission
async function handleIncomeSubmit(e) {
    e.preventDefault();
    
    const flat = document.getElementById("inc-flat").value;
    const year = document.getElementById("inc-year").value;
    const month = document.getElementById("inc-month").value;
    const amount = document.getElementById("inc-amount").value;
    const date = document.getElementById("inc-date").value;

    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;

    try {
        const res = await fetch('/api/income', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ flat_no: flat, year, month, amount, date })
        });
        
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || "Failed to log income");
        
        showToast(data.message, "success", {
            text: '<i class="fa-solid fa-file-pdf"></i> Receipt',
            callback: () => generateReceipt(data.id)
        });
        document.getElementById("inc-amount").value = "";
        closeModal('incomeModal');
        refreshDashboard();
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        btn.disabled = false;
    }
}

// Handle expense form submission
async function handleExpenseSubmit(e) {
    e.preventDefault();
    
    const year = document.getElementById("exp-year").value;
    const month = document.getElementById("exp-month").value;
    const desc = document.getElementById("exp-desc").value;
    const amount = document.getElementById("exp-amount").value;
    const date = document.getElementById("exp-date").value;

    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;

    try {
        const res = await fetch('/api/expense', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year, month, description: desc, amount, date })
        });
        
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || "Failed to log expense");
        
        showToast(data.message);
        document.getElementById("exp-desc").value = "";
        document.getElementById("exp-amount").value = "";
        closeModal('expenseModal');
        refreshDashboard();
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        btn.disabled = false;
    }
}

// Delete entry logic
async function deleteEntry(type, id, desc) {
    if (!confirm(`Are you sure you want to permanently delete this entry?\n\n"${desc}"`)) {
        return;
    }

    try {
        const res = await fetch(`/api/entry/${type}/${id}`, {
            method: 'DELETE'
        });
        
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || "Deletion failed");
        
        showToast(data.message);
        refreshDashboard();
    } catch (err) {
        showToast(err.message, "error");
    }
}

// Modal handling
function openModal(modalId) {
    document.getElementById(modalId).style.display = "block";
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = "none";
    // Clear forms inside modal on close
    const form = document.getElementById(modalId).querySelector("form");
    if (form) {
        form.reset();
        const dropzoneText = form.querySelector(".dropzone-text");
        if (dropzoneText) {
            if (modalId === "importModal") {
                dropzoneText.textContent = "Click or drag Excel file here";
            } else {
                dropzoneText.textContent = "Click or drag owners.xlsx file here";
            }
        }
    }
}

// Update file upload dropzone text labels when a file is selected
function updateDropzoneText(input) {
    const label = input.parentElement.querySelector(".dropzone-text");
    if (input.files && input.files[0]) {
        label.textContent = `Selected: ${input.files[0].name}`;
        label.style.color = "var(--color-emerald)";
    }
}

// Handle bulk ledger imports
async function handleImportSubmit(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById("import-file");
    if (!fileInput.files || !fileInput.files[0]) return;

    const btn = document.getElementById("btn-import-submit");
    btn.disabled = true;
    btn.textContent = "Uploading & Parsing...";

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    try {
        const res = await fetch('/api/import-ledger', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Spreadsheet import parsing failed.");
        
        showToast(data.message);
        closeModal("importModal");
        refreshDashboard();
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        btn.disabled = false;
        btn.textContent = "Upload & Parse";
    }
}

// Handle owners map updates
async function handleOwnersSubmit(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById("owners-file");
    if (!fileInput.files || !fileInput.files[0]) return;

    const btn = document.getElementById("btn-owners-submit");
    btn.disabled = true;
    btn.textContent = "Uploading...";

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    try {
        const res = await fetch('/api/upload-owners', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Owners mapping update failed.");
        
        showToast(data.message);
        closeModal("ownersModal");
        loadFlats(); // reload dropdowns
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        btn.disabled = false;
        btn.textContent = "Upload Mapping";
    }
}

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        closeModal(event.target.id);
    }
}

// Open History Modal and populate its flat selections
async function openHistoryModal() {
    openModal('historyModal');
    
    // Set default dates to start of current year and today
    const now = new Date();
    const currentYear = now.getFullYear();
    const todayStr = now.toISOString().split('T')[0];
    const startOfYearStr = `${currentYear}-01-01`;
    
    document.getElementById("hist-start-date").value = startOfYearStr;
    document.getElementById("hist-end-date").value = todayStr;
    
    // Load flats dropdown in history modal as well
    try {
        const response = await fetch('/api/flats');
        if (!response.ok) throw new Error();
        const flats = await response.json();
        
        const histFlat = document.getElementById("hist-flat");
        histFlat.innerHTML = '<option value="ALL">All Flats</option>';
        flats.forEach(flat => {
            const opt = document.createElement("option");
            opt.value = flat;
            opt.textContent = flat;
            histFlat.appendChild(opt);
        });
    } catch(e) {
        console.error("Failed to populate history flats:", e);
    }
    
    // Trigger initial search
    fetchHistory();
}

// Fetch history records via AJAX
async function fetchHistory() {
    const type = document.getElementById("hist-type").value;
    const flat = document.getElementById("hist-flat").value;
    const year = document.getElementById("hist-year").value;
    const month = document.getElementById("hist-month").value;
    const startDate = document.getElementById("hist-start-date").value;
    const endDate = document.getElementById("hist-end-date").value;
    const search = document.getElementById("hist-search").value;

    const queryParams = new URLSearchParams({
        type,
        flat_no: flat,
        year,
        month,
        start_date: startDate,
        end_date: endDate,
        search
    });

    try {
        const res = await fetch(`/api/history?${queryParams.toString()}`);
        if (!res.ok) throw new Error("History fetch failed");
        
        const entries = await res.json();
        renderHistoryTable(entries);
    } catch(err) {
        console.error(err);
        showToast("Error searching history ledger.", "error");
    }
}

// Render history entries inside the modal table
function renderHistoryTable(entries) {
    const tbody = document.getElementById("history-body");
    tbody.innerHTML = "";

    if (entries.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center" style="color: var(--text-muted); padding: 30px;">
                    <i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                    No ledger history matches the current filters.
                </td>
            </tr>
        `;
        return;
    }

    entries.forEach(entry => {
        const tr = document.createElement("tr");
        
        const typeBadge = entry.type === "INCOME" 
            ? `<span class="badge badge-income">Income</span>`
            : `<span class="badge badge-expense">Expense</span>`;

        const receiptBtn = entry.type === "INCOME"
            ? `<button class="btn-receipt" title="Generate PDF Receipt" onclick="generateReceipt(${entry.id})">
                   <i class="fa-solid fa-file-pdf"></i> Receipt
               </button>`
            : '';

        tr.innerHTML = `
            <td>${entry.date}</td>
            <td>${typeBadge}</td>
            <td><strong>${entry.description}</strong></td>
            <td class="text-right ${entry.type === "INCOME" ? "icon-emerald" : "icon-rose"}" style="font-weight: 600;">
                ${entry.type === "INCOME" ? "+" : "-"} ${Number(entry.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </td>
            <td class="text-center">
                ${receiptBtn}
                <button class="btn-delete" title="Delete entry" onclick="deleteHistoryEntry('${entry.type}', ${entry.id}, '${entry.description.replace(/'/g, "\\'").replace(/"/g, "&quot;")}')">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Generate receipt PDF by opening it in a new window/tab
function generateReceipt(entryId) {
    window.open(`/api/receipt/${entryId}`, '_blank');
}

// Delete entry in history and reload history list + main dashboard
async function deleteHistoryEntry(type, id, desc) {
    if (!confirm(`Are you sure you want to permanently delete this entry from history?\n\n"${desc}"`)) {
        return;
    }

    try {
        const res = await fetch(`/api/entry/${type}/${id}`, {
            method: 'DELETE'
        });
        
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || "Deletion failed");
        
        showToast(data.message);
        fetchHistory(); // refresh history modal table
        refreshDashboard(); // refresh main dashboard view
    } catch (err) {
        showToast(err.message, "error");
    }
}

// --- FINANCIAL REPORTS CONTROLLERS ---

let activeReportTab = 'date-wise-cashbook';

function openReportsModal() {
    openModal('reportsModal');
    
    // Set default dates: first day of current month to today
    const now = new Date();
    const currentYear = now.getFullYear();
    const todayStr = now.toISOString().split('T')[0];
    const currentMonthPad = String(now.getMonth() + 1).padStart(2, '0');
    const startOfMonthStr = `${currentYear}-${currentMonthPad}-01`;
    
    document.getElementById("rep-start-date").value = startOfMonthStr;
    document.getElementById("rep-end-date").value = todayStr;
    document.getElementById("rep-year").value = currentYear.toString();
    
    // Default tab
    switchReportTab('date-wise-cashbook');
}

function switchReportTab(tabId) {
    activeReportTab = tabId;
    
    // Toggle active state in tabs
    document.querySelectorAll('.report-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    // Toggle filter panel visibility
    if (tabId === 'date-wise-cashbook') {
        document.getElementById('rep-filter-dates').classList.remove('hidden');
        document.getElementById('rep-filter-year').classList.add('hidden');
    } else {
        document.getElementById('rep-filter-dates').classList.add('hidden');
        document.getElementById('rep-filter-year').classList.remove('hidden');
    }
    
    loadActiveReport();
}

async function loadActiveReport() {
    const sheet = document.getElementById("report-sheet");
    sheet.innerHTML = `
        <div class="text-center" style="padding: 40px; color: var(--text-muted);">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 12px; display: block;"></i>
            Generating report, please wait...
        </div>
    `;
    
    try {
        if (activeReportTab === 'date-wise-cashbook') {
            const startDate = document.getElementById("rep-start-date").value;
            const endDate = document.getElementById("rep-end-date").value;
            if (!startDate || !endDate) {
                sheet.innerHTML = `<div class="text-center" style="padding: 30px; color: #e11d48;">Please select both Start and End dates.</div>`;
                return;
            }
            const res = await fetch(`/api/reports/cashbook/datewise?start_date=${startDate}&end_date=${endDate}`);
            if (!res.ok) throw new Error("API error");
            const data = await res.json();
            renderDateWiseCashbook(data);
        } else if (activeReportTab === 'month-wise-cashbook') {
            const year = document.getElementById("rep-year").value;
            const res = await fetch(`/api/reports/cashbook/monthwise?year=${year}`);
            if (!res.ok) throw new Error("API error");
            const data = await res.json();
            renderMonthWiseCashbook(data);
        } else if (activeReportTab === 'income-expenditure') {
            const year = document.getElementById("rep-year").value;
            const res = await fetch(`/api/reports/income-expenditure?year=${year}`);
            if (!res.ok) throw new Error("API error");
            const data = await res.json();
            renderIncomeExpenditure(data);
        }
    } catch (err) {
        console.error(err);
        sheet.innerHTML = `<div class="text-center" style="padding: 30px; color: #e11d48;"><i class="fa-solid fa-triangle-exclamation"></i> Error loading report. Please try again.</div>`;
    }
}

function formatDateDisplay(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

function renderDateWiseCashbook(data) {
    const sheet = document.getElementById("report-sheet");
    
    let rowsHTML = "";
    let runningBal = data.opening_balance;
    
    // Add opening balance row
    rowsHTML += `
        <tr class="row-opening">
            <td>${formatDateDisplay(data.start_date)}</td>
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
                    <td>${formatDateDisplay(t.date)}</td>
                    <td><code>${t.ref_no}</code></td>
                    <td>${t.particulars}</td>
                    <td class="text-right ${t.debit > 0 ? 'amt-dr' : ''}">${drText}</td>
                    <td class="text-right ${t.credit > 0 ? 'amt-cr' : ''}">${crText}</td>
                    <td class="text-right rep-bal">${formatCurrency(runningBal)}</td>
                </tr>
            `;
        });
    }
    
    // Add closing balance row
    rowsHTML += `
        <tr class="row-closing">
            <td>${formatDateDisplay(data.end_date)}</td>
            <td>-</td>
            <td>Closing Balance C/F</td>
            <td class="text-right">-</td>
            <td class="text-right">-</td>
            <td class="text-right rep-bal">${formatCurrency(data.closing_balance)}</td>
        </tr>
    `;
    
    sheet.innerHTML = `
        <div class="report-header">
            <h2>DEEPSIKHA RESIDENCY (BLOCK - 2)</h2>
            <p><strong>DATE-WISE CASH BOOK</strong></p>
            <p>Period: ${formatDateDisplay(data.start_date)} to ${formatDateDisplay(data.end_date)}</p>
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
            <h2>DEEPSIKHA RESIDENCY (BLOCK - 2)</h2>
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
    
    // Build Incomes column rows
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
    
    // Build Expenditures column rows
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
    
    // surplus card class
    const isSurplus = data.surplus_deficit >= 0;
    const absVal = Math.abs(data.surplus_deficit);
    
    // Build Income Details (flat-wise breakdown)
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
            <h2>DEEPSIKHA RESIDENCY (BLOCK - 2)</h2>
            <p><strong>INCOME AND EXPENDITURE ACCOUNT</strong></p>
            <p>For the Year Ended: 31st December ${data.year}</p>
        </div>
        
        <div class="inc-exp-grid">
            <!-- Expenditures Column -->
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
            
            <!-- Incomes Column -->
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

function printActiveReport() {
    window.print();
}
