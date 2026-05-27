// JavaScript Controller - Deepsikha Ledger Manager Web (Vite + Supabase Serverless with RBAC)

let sbClient = null;
let loadedEntries = [];
let activeReportTab = 'date-wise-cashbook';
let currentUserRole = 'viewer';
let currentUserId = null;
let loadedTickets = [];
let selectedTicketId = null;
let ticketScope = 'ALL';

document.addEventListener("DOMContentLoaded", () => {
    // Set default dates to today
    const today = new Date().toISOString().split('T')[0];
    const incDateInput = document.getElementById("inc-date");
    const expDateInput = document.getElementById("exp-date");
    if (incDateInput) incDateInput.value = today;
    if (expDateInput) expDateInput.value = today;

    // Set default selected year and month in main filter bar based on current local date
    const now = new Date();
    const currentYear = now.getFullYear();
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentMonth = months[now.getMonth()];
    
    const filterYear = document.getElementById("filter-year");
    if (filterYear) {
        if (![...filterYear.options].some(opt => opt.value === String(currentYear))) {
            const opt = document.createElement("option");
            opt.value = String(currentYear);
            opt.textContent = String(currentYear);
            filterYear.appendChild(opt);
        }
        filterYear.value = String(currentYear);
    }
    
    const filterMonth = document.getElementById("filter-month");
    if (filterMonth) {
        filterMonth.value = currentMonth;
    }

    // Bind filters
    if (filterYear) filterYear.addEventListener("change", refreshDashboard);
    if (filterMonth) filterMonth.addEventListener("change", refreshDashboard);

    // Initialize Supabase Client
    if (initSupabase()) {
        setupAuthListener();
    } else {
        openSupabaseConfig();
    }
});

