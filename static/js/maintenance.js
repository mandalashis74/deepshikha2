let maintenanceRates = [];
let maintenanceCollections = [];
let currentMaintenanceTab = 'collections';
let ownersList = [];

async function loadOwnersForMaintenance() {
    try {
        const { data } = await sbClient.from('owners').select('flat_no, flat_type, owner_name').order('flat_no');
        if (data) ownersList = data;
    } catch { ownersList = []; }
}

function hasMaintenancePermission(perm) {
    if (currentUserRole === 'admin') return true;
    if (!window.currentRolePermissions) return false;
    return window.currentRolePermissions.includes(perm);
}

async function loadRates() {
    const { data, error } = await sbClient.from('maintenance_rates').select('*').order('effective_from', { ascending: false });
    if (error) { showToast('Error loading rates: ' + error.message, 'error'); return []; }
    maintenanceRates = data || [];
    return maintenanceRates;
}

async function loadCollections(month, year) {
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const monthStr = monthNames[month - 1] || '';
    let query = sbClient.from('income').select('*').eq('category', 'Monthly Maintenance');
    if (monthStr) query = query.eq('month', monthStr);
    if (year) query = query.eq('year', String(year));
    const { data, error } = await query.order('flat_no');
    if (error) { showToast('Error loading collections: ' + error.message, 'error'); return []; }
    maintenanceCollections = data || [];
    return maintenanceCollections;
}

function _todayLocal() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getActiveRate(flatType, rates) {
    const now = _todayLocal();
    const matching = rates.filter(r => r.flat_type === flatType && r.effective_from <= now && (r.effective_to === null || r.effective_to >= now));
    return matching.length > 0 ? matching.reduce((a, b) => a.effective_from > b.effective_from ? a : b) : null;
}

function getRateOnDate(flatType, rates, dateStr) {
    const matching = rates.filter(r => r.flat_type === flatType && r.effective_from <= dateStr && (r.effective_to === null || r.effective_to >= dateStr));
    return matching.length > 0 ? matching.reduce((a, b) => a.effective_from > b.effective_from ? a : b) : null;
}

window.openMaintenanceModal = async function() {
    if (!hasMaintenancePermission('maintenance:view')) {
        showToast('Access Denied.', 'error'); return;
    }
    openModal('maintenanceModal');
    // Show/hide pending approvals tab based on permission
    const pendingTab = document.querySelector('#maintenance-tabs .pill[data-mt="pending"]');
    if (pendingTab) {
        pendingTab.style.display = (window.hasPermission('income:approve') || window.hasPermission('income:create')) ? '' : 'none';
    }
    await loadOwnersForMaintenance();
    await renderMaintenanceTab('collections');
};

window.openFYStatementModal = async function() {
    if (!hasMaintenancePermission('maintenance:view')) {
        showToast('Access Denied.', 'error'); return;
    }
    openModal('maintenanceModal');
    const pendingTab = document.querySelector('#maintenance-tabs .pill[data-mt="pending"]');
    if (pendingTab) {
        pendingTab.style.display = (window.hasPermission('income:approve') || window.hasPermission('income:create')) ? '' : 'none';
    }
    await loadOwnersForMaintenance();
    await renderMaintenanceTab('fy-statement');
};

window.switchMaintenanceTab = async function(tab) {
    await renderMaintenanceTab(tab);
};

async function renderMaintenanceTab(tab) {
    const container = document.getElementById('maintenance-container');
    const toolbar = document.getElementById('maintenance-toolbar');
    if (!container) return;
    currentMaintenanceTab = tab;
    document.querySelectorAll('#maintenance-tabs .pill').forEach(p => p.classList.toggle('active', p.dataset.mt === tab));
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
    toolbar.innerHTML = '';

    if (tab === 'rates') {
        await renderRatesTab(container, toolbar);
    } else if (tab === 'collections') {
        await renderCollectionsTab(container, toolbar);
    } else if (tab === 'pending') {
        await renderPendingApprovalsTab(container, toolbar);
    } else if (tab === 'fy-statement') {
        await renderFYStatementTab(container, toolbar);
    }
}

async function renderRatesTab(container, toolbar) {
    const rates = await loadRates();
    if (hasMaintenancePermission('maintenance:manage_rates')) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.innerHTML = '<i class="fa-solid fa-plus"></i> New Rate';
        btn.onclick = () => openCreateRateModal();
        toolbar.appendChild(btn);
    }
    const archiveBtn = document.createElement('button');
    archiveBtn.className = 'btn btn-slate';
    archiveBtn.innerHTML = '<i class="fa-solid fa-archive"></i> View Archive';
    archiveBtn.onclick = () => renderRateArchiveTab(container, toolbar);
    toolbar.appendChild(archiveBtn);
    if (rates.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-tag"></i><br>No rate cards defined yet.</div>';
        return;
    }
    const flatTypes = [...new Set(rates.map(r => r.flat_type))].sort();
    const now = _todayLocal();
    let html = '<div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px;">';
    for (const ft of flatTypes) {
        const active = rates.filter(r => r.flat_type === ft && r.effective_from <= now && (r.effective_to === null || r.effective_to >= now));
        const currentRate = active.length > 0 ? active[0] : null;
        html += '<div class="data-card">';
        html += `<div style="font-size:1.1rem;font-weight:700;margin-bottom:8px;">${escapeHtml(ft)}</div>`;
        if (currentRate) {
            html += `<div style="font-size:1.6rem;font-weight:800;color:var(--color-emerald);">${formatCurrency(currentRate.amount)}</div>`;
            html += `<div style="font-size:0.75rem;color:var(--text-secondary);">Effective ${currentRate.effective_from}</div>`;
        } else {
            html += '<div style="color:var(--color-rose);font-size:0.9rem;">No active rate</div>';
        }
        html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
}

async function renderRateArchiveTab(container, toolbar) {
    toolbar.innerHTML = '';
    const backBtn = document.createElement('button');
    backBtn.className = 'btn btn-slate';
    backBtn.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Back to Rates';
    backBtn.onclick = () => renderRatesTab(container, toolbar);
    toolbar.appendChild(backBtn);
    const rates = await loadRates();
    if (rates.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-tag"></i><br>No rate cards defined yet.</div>';
        return;
    }
    const now = _todayLocal();
    const canManage = hasMaintenancePermission('maintenance:manage_rates');
    const flatTypes = [...new Set(rates.map(r => r.flat_type))].sort();
    let html = `<div style="margin-bottom:12px;font-size:0.85rem;color:var(--text-secondary);">${rates.length} rates · ${flatTypes.length} flat types</div>`;
    for (const ft of flatTypes) {
        const ftRates = rates.filter(r => r.flat_type === ft).sort((a, b) => b.effective_from.localeCompare(a.effective_from));
        html += `<div class="data-card" style="margin-bottom:12px;">
            <div style="font-size:1.1rem;font-weight:700;margin-bottom:8px;">${escapeHtml(ft)}</div>
            <table class="data-table"><thead><tr><th>Amount</th><th>Effective From</th><th>Effective To</th><th>Status</th>${canManage ? '<th></th>' : ''}</tr></thead><tbody>`;
        for (const r of ftRates) {
            const isActive = r.effective_from <= now && (r.effective_to === null || r.effective_to >= now);
            html += `<tr style="${isActive ? 'font-weight:700;' : 'opacity:0.7;'}">
                <td>${formatCurrency(r.amount)}</td>
                <td>${r.effective_from}</td>
                <td>${r.effective_to || '—'}</td>
                <td>${isActive ? '<span style="color:var(--color-emerald);">Active</span>' : '<span style="color:var(--text-muted);">Expired</span>'}</td>
                ${canManage ? `<td><button class="btn btn-sm" onclick='editRate("${r.id}")'><i class="fa-solid fa-pen"></i></button></td>` : ''}
            </tr>`;
        }
        html += '</tbody></table></div>';
    }
    container.innerHTML = html;
}

window.openCreateRateModal = function(rateId) {
    if (!hasMaintenancePermission('maintenance:manage_rates')) { showToast('Access Denied.', 'error'); return; }

    const grid = document.getElementById('rate-flat-grid');
    const flatTypes = (window.buildingConfig?.flat_types || '1BHK,2BHK,3BHK').split(',').map(s => s.trim()).filter(Boolean);

    if (rateId) {
        const rate = maintenanceRates.find(r => r.id === rateId);
        grid.innerHTML = flatTypes.map(ft => {
            const val = rate && rate.flat_type === ft ? rate.amount : '';
            const readonly = rate && rate.flat_type !== ft ? 'readonly' : '';
            return `<div class="input-field">
                <label>${escapeHtml(ft)}</label>
                <input type="number" class="rate-amount-input" data-flat-type="${escapeHtml(ft)}" step="0.01" min="0" value="${val}" ${readonly} ${rate && rate.flat_type === ft ? 'required' : ''}>
            </div>`;
        }).join('');
        document.getElementById('rate-effective-from').value = rate ? rate.effective_from : '';
    } else {
        grid.innerHTML = flatTypes.map(ft =>
            `<div class="input-field">
                <label>${escapeHtml(ft)}</label>
                <input type="number" class="rate-amount-input" data-flat-type="${escapeHtml(ft)}" step="0.01" min="0" placeholder="Amount">
            </div>`
        ).join('');
        document.getElementById('rate-effective-from').value = new Date().toISOString().split('T')[0];
    }
    document.getElementById('edit-rate-id').value = rateId || '';
    document.getElementById('create-rate-title').textContent = rateId ? 'Edit Rate Card' : 'New Rate Card';
    openModal('createRateModal');
};

window.saveRate = async function(e) {
    e.preventDefault();
    if (!hasMaintenancePermission('maintenance:manage_rates')) { showToast('Access Denied.', 'error'); return; }
    const editId = document.getElementById('edit-rate-id').value;
    const effectiveFrom = document.getElementById('rate-effective-from').value;

    if (editId) {
        const flatType = document.querySelector('#rate-flat-grid .rate-amount-input:not([readonly])')?.dataset.flatType;
        const amount = parseFloat(document.querySelector('#rate-flat-grid .rate-amount-input:not([readonly])')?.value);
        if (!flatType || isNaN(amount)) { showToast('Enter a valid amount.', 'error'); return; }
        const { error } = await sbClient.from('maintenance_rates').update({ flat_type: flatType, amount, effective_from: effectiveFrom }).eq('id', editId);
        if (error) { showToast('Error: ' + error.message, 'error'); return; }
        showToast('Rate updated!', 'success');
    } else {
        const inputs = document.querySelectorAll('#rate-flat-grid .rate-amount-input');
        const entries = [];
        for (const inp of inputs) {
            const ft = inp.dataset.flatType;
            const amt = parseFloat(inp.value);
            if (!isNaN(amt) && amt > 0) entries.push({ flatType: ft, amount: amt });
        }
        if (entries.length === 0) { showToast('Enter at least one rate amount.', 'error'); return; }

        const prevDate = new Date(effectiveFrom + 'T00:00:00');
        prevDate.setDate(prevDate.getDate() - 1);
        const y = prevDate.getFullYear();
        const m = String(prevDate.getMonth() + 1).padStart(2, '0');
        const d = String(prevDate.getDate()).padStart(2, '0');
        const effectiveToPrev = y + '-' + m + '-' + d;

        for (const entry of entries) {
            await sbClient.from('maintenance_rates')
                .update({ effective_to: effectiveToPrev, is_active: false })
                .eq('flat_type', entry.flatType)
                .is('effective_to', null)
                .lte('effective_from', effectiveFrom);
            await sbClient.from('maintenance_rates').insert({
                flat_type: entry.flatType, amount: entry.amount, effective_from: effectiveFrom,
                is_active: true, created_by: currentUserId
            });
        }
        showToast(`${entries.length} rate(s) created!`, 'success');
    }
    closeModal('createRateModal');
    await renderMaintenanceTab(currentMaintenanceTab);
};

