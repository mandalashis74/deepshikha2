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

// Occupancy history helpers
let _allOccupancyHistory = null;
let _histByFlat = {};
async function loadAllOccupancyHistory() {
    if (_allOccupancyHistory) return { history: _allOccupancyHistory, byFlat: _histByFlat };
    try {
        const { data } = await sbClient.from('occupancy_history').select('*').order('occupancy_from');
        _allOccupancyHistory = data || [];
        _histByFlat = {};
        for (const h of _allOccupancyHistory) {
            if (!_histByFlat[h.flat_no]) _histByFlat[h.flat_no] = [];
            _histByFlat[h.flat_no].push(h);
        }
    } catch { _allOccupancyHistory = []; _histByFlat = {}; }
    return { history: _allOccupancyHistory, byFlat: _histByFlat };
}

function clearOccupancyHistoryCache() { _allOccupancyHistory = null; _histByFlat = {}; }

function getPeriodsForFlat(flat, histByFlat) {
    const hist = histByFlat[flat.flat_no];
    if (hist && hist.length > 0) return hist;
    // Fall back to flat's occupancy fields
    if (flat.occupancy_from || flat.occupancy_to) {
        return [{
            occupancy_from: flat.occupancy_from,
            occupancy_to: flat.occupancy_to,
            occupancy_type: flat.occupancy_status === 'tenant-occupied' ? 'tenant' : 'owner'
        }];
    }
    return [];
}