// Toast System
function showToast(message, type = "success", actionBtn = null) {
    const container = document.getElementById("toast-container");
    if (!container) return;
    
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

// Initialize Supabase Client using LocalStorage or Fallback env variables
function initSupabase() {
    let url = localStorage.getItem('supabaseUrl') || "";
    let key = localStorage.getItem('supabaseKey') || "";
    
    // Fallback to Vite env variables if localstorage is empty
    try {
        if (!url && typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) {
            url = import.meta.env.VITE_SUPABASE_URL;
        }
        if (!key && typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) {
            key = import.meta.env.VITE_SUPABASE_ANON_KEY;
        }
    } catch (e) {
        console.warn("Vite env variables not accessible:", e);
    }
    
    if (url && key && url !== 'YOUR_SUPABASE_URL' && key !== 'YOUR_SUPABASE_ANON_KEY' && url.trim() !== "" && key.trim() !== "") {
        try {
            console.log("Initializing Supabase client with URL:", url.trim());
            sbClient = window.supabase.createClient(url.trim(), key.trim());
            updateDbStatus(true);
            return true;
        } catch (e) {
            console.error("Failed to initialize Supabase client:", e);
            updateDbStatus(false, "Init Error");
            return false;
        }
    } else {
        updateDbStatus(false, "Disconnected");
        return false;
    }
}

// Update DB connection status pill in Header
function updateDbStatus(isConnected, message) {
    const badge = document.getElementById("db-status-badge");
    const text = document.getElementById("db-status-text");
    if (!badge || !text) return;
    
    if (isConnected) {
        badge.className = "badge badge-income"; // Emerald theme
        badge.style.borderColor = "rgba(16, 185, 129, 0.4)";
        badge.style.cursor = "pointer";
        text.textContent = "Connected";
    } else {
        badge.className = "badge badge-expense"; // Rose theme
        badge.style.borderColor = "rgba(244, 63, 94, 0.4)";
        badge.style.cursor = "pointer";
        text.textContent = message || "Disconnected";
    }
}

// Open Supabase credentials dialog
window.openSupabaseConfig = function() {
    const url = localStorage.getItem('supabaseUrl') || "";
    const key = localStorage.getItem('supabaseKey') || "";
    const sbUrlInput = document.getElementById("sb-url");
    const sbKeyInput = document.getElementById("sb-key");
    if (sbUrlInput) sbUrlInput.value = url;
    if (sbKeyInput) sbKeyInput.value = key;
    openModal("supabaseConfigModal");
};

// Save Supabase credentials and reconnect
window.saveSupabaseConfig = function(e) {
    e.preventDefault();
    const url = document.getElementById("sb-url").value.trim();
    const key = document.getElementById("sb-key").value.trim();
    
    localStorage.setItem('supabaseUrl', url);
    localStorage.setItem('supabaseKey', key);
    
    closeModal("supabaseConfigModal");
    
    if (initSupabase()) {
        showToast("Supabase credentials saved successfully!", "success");
        setupAuthListener();
    } else {
        showToast("Invalid credentials. Connection failed.", "error");
    }
};

// --- AUTHENTICATION & SESSION CONTROLLERS ---

function setupAuthListener() {
    if (!sbClient) return;
    
    // Bind sign in / sign out updates
    sbClient.auth.onAuthStateChange((event, session) => {
        if (session) {
            currentUserId = session.user.id;
            
            // Push to next tick to avoid Supabase Auth Web Locks deadlock
            setTimeout(async () => {
                try {
                    if (localStorage.getItem("isSoftLogin") === "true") {
                        const flatNo = localStorage.getItem("currentFlatNo");
                        await handleSoftUserSession(session.user, flatNo);
                    } else {
                        await handleUserSession(session.user);
                    }
                    // Hide only on successful session loading
                    document.getElementById("auth-container").style.display = "none";
                } catch (err) {
                    console.error("Session initialization failed:", err);
                    // Clear any invalid session
                    localStorage.removeItem("isSoftLogin");
                    localStorage.removeItem("currentFlatNo");
                    await sbClient.auth.signOut();
                    
                    currentUserId = null;
                    document.getElementById("auth-container").style.display = "block";
                    document.getElementById("user-profile-badge").style.display = "none";
                    currentUserRole = 'viewer';
                    applyRbacRestrictions('viewer');
                }
            }, 0);
        } else {
            if (localStorage.getItem("isSoftLogin") === "true") {
                const flatNo = localStorage.getItem("currentFlatNo");
                autoLoginSharedAccount(flatNo);
            } else {
                currentUserId = null;
                document.getElementById("auth-container").style.display = "block";
                document.getElementById("user-profile-badge").style.display = "none";
                currentUserRole = 'viewer';
                applyRbacRestrictions('viewer');
            }
        }
    });
}

async function handleUserSession(user) {
    if (!sbClient) return;
    
    try {
        // Query user's profile role from the profiles table
        let { data, error } = await sbClient.from('profiles').select('role').eq('id', user.id).single();
        
        if (error) {
            // Profile row might not have been created yet by the DB trigger due to latency
            console.warn("Profile fetching failed, retrying in 1s...", error);
            await new Promise(resolve => setTimeout(resolve, 1000));
            const retryRes = await sbClient.from('profiles').select('role').eq('id', user.id).single();
            data = retryRes.data;
            if (retryRes.error) throw retryRes.error;
        }
        
        currentUserRole = data && data.role ? data.role.toLowerCase().trim() : "viewer";
        
        // Update user badge in UI header
        const badge = document.getElementById("user-profile-badge");
        const emailText = document.getElementById("user-email-text");
        const roleText = document.getElementById("user-role-text");
        
        if (badge && emailText && roleText) {
            emailText.textContent = user.email;
            roleText.textContent = currentUserRole.toUpperCase();
            
            // Set role styling
            if (currentUserRole === 'admin') {
                roleText.className = "badge badge-income"; // Emerald
                roleText.style.borderColor = "rgba(16, 185, 129, 0.4)";
                roleText.style.color = "var(--color-emerald)";
            } else if (currentUserRole === 'editor') {
                roleText.className = "badge badge-expense"; // Rose
                roleText.style.borderColor = "rgba(244, 63, 94, 0.4)";
                roleText.style.color = "var(--color-rose)";
            } else {
                roleText.className = "badge"; // default slate
                roleText.style.borderColor = "var(--border-color)";
                roleText.style.color = "var(--text-secondary)";
            }
            badge.style.display = "inline-flex";
        }
        
        // Apply RBAC modifications to view buttons and actions
        applyRbacRestrictions(currentUserRole);
        
        // Seed owners defaults if they don't exist yet
        await ensureOwnersPopulated();
        
        // Load data registries
        loadFlats();
        loadExpenseHeads();
        refreshDashboard();
    } catch (e) {
        console.error("handleUserSession error:", e);
        showToast("Error retrieving user profile role credentials.", "error");
    }
}

function applyRbacRestrictions(role) {
    const importBtn = document.querySelector("button[onclick=\"openModal('importModal')\"]");
    const ownersBtn = document.querySelector("button[onclick=\"openModal('ownersModal')\"]");
    const manageHeadsBtn = document.querySelector("button[onclick=\"openExpenseHeadsModal()\"]");
    
    const collectFeeBtn = document.querySelector("button[onclick=\"openModal('incomeModal')\"]");
    const recordExpenseBtn = document.querySelector("button[onclick=\"openModal('expenseModal')\"]");
    const manageUsersBtn = document.getElementById("btn-manage-users");
    
    if (role === 'admin') {
        if (importBtn) importBtn.style.display = "inline-flex";
        if (ownersBtn) ownersBtn.style.display = "inline-flex";
        if (manageHeadsBtn) manageHeadsBtn.style.display = "inline-flex";
        if (collectFeeBtn) collectFeeBtn.style.display = "inline-flex";
        if (recordExpenseBtn) recordExpenseBtn.style.display = "inline-flex";
        
        // Show main workspace and other navbar buttons
        document.querySelector(".workspace").style.display = "block";
        document.querySelector("button[onclick=\"openHistoryModal()\"]").style.display = "inline-flex";
        document.querySelector("button[onclick=\"openReportsModal()\"]").style.display = "inline-flex";
        document.getElementById("btn-export").style.display = "inline-flex";
        if (manageUsersBtn) manageUsersBtn.style.display = "inline-flex";
    } else if (role === 'editor') {
        if (importBtn) importBtn.style.display = "none";
        if (ownersBtn) ownersBtn.style.display = "none";
        if (manageHeadsBtn) manageHeadsBtn.style.display = "none";
        if (collectFeeBtn) collectFeeBtn.style.display = "inline-flex";
        if (recordExpenseBtn) recordExpenseBtn.style.display = "inline-flex";
        
        // Show main workspace and other navbar buttons
        document.querySelector(".workspace").style.display = "block";
        document.querySelector("button[onclick=\"openHistoryModal()\"]").style.display = "inline-flex";
        document.querySelector("button[onclick=\"openReportsModal()\"]").style.display = "inline-flex";
        document.getElementById("btn-export").style.display = "inline-flex";
        if (manageUsersBtn) manageUsersBtn.style.display = "none";
    } else {
        // viewer (resident soft login) - Only Owners Directory and Support Helpdesk allowed
        if (importBtn) importBtn.style.display = "none";
        if (ownersBtn) ownersBtn.style.display = "none"; // Hide upload owners (admin function)
        if (manageHeadsBtn) manageHeadsBtn.style.display = "none";
        if (collectFeeBtn) collectFeeBtn.style.display = "none";
        if (recordExpenseBtn) recordExpenseBtn.style.display = "none";
        
        // Hide unused navbar buttons and entire dashboard workspace
        document.querySelector(".workspace").style.display = "none";
        
        const historyBtn = document.querySelector("button[onclick=\"openHistoryModal()\"]");
        if (historyBtn) historyBtn.style.display = "none";
        
        const reportsBtn = document.querySelector("button[onclick=\"openReportsModal()\"]");
        if (reportsBtn) reportsBtn.style.display = "none";
        
        const exportBtn = document.getElementById("btn-export");
        if (exportBtn) exportBtn.style.display = "none";
        
        if (manageUsersBtn) manageUsersBtn.style.display = "none";
    }
    
    // Refresh ledger lists so that edit buttons disappear or appear
    if (loadedEntries.length > 0) {
        renderTable(loadedEntries);
    }
}

// Toggle between Login & Register forms
window.toggleAuthForms = function(showRegister) {
    document.getElementById("login-form-wrapper").style.display = showRegister ? "none" : "block";
    document.getElementById("register-form-wrapper").style.display = showRegister ? "block" : "none";
};

// Sign In Form Submission
window.handleLoginSubmit = async function(e) {
    e.preventDefault();
    if (!sbClient) {
        showToast("Database not connected.", "error");
        return;
    }
    
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    
    const btn = document.getElementById("btn-login-submit");
    btn.disabled = true;
    btn.textContent = "Signing In...";
    
    try {
        const { error } = await sbClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        if (error) throw error;
        showToast("Welcome back!", "success");
    } catch (err) {
        showToast(err.message || "Failed to log in", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In';
    }
};

// Register Form Submission
window.handleRegisterSubmit = async function(e) {
    e.preventDefault();
    if (!sbClient) {
        showToast("Database not connected.", "error");
        return;
    }
    
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;
    const confirmPassword = document.getElementById("register-confirm-password").value;
    
    if (password !== confirmPassword) {
        showToast("Passwords do not match.", "error");
        return;
    }
    
    if (password.length < 6) {
        showToast("Password must be at least 6 characters.", "error");
        return;
    }
    
    const btn = document.getElementById("btn-register-submit");
    btn.disabled = true;
    btn.textContent = "Registering...";
    
    try {
        const { data, error } = await sbClient.auth.signUp({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        if (data.session) {
            showToast("Registration successful!", "success");
        } else {
            showToast("Registration successful! Verify link sent to email.", "success");
        }
        toggleAuthForms(false);
    } catch (err) {
        showToast(err.message || "Registration failed.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create Account';
    }
};

// Logout Handler
window.handleLogout = async function() {
    if (!sbClient) return;
    if (!confirm("Are you sure you want to sign out?")) return;
    
    try {
        localStorage.removeItem("isSoftLogin");
        localStorage.removeItem("currentFlatNo");
        const { error } = await sbClient.auth.signOut();
        if (error) throw error;
        showToast("Logged out successfully.");
    } catch (err) {
        showToast("Logout failed.", "error");
    }
};

// Seed default flat list if owners registry is empty
async function ensureOwnersPopulated() {
    if (!sbClient) return;
    try {
        const { data, error } = await sbClient.from('owners').select('flat_no').limit(1);
        if (error) throw error;
        
        if (!data || data.length === 0) {
            const defaultOwners = [];
            const floors = ['1','2','3','4','5','6','7','8'];
            const wings = ['A','B','C','D','E','F','G','H'];
            floors.forEach(f => {
                wings.forEach(w => {
                    defaultOwners.push({
                        flat_no: `${f}${w}`,
                        owner_name: `Flat ${f}${w}`
                    });
                });
            });
            const { error: insertError } = await sbClient.from('owners').insert(defaultOwners);
            if (insertError) throw insertError;
            console.log("Default building owner mappings seeded successfully!");
        }
    } catch (e) {
        console.error("ensureOwnersPopulated error:", e);
    }
}

// Load dropdown flats from Supabase owners registry
async function loadFlats() {
    if (!sbClient) return;
    try {
        const { data, error } = await sbClient.from('owners').select('flat_no, owner_name').order('flat_no');
        if (error) throw error;
        
        const flatSelect = document.getElementById("inc-flat");
        const histFlat = document.getElementById("hist-flat");
        
        const currentVal = flatSelect ? flatSelect.value : "";
        const currentHistVal = histFlat ? histFlat.value : "ALL";
        
        if (flatSelect) {
            flatSelect.innerHTML = '<option value="" disabled selected>Select Room & Tenant</option>';
            data.forEach(item => {
                const opt = document.createElement("option");
                const label = `${item.flat_no} - ${item.owner_name}`;
                opt.value = label;
                opt.textContent = label;
                flatSelect.appendChild(opt);
            });
            if (currentVal && data.some(item => `${item.flat_no} - ${item.owner_name}` === currentVal)) {
                flatSelect.value = currentVal;
            }
        }
        
        if (histFlat) {
            histFlat.innerHTML = '<option value="ALL">All Flats</option>';
            data.forEach(item => {
                const opt = document.createElement("option");
                opt.value = item.flat_no;
                opt.textContent = `${item.flat_no} - ${item.owner_name}`;
                histFlat.appendChild(opt);
            });
            histFlat.value = currentHistVal;
        }

        const ticketFlat = document.getElementById("ticket-flat");
        if (ticketFlat) {
            ticketFlat.innerHTML = '<option value="" disabled selected>Select Your Flat</option>';
            const isSoftLogin = localStorage.getItem("isSoftLogin") === "true";
            const softLoginFlatNo = localStorage.getItem("currentFlatNo");
            
            data.forEach(item => {
                if (isSoftLogin && item.flat_no !== softLoginFlatNo) {
                    return; // Skip flats that do not match the soft login
                }
                const opt = document.createElement("option");
                opt.value = item.flat_no;
                opt.textContent = `${item.flat_no} - ${item.owner_name}`;
                if (isSoftLogin && item.flat_no === softLoginFlatNo) {
                    opt.selected = true;
                }
                ticketFlat.appendChild(opt);
            });
            
            if (isSoftLogin) {
                const placeholder = ticketFlat.querySelector('option[value=""]');
                if (placeholder) placeholder.remove();
            }
        }
    } catch (err) {
        console.error("loadFlats registry error:", err);
        showToast("Could not load owners registry list.", "error");
    }
}

// Refresh dashboard stats and statements list
async function refreshDashboard() {
    if (!sbClient) return;
    
    const year = document.getElementById("filter-year").value;
    const month = document.getElementById("filter-month").value;

    try {
        const { data: incomeData, error: incErr } = await sbClient.from('income')
            .select('id, flat_no, year, month, amount, date_received, category, event_name, remarks')
            .eq('year', year)
            .eq('month', month);
        if (incErr) throw incErr;
        
        const { data: expenseData, error: expErr } = await sbClient.from('expenses')
            .select('id, year, month, expense_head, description, amount, date_spent')
            .eq('year', year)
            .eq('month', month);
        if (expErr) throw expErr;
        
        const totalIncome = incomeData.reduce((sum, item) => sum + parseFloat(item.amount), 0.0);
        const totalExpense = expenseData.reduce((sum, item) => sum + parseFloat(item.amount), 0.0);
        const cashInHand = totalIncome - totalExpense;
        
        // Update KPIs
        document.getElementById("stat-income").textContent = formatCurrency(totalIncome);
        document.getElementById("stat-expense").textContent = formatCurrency(totalExpense);
        document.getElementById("stat-cash").textContent = formatCurrency(cashInHand);

        const entries = [];
        
        incomeData.forEach(r => {
            let desc = `Flat ${r.flat_no} Maintenance Fee`;
            if (r.category === 'Special Event') {
                desc = `Flat ${r.flat_no} ${r.event_name} Subscription`;
            } else if (r.category === 'Other') {
                desc = `Flat ${r.flat_no} Other - ${r.remarks || 'Misc'}`;
            }
            entries.push({
                id: r.id,
                type: "INCOME",
                description: desc,
                year: r.year,
                month: r.month,
                amount: parseFloat(r.amount),
                date: r.date_received
            });
        });
        
        expenseData.forEach(r => {
            entries.push({
                id: r.id,
                type: "EXPENSE",
                description: `${r.expense_head}: ${r.description}`,
                year: r.year,
                month: r.month,
                amount: parseFloat(r.amount),
                date: r.date_spent
            });
        });
        
        entries.sort((a, b) => b.date.localeCompare(a.date));
        loadedEntries = entries;
        
        renderTable(loadedEntries);
        
        const exportBtn = document.getElementById("btn-export");
        if (exportBtn) {
            exportBtn.removeAttribute("href");
            exportBtn.onclick = (e) => {
                e.preventDefault();
                exportLedgerToExcel();
            };
        }

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
    if (!tbody) return;
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

        const deleteButton = currentUserRole === "admin"
            ? `<button class="btn-delete" title="Delete entry" onclick="deleteEntry('${entry.type}', ${entry.id}, '${entry.description.replace(/'/g, "\\'").replace(/"/g, "&quot;")}')">
                    <i class="fa-solid fa-trash-can"></i>
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
            <td class="text-center">${formatDateDisplay(entry.date)}</td>
            <td class="text-center">
                ${actions}
                ${deleteButton}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Client-side local filtering in ledger table
window.filterTable = function() {
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
};

// Handle income form submission
window.handleIncomeSubmit = async function(e) {
    e.preventDefault();
    if (!sbClient) {
        showToast("Database not connected.", "error");
        return;
    }
    
    if (currentUserRole !== 'admin' && currentUserRole !== 'editor') {
        showToast("Access Denied: Only Admins and Editors can record entries.", "error");
        return;
    }
    
    const flat = document.getElementById("inc-flat").value;
    const category = document.getElementById("inc-category").value;
    const eventName = document.getElementById("inc-event") ? document.getElementById("inc-event").value.trim() : "";
    const remarks = document.getElementById("inc-remarks") ? document.getElementById("inc-remarks").value.trim() : "";
    const year = document.getElementById("inc-year").value;
    const month = document.getElementById("inc-month").value;
    const amount = document.getElementById("inc-amount").value;
    const date = document.getElementById("inc-date").value;

    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;

    if (!flat || flat === "Select Room & Tenant" || !amount || !date) {
        showToast("Please fill out all fields.", "error");
        btn.disabled = false;
        return;
    }

    try {
        const flatNo = flat.split(" - ")[0].trim();
        const amtVal = parseFloat(amount);
        if (isNaN(amtVal)) throw new Error("Amount must be a valid number.");

        const { data, error } = await sbClient.from('income').insert({
            flat_no: flatNo,
            year: year,
            month: month,
            amount: amtVal,
            date_received: date,
            category: category,
            event_name: category === "Special Event" ? eventName : null,
            remarks: remarks || null
        }).select('id').single();
        
        if (error) throw error;
        
        showToast(`Payment logged for Flat ${flatNo}`, "success", {
            text: '<i class="fa-solid fa-file-pdf"></i> Receipt',
            callback: () => generateReceipt(data.id)
        });
        
        document.getElementById("inc-amount").value = "";
        if (document.getElementById("inc-event")) document.getElementById("inc-event").value = "";
        if (document.getElementById("inc-remarks")) document.getElementById("inc-remarks").value = "";
        document.getElementById("inc-category").value = "Monthly Maintenance";
        toggleEventNameField("Monthly Maintenance");
        
        closeModal('incomeModal');
        refreshDashboard();
    } catch (err) {
        showToast(err.message || "Failed to log income", "error");
    } finally {
        btn.disabled = false;
    }
};

// Handle expense form submission
window.handleExpenseSubmit = async function(e) {
    e.preventDefault();
    if (!sbClient) {
        showToast("Database not connected.", "error");
        return;
    }
    
    if (currentUserRole !== 'admin' && currentUserRole !== 'editor') {
        showToast("Access Denied: Only Admins and Editors can record entries.", "error");
        return;
    }
    
    const year = document.getElementById("exp-year").value;
    const month = document.getElementById("exp-month").value;
    const head = document.getElementById("exp-head").value;
    const desc = document.getElementById("exp-desc").value.trim();
    const amount = document.getElementById("exp-amount").value;
    const date = document.getElementById("exp-date").value;

    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;

    if (!head || !desc || !amount || !date) {
        showToast("Please fill out all fields.", "error");
        btn.disabled = false;
        return;
    }

    try {
        const amtVal = parseFloat(amount);
        if (isNaN(amtVal)) throw new Error("Amount must be a valid number.");

        const { error } = await sbClient.from('expenses').insert({
            year: year,
            month: month,
            expense_head: head,
            description: desc,
            amount: amtVal,
            date_spent: date
        });
        
        if (error) throw error;
        
        showToast(`Expense saved: ${desc}`);
        document.getElementById("exp-desc").value = "";
        document.getElementById("exp-amount").value = "";
        closeModal('expenseModal');
        refreshDashboard();
    } catch (err) {
        showToast(err.message || "Failed to log expense", "error");
    } finally {
        btn.disabled = false;
    }
};

// Toggle event name field based on category choice
window.toggleEventNameField = function(val) {
    const field = document.getElementById("inc-event-field");
    const input = document.getElementById("inc-event");
    if (!field) return;
    if (val === "Special Event") {
        field.classList.remove("hidden");
        if (input) input.required = true;
    } else {
        field.classList.add("hidden");
        if (input) {
            input.required = false;
            input.value = "";
        }
    }
};

// --- DYNAMIC EXPENSE HEADS ---
async function loadExpenseHeads() {
    if (!sbClient) return;
    try {
        const { data, error } = await sbClient.from('expense_heads').select('id, name').order('name');
        if (error) throw error;
        
        // Populate select in Expense modal
        const expHeadSelect = document.getElementById("exp-head");
        if (expHeadSelect) {
            const currentVal = expHeadSelect.value;
            expHeadSelect.innerHTML = '<option value="" disabled selected>Select Category / Head</option>';
            data.forEach(item => {
                const opt = document.createElement("option");
                opt.value = item.name;
                opt.textContent = item.name;
                expHeadSelect.appendChild(opt);
            });
            if (currentVal && data.some(item => item.name === currentVal)) {
                expHeadSelect.value = currentVal;
            }
        }
        
        // Populate category manager list inside the modal
        const managerList = document.getElementById("category-manager-list");
        if (managerList) {
            managerList.innerHTML = "";
            if (data.length === 0) {
                managerList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 10px;">No custom expense heads defined.</div>`;
            } else {
                data.forEach(item => {
                    const div = document.createElement("div");
                    div.className = "category-item";
                    
                    const deleteBtn = currentUserRole === 'admin'
                        ? `<button class="btn-delete" title="Delete category" onclick="handleDeleteExpenseHead(${item.id}, '${item.name.replace(/'/g, "\\'")}')">
                               <i class="fa-solid fa-trash-can"></i>
                           </button>`
                        : '';
                    
                    div.innerHTML = `
                        <span>${item.name}</span>
                        ${deleteBtn}
                    `;
                    managerList.appendChild(div);
                });
            }
        }
    } catch (err) {
        console.error("loadExpenseHeads error:", err);
        showToast("Could not load expense categories.", "error");
    }
}

window.openExpenseHeadsModal = function() {
    // Show add-head-form only to admin
    const addForm = document.getElementById("add-head-form");
    if (addForm) {
        addForm.style.display = currentUserRole === 'admin' ? 'flex' : 'none';
    }
    loadExpenseHeads();
    openModal('expenseHeadsModal');
};

window.handleAddExpenseHead = async function(e) {
    e.preventDefault();
    if (!sbClient) return;
    if (currentUserRole !== 'admin') {
        showToast("Access Denied: Only Admins can add expense categories.", "error");
        return;
    }
    const input = document.getElementById("new-head-name");
    const name = input.value.trim();
    if (!name) return;
    
    try {
        const { error } = await sbClient.from('expense_heads').insert({ name: name });
        if (error) {
            if (error.code === '23505') {
                throw new Error("Category already exists.");
            }
            throw error;
        }
        showToast(`Category "${name}" added successfully.`, "success");
        input.value = "";
        loadExpenseHeads();
    } catch (err) {
        showToast(err.message || "Failed to add category.", "error");
    }
};

window.handleDeleteExpenseHead = async function(id, name) {
    if (!sbClient) return;
    if (currentUserRole !== 'admin') {
        showToast("Access Denied: Only Admins can delete expense categories.", "error");
        return;
    }
    
    if (!confirm(`Are you sure you want to delete the category "${name}"?\nNote: Existing expenses using this head will remain, but this category option will be removed.`)) {
        return;
    }
    
    try {
        const { error } = await sbClient.from('expense_heads').delete().eq('id', id);
        if (error) throw error;
        showToast(`Category "${name}" deleted.`, "success");
        loadExpenseHeads();
    } catch (err) {
        showToast(err.message || "Failed to delete category.", "error");
    }
};

// --- OWNERS & RESIDENTS DIRECTORY (CRM) ---
let allOwnersData = [];

window.openOwnersDirectoryModal = function() {
    openModal('ownersDirectoryModal');
    loadOwnersDirectory();
};

window.loadOwnersDirectory = async function(filterText = "") {
    if (!sbClient) return;
    
    const grid = document.getElementById("flats-grid");
    if (!grid) return;
    
    if (!filterText) {
        grid.innerHTML = `<div style="grid-column: span 3; text-align: center; color: var(--text-secondary); padding: 20px;"><i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i>Loading flats...</div>`;
    }
    
    try {
        let { data, error } = await sbClient.from('owners').select('*').order('flat_no');
        if (error) throw error;
        
        allOwnersData = data || [];
        renderOwnersGrid(allOwnersData, filterText);
    } catch (err) {
        console.error("loadOwnersDirectory error:", err);
        showToast("Failed to load owners directory.", "error");
    }
};

function renderOwnersGrid(data, filterText = "", floorText = "") {
    const grid = document.getElementById("flats-grid");
    if (!grid) return;
    grid.innerHTML = "";
    
    // Find individual flats that are part of combined flats
    const combinedFlatsSet = new Set();
    data.forEach(item => {
        if (item.flat_no && item.flat_no.includes('+')) {
            const parts = item.flat_no.split('+').map(p => p.trim());
            parts.forEach(p => combinedFlatsSet.add(p));
        }
    });
    
    const query = filterText.trim().toLowerCase();
    const filtered = data.filter(item => {
        // Skip individual flats that have been merged into a combined flat (e.g. 1F and 1H when 1F+1H exists)
        if (combinedFlatsSet.has(item.flat_no)) return false;
        
        const matchesQuery = item.flat_no.toLowerCase().includes(query) || 
               item.owner_name.toLowerCase().includes(query) || 
               (item.contact_no && item.contact_no.includes(query)) ||
               (item.parking_no && item.parking_no.toLowerCase().includes(query));
        
        const matchesFloor = floorText === "" || item.flat_no.startsWith(floorText);
        
        return matchesQuery && matchesFloor;
    });
    
    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column: span 3; text-align: center; color: var(--text-muted); padding: 20px;">No matching flats found.</div>`;
        return;
    }
    
    filtered.forEach(item => {
        const card = document.createElement("div");
        card.className = "flat-card";
        card.dataset.flatNo = item.flat_no;
        card.onclick = () => selectFlatForEdit(item.flat_no);
        
        let statusText = "Owner";
        if (item.occupancy_status === 'tenant-occupied') statusText = "Tenant";
        else if (item.occupancy_status === 'vacant') statusText = "Vacant";
        
        card.innerHTML = `
            <h4>${item.flat_no}</h4>
            <p style="font-weight: 600;">${item.owner_name}</p>
            <span class="badge ${item.occupancy_status === 'vacant' ? 'badge-expense' : 'badge-income'}" style="font-size: 0.6rem; padding: 1px 6px;">${statusText}</span>
        `;
        grid.appendChild(card);
    });
}

window.filterOwnersDirectory = function() {
    const query = document.getElementById("directory-search").value;
    const floor = document.getElementById("directory-floor-filter") ? document.getElementById("directory-floor-filter").value : "";
    renderOwnersGrid(allOwnersData, query, floor);
};

window.selectFlatForEdit = function(flatNo) {
    document.querySelectorAll(".flat-card").forEach(card => {
        if (card.dataset.flatNo === flatNo) {
            card.classList.add("active");
        } else {
            card.classList.remove("active");
        }
    });
    
    const item = allOwnersData.find(o => o.flat_no === flatNo);
    const detailSide = document.getElementById("directory-detail-side");
    if (!detailSide || !item) return;
    
    const isAdmin = currentUserRole === 'admin';
    const isOwnFlat = localStorage.getItem("isSoftLogin") === "true" && localStorage.getItem("currentFlatNo") === flatNo;
    const canEdit = isAdmin || isOwnFlat;
    const disabledAttr = canEdit ? "" : "disabled";
    
    const statusOptions = [
        { value: 'owner-occupied', label: 'Owner Occupied' },
        { value: 'tenant-occupied', label: 'Tenant Occupied' },
        { value: 'vacant', label: 'Vacant' }
    ];
    
    let selectHTML = `<select id="edit-status" ${disabledAttr}>`;
    statusOptions.forEach(opt => {
        const selected = opt.value === item.occupancy_status ? "selected" : "";
        selectHTML += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
    });
    selectHTML += `</select>`;
    
    detailSide.innerHTML = `
        <div class="card" style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; margin-bottom: 16px;">
                <h3 style="font-size: 1.2rem; font-weight: 700; color: var(--color-indigo);">Flat ${item.flat_no} Details</h3>
                <span class="badge ${item.occupancy_status === 'vacant' ? 'badge-expense' : 'badge-income'}">${item.occupancy_status.replace('-', ' ')}</span>
            </div>
            
            <form id="edit-owner-form" onsubmit="saveOwnerProfile(event)">
                <input type="hidden" id="edit-flat-no" value="${item.flat_no}">
                
                <div class="input-field">
                    <label for="edit-owner-name">Owner Name</label>
                    <input type="text" id="edit-owner-name" value="${item.owner_name || ''}" ${disabledAttr} required>
                </div>
                
                <div class="input-field">
                    <label for="edit-contact">Contact No</label>
                    <input type="text" id="edit-contact" value="${item.contact_no || ''}" ${disabledAttr}>
                </div>
                
                ${canEdit ? `
                <div class="input-field">
                    <label for="edit-passcode">Passcode (For Soft Login)</label>
                    <input type="text" id="edit-passcode" placeholder="e.g. 1234" value="${item.passcode || ''}" ${disabledAttr}>
                </div>
                ` : ''}
                
                <div class="grid-two-cols">
                    <div class="input-field">
                        <label for="edit-parking">Parking Space No</label>
                        <input type="text" id="edit-parking" value="${item.parking_no || 'None'}" ${disabledAttr}>
                    </div>
                    <div class="input-field">
                        <label for="edit-mc-rate">Monthly MC Rate (Rs.)</label>
                        <input type="number" step="0.01" id="edit-mc-rate" value="${item.monthly_mc_rate || 1000.00}" ${disabledAttr} required>
                    </div>
                </div>
                
                <div class="input-field">
                    <label for="edit-status">Occupancy Status</label>
                    ${selectHTML}
                </div>
                
                <div class="input-field">
                    <label for="edit-family">Family Members Details</label>
                    <textarea id="edit-family" rows="3" placeholder="e.g. Spouse, Son (12), Daughter (8)" style="background-color: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); color: var(--text-primary); padding: 10px; font-family: inherit; font-size: 0.9rem; resize: vertical;" ${disabledAttr}>${item.family_members || ''}</textarea>
                </div>
                
                <div class="input-field">
                    <label for="edit-combined">Combined Flat No(s)</label>
                    <input type="text" id="edit-combined" placeholder="e.g. 1B (leave empty if none)" value="${item.combined_flat_nos || ''}" ${disabledAttr}>
                </div>
                
                ${canEdit 
                    ? `<div class="modal-actions" style="margin-top: 16px;">
                            <button type="submit" class="btn btn-indigo" style="width: 100%;">
                                <i class="fa-solid fa-floppy-disk"></i> Save Profile
                            </button>
                       </div>`
                    : `<div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; margin-top: 10px;">
                            <i class="fa-solid fa-lock"></i> Edit restricted to Owner or Administrators.
                       </div>`
                }
            </form>
        </div>
    `;
};

window.saveOwnerProfile = async function(e) {
    e.preventDefault();
    if (!sbClient) return;
    const flatNo = document.getElementById("edit-flat-no").value;
    const isOwnFlat = localStorage.getItem("isSoftLogin") === "true" && localStorage.getItem("currentFlatNo") === flatNo;
    
    if (currentUserRole !== 'admin' && !isOwnFlat) {
        showToast("Access Denied: Only Admins or the flat owner can save profiles.", "error");
        return;
    }
    
    const ownerName = document.getElementById("edit-owner-name").value.trim();
    const contactNo = document.getElementById("edit-contact").value.trim();
    
    const passcodeInput = document.getElementById("edit-passcode");
    let passcode = undefined;
    if (passcodeInput) {
        const passcodeVal = passcodeInput.value.trim();
        passcode = passcodeVal ? parseInt(passcodeVal) : null;
    }
    const parkingNo = document.getElementById("edit-parking").value.trim();
    const mcRate = parseFloat(document.getElementById("edit-mc-rate").value);
    const status = document.getElementById("edit-status").value;
    const family = document.getElementById("edit-family").value.trim();
    const combined = document.getElementById("edit-combined").value.trim();
    
    const submitBtn = e.target.querySelector("button[type=submit]");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving...";
    }
    
    try {
        const updateData = {
            owner_name: ownerName,
            contact_no: contactNo,
            parking_no: parkingNo,
            monthly_mc_rate: mcRate,
            occupancy_status: status,
            family_members: family,
            combined_flat_nos: combined
        };
        
        if (passcode !== undefined) {
            updateData.passcode = passcode;
        }

        const { error } = await sbClient.from('owners').update(updateData).eq('flat_no', flatNo);
        
        if (error) throw error;
        
        showToast(`Profile for Flat ${flatNo} updated!`, "success");
        
        await loadOwnersDirectory();
        selectFlatForEdit(flatNo);
        loadFlats();
    } catch (err) {
        console.error("saveOwnerProfile error:", err);
        showToast(err.message || "Failed to update profile.", "error");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Profile';
        }
    }
};