window.editRate = function(rateId) {
    openCreateRateModal(rateId);
};

// Exposed for cross-module refresh after collection submission
window.refreshMaintenanceCollectionsTab = async function() {
    const maintModal = document.getElementById('maintenanceModal');
    if (maintModal && maintModal.style.display !== 'none' && currentMaintenanceTab === 'collections') {
        const container = document.getElementById('maintenance-container');
        const toolbar = document.getElementById('maintenance-toolbar');
        if (container && toolbar) {
            await renderCollectionsTab(container, toolbar);
        }
    }
};

// Toggle all-flats view for soft login
window.toggleMaintShowAllFlats = function() {
    const key = 'maint_show_all_flats';
    const current = sessionStorage.getItem(key);
    if (current === 'true') {
        sessionStorage.setItem(key, 'false');
    } else {
        sessionStorage.setItem(key, 'true');
    }
    const container = document.getElementById('maintenance-container');
    const toolbar = document.getElementById('maintenance-toolbar');
    if (container && toolbar && currentMaintenanceTab === 'collections') {
        renderCollectionsTab(container, toolbar);
    }
};

async function renderCollectionsTab(container, toolbar) {
    toolbar.innerHTML = '';
    const now = new Date();
    let selMonth = now.getMonth() + 1;
    let selYear = now.getFullYear();
    let currentMode = 'month'; // 'month' or 'flat'

    const modeGroup = document.createElement('div');
    modeGroup.style.cssText = 'display:flex;gap:4px;margin-right:12px;';
    const monthBtn = document.createElement('button');
    monthBtn.className = 'btn btn-sm';
    monthBtn.textContent = 'Month-wise';
    monthBtn.style.cssText = 'border-radius:6px;font-size:0.75rem;padding:4px 10px;';
    const flatBtn = document.createElement('button');
    flatBtn.className = 'btn btn-sm';
    flatBtn.textContent = 'Flat-wise';
    flatBtn.style.cssText = 'border-radius:6px;font-size:0.75rem;padding:4px 10px;';
    modeGroup.appendChild(monthBtn);
    modeGroup.appendChild(flatBtn);
    toolbar.appendChild(modeGroup);

    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;flex:1;';
    toolbar.appendChild(controls);

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    let currentFlatNo = '';

    function highlightMode(mode) {
        monthBtn.style.background = mode === 'month' ? 'var(--color-indigo)' : 'var(--bg-card)';
        monthBtn.style.color = mode === 'month' ? '#fff' : 'var(--text-primary)';
        flatBtn.style.background = mode === 'flat' ? 'var(--color-indigo)' : 'var(--bg-card)';
        flatBtn.style.color = mode === 'flat' ? '#fff' : 'var(--text-primary)';
    }

    function makeExportGroup(mode) {
        const g = document.createElement('div');
        g.style.cssText = 'display:flex;gap:4px;';
        const pdf = document.createElement('button');
        pdf.className = 'btn btn-sm btn-slate';
        pdf.innerHTML = '<i class="fa-solid fa-file-pdf"></i> PDF';
        pdf.style.cssText = 'font-size:0.7rem;padding:4px 8px;';
        const xls = document.createElement('button');
        xls.className = 'btn btn-sm btn-slate';
        xls.innerHTML = '<i class="fa-solid fa-file-excel"></i> Excel';
        xls.style.cssText = 'font-size:0.7rem;padding:4px 8px;';
        if (mode === 'month') {
            pdf.onclick = () => exportCollectionsPDF(selMonth, selYear, monthNames[selMonth - 1]);
            xls.onclick = () => exportCollectionsExcel(selMonth, selYear, monthNames[selMonth - 1]);
        } else {
            pdf.onclick = () => exportFlatwisePDF(currentFlatNo);
            xls.onclick = () => exportFlatwiseExcel(currentFlatNo);
        }
        g.appendChild(pdf);
        g.appendChild(xls);
        return g;
    }

    // Month-wise controls
    const monthPicker = document.createElement('select');
    monthPicker.className = 'modern-select';
    monthPicker.style.cssText = 'padding:6px 12px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-card);color:var(--text-primary);font-size:0.85rem;cursor:pointer;';
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    for (let i = 0; i < 12; i++) {
        const opt = document.createElement('option');
        opt.value = i + 1; opt.textContent = months[i];
        if (i + 1 === selMonth) opt.selected = true;
        monthPicker.appendChild(opt);
    }

    const yearPicker = document.createElement('input');
    yearPicker.type = 'number';
    yearPicker.value = selYear;
    yearPicker.style.cssText = 'padding:6px 12px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-card);color:var(--text-primary);width:90px;font-size:0.85rem;';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search flat or owner...';
    searchInput.style.cssText = 'padding:6px 12px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-card);color:var(--text-primary);font-size:0.85rem;width:200px;margin-left:8px;';
    searchInput.oninput = function() {
        const t = this.value.trim().toLowerCase();
        document.querySelectorAll('#maintenance-container table.data-table tbody tr').forEach(tr => {
            tr.style.display = !t || tr.getAttribute('data-search')?.includes(t) ? '' : 'none';
        });
    };

    const doLoad = async () => {
        selMonth = parseInt(monthPicker.value);
        selYear = parseInt(yearPicker.value);
        await renderCollectionsData(container, selMonth, selYear);
    };
    monthPicker.onchange = doLoad;
    yearPicker.onchange = doLoad;

    const statusFilter = document.createElement('select');
    statusFilter.className = 'modern-select';
    statusFilter.style.cssText = 'padding:6px 12px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-card);color:var(--text-primary);font-size:0.85rem;cursor:pointer;margin-left:8px;';
    const statusOptions = [
        { value: '', label: 'All Statuses' },
        { value: 'paid', label: 'Paid' },
        { value: 'pending', label: 'Processing' },
        { value: 'due', label: 'Due' },
        { value: 'partial', label: 'Partial' },
        { value: 'rejected', label: 'Rejected' },
        { value: 'exempt', label: 'Exempt' },
    ];
    for (const opt of statusOptions) {
        const el = document.createElement('option');
        el.value = opt.value;
        el.textContent = opt.label;
        statusFilter.appendChild(el);
    }
    statusFilter.onchange = () => {
        const val = statusFilter.value;
        document.querySelectorAll('#maintenance-container table.data-table tbody tr').forEach(tr => {
            const rowStatus = tr.getAttribute('data-status');
            tr.style.display = !val || rowStatus === val ? '' : 'none';
        });
    };

    // Flat-wise controls
    const flatPicker = document.createElement('select');
    flatPicker.style.cssText = 'padding:6px 12px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-card);color:var(--text-primary);font-size:0.85rem;cursor:pointer;min-width:180px;display:none;';
    flatPicker.onchange = async () => {
        const flatNo = flatPicker.value;
        currentFlatNo = flatNo;
        if (flatNo) await renderFlatwiseData(container, flatNo);
    };

    // Populate flat picker
    const isSoftLoginMode = localStorage.getItem('isSoftLogin') === 'true';
    const softLoginFlatNo = localStorage.getItem('currentFlatNo') || '';
    try {
        const { data: flats } = await sbClient.from('owners').select('flat_no, owner_name').order('flat_no');
        if (flats) {
            const filtered = isSoftLoginMode ? flats.filter(f => f.flat_no === softLoginFlatNo) : flats;
            filtered.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.flat_no;
                opt.textContent = f.flat_no + ' - ' + (window.displayStructured(f.owner_name, 'name') || f.owner_name || '');
                flatPicker.appendChild(opt);
            });
            if (isSoftLoginMode && filtered.length === 1) {
                flatPicker.value = filtered[0].flat_no;
            }
        }
    } catch {}

    if (isSoftLoginMode) {
        modeGroup.style.display = 'none';
    }

    function showMonthMode() {
        currentMode = 'month';
        highlightMode('month');
        monthPicker.style.display = '';
        yearPicker.style.display = '';
        flatPicker.style.display = 'none';
        controls.innerHTML = '';
        controls.appendChild(monthPicker);
        controls.appendChild(yearPicker);
        controls.appendChild(searchInput);
        controls.appendChild(statusFilter);
        const eg = makeExportGroup('month');
        eg.style.marginLeft = 'auto';
        controls.appendChild(eg);
        renderCollectionsData(container, selMonth, selYear);
    }

    function showFlatMode() {
        currentMode = 'flat';
        highlightMode('flat');
        monthPicker.style.display = 'none';
        yearPicker.style.display = 'none';
        flatPicker.style.display = '';
        controls.innerHTML = '';
        controls.appendChild(flatPicker);
        const eg = makeExportGroup('flat');
        eg.style.marginLeft = '12px';
        controls.appendChild(eg);
        if (flatPicker.value) {
            currentFlatNo = flatPicker.value;
            renderFlatwiseData(container, flatPicker.value);
        } else {
            container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fa-solid fa-building"></i><br>Select a flat to view payment history.</div>';
        }
    }

    monthBtn.onclick = showMonthMode;
    flatBtn.onclick = showFlatMode;

    if (isSoftLoginMode) {
        showFlatMode();
    } else {
        showMonthMode();
    }
}

