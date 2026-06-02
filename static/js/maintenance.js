import { sbClient, currentUserId, currentUserRole } from '/static/app.js';

let maintenanceRates = [];
let maintenanceCollections = [];
let currentMaintenanceTab = 'rates';
let ownersList = [];

async function loadOwnersForMaintenance() {
    try {
        const { data } = await sbClient.from('owners').select('flat_no, flat_type, name').order('flat_no');
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
        const all = rates.filter(r => r.flat_type === ft).sort((a, b) => b.effective_from.localeCompare(a.effective_from));
        const currentRate = active.length > 0 ? active[0] : null;
        html += '<div class="data-card">';
        html += `<div style="font-size:1.1rem;font-weight:700;margin-bottom:8px;">${escapeHtml(ft)}</div>`;
        if (currentRate) {
            html += `<div style="font-size:1.6rem;font-weight:800;color:var(--color-emerald);">₹${formatCurrency(currentRate.amount)}</div>`;
            html += `<div style="font-size:0.75rem;color:var(--text-secondary);">Effective ${currentRate.effective_from}</div>`;
        } else {
            html += '<div style="color:var(--color-rose);font-size:0.9rem;">No active rate</div>';
        }
        if (all.length > 1) {
            html += '<details style="margin-top:8px;"><summary style="cursor:pointer;font-size:0.8rem;color:var(--text-secondary);">Rate History</summary>';
            for (const r of all) {
                const isActive = r.effective_from <= now && (r.effective_to === null || r.effective_to >= now);
                html += `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.8rem;${isActive?'font-weight:700;':''}">
                    <span>₹${formatCurrency(r.amount)}</span>
                    <span style="color:var(--text-secondary);">${r.effective_from}${r.effective_to ? ' → '+r.effective_to : ' (current)'}</span>
                </div>`;
            }
            html += '</details>';
        }
        if (hasMaintenancePermission('maintenance:manage_rates')) {
            html += `<div style="margin-top:8px;"><button class="btn btn-sm" onclick='editRate("${all[0].id}")'><i class="fa-solid fa-pen"></i> Edit</button></div>`;
        }
        html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
}

window.openCreateRateModal = function(rateId) {
    if (!hasMaintenancePermission('maintenance:manage_rates')) { showToast('Access Denied.', 'error'); return; }
    document.getElementById('edit-rate-id').value = rateId || '';
    document.getElementById('create-rate-title').textContent = rateId ? 'Edit Rate Card' : 'New Rate Card';
    if (rateId) {
        const rate = maintenanceRates.find(r => r.id === rateId);
        if (rate) {
            document.getElementById('rate-flat-type').value = rate.flat_type;
            document.getElementById('rate-amount').value = rate.amount;
            document.getElementById('rate-effective-from').value = rate.effective_from;
        }
    } else {
        document.getElementById('create-rate-form').reset();
        document.getElementById('edit-rate-id').value = '';
        document.getElementById('rate-effective-from').value = new Date().toISOString().split('T')[0];
    }
    openModal('createRateModal');
};

window.saveRate = async function(e) {
    e.preventDefault();
    if (!hasMaintenancePermission('maintenance:manage_rates')) { showToast('Access Denied.', 'error'); return; }
    const editId = document.getElementById('edit-rate-id').value;
    const flatType = document.getElementById('rate-flat-type').value;
    const amount = parseFloat(document.getElementById('rate-amount').value);
    const effectiveFrom = document.getElementById('rate-effective-from').value;

    if (editId) {
        const { error } = await sbClient.from('maintenance_rates').update({ flat_type: flatType, amount, effective_from: effectiveFrom }).eq('id', editId);
        if (error) { showToast('Error: ' + error.message, 'error'); return; }
        showToast('Rate updated!', 'success');
    } else {
        const now = new Date().toISOString().split('T')[0];
        const { error: expireError } = await sbClient.from('maintenance_rates')
            .update({ effective_to: effectiveFrom, is_active: false })
            .eq('flat_type', flatType)
            .is('effective_to', null)
            .lte('effective_from', effectiveFrom);
        if (expireError) console.warn('Expire old rates:', expireError);
        const { error } = await sbClient.from('maintenance_rates').insert({
            flat_type: flatType, amount, effective_from: effectiveFrom,
            is_active: true, created_by: currentUserId
        });
        if (error) { showToast('Error: ' + error.message, 'error'); return; }
        showToast('Rate created!', 'success');
    }
    closeModal('createRateModal');
    await renderMaintenanceTab('rates');
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
        const { data } = await sbClient.from('owners').select('flat_no, flat_type, name, occupant_type').order('flat_no');
        if (data) allFlats = data;
    } catch { allFlats = []; }

    if (allFlats.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fa-solid fa-building"></i><br>No flats found. Import owners first.</div>';
        return;
    }

    const now = new Date().toISOString().split('T')[0];
    let html = `<div style="margin-bottom:12px;font-size:0.85rem;color:var(--text-secondary);">
        ${allFlats.length} flats · ${Object.keys(collectedMap).length} collected · ₹${formatCurrency(collections.reduce((s,c)=>s+parseFloat(c.amount),0))} total
    </div>`;
    html += '<table class="data-table"><thead><tr><th>Flat</th><th>Type</th><th>Owner</th><th>Rate</th><th>Status</th><th></th></tr></thead><tbody>';
    for (const flat of allFlats) {
        const existing = collectedMap[flat.flat_no];
        const activeRate = getActiveRate(flat.flat_type, rates);
        const rateAmount = activeRate ? activeRate.amount : 0;
        const collected = !!existing;
        html += `<tr>
            <td><strong>${escapeHtml(flat.flat_no)}</strong></td>
            <td>${escapeHtml(flat.flat_type || '—')}</td>
            <td>${escapeHtml(flat.name || '—')}</td>
            <td>${rateAmount ? '₹'+formatCurrency(rateAmount) : '—'}</td>
            <td>${collected
                ? '<span style="color:var(--color-emerald);font-weight:700;">✅ Paid</span>'
                : '<span style="color:var(--color-rose);font-weight:700;">⏳ Pending</span>'
            }</td>
            <td>${!collected && hasMaintenancePermission('maintenance:collect') && rateAmount > 0
                ? `<button class="btn btn-sm" onclick='openRecordCollection("${flat.flat_no}","${flat.flat_type}","${flat.name||''}",${month},${year},${rateAmount})'><i class="fa-solid fa-hand-holding-dollar"></i> Collect</button>`
                : collected
                    ? `<span style="font-size:0.75rem;color:var(--text-secondary);">${existing.paid_date} (${existing.payment_method})</span>`
                    : ''
            }</td>
        </tr>`;
    }
    html += '</tbody></table>';
    container.innerHTML = html;
}

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
        const { data } = await sbClient.from('owners').select('flat_no, flat_type, name').order('flat_no');
        if (data) allFlats = data;
    } catch { allFlats = []; }

    if (allFlats.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fa-solid fa-building"></i><br>No flats found.</div>';
        return;
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
            <td>${escapeHtml(af.flat.name || '—')}</td>
            <td>${af.pendingCount}</td>
            <td style="color:var(--color-rose);font-weight:700;">₹${formatCurrency(af.pendingAmount)}</td>
            <td style="font-size:0.8rem;color:var(--text-secondary);">${af.lastPaid || 'Never'}</td>
        </tr>`;
    }
    html += '</tbody></table>';
    container.innerHTML = html;
}