// Delete entry logic
window.deleteEntry = async function(type, id, desc) {
    if (!sbClient) {
        showToast("Database not connected.", "error");
        return;
    }
    
    if (currentUserRole !== 'admin') {
        showToast("Access Denied: Only Admins can delete entries.", "error");
        return;
    }
    
    if (!confirm(`Are you sure you want to permanently delete this entry?\n\n"${desc}"`)) {
        return;
    }

    try {
        const table = type === "INCOME" ? "income" : "expenses";
        const { error } = await sbClient.from(table).delete().eq('id', id);
        if (error) throw error;
        
        showToast("Entry removed successfully.");
        refreshDashboard();
    } catch (err) {
        showToast(err.message || "Deletion failed", "error");
    }
};

// Modal handling
window.openModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = "block";
};

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.style.display = "none";
    
    const form = modal.querySelector("form");
    if (form) {
        form.reset();
        const dropzoneText = form.querySelector(".dropzone-text");
        if (dropzoneText) {
            if (modalId === "importModal") {
                dropzoneText.textContent = "Click or drag Excel file here";
            } else {
                dropzoneText.textContent = "Click or drag owners.xlsx file here";
            }
            dropzoneText.style.color = "var(--text-secondary)";
        }
    }
};

// Update file upload dropzone text labels when a file is selected
window.updateDropzoneText = function(input) {
    const label = input.parentElement.querySelector(".dropzone-text");
    if (input.files && input.files[0] && label) {
        label.textContent = `Selected: ${input.files[0].name}`;
        label.style.color = "var(--color-emerald)";
    }
};

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal') && event.target.id !== 'auth-container') {
        closeModal(event.target.id);
    }
};

// Fetch building logo image and encode as base64
async function getLogoBase64() {
    try {
        const res = await fetch('/static/logo.png');
        if (!res.ok) return null;
        const blob = await res.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error("Failed to load logo image:", e);
        return null;
    }
}