async function renderCollectionsData(container, month, year) {
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';

    const rates = await loadRates();
    
    // Fetch ALL maintenance collections (all months) for cumulative pending calc
    let allCollections = [];
    try {
        const { data } = await sbClient.from('income')
            .select('*')
            .eq('category', 'Monthly Maintenance')
            .order('flat_no');
        if (data) allCollections = data;
    } catch { allCollections = []; }
    
    // Build paid map: flat_no -> { key: totalCollectedAmount }
    const paidMap = {};
    const currentCollectedMap = {}; // for the selected month only
    const currentStatusMap = {}; // flat_no -> best status for selected month
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const selMonthStr = monthNames[month - 1];
    const statusPriority = { rejected: 0, pending: 1, approved: 2 };
    for (const c of allCollections) {
        const st = c.status || 'approved';
        const key = c.month + '-' + c.year;
        if (!paidMap[c.flat_no]) paidMap[c.flat_no] = {};
        if (st !== 'pending' && st !== 'rejected') {
            paidMap[c.flat_no][key] = (paidMap[c.flat_no][key] || 0) + parseFloat(c.amount);
        }
        if (c.month === selMonthStr && String(c.year) === String(year)) {
            if (st !== 'pending' && st !== 'rejected') {
                if (!currentCollectedMap[c.flat_no]) {
                    currentCollectedMap[c.flat_no] = { ...c, amount: parseFloat(c.amount) };
                } else {
                    currentCollectedMap[c.flat_no].amount += parseFloat(c.amount);
                }
            }
            // Track best status for display (Processing / Rejected / Paid badges)
            const existingSt = currentStatusMap[c.flat_no] || 'rejected';
            if ((statusPriority[st] || 0) > (statusPriority[existingSt] || 0)) {
                currentStatusMap[c.flat_no] = st;
            }
        }
    }

    let allFlats = [];
    try {
        const { data } = await sbClient.from('owners')
            .select('flat_no, flat_type, owner_name, occupancy_status, occupancy_from, occupancy_to')
            .order('flat_no');
        if (data) allFlats = data;
    } catch { allFlats = []; }

    if (allFlats.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fa-solid fa-building"></i><br>No flats found. Import owners first.</div>';
        return;
    }

    // Soft login: default to own flat only, with toggle for all flats (no receipts)
    const isSoftLogin = localStorage.getItem('isSoftLogin') === 'true';
    const softLoginFlat = localStorage.getItem('currentFlatNo') || '';
    let showAllFlats = false;
    // Read stored preference for this session
    const showAllKey = 'maint_show_all_flats';
    const storedShowAll = sessionStorage.getItem(showAllKey);
    if (storedShowAll === 'true') showAllFlats = true;
    
    if (isSoftLogin && !showAllFlats) {
        allFlats = allFlats.filter(f => f.flat_no === softLoginFlat);
    }

    function displayName(flat) {
        return window.displayStructured(flat.owner_name, 'name') || escapeHtml(flat.owner_name) || '—';
    }

    // Helper: calculate total pending amount for a flat considering partial payments
    function calcFlatPending(flat, upToMonth, upToYear, collMap, ratesList) {
        const occFrom = flat.occupancy_from ? new Date(flat.occupancy_from + 'T00:00:00') : null;
        const occTo = flat.occupancy_to ? new Date(flat.occupancy_to + 'T00:00:00') : null;
        const mNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        
        let startM, startY;
        if (occFrom) {
            startM = occFrom.getMonth() + 1;
            startY = occFrom.getFullYear();
        } else {
            const d = new Date(upToYear, upToMonth - 1);
            d.setMonth(d.getMonth() - 12);
            startM = d.getMonth() + 1;
            startY = d.getFullYear();
        }
        
        let endM = upToMonth, endY = upToYear;
        if (occTo && occTo <= new Date(upToYear, upToMonth - 1, 1)) {
            endM = occTo.getMonth() + 1;
            endY = occTo.getFullYear();
        }
        
        let totalPending = 0;
        let unpaidCount = 0;
        let ym = startY * 12 + startM;
        const endYm = endY * 12 + endM;
        while (ym <= endYm) {
            const m = ((ym - 1) % 12) + 1;
            const y = Math.floor((ym - 1) / 12);
            const key = mNames[m - 1] + '-' + y;
            const dateStr = y + '-' + String(m).padStart(2, '0') + '-01';
            const rate = getRateOnDate(flat.flat_type, ratesList, dateStr);
            const rateAmt = rate ? parseFloat(rate.amount) : 0;
            const collected = (collMap[flat.flat_no] && collMap[flat.flat_no][key]) || 0;
            if (rateAmt > 0 && collected < rateAmt) {
                totalPending += rateAmt - collected;
                unpaidCount++;
            }
            ym++;
        }
        return { totalPending, unpaidCount };
    }

    // Summary calculations
    let totalCumulativePending = 0;
    let totalCollectedAmt = 0;
    let totalRateSum = 0;
    for (const flat of allFlats) {
        const currentCol = currentCollectedMap[flat.flat_no];
        const activeRate = getActiveRate(flat.flat_type, rates);
        const rateAmount = activeRate ? parseFloat(activeRate.amount) : 0;
        totalRateSum += rateAmount;
        if (currentCol) totalCollectedAmt += parseFloat(currentCol.amount || 0);
        const { totalPending } = calcFlatPending(flat, month, year, paidMap, rates);
        totalCumulativePending += totalPending;
    }

    const today = new Date().toISOString().split('T')[0];
    let html = `<div style="margin-bottom:12px;font-size:0.85rem;color:var(--text-secondary);display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
        <span>${allFlats.length} flats · ${allFlats.filter(f => currentCollectedMap[f.flat_no]).length} collected this month · ${formatCurrency(totalCollectedAmt)} total collected · <span style="color:var(--color-rose);font-weight:600;">${formatCurrency(totalCumulativePending)} cumulative pending</span></span>
        ${isSoftLogin ? `<button class="btn btn-sm" style="font-size:0.7rem;padding:2px 10px;margin-left:auto;" onclick="toggleMaintShowAllFlats()"><i class="fa-solid fa-${showAllFlats ? 'user' : 'building'}"></i> ${showAllFlats ? 'My Flat Only' : 'Show All Flats'}</button>` : ''}
    </div>`;
    html += '<table class="data-table"><thead><tr><th>Flat</th><th>Type</th><th>Owner</th><th>Rate</th><th>Paid</th><th>Cumul. Pending</th><th>Status</th><th>Deposit</th><th>Last Paid</th><th></th></tr></thead><tbody>';
    for (const flat of allFlats) {
        const currentCol = currentCollectedMap[flat.flat_no];
        const activeRate = getActiveRate(flat.flat_type, rates);
        const rateAmount = activeRate ? activeRate.amount : 0;
        const collectedThisMonth = !!currentCol;
        const paidThisMonthAmt = collectedThisMonth ? parseFloat(currentCol.amount) : 0;
        const occFrom = flat.occupancy_from ? new Date(flat.occupancy_from + 'T00:00:00') : null;
        const occTo = flat.occupancy_to ? new Date(flat.occupancy_to + 'T00:00:00') : null;
        const firstOfMonth = new Date(year, month - 1, 1);
        const inOccupancy = (!occFrom || firstOfMonth >= occFrom) && (!occTo || firstOfMonth <= occTo);
        const isVacant = flat.occupancy_status === 'vacant' || (flat.occupancy_to && flat.occupancy_to <= today);
        const effectiveInOccupancy = isVacant ? false : inOccupancy;
        
        // Cumulative pending across all months
        const { totalPending: cumulativePending, unpaidCount: unpaidMonths } = calcFlatPending(flat, month, year, paidMap, rates);
        
        // Find last paid month info
        const flatPaidMonths = paidMap[flat.flat_no] ? Object.keys(paidMap[flat.flat_no]) : [];
        let lastPaidStr = '—';
        let lastPaidDate = '';
        if (flatPaidMonths.length > 0) {
            // Sort by year then month name
            const sorted = flatPaidMonths.sort((a, b) => {
                const [am, ay] = a.split('-');
                const [bm, by] = b.split('-');
                if (ay !== by) return parseInt(ay) - parseInt(by);
                return monthNames.indexOf(am) - monthNames.indexOf(bm);
            });
            const lastKey = sorted[sorted.length - 1];
            lastPaidStr = lastKey; // already "MonthName year"
            const lastCol = allCollections.filter(c => c.flat_no === flat.flat_no && (c.month + '-' + c.year) === lastKey);
            if (lastCol.length > 0) lastPaidDate = lastCol[lastCol.length - 1].date_received || '';
        }
        
        const nameDisplay = displayName(flat);
        const payStatus = currentStatusMap[flat.flat_no] || null;
        const isPending = payStatus === 'pending';
        const isRejected = payStatus === 'rejected';
        const isApproved = payStatus === 'approved';
        const softLoginFlat = localStorage.getItem('currentFlatNo') || '';
        const isOwnFlat = isSoftLogin && flat.flat_no === softLoginFlat;
        let rowStatus = 'due';
        if (isPending) rowStatus = 'pending';
        else if (isRejected) rowStatus = 'rejected';
        else if (isApproved && parseFloat(paidThisMonthAmt) < parseFloat(rateAmount)) rowStatus = 'partial';
        else if (isApproved) rowStatus = 'paid';
        else if (isVacant || !effectiveInOccupancy) rowStatus = 'exempt';

        const searchStr = (flat.flat_no + ' ' + (flat.owner_name ? (window.displayStructured(flat.owner_name, 'name') || flat.owner_name) : '')).toLowerCase();
        html += `<tr data-status="${rowStatus}" data-search="${escapeHtml(searchStr)}" style="${isVacant || !effectiveInOccupancy ? 'opacity:0.5;background:repeating-linear-gradient(45deg,transparent,transparent 8px,rgba(255,255,255,0.015) 8px,rgba(255,255,255,0.015) 16px);' : ''}">
            <td><strong>${escapeHtml(flat.flat_no)}</strong>${isVacant ? ' <span style="font-size:0.65rem;color:var(--text-muted);font-weight:400;">(vacant)</span>' : ''}</td>
            <td>${escapeHtml(flat.flat_type || '—')}</td>
            <td>${isVacant ? '<span style="color:var(--text-muted);font-style:italic;">Vacant</span>' : nameDisplay}</td>
            <td>${rateAmount && !isVacant ? formatCurrency(rateAmount) : '—'}</td>
            <td style="font-weight:700;${isApproved ? 'color:var(--color-emerald);' : isPending ? 'color:var(--color-orange);' : 'color:var(--text-muted);'}">${isApproved ? formatCurrency(paidThisMonthAmt) : isPending ? formatCurrency(paidThisMonthAmt) : '—'}</td>
            <td style="font-weight:700;color:var(--color-rose);">${cumulativePending > 0 ? formatCurrency(cumulativePending) + (unpaidMonths > 1 ? ' <span style="font-size:0.6rem;font-weight:400;">('+unpaidMonths+' months)</span>' : '') : '—'}</td>
            <td>${isPending
                ? '<span style="color:var(--color-orange);font-weight:700;"><i class="fa-solid fa-clock"></i> Processing</span>'
                : isRejected
                    ? '<span style="color:var(--color-rose);font-weight:700;"><i class="fa-solid fa-circle-exclamation"></i> Rejected</span>'
                    : isApproved && parseFloat(paidThisMonthAmt) < parseFloat(rateAmount)
                        ? '<span style="color:var(--color-yellow);font-weight:700;">Partial</span>'
                        : isApproved
                            ? '<span style="color:var(--color-emerald);font-weight:700;">Paid</span>'
                            : isVacant && cumulativePending === 0
                                ? '<span style="color:var(--text-muted);font-weight:400;">Exempt</span>'
                                : '<span style="color:var(--color-rose);font-weight:700;">Due</span>'
            }</td>
            <td style="font-size:0.75rem;">${currentCol && currentCol.deposit_status
                ? currentCol.deposit_status === 'deposited'
                    ? `<span style="color:var(--color-emerald);font-weight:600;"><i class="fa-solid fa-check-circle"></i> Deposited</span><br><span style="font-size:0.6rem;color:var(--text-muted);">by ${escapeHtml(currentCol.deposited_by || '—')}</span>`
                    : `<span style="color:var(--color-orange);font-weight:600;"><i class="fa-solid fa-hourglass-half"></i> Pending Deposit</span>${hasMaintenancePermission('maintenance:collect') ? `<br><button class="btn btn-sm" style="font-size:0.6rem;padding:1px 6px;margin-top:2px;" onclick='markDeposited("${currentCol.id}")'><i class="fa-solid fa-hand-holding-dollar"></i> Mark Deposited</button>` : ''}`
                : '<span style="color:var(--text-muted);">—</span>'
            }</td>
            <td style="font-size:0.8rem;color:var(--text-secondary);">${lastPaidDate ? lastPaidDate + ' (' + lastPaidStr + ')' : lastPaidStr}</td>
            <td>${isPending
                ? '<span style="font-size:0.75rem;color:var(--color-orange);"><i class="fa-solid fa-hourglass-half"></i> Awaiting approval</span>'
                : isRejected
                    ? (isOwnFlat
                        ? `<button class="btn btn-sm" onclick='openIncomeModalForCollection("${flat.flat_no}","${flat.flat_type}",${month},${year},${rateAmount})'><i class="fa-solid fa-rotate"></i> Pay Again</button>`
                        : hasMaintenancePermission('maintenance:collect') && rateAmount > 0
                            ? `<button class="btn btn-sm" onclick='openIncomeModalForCollection("${flat.flat_no}","${flat.flat_type}",${month},${year},${rateAmount})'><i class="fa-solid fa-hand-holding-dollar"></i> Collect</button>`
                            : '')
                    : isOwnFlat && !isApproved && effectiveInOccupancy && rateAmount > 0
                        ? `<button class="btn btn-sm" onclick='openIncomeModalForCollection("${flat.flat_no}","${flat.flat_type}",${month},${year},${rateAmount})'><i class="fa-solid fa-hand-holding-dollar"></i> Pay Now</button>`
                        : (!isApproved || (isApproved && parseFloat(paidThisMonthAmt) < parseFloat(rateAmount))) && effectiveInOccupancy && hasMaintenancePermission('maintenance:collect') && rateAmount > 0
                            ? `<button class="btn btn-sm" onclick='openIncomeModalForCollection("${flat.flat_no}","${flat.flat_type}",${month},${year},${rateAmount})'><i class="fa-solid fa-hand-holding-dollar"></i> Collect</button>`
                            : isApproved && isOwnFlat && !showAllFlats
                                ? `<button class="btn btn-sm" style="font-size:0.7rem;" onclick='generateReceipt("${(allCollections.filter(c => c.flat_no === flat.flat_no && c.month === selMonthStr && String(c.year) === String(year) && c.status === 'approved').pop() || {}).id || ""}")' title="View Receipt"><i class="fa-solid fa-file-pdf"></i></button>`
                                : isApproved && hasMaintenancePermission('maintenance:collect') && !showAllFlats
                                    ? `<button class="btn btn-sm" style="font-size:0.7rem;" onclick='generateReceipt("${(allCollections.filter(c => c.flat_no === flat.flat_no && c.month === selMonthStr && String(c.year) === String(year) && c.status === 'approved').pop() || {}).id || ""}")' title="View Receipt"><i class="fa-solid fa-file-pdf"></i></button>`
                                    : ''
            }</td>
        </tr>`;
    }
    html += `<tr style="font-weight:700;background:var(--bg-card);border-top:2px solid var(--border-color);">
        <td colspan="3" style="text-align:right;">Total</td>
        <td>${formatCurrency(totalRateSum)}</td>
        <td style="color:var(--color-emerald);">${formatCurrency(totalCollectedAmt)}</td>
        <td style="color:var(--color-rose);">${formatCurrency(totalCumulativePending)}</td>
        <td colspan="4"></td>
    </tr>`;
    html += '</tbody></table>';
    container.innerHTML = html;
}