function isMonthInPeriods(month, year, periods) {
    for (const p of periods) {
        const fromDate = p.occupancy_from ? new Date(p.occupancy_from + 'T00:00:00') : null;
        const toDate = p.occupancy_to ? new Date(p.occupancy_to + 'T00:00:00') : null;
        const checkDate = new Date(year, month - 1, 1);
        if (fromDate && checkDate < fromDate) continue;
        if (toDate && checkDate > toDate) continue;
        return true;
    }
    return false;
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
    const ackTab = document.querySelector('#maintenance-tabs .pill[data-mt="acknowledgement"]');
    if (ackTab) {
        ackTab.style.display = window.hasPermission('income:acknowledge') ? '' : 'none';
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
    const ackTab = document.querySelector('#maintenance-tabs .pill[data-mt="acknowledgement"]');
    if (ackTab) {
        ackTab.style.display = window.hasPermission('income:acknowledge') ? '' : 'none';
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
    } else if (tab === 'acknowledgement') {
        await renderAcknowledgementTab(container, toolbar);
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
            const monthLabel = selMonth > 0 ? monthNames[selMonth - 1] : 'All Months';
            pdf.onclick = () => exportCollectionsPDF(selMonth, selYear, monthLabel);
            xls.onclick = () => exportCollectionsExcel(selMonth, selYear, monthLabel);
        } else {
            pdf.onclick = () => {
                if (currentFlatNo === 'all') {
                    exportCollectionsPDF(0, new Date().getFullYear(), 'All Flats');
                } else {
                    exportFlatwisePDF(currentFlatNo);
                }
            };
            xls.onclick = () => {
                if (currentFlatNo === 'all') {
                    exportCollectionsExcel(0, new Date().getFullYear(), 'All Flats');
                } else {
                    exportFlatwiseExcel(currentFlatNo);
                }
            };
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
    const allOpt = document.createElement('option');
    allOpt.value = '0'; allOpt.textContent = 'All Months';
    if (selMonth === 0) allOpt.selected = true;
    monthPicker.appendChild(allOpt);
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
        if (flatNo === 'all') {
            currentMode = 'flat';
            highlightMode('flat');
            const year = new Date().getFullYear();
            await renderCollectionsData(container, 0, year);
        } else if (flatNo) {
            await renderFlatwiseData(container, flatNo);
        }
    };

    // Populate flat picker
    const isSoftLoginMode = localStorage.getItem('isSoftLogin') === 'true';
    const softLoginFlatNo = localStorage.getItem('currentFlatNo') || '';
    try {
        const { data: flats } = await sbClient.from('owners').select('flat_no, owner_name').order('flat_no');
        if (flats) {
            const allOpt = document.createElement('option');
            allOpt.value = 'all'; allOpt.textContent = 'All Flats';
            flatPicker.appendChild(allOpt);
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
        if (flatPicker.value === 'all') {
            const year = new Date().getFullYear();
            currentFlatNo = 'all';
            renderCollectionsData(container, 0, year);
        } else if (flatPicker.value) {
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

    const { byFlat: histByFlat } = await loadAllOccupancyHistory();
    const rates = await loadRates();
    const isAllMonths = !month || month === 0;
    
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
    const currentCollectedMap = {}; // for the selected month/year only
    const currentStatusMap = {}; // flat_no -> best status for selected period
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
        const matchesPeriod = isAllMonths
            ? String(c.year) === String(year)
            : c.month === selMonthStr && String(c.year) === String(year);
        if (matchesPeriod) {
            if (st !== 'pending' && st !== 'rejected') {
                if (!currentCollectedMap[c.flat_no]) {
                    currentCollectedMap[c.flat_no] = { ...c, amount: parseFloat(c.amount) };
                } else {
                    currentCollectedMap[c.flat_no].amount += parseFloat(c.amount);
                }
            }
            // Track best status for display
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

    // Exclude unsold flats from maintenance charges
    allFlats = allFlats.filter(f => f.occupancy_status !== 'unsold');

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
    function calcFlatPending(flat, upToMonth, upToYear, collMap, ratesList, periods) {
        periods = periods || getPeriodsForFlat(flat, histByFlat);
        if (periods.length === 0 && !flat.occupancy_from && !flat.occupancy_to) return { totalPending: 0, unpaidCount: 0 };
        const mNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        
        let totalPending = 0;
        let unpaidCount = 0;
        // Determine date range to scan: from min period start (or 12mo ago) to upToMonth
        let earliestFrom = null;
        for (const p of periods) {
            if (p.occupancy_from) {
                const d = new Date(p.occupancy_from + 'T00:00:00');
                if (!earliestFrom || d < earliestFrom) earliestFrom = d;
            }
        }
        let startM, startY;
        if (earliestFrom) {
            startM = earliestFrom.getMonth() + 1;
            startY = earliestFrom.getFullYear();
        } else if (flat.occupancy_from) {
            const d = new Date(flat.occupancy_from + 'T00:00:00');
            startM = d.getMonth() + 1;
            startY = d.getFullYear();
        } else {
            const d = new Date(upToYear, upToMonth - 1);
            d.setMonth(d.getMonth() - 12);
            startM = d.getMonth() + 1;
            startY = d.getFullYear();
        }
        
        let endM = upToMonth, endY = upToYear;
        // Also cap at the latest period's occupancy_to if it ended before selected month
        for (const p of periods) {
            if (p.occupancy_to) {
                const d = new Date(p.occupancy_to + 'T00:00:00');
                const dm = d.getMonth() + 1;
                const dy = d.getFullYear();
                if (dy < endY || (dy === endY && dm < endM)) {
                    endM = dm; endY = dy;
                }
            }
        }
        if (flat.occupancy_to) {
            const d = new Date(flat.occupancy_to + 'T00:00:00');
            const dm = d.getMonth() + 1;
            const dy = d.getFullYear();
            if (dy < endY || (dy === endY && dm < endM)) {
                endM = dm; endY = dy;
            }
        }
        
        let ym = startY * 12 + startM;
        const endYm = endY * 12 + endM;
        while (ym <= endYm) {
            const m = ((ym - 1) % 12) + 1;
            const y = Math.floor((ym - 1) / 12);
            // Skip months not in any occupancy period
            if (!isMonthInPeriods(m, y, periods) && !(periods.length === 0 && flat.occupancy_from)) {
                ym++; continue;
            }
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
        const effectiveMonth = isAllMonths ? 12 : month;
        const { totalPending } = calcFlatPending(flat, effectiveMonth, year, paidMap, rates);
        totalCumulativePending += totalPending;
    }

    const today = new Date().toISOString().split('T')[0];
    const periodLabel = isAllMonths ? 'this year' : 'this month';
    const now = new Date();
    let html = `<div style="margin-bottom:12px;font-size:0.85rem;color:var(--text-secondary);display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
        <span>${allFlats.length} flats · ${allFlats.filter(f => currentCollectedMap[f.flat_no]).length} collected ${periodLabel} · ${formatCurrency(totalCollectedAmt)} total collected · <span style="color:var(--color-rose);font-weight:600;">${formatCurrency(totalCumulativePending)} cumulative pending</span></span>
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
        const refDate = new Date(year, isAllMonths ? 11 : month - 1, 1);
        const inOccupancy = (!occFrom || refDate >= occFrom) && (!occTo || refDate <= occTo);
        const isVacant = flat.occupancy_status === 'vacant' || flat.occupancy_status === 'unsold' || (flat.occupancy_to && flat.occupancy_to <= today);
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

        const buttonMonth = isAllMonths ? (now.getMonth() + 1) : month;
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
            <td style="font-size:0.75rem;">${currentCol && (currentCol.acknowledgement_status === 'acknowledged' || currentCol.deposit_status === 'deposited')
                ? currentCol.acknowledgement_status === 'acknowledged'
                    ? `<span style="color:var(--color-emerald);font-weight:600;"><i class="fa-solid fa-check-double"></i> Acknowledged</span><br><span style="font-size:0.6rem;color:var(--text-muted);">by ${escapeHtml(currentCol.acknowledged_by || '—')}</span>`
                    : `<span style="color:var(--color-emerald);font-weight:600;"><i class="fa-solid fa-check-circle"></i> Deposited</span><br><span style="font-size:0.6rem;color:var(--text-muted);">by ${escapeHtml(currentCol.deposited_by || '—')}</span>`
                : currentCol && currentCol.deposit_status !== 'deposited'
                    ? '<span style="color:var(--color-orange);font-weight:600;"><i class="fa-solid fa-hourglass-half"></i> Pending Deposit</span>'
                    : '<span style="color:var(--text-muted);">—</span>'
            }</td>
            <td style="font-size:0.8rem;color:var(--text-secondary);">${lastPaidDate ? lastPaidDate + ' (' + lastPaidStr + ')' : lastPaidStr}</td>
            <td>${isPending
                ? '<span style="font-size:0.75rem;color:var(--color-orange);"><i class="fa-solid fa-hourglass-half"></i> Awaiting approval</span>'
                : isRejected
                    ? (isOwnFlat
                        ? `<button class="btn btn-sm" onclick='openIncomeModalForCollection("${flat.flat_no}","${flat.flat_type}",${buttonMonth},${year},${rateAmount})'><i class="fa-solid fa-rotate"></i> Pay Again</button>`
                        : hasMaintenancePermission('maintenance:collect') && rateAmount > 0
                            ? `<button class="btn btn-sm" onclick='openIncomeModalForCollection("${flat.flat_no}","${flat.flat_type}",${buttonMonth},${year},${rateAmount})'><i class="fa-solid fa-hand-holding-dollar"></i> Collect</button>`
                            : '')
                    : isOwnFlat && !isApproved && effectiveInOccupancy && rateAmount > 0
                        ? `<button class="btn btn-sm" onclick='openIncomeModalForCollection("${flat.flat_no}","${flat.flat_type}",${buttonMonth},${year},${rateAmount})'><i class="fa-solid fa-hand-holding-dollar"></i> Pay Now</button>`
                        : (!isApproved || (isApproved && parseFloat(paidThisMonthAmt) < parseFloat(rateAmount))) && effectiveInOccupancy && hasMaintenancePermission('maintenance:collect') && rateAmount > 0
                            ? `<button class="btn btn-sm" onclick='openIncomeModalForCollection("${flat.flat_no}","${flat.flat_type}",${buttonMonth},${year},${rateAmount})'><i class="fa-solid fa-hand-holding-dollar"></i> Collect</button>`
                            : isApproved && isOwnFlat && !showAllFlats && !isAllMonths
                                ? `<button class="btn btn-sm" style="font-size:0.7rem;" onclick='generateReceipt("${(allCollections.filter(c => c.flat_no === flat.flat_no && c.month === selMonthStr && String(c.year) === String(year) && c.status === 'approved').pop() || {}).id || ""}")' title="View Receipt"><i class="fa-solid fa-file-pdf"></i></button>`
                                : isApproved && hasMaintenancePermission('maintenance:collect') && !showAllFlats && !isAllMonths
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

    const headers = ['Sr', 'Flat', 'Type', 'Owner', 'Rate', 'Paid', 'Pending', 'Status', 'Last Paid'];
    const colW = [8, 14, 12, 48, 18, 18, 20, 18, 38];
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
    const rowCount = visible.length - 1; // exclude the HTML total row
    visible.forEach((tr, idx) => {
        if (idx === rowCount) return; // skip the HTML total row
        checkPage(7);
        if (rowIdx % 2 === 1) { doc.setFillColor(240, 240, 245); doc.rect(margin, y, contentW, 7, 'F'); }
        const tds = tr.querySelectorAll('td');
        x = margin + 1;
        const vals = [String(rowIdx + 1)];
        for (let i = 0; i < Math.min(tds.length, headers.length - 1); i++) {
            vals.push(_pdfText(tds[i].textContent).substring(0, 40));
        }
        vals.forEach((v, i) => {
            doc.text(v, x + 1, y + 4, { maxWidth: colW[i] - 2 });
            x += colW[i];
        });
        y += 7;
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
        // HTML total row: td[0]="Total"(colspan3), td[1]=Rate, td[2]=Paid, td[3]=Pending, td[4]=""(colspan4)
        // PDF cols: Sr, Flat, Type, Owner, Rate, Paid, Pending, Status, Last Paid
        const vals = ['', _pdfText(tds[0].textContent), '', '',
            _pdfText(tds[1].textContent || ''),
            _pdfText(tds[2].textContent || ''),
            _pdfText(tds[3].textContent || ''),
            '', ''];
        x = margin + 1;
        vals.forEach((v, i) => {
            doc.text(v, x + 1, y + 4, { maxWidth: colW[i] - 2 });
            x += colW[i];
        });
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
    const { byFlat: histByFlat } = await loadAllOccupancyHistory();
    
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

    const periods = flatInfo ? getPeriodsForFlat(flatInfo, histByFlat) : [];
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
        const isOccupied = periods.length > 0 ? isMonthInPeriods(m, y, periods) : ((!occFrom || new Date(y, m - 1, 1) >= occFrom) && (!occTo || new Date(y, m - 1, 1) <= occTo));
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
    const { byFlat: histByFlat } = await loadAllOccupancyHistory();
    const rates = await loadRates();
    let allFlats = [];
    try {
        const { data } = await sbClient.from('owners').select('flat_no, flat_type, owner_name, occupancy_status, occupancy_from, occupancy_to').order('flat_no');
        if (data) allFlats = data;
    } catch { allFlats = []; }

    // Exclude unsold flats
    allFlats = allFlats.filter(f => f.occupancy_status !== 'unsold');

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
        const periods = getPeriodsForFlat(flat, histByFlat);
        for (const pm of pendingMonths) {
            if (!isMonthInPeriods(pm.month, pm.year, periods) && !(periods.length === 0 && flat.occupancy_from)) continue;
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

    const { byFlat: histByFlat } = await loadAllOccupancyHistory();

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

    const periods = getPeriodsForFlat(flat, histByFlat);
    const collData = collections.data || [];
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    const collMap = {};
    for (const c of collData) {
        const key = c.month + '-' + c.year;
        collMap[key] = c;
    }

    const now = new Date();
    // Determine date range from periods (or fallback)
    let earliestFrom = null;
    for (const p of periods) {
        if (p.occupancy_from) {
            const d = new Date(p.occupancy_from + 'T00:00:00');
            if (!earliestFrom || d < earliestFrom) earliestFrom = d;
        }
    }
    const occFrom = earliestFrom || (flat.occupancy_from ? new Date(flat.occupancy_from + 'T00:00:00') : new Date(now.getFullYear() - 1, now.getMonth(), 1));
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
        const isVacant = flat.occupancy_status === 'vacant' || flat.occupancy_status === 'unsold';
        const inOccupancy = isMonthInPeriods(m, y, periods) || (!periods.length && (!occFrom || new Date(dateStr) >= occFrom) && (!occTo || new Date(dateStr) <= occTo));
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

const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

async function renderFYStatementTab(container, toolbar) {
    toolbar.innerHTML = '';
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';

    const now = new Date();
    const defaultYear = now.getFullYear() - 1;

    const sel = document.createElement('select');
    sel.id = 'fy-select';
    sel.style.cssText = 'padding:6px 12px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-card);color:var(--text-primary);font-size:0.85rem;';
    for (let y = 2024; y <= now.getFullYear(); y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = String(y);
        if (y === defaultYear) opt.selected = true;
        sel.appendChild(opt);
    }
    sel.onchange = () => buildStatement();
    toolbar.appendChild(sel);

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
        const year = parseInt(sel.value);
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';

        const data = await getCalYearStatementData(year);
        if (!data || data.rows.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fa-solid fa-building"></i><br>No data found.</div>';
            return;
        }

        const calMonths = data.calMonths;
        let html = '<div style="overflow-x:auto;max-width:100%;"><table class="data-table" style="font-size:0.75rem;white-space:nowrap;"><thead><tr>';
        html += '<th style="position:sticky;left:0;z-index:2;background:var(--bg-card);">Flat No</th>';
        html += '<th style="min-width:160px;">Name</th>';
        html += '<th style="color:var(--color-rose);">Brought<br>Forward</th>';
        calMonths.forEach(m => {
            html += '<th style="min-width:42px;">' + m.substring(0, 3).toUpperCase() + '</th>';
        });
        html += '<th style="color:var(--color-emerald);">TOTAL<br>OF YEAR</th>';
        html += '<th style="color:var(--color-blue);">CUMULATIVE<br>TOTAL</th>';
        html += '</tr></thead><tbody>';

        for (const r of data.rows) {
            html += '<tr>';
            html += '<td style="position:sticky;left:0;z-index:1;background:var(--bg-card);font-weight:700;">' + escapeHtml(r.flat_no) + '</td>';
            html += '<td>' + escapeHtml(r.name) + '</td>';
            html += '<td style="font-weight:700;color:var(--color-rose);">' + formatCurrency(r.bf) + '</td>';
            calMonths.forEach(m => {
                html += '<td>' + (r.monthlyPaid[m] > 0 ? formatCurrency(r.monthlyPaid[m]) : '—') + '</td>';
            });
            html += '<td style="font-weight:700;color:var(--color-emerald);">' + formatCurrency(r.yearTotal) + '</td>';
            html += '<td style="font-weight:700;color:var(--color-blue);">' + formatCurrency(r.cumulative) + '</td>';
            html += '</tr>';
        }

        html += '<tr style="font-weight:700;background:var(--bg-card);border-top:2px solid var(--border-color);">';
        html += '<td style="position:sticky;left:0;z-index:1;background:var(--bg-card);">TOTAL</td><td></td>';
        html += '<td style="color:var(--color-rose);">' + formatCurrency(data.grandBroughtForward) + '</td>';
        calMonths.forEach(m => {
            html += '<td>' + (data.grandMonths[m] > 0 ? formatCurrency(data.grandMonths[m]) : '—') + '</td>';
        });
        html += '<td style="color:var(--color-emerald);">' + formatCurrency(data.grandYearTotal) + '</td>';
        html += '<td style="color:var(--color-blue);">' + formatCurrency(data.grandCumulative) + '</td>';
        html += '</tr></tbody></table></div>';

        html += '<div style="margin-top:8px;font-size:0.75rem;color:var(--text-muted);">Year: ' + year + ' | ' + data.rows.length + ' flats | Brought Forward: ' + formatCurrency(data.grandBroughtForward) + ' | Year Total: ' + formatCurrency(data.grandYearTotal) + ' | Cumulative: ' + formatCurrency(data.grandCumulative) + '</div>';

        container.innerHTML = html;
    }

    await buildStatement();
}

async function getCalYearStatementData(year) {
    const calMonths = CAL_MONTHS;

    const { data: allIncome } = await sbClient.from('income')
        .select('flat_no, month, year, amount, status')
        .eq('category', 'Monthly Maintenance')
        .eq('year', String(year));

    const flatMonthPaid = {};
    for (const inc of (allIncome || [])) {
        if (!inc.flat_no) continue;
        const st = inc.status || 'approved';
        if (st === 'pending' || st === 'rejected') continue;
        if (!flatMonthPaid[inc.flat_no]) flatMonthPaid[inc.flat_no] = {};
        flatMonthPaid[inc.flat_no][inc.month] = (flatMonthPaid[inc.flat_no][inc.month] || 0) + parseFloat(inc.amount);
    }

    let { data: allFlats } = await sbClient.from('owners')
        .select('flat_no, flat_type, owner_name, occupancy_status, occupancy_from, occupancy_to')
        .order('flat_no');

    if (!allFlats || allFlats.length === 0) return null;

    // Soft login: only show the user's own flat
    const isSoftLogin = localStorage.getItem('isSoftLogin') === 'true';
    if (isSoftLogin) {
        const myFlat = localStorage.getItem('currentFlatNo') || '';
        allFlats = allFlats.filter(f => f.flat_no === myFlat);
        if (allFlats.length === 0) return null;
    }

    // Exclude unsold flats from statement data
    allFlats = allFlats.filter(f => f.occupancy_status !== 'unsold');
    if (allFlats.length === 0) return null;

    const { data: older } = await sbClient.from('income')
        .select('flat_no, month, year, amount, status')
        .eq('category', 'Monthly Maintenance')
        .lt('year', String(year));

    const olderPaidMap = {};
    for (const inc of (older || [])) {
        if (!inc.flat_no) continue;
        const st = inc.status || 'approved';
        if (st === 'pending' || st === 'rejected') continue;
        if (!olderPaidMap[inc.flat_no]) olderPaidMap[inc.flat_no] = {};
        olderPaidMap[inc.flat_no][inc.month + '-' + inc.year] = (olderPaidMap[inc.flat_no][inc.month + '-' + inc.year] || 0) + parseFloat(inc.amount);
    }

    const allMonthsBefore = [];
    for (let y = 2024; y < year; y++) {
        for (let i = 0; i < 12; i++) {
            allMonthsBefore.push({ month: calMonths[i], year: y });
        }
    }

    const broughtForward = {};
    for (const flat of allFlats) {
        let totalCollected = 0;
        for (const pm of allMonthsBefore) {
            const key = pm.month + '-' + pm.year;
            const paid = (olderPaidMap[flat.flat_no] && olderPaidMap[flat.flat_no][key]) || 0;
            totalCollected += paid;
        }
        broughtForward[flat.flat_no] = totalCollected;
    }

    const rows = [];
    let grandBroughtForward = 0, grandYearTotal = 0, grandCumulative = 0;
    const grandMonths = {};
    calMonths.forEach(m => grandMonths[m] = 0);

    for (const flat of allFlats) {
        const bf = broughtForward[flat.flat_no] || 0;
        const monthlyPaid = {};
        let yearTotal = 0;
        calMonths.forEach(m => {
            const amt = (flatMonthPaid[flat.flat_no] && flatMonthPaid[flat.flat_no][m]) || 0;
            monthlyPaid[m] = amt; yearTotal += amt; grandMonths[m] += amt;
        });
        const cumulative = bf + yearTotal;
        grandBroughtForward += bf; grandYearTotal += yearTotal; grandCumulative += cumulative;
        rows.push({
            flat_no: flat.flat_no,
            name: window.displayStructured(flat.owner_name, 'name') || flat.owner_name || '—',
            bf, monthlyPaid, yearTotal, cumulative
        });
    }

    return { rows, grandBroughtForward, grandYearTotal, grandCumulative, grandMonths, calMonths };
}

window.exportFYStatementExcel = async function(year) {
    if (typeof XLSX === 'undefined') { showToast('Excel library not loaded.', 'error'); return; }
    const data = await getCalYearStatementData(year);
    if (!data || data.rows.length === 0) { showToast('No data to export.', 'info'); return; }

    const headers = ['Flat No', 'Name', 'Brought Forward'];
    data.calMonths.forEach(m => headers.push(m.substring(0, 3).toUpperCase()));
    headers.push('TOTAL OF YEAR', 'CUMULATIVE TOTAL');

    const rows = [headers];
    for (const r of data.rows) {
        const row = [r.flat_no, r.name, r.bf];
        data.calMonths.forEach(m => row.push(r.monthlyPaid[m] || 0));
        row.push(r.yearTotal, r.cumulative);
        rows.push(row);
    }

    const totalRow = ['TOTAL', '', data.grandBroughtForward];
    data.calMonths.forEach(m => totalRow.push(data.grandMonths[m] || 0));
    totalRow.push(data.grandYearTotal, data.grandCumulative);
    rows.push(totalRow);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const colRange = XLSX.utils.decode_range(ws['!ref']);
    for (let c = 2; c <= colRange.e.c; c++) {
        for (let r = 1; r <= colRange.e.r; r++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            if (ws[addr] && typeof ws[addr].v === 'number') {
                ws[addr].z = '#,##0.00';
            }
        }
    }
    XLSX.utils.book_append_sheet(wb, ws, 'Year Statement');
    XLSX.writeFile(wb, 'Year_Statement_' + year + '.xlsx');
};

window.exportFYStatementPDF = async function(year) {
    if (!window.jspdf) { showToast('PDF library not loaded.', 'error'); return; }
    const data = await getCalYearStatementData(year);
    if (!data || data.rows.length === 0) { showToast('No data to export.', 'info'); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = 297, pageH = 210, margin = 8;
    const contentW = pageW - 2 * margin;
    let y = margin;

    function checkPage(needed) {
        if (y + needed > pageH - margin) { doc.addPage(); y = margin; }
    }
    const fmt = v => v ? Math.round(v).toLocaleString('en-IN') : '—';

    doc.setFontSize(10);
    doc.text(_pdfText('Year Statement - ' + year), pageW / 2, y + 5, { align: 'center' });
    y += 10;

    const headers = ['Sr', 'Flat No', 'Name', 'B/F'];
    data.calMonths.forEach(m => headers.push(m.substring(0, 3).toUpperCase()));
    headers.push('Total', 'Cum');

    const colW = [8, 14, 28, 14];
    data.calMonths.forEach(() => colW.push(12));
    colW.push(16, 16);
    const sumColW = colW.reduce((s, w) => s + w, 0);
    const scale = sumColW > contentW ? contentW / sumColW : 1;
    const scaledW = colW.map(w => w * scale);

    doc.setFontSize(5.5);
    doc.setFillColor(15, 23, 42);
    doc.setTextColor(255, 255, 255);
    doc.rect(margin, y, contentW, 4.5, 'F');
    let x = margin + 1;
    headers.forEach((h, i) => {
        const align = i >= 3 ? 'right' : 'left';
        const px = align === 'right' ? x + scaledW[i] - 0.5 : x + 0.5;
        doc.text(doc.splitTextToSize(h, scaledW[i] - 1), px, y + 2.2, { align: align });
        x += scaledW[i];
    });
    y += 4.5;

    doc.setTextColor(30, 30, 30);
    let rowIdx = 0;
    for (const r of data.rows) {
        checkPage(5);
        if (rowIdx % 2 === 1) { doc.setFillColor(240, 240, 245); doc.rect(margin, y, contentW, 4, 'F'); }
        x = margin + 1;
        const vals = [
            String(rowIdx + 1), String(r.flat_no), r.name, fmt(r.bf),
            ...data.calMonths.map(m => fmt(r.monthlyPaid[m])),
            fmt(r.yearTotal), fmt(r.cumulative)
        ];
        vals.forEach((v, i) => {
            const align = i >= 3 ? 'right' : 'left';
            const px = align === 'right' ? x + scaledW[i] - 0.5 : x + 0.5;
            doc.text(v, px, y + 2.7, { align: align, maxWidth: scaledW[i] - 1 });
            x += scaledW[i];
        });
        y += 4;
        rowIdx++;
    }

    checkPage(5);
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 0.5;
    x = margin + 1;
    const totalVals = [
        '', 'TOTAL', '', fmt(data.grandBroughtForward),
        ...data.calMonths.map(m => fmt(data.grandMonths[m])),
        fmt(data.grandYearTotal), fmt(data.grandCumulative)
    ];
    totalVals.forEach((v, i) => {
        const align = i >= 3 ? 'right' : 'left';
        const px = align === 'right' ? x + scaledW[i] - 0.5 : x + 0.5;
        doc.text(v, px, y + 2.7, { align: align, maxWidth: scaledW[i] - 1 });
        x += scaledW[i];
    });

    const fname = 'Year_Statement_' + year + '.pdf';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
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

    const fmBtn = document.createElement('button');
    fmBtn.className = 'btn btn-sm';
    fmBtn.innerHTML = '<i class="fa-solid fa-file-alt"></i> Floor Manager Report';
    fmBtn.style.cssText = 'margin-left:auto;background:var(--color-indigo);color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:0.8rem;';
    fmBtn.onclick = () => window.showFloorManagerReport(container, toolbar);
    fmBtn.style.marginLeft = 'auto';
    toolbar.appendChild(fmBtn);

    let pendings = [];
    let ownerMap = {};
    let unsoldFlats = new Set();
    try {
        const { data: owners } = await sbClient.from('owners').select('flat_no, owner_name, occupancy_status');
        if (owners) {
            owners.forEach(o => {
                const name = window.displayStructured(o.owner_name, 'name') || o.owner_name || '';
                ownerMap[o.flat_no] = name;
                if (o.occupancy_status === 'unsold') unsoldFlats.add(o.flat_no);
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

    // Exclude pending requests from unsold flats
    pendings = pendings.filter(p => !unsoldFlats.has(p.flat_no));

    // Also fetch approved-but-not-deposited records for marking deposit
    let approvedForDeposit = [];
    try {
        const { data } = await sbClient.from('income')
            .select('*')
            .eq('category', 'Monthly Maintenance')
            .eq('status', 'approved')
            .or('deposit_status.is.null,deposit_status.neq.deposited')
            .order('approved_at', { ascending: false });
        if (data) approvedForDeposit = data;
    } catch { approvedForDeposit = []; }
    approvedForDeposit = approvedForDeposit.filter(p => !unsoldFlats.has(p.flat_no));

    let html = '';

    if (pendings.length === 0 && approvedForDeposit.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fa-solid fa-circle-check" style="font-size:2rem;color:var(--color-emerald);"></i><br><br><strong>All caught up!</strong><br>No pending payment requests.</div>';
        return;
    }

    if (pendings.length > 0) {
        html += `<div style="margin-bottom:12px;font-size:0.85rem;color:var(--text-secondary);">${pendings.length} payment request(s) awaiting approval</div>`;
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
    }

    if (approvedForDeposit.length > 0) {
        html += `<div style="margin:20px 0 12px;font-size:0.85rem;color:var(--text-secondary);">${approvedForDeposit.length} approved collection(s) awaiting deposit</div>`;
        html += '<table class="data-table"><thead><tr><th>Flat</th><th>Month</th><th>Amount</th><th>Payment Mode</th><th>Approved By</th><th>Approved At</th><th>Actions</th></tr></thead><tbody>';

        for (const d of approvedForDeposit) {
            const approvedAt = d.approved_at ? new Date(d.approved_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
            html += `<tr>
                <td><strong>${escapeHtml(d.flat_no)}</strong></td>
                <td>${escapeHtml(d.month)} ${escapeHtml(d.year)}</td>
                <td style="font-weight:700;color:var(--color-emerald);">${formatCurrency(d.amount)}</td>
                <td>${escapeHtml(d.payment_mode || '—')}</td>
                <td style="font-size:0.8rem;">${escapeHtml(d.approved_by || '—')}</td>
                <td style="font-size:0.75rem;color:var(--text-secondary);">${approvedAt}</td>
                <td>
                    <button class="btn btn-sm" style="background:var(--color-indigo);color:#fff;" onclick='markDeposited("${d.id}")'><i class="fa-solid fa-hand-holding-dollar"></i> Mark Deposited</button>
                </td>
            </tr>`;
        }
        html += '</tbody></table>';
    }

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

async function renderAcknowledgementTab(container, toolbar) {
    toolbar.innerHTML = '';
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';

    if (!window.hasPermission('income:acknowledge')) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fa-solid fa-lock"></i><br>Access Denied</div>';
        return;
    }

    const trBtn = document.createElement('button');
    trBtn.className = 'btn btn-sm';
    trBtn.innerHTML = '<i class="fa-solid fa-file-alt"></i> Treasurer Report';
    trBtn.style.cssText = 'margin-left:auto;background:var(--color-emerald);color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:0.8rem;';
    trBtn.onclick = () => window.showTreasurerReport(container, toolbar);
    toolbar.appendChild(trBtn);

    let deposited = [];
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
            .eq('deposit_status', 'deposited')
            .is('acknowledgement_status', null)
            .order('deposited_at', { ascending: false });
        if (data) deposited = data;
    } catch { deposited = []; }

    if (deposited.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fa-solid fa-circle-check" style="font-size:2rem;color:var(--color-emerald);"></i><br><br><strong>All caught up!</strong><br>No deposits pending acknowledgement.</div>';
        return;
    }

    let html = `<div style="margin-bottom:12px;font-size:0.85rem;color:var(--text-secondary);">${deposited.length} deposit(s) awaiting acknowledgement</div>`;
    html += '<table class="data-table"><thead><tr><th>Flat</th><th>Owner</th><th>Month</th><th>Amount</th><th>Deposited By</th><th>Deposited At</th><th>Actions</th></tr></thead><tbody>';

    for (const d of deposited) {
        const ownerName = ownerMap[d.flat_no] || '—';
        const depAt = d.deposited_at ? new Date(d.deposited_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
        html += `<tr>
            <td><strong>${escapeHtml(d.flat_no)}</strong></td>
            <td style="font-size:0.8rem;">${escapeHtml(ownerName)}</td>
            <td>${escapeHtml(d.month)} ${escapeHtml(d.year)}</td>
            <td style="font-weight:700;color:var(--color-emerald);">${formatCurrency(d.amount)}</td>
            <td style="font-size:0.8rem;">${escapeHtml(d.deposited_by || '—')}</td>
            <td style="font-size:0.75rem;color:var(--text-secondary);">${depAt}</td>
            <td>
                <button class="btn btn-sm" style="background:var(--color-emerald);color:#fff;" onclick='acknowledgeDeposit("${d.id}")'><i class="fa-solid fa-check-double"></i> Acknowledge</button>
            </td>
        </tr>`;
    }
    html += '</tbody></table>';
    container.innerHTML = html;
}

window.acknowledgeDeposit = async function(id) {
    const { isConfirmed: ack } = await Swal.fire({ title: 'Confirm', text: 'Acknowledge receipt of this deposited amount?', icon: 'question', showCancelButton: true, confirmButtonColor: '#059669', confirmButtonText: 'Yes, acknowledge', cancelButtonText: 'Cancel' });
    if (!ack) return;
    try {
        const approver = window.currentUserName || window.currentUserEmail || 'System';
        const now = new Date().toISOString();
        const { error: upErr } = await sbClient.from('income')
            .update({
                acknowledgement_status: 'acknowledged',
                acknowledged_by: approver,
                acknowledged_at: now
            })
            .eq('id', id);
        if (upErr) throw upErr;
        showToast('Deposit acknowledged.', 'success');
        const container = document.getElementById('maintenance-container');
        const toolbar = document.getElementById('maintenance-toolbar');
        if (container && toolbar) await renderAcknowledgementTab(container, toolbar);
    } catch (err) {
        showToast('Error acknowledging deposit: ' + err.message, 'error');
    }
};

// ─── FLOOR MANAGER REPORT ──────────────────────────────────────────────

let _fmReportData = [];

window.showFloorManagerReport = async function(container, toolbar) {
    toolbar.innerHTML = '';
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading data...</div>';

    const monthOrder = CAL_MONTHS;
    let allData = [];
    try {
        const { data } = await sbClient.from('income')
            .select('id, flat_no, month, year, amount, approved_by, approved_at, deposited_by, deposited_at, deposit_status')
            .eq('category', 'Monthly Maintenance')
            .eq('status', 'approved')
            .not('approved_by', 'is', null)
            .order('year', { ascending: true });
        if (data) allData = data;
    } catch { allData = []; }

    allData.sort((a, b) => {
        const na = (a.approved_by || '').toLowerCase();
        const nb = (b.approved_by || '').toLowerCase();
        if (na !== nb) return na < nb ? -1 : 1;
        if (a.year !== b.year) return parseInt(a.year) - parseInt(b.year);
        return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
    });

    const managers = [...new Set(allData.map(r => r.approved_by).filter(Boolean))].sort();
    // Activity dates (approved_at) for month/year filter
    const actMonths = [...new Set(allData.map(r => r.approved_at).filter(Boolean).map(d => monthOrder[new Date(d).getMonth()]))].sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));
    const actYears = [...new Set(allData.map(r => r.approved_at).filter(Boolean).map(d => new Date(d).getFullYear().toString()))].sort();

    function buildFilters() {
        let fhtml = '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;">';
        fhtml += '<label style="font-size:0.8rem;color:var(--text-secondary);">Floor Manager<br><select id="fm-filter-mgr" style="padding:5px 8px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-card);color:var(--text-primary);font-size:0.8rem;"><option value="">All Managers</option>';
        managers.forEach(m => { fhtml += `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`; });
        fhtml += '</select></label>';
        fhtml += '<label style="font-size:0.8rem;color:var(--text-secondary);">Approval Month<br><select id="fm-filter-month" style="padding:5px 8px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-card);color:var(--text-primary);font-size:0.8rem;"><option value="">All Months</option>';
        actMonths.forEach(m => { fhtml += `<option value="${m}">${m}</option>`; });
        fhtml += '</select></label>';
        fhtml += '<label style="font-size:0.8rem;color:var(--text-secondary);">Approval Year<br><select id="fm-filter-year" style="padding:5px 8px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-card);color:var(--text-primary);font-size:0.8rem;"><option value="">All Years</option>';
        actYears.forEach(y => { fhtml += `<option value="${y}">${y}</option>`; });
        fhtml += '</select></label>';
        fhtml += '<button class="btn btn-sm" style="background:var(--color-indigo);color:#fff;border:none;border-radius:6px;padding:6px 16px;cursor:pointer;font-size:0.8rem;" onclick="window._fmGenerateReport()"><i class="fa-solid fa-magnifying-glass"></i> Generate</button>';
        fhtml += '<button class="btn btn-sm" style="background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-primary);border-radius:6px;padding:6px 14px;cursor:pointer;font-size:0.8rem;" onclick="window.switchMaintenanceTab(\'pending\')"><i class="fa-solid fa-arrow-left"></i> Back</button>';
        fhtml += '</div>';
        return fhtml;
    }

    toolbar.innerHTML = buildFilters();

    if (!allData.length) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fa-solid fa-circle-info" style="font-size:2rem;"></i><br><br>No approved payment records found.</div>';
        return;
    }

    window._fmGenerateReport = function() {
        const selMgr = document.getElementById('fm-filter-mgr').value;
        const selMonth = document.getElementById('fm-filter-month').value;
        const selYear = document.getElementById('fm-filter-year').value;

        let filtered = allData;
        if (selMgr) filtered = filtered.filter(r => r.approved_by === selMgr);
        // Filter by activity date (approved_at) — entries approved in the selected month/year
        if (selMonth) {
            filtered = filtered.filter(r => {
                if (!r.approved_at) return false;
                return monthOrder[new Date(r.approved_at).getMonth()] === selMonth;
            });
        }
        if (selYear) {
            filtered = filtered.filter(r => {
                if (!r.approved_at) return false;
                return new Date(r.approved_at).getFullYear().toString() === selYear;
            });
        }

        _fmReportData = filtered;

        // Show export buttons
        const existingBtns = toolbar.querySelectorAll('.fm-export-btn');
        existingBtns.forEach(b => b.remove());
        const expSep = document.createElement('span');
        expSep.className = 'fm-export-btn';
        expSep.style.cssText = 'margin-left:8px;color:var(--text-muted);font-size:0.8rem;';
        expSep.textContent = '| Export:';
        toolbar.appendChild(expSep);
        const xlsBtn = document.createElement('button');
        xlsBtn.className = 'btn btn-sm fm-export-btn';
        xlsBtn.innerHTML = '<i class="fa-solid fa-file-excel"></i> Excel';
        xlsBtn.style.cssText = 'margin-left:4px;background:#1d6f42;color:#fff;border:none;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:0.75rem;';
        xlsBtn.onclick = () => window._exportFMExcel(selMgr, selMonth, selYear);
        toolbar.appendChild(xlsBtn);
        const pdfBtn = document.createElement('button');
        pdfBtn.className = 'btn btn-sm fm-export-btn';
        pdfBtn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> PDF';
        pdfBtn.style.cssText = 'margin-left:4px;background:#b91c1c;color:#fff;border:none;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:0.75rem;';
        pdfBtn.onclick = () => window._exportFMPDF(selMgr, selMonth, selYear);
        toolbar.appendChild(pdfBtn);

        if (!filtered.length) {
            container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fa-solid fa-circle-info" style="font-size:2rem;"></i><br><br>No records match the selected filters.</div>';
            return;
        }

        // Group by approved_by → fee month_year
        const groups = {};
        for (const r of filtered) {
            const key = r.approved_by || 'Unknown';
            if (!groups[key]) groups[key] = {};
            const mk = r.month + ' ' + r.year;
            if (!groups[key][mk]) groups[key][mk] = { month: r.month, year: r.year, items: [] };
            groups[key][mk].items.push(r);
        }

        let html = '';
        let grandSrNo = 0;
        let grandTotalAmt = 0;
        const mgrKeys = Object.keys(groups).sort();

        for (const mgr of mgrKeys) {
            const mks = Object.keys(groups[mgr]).sort((a, b) => {
                const ma = groups[mgr][a];
                const mb = groups[mgr][b];
                if (ma.year !== mb.year) return parseInt(ma.year) - parseInt(mb.year);
                return monthOrder.indexOf(ma.month) - monthOrder.indexOf(mb.month);
            });
            for (const mk of mks) {
                const g = groups[mgr][mk];
                const items = g.items;
                let grpTotal = 0;
                html += `<div style="margin:20px 0 6px;font-weight:700;font-size:0.95rem;color:var(--text-primary);">
                    <i class="fa-solid fa-user"></i> ${escapeHtml(mgr)} — Fee Month: ${g.month} ${g.year}
                </div>`;
                html += '<table class="data-table"><thead><tr><th style="width:50px;">Sr No.</th><th>Flat No.</th><th style="text-align:right;">Amount</th><th>Approved Date</th><th>Deposited Date</th></tr></thead><tbody>';
                let srNo = 0;
                for (const r of items) {
                    srNo++; grandSrNo++;
                    const amt = parseFloat(r.amount) || 0;
                    grpTotal += amt;
                    const appAt = r.approved_at ? new Date(r.approved_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                    const depAt = r.deposited_at && r.deposit_status === 'deposited' ? new Date(r.deposited_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                    html += `<tr>
                        <td style="text-align:center;">${srNo}</td>
                        <td><strong>${escapeHtml(r.flat_no)}</strong></td>
                        <td style="text-align:right;font-weight:700;color:var(--color-emerald);">${formatCurrency(amt)}</td>
                        <td style="font-size:0.8rem;">${appAt}</td>
                        <td style="font-size:0.8rem;">${depAt}</td>
                    </tr>`;
                }
                grandTotalAmt += grpTotal;
                html += `<tr style="font-weight:700;background:var(--bg-card);border-top:2px solid var(--border-color);">
                    <td colspan="2" style="text-align:right;">Total for ${g.month} ${g.year}</td>
                    <td style="text-align:right;color:var(--color-emerald);">${formatCurrency(grpTotal)}</td>
                    <td colspan="2"></td>
                </tr></tbody></table>`;
            }
        }

        html += `<div style="margin:20px 0;padding:14px;background:var(--bg-card);border:2px solid var(--color-indigo);border-radius:8px;text-align:center;">
            <strong style="font-size:1.05rem;">GRAND TOTAL: ${formatCurrency(grandTotalAmt)} (${grandSrNo} transactions)</strong>
        </div>`;
        container.innerHTML = html;
    };

    // Auto-generate with no filters
    window._fmGenerateReport();
};

window._exportFMExcel = function(selMgr, selMonth, selYear) {
    if (typeof XLSX === 'undefined') { showToast('Excel library not loaded.', 'error'); return; }
    const data = _fmReportData;
    if (!data || !data.length) { showToast('No data to export.', 'error'); return; }

    const label = (selMgr || 'All Managers') + '_' + (selMonth || 'All Months') + '_' + (selYear || 'All Years');
    const header = ['Sr No.', 'Flat No.', 'Amount', 'Approved Date', 'Deposited Date', 'Approved By', 'Month', 'Year'];
    const rows = [header];
    data.forEach((r, i) => {
        rows.push([
            i + 1,
            r.flat_no,
            parseFloat(r.amount) || 0,
            r.approved_at || '',
            (r.deposited_at && r.deposit_status === 'deposited') ? r.deposited_at : '',
            r.approved_by || '',
            r.month,
            r.year
        ]);
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Floor Manager Report');
    XLSX.writeFile(wb, 'FloorManagerReport_' + label.replace(/[^a-zA-Z0-9_]/g, '_') + '.xlsx');
    showToast('Excel downloaded.', 'success');
};

window._exportFMPDF = function(selMgr, selMonth, selYear) {
    if (typeof window.jspdf === 'undefined' && typeof jspdf === 'undefined') { showToast('PDF library not loaded.', 'error'); return; }
    const data = _fmReportData;
    if (!data || !data.length) { showToast('No data to export.', 'error'); return; }

    const { jsPDF } = window.jspdf || window;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = 297, margin = 8, usableW = pageW - margin * 2;
    const colW = [8, 20, 30, 35, 35, 50, 25, 25];
    const colTotal = colW.reduce((a, b) => a + b, 0);
    const colPercent = colW.map(w => w / colTotal);

    function _pdfText(v) { return String(v).replace(/₹/g, 'Rs.').replace(/—/g, '-').replace(/[^\x20-\x7E\s]/g, '').substring(0, 40); }

    let y = 15;
    const lineH = 6;
    const headerH = 8;

    doc.setFontSize(14);
    doc.text('Floor Manager Report', margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.text('Filter: ' + (selMgr || 'All Managers') + ' | ' + (selMonth || 'All Months') + ' | ' + (selYear || 'All Years'), margin, y);
    y += 4;

    const group = {};
    for (const r of data) {
        const key = r.approved_by || 'Unknown';
        if (!group[key]) group[key] = [];
        group[key].push(r);
    }
    const mgrs = Object.keys(group).sort();
    let grandTotal = 0, grandCount = 0;

    for (const mgr of mgrs) {
        const items = group[mgr];
        // Check page space
        const needH = headerH + items.length * lineH + lineH + 6;
        if (y + needH > 200) { doc.addPage(); y = 15; }

        // Section header
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Floor Manager: ' + _pdfText(mgr), margin, y);
        y += 5;

        // Table header
        const headers = ['Sr', 'Flat', 'Amount', 'Approved Date', 'Deposited Date', 'Approved By', 'Month', 'Year'];
        let x = margin;
        doc.setFontSize(7);
        doc.setFont(undefined, 'bold');
        headers.forEach((h, i) => {
            doc.rect(x, y, colW[i] * 0.75, headerH);
            doc.text(h, x + 1, y + 4);
            x += colW[i] * 0.75;
        });
        y += headerH;

        // Data rows
        doc.setFont(undefined, 'normal');
        let grpTotal = 0;
        items.forEach((r, idx) => {
            x = margin;
            const vals = [
                String(idx + 1),
                _pdfText(r.flat_no),
                'Rs.' + Math.round(parseFloat(r.amount)).toLocaleString('en-IN'),
                r.approved_at ? new Date(r.approved_at).toLocaleDateString('en-IN') : '-',
                (r.deposited_at && r.deposit_status === 'deposited') ? new Date(r.deposited_at).toLocaleDateString('en-IN') : '-',
                _pdfText(r.approved_by),
                r.month,
                r.year
            ];
            grpTotal += parseFloat(r.amount) || 0;
            doc.setFontSize(6.5);
            vals.forEach((v, i) => {
                doc.rect(x, y, colW[i] * 0.75, lineH);
                doc.text(v, x + 1, y + 4);
                x += colW[i] * 0.75;
            });
            y += lineH;
        });
        grandTotal += grpTotal;
        grandCount += items.length;

        // Group total
        x = margin;
        doc.setFont(undefined, 'bold');
        doc.setFontSize(7);
        doc.rect(x, y, (colW[0] + colW[1]) * 0.75, lineH);
        doc.text('Total for ' + _pdfText(items[0].month) + ' ' + items[0].year, x + 1, y + 4);
        x += (colW[0] + colW[1]) * 0.75;
        let csum = 0;
        for (let i = 2; i < colW.length; i++) {
            const v = i === 2 ? 'Rs.' + Math.round(grpTotal).toLocaleString('en-IN') : '';
            doc.rect(x, y, colW[i] * 0.75, lineH);
            doc.text(v, x + 1, y + 4);
            x += colW[i] * 0.75;
        }
        y += lineH + 2;
    }

    // Grand total
    y += 2;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('GRAND TOTAL: Rs.' + Math.round(grandTotal).toLocaleString('en-IN') + ' (' + grandCount + ' transactions)', margin, y);

    const label = (selMgr || 'AllManagers') + '_' + (selMonth || 'AllMonths') + '_' + (selYear || 'AllYears');
    doc.save('FloorManagerReport_' + label.replace(/[^a-zA-Z0-9_]/g, '_') + '.pdf');
    showToast('PDF downloaded.', 'success');
};

// ─── TREASURER REPORT ──────────────────────────────────────────────────

let _trReportData = { ackData: [], expData: [] };

window.showTreasurerReport = async function(container, toolbar) {
    toolbar.innerHTML = '';
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading data...</div>';

    const monthOrder = CAL_MONTHS;

    let ackData = [], expData = [];
    try {
        const [incRes, expRes] = await Promise.all([
            sbClient.from('income')
                .select('id, flat_no, month, year, amount, acknowledged_by, acknowledged_at, deposited_by, deposited_at, deposit_status')
                .eq('category', 'Monthly Maintenance')
                .eq('acknowledgement_status', 'acknowledged')
                .not('acknowledged_by', 'is', null)
                .order('year', { ascending: true }),
            sbClient.from('expenses')
                .select('id, month, year, amount, expense_head, description, date_spent, created_by')
                .order('year', { ascending: true })
        ]);
        if (incRes.data) ackData = incRes.data;
        if (expRes.data) expData = expRes.data;
    } catch { ackData = []; expData = []; }

    ackData.sort((a, b) => {
        const na = (a.acknowledged_by || '').toLowerCase();
        const nb = (b.acknowledged_by || '').toLowerCase();
        if (na !== nb) return na < nb ? -1 : 1;
        if (a.year !== b.year) return parseInt(a.year) - parseInt(b.year);
        return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
    });

    const treasurers = [...new Set(ackData.map(r => r.acknowledged_by).filter(Boolean))].sort();
    // Activity dates (acknowledged_at) for month/year filter on acknowledgments
    const ackMonths = [...new Set(ackData.map(r => r.acknowledged_at).filter(Boolean).map(d => monthOrder[new Date(d).getMonth()]))].sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));
    const ackYears = [...new Set(ackData.map(r => r.acknowledged_at).filter(Boolean).map(d => new Date(d).getFullYear().toString()))].sort();
    // Fee months/years for expenditure filter
    const expYears = [...new Set(expData.map(r => r.year).filter(Boolean))].sort();

    function buildFilters() {
        let fhtml = '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;">';
        fhtml += '<label style="font-size:0.8rem;color:var(--text-secondary);">Treasurer<br><select id="tr-filter-treas" style="padding:5px 8px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-card);color:var(--text-primary);font-size:0.8rem;"><option value="">All Treasurers</option>';
        treasurers.forEach(m => { fhtml += `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`; });
        fhtml += '</select></label>';
        fhtml += '<label style="font-size:0.8rem;color:var(--text-secondary);">Acknowledgment Month<br><select id="tr-filter-month" style="padding:5px 8px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-card);color:var(--text-primary);font-size:0.8rem;"><option value="">All Months</option>';
        ackMonths.forEach(m => { fhtml += `<option value="${m}">${m}</option>`; });
        fhtml += '</select></label>';
        fhtml += '<label style="font-size:0.8rem;color:var(--text-secondary);">Acknowledgment Year<br><select id="tr-filter-year" style="padding:5px 8px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-card);color:var(--text-primary);font-size:0.8rem;"><option value="">All Years</option>';
        ackYears.forEach(y => { fhtml += `<option value="${y}">${y}</option>`; });
        fhtml += '</select></label>';
        fhtml += '<button class="btn btn-sm" style="background:var(--color-emerald);color:#fff;border:none;border-radius:6px;padding:6px 16px;cursor:pointer;font-size:0.8rem;" onclick="window._trGenerateReport()"><i class="fa-solid fa-magnifying-glass"></i> Generate</button>';
        fhtml += '<button class="btn btn-sm" style="background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-primary);border-radius:6px;padding:6px 14px;cursor:pointer;font-size:0.8rem;" onclick="window.switchMaintenanceTab(\'acknowledgement\')"><i class="fa-solid fa-arrow-left"></i> Back</button>';
        fhtml += '</div>';
        return fhtml;
    }

    toolbar.innerHTML = buildFilters();

    const hasAck = ackData.length > 0;
    const hasExp = expData.length > 0;

    if (!hasAck && !hasExp) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fa-solid fa-circle-info" style="font-size:2rem;"></i><br><br>No acknowledged or expenditure records found.</div>';
        return;
    }

    window._trGenerateReport = function() {
        const selTreas = document.getElementById('tr-filter-treas').value;
        const selMonth = document.getElementById('tr-filter-month').value;
        const selYear = document.getElementById('tr-filter-year').value;

        let fAck = ackData;
        if (selTreas) fAck = fAck.filter(r => r.acknowledged_by === selTreas);
        // Filter acknowledgments by activity date (acknowledged_at)
        if (selMonth) {
            fAck = fAck.filter(r => {
                if (!r.acknowledged_at) return false;
                return monthOrder[new Date(r.acknowledged_at).getMonth()] === selMonth;
            });
        }
        if (selYear) {
            fAck = fAck.filter(r => {
                if (!r.acknowledged_at) return false;
                return new Date(r.acknowledged_at).getFullYear().toString() === selYear;
            });
        }

        // Expenditure filtered by fee month (date_spent) when month/year selected
        let fExp = expData;
        if (selMonth) fExp = fExp.filter(r => r.month === selMonth);
        if (selYear) fExp = fExp.filter(r => r.year === selYear);

        _trReportData = { ackData: fAck, expData: fExp };

        // Export buttons
        const existingBtns = toolbar.querySelectorAll('.tr-export-btn');
        existingBtns.forEach(b => b.remove());
        const expSep = document.createElement('span');
        expSep.className = 'tr-export-btn';
        expSep.style.cssText = 'margin-left:8px;color:var(--text-muted);font-size:0.8rem;';
        expSep.textContent = '| Export:';
        toolbar.appendChild(expSep);
        const xlsBtn = document.createElement('button');
        xlsBtn.className = 'btn btn-sm tr-export-btn';
        xlsBtn.innerHTML = '<i class="fa-solid fa-file-excel"></i> Excel';
        xlsBtn.style.cssText = 'margin-left:4px;background:#1d6f42;color:#fff;border:none;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:0.75rem;';
        xlsBtn.onclick = () => window._exportTRExcel(selTreas, selMonth, selYear);
        toolbar.appendChild(xlsBtn);
        const pdfBtn = document.createElement('button');
        pdfBtn.className = 'btn btn-sm tr-export-btn';
        pdfBtn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> PDF';
        pdfBtn.style.cssText = 'margin-left:4px;background:#b91c1c;color:#fff;border:none;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:0.75rem;';
        pdfBtn.onclick = () => window._exportTRPDF(selTreas, selMonth, selYear);
        toolbar.appendChild(pdfBtn);

        let html = '';

        // Section 1: Acknowledgments
        if (fAck.length) {
            const groups = {};
            for (const r of fAck) {
                const key = r.acknowledged_by || 'Unknown';
                if (!groups[key]) groups[key] = {};
                const mk = r.month + ' ' + r.year;
                if (!groups[key][mk]) groups[key][mk] = { month: r.month, year: r.year, items: [] };
                groups[key][mk].items.push(r);
            }
            let grandSrNo = 0, grandTotalAmt = 0;
            const trKeys = Object.keys(groups).sort();
            html += `<h4 style="color:var(--text-primary);margin:0 0 12px;"><i class="fa-solid fa-check-double"></i> Acknowledgments by Treasurer</h4>`;
            for (const tr of trKeys) {
                const mks = Object.keys(groups[tr]).sort((a, b) => {
                    const ma = groups[tr][a], mb = groups[tr][b];
                    if (ma.year !== mb.year) return parseInt(ma.year) - parseInt(mb.year);
                    return monthOrder.indexOf(ma.month) - monthOrder.indexOf(mb.month);
                });
                for (const mk of mks) {
                    const g = groups[tr][mk];
                    const items = g.items;
                    let grpTotal = 0;
                    html += `<div style="margin:16px 0 4px;font-weight:600;font-size:0.9rem;color:var(--text-primary);">
                        <i class="fa-solid fa-user"></i> ${escapeHtml(tr)} — Fee Month: ${g.month} ${g.year}
                    </div>`;
                    html += '<table class="data-table"><thead><tr><th style="width:50px;">Sr No.</th><th>Flat No.</th><th style="text-align:right;">Amount</th><th>Deposited Date</th><th>Acknowledged Date</th></tr></thead><tbody>';
                    let srNo = 0;
                    for (const r of items) {
                        srNo++; grandSrNo++;
                        const amt = parseFloat(r.amount) || 0;
                        grpTotal += amt;
                        const depAt = r.deposited_at && r.deposit_status === 'deposited' ? new Date(r.deposited_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                        const ackAt = r.acknowledged_at ? new Date(r.acknowledged_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                        html += `<tr><td style="text-align:center;">${srNo}</td><td><strong>${escapeHtml(r.flat_no)}</strong></td>
                            <td style="text-align:right;font-weight:700;color:var(--color-emerald);">${formatCurrency(amt)}</td>
                            <td style="font-size:0.8rem;">${depAt}</td><td style="font-size:0.8rem;">${ackAt}</td></tr>`;
                    }
                    grandTotalAmt += grpTotal;
                    html += `<tr style="font-weight:700;background:var(--bg-card);border-top:2px solid var(--border-color);">
                        <td colspan="2" style="text-align:right;">Total for ${g.month} ${g.year}</td>
                        <td style="text-align:right;color:var(--color-emerald);">${formatCurrency(grpTotal)}</td>
                        <td colspan="2"></td></tr></tbody></table>`;
                }
            }
            html += `<div style="margin:16px 0;padding:12px;background:var(--bg-card);border:2px solid var(--color-emerald);border-radius:8px;text-align:center;">
                <strong>Total Acknowledged: ${formatCurrency(grandTotalAmt)} (${grandSrNo} transactions)</strong></div>`;
        } else {
            html += '<p style="color:var(--text-muted);margin:16px 0;">No acknowledged records match filters.</p>';
        }

        // Section 2: Expenditure
        html += `<h4 style="color:var(--text-primary);margin:24px 0 12px;"><i class="fa-solid fa-arrow-up-from-bracket"></i> Expenditure</h4>`;
        if (fExp.length) {
            const expByYear = {};
            for (const r of fExp) {
                const yr = r.year || 'Unknown';
                if (!expByYear[yr]) expByYear[yr] = {};
                if (!expByYear[yr][r.month]) expByYear[yr][r.month] = { items: [] };
                expByYear[yr][r.month].items.push(r);
            }
            let grandExpTotal = 0, grandExpCnt = 0;
            const yrs = Object.keys(expByYear).sort();
            for (const yr of yrs) {
                const mons = Object.keys(expByYear[yr]).sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));
                for (const m of mons) {
                    const items = expByYear[yr][m].items;
                    let monthTotal = 0;
                    html += `<div style="margin:14px 0 4px;font-weight:600;font-size:0.85rem;color:var(--text-primary);">
                        <i class="fa-solid fa-calendar"></i> ${m} ${yr}</div>`;
                    html += '<table class="data-table"><thead><tr><th style="width:50px;">Sr No.</th><th>Head</th><th>Description</th><th style="text-align:right;">Amount</th><th>Date Spent</th><th>Created By</th></tr></thead><tbody>';
                    let srNo = 0;
                    for (const r of items) {
                        srNo++;
                        const amt = parseFloat(r.amount) || 0;
                        monthTotal += amt;
                        const dt = r.date_spent ? new Date(r.date_spent).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                        html += `<tr><td style="text-align:center;">${srNo}</td><td>${escapeHtml(r.expense_head || '—')}</td>
                            <td style="font-size:0.8rem;">${escapeHtml(r.description || '—')}</td>
                            <td style="text-align:right;font-weight:700;color:var(--color-rose);">${formatCurrency(amt)}</td>
                            <td style="font-size:0.8rem;">${dt}</td>
                            <td style="font-size:0.75rem;color:var(--text-secondary);">${escapeHtml(r.created_by || '—')}</td></tr>`;
                    }
                    grandExpTotal += monthTotal;
                    grandExpCnt += items.length;
                    html += `<tr style="font-weight:700;background:var(--bg-card);border-top:2px solid var(--border-color);">
                        <td colspan="3" style="text-align:right;">Total for ${m} ${yr}</td>
                        <td style="text-align:right;color:var(--color-rose);">${formatCurrency(monthTotal)}</td>
                        <td colspan="2"></td></tr></tbody></table>`;
                }
            }
            html += `<div style="margin:16px 0;padding:12px;background:var(--bg-card);border:2px solid var(--color-rose);border-radius:8px;text-align:center;">
                <strong>Total Expenditure: ${formatCurrency(grandExpTotal)} (${grandExpCnt} transactions)</strong></div>`;
        } else {
            html += '<p style="color:var(--text-muted);margin:16px 0;">No expenditure records match filters.</p>';
        }

        container.innerHTML = html;
    };

    window._trGenerateReport();
};

window._exportTRExcel = function(selTreas, selMonth, selYear) {
    if (typeof XLSX === 'undefined') { showToast('Excel library not loaded.', 'error'); return; }
    const { ackData, expData } = _trReportData;
    if (!ackData.length && !expData.length) { showToast('No data to export.', 'error'); return; }

    const label = (selTreas || 'AllTreasurers') + '_' + (selMonth || 'AllMonths') + '_' + (selYear || 'AllYears');
    const wb = XLSX.utils.book_new();

    if (ackData.length) {
        const ackHeader = ['Sr No.', 'Flat No.', 'Amount', 'Deposited Date', 'Acknowledged Date', 'Acknowledged By', 'Month', 'Year'];
        const ackRows = [ackHeader];
        ackData.forEach((r, i) => {
            ackRows.push([
                i + 1, r.flat_no, parseFloat(r.amount) || 0,
                (r.deposited_at && r.deposit_status === 'deposited') ? r.deposited_at : '',
                r.acknowledged_at || '', r.acknowledged_by || '', r.month, r.year
            ]);
        });
        const ws1 = XLSX.utils.aoa_to_sheet(ackRows);
        XLSX.utils.book_append_sheet(wb, ws1, 'Acknowledgments');
    }

    if (expData.length) {
        const expHeader = ['Sr No.', 'Head', 'Description', 'Amount', 'Date Spent', 'Created By', 'Month', 'Year'];
        const expRows = [expHeader];
        expData.forEach((r, i) => {
            expRows.push([
                i + 1, r.expense_head || '', r.description || '', parseFloat(r.amount) || 0,
                r.date_spent || '', r.created_by || '', r.month, r.year
            ]);
        });
        const ws2 = XLSX.utils.aoa_to_sheet(expRows);
        XLSX.utils.book_append_sheet(wb, ws2, 'Expenditure');
    }

    XLSX.writeFile(wb, 'TreasurerReport_' + label.replace(/[^a-zA-Z0-9_]/g, '_') + '.xlsx');
    showToast('Excel downloaded.', 'success');
};

window._exportTRPDF = function(selTreas, selMonth, selYear) {
    if (typeof window.jspdf === 'undefined' && typeof jspdf === 'undefined') { showToast('PDF library not loaded.', 'error'); return; }
    const { ackData, expData } = _trReportData;
    if (!ackData.length && !expData.length) { showToast('No data to export.', 'error'); return; }

    const { jsPDF } = window.jspdf || window;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const margin = 8;
    let y = 15;
    const lineH = 6, headerH = 8;

    function _pdfText(v) { return String(v).replace(/₹/g, 'Rs.').replace(/—/g, '-').replace(/[^\x20-\x7E\s]/g, '').substring(0, 40); }

    doc.setFontSize(14);
    doc.text('Treasurer Report', margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.text('Filter: ' + (selTreas || 'All Treasurers') + ' | ' + (selMonth || 'All Months') + ' | ' + (selYear || 'All Years'), margin, y);
    y += 4;

    // Section 1: Acknowledgments
    if (ackData.length) {
        const group = {};
        for (const r of ackData) {
            const key = r.acknowledged_by || 'Unknown';
            if (!group[key]) group[key] = [];
            group[key].push(r);
        }
        const trs = Object.keys(group).sort();
        let grandTotal = 0, grandCount = 0;
        const colW = [8, 20, 30, 35, 35, 50, 25, 25];
        if (y > 15) { doc.addPage(); y = 15; }
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text('ACKNOWLEDGMENTS', margin, y);
        y += 5;

        for (const tr of trs) {
            const items = group[tr];
            if (y + headerH + items.length * lineH + lineH + 8 > 200) { doc.addPage(); y = 15; }
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text('Treasurer: ' + _pdfText(tr), margin, y);
            y += 5;
            const headers = ['Sr', 'Flat', 'Amount', 'Deposited Date', 'Ack. Date', 'Ack. By', 'Month', 'Year'];
            let x = margin;
            doc.setFontSize(7);
            doc.setFont(undefined, 'bold');
            headers.forEach((h, i) => { doc.rect(x, y, colW[i] * 0.75, headerH); doc.text(h, x + 1, y + 4); x += colW[i] * 0.75; });
            y += headerH;
            doc.setFont(undefined, 'normal');
            let grpTotal = 0;
            items.forEach((r, idx) => {
                x = margin;
                const vals = [
                    String(idx + 1), _pdfText(r.flat_no),
                    'Rs.' + Math.round(parseFloat(r.amount)).toLocaleString('en-IN'),
                    (r.deposited_at && r.deposit_status === 'deposited') ? new Date(r.deposited_at).toLocaleDateString('en-IN') : '-',
                    r.acknowledged_at ? new Date(r.acknowledged_at).toLocaleDateString('en-IN') : '-',
                    _pdfText(r.acknowledged_by), r.month, r.year
                ];
                grpTotal += parseFloat(r.amount) || 0;
                doc.setFontSize(6.5);
                vals.forEach((v, i) => { doc.rect(x, y, colW[i] * 0.75, lineH); doc.text(v, x + 1, y + 4); x += colW[i] * 0.75; });
                y += lineH;
            });
            grandTotal += grpTotal; grandCount += items.length;
            x = margin;
            doc.setFont(undefined, 'bold');
            doc.setFontSize(7);
            doc.rect(x, y, (colW[0] + colW[1]) * 0.75, lineH);
            doc.text('Total', x + 1, y + 4);
            x += (colW[0] + colW[1]) * 0.75;
            for (let i = 2; i < colW.length; i++) {
                const v = i === 2 ? 'Rs.' + Math.round(grpTotal).toLocaleString('en-IN') : '';
                doc.rect(x, y, colW[i] * 0.75, lineH);
                doc.text(v, x + 1, y + 4);
                x += colW[i] * 0.75;
            }
            y += lineH + 2;
        }
        y += 2;
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Total Acknowledged: Rs.' + Math.round(grandTotal).toLocaleString('en-IN') + ' (' + grandCount + ' transactions)', margin, y);
        y += 8;
    }

    // Section 2: Expenditure
    if (expData.length) {
        const expColW = [8, 22, 40, 30, 30, 30, 20, 20];
        if (y > 190) { doc.addPage(); y = 15; }
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text('EXPENDITURE', margin, y);
        y += 5;

        const expByYear = {};
        for (const r of expData) {
            const yr = r.year || 'Unknown';
            if (!expByYear[yr]) expByYear[yr] = {};
            if (!expByYear[yr][r.month]) expByYear[yr][r.month] = [];
            expByYear[yr][r.month].push(r);
        }
        let grandExpTotal = 0, grandExpCnt = 0;
        const yrs = Object.keys(expByYear).sort();
        for (const yr of yrs) {
            const mons = Object.keys(expByYear[yr]).sort((a, b) => CAL_MONTHS.indexOf(a) - CAL_MONTHS.indexOf(b));
            for (const m of mons) {
                const items = expByYear[yr][m];
                if (y + headerH + items.length * lineH + lineH + 6 > 200) { doc.addPage(); y = 15; }
                doc.setFontSize(9);
                doc.setFont(undefined, 'bold');
                doc.text(m + ' ' + yr, margin, y);
                y += 4;
                const headers = ['Sr', 'Head', 'Description', 'Amount', 'Date Spent', 'Created By', 'Month', 'Year'];
                let x = margin;
                doc.setFontSize(6.5);
                doc.setFont(undefined, 'bold');
                headers.forEach((h, i) => { doc.rect(x, y, expColW[i] * 0.75, headerH); doc.text(h, x + 1, y + 4); x += expColW[i] * 0.75; });
                y += headerH;
                doc.setFont(undefined, 'normal');
                let monthTotal = 0;
                items.forEach((r, idx) => {
                    x = margin;
                    const vals = [
                        String(idx + 1), _pdfText(r.expense_head), _pdfText(r.description),
                        'Rs.' + Math.round(parseFloat(r.amount)).toLocaleString('en-IN'),
                        r.date_spent ? new Date(r.date_spent).toLocaleDateString('en-IN') : '-',
                        _pdfText(r.created_by), r.month, r.year
                    ];
                    monthTotal += parseFloat(r.amount) || 0;
                    doc.setFontSize(6);
                    vals.forEach((v, i) => { doc.rect(x, y, expColW[i] * 0.75, lineH); doc.text(v, x + 1, y + 4); x += expColW[i] * 0.75; });
                    y += lineH;
                });
                grandExpTotal += monthTotal; grandExpCnt += items.length;
                x = margin;
                doc.setFont(undefined, 'bold');
                doc.setFontSize(6.5);
                doc.rect(x, y, (expColW[0] + expColW[1] + expColW[2]) * 0.75, lineH);
                doc.text('Total', x + 1, y + 4);
                x += (expColW[0] + expColW[1] + expColW[2]) * 0.75;
                for (let i = 3; i < expColW.length; i++) {
                    const v = i === 3 ? 'Rs.' + Math.round(monthTotal).toLocaleString('en-IN') : '';
                    doc.rect(x, y, expColW[i] * 0.75, lineH);
                    doc.text(v, x + 1, y + 4);
                    x += expColW[i] * 0.75;
                }
                y += lineH + 2;
            }
        }
        y += 2;
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Total Expenditure: Rs.' + Math.round(grandExpTotal).toLocaleString('en-IN') + ' (' + grandExpCnt + ' transactions)', margin, y);
    }

    const label = (selTreas || 'AllTreasurers') + '_' + (selMonth || 'AllMonths') + '_' + (selYear || 'AllYears');
    doc.save('TreasurerReport_' + label.replace(/[^a-zA-Z0-9_]/g, '_') + '.pdf');
    showToast('PDF downloaded.', 'success');
};
