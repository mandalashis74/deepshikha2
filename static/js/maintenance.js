let maintenanceRates = [];
let maintenanceCollections = [];
let currentMaintenanceTab = 'rates';
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
    let query = sbClient.from('maintenance_collections').select('*');
    if (month) query = query.eq('month', month);
    if (year) query = query.eq('year', year);
    const { data, error } = await query.order('flat_no');
    if (error) { showToast('Error loading collections: ' + error.message, 'error'); return []; }
    maintenanceCollections = data || [];
    return maintenanceCollections;
}

function getActiveRate(flatType, rates) {
    const now = new Date().toISOString().split('T')[0];
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
    await loadOwnersForMaintenance();
    await renderMaintenanceTab('rates');
};

window.switchMaintenanceTab = async function(tab) {
    currentMaintenanceTab = tab;
    document.querySelectorAll('#maintenance-tabs .pill').forEach(p => p.classList.toggle('active', p.dataset.mt === tab));
    await renderMaintenanceTab(tab);
};

async function renderMaintenanceTab(tab) {
    const container = document.getElementById('maintenance-container');
    const toolbar = document.getElementById('maintenance-toolbar');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
    toolbar.innerHTML = '';

    if (tab === 'rates') {
        await renderRatesTab(container, toolbar);
    } else if (tab === 'rate-archive') {
        await renderRateArchiveTab(container, toolbar);
    } else if (tab === 'collections') {
        await renderCollectionsTab(container, toolbar);
    } else if (tab === 'arrears') {
        await renderArrearsTab(container, toolbar);
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
    if (rates.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-tag"></i><br>No rate cards defined yet.</div>';
        return;
    }
    const flatTypes = [...new Set(rates.map(r => r.flat_type))].sort();
    const now = new Date().toISOString().split('T')[0];
    let html = '<div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px;">';
    for (const ft of flatTypes) {
        const active = rates.filter(r => r.flat_type === ft && r.effective_from <= now && (r.effective_to === null || r.effective_to >= now));
        const currentRate = active.length > 0 ? active[0] : null;
        html += '<div class="data-card">';
        html += `<div style="font-size:1.1rem;font-weight:700;margin-bottom:8px;">${escapeHtml(ft)}</div>`;
        if (currentRate) {
            html += `<div style="font-size:1.6rem;font-weight:800;color:var(--color-emerald);">₹${formatCurrency(currentRate.amount)}</div>`;
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
    const rates = await loadRates();
    if (rates.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-tag"></i><br>No rate cards defined yet.</div>';
        return;
    }
    const now = new Date().toISOString().split('T')[0];
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
                <td>₹${formatCurrency(r.amount)}</td>
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
        const effectiveToPrev = prevDate.toISOString().split('T')[0];

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

async function renderCollectionsTab(container, toolbar) {
    const now = new Date();
    let selMonth = now.getMonth() + 1;
    let selYear = now.getFullYear();

    const monthPicker = document.createElement('select');
    monthPicker.style.cssText = 'padding:6px 10px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-card);color:var(--text-primary);';
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
    yearPicker.style.cssText = 'padding:6px 10px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-card);color:var(--text-primary);width:90px;';

    const loadBtn = document.createElement('button');
    loadBtn.className = 'btn btn-sm';
    loadBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Load';
    loadBtn.onclick = async () => {
        selMonth = parseInt(monthPicker.value);
        selYear = parseInt(yearPicker.value);
        await renderCollectionsData(container, selMonth, selYear);
    };

    toolbar.appendChild(document.createTextNode('Month: '));
    toolbar.appendChild(monthPicker);
    toolbar.appendChild(document.createTextNode(' Year: '));
    toolbar.appendChild(yearPicker);
    toolbar.appendChild(loadBtn);

    await renderCollectionsData(container, selMonth, selYear);
}

async function renderCollectionsData(container, month, year) {
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';

    const rates = await loadRates();
    const collections = await loadCollections(month, year);
    const collectedMap = {};
    for (const c of collections) {
        collectedMap[c.flat_no] = c;
    }

    let allFlats = [];
    try {
        const { data } = await sbClient.from('owners').select('flat_no, flat_type, owner_name, occupancy_status').order('flat_no');
        if (data) allFlats = data;
    } catch { allFlats = []; }

    if (allFlats.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fa-solid fa-building"></i><br>No flats found. Import owners first.</div>';
        return;
    }

    function displayName(flat) {
        return window.displayStructured(flat.owner_name, 'name') || escapeHtml(flat.owner_name) || '—';
    }

    const now = new Date().toISOString().split('T')[0];
    let html = `<div style="margin-bottom:12px;font-size:0.85rem;color:var(--text-secondary);">
        ${allFlats.length} flats · ${Object.keys(collectedMap).length} collected · ₹${formatCurrency(collections.reduce((s,c)=>s+parseFloat(c.amount),0))} total
    </div>`;
    html += '<table class="data-table"><thead><tr><th>Flat</th><th>Type</th><th>Owner</th><th>Rate</th><th>Status</th><th>Paid On</th><th></th></tr></thead><tbody>';
    for (const flat of allFlats) {
        const existing = collectedMap[flat.flat_no];
        const activeRate = getActiveRate(flat.flat_type, rates);
        const rateAmount = activeRate ? activeRate.amount : 0;
        const collected = !!existing;
        const today = new Date().toISOString().split('T')[0];
        const isVacant = flat.occupancy_status === 'vacant' || (flat.occupancy_to && flat.occupancy_to <= today);
        const nameDisplay = displayName(flat);
        html += `<tr style="${isVacant ? 'opacity:0.5;background:repeating-linear-gradient(45deg,transparent,transparent 8px,rgba(255,255,255,0.015) 8px,rgba(255,255,255,0.015) 16px);' : ''}">
            <td><strong>${escapeHtml(flat.flat_no)}</strong>${isVacant ? ' <span style="font-size:0.65rem;color:var(--text-muted);font-weight:400;">(vacant)</span>' : ''}</td>
            <td>${escapeHtml(flat.flat_type || '—')}</td>
            <td>${isVacant ? '<span style="color:var(--text-muted);font-style:italic;">Vacant</span>' : nameDisplay}</td>
            <td>${rateAmount ? '₹'+formatCurrency(rateAmount) : '—'}</td>
            <td>${collected
                ? '<span style="color:var(--color-emerald);font-weight:700;">Paid</span>'
                : '<span style="color:var(--color-rose);font-weight:700;">Due</span>'
            }</td>
            <td style="font-size:0.8rem;color:var(--text-secondary);">${collected ? existing.paid_date + ' (' + existing.payment_method + ')' : '—'}</td>
            <td>${!collected && hasMaintenancePermission('maintenance:collect') && rateAmount > 0
                ? `<button class="btn btn-sm" onclick='openIncomeModalForCollection("${flat.flat_no}","${flat.flat_type}",${month},${year},${rateAmount})'><i class="fa-solid fa-hand-holding-dollar"></i> Collect</button>`
                : collected
                    ? `<span style="font-size:0.75rem;color:var(--text-secondary);">₹${formatCurrency(existing.amount)}</span>`
                    : ''
            }</td>
        </tr>`;
    }
    html += '</tbody></table>';
    container.innerHTML = html;
}

window.openIncomeModalForCollection = function(flatNo, flatType, month, year, amount) {
    const select = document.getElementById('inc-flat');
    if (select) {
        for (const opt of select.options) {
            if (opt.value.startsWith(flatNo + ' - ')) {
                select.value = opt.value;
                break;
            }
        }
    }
    const cat = document.getElementById('inc-category');
    if (cat) cat.value = 'Monthly Maintenance';
    const amt = document.getElementById('inc-amount');
    if (amt) amt.value = amount;
    const m = document.getElementById('inc-month');
    if (m) m.value = month;
    const y = document.getElementById('inc-year');
    if (y) y.value = year;
    const date = document.getElementById('inc-date');
    if (date) date.value = new Date().toISOString().split('T')[0];
    openModal('incomeModal');
};

window.openRecordCollection = function(flatNo, flatType, ownerName, month, year, amount) {
    document.getElementById('collection-flat-no').value = flatNo;
    document.getElementById('collection-flat-type').value = flatType;
    document.getElementById('collection-month').value = month;
    document.getElementById('collection-year').value = year;
    document.getElementById('collection-display-flat').textContent = flatNo + ' (' + flatType + ', ' + ownerName + ')';
    document.getElementById('collection-display-period').textContent = `${['January','February','March','April','May','June','July','August','September','October','November','December'][month-1]} ${year}`;
    document.getElementById('collection-display-amount').textContent = formatCurrency(amount);
    document.getElementById('collection-paid-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('collection-method').value = 'cash';
    document.getElementById('collection-ref').value = '';
    document.getElementById('collection-remarks').value = '';
    openModal('recordCollectionModal');
};

window.saveCollection = async function(e) {
    e.preventDefault();
    if (!hasMaintenancePermission('maintenance:collect')) { showToast('Access Denied.', 'error'); return; }
    const flatNo = document.getElementById('collection-flat-no').value;
    const flatType = document.getElementById('collection-flat-type').value;
    const month = parseInt(document.getElementById('collection-month').value);
    const year = parseInt(document.getElementById('collection-year').value);
    const paidDate = document.getElementById('collection-paid-date').value;
    const method = document.getElementById('collection-method').value;
    const txnRef = document.getElementById('collection-ref').value;
    const remarks = document.getElementById('collection-remarks').value;

    const rates = await loadRates();
    const rate = getRateOnDate(flatType, rates, paidDate);
    const amount = rate ? rate.amount : 0;
    if (amount === 0) { showToast('No active rate found for this flat type on ' + paidDate, 'error'); return; }

    const { error } = await sbClient.from('maintenance_collections').insert({
        flat_no: flatNo, flat_type: flatType,
        month, year, amount,
        rate_id: rate ? rate.id : null,
        paid_date: paidDate, payment_method: method,
        transaction_ref: txnRef, remarks,
        collected_by: currentUserId
    });
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    showToast(`✅ Collection recorded: ₹${formatCurrency(amount)} from ${flatNo}`, 'success');
    closeModal('recordCollectionModal');
    const monthPicker = document.querySelector('#maintenance-toolbar select');
    const yearPicker = document.querySelector('#maintenance-toolbar input[type="number"]');
    const m = monthPicker ? parseInt(monthPicker.value) : month;
    const y = yearPicker ? parseInt(yearPicker.value) : year;
    await renderCollectionsTab(document.getElementById('maintenance-container'), document.getElementById('maintenance-toolbar'));
};

async function renderArrearsTab(container, toolbar) {
    const rates = await loadRates();
    let allFlats = [];
    try {
        const { data } = await sbClient.from('owners').select('flat_no, flat_type, owner_name, occupancy_status').order('flat_no');
        if (data) allFlats = data;
    } catch { allFlats = []; }

    if (allFlats.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fa-solid fa-building"></i><br>No flats found.</div>';
        return;
    }

    function displayName(flat) {
        return window.displayStructured(flat.owner_name, 'name') || escapeHtml(flat.owner_name) || '—';
    }

    const { data: allCollections } = await sbClient.from('maintenance_collections').select('*').order('year', { ascending: false }).order('month', { ascending: false });
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
        for (const pm of pendingMonths) {
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
        ${flatArrears.length} flats in arrears · Total due: ₹${formatCurrency(flatArrears.reduce((s,f)=>s+f.pendingAmount,0))}
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
            <td style="color:var(--color-rose);font-weight:700;">₹${formatCurrency(af.pendingAmount)}</td>
            <td style="font-size:0.8rem;color:var(--text-secondary);">${af.lastPaid || 'Never'}</td>
        </tr>`;
    }
    html += '</tbody></table>';
    container.innerHTML = html;
}