function _pdfText(str) {
    return String(str).replace(/₹/g, 'Rs.').replace(/—/g, '-').replace(/[^\x20-\x7E\s]/g, '').replace(/\s+/g, ' ').trim();
}

function exportCollectionsPDF(month, year, monthName) {
    const table = document.querySelector('#maintenance-container table.data-table');
    if (!table) { showToast('No data to export.', 'info'); return; }
    if (!window.jspdf) { showToast('PDF library not loaded.', 'error'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = 297, pageH = 210, margin = 10;
    const contentW = pageW - 2 * margin;
    let y = margin;

    function checkPage(needed) {
        if (y + needed > pageH - margin) { doc.addPage(); y = margin; }
    }

    doc.setFontSize(14);
    doc.text(_pdfText('Maintenance Collections - ' + monthName + ' ' + year), pageW / 2, y + 5, { align: 'center' });
    y += 12;

    const headers = ['Flat', 'Type', 'Owner', 'Rate', 'Paid', 'Pending', 'Status', 'Deposit', 'Last Paid'];
    const colW = [14, 12, 36, 18, 18, 20, 18, 24, 26];
    const visible = table.querySelectorAll('tbody tr:not([style*="display:none"]):not([style*="display: none"])');
    doc.setFontSize(7);
    doc.setFillColor(15, 23, 42);
    doc.setTextColor(255, 255, 255);
    doc.rect(margin, y, contentW, 5, 'F');
    let x = margin + 1;
    headers.forEach((h, i) => { doc.text(h, x + 1, y + 3.5); x += colW[i]; });
    y += 5;

    doc.setTextColor(30, 30, 30);
    let rowIdx = 0;
    visible.forEach(tr => {
        checkPage(6);
        if (rowIdx % 2 === 1) { doc.setFillColor(240, 240, 245); doc.rect(margin, y, contentW, 5.5, 'F'); }
        const tds = tr.querySelectorAll('td');
        x = margin + 1;
        for (let i = 0; i < Math.min(tds.length, headers.length); i++) {
            doc.text(_pdfText(tds[i].textContent).substring(0, 40), x + 1, y + 3.5, { maxWidth: colW[i] - 2 });
            x += colW[i];
        }
        y += 5.5;
        rowIdx++;
    });

    // Summary row
    checkPage(5);
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 1;
    const lastTr = table.querySelector('tbody tr:last-child');
    if (lastTr) {
        const tds = lastTr.querySelectorAll('td');
        x = margin + 1;
        for (let i = 0; i < Math.min(tds.length, headers.length); i++) {
            doc.text(_pdfText(tds[i].textContent), x + 1, y + 3, { maxWidth: colW[i] - 2 });
            x += colW[i];
        }
    }

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        doc.save('Collections_' + monthName + '_' + year + '.pdf');
    } else {
        const uri = doc.output('datauristring');
        const w = window.open();
        if (w) w.document.write('<iframe width="100%" height="100%" src="' + uri + '"></iframe>');
        else doc.save('Collections_' + monthName + '_' + year + '.pdf');
    }
}

function exportCollectionsExcel(month, year, monthName) {
    const table = document.querySelector('#maintenance-container table.data-table');
    if (!table) { showToast('No data to export.', 'info'); return; }
    if (typeof XLSX === 'undefined') { showToast('Excel library not loaded.', 'error'); return; }

    const headers = ['Flat', 'Type', 'Owner', 'Rate', 'Paid', 'Pending', 'Status', 'Deposit', 'Last Paid'];
    const rows = [headers];
    const visible = table.querySelectorAll('tbody tr:not([style*="display:none"]):not([style*="display: none"])');

    visible.forEach(tr => {
        const tds = tr.querySelectorAll('td');
        const row = [];
        for (let i = 0; i < Math.min(tds.length, headers.length); i++) {
            row.push(tds[i].textContent.trim().replace(/\s+/g, ' '));
        }
        rows.push(row);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Collections');
    XLSX.writeFile(wb, 'Collections_' + monthName + '_' + year + '.xlsx');
}

function exportFlatwisePDF(flatNo) {
    const table = document.querySelector('#maintenance-container table.data-table');
    if (!table) { showToast('No data to export.', 'info'); return; }
    if (!window.jspdf) { showToast('PDF library not loaded.', 'error'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = 297, pageH = 210, margin = 10;
    const contentW = pageW - 2 * margin;
    let y = margin;

    function checkPage(needed) {
        if (y + needed > pageH - margin) { doc.addPage(); y = margin; }
    }

    doc.setFontSize(14);
    doc.text(_pdfText('Payment History - Flat ' + flatNo), pageW / 2, y + 5, { align: 'center' });
    y += 12;

    const headers = ['Month', 'Rate', 'Paid', 'Status', 'Payment Mode', 'Ref No.', 'Paid On'];
    const colW = [28, 20, 20, 22, 24, 30, 24];
    const visible = table.querySelectorAll('tbody tr:not([style*="display:none"]):not([style*="display: none"])');
    doc.setFontSize(7);
    doc.setFillColor(15, 23, 42);
    doc.setTextColor(255, 255, 255);
    doc.rect(margin, y, contentW, 5, 'F');
    let x = margin + 1;
    headers.forEach((h, i) => { doc.text(h, x + 1, y + 3.5); x += colW[i]; });
    y += 5;

    doc.setTextColor(30, 30, 30);
    let rowIdx = 0;
    visible.forEach(tr => {
        checkPage(6);
        if (rowIdx % 2 === 1) { doc.setFillColor(240, 240, 245); doc.rect(margin, y, contentW, 5.5, 'F'); }
        const tds = tr.querySelectorAll('td');
        x = margin + 1;
        for (let i = 0; i < Math.min(tds.length, headers.length); i++) {
            doc.text(_pdfText(tds[i].textContent), x + 1, y + 3.5, { maxWidth: colW[i] - 2 });
            x += colW[i];
        }
        y += 5.5;
        rowIdx++;
    });

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) doc.save('PaymentHistory_' + flatNo + '.pdf');
    else {
        const uri = doc.output('datauristring');
        const w = window.open();
        if (w) w.document.write('<iframe width="100%" height="100%" src="' + uri + '"></iframe>');
        else doc.save('PaymentHistory_' + flatNo + '.pdf');
    }
}

function exportFlatwiseExcel(flatNo) {
    const table = document.querySelector('#maintenance-container table.data-table');
    if (!table) { showToast('No data to export.', 'info'); return; }
    if (typeof XLSX === 'undefined') { showToast('Excel library not loaded.', 'error'); return; }

    const headers = ['Month', 'Rate', 'Paid', 'Status', 'Payment Mode', 'Ref No.', 'Paid On'];
    const rows = [headers];
    const visible = table.querySelectorAll('tbody tr:not([style*="display:none"]):not([style*="display: none"])');
    visible.forEach(tr => {
        const tds = tr.querySelectorAll('td');
        const row = [];
        for (let i = 0; i < Math.min(tds.length, headers.length); i++) {
            row.push((tds[i].textContent || '').trim().replace(/\s+/g, ' '));
        }
        rows.push(row);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'History');
    XLSX.writeFile(wb, 'PaymentHistory_' + flatNo + '.xlsx');
}

window.openIncomeModalForCollection = async function(flatNo, flatType, month, year, amount) {
    const rates = await loadRates();
    let flatInfo = null;
    try {
        const { data } = await sbClient.from('owners')
            .select('flat_no, flat_type, owner_name, occupancy_status, occupancy_from, occupancy_to')
            .eq('flat_no', flatNo).single();
        if (data) flatInfo = data;
    } catch { /* ignore */ }

    // Enter multi-month mode with category frozen to Monthly Maintenance
    enterMultiMonthMode(true);

    // Pre-select the flat in the dropdown
    const select = document.getElementById('inc-flat');
    if (select) {
        for (const opt of select.options) {
            if (opt.value.startsWith(flatNo + ' - ')) {
                select.value = opt.value;
                break;
            }
        }
    }

    // Build the month grid for this flat
    await buildMultiMonthGrid(flatNo, flatType, rates);

    const dateField = document.getElementById('inc-date');
    if (dateField) dateField.value = new Date().toISOString().split('T')[0];
    const remarksField = document.getElementById('inc-remarks');
    if (remarksField) remarksField.value = '';

    const form = document.getElementById('income-form');
    if (form) form.dataset.multiMonth = 'true';

    window._skipMultiMonthReset = true;
    openModal('incomeModal');
    window._skipMultiMonthReset = false;
};

window.openMultiMonthIncomeModal = async function() {
    // Load flats if needed
    if (typeof window.loadFlats === 'function') await window.loadFlats();

    enterMultiMonthMode();
    showMultiMonthPlaceholder();

    const cat = document.getElementById('inc-category');
    if (cat) cat.value = 'Monthly Maintenance';
    const dateField = document.getElementById('inc-date');
    if (dateField) dateField.value = new Date().toISOString().split('T')[0];
    const remarksField = document.getElementById('inc-remarks');
    if (remarksField) remarksField.value = '';

    const form = document.getElementById('income-form');
    if (form) form.dataset.multiMonth = 'true';

    window._skipMultiMonthReset = true;
    openModal('incomeModal');
    window._skipMultiMonthReset = false;
};

function enterMultiMonthMode(freezeCategory) {
    const multiSection = document.getElementById('inc-multi-month');
    const singleSection = document.getElementById('inc-single-month');
    const incAmount = document.getElementById('inc-amount');
    if (multiSection) multiSection.classList.remove('hidden');
    if (singleSection) singleSection.classList.add('hidden');
    if (incAmount) {
        incAmount.value = '';
        incAmount.removeAttribute('required');
    }
    const cat = document.getElementById('inc-category');
    if (cat) {
        cat.disabled = !!freezeCategory;
    }
    const flatSelect = document.getElementById('inc-flat');
    if (flatSelect) {
        flatSelect.disabled = !!freezeCategory;
    }
}

function showMultiMonthPlaceholder() {
    document.getElementById('inc-mm-flat').textContent = 'Select a flat above';
    document.getElementById('inc-mm-type').textContent = '';
    document.getElementById('inc-mm-months').innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.85rem;"><i class="fa-solid fa-building"></i><br>Select a flat to view monthly collection status.</div>';
    document.getElementById('inc-mm-count').textContent = '0';
    document.getElementById('inc-mm-total').textContent = '0';
    const override = document.getElementById('inc-mm-override');
    if (override) override.value = '';
}

window.buildMultiMonthGrid = async function(flatNo, flatType, rates) {
    if (!rates) rates = await loadRates();
    
    // Fetch flat info
    let flatInfo = null;
    try {
        const { data } = await sbClient.from('owners')
            .select('flat_no, flat_type, owner_name, occupancy_status, occupancy_from, occupancy_to')
            .eq('flat_no', flatNo).single();
        if (data) flatInfo = data;
    } catch { /* ignore */ }

    // Fetch existing collections for this flat
    let existingColl = [];
    try {
        const { data } = await sbClient.from('income')
            .select('*')
            .eq('category', 'Monthly Maintenance')
            .eq('flat_no', flatNo);
        if (data) existingColl = data;
    } catch { /* ignore */ }

    // Build map of total collected amount per month
    const collAmounts = {};
    for (const c of existingColl) {
        const key = c.month + '-' + c.year;
        collAmounts[key] = (collAmounts[key] || 0) + parseFloat(c.amount);
    }

    const occFrom = flatInfo?.occupancy_from ? new Date(flatInfo.occupancy_from + 'T00:00:00') : null;
    const occTo = flatInfo?.occupancy_to ? new Date(flatInfo.occupancy_to + 'T00:00:00') : null;
    const now = new Date();

    let startM, startY;
    if (occFrom) {
        startM = occFrom.getMonth() + 1;
        startY = occFrom.getFullYear();
    } else {
        const d = new Date(now.getFullYear(), now.getMonth() - 17, 1);
        startM = d.getMonth() + 1;
        startY = d.getFullYear();
    }
    let endM = now.getMonth() + 1 + 6;
    let endY = now.getFullYear();
    while (endM > 12) { endM -= 12; endY += 1; }

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const currentYm = now.getFullYear() * 12 + (now.getMonth() + 1);

    const monthList = [];
    let ym = startY * 12 + startM;
    const endYm = endY * 12 + endM;
    while (ym <= endYm) {
        const m = ((ym - 1) % 12) + 1;
        const y = Math.floor((ym - 1) / 12);
        const mName = monthNames[m - 1];
        const key = mName + '-' + y;
        const dateStr = y + '-' + String(m).padStart(2, '0') + '-01';
        const rate = getRateOnDate(flatType, rates, dateStr);
        const rateAmt = rate ? parseFloat(rate.amount) : 0;
        const totalPaid = collAmounts[key] || 0;
        const isFullyPaid = totalPaid >= rateAmt && rateAmt > 0;
        const isPartial = totalPaid > 0 && totalPaid < rateAmt;
        // Skip fully paid months entirely
        if (isFullyPaid) { ym++; continue; }
        const isOccupied = (!occFrom || new Date(y, m - 1, 1) >= occFrom) && (!occTo || new Date(y, m - 1, 1) <= occTo);
        const isFuture = ym > currentYm;
        const hasRate = rateAmt > 0;
        const remaining = rateAmt - totalPaid;
        const checked = !isFullyPaid && !isPartial && isOccupied && !isFuture && hasRate;
        monthList.push({ m, y, mName, key, isFullyPaid, isPartial, rateAmt, totalPaid, remaining, isOccupied, isFuture, checked, hasRate });
        ym++;
    }

    document.getElementById('inc-mm-flat').textContent = flatNo + (flatInfo ? ' - ' + (window.displayStructured(flatInfo.owner_name, 'name') || flatInfo.owner_name || '') : '');
    document.getElementById('inc-mm-type').textContent = flatType || '';

    let html = '<table style="width:100%;font-size:0.8rem;border-collapse:collapse;">';
    html += '<thead><tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:4px 6px;text-align:left;width:32px;"></th>';
    html += '<th style="padding:4px 6px;text-align:left;">Month</th>';
    html += '<th style="padding:4px 6px;text-align:right;">Rate</th>';
    html += '<th style="padding:4px 6px;text-align:center;">Status</th>';
    html += '</tr></thead><tbody>';
    for (const item of monthList) {
        const statusLabel = item.isFullyPaid ? '<span style="color:var(--color-emerald);font-weight:600;">Paid</span>'
            : item.isPartial ? `<span style="color:var(--color-yellow);font-weight:600;">Partial (${formatCurrency(item.remaining)} due)</span>`
            : item.isFuture ? '<span style="color:var(--color-blue);font-weight:500;">Advance</span>'
            : item.isOccupied && item.hasRate ? '<span style="color:var(--color-rose);font-weight:600;">Due</span>'
            : '<span style="color:var(--text-muted);">—</span>';
        const isDue = !item.isFullyPaid && !item.isPartial && item.isOccupied && item.hasRate && !item.isFuture;
        const cbRate = item.remaining > 0 ? item.remaining : item.rateAmt;
        html += `<tr>`;
        html += `<td style="padding:4px 6px;"><input type="checkbox" class="inc-mm-cb" data-month="${item.m}" data-year="${item.y}" data-key="${item.key}" data-rate="${cbRate}" data-due="${isDue ? 'true' : 'false'}" ${item.checked ? 'checked' : ''} onchange="updateMultiMonthTotal()"></td>`;
        html += `<td style="padding:4px 6px;">${monthNames[item.m - 1]} ${item.y}</td>`;
        html += `<td style="padding:4px 6px;text-align:right;">${item.rateAmt > 0 ? formatCurrency(item.rateAmt) : '—'}</td>`;
        html += `<td style="padding:4px 6px;text-align:center;">${statusLabel}</td>`;
        html += `</tr>`;
    }
    html += '</tbody></table>';
    document.getElementById('inc-mm-months').innerHTML = html;
    updateMultiMonthTotal();
};

window.updateMultiMonthTotal = function() {
    const cbs = document.querySelectorAll('.inc-mm-cb:checked:not(:disabled)');
    let total = 0;
    for (const cb of cbs) {
        total += parseFloat(cb.dataset.rate || 0);
    }
    document.getElementById('inc-mm-count').textContent = cbs.length;
    document.getElementById('inc-mm-total').textContent = formatCurrency(total);
    
    const override = document.getElementById('inc-mm-override');
    const amountField = document.getElementById('inc-amount');
    if (override && amountField) {
        const overrideVal = parseFloat(override.value);
        if (override.value && !isNaN(overrideVal) && overrideVal >= 0) {
            amountField.value = overrideVal;
        } else {
            amountField.value = total > 0 ? total : '';
        }
    }
};

window.selectAllMonths = function(selectDue) {
    const cbs = document.querySelectorAll('.inc-mm-cb:not(:disabled)');
    for (const cb of cbs) {
        if (selectDue) {
            cb.checked = cb.dataset.due === 'true';
        } else {
            cb.checked = false;
        }
    }
    updateMultiMonthTotal();
};

// Listen for flat change in multi-month mode
document.addEventListener('change', function(e) {
    if (e.target.id === 'inc-flat') {
        const form = document.getElementById('income-form');
        if (form && form.dataset.multiMonth === 'true') {
            const flatVal = e.target.value;
            if (flatVal && !flatVal.startsWith('Select')) {
                const flatNo = flatVal.split(' - ')[0].trim();
                handleFlatSelected(flatNo);
            } else {
                showMultiMonthPlaceholder();
            }
        }
    }
    if (e.target.id === 'inc-mm-override') {
        updateMultiMonthTotal();
    }
    if (e.target.id === 'inc-category') {
        const form = document.getElementById('income-form');
        if (form && form.dataset.multiMonth === 'true') {
            if (e.target.value === 'Monthly Maintenance') {
    enterMultiMonthMode(false);
                // Rebuild grid if a flat is already selected
                const flatSelect = document.getElementById('inc-flat');
                if (flatSelect && flatSelect.value && !flatSelect.value.startsWith('Select')) {
                    const flatNo = flatSelect.value.split(' - ')[0].trim();
                    handleFlatSelected(flatNo);
                } else {
                    showMultiMonthPlaceholder();
                }
            } else {
                resetMultiMonthUI();
            }
        }
    }
});

window.handleFlatSelected = async function(flatNo) {
    // Try ownersList first, fall back to DB query
    let flatInfo = ownersList.find(o => o.flat_no === flatNo);
    if (!flatInfo) {
        try {
            const { data } = await sbClient.from('owners')
                .select('flat_no, flat_type, owner_name')
                .eq('flat_no', flatNo).single();
            if (data) flatInfo = data;
        } catch { /* ignore */ }
    }
    if (flatInfo) {
        await buildMultiMonthGrid(flatNo, flatInfo.flat_type);
    } else {
        showMultiMonthPlaceholder();
    }
};

window.resetMultiMonthUI = function() {
    const form = document.getElementById('income-form');
    const multiSection = document.getElementById('inc-multi-month');
    const singleSection = document.getElementById('inc-single-month');
    if (form) form.dataset.multiMonth = '';
    if (multiSection) multiSection.classList.add('hidden');
    if (singleSection) singleSection.classList.remove('hidden');
    const incAmount = document.getElementById('inc-amount');
    if (incAmount) {
        incAmount.required = true;
        incAmount.value = '';
    }
    const override = document.getElementById('inc-mm-override');
    if (override) override.value = '';
    const cat = document.getElementById('inc-category');
    if (cat) cat.disabled = false;
    const flatSelect = document.getElementById('inc-flat');
    if (flatSelect) flatSelect.disabled = false;
};

// Patch openModal to reset multi-month when incomeModal is opened normally
const origOpenModal = window.openModal;
window.openModal = function(modalId) {
    if (modalId === 'incomeModal' && !window._skipMultiMonthReset) {
        resetMultiMonthUI();
    }
    if (origOpenModal) origOpenModal(modalId);
};

// Patch closeModal to clear multi-month flag
const origCloseModal = window.closeModal;
window.closeModal = function(modalId) {
    if (modalId === 'incomeModal') {
        const form = document.getElementById('income-form');
        if (form) form.dataset.multiMonth = '';
    }
    if (origCloseModal) origCloseModal(modalId);
};

async function renderArrearsTab(container, toolbar) {
    const rates = await loadRates();
    let allFlats = [];
    try {
        const { data } = await sbClient.from('owners').select('flat_no, flat_type, owner_name, occupancy_status, occupancy_from, occupancy_to').order('flat_no');
        if (data) allFlats = data;
    } catch { allFlats = []; }

    if (allFlats.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fa-solid fa-building"></i><br>No flats found.</div>';
        return;
    }

    function displayName(flat) {
        return window.displayStructured(flat.owner_name, 'name') || escapeHtml(flat.owner_name) || '—';
    }

    const { data: allCollections } = await sbClient.from('income').select('*').eq('category', 'Monthly Maintenance').order('year', { ascending: false }).order('month', { ascending: false });
    const collectionSet = new Set();
    const collMap = {};
    if (allCollections) {
        for (const c of allCollections) {
            const key = c.flat_no + '|' + c.month + '|' + c.year;
            collectionSet.add(key);
            if (!collMap[c.flat_no]) collMap[c.flat_no] = [];
            collMap[c.flat_no].push(c);
        }
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const startYear = 2024;
    let pendingMonths = [];
    for (let y = startYear; y <= currentYear; y++) {
        const endM = (y === currentYear) ? currentMonth : 12;
        const startM = (y === startYear) ? 4 : 1;
        for (let m = startM; m <= endM; m++) {
            pendingMonths.push({ month: m, year: y });
        }
    }

    const flatArrears = [];
    for (const flat of allFlats) {
        let pendingAmount = 0;
        let pendingCount = 0;
        let lastPaid = null;
        const occFrom = flat.occupancy_from ? new Date(flat.occupancy_from + 'T00:00:00') : null;
        const occTo = flat.occupancy_to ? new Date(flat.occupancy_to + 'T00:00:00') : null;
        for (const pm of pendingMonths) {
            const pmDate = new Date(pm.year, pm.month - 1, 1);
            if (occFrom && pmDate < occFrom) continue;
            if (occTo && pmDate > occTo) continue;
            const key = flat.flat_no + '|' + pm.month + '|' + pm.year;
            if (!collectionSet.has(key)) {
                const rate = getRateOnDate(flat.flat_type, rates, `${pm.year}-${String(pm.month).padStart(2,'0')}-01`);
                if (rate) {
                    pendingAmount += parseFloat(rate.amount);
                    pendingCount++;
                }
            } else {
                if (!lastPaid) lastPaid = `${pm.month}/${pm.year}`;
            }
        }
        if (pendingCount > 0) {
            flatArrears.push({ flat, pendingAmount, pendingCount, lastPaid });
        }
    }

    flatArrears.sort((a, b) => b.pendingAmount - a.pendingAmount);

    let html = `<div style="margin-bottom:12px;font-size:0.85rem;color:var(--text-secondary);">
        ${flatArrears.length} flats in arrears · Total due: ${formatCurrency(flatArrears.reduce((s,f)=>s+f.pendingAmount,0))}
    </div>`;

    if (flatArrears.length === 0) {
        html += '<div style="text-align:center;padding:40px;color:var(--color-emerald);"><i class="fa-solid fa-circle-check" style="font-size:2rem;"></i><br><strong>All caught up!</strong> No pending maintenance fees.</div>';
        container.innerHTML = html;
        return;
    }

    html += '<table class="data-table"><thead><tr><th>Flat</th><th>Type</th><th>Owner</th><th>Pending Months</th><th>Due Amount</th><th>Last Paid</th></tr></thead><tbody>';
    for (const af of flatArrears) {
        html += `<tr>
            <td><strong>${escapeHtml(af.flat.flat_no)}</strong></td>
            <td>${escapeHtml(af.flat.flat_type || '—')}</td>
            <td>${displayName(af.flat)}</td>
            <td>${af.pendingCount}</td>
            <td style="color:var(--color-rose);font-weight:700;">${formatCurrency(af.pendingAmount)}</td>
            <td style="font-size:0.8rem;color:var(--text-secondary);">${af.lastPaid || 'Never'}</td>
        </tr>`;
    }
    html += '</tbody></table>';
    container.innerHTML = html;
}

// ─── FLAT-WISE VIEW ─────────────────────────────────────────────────────

async function renderFlatwiseData(container, flatNo) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';

    const [flatRes, rates, collections] = await Promise.all([
        sbClient.from('owners').select('*').eq('flat_no', flatNo).maybeSingle(),
        loadRates(),
        sbClient.from('income').select('*').eq('category', 'Monthly Maintenance').eq('flat_no', flatNo).order('year', { ascending: false }).order('month', { ascending: false })
    ]);

    const flat = flatRes.data;
    if (!flat) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fa-solid fa-circle-exclamation"></i><br>Flat not found.</div>';
        return;
    }

    const collData = collections.data || [];
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    const collMap = {};
    for (const c of collData) {
        const key = c.month + '-' + c.year;
        collMap[key] = c;
    }

    const now = new Date();
    const occFrom = flat.occupancy_from ? new Date(flat.occupancy_from + 'T00:00:00') : new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const occTo = flat.occupancy_to ? new Date(flat.occupancy_to + 'T00:00:00') : null;
    function getEndLimit() {
        const curYm = now.getFullYear() * 12 + now.getMonth() + 2;
        const maxPaidYm = collData.reduce((max, c) => {
            const mIdx = monthNames.indexOf(c.month) + 1;
            const ym = parseInt(c.year) * 12 + mIdx;
            return Math.max(max, ym);
        }, 0);
        const endYm = Math.max(curYm, maxPaidYm);
        return new Date(Math.floor((endYm - 1) / 12), ((endYm - 1) % 12), 1);
    }

    const nameDisplay = window.displayStructured(flat.owner_name, 'name') || flat.owner_name || '—';

    function generateRows() {
        const rows = [];
        const endLimit = getEndLimit();
        const endM = endLimit.getMonth() + 1;
        const endY = endLimit.getFullYear();
        let totalRate = 0, totalPaid = 0;
        let ym = occFrom.getFullYear() * 12 + occFrom.getMonth() + 1;
        const endYm = endY * 12 + endM;
        while (ym <= endYm) {
        const m = ((ym - 1) % 12) + 1;
        const y = Math.floor((ym - 1) / 12);
        const dateStr = y + '-' + String(m).padStart(2, '0') + '-01';
        const monthName = monthNames[m - 1];
        const key = monthName + '-' + y;

        const rate = getRateOnDate(flat.flat_type, rates, dateStr);
        const rateAmt = rate ? parseFloat(rate.amount) : 0;
        totalRate += rateAmt;

        const col = collMap[key];
        const isVacant = flat.occupancy_status === 'vacant';
        const inOccupancy = (!occFrom || new Date(dateStr) >= occFrom) && (!occTo || new Date(dateStr) <= occTo);
        const exempt = isVacant || !inOccupancy;

        let paidAmt = 0, statusText = '', statusColor = '';
        let pmtMode = '—', refNo = '—', paidOn = '—', colId = null;
        let isPending = false;

        if (col) {
            const st = col.status || 'approved';
            paidAmt = (st !== 'pending' && st !== 'rejected') ? parseFloat(col.amount) || 0 : 0;
            totalPaid += paidAmt;
            pmtMode = col.payment_mode || '—';
            refNo = col.ref_number || '—';
            paidOn = col.payment_date || col.date_received || '—';
            colId = col.id;
            if (st === 'pending') { isPending = true; statusText = 'Processing'; statusColor = 'var(--color-orange)'; }
            else if (st === 'rejected') { statusText = 'Rejected'; statusColor = 'var(--color-rose)'; }
            else if (paidAmt < rateAmt) { statusText = 'Partial'; statusColor = 'var(--color-yellow)'; }
            else { statusText = 'Paid'; statusColor = 'var(--color-emerald)'; }
        } else if (exempt) {
            statusText = 'Exempt'; statusColor = 'var(--text-muted)';
        } else if (rateAmt > 0) {
            statusText = 'Due'; statusColor = 'var(--color-rose)';
        } else {
            statusText = '—'; statusColor = 'var(--text-muted)';
        }

        rows.push({
            month: monthName, year: y, rateAmt, paidAmt, statusText, statusColor,
            pmtMode, refNo, paidOn, colId, isPending, exempt: exempt && !col,
            _sortKey: y * 12 + m
        });
        ym++;
    }
    rows.reverse();
    return rows;
    }

    let sortCol = '_sortKey';
    let sortDir = -1;
    let searchTerm = '';
    let fwPage = 1;
    let FW_PAGE_SIZE = 12;
    let rows = generateRows();

    function buildTable() {
        rows = generateRows();
        // Filter
        let filtered = rows;
        if (searchTerm) {
            const t = searchTerm.toLowerCase();
            filtered = rows.filter(r =>
                r.month.toLowerCase().includes(t) ||
                String(r.year).includes(t) ||
                r.statusText.toLowerCase().includes(t) ||
                r.pmtMode.toLowerCase().includes(t) ||
                r.refNo.toLowerCase().includes(t) ||
                r.paidOn.toLowerCase().includes(t) ||
                formatCurrency(r.rateAmt).includes(t) ||
                formatCurrency(r.paidAmt).includes(t)
            );
        }

        // Sort
        const sorted = [...filtered].sort((a, b) => {
            let va = a[sortCol], vb = b[sortCol];
            if (typeof va === 'string') va = va.toLowerCase();
            if (typeof vb === 'string') vb = vb.toLowerCase();
            if (va < vb) return -sortDir;
            if (va > vb) return sortDir;
            return 0;
        });

        // Pagination
        const totalPages = Math.max(1, Math.ceil(sorted.length / FW_PAGE_SIZE));
        if (fwPage > totalPages) fwPage = totalPages;
        const pageStart = (fwPage - 1) * FW_PAGE_SIZE;
        const pageRows = sorted.slice(pageStart, pageStart + FW_PAGE_SIZE);

        const header = (label, colKey) => {
            const active = sortCol === colKey;
            const arrow = active ? (sortDir === 1 ? ' &#9650;' : ' &#9660;') : '';
            return `<th style="cursor:pointer;user-select:none;" onclick="window._fwSort('${colKey}')">${label}${arrow}</th>`;
        };

        let html = `<div style="margin-bottom:12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
            <span style="font-weight:700;font-size:1.1rem;">${escapeHtml(flat.flat_no)}</span>
            <span style="font-size:0.85rem;color:var(--text-secondary);">${escapeHtml(flat.flat_type || '—')}</span>
            <span style="font-size:0.85rem;">${nameDisplay}</span>
            <input type="text" id="fw-search" placeholder="Search..." oninput="window._fwSearch(this.value)"
                style="padding:4px 10px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-card);color:var(--text-primary);font-size:0.8rem;width:200px;margin-left:auto;">
        </div>`;
        html += '<table class="data-table"><thead><tr>';
        html += header('Month', '_sortKey');
        html += header('Rate', 'rateAmt');
        html += header('Paid', 'paidAmt');
        html += header('Status', 'statusText');
        html += header('Payment Mode', 'pmtMode');
        html += header('Ref No.', 'refNo');
        html += header('Paid On', 'paidOn');
        html += '<th></th>';
        html += '</tr></thead><tbody>';

        for (const r of pageRows) {
            html += `<tr style="${r.exempt ? 'opacity:0.5;' : ''}">
                <td>${r.month} ${r.year}</td>
                <td>${r.rateAmt > 0 ? formatCurrency(r.rateAmt) : '—'}</td>
                <td style="font-weight:700;color:${r.colId ? 'var(--color-emerald)' : 'var(--text-muted)'};">${r.colId ? formatCurrency(r.paidAmt) : '—'}</td>
                <td style="font-weight:700;color:${r.statusColor};">${r.statusText}</td>
                <td style="font-size:0.8rem;">${r.pmtMode}</td>
                <td style="font-size:0.8rem;">${r.refNo}</td>
                <td style="font-size:0.8rem;">${r.paidOn}</td>
                <td>${r.colId && !r.isPending
                    ? r.statusText === 'Rejected'
                        ? `<button class="btn btn-sm" style="font-size:0.65rem;padding:2px 8px;" onclick='openIncomeModalForCollection("${flat.flat_no}","${flat.flat_type}")'><i class="fa-solid fa-rotate"></i> Pay Again</button>`
                        : `<button class="btn btn-sm" style="font-size:0.65rem;padding:2px 8px;" onclick='generateReceipt("${r.colId}")'><i class="fa-solid fa-file-pdf"></i></button>`
                    : r.isPending
                        ? '<span style="font-size:0.7rem;color:var(--color-orange);">Awaiting approval</span>'
                        : !r.exempt && r.rateAmt > 0
                            ? `<button class="btn btn-sm" style="font-size:0.65rem;padding:2px 8px;" onclick='openIncomeModalForCollection("${flat.flat_no}","${flat.flat_type}")'><i class="fa-solid fa-hand-holding-dollar"></i> Pay Now</button>`
                            : ''
                }</td>
            </tr>`;
        }

        // Summary row
        const sumPaid = sorted.reduce((s, r) => s + r.paidAmt, 0);
        const sumRate = sorted.reduce((s, r) => s + r.rateAmt, 0);
        html += `<tr style="font-weight:700;background:var(--bg-card);border-top:2px solid var(--border-color);">
            <td>Total (${sorted.length} months)</td>
            <td>${formatCurrency(sumRate)}</td>
            <td style="color:var(--color-emerald);">${formatCurrency(sumPaid)}</td>
            <td colspan="5"></td>
        </tr></tbody></table>`;

        // Pagination controls
        html += `<div style="display:flex;justify-content:center;align-items:center;gap:8px;margin-top:12px;font-size:0.85rem;flex-wrap:wrap;">`;
        html += `<span style="color:var(--text-secondary);">Rows:</span>`;
        html += `<select onchange="window._fwSetPageSize(this.value)" style="padding:4px 6px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-card);color:var(--text-primary);font-size:0.8rem;">`;
        [12, 24, 36, 50, 0].forEach(n => {
            const label = n === 0 ? 'All' : String(n);
            const selected = FW_PAGE_SIZE === n || (n === 0 && FW_PAGE_SIZE >= 9999) ? 'selected' : '';
            html += `<option value="${n}" ${selected}>${label}</option>`;
        });
        html += `</select>`;
        if (totalPages > 1) {
            html += `<button class="btn btn-sm" style="padding:4px 10px;" onclick="window._fwPage(${fwPage - 1})" ${fwPage <= 1 ? 'disabled' : ''}>&#9664; Prev</button>`;
            html += `<span>Page ${fwPage} of ${totalPages}</span>`;
            html += `<button class="btn btn-sm" style="padding:4px 10px;" onclick="window._fwPage(${fwPage + 1})" ${fwPage >= totalPages ? 'disabled' : ''}>Next &#9654;</button>`;
        }
        html += `</div>`;

        container.innerHTML = html;
    }

    // Expose sort/search/page handlers on window for this instance
    window._fwSort = function(colKey) {
        if (sortCol === colKey) sortDir = -sortDir;
        else { sortCol = colKey; sortDir = 1; }
        fwPage = 1;
        buildTable();
    };
    window._fwSearch = function(val) {
        searchTerm = val;
        fwPage = 1;
        buildTable();
    };
    window._fwPage = function(p) {
        fwPage = p;
        buildTable();
    };
    window._fwSetPageSize = function(val) {
        FW_PAGE_SIZE = parseInt(val) || 9999;
        fwPage = 1;
        buildTable();
    };
    buildTable();
}

// ─── FY STATEMENT TAB ────────────────────────────────────────────────────

const FY_MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March'];

async function renderFYStatementTab(container, toolbar) {
    toolbar.innerHTML = '';
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';

    // Determine current FY
    const now = new Date();
    const curMonth = now.getMonth() + 1;
    let fyStartYear = now.getFullYear();
    if (curMonth < 4) fyStartYear--;
    const defaultFY = fyStartYear - 1; // Default to last completed FY

    // FY selector
    const sel = document.createElement('select');
    sel.id = 'fy-select';
    sel.style.cssText = 'padding:6px 12px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-card);color:var(--text-primary);font-size:0.85rem;';
    for (let y = 2024; y <= now.getFullYear(); y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y + '-' + String(y + 1).slice(-2);
        if (y === defaultFY) opt.selected = true;
        sel.appendChild(opt);
    }
    sel.onchange = () => buildStatement();
    toolbar.appendChild(sel);

    // Export buttons
    const pdfBtn = document.createElement('button');
    pdfBtn.className = 'btn btn-sm';
    pdfBtn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> PDF';
    pdfBtn.onclick = () => exportFYStatementPDF(parseInt(sel.value));
    toolbar.appendChild(pdfBtn);

    const xlsBtn = document.createElement('button');
    xlsBtn.className = 'btn btn-sm';
    xlsBtn.innerHTML = '<i class="fa-solid fa-file-excel"></i> Excel';
    xlsBtn.onclick = () => exportFYStatementExcel(parseInt(sel.value));
    toolbar.appendChild(xlsBtn);

    async function buildStatement() {
        const fy = parseInt(sel.value);
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';

        const data = await getFYStatementData(fy);
        if (!data || data.rows.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fa-solid fa-building"></i><br>No data found.</div>';
            return;
        }

        const fyMonths = data.fyMonths;
        const monthLabels = data.monthLabels;
        let html = `<div style="overflow-x:auto;max-width:100%;">
            <table class="data-table" style="font-size:0.75rem;white-space:nowrap;">
            <thead><tr>
                <th style="position:sticky;left:0;z-index:2;background:var(--bg-card);">Flat No</th>
                <th style="min-width:160px;">Name</th>
                <th style="color:var(--color-rose);">Opening<br>Balance</th>`;
        monthLabels.forEach(label => {
            html += `<th style="min-width:48px;">${label}</th>`;
        });
        html += `<th style="color:var(--color-emerald);">TOTAL<br>OF FY</th>`;
        html += `<th style="color:var(--color-blue);">CUMULATIVE<br>TOTAL</th>`;
        html += `</tr></thead><tbody>`;

        for (const r of data.rows) {
            html += `<tr>
                <td style="position:sticky;left:0;z-index:1;background:var(--bg-card);font-weight:700;">${escapeHtml(r.flat_no)}</td>
                <td>${escapeHtml(r.name)}</td>
                <td style="font-weight:700;color:var(--color-rose);">${formatCurrency(r.ob)}</td>`;
            fyMonths.forEach(m => {
                html += `<td>${r.monthlyPaid[m] > 0 ? formatCurrency(r.monthlyPaid[m]) : '—'}</td>`;
            });
            html += `<td style="font-weight:700;color:var(--color-emerald);">${formatCurrency(r.fyTotal)}</td>`;
            html += `<td style="font-weight:700;color:var(--color-blue);">${formatCurrency(r.cumulative)}</td>`;
            html += `</tr>`;
        }

        html += `<tr style="font-weight:700;background:var(--bg-card);border-top:2px solid var(--border-color);">
            <td style="position:sticky;left:0;z-index:1;background:var(--bg-card);">TOTAL</td>
            <td></td>
            <td style="color:var(--color-rose);">${formatCurrency(data.grandOpening)}</td>`;
        fyMonths.forEach(m => {
            html += `<td>${data.grandMonths[m] > 0 ? formatCurrency(data.grandMonths[m]) : '—'}</td>`;
        });
        html += `<td style="color:var(--color-emerald);">${formatCurrency(data.grandFYTotal)}</td>`;
        html += `<td style="color:var(--color-blue);">${formatCurrency(data.grandCumulative)}</td>`;
        html += `</tr></tbody></table></div>`;

        html += `<div style="margin-top:8px;font-size:0.75rem;color:var(--text-muted);">
            FY: ${fy}-${String(fy+1).slice(-2)} | ${data.rows.length} flats | Opening Balance: ${formatCurrency(data.grandOpening)} | FY Total: ${formatCurrency(data.grandFYTotal)} | Cumulative: ${formatCurrency(data.grandCumulative)}
        </div>`;

        container.innerHTML = html;
    }

    await buildStatement();
}

async function getFYStatementData(fy) {
    const fyMonths = FY_MONTHS;
    const fyYears = {};
    fyMonths.forEach((m, i) => {
        fyYears[m] = i < 9 ? fy : fy + 1;
    });

    // Fetch FY income
    const { data: allIncome } = await sbClient.from('income')
        .select('flat_no, month, year, amount, status')
        .eq('category', 'Monthly Maintenance')
        .in('month', fyMonths)
        .in('year', [...new Set(Object.values(fyYears))].map(String));

    const flatMonthPaid = {};
    for (const inc of (allIncome || [])) {
        if (!inc.flat_no) continue;
        const st = inc.status || 'approved';
        if (st === 'pending' || st === 'rejected') continue;
        if (!flatMonthPaid[inc.flat_no]) flatMonthPaid[inc.flat_no] = {};
        flatMonthPaid[inc.flat_no][inc.month] = (flatMonthPaid[inc.flat_no][inc.month] || 0) + parseFloat(inc.amount);
    }

    // Fetch flats
    const { data: allFlats } = await sbClient.from('owners')
        .select('flat_no, flat_type, owner_name')
        .order('flat_no');

    if (!allFlats || allFlats.length === 0) return null;

    // Fetch older income for opening balance
    const { data: older } = await sbClient.from('income')
        .select('flat_no, month, year, amount, status')
        .eq('category', 'Monthly Maintenance')
        .or('year.lt.' + String(fy) + ',year.eq.' + String(fy) + '.and.month.lt.April');

    const olderPaidMap = {};
    for (const inc of (older || [])) {
        if (!inc.flat_no) continue;
        const st = inc.status || 'approved';
        if (st === 'pending' || st === 'rejected') continue;
        if (!olderPaidMap[inc.flat_no]) olderPaidMap[inc.flat_no] = {};
        olderPaidMap[inc.flat_no][inc.month + '-' + inc.year] = (olderPaidMap[inc.flat_no][inc.month + '-' + inc.year] || 0) + parseFloat(inc.amount);
    }

    const rates = await loadRates();
    const getRate = (ft, m, y) => {
        const ds = y + '-' + String(fyMonths.indexOf(m) + 1).padStart(2, '0') + '-01';
        const r = getRateOnDate(ft, rates, ds);
        return r ? parseFloat(r.amount) : 0;
    };

    // Calculate opening balances (pending before fy)
    const allMonthsBefore = [];
    for (let y = 2024; y < fy; y++) {
        for (const m of fyMonths) allMonthsBefore.push({ month: m, year: y });
    }
    const openingBalances = {};
    for (const flat of allFlats) {
        let pending = 0;
        for (const pm of allMonthsBefore) {
            const key = pm.month + '-' + pm.year;
            const paid = (olderPaidMap[flat.flat_no] && olderPaidMap[flat.flat_no][key]) || 0;
            const rate = getRate(flat.flat_type, pm.month, pm.year);
            if (rate > 0 && paid < rate) pending += rate - paid;
        }
        openingBalances[flat.flat_no] = pending;
    }

    // Build rows
    const rows = [];
    let grandOpening = 0, grandFYTotal = 0, grandCumulative = 0;
    const grandMonths = {};
    fyMonths.forEach(m => grandMonths[m] = 0);

    for (const flat of allFlats) {
        const ob = openingBalances[flat.flat_no] || 0;
        const monthlyPaid = {};
        let fyTotal = 0;
        fyMonths.forEach(m => {
            const amt = (flatMonthPaid[flat.flat_no] && flatMonthPaid[flat.flat_no][m]) || 0;
            monthlyPaid[m] = amt; fyTotal += amt; grandMonths[m] += amt;
        });
        const cumulative = ob + fyTotal;
        grandOpening += ob; grandFYTotal += fyTotal; grandCumulative += cumulative;
        rows.push({
            flat_no: flat.flat_no,
            name: window.displayStructured(flat.owner_name, 'name') || flat.owner_name || '—',
            ob, monthlyPaid, fyTotal, cumulative
        });
    }

    const monthLabels = fyMonths.map((m, i) => {
        const y = i < 9 ? String(fy).slice(-2) : String(fy + 1).slice(-2);
        return m.substring(0, 3).toUpperCase() + ' ' + y;
    });

    return { rows, grandOpening, grandFYTotal, grandCumulative, grandMonths, fyMonths, monthLabels };
}

window.exportFYStatementExcel = async function(fy) {
    if (typeof XLSX === 'undefined') { showToast('Excel library not loaded.', 'error'); return; }
    const data = await getFYStatementData(fy);
    if (!data || data.rows.length === 0) { showToast('No data to export.', 'info'); return; }

    const headers = ['Flat No', 'Name', 'Opening Balance'];
    data.monthLabels.forEach(l => headers.push(l));
    headers.push('TOTAL OF FY', 'CUMULATIVE TOTAL');

    const rows = [headers];
    for (const r of data.rows) {
        const row = [r.flat_no, r.name, r.ob];
        data.fyMonths.forEach(m => row.push(r.monthlyPaid[m] || 0));
        row.push(r.fyTotal, r.cumulative);
        rows.push(row);
    }

    // Grand total row
    const totalRow = ['TOTAL', '', data.grandOpening];
    data.fyMonths.forEach(m => totalRow.push(data.grandMonths[m] || 0));
    totalRow.push(data.grandFYTotal, data.grandCumulative);
    rows.push(totalRow);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    // Format currency columns
    const colRange = XLSX.utils.decode_range(ws['!ref']);
    for (let c = 2; c <= colRange.e.c; c++) {
        for (let r = 1; r <= colRange.e.r; r++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            if (ws[addr] && typeof ws[addr].v === 'number') {
                ws[addr].z = '#,##0.00';
            }
        }
    }
    XLSX.utils.book_append_sheet(wb, ws, 'FY Statement');
    XLSX.writeFile(wb, 'FY_Statement_' + fy + '-' + String(fy + 1).slice(-2) + '.xlsx');
};

window.exportFYStatementPDF = async function(fy) {
    if (!window.jspdf) { showToast('PDF library not loaded.', 'error'); return; }
    const data = await getFYStatementData(fy);
    if (!data || data.rows.length === 0) { showToast('No data to export.', 'info'); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    const pageW = 420, pageH = 297, margin = 8;
    const contentW = pageW - 2 * margin;
    let y = margin;

    function checkPage(needed) {
        if (y + needed > pageH - margin) { doc.addPage(); y = margin; }
    }

    doc.setFontSize(11);
    const title = 'FY Statement - ' + fy + '-' + String(fy + 1).slice(-2);
    doc.text(title, pageW / 2, y + 6, { align: 'center' });
    y += 12;

    const headers = ['Flat No', 'Name', 'Opening'];
    data.monthLabels.forEach(l => headers.push(l));
    headers.push('FY Total', 'Cumulative');

    // Column widths: flat=14, name=36, ob=16, 12 months * 14=168, fy=18, cum=18
    const colW = [14, 36, 16];
    data.fyMonths.forEach(() => colW.push(14));
    colW.push(18, 18);
    const sumColW = colW.reduce((s, w) => s + w, 0);
    // Scale if needed
    const availW = contentW;
    const scale = sumColW > availW ? availW / sumColW : 1;
    const scaledW = colW.map(w => w * scale);

    doc.setFontSize(6);
    doc.setFillColor(15, 23, 42);
    doc.setTextColor(255, 255, 255);
    doc.rect(margin, y, contentW, 5, 'F');
    let x = margin + 1;
    headers.forEach((h, i) => {
        const lines = doc.splitTextToSize(h, scaledW[i] - 1);
        doc.text(lines, x + 0.5, y + 2.5);
        x += scaledW[i];
    });
    y += 5;

    doc.setTextColor(30, 30, 30);
    let rowIdx = 0;
    for (const r of data.rows) {
        checkPage(5);
        if (rowIdx % 2 === 1) { doc.setFillColor(240, 240, 245); doc.rect(margin, y, contentW, 4.5, 'F'); }
        x = margin + 1;
        const vals = [
            String(r.flat_no), r.name, formatCurrency(r.ob),
            ...data.fyMonths.map(m => r.monthlyPaid[m] ? formatCurrency(r.monthlyPaid[m]) : '—'),
            formatCurrency(r.fyTotal), formatCurrency(r.cumulative)
        ];
        vals.forEach((v, i) => {
            doc.text(v, x + 0.5, y + 3, { maxWidth: scaledW[i] - 1 });
            x += scaledW[i];
        });
        y += 4.5;
        rowIdx++;
    }

    // Total row
    checkPage(5);
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 1;
    x = margin + 1;
    const totalVals = [
        'TOTAL', '', formatCurrency(data.grandOpening),
        ...data.fyMonths.map(m => data.grandMonths[m] ? formatCurrency(data.grandMonths[m]) : '—'),
        formatCurrency(data.grandFYTotal), formatCurrency(data.grandCumulative)
    ];
    totalVals.forEach((v, i) => {
        doc.text(v, x + 0.5, y + 3, { maxWidth: scaledW[i] - 1 });
        x += scaledW[i];
    });

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const fname = 'FY_Statement_' + fy + '-' + String(fy + 1).slice(-2) + '.pdf';
    if (isMobile) doc.save(fname);
    else {
        const uri = doc.output('datauristring');
        const w = window.open();
        if (w) w.document.write('<iframe width="100%" height="100%" src="' + uri + '"></iframe>');
        else doc.save(fname);
    }
};

// ─── PENDING APPROVALS TAB ────────────────────────────────────────────────

async function renderPendingApprovalsTab(container, toolbar) {
    toolbar.innerHTML = '';
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';

    if (!hasPermission('income:approve') && !hasPermission('income:create')) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fa-solid fa-lock"></i><br>Access Denied</div>';
        return;
    }

    let pendings = [];
    let ownerMap = {};
    try {
        const { data: owners } = await sbClient.from('owners').select('flat_no, owner_name');
        if (owners) {
            owners.forEach(o => {
                const name = window.displayStructured(o.owner_name, 'name') || o.owner_name || '';
                ownerMap[o.flat_no] = name;
            });
        }
    } catch {}
    try {
        const { data } = await sbClient.from('income')
            .select('*')
            .eq('category', 'Monthly Maintenance')
            .eq('status', 'pending')
            .order('id', { ascending: false });
        if (data) pendings = data;
    } catch {
        // status column may not exist yet
        try {
            const { data } = await sbClient.from('income')
                .select('*')
                .eq('category', 'Monthly Maintenance')
                .order('id', { ascending: false });
            if (data) pendings = data.filter(r => r.status === 'pending');
        } catch { pendings = []; }
    }

    if (pendings.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fa-solid fa-circle-check" style="font-size:2rem;color:var(--color-emerald);"></i><br><br><strong>All caught up!</strong><br>No pending payment requests.</div>';
        return;
    }

    let html = `<div style="margin-bottom:12px;font-size:0.85rem;color:var(--text-secondary);">${pendings.length} payment request(s) awaiting approval</div>`;
    html += '<table class="data-table"><thead><tr><th>Flat</th><th>Month</th><th>Amount</th><th>Payment Mode</th><th>Ref No.</th><th>Payment Date</th><th>Requested By</th><th>Actions</th></tr></thead><tbody>';

    for (const p of pendings) {
        const requester = ownerMap[p.flat_no] || p.flat_no;
        html += `<tr>
            <td><strong>${escapeHtml(p.flat_no)}</strong></td>
            <td>${escapeHtml(p.month)} ${escapeHtml(p.year)}</td>
            <td style="font-weight:700;color:var(--color-emerald);">${formatCurrency(p.amount)}</td>
            <td>${escapeHtml(p.payment_mode || '—')}</td>
            <td style="font-size:0.8rem;">${escapeHtml(p.ref_number || '—')}</td>
            <td style="font-size:0.8rem;">${p.payment_date || '—'}</td>
            <td style="font-size:0.8rem;">${escapeHtml(requester)}</td>
            <td>
                <button class="btn btn-sm" style="background:var(--color-emerald);color:#fff;" onclick='approvePayment("${p.id}")'><i class="fa-solid fa-check"></i> Approve</button>
                <button class="btn btn-sm" style="background:var(--color-rose);color:#fff;margin-left:4px;" onclick='rejectPayment("${p.id}")'><i class="fa-solid fa-xmark"></i> Reject</button>
            </td>
        </tr>`;
    }
    html += '</tbody></table>';
    container.innerHTML = html;
}

window.approvePayment = async function(id) {
    const { isConfirmed: apr } = await Swal.fire({ title: 'Confirm', text: 'Approve this payment?', icon: 'question', showCancelButton: true, confirmButtonColor: '#059669', confirmButtonText: 'Approve', cancelButtonText: 'Cancel' });
    if (!apr) return;
    try {
        const approver = window.currentUserName || window.currentUserEmail || 'System';
        const { data: updated, error } = await sbClient.from('income')
            .update({
                status: 'approved',
                collected_by: approver,
                approved_by: approver,
                approved_at: new Date().toISOString()
            })
            .eq('id', id)
            .select();
        if (error) throw error;
        if (!updated || updated.length === 0) throw new Error('No rows updated. Your role does not have permission to approve payments. Ask an admin to assign "Income → Approve" permission to your role.');
        showToast('Payment approved.', 'success');
        const container = document.getElementById('maintenance-container');
        const toolbar = document.getElementById('maintenance-toolbar');
        if (container && toolbar) await renderPendingApprovalsTab(container, toolbar);
    } catch (err) {
        showToast('Error approving payment: ' + err.message, 'error');
    }
};

window.rejectPayment = async function(id) {
    const { isConfirmed: rej } = await Swal.fire({ title: 'Confirm', text: 'Reject this payment?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc2626', confirmButtonText: 'Reject', cancelButtonText: 'Cancel' });
    if (!rej) return;
    try {
        const { data: updated, error } = await sbClient.from('income')
            .update({
                status: 'rejected',
                approved_by: window.currentUserName || window.currentUserEmail || null,
                approved_at: new Date().toISOString()
            })
            .eq('id', id)
            .select();
        if (error) throw error;
        if (!updated || updated.length === 0) throw new Error('No rows updated. Your role does not have permission to reject payments. Ask an admin to assign "Income → Approve" permission to your role.');
        showToast('Payment rejected.', 'success');
        const container = document.getElementById('maintenance-container');
        const toolbar = document.getElementById('maintenance-toolbar');
        if (container && toolbar) await renderPendingApprovalsTab(container, toolbar);
    } catch (err) {
        showToast('Error rejecting payment: ' + err.message, 'error');
    }
};

window.markDeposited = async function(id) {
    const { isConfirmed: dep } = await Swal.fire({ title: 'Confirm', text: 'Mark this collection as deposited to treasurer?', icon: 'question', showCancelButton: true, confirmButtonColor: '#6366f1', confirmButtonText: 'Yes, mark deposited', cancelButtonText: 'Cancel' });
    if (!dep) return;
    try {
        const depositor = window.currentUserName || window.currentUserEmail || 'System';
        const now = new Date().toISOString();
        const { error: upErr } = await sbClient.from('income')
            .update({
                deposit_status: 'deposited',
                deposited_by: depositor,
                deposited_at: now
            })
            .eq('id', id);
        if (upErr) throw upErr;
        // Also log to deposit_log
        const { data: row } = await sbClient.from('income').select('amount').eq('id', id).single();
        if (row) {
            await sbClient.from('deposit_log').insert({
                income_id: id,
                deposited_by: depositor,
                deposited_at: now,
                amount: parseFloat(row.amount)
            }).maybeSingle();
        }
        showToast('Marked as deposited.', 'success');
        // Refresh the current view
        const container = document.getElementById('maintenance-container');
        const toolbar = document.getElementById('maintenance-toolbar');
        if (container && toolbar) {
            const selMonth = parseInt(document.querySelector('#maintenance-toolbar select.modern-select')?.value) || new Date().getMonth() + 1;
            const selYear = parseInt(document.querySelector('#maintenance-toolbar input[type=number]')?.value) || new Date().getFullYear();
            await renderCollectionsData(container, selMonth, selYear);
        }
    } catch (err) {
        showToast('Error marking deposit: ' + err.message, 'error');
    }
};