// Generate Receipt PDF inside browser client using jsPDF
window.generateReceipt = async function(entryId) {
    if (!sbClient) {
        showToast("Database not connected.", "error");
        return;
    }
    
    try {
        showToast("Fetching receipt details...", "success");
        
        // Fetch income record
        const { data, error } = await sbClient.from('income').select('id, flat_no, year, month, amount, date_received, category, event_name, remarks').eq('id', entryId).single();
        if (error || !data) throw new Error("Receipt data not found.");
        
        // Fetch owner name
        const { data: ownerData } = await sbClient.from('owners').select('owner_name').eq('flat_no', data.flat_no).single();
        const ownerName = ownerData ? ownerData.owner_name : `Flat ${data.flat_no}`;
        
        let receiptYear = data.year;
        try {
            const yInt = parseInt(data.year.substring(0, 4), 10);
            receiptYear = `${yInt}-${String(yInt + 1).substring(2)}`;
        } catch (e) {}
        
        const receiptId = `DR-${receiptYear}-${String(data.id).padStart(4, '0')}`;
        
        // Initialize jsPDF (Landscape A5 layout)
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a5'
        });
        
        // Outer thin border
        doc.setDrawColor(15, 23, 42); // slate 900
        doc.setLineWidth(0.3);
        doc.rect(5, 5, 200, 138);
        
        // Inner thicker border
        doc.setDrawColor(2, 132, 199); // sky 600
        doc.setLineWidth(0.6);
        doc.rect(7, 7, 196, 134);
        
        // Watermark background
        doc.setTextColor(248, 250, 252); // slate 50
        doc.setFont("helvetica", "bold");
        doc.setFontSize(28);
        doc.text("DEEPSIKHA RESIDENCY", 105, 74, { align: "center", angle: 15 });
        
        // Load logo
        const logoBase64 = await getLogoBase64();
        if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', 12, 12, 18, 18);
        } else {
            doc.setDrawColor(148, 163, 184);
            doc.rect(12, 12, 18, 18);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text("LOGO", 21, 22, { align: "center" });
        }
        
        // Heading details
        doc.setTextColor(15, 23, 42); // slate 900
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("DEEPSIKHA RESIDENCY (BLOCK - 2)", 34, 17);
        
        doc.setTextColor(71, 85, 105); // slate 600
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Flat Owners Association", 34, 22);
        doc.text("Deepsikha Residency, Block 2, Flat 1-8 A-H, Asansol", 34, 26);
        
        // Header separator line
        doc.setDrawColor(203, 213, 225); // slate 300
        doc.setLineWidth(0.4);
        doc.line(10, 32, 200, 32);
        
        // Receipt Header
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("MONEY RECEIPT", 12, 40);
        
        // Metadata fields
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("Receipt No:", 140, 40);
        doc.text("Date:", 140, 45);
        
        doc.setFont("helvetica", "normal");
        doc.text(receiptId, 160, 40);
        doc.text(formatDateDisplay(data.date_received), 160, 45);
        
        // Receipt details box
        doc.setFillColor(248, 250, 252); // slate 50
        doc.rect(12, 50, 186, 22, "F");
        doc.setDrawColor(226, 232, 240); // slate 200
        doc.setLineWidth(0.3);
        doc.rect(12, 50, 186, 22);
        
        // Received From details
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85); // slate 700
        doc.text("Received From:", 16, 56);
        doc.text("For Period:", 16, 66);
        
        doc.setFont("helvetica", "normal");
        doc.setTextColor(15, 23, 42);
        doc.text(ownerName, 42, 56);
        doc.text(`${data.month} ${data.year}`, 42, 66);
        
        // Right side of details box
        doc.setFont("helvetica", "bold");
        doc.setTextColor(51, 65, 85);
        doc.text("Flat No:", 120, 56);
        doc.text("Purpose:", 120, 66);
        
        doc.setFont("helvetica", "normal");
        doc.setTextColor(15, 23, 42);
        doc.text(data.flat_no, 138, 56);
        
        let purposeText = "Maintenance Charge Collection";
        if (data.category === "Special Event") {
            purposeText = `${data.event_name} Subscription`;
        } else if (data.category === "Other") {
            purposeText = data.remarks || "Other Collection";
        }
        doc.text(purposeText, 138, 66);
        
        // Totals & Words
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text("Total Paid:", 12, 84);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(5, 150, 105); // emerald 600
        doc.text(`Rs. ${data.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 34, 84);
        
        // Words text
        const amtWords = numberToWords(data.amount);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
        doc.text("Amount in Words:", 12, 94);
        
        doc.setFont("helvetica", "oblique");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        const splitWords = doc.splitTextToSize(amtWords, 115);
        doc.text(splitWords, 12, 99);
        
        // Remarks
        if (data.remarks && data.category !== "Other") {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(51, 65, 85);
            doc.text("Remarks:", 12, 112);
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105);
            const splitRemarks = doc.splitTextToSize(data.remarks, 115);
            doc.text(splitRemarks, 12, 117);
        }
        
        // Signature Line
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.line(140, 94, 185, 94);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text("Authorized Signatory", 162.5, 98, { align: "center" });
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text("Deepsikha Residency", 162.5, 102, { align: "center" });
        
        const pdfDataUri = doc.output('datauristring');
        const newTab = window.open();
        if (newTab) {
            newTab.document.write(`<iframe width='100%' height='100%' src='${pdfDataUri}'></iframe>`);
        } else {
            doc.save(`Receipt_${receiptId}.pdf`);
            showToast("Receipt downloaded (new window blocked).");
        }
        
    } catch (err) {
        console.error("Receipt generation failed:", err);
        showToast(err.message || "Failed to generate receipt PDF.", "error");
    }
};

// Open History Modal and populate its flat selections
window.openHistoryModal = async function() {
    openModal('historyModal');
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const todayStr = now.toISOString().split('T')[0];
    const startOfYearStr = `${currentYear}-01-01`;
    
    const startDateInput = document.getElementById("hist-start-date");
    const endDateInput = document.getElementById("hist-end-date");
    if (startDateInput) startDateInput.value = startOfYearStr;
    if (endDateInput) endDateInput.value = todayStr;
    
    await loadFlats();
    fetchHistory();
};

// Fetch history records via Supabase
window.fetchHistory = async function() {
    if (!sbClient) return;
    
    const type = document.getElementById("hist-type").value;
    let flat = document.getElementById("hist-flat").value;
    const year = document.getElementById("hist-year").value;
    const month = document.getElementById("hist-month").value;
    const startDate = document.getElementById("hist-start-date").value;
    const endDate = document.getElementById("hist-end-date").value;
    const search = document.getElementById("hist-search").value.trim().toLowerCase();
    
    if (flat && flat.includes(" - ")) {
        flat = flat.split(" - ")[0].trim();
    }
    if (flat === "ALL") {
        flat = "";
    }
    
    try {
        const entries = [];
        
        const { data: owners } = await sbClient.from('owners').select('flat_no, owner_name');
        const ownersMap = {};
        if (owners) {
            owners.forEach(o => {
                ownersMap[o.flat_no] = o.owner_name;
            });
        }
        
        if (type === 'ALL' || type === 'INCOME') {
            let q = sbClient.from('income').select('id, flat_no, year, month, amount, date_received, category, event_name, remarks');
            
            if (flat) {
                q = q.eq('flat_no', flat);
            }
            if (year && year !== "ALL") {
                q = q.eq('year', year);
            }
            if (month && month !== "ALL") {
                q = q.eq('month', month);
            }
            if (startDate) {
                q = q.gte('date_received', startDate);
            }
            if (endDate) {
                q = q.lte('date_received', endDate);
            }
            
            const { data: incData, error: incErr } = await q;
            if (incErr) throw incErr;
            
            incData.forEach(r => {
                const ownerName = ownersMap[r.flat_no] || `Flat ${r.flat_no}`;
                let description = `Flat ${r.flat_no} Maintenance Fee`;
                if (r.category === 'Special Event') {
                    description = `Flat ${r.flat_no} ${r.event_name} Subscription`;
                } else if (r.category === 'Other') {
                    description = `Flat ${r.flat_no} Other - ${r.remarks || 'Misc'}`;
                }
                const amountStr = String(r.amount);
                
                let matchesSearch = true;
                if (search) {
                    matchesSearch = description.toLowerCase().includes(search) ||
                                    ownerName.toLowerCase().includes(search) ||
                                    amountStr.includes(search) ||
                                    r.date_received.includes(search) ||
                                    r.month.toLowerCase().includes(search) ||
                                    r.year.includes(search);
                }
                
                if (matchesSearch) {
                    entries.push({
                        id: r.id,
                        type: "INCOME",
                        flat_no: r.flat_no,
                        owner_name: ownerName,
                        description: description,
                        year: r.year,
                        month: r.month,
                        amount: parseFloat(r.amount),
                        date: r.date_received
                    });
                }
            });
        }
        
        if ((type === 'ALL' || type === 'EXPENSE') && !flat) {
            let q = sbClient.from('expenses').select('id, year, month, expense_head, description, amount, date_spent');
            
            if (year && year !== "ALL") {
                q = q.eq('year', year);
            }
            if (month && month !== "ALL") {
                q = q.eq('month', month);
            }
            if (startDate) {
                q = q.gte('date_spent', startDate);
            }
            if (endDate) {
                q = q.lte('date_spent', endDate);
            }
            
            const { data: expData, error: expErr } = await q;
            if (expErr) throw expErr;
            
            expData.forEach(r => {
                const amountStr = String(r.amount);
                const fullDesc = `${r.expense_head}: ${r.description}`;
                let matchesSearch = true;
                if (search) {
                    matchesSearch = fullDesc.toLowerCase().includes(search) ||
                                    amountStr.includes(search) ||
                                    r.date_spent.includes(search) ||
                                    r.month.toLowerCase().includes(search) ||
                                    r.year.includes(search);
                }
                
                if (matchesSearch) {
                    entries.push({
                        id: r.id,
                        type: "EXPENSE",
                        flat_no: "",
                        owner_name: "",
                        description: fullDesc,
                        year: r.year,
                        month: r.month,
                        amount: parseFloat(r.amount),
                        date: r.date_spent
                    });
                }
            });
        }
        
        entries.sort((a, b) => b.date.localeCompare(a.date));
        renderHistoryTable(entries);
    } catch(err) {
        console.error("History search error:", err);
        showToast("Error searching history ledger.", "error");
    }
};

// Render history entries inside the modal table
function renderHistoryTable(entries) {
    const tbody = document.getElementById("history-body");
    const totalEl = document.getElementById("history-total");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    let netTotal = 0;

    if (entries.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center" style="color: var(--text-muted); padding: 30px;">
                    <i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                    No ledger history matches the current filters.
                </td>
            </tr>
        `;
        if (totalEl) totalEl.innerHTML = `₹0.00`;
        return;
    }

    entries.forEach(entry => {
        const tr = document.createElement("tr");
        
        const amt = Number(entry.amount) || 0;
        if (entry.type === "INCOME") {
            netTotal += amt;
        } else {
            netTotal -= amt;
        }
        
        const typeBadge = entry.type === "INCOME" 
            ? `<span class="badge badge-income">Income</span>`
            : `<span class="badge badge-expense">Expense</span>`;

        const receiptBtn = entry.type === "INCOME"
            ? `<button class="btn-receipt" title="Generate PDF Receipt" onclick="generateReceipt(${entry.id})">
                   <i class="fa-solid fa-file-pdf"></i> Receipt
               </button>`
            : '';

        const deleteButton = currentUserRole === "admin"
            ? `<button class="btn-delete" title="Delete entry" onclick="deleteHistoryEntry('${entry.type}', ${entry.id}, '${entry.description.replace(/'/g, "\\'").replace(/"/g, "&quot;")}')">
                    <i class="fa-solid fa-trash-can"></i>
               </button>`
            : '';

        tr.innerHTML = `
            <td>${formatDateDisplay(entry.date)}</td>
            <td>${typeBadge}</td>
            <td><strong>${entry.description}</strong></td>
            <td class="text-right ${entry.type === "INCOME" ? "icon-emerald" : "icon-rose"}" style="font-weight: 600;">
                ${entry.type === "INCOME" ? "+" : "-"} ${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </td>
            <td class="text-center">
                ${receiptBtn}
                ${deleteButton}
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    if (totalEl) {
        const sign = netTotal >= 0 ? "+" : "-";
        const colorClass = netTotal >= 0 ? "icon-emerald" : "icon-rose";
        totalEl.className = `text-right ${colorClass}`;
        totalEl.innerHTML = `${sign} ₹${Math.abs(netTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    }
}

// Delete entry in history and reload history list + main dashboard
window.deleteHistoryEntry = async function(type, id, desc) {
    if (!sbClient) {
        showToast("Database not connected.", "error");
        return;
    }
    
    if (currentUserRole !== 'admin') {
        showToast("Access Denied: Only Admins can delete entries.", "error");
        return;
    }

    if (!confirm(`Are you sure you want to permanently delete this entry from history?\n\n"${desc}"`)) {
        return;
    }

    try {
        const table = type === "INCOME" ? "income" : "expenses";
        const { error } = await sbClient.from(table).delete().eq('id', id);
        if (error) throw error;
        
        showToast("Entry removed successfully.");
        fetchHistory();
        refreshDashboard();
    } catch (err) {
        showToast(err.message || "Deletion failed", "error");
    }
};

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
    activeReportTab = tabId;
    
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
        if (activeReportTab === 'date-wise-cashbook') {
            const startDate = document.getElementById("rep-start-date").value;
            const endDate = document.getElementById("rep-end-date").value;
            if (!startDate || !endDate) {
                sheet.innerHTML = `<div class="text-center" style="padding: 30px; color: #e11d48;">Please select both Start and End dates.</div>`;
                return;
            }
            const data = await getCashbookDatewise(startDate, endDate);
            renderDateWiseCashbook(data);
        } else if (activeReportTab === 'month-wise-cashbook') {
            const year = document.getElementById("rep-year").value;
            const data = await getCashbookMonthwise(year);
            renderMonthWiseCashbook(data);
        } else if (activeReportTab === 'income-expenditure') {
            const year = document.getElementById("rep-year").value;
            const data = await getIncomeExpenditure(year);
            renderIncomeExpenditure(data);
        } else if (activeReportTab === 'helpdesk-stats') {
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

function formatDateDisplay(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

// Generate Date-Wise Cash Book calculation via Supabase client
async function getCashbookDatewise(startDate, endDate) {
    const { data: incData, error: incErr } = await sbClient.from('income').select('amount').lt('date_received', startDate);
    if (incErr) throw incErr;
    const incBefore = incData.reduce((sum, item) => sum + parseFloat(item.amount), 0.0);
    
    const { data: expData, error: expErr } = await sbClient.from('expenses').select('amount').lt('date_spent', startDate);
    if (expErr) throw expErr;
    const expBefore = expData.reduce((sum, item) => sum + parseFloat(item.amount), 0.0);
    
    const openingBalance = incBefore - expBefore;
    
    const { data: incomes, error: incRangeErr } = await sbClient.from('income')
        .select('id, flat_no, year, amount, date_received, category, event_name, remarks')
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
    
    const { data: incData, error: incErr } = await sbClient.from('income').select('amount').lt('date_received', startOfYear);
    if (incErr) throw incErr;
    const incBefore = incData.reduce((sum, item) => sum + parseFloat(item.amount), 0.0);
    
    const { data: expData, error: expErr } = await sbClient.from('expenses').select('amount').lt('date_spent', startOfYear);
    if (expErr) throw expErr;
    const expBefore = expData.reduce((sum, item) => sum + parseFloat(item.amount), 0.0);
    
    const openingBalance = incBefore - expBefore;
    
    const { data: incomes, error: incRangeErr } = await sbClient.from('income').select('amount, month').eq('year', year);
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
    const { data: incomes, error: incErr } = await sbClient.from('income').select('flat_no, amount, category, event_name').eq('year', year);
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
            <h2>DEEPSIKHA RESIDENCY (BLOCK - 2)</h2>
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
function numberToWords(number) {
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
        return rawVal.toISOString().split('T')[0];
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
    
    if (currentUserRole !== 'admin') {
        showToast("Access Denied: Only Admins can import ledgers.", "error");
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
            
            const { error: delIncError } = await sbClient.from('income').delete().gt('id', -1);
            if (delIncError) throw delIncError;
            
            const { error: delExpError } = await sbClient.from('expenses').delete().gt('id', -1);
            if (delExpError) throw delExpError;
            
            let importedIncomeCount = 0;
            let importedExpensesCount = 0;
            
            // --- 1. PARSE INCOME SHEET ---
            const incSheet = workbook.Sheets[incomeSheetName];
            const incRows = XLSX.utils.sheet_to_json(incSheet, { header: 1 });
            
            let headerRowIdx = -1;
            for (let r = 0; r < incRows.length; r++) {
                const rowCells = incRows[r].map(v => String(v || '').toUpperCase());
                if (rowCells.includes("FLAT NO.") || rowCells.includes("FLAT NO")) {
                    headerRowIdx = r;
                    break;
                }
            }
            
            if (headerRowIdx !== -1) {
                const columnsRow = incRows[headerRowIdx];
                const dataRows = incRows.slice(headerRowIdx + 1);
                
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
                
                if (flatColIdx !== -1) {
                    const incomeInserts = [];
                    dataRows.forEach(row => {
                        const flatVal = String(row[flatColIdx] || '').trim().toUpperCase().replace(/\s+/g, '');
                        if (!flatVal || flatVal === "NAN" || flatVal.includes("FLOOR") || flatVal.length > 4) {
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
                    
                    if (incomeInserts.length > 0) {
                        const chunkSize = 200;
                        for (let i = 0; i < incomeInserts.length; i += chunkSize) {
                            const chunk = incomeInserts.slice(i, i + chunkSize);
                            const { error: insErr } = await sbClient.from('income').insert(chunk);
                            if (insErr) throw insErr;
                        }
                        importedIncomeCount = incomeInserts.length;
                    }
                }
            }
            
            // --- 2. PARSE EXPENSE SHEET ---
            if (expenseSheetName) {
                const expSheet = workbook.Sheets[expenseSheetName];
                const expRows = XLSX.utils.sheet_to_json(expSheet, { header: 1 });
                
                let expHeaderIdx = -1;
                for (let r = 0; r < expRows.length; r++) {
                    const rowTxt = expRows[r].map(v => String(v || '')).join('').toUpperCase();
                    if (rowTxt.includes("DESCRIPTION")) {
                        expHeaderIdx = r;
                        break;
                    }
                }
                
                if (expHeaderIdx !== -1 && expRows.length > 2) {
                    const dfExpData = expRows.slice(expHeaderIdx + 1);
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
                    
                    const expenseInserts = [];
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
    
    if (currentUserRole !== 'admin') {
        showToast("Access Denied: Only Admins can upload owner mappings.", "error");
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
        
        const { data: incomeData, error: incErr } = await sbClient.from('income').select('id, flat_no, year, month, amount, date_received').order('id');
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
        const filename = `Deepsikha_Ledger_${dateStr}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        showToast("Spreadsheet downloaded successfully!");
    } catch (err) {
        console.error("Export ledger error:", err);
        showToast("Could not export ledger.", "error");
    }
};

// --- SUPPORT HELPDESK & TICKET SYSTEM ---

window.openTicketsModal = async function() {
    openModal('ticketsModal');
    await loadTickets();
};

window.openNewTicketModal = function() {
    openModal('newTicketModal');
    document.getElementById("new-ticket-form").reset();
};

window.setTicketScope = function(scope) {
    ticketScope = scope;
    const btnAll = document.getElementById("scope-btn-all");
    const btnMy = document.getElementById("scope-btn-my");
    if (btnAll) btnAll.classList.toggle("active", scope === 'ALL');
    if (btnMy) btnMy.classList.toggle("active", scope === 'MY');
    filterTickets();
};

window.loadTickets = async function() {
    if (!sbClient) return;
    
    const listContainer = document.getElementById("tickets-list");
    if (listContainer) {
        listContainer.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; color: var(--color-yellow);"></i><p style="margin-top: 8px; font-size: 0.85rem; color: var(--text-secondary);">Loading tickets...</p></div>';
    }
    
    try {
        // Fetch all tickets
        const { data: ticketsData, error: ticketsErr } = await sbClient
            .from('tickets')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (ticketsErr) throw ticketsErr;
        
        // Fetch all profiles
        const { data: profilesData, error: profilesErr } = await sbClient
            .from('profiles')
            .select('id, email, role');
            
        if (profilesErr) throw profilesErr;
        
        const profileMap = {};
        if (profilesData) {
            profilesData.forEach(p => {
                profileMap[p.id] = p;
            });
        }
        
        loadedTickets = (ticketsData || []).map(t => {
            const creator = profileMap[t.created_by];
            const fm = profileMap[t.floor_manager_id];
            const resolver = profileMap[t.resolved_by];
            const assignee = profileMap[t.assigned_to];
            
            const approvals = Array.isArray(t.committee_approvals) ? t.committee_approvals : [];
            const approverEmails = approvals.map(uid => profileMap[uid]?.email || 'Unknown Member');
            
            return {
                ...t,
                creator_email: creator ? creator.email : 'Unknown',
                floor_manager_email: fm ? fm.email : 'Unknown',
                resolver_email: resolver ? resolver.email : 'Unknown',
                assigned_email: assignee ? assignee.email : 'Unassigned',
                approver_emails: approverEmails
            };
        });
        
        // Render KPIs
        calculateAndRenderKPIs();
        
        filterTickets();
        
        // Retain selection if valid
        if (selectedTicketId) {
            const stillExists = loadedTickets.some(t => t.id === selectedTicketId);
            if (stillExists) {
                selectTicket(selectedTicketId);
            } else {
                selectedTicketId = null;
                resetDetailPanel();
            }
        } else {
            resetDetailPanel();
        }
        
    } catch (err) {
        console.error("loadTickets error:", err);
        showToast("Failed to load helpdesk tickets.", "error");
        if (listContainer) {
            listContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--color-rose);"><i class="fa-solid fa-triangle-exclamation"></i><p style="margin-top: 8px; font-size: 0.85rem;">Error loading tickets.</p></div>';
        }
    }
};

function calculateAndRenderKPIs() {
    const openStatuses = ['Pending', 'Recommended', 'Approved', 'Reopened'];
    const resolvedStatuses = ['Resolved', 'Closed'];
    
    let openCount = 0;
    let resolvedCount = 0;
    let totalResolveTimeMs = 0;
    let resolvedWithTimeCount = 0;
    
    loadedTickets.forEach(t => {
        if (openStatuses.includes(t.status)) {
            openCount++;
        } else if (resolvedStatuses.includes(t.status)) {
            resolvedCount++;
        }
        
        // Calculate resolution time
        if (t.resolved_at && t.created_at) {
            const diff = new Date(t.resolved_at) - new Date(t.created_at);
            if (diff > 0) {
                totalResolveTimeMs += diff;
                resolvedWithTimeCount++;
            }
        }
    });
    
    const openEl = document.getElementById("kpi-open-count");
    const resolvedEl = document.getElementById("kpi-resolved-count");
    const avgEl = document.getElementById("kpi-avg-time");
    
    if (openEl) openEl.textContent = openCount;
    if (resolvedEl) resolvedEl.textContent = resolvedCount;
    
    if (avgEl) {
        if (resolvedWithTimeCount > 0) {
            const avgMs = totalResolveTimeMs / resolvedWithTimeCount;
            const avgHours = avgMs / (1000 * 60 * 60);
            if (avgHours < 24) {
                avgEl.textContent = `${avgHours.toFixed(1)}h`;
            } else {
                avgEl.textContent = `${(avgHours / 24).toFixed(1)}d`;
            }
        } else {
            avgEl.textContent = "N/A";
        }
    }
}

function resetDetailPanel() {
    const detailPanel = document.getElementById("tickets-detail-side");
    if (detailPanel) {
        detailPanel.innerHTML = `
            <div class="detail-placeholder">
                <i class="fa-solid fa-clipboard-list" style="font-size: 3.5rem; color: var(--text-muted);"></i>
                <p style="margin-top: 10px;">Select a complaint ticket from the list to view its details and workflow tracking.</p>
            </div>
        `;
    }
}

window.filterTickets = function() {
    const statusFilter = document.getElementById("ticket-filter-status").value;
    const catFilter = document.getElementById("ticket-filter-category").value;
    const searchVal = document.getElementById("ticket-search").value.toLowerCase().trim();
    
    const filtered = loadedTickets.filter(t => {
        // Scope filter
        if (ticketScope === 'MY' && t.created_by !== currentUserId) {
            return false;
        }
        
        // Archiving filter (admins can see archived, standard users don't)
        if (t.archived && currentUserRole !== 'admin') {
            return false;
        }
        
        const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
        const matchesCat = catFilter === 'ALL' || t.category === catFilter;
        
        const text = `${t.ticket_number || ''} ${t.title} ${t.flat_no || ''} ${t.creator_email} ${t.description}`.toLowerCase();
        const matchesSearch = !searchVal || text.includes(searchVal);
        
        return matchesStatus && matchesCat && matchesSearch;
    });
    
    renderTicketsList(filtered);
};

function renderTicketsList(tickets) {
    const listContainer = document.getElementById("tickets-list");
    if (!listContainer) return;
    
    if (tickets.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--text-muted); font-size: 0.9rem;"><i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 8px;"></i><p>No complaints found</p></div>';
        return;
    }
    
    listContainer.innerHTML = '';
    tickets.forEach(t => {
        const card = document.createElement("div");
        card.className = `ticket-card ${t.id === selectedTicketId ? 'active' : ''}`;
        card.onclick = () => selectTicket(t.id);
        
        // Calculate Age
        const createdDate = new Date(t.created_at);
        const diffMs = new Date() - createdDate;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        let ageText = `${diffDays} days open`;
        if (diffDays === 0) ageText = "Filed today";
        
        // SLA check
        const isOverdue = diffDays >= 3 && !['Closed', 'Resolved'].includes(t.status);
        const overdueBadge = isOverdue ? `<span class="sla-overdue-tag"><i class="fa-solid fa-clock"></i> SLA Overdue</span>` : '';
        
        // Priority Badge Class
        const pBadge = getPriorityBadgeClass(t.priority);
        
        card.innerHTML = `
            <div class="ticket-card-header">
                <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted);">${escapeHtml(t.ticket_number || ('#' + t.id))}</span>
                <span class="badge ${getStatusBadgeClass(t.status)}">${t.status}</span>
            </div>
            <h4 style="margin: 4px 0;">${escapeHtml(t.title)}</h4>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin: 4px 0;">
                <span class="badge ${pBadge}" style="font-size:0.7rem; padding: 2px 6px;">${t.priority || 'Medium'}</span>
                ${overdueBadge}
            </div>
            <div class="ticket-card-meta">
                <span><i class="fa-solid fa-door-open"></i> Flat ${escapeHtml(t.flat_no || 'N/A')}</span>
                <span><i class="fa-solid fa-calendar-day"></i> ${ageText}</span>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 'Pending': return 'badge-pending';
        case 'Recommended': return 'badge-recommended';
        case 'Approved': return 'badge-approved';
        case 'Resolved': return 'badge-resolved';
        case 'Closed': return 'badge-closed';
        case 'Reopened': return 'badge-reopened';
        default: return 'badge-pending';
    }
}

function getPriorityBadgeClass(priority) {
    switch (priority) {
        case 'Low': return 'badge-low';
        case 'Medium': return 'badge-medium';
        case 'High': return 'badge-high';
        case 'Urgent': return 'badge-urgent';
        default: return 'badge-medium';
    }
}

window.selectTicket = function(id) {
    const isStateChange = selectedTicketId !== id;
    selectedTicketId = id;
    
    // Re-render list to show active highlight correctly
    filterTickets();
    
    const ticket = loadedTickets.find(t => t.id === id);
    if (!ticket) return;
    
    const detailPanel = document.getElementById("tickets-detail-side");
    if (!detailPanel) return;
    
    // Build Timeline Steps
    const stepsHtml = buildTimelineHtml(ticket);
    
    // Build Actions block
    const actionsHtml = buildActionsHtml(ticket);
    
    // SLA Tracking detail
    const createdDate = new Date(ticket.created_at);
    const diffMs = new Date() - createdDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    let ageDetailText = `${diffDays} days open`;
    if (diffDays === 0) ageDetailText = "Filed today";
    
    const isOverdue = diffDays >= 3 && !['Closed', 'Resolved'].includes(ticket.status);
    const overdueBanner = isOverdue ? 
        `<div style="background: rgba(244,63,94,0.08); border: 1px solid var(--color-rose); color: var(--color-rose); padding: 10px 14px; border-radius: var(--border-radius-sm); font-size: 0.85rem; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-circle-exclamation" style="font-size: 1.1rem;"></i>
            <strong>SLA Warning:</strong> This complaint has been open for ${diffDays} days without resolution (exceeds 3-day SLA limit).
         </div>` : '';
         
    // Render Attachments
    let attachmentsHtml = '';
    const attachments = Array.isArray(ticket.attachments) ? ticket.attachments : [];
    if (attachments.length > 0) {
        attachmentsHtml += `<div style="margin-top: 14px;">
            <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 8px;">Complaint Attachments</h4>
            <div class="comment-attachments">`;
        attachments.forEach(att => {
            if (att.type.startsWith('image/')) {
                attachmentsHtml += `
                    <div class="attachment-thumb" onclick="window.open('${att.data}', '_blank')">
                        <img src="${att.data}" alt="${escapeHtml(att.name)}">
                    </div>`;
            } else {
                attachmentsHtml += `
                    <a href="${att.data}" target="_blank" class="btn btn-slate" style="font-size:0.75rem; padding: 6px 12px; display: inline-flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-file-pdf"></i> ${escapeHtml(att.name)}
                    </a>`;
            }
        });
        attachmentsHtml += `</div></div>`;
    }
    
    // Render Admin assign controls
    let assignHtml = '';
    if (currentUserRole === 'admin') {
        assignHtml = `
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); padding: 12px; margin-bottom: 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <span style="font-size: 0.85rem; font-weight:600;"><i class="fa-solid fa-user-tag"></i> Assign Complaint:</span>
                <select id="assign-ticket-select" onchange="assignTicket(${ticket.id}, this.value)" style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); color: var(--text-primary); padding: 4px 8px; font-size: 0.85rem;">
                    <option value="">-- Select Assignee --</option>
                </select>
            </div>
        `;
        // Fetch profiles async and update options
        fetchAssigneesForDropdown(ticket.assigned_to);
    }
    
    // Render Admin control actions (Archive/Delete)
    let adminControlsHtml = '';
    if (currentUserRole === 'admin') {
        adminControlsHtml = `
            <div style="display: flex; gap: 12px; margin-top: 16px;">
                <button class="btn btn-slate" onclick="archiveTicket(${ticket.id})" style="flex: 1; font-size: 0.8rem; padding: 8px;">
                    <i class="fa-solid fa-box-archive"></i> ${ticket.archived ? 'Unarchive' : 'Archive'} Ticket
                </button>
                <button class="btn btn-rose" onclick="deleteTicket(${ticket.id})" style="flex: 1; font-size: 0.8rem; padding: 8px;">
                    <i class="fa-solid fa-trash-can"></i> Delete Permanently
                </button>
            </div>
        `;
    }
    
    const animationClass = isStateChange ? 'animate-status-change' : '';
    
    detailPanel.innerHTML = `
        <div class="ticket-detail-view ${animationClass}" style="animation: fadeIn 0.3s ease;">
            ${overdueBanner}
            
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; gap: 10px;">
                <div>
                    <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 2px;">
                        ${escapeHtml(ticket.ticket_number || ('#' + ticket.id))}
                    </span>
                    <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary); margin: 0;">${escapeHtml(ticket.title)}</h3>
                    <div style="display: flex; gap: 12px; margin-top: 6px; font-size: 0.8rem; color: var(--text-secondary); flex-wrap: wrap;">
                        <span><i class="fa-solid fa-tag"></i> ${ticket.category.toUpperCase()}</span>
                        <span><i class="fa-solid fa-door-open"></i> Flat ${escapeHtml(ticket.flat_no || 'N/A')}</span>
                        <span><i class="fa-solid fa-user"></i> By: ${escapeHtml(ticket.creator_email)}</span>
                        <span><i class="fa-solid fa-user-shield"></i> Assigned: <strong>${escapeHtml(ticket.assigned_email)}</strong></span>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                    <span class="badge ${getStatusBadgeClass(ticket.status)}" style="padding: 4px 10px; font-size: 0.8rem;">${ticket.status}</span>
                    <span class="badge ${getPriorityBadgeClass(ticket.priority)}" style="font-size: 0.75rem; padding: 2px 8px;">${ticket.priority || 'Medium'}</span>
                </div>
            </div>
            
            <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); padding: 14px; margin-bottom: 14px;">
                <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 8px;">Complaint Description</h4>
                <p style="font-size: 0.9rem; line-height: 1.5; color: var(--text-primary); white-space: pre-wrap; margin: 0;">${escapeHtml(ticket.description)}</p>
                ${attachmentsHtml}
            </div>
            
            ${assignHtml}
            
            <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 12px;">Workflow Tracking</h4>
            <div class="workflow-timeline">
                ${stepsHtml}
            </div>
            
            ${actionsHtml}
            
            <!-- Threaded Comments Section -->
            <div class="comments-section">
                <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 12px;">Comments & Resolution History</h4>
                <div class="comments-container" id="comments-container">
                    <div style="text-align: center; padding: 10px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading comments...</div>
                </div>
                
                <form id="comment-submit-form" onsubmit="submitComment(event, ${ticket.id})" class="comment-form">
                    <div class="input-field" style="margin: 0;">
                        <textarea id="comment-new-text" placeholder="Add a comment or update note here..." rows="2" style="width: 100%; padding: 8px; background-color: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: var(--border-radius-sm); outline: none; font-family: inherit; font-size: 0.85rem;" required></textarea>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                        <input type="file" id="comment-attachment" accept="image/*,application/pdf" style="font-size:0.75rem; color:var(--text-secondary); max-width: 200px;">
                        <button type="submit" class="btn btn-yellow" style="font-size: 0.8rem; padding: 6px 12px;">
                            <i class="fa-solid fa-paper-plane"></i> Send
                        </button>
                    </div>
                </form>
            </div>
            
            ${adminControlsHtml}
        </div>
    `;
    
    // Load comments thread
    loadComments(ticket.id);
};

async function fetchAssigneesForDropdown(currentAssigneeId) {
    if (!sbClient) return;
    try {
        const { data: profiles, error } = await sbClient
            .from('profiles')
            .select('id, email, role')
            .order('email');
            
        if (error) throw error;
        
        const select = document.getElementById("assign-ticket-select");
        if (!select) return;
        
        select.innerHTML = '<option value="">-- Unassigned --</option>';
        profiles.forEach(p => {
            const roleLabel = p.role.replace('_', ' ').toUpperCase();
            select.innerHTML += `<option value="${p.id}" ${p.id === currentAssigneeId ? 'selected' : ''}>
                ${escapeHtml(p.email)} (${roleLabel})
            </option>`;
        });
    } catch (err) {
        console.error("fetchAssigneesForDropdown error:", err);
    }
}

window.assignTicket = async function(ticketId, assigneeId) {
    if (!sbClient) return;
    
    try {
        const updateVal = assigneeId === "" ? null : assigneeId;
        const { error } = await sbClient
            .from('tickets')
            .update({ assigned_to: updateVal })
            .eq('id', ticketId);
            
        if (error) throw error;
        
        showToast("Ticket assignee updated successfully!", "success");
        await loadTickets();
    } catch (err) {
        console.error("assignTicket error:", err);
        showToast("Failed to assign ticket.", "error");
    }
};

window.archiveTicket = async function(ticketId) {
    if (!sbClient) return;
    const ticket = loadedTickets.find(t => t.id === ticketId);
    if (!ticket) return;
    
    try {
        const { error } = await sbClient
            .from('tickets')
            .update({ archived: !ticket.archived })
            .eq('id', ticketId);
            
        if (error) throw error;
        
        showToast(ticket.archived ? "Ticket unarchived successfully!" : "Ticket archived successfully!", "success");
        await loadTickets();
    } catch (err) {
        console.error("archiveTicket error:", err);
        showToast("Failed to change ticket archive state.", "error");
    }
};

window.deleteTicket = async function(ticketId) {
    if (!sbClient) return;
    if (!confirm("Are you sure you want to permanently delete this complaint ticket? This cannot be undone.")) return;
    
    try {
        const { error } = await sbClient
            .from('tickets')
            .delete()
            .eq('id', ticketId);
            
        if (error) throw error;
        
        showToast("Ticket deleted permanently.", "success");
        selectedTicketId = null;
        await loadTickets();
    } catch (err) {
        console.error("deleteTicket error:", err);
        showToast("Failed to delete ticket.", "error");
    }
};

window.loadComments = async function(ticketId) {
    const container = document.getElementById("comments-container");
    if (!container) return;
    
    try {
        const { data: comments, error } = await sbClient
            .from('ticket_comments')
            .select('*')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true });
            
        if (error) throw error;
        
        // Fetch profiles to get email
        const { data: profiles } = await sbClient.from('profiles').select('id, email');
        const profileMap = {};
        if (profiles) {
            profiles.forEach(p => { profileMap[p.id] = p.email; });
        }
        
        if (!comments || comments.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 14px; color: var(--text-muted); font-size: 0.8rem;">No comments yet. Add the first comment below!</div>';
            return;
        }
        
        container.innerHTML = '';
        comments.forEach(c => {
            const authorEmail = profileMap[c.user_id] || 'Unknown User';
            const isOwn = c.user_id === currentUserId;
            
            let attHtml = '';
            const attList = Array.isArray(c.attachments) ? c.attachments : [];
            if (attList.length > 0) {
                attHtml += '<div class="comment-attachments">';
                attList.forEach(att => {
                    if (att.type.startsWith('image/')) {
                        attHtml += `
                            <div class="attachment-thumb" onclick="window.open('${att.data}', '_blank')">
                                <img src="${att.data}" alt="${escapeHtml(att.name)}">
                            </div>`;
                    } else {
                        attHtml += `
                            <a href="${att.data}" target="_blank" class="btn btn-slate" style="font-size:0.7rem; padding: 4px 8px; display:inline-flex; align-items:center; gap: 4px;">
                                <i class="fa-solid fa-file-pdf"></i> ${escapeHtml(att.name)}
                            </a>`;
                    }
                });
                attHtml += '</div>';
            }
            
            container.innerHTML += `
                <div class="comment-bubble ${isOwn ? 'own-comment' : ''}">
                    <div class="comment-meta">
                        <span class="comment-author">${escapeHtml(authorEmail)}</span>
                        <span>${formatTicketDate(c.created_at)}</span>
                    </div>
                    <div class="comment-text">${escapeHtml(c.comment)}</div>
                    ${attHtml}
                </div>
            `;
        });
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
        
    } catch (err) {
        console.error("loadComments error:", err);
        container.innerHTML = '<div style="text-align: center; padding: 10px; color: var(--color-rose);">Failed to load comments history.</div>';
    }
};

window.submitComment = async function(e, ticketId) {
    e.preventDefault();
    if (!sbClient || !currentUserId) return;
    
    const textarea = document.getElementById("comment-new-text");
    const text = textarea.value.trim();
    const fileInput = document.getElementById("comment-attachment");
    
    const btn = document.querySelector("#comment-submit-form button[type='submit']");
    btn.disabled = true;
    
    try {
        let attachments = [];
        if (fileInput && fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            const base64 = await getFileBase64(file);
            attachments.push({
                name: file.name,
                type: file.type,
                data: base64
            });
        }
        
        const { error } = await sbClient
            .from('ticket_comments')
            .insert({
                ticket_id: ticketId,
                user_id: currentUserId,
                comment: text,
                attachments: attachments
            });
            
        if (error) throw error;
        
        textarea.value = '';
        if (fileInput) fileInput.value = '';
        
        showToast("Comment added!", "success");
        await loadComments(ticketId);
    } catch (err) {
        console.error("submitComment error:", err);
        showToast("Failed to post comment.", "error");
    } finally {
        btn.disabled = false;
    }
};

function getFileBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function buildTimelineHtml(ticket) {
    const status = ticket.status;
    const isPending = status === 'Pending';
    const isRecommended = status === 'Recommended';
    const isApproved = status === 'Approved';
    const isResolved = status === 'Resolved';
    const isClosed = status === 'Closed';
    const isReopened = status === 'Reopened';
    
    // Step 1: Filed
    let step1Class = 'completed';
    let step1Desc = `Filed by ${escapeHtml(ticket.creator_email)} on ${formatTicketDate(ticket.created_at)}`;
    if (isReopened) {
        step1Class = 'active pulse-status';
        step1Desc = `Complaint reopened by complainer on ${formatTicketDate(ticket.created_at)}.<br><strong>Reason:</strong> ${escapeHtml(ticket.complainer_feedback || '')}`;
    } else if (isPending) {
        step1Class = 'active pulse-status';
    }
    
    // Step 2: Floor Manager Recommendation
    let step2Class = '';
    let step2Desc = 'Awaiting Floor Manager review & recommendation.';
    if (ticket.recommended_at) {
        step2Class = 'completed';
        step2Desc = `Recommended by Floor Manager (${escapeHtml(ticket.floor_manager_email)}) on ${formatTicketDate(ticket.recommended_at)}.<br><strong>Note:</strong> ${escapeHtml(ticket.floor_manager_recommendation)}`;
    } else if (isPending || isReopened) {
        step2Class = 'active pulse-status';
    }
    
    // Step 3: Committee Approval
    let step3Class = '';
    const approvalCount = Array.isArray(ticket.committee_approvals) ? ticket.committee_approvals.length : 0;
    let step3Desc = `Awaiting Committee approvals (${approvalCount} of 3 approved).`;
    if (ticket.approved_at) {
        step3Class = 'completed';
        step3Desc = `Approved by 3 Committee Members on ${formatTicketDate(ticket.approved_at)}.<br><strong>Approvers:</strong> ${escapeHtml(ticket.approver_emails.join(', '))}`;
    } else if (isRecommended) {
        step3Class = 'active pulse-status';
        if (approvalCount > 0) {
            step3Desc += `<br><strong>Approved so far:</strong> ${escapeHtml(ticket.approver_emails.join(', '))}`;
        }
    }
    
    // Step 4: Action & Resolution
    let step4Class = '';
    let step4Desc = 'Awaiting resolution actions by maintenance team/editor.';
    if (ticket.resolved_at) {
        step4Class = 'completed';
        step4Desc = `Resolved by ${escapeHtml(ticket.resolver_email)} on ${formatTicketDate(ticket.resolved_at)}.<br><strong>Action Details:</strong> ${escapeHtml(ticket.resolution_details)}`;
    } else if (isApproved) {
        step4Class = 'active pulse-status';
    }
    
    // Step 5: Closure & Feedback
    let step5Class = '';
    let step5Desc = 'Awaiting resident closure acknowledgement.';
    if (ticket.closed_at) {
        step5Class = 'completed';
        step5Desc = `Closed on ${formatTicketDate(ticket.closed_at)}.<br><strong>Resident Feedback:</strong> ${escapeHtml(ticket.complainer_feedback || 'No feedback provided.')}`;
    } else if (isResolved) {
        step5Class = 'active pulse-status';
    }
    
    return `
        <div class="workflow-step ${step1Class}">
            <div class="workflow-step-title"><i class="fa-solid fa-file-invoice"></i> Step 1: Filed</div>
            <div class="workflow-step-desc">${step1Desc}</div>
        </div>
        <div class="workflow-step ${step2Class}">
            <div class="workflow-step-title"><i class="fa-solid fa-user-tie"></i> Step 2: Manager Recommendation</div>
            <div class="workflow-step-desc">${step2Desc}</div>
        </div>
        <div class="workflow-step ${step3Class}">
            <div class="workflow-step-title"><i class="fa-solid fa-users"></i> Step 3: Committee Approvals</div>
            <div class="workflow-step-desc">${step3Desc}</div>
        </div>
        <div class="workflow-step ${step4Class}">
            <div class="workflow-step-title"><i class="fa-solid fa-wrench"></i> Step 4: Resolution Action</div>
            <div class="workflow-step-desc">${step4Desc}</div>
        </div>
        <div class="workflow-step ${step5Class}">
            <div class="workflow-step-title"><i class="fa-solid fa-circle-check"></i> Step 5: Closure & Feedback</div>
            <div class="workflow-step-desc">${step5Desc}</div>
        </div>
    `;
}

function buildActionsHtml(ticket) {
    const status = ticket.status;
    const isPending = status === 'Pending';
    const isRecommended = status === 'Recommended';
    const isApproved = status === 'Approved';
    const isResolved = status === 'Resolved';
    const isReopened = status === 'Reopened';
    
    const role = currentUserRole;
    const isCreator = ticket.created_by === currentUserId;
    const isAdmin = role === 'admin';
    const isFloorManager = role === 'floor_manager';
    const isCommitteeMember = role === 'committee_member';
    const isEditor = role === 'editor';
    
    let html = '';
    
    // 1. Floor Manager Action
    if ((isFloorManager || isAdmin) && (isPending || isReopened)) {
        html += `
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed var(--border-color);">
                <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--color-yellow); margin-bottom: 10px;"><i class="fa-solid fa-user-edit"></i> Floor Manager Action</h4>
                <form id="fm-recommend-form" onsubmit="submitRecommendation(event, ${ticket.id})">
                    <div class="input-field" style="margin-bottom: 10px;">
                        <label for="fm-recommend-text">Recommendation Notes</label>
                        <textarea id="fm-recommend-text" placeholder="Explain your assessment and recommend specific actions..." rows="3" style="width: 100%; padding: 8px; background-color: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: var(--border-radius-sm); outline: none; font-family: inherit; font-size: 0.85rem;" required></textarea>
                    </div>
                    <button type="submit" class="btn btn-yellow btn-full">
                        <i class="fa-solid fa-check"></i> Submit Recommendation
                    </button>
                </form>
            </div>
        `;
    }
    
    // 2. Committee Approval Action
    if ((isCommitteeMember || isAdmin) && isRecommended) {
        const approvals = Array.isArray(ticket.committee_approvals) ? ticket.committee_approvals : [];
        const alreadyApproved = approvals.includes(currentUserId);
        
        html += `
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed var(--border-color);">
                <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--color-violet); margin-bottom: 10px;"><i class="fa-solid fa-signature"></i> Committee Approval Action</h4>
        `;
        
        if (alreadyApproved) {
            html += `
                <div style="padding: 10px; background: rgba(139,92,246,0.05); border: 1px solid rgba(139,92,246,0.2); border-radius: var(--border-radius-sm); color: var(--color-violet); font-size: 0.85rem; text-align: center;">
                    <i class="fa-solid fa-circle-check"></i> You have already approved this complaint. Awaiting other members (${approvals.length} of 3 approved).
                </div>
            `;
        } else {
            html += `
                <button type="button" class="btn btn-violet btn-full" onclick="approveComplaint(${ticket.id})">
                    <i class="fa-solid fa-thumbs-up"></i> Approve Complaint (${approvals.length} of 3 approvals)
                </button>
            `;
        }
        
        html += `</div>`;
    }
    
    // 3. Action & Resolution Form (Editor / Admin)
    if ((isEditor || isAdmin) && isApproved) {
        html += `
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed var(--border-color);">
                <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--color-teal); margin-bottom: 10px;"><i class="fa-solid fa-wrench"></i> Record Action & Resolution</h4>
                <form id="editor-resolve-form" onsubmit="submitResolution(event, ${ticket.id})">
                    <div class="input-field" style="margin-bottom: 10px;">
                        <label for="editor-resolve-text">Resolution Details</label>
                        <textarea id="editor-resolve-text" placeholder="Detail the resolution actions taken (e.g. replaced parts, repaired leakage)..." rows="3" style="width: 100%; padding: 8px; background-color: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: var(--border-radius-sm); outline: none; font-family: inherit; font-size: 0.85rem;" required></textarea>
                    </div>
                    <button type="submit" class="btn btn-teal btn-full">
                        <i class="fa-solid fa-check-double"></i> Mark Resolved
                    </button>
                </form>
            </div>
        `;
    }
    
    // 4. Complainer Feedback Form (Creator / Admin)
    if ((isCreator || isAdmin) && isResolved) {
        html += `
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed var(--border-color);">
                <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--color-emerald); margin-bottom: 10px;"><i class="fa-solid fa-comment-dots"></i> Resident Acknowledgement</h4>
                <div class="input-field" style="margin-bottom: 10px;">
                    <label for="complainer-feedback-text">Feedback / Comments (Required for Reopening)</label>
                    <textarea id="complainer-feedback-text" placeholder="Optional comments on resolution. REQUIRED if reopening the ticket for further review..." rows="3" style="width: 100%; padding: 8px; background-color: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: var(--border-radius-sm); outline: none; font-family: inherit; font-size: 0.85rem;"></textarea>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <button type="button" class="btn btn-rose btn-full" onclick="reopenTicket(${ticket.id})">
                        <i class="fa-solid fa-redo"></i> Reopen / Request Review
                    </button>
                    <button type="button" class="btn btn-emerald btn-full" onclick="closeTicket(${ticket.id})">
                        <i class="fa-solid fa-lock"></i> Accept & Close
                    </button>
                </div>
            </div>
        `;
    }
    
    return html;
}

window.handleCreateTicket = async function(e) {
    e.preventDefault();
    if (!sbClient || !currentUserId) {
        showToast("You must be logged in to file a complaint.", "error");
        return;
    }
    
    const title = document.getElementById("ticket-title").value.trim();
    const category = document.getElementById("ticket-category").value;
    const flatNo = document.getElementById("ticket-flat").value;
    const priority = document.getElementById("ticket-priority").value;
    const desc = document.getElementById("ticket-desc").value.trim();
    const fileInput = document.getElementById("ticket-attachments");
    
    const btn = document.querySelector("#new-ticket-form button[type='submit']");
    btn.disabled = true;
    btn.textContent = "Submitting...";
    
    try {
        let attachments = [];
        if (fileInput && fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            const base64 = await getFileBase64(file);
            attachments.push({
                name: file.name,
                type: file.type,
                data: base64
            });
        }
        
        // Count existing tickets to generate ticket_number
        const { count, error: countErr } = await sbClient
            .from('tickets')
            .select('*', { count: 'exact', head: true });
            
        if (countErr) throw countErr;
        
        const countVal = count || 0;
        const currentYear = new Date().getFullYear();
        const ticketNum = `TKT-${currentYear}-${String(countVal + 1).padStart(3, '0')}`;
        
        const { error } = await sbClient
            .from('tickets')
            .insert({
                title: title,
                category: category,
                flat_no: flatNo,
                priority: priority,
                description: desc,
                created_by: currentUserId,
                attachments: attachments,
                ticket_number: ticketNum,
                status: 'Pending'
            });
            
        if (error) throw error;
        
        showToast(`Complaint filed! Assigned Ticket Number: ${ticketNum}`, "success");
        closeModal('newTicketModal');
        await loadTickets();
        
    } catch (err) {
        console.error("handleCreateTicket error:", err);
        showToast(err.message || "Failed to submit complaint.", "error");
    } finally {
        btn.disabled = false;
        btn.textContent = "Submit Ticket";
    }
};

window.submitRecommendation = async function(e, ticketId) {
    e.preventDefault();
    if (!sbClient) return;
    
    const notes = document.getElementById("fm-recommend-text").value.trim();
    const btn = document.querySelector("#fm-recommend-form button[type='submit']");
    btn.disabled = true;
    btn.textContent = "Submitting...";
    
    try {
        const { error } = await sbClient
            .from('tickets')
            .update({
                floor_manager_id: currentUserId,
                floor_manager_recommendation: notes,
                recommended_at: new Date().toISOString(),
                status: 'Recommended'
            })
            .eq('id', ticketId);
            
        if (error) throw error;
        
        showToast("Recommendation submitted successfully!", "success");
        await loadTickets();
        
    } catch (err) {
        console.error("submitRecommendation error:", err);
        showToast("Failed to submit recommendation.", "error");
    }
};

window.approveComplaint = async function(ticketId) {
    if (!sbClient || !currentUserId) return;
    
    const ticket = loadedTickets.find(t => t.id === ticketId);
    if (!ticket) return;
    
    const approvals = Array.isArray(ticket.committee_approvals) ? [...ticket.committee_approvals] : [];
    if (approvals.includes(currentUserId)) {
        showToast("You have already approved this ticket.", "warning");
        return;
    }
    
    approvals.push(currentUserId);
    
    // Check if 3 approvals reached
    const approvalsReached = approvals.length >= 3;
    const updateData = {
        committee_approvals: approvals
    };
    
    if (approvalsReached) {
        updateData.status = 'Approved';
        updateData.approved_at = new Date().toISOString();
    }
    
    try {
        const { error } = await sbClient
            .from('tickets')
            .update(updateData)
            .eq('id', ticketId);
            
        if (error) throw error;
        
        if (approvalsReached) {
            showToast("Approved! Ticket transitioned to Approved status.", "success");
        } else {
            showToast(`Approval recorded (${approvals.length}/3 approvals).`, "success");
        }
        
        await loadTickets();
        
    } catch (err) {
        console.error("approveComplaint error:", err);
        showToast("Failed to record approval.", "error");
    }
};

window.submitResolution = async function(e, ticketId) {
    e.preventDefault();
    if (!sbClient) return;
    
    const details = document.getElementById("editor-resolve-text").value.trim();
    const btn = document.querySelector("#editor-resolve-form button[type='submit']");
    btn.disabled = true;
    btn.textContent = "Saving...";
    
    try {
        const { error } = await sbClient
            .from('tickets')
            .update({
                resolved_by: currentUserId,
                resolution_details: details,
                resolved_at: new Date().toISOString(),
                status: 'Resolved'
            })
            .eq('id', ticketId);
            
        if (error) throw error;
        
        showToast("Resolution details logged successfully!", "success");
        await loadTickets();
        
    } catch (err) {
        console.error("submitResolution error:", err);
        showToast("Failed to save resolution details.", "error");
    }
};

window.reopenTicket = async function(ticketId) {
    if (!sbClient) return;
    
    const feedback = document.getElementById("complainer-feedback-text").value.trim();
    if (!feedback) {
        showToast("Please provide comments explaining why you are reopening this complaint.", "warning");
        return;
    }
    
    try {
        const { error } = await sbClient
            .from('tickets')
            .update({
                status: 'Reopened',
                complainer_feedback: feedback,
                floor_manager_id: null,
                floor_manager_recommendation: null,
                recommended_at: null,
                committee_approvals: [],
                approved_at: null,
                resolved_by: null,
                resolution_details: null,
                resolved_at: null,
                closed_at: null
            })
            .eq('id', ticketId);
            
        if (error) throw error;
        
        showToast("Complaint reopened for further review.", "info");
        await loadTickets();
        
    } catch (err) {
        console.error("reopenTicket error:", err);
        showToast("Failed to reopen ticket.", "error");
    }
};

window.closeTicket = async function(ticketId) {
    if (!sbClient) return;
    
    const feedback = document.getElementById("complainer-feedback-text").value.trim();
    
    try {
        const { error } = await sbClient
            .from('tickets')
            .update({
                status: 'Closed',
                complainer_feedback: feedback || 'Closed by resident.',
                closed_at: new Date().toISOString()
            })
            .eq('id', ticketId);
            
        if (error) throw error;
        
        showToast("Complaint successfully acknowledged and closed.", "success");
        await loadTickets();
        
    } catch (err) {
        console.error("closeTicket error:", err);
        showToast("Failed to close ticket.", "error");
    }
};

// --- Helpdesk Analytics Reporting Tab ---
async function renderHelpdeskReport() {
    const sheet = document.getElementById("report-sheet");
    if (!sheet || !sbClient) return;
    
    try {
        const { data: tickets, error } = await sbClient.from('tickets').select('*');
        if (error) throw error;
        
        const safeTickets = tickets || [];
        
        // 1. Compute stats
        const total = safeTickets.length;
        const byCategory = {};
        const byStatus = {};
        const byPriority = {};
        let resolvedCount = 0;
        let totalMs = 0;
        
        safeTickets.forEach(t => {
            byCategory[t.category] = (byCategory[t.category] || 0) + 1;
            byStatus[t.status] = (byStatus[t.status] || 0) + 1;
            byPriority[t.priority || 'Medium'] = (byPriority[t.priority || 'Medium'] || 0) + 1;
            
            if (t.resolved_at && t.created_at) {
                const diff = new Date(t.resolved_at) - new Date(t.created_at);
                if (diff > 0) {
                    resolvedCount++;
                    totalMs += diff;
                }
            }
        });
        
        const avgHours = resolvedCount > 0 ? (totalMs / resolvedCount / (1000 * 60 * 60)) : 0;
        const avgTimeText = avgHours > 0 ? (avgHours < 24 ? `${avgHours.toFixed(1)} hrs` : `${(avgHours/24).toFixed(1)} days`) : 'N/A';
        
        // 2. Generate report DOM
        let html = `
            <div style="font-family: inherit; color: var(--text-primary);">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--border-color); padding-bottom: 12px; margin-bottom: 24px;">
                    <div>
                        <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--color-yellow);"><i class="fa-solid fa-chart-line"></i> Support Helpdesk & Complaints Analytics</h2>
                        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 4px;">Summary of resident complaints, workflow execution, and performance metrics.</p>
                    </div>
                    <button class="btn btn-slate" onclick="printActiveReport()"><i class="fa-solid fa-print"></i> Print Summary</button>
                </div>
                
                <!-- Summary Metrics cards -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 30px;">
                    <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); padding: 16px; text-align: center;">
                        <span style="font-size: 2rem; font-weight: 800; color: var(--text-primary);">${total}</span>
                        <span style="display: block; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; margin-top: 4px;">Total Filed</span>
                    </div>
                    <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); padding: 16px; text-align: center;">
                        <span style="font-size: 2rem; font-weight: 800; color: var(--color-yellow);">${byStatus['Pending'] || 0}</span>
                        <span style="display: block; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; margin-top: 4px;">Pending Review</span>
                    </div>
                    <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); padding: 16px; text-align: center;">
                        <span style="font-size: 2rem; font-weight: 800; color: var(--color-emerald);">${(byStatus['Closed'] || 0) + (byStatus['Resolved'] || 0)}</span>
                        <span style="display: block; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; margin-top: 4px;">Resolved/Closed</span>
                    </div>
                    <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); padding: 16px; text-align: center;">
                        <span style="font-size: 1.8rem; font-weight: 800; color: var(--color-indigo);">${avgTimeText}</span>
                        <span style="display: block; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; margin-top: 4px;">Avg Resolution Speed</span>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                    <!-- Category Chart -->
                    <div>
                        <h3 style="font-size: 1.05rem; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">Complaints by Category</h3>
                        <div style="display: flex; flex-direction: column; gap: 12px;">`;
        
        const categories = ['plumbing', 'electrical', 'lift', 'security', 'cleanliness', 'billing', 'other'];
        categories.forEach(cat => {
            const count = byCategory[cat] || 0;
            const pct = total > 0 ? (count / total * 100) : 0;
            html += `
                <div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
                        <span style="text-transform: capitalize;">${cat}</span>
                        <span style="font-weight: 600;">${count} (${pct.toFixed(0)}%)</span>
                    </div>
                    <div style="height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden;">
                        <div style="width: ${pct}%; height: 100%; background: var(--color-yellow); border-radius: 4px;"></div>
                    </div>
                </div>`;
        });
        
        html += `       </div>
                    </div>
                    
                    <!-- Priority Breakdown -->
                    <div>
                        <h3 style="font-size: 1.05rem; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">Complaints by Priority</h3>
                        <div style="display: flex; flex-direction: column; gap: 12px;">`;
        
        const priorities = ['Low', 'Medium', 'High', 'Urgent'];
        const pColors = {
            'Low': '#9ca3af',
            'Medium': 'var(--color-yellow)',
            'High': '#f97316',
            'Urgent': 'var(--color-rose)'
        };
        priorities.forEach(prio => {
            const count = byPriority[prio] || 0;
            const pct = total > 0 ? (count / total * 100) : 0;
            html += `
                <div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
                        <span>${prio} Priority</span>
                        <span style="font-weight: 600;">${count}</span>
                    </div>
                    <div style="height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden;">
                        <div style="width: ${pct}%; height: 100%; background: ${pColors[prio] || 'var(--color-yellow)'}; border-radius: 4px;"></div>
                    </div>
                </div>`;
        });
        
        html += `       </div>
                    </div>
                </div>
            </div>
        `;
        
        sheet.innerHTML = html;
        
    } catch (err) {
        console.error("renderHelpdeskReport error:", err);
        sheet.innerHTML = '<div style="color:var(--color-rose); padding:20px; text-align:center;">Failed to generate helpdesk report summary.</div>';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatTicketDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// --- SOFT LOGIN HELPER FUNCTIONS ---

window.switchAuthMode = function(mode) {
    const softBtn = document.getElementById("btn-mode-soft");
    const hardBtn = document.getElementById("btn-mode-hard");
    if (softBtn) softBtn.classList.toggle("active", mode === 'soft');
    if (hardBtn) hardBtn.classList.toggle("active", mode === 'hard');
    
    const softWrapper = document.getElementById("soft-login-form-wrapper");
    const loginWrapper = document.getElementById("login-form-wrapper");
    const registerWrapper = document.getElementById("register-form-wrapper");
    
    if (softWrapper) softWrapper.style.display = mode === 'soft' ? "block" : "none";
    if (loginWrapper) loginWrapper.style.display = mode === 'hard' ? "block" : "none";
    if (registerWrapper) registerWrapper.style.display = "none";
};

async function loadFlatsForSoftLogin() {
    if (!sbClient) return;
    try {
        const { data, error } = await sbClient.from('owners').select('flat_no, owner_name').order('flat_no');
        if (error) throw error;
        
        console.log("Successfully loaded flats for soft login. Count:", data ? data.length : 0);
        
        const softSelect = document.getElementById("soft-flat-no");
        if (softSelect) {
            softSelect.innerHTML = '<option value="" disabled selected>Select Your Flat</option>';
            data.forEach(item => {
                const opt = document.createElement("option");
                opt.value = item.flat_no;
                opt.textContent = `${item.flat_no} - ${item.owner_name}`;
                softSelect.appendChild(opt);
            });
        }
    } catch (err) {
        console.error("loadFlatsForSoftLogin error:", err);
    }
}

window.handleSoftLoginSubmit = async function(e) {
    e.preventDefault();
    if (!sbClient) {
        showToast("Database not connected.", "error");
        return;
    }
    
    const flatNo = document.getElementById("soft-flat-no").value.trim().toUpperCase();
    const verifyCode = document.getElementById("soft-verify-code").value.trim().toLowerCase();
    
    const btn = document.getElementById("btn-soft-login-submit");
    btn.disabled = true;
    btn.textContent = "Verifying...";
    
    console.log("Starting verification for flat:", flatNo, "with code:", verifyCode);
    
    try {
        // Use raw fetch to bypass any Supabase SDK internal locks (e.g. Auth token refresh hanging)
        console.log("Querying Supabase owners table via raw fetch...");
        
        const sbUrl = localStorage.getItem('supabaseUrl') || import.meta.env.VITE_SUPABASE_URL;
        const sbKey = localStorage.getItem('supabaseKey') || import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        const dbUrl = `${sbUrl}/rest/v1/owners?flat_no=eq.${encodeURIComponent(flatNo)}&select=*`;
        
        const fetchPromise = fetch(dbUrl, {
            method: 'GET',
            headers: {
                'apikey': sbKey,
                'Authorization': `Bearer ${sbKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Raw fetch query timed out after 6 seconds.")), 6000)
        );
        
        console.log("Waiting for raw fetch response...");
        const res = await Promise.race([fetchPromise, timeoutPromise]);
        console.log("Raw fetch response received. Status:", res.status);
        
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Database error (${res.status}): ${errText}`);
        }
        
        const list = await res.json();
        const data = list && list.length > 0 ? list[0] : null;
        
        console.log("Owner details loaded via raw fetch:", data);
        
        if (!data) {
            throw new Error("Flat details not found in registry.");
        }
        
        // Clean and compare contact number and passcode
        const dbContact = String(data.contact_no || '').trim().replace(/\D/g, '');
        const inputClean = verifyCode.replace(/\D/g, '');
        
        const dbPasscode = data.passcode ? String(data.passcode).trim() : '';
        
        console.log("Comparing input code with database contact:", dbContact, "and passcode:", dbPasscode);
        
        const isMatch = (inputClean && dbContact && dbContact.includes(inputClean)) || 
                        (verifyCode && dbPasscode && dbPasscode === verifyCode);
                        
        if (!isMatch) {
            throw new Error("Verification code does not match. Please contact Administrator.");
        }
        
        // Success! Set local storage
        localStorage.setItem("isSoftLogin", "true");
        localStorage.setItem("currentFlatNo", flatNo);
        
        showToast("Access Verified! Signing in...", "success");
        console.log("Soft login verified. Triggering background auth sync...");
        
        // Log in to shared account
        await autoLoginSharedAccount(flatNo);
        console.log("Background auth sync completed.");
        
    } catch (err) {
        console.error("handleSoftLoginSubmit error:", err);
        showToast(err.message || "Verification failed.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Verify & Sign In';
    }
};

async function handleSoftUserSession(user, flatNo) {
    if (!sbClient) return;
    
    try {
        // Update user badge in UI header
        const badge = document.getElementById("user-profile-badge");
        const emailText = document.getElementById("user-email-text");
        const roleText = document.getElementById("user-role-text");
        
        if (badge && emailText && roleText) {
            emailText.textContent = `Flat ${flatNo}`;
            roleText.textContent = "RESIDENT";
            roleText.className = "badge";
            roleText.style.borderColor = "var(--border-color)";
            roleText.style.color = "var(--text-secondary)";
            badge.style.display = "inline-flex";
        }
        
        currentUserRole = 'viewer'; // Treated as viewer for RBAC
        applyRbacRestrictions('viewer');
        
        await ensureOwnersPopulated();
        loadFlats();
        loadExpenseHeads();
        refreshDashboard();
    } catch (e) {
        console.error("handleSoftUserSession error:", e);
        showToast("Error retrieving flat details.", "error");
    }
}

async function autoLoginSharedAccount(flatNo) {
    if (!sbClient) return;
    // Use a fresh email to bypass the old unverified 'resident@deepsikha.in' account
    const email = "resident_v2@deepsikha.in";
    const password = "resident123";
    
    try {
        const { error } = await sbClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            // Account might not exist, sign up
            const { error: signUpError } = await sbClient.auth.signUp({
                email: email,
                password: password
            });
            if (signUpError) throw signUpError;
            
            // Retry sign in
            const { error: retryError } = await sbClient.auth.signInWithPassword({
                email: email,
                password: password
            });
            if (retryError) throw retryError;
        }
    } catch (err) {
        console.error("autoLoginSharedAccount error:", err);
        localStorage.removeItem("isSoftLogin");
        localStorage.removeItem("currentFlatNo");
        document.getElementById("auth-container").style.display = "block";
        
        // Show specific error for email confirmation
        if (err.message && err.message.toLowerCase().includes("invalid login credentials")) {
            showToast("Soft Login blocked by Supabase. Please disable 'Confirm Email' in Supabase Auth Settings, or manually confirm 'resident@deepsikha.in' via SQL.", "error");
        } else {
            showToast("Authentication failed: " + err.message, "error");
        }
    }
}

// ==========================================
// USERS AND ROLES MANAGEMENT
// ==========================================

window.openUsersModal = async function() {
    if (currentUserRole !== 'admin') {
        showToast("Access Denied. Only Admins can manage users.", "error");
        return;
    }
    
    openModal("usersModal");
    const tbody = document.getElementById("users-table-body");
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Loading users...</td></tr>';
    
    try {
        const { data: profiles, error } = await sbClient
            .from('profiles')
            .select('id, email, role')
            .order('email');
            
        if (error) throw error;
        
        if (!profiles || profiles.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">No registered users found.</td></tr>';
            return;
        }
        
        const roles = [
            { value: 'admin', label: 'Admin' },
            { value: 'floor_manager', label: 'Floor Manager' },
            { value: 'committee_member', label: 'Committee Member' },
            { value: 'editor', label: 'Editor' },
            { value: 'viewer', label: 'Viewer' }
        ];
        
        tbody.innerHTML = '';
        profiles.forEach(p => {
            const tr = document.createElement("tr");
            let roleOptions = roles.map(r => 
                `<option value="${r.value}" ${r.value === p.role ? 'selected' : ''}>${r.label}</option>`
            ).join('');
            
            // Prevent changing own role via UI for safety
            const disableSelect = p.id === currentUserId ? 'disabled title="Cannot change your own role"' : '';
            
            tr.innerHTML = `
                <td>${p.email}</td>
                <td>
                    <select id="role-select-${p.id}" class="filter-select" ${disableSelect}>
                        ${roleOptions}
                    </select>
                </td>
                <td>
                    <button class="btn btn-emerald" style="padding: 4px 8px; font-size: 0.8rem;" ${disableSelect} onclick="updateUserRole('${p.id}')">Save Role</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
    } catch (err) {
        console.error("Error fetching users:", err);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: red;">Failed to load users.</td></tr>';
        showToast("Error loading users.", "error");
    }
};

window.updateUserRole = async function(userId) {
    if (currentUserRole !== 'admin') {
        showToast("Access Denied.", "error");
        return;
    }
    
    const select = document.getElementById(`role-select-${userId}`);
    const newRole = select.value;
    
    try {
        const { error } = await sbClient
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId);
            
        if (error) throw error;
        showToast("User role updated successfully!", "success");
    } catch (err) {
        console.error("Error updating user role:", err);
        showToast("Failed to update user role.", "error");
    }
};

window.openPasswordModal = function() {
    document.getElementById("new-password").value = "";
    document.getElementById("confirm-new-password").value = "";
    openModal("passwordModal");
};

window.updateUserPassword = async function() {
    const newPassword = document.getElementById("new-password").value;
    const confirmPassword = document.getElementById("confirm-new-password").value;
    
    if (newPassword.length < 6) {
        showToast("Password must be at least 6 characters.", "error");
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showToast("Passwords do not match.", "error");
        return;
    }
    
    if (!sbClient) return;
    
    try {
        const { error } = await sbClient.auth.updateUser({
            password: newPassword
        });
        
        if (error) throw error;
        
        showToast("Password updated successfully!", "success");
        closeModal("passwordModal");
    } catch (err) {
        console.error("Error updating password:", err);
        showToast("Failed to update password: " + err.message, "error");
    }
};
