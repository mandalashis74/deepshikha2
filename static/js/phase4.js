// ==========================================
// PHASE 4: VENDORS, VISITORS, ASSETS, POLLS, PARKING
// ==========================================

// --- VENDORS ---
let allVendors = [];

window.openVendorsModal = async function() {
    if (!hasPermission('vendors:view')) { showToast("Access Denied.", "error"); return; }
    openModal('vendorsModal');
    const btn = document.getElementById('btn-create-vendor');
    if (btn) btn.style.display = hasPermission('vendors:create') ? '' : 'none';
    await loadVendors();
};

async function loadVendors() {
    const container = document.getElementById('vendors-container');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
    try {
        const { data, error } = await sbClient.from('vendors').select('*').order('name', { ascending: true });
        if (error) throw error;
        allVendors = data || [];
        renderVendors();
    } catch (err) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--color-rose);">Failed to load vendors.</div>';
    }
}

function renderVendors() {
    const container = document.getElementById('vendors-container');
    if (!container) return;
    if (allVendors.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-handshake"></i> No vendors added yet.</div>';
        return;
    }
    const canManage = hasPermission('vendors:manage');
    const canCreate = hasPermission('vendors:create');
    container.innerHTML = allVendors.map(v => {
        const now = new Date();
        const endDate = v.contract_end ? new Date(v.contract_end + 'T00:00:00') : null;
        const expiring = endDate && endDate > now && (endDate - now) / (1000*60*60*24) <= 90;
        const expired = endDate && endDate < now;
        const statusColor = v.status === 'active' ? 'var(--color-emerald)' : v.status === 'terminated' ? 'var(--color-rose)' : 'var(--text-muted)';
        const startStr = v.contract_start ? new Date(v.contract_start + 'T00:00:00').toLocaleDateString('en-IN') : '--';
        const endStr = v.contract_end ? new Date(v.contract_end + 'T00:00:00').toLocaleDateString('en-IN') : '--';
        const warnIcon = expiring ? ' <i class="fa-solid fa-triangle-exclamation" style="color:var(--color-yellow);" title="Expiring soon"></i>' : '';
        return `<div class="data-card">
            <div class="data-card-top">
                <div class="data-card-title">${escapeHtml(v.name)}${warnIcon}</div>
                <span class="pill" style="background:${statusColor}20; color:${statusColor};">${v.status}</span>
            </div>
            <div class="data-card-body">
                <div class="data-card-row"><span class="data-label">Service</span> ${escapeHtml(v.service_type.replace(/_/g, ' '))}</div>
                ${v.contact_person ? `<div class="data-card-row"><span class="data-label">Contact</span> ${escapeHtml(v.contact_person)}${v.phone ? ' &middot; ' + escapeHtml(v.phone) : ''}</div>` : ''}
                <div class="data-card-row"><span class="data-label">Contract</span> ${startStr} &rarr; ${endStr} ${expired ? '<span style="color:var(--color-rose);">(Expired)</span>' : ''}</div>
                ${v.amc_amount > 0 ? `<div class="data-card-row"><span class="data-label">AMC</span> ₹${Number(v.amc_amount).toLocaleString('en-IN')}</div>` : ''}
                ${v.notes ? `<div class="data-card-row"><span class="data-label">Notes</span> ${escapeHtml(v.notes)}</div>` : ''}
            </div>
            <div class="data-card-actions">
                ${canCreate ? `<button class="btn btn-sm btn-slate" onclick="editVendor('${v.id}')"><i class="fa-solid fa-pen"></i></button>` : ''}
                ${canManage ? `<button class="btn btn-sm ${v.status === 'active' ? 'btn-rose' : 'btn-success'}" onclick="toggleVendorStatus('${v.id}','${v.status}')">${v.status === 'active' ? '<i class="fa-solid fa-ban"></i> Terminate' : '<i class="fa-solid fa-check"></i> Activate'}</button>` : ''}
                ${v.documents_url ? `<a href="${escapeHtml(v.documents_url)}" target="_blank" class="btn btn-sm btn-primary"><i class="fa-solid fa-file"></i></a>` : ''}
            </div>
        </div>`;
    }).join('');
}

window.openCreateVendorModal = function(data = null) {
    if (!hasPermission('vendors:create')) { showToast("Access Denied.", "error"); return; }
    document.getElementById('create-vendor-title').textContent = data ? 'Edit Vendor' : 'New Vendor';
    document.getElementById('edit-vendor-id').value = data ? data.id : '';
    document.getElementById('vendor-name').value = data ? data.name : '';
    document.getElementById('vendor-service').value = data ? data.service_type : 'lift';
    document.getElementById('vendor-contact').value = data ? data.contact_person : '';
    document.getElementById('vendor-phone').value = data ? data.phone : '';
    document.getElementById('vendor-email').value = data ? data.email : '';
    document.getElementById('vendor-start').value = data ? data.contract_start : '';
    document.getElementById('vendor-end').value = data ? data.contract_end : '';
    document.getElementById('vendor-amc').value = data ? data.amc_amount : '';
    document.getElementById('vendor-docs').value = data ? data.documents_url : '';
    document.getElementById('vendor-notes').value = data ? data.notes : '';
    openModal('createVendorModal');
};

window.saveVendor = async function(e) {
    e.preventDefault();
    if (!sbClient || !hasPermission('vendors:create')) { showToast("Access Denied.", "error"); return; }
    const id = document.getElementById('edit-vendor-id').value;
    const data = {
        name: document.getElementById('vendor-name').value.trim(),
        service_type: document.getElementById('vendor-service').value,
        contact_person: document.getElementById('vendor-contact').value.trim(),
        phone: document.getElementById('vendor-phone').value.trim(),
        email: document.getElementById('vendor-email').value.trim(),
        contract_start: document.getElementById('vendor-start').value || null,
        contract_end: document.getElementById('vendor-end').value || null,
        amc_amount: parseFloat(document.getElementById('vendor-amc').value) || 0,
        documents_url: document.getElementById('vendor-docs').value.trim(),
        notes: document.getElementById('vendor-notes').value.trim()
    };
    try {
        if (id) {
            const { error } = await sbClient.from('vendors').update(data).eq('id', id);
            if (error) throw error;
            showToast('Vendor updated.', 'success');
        } else {
            data.created_by = currentUserId;
            const { error } = await sbClient.from('vendors').insert(data);
            if (error) throw error;
            showToast('Vendor added!', 'success');
        }
        closeModal('createVendorModal');
        await loadVendors();
    } catch (err) {
        showToast(err.message || 'Failed to save vendor.', 'error');
    }
};

window.editVendor = function(id) {
    const item = allVendors.find(v => v.id === id);
    if (item) openCreateVendorModal(item);
};

window.toggleVendorStatus = async function(id, currentStatus) {
    if (!hasPermission('vendors:manage')) { showToast("Access Denied.", "error"); return; }
    const newStatus = currentStatus === 'active' ? 'terminated' : 'active';
    const verb = newStatus === 'active' ? 'Activate' : 'Terminate';
    const { isConfirmed: vend } = await Swal.fire({ title: 'Confirm', text: `${verb} this vendor?`, icon: 'question', showCancelButton: true, confirmButtonColor: '#6366f1', confirmButtonText: verb, cancelButtonText: 'Cancel' });
    if (!vend) return;
    try {
        const { error } = await sbClient.from('vendors').update({ status: newStatus }).eq('id', id);
        if (error) throw error;
        showToast(`Vendor ${newStatus}.`, 'success');
        await loadVendors();
    } catch (err) {
        showToast(err.message, 'error');
    }
};

// --- VISITOR PASSES ---
let allVisitors = [];
let visitorFilter = 'all';

window.openVisitorsModal = async function() {
    if (!hasPermission('visitors:view')) { showToast("Access Denied.", "error"); return; }
    openModal('visitorsModal');
    const btn = document.getElementById('btn-create-visitor');
    if (btn) btn.style.display = hasPermission('visitors:create') ? '' : 'none';
    await loadVisitors();
};

async function loadVisitors() {
    const container = document.getElementById('visitors-container');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
    try {
        const { data, error } = await sbClient.from('visitor_passes').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        allVisitors = data || [];
        renderVisitors(visitorFilter);
    } catch (err) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--color-rose);">Failed to load visitor passes.</div>';
    }
}

window.filterVisitors = function(status) {
    visitorFilter = status;
    document.querySelectorAll('#visitor-filter-pills .pill').forEach(p => p.classList.remove('active'));
    const btn = document.querySelector(`#visitor-filter-pills [data-visitor="${status}"]`);
    if (btn) btn.classList.add('active');
    renderVisitors(status);
};

function renderVisitors(status) {
    const container = document.getElementById('visitors-container');
    if (!container) return;
    let passes = allVisitors;
    if (status !== 'all') passes = passes.filter(p => p.status === status);
    if (passes.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-address-card"></i> No visitor passes found.</div>';
        return;
    }
    const canApprove = hasPermission('visitors:approve');
    const canCreate = hasPermission('visitors:create');
    container.innerHTML = passes.map(p => {
        const statusColors = { pending:'var(--color-yellow)', approved:'var(--color-indigo)', checked_in:'var(--color-emerald)', checked_out:'var(--text-muted)', expired:'var(--color-rose)', rejected:'var(--color-rose)' };
        const sc = statusColors[p.status] || 'var(--text-muted)';
        const fromStr = p.valid_from ? new Date(p.valid_from).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '--';
        const untilStr = p.valid_until ? new Date(p.valid_until).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '--';
        const vehicleInfo = p.vehicle_type !== 'none' ? `${p.vehicle_type.toUpperCase()} ${p.vehicle_no ? '· ' + escapeHtml(p.vehicle_no) : ''}` : '';
        return `<div class="data-card">
            <div class="data-card-top">
                <div class="data-card-title">${escapeHtml(p.visitor_name)} <span style="font-size:0.7rem;color:var(--text-muted);">(${escapeHtml(p.flat_no)})</span></div>
                <span class="pill" style="background:${sc}20; color:${sc};">${p.status.replace('_', ' ')}</span>
            </div>
            <div class="data-card-body">
                ${p.purpose ? `<div class="data-card-row"><span class="data-label">Purpose</span> ${escapeHtml(p.purpose)}</div>` : ''}
                ${p.phone ? `<div class="data-card-row"><span class="data-label">Phone</span> ${escapeHtml(p.phone)}</div>` : ''}
                <div class="data-card-row"><span class="data-label">Valid</span> ${fromStr} &rarr; ${untilStr}</div>
                ${vehicleInfo ? `<div class="data-card-row"><span class="data-label">Vehicle</span> ${vehicleInfo}</div>` : ''}
            </div>
            <div class="data-card-actions">
                ${p.status === 'pending' && canApprove ? `<button class="btn btn-sm btn-success" onclick="updateVisitorStatus('${p.id}','approved')"><i class="fa-solid fa-check"></i> Approve</button>
                <button class="btn btn-sm btn-rose" onclick="updateVisitorStatus('${p.id}','rejected')"><i class="fa-solid fa-times"></i> Reject</button>` : ''}
                ${p.status === 'approved' && canApprove ? `<button class="btn btn-sm btn-primary" onclick="updateVisitorStatus('${p.id}','checked_in')"><i class="fa-solid fa-right-to-bracket"></i> Check In</button>` : ''}
                ${p.status === 'checked_in' && canApprove ? `<button class="btn btn-sm btn-slate" onclick="updateVisitorStatus('${p.id}','checked_out')"><i class="fa-solid fa-right-from-bracket"></i> Check Out</button>` : ''}
            </div>
        </div>`;
    }).join('');
}

window.openCreateVisitorModal = function() {
    if (!hasPermission('visitors:create')) { showToast("Access Denied.", "error"); return; }
    document.getElementById('create-visitor-title').textContent = 'New Visitor Pass';
    document.getElementById('edit-visitor-id').value = '';
    document.getElementById('visitor-name').value = '';
    document.getElementById('visitor-phone').value = '';
    document.getElementById('visitor-flat').value = localStorage.getItem('currentFlatNo') || '';
    document.getElementById('visitor-purpose').value = '';
    document.getElementById('visitor-vehicle-type').value = 'none';
    document.getElementById('visitor-vehicle').value = '';
    document.getElementById('visitor-from').value = '';
    document.getElementById('visitor-until').value = '';
    openModal('createVisitorModal');
};

window.saveVisitor = async function(e) {
    e.preventDefault();
    if (!sbClient || !hasPermission('visitors:create')) { showToast("Access Denied.", "error"); return; }
    const id = document.getElementById('edit-visitor-id').value;
    const data = {
        visitor_name: document.getElementById('visitor-name').value.trim(),
        phone: document.getElementById('visitor-phone').value.trim(),
        flat_no: document.getElementById('visitor-flat').value.trim(),
        purpose: document.getElementById('visitor-purpose').value.trim(),
        vehicle_type: document.getElementById('visitor-vehicle-type').value,
        vehicle_no: document.getElementById('visitor-vehicle').value.trim(),
        valid_from: document.getElementById('visitor-from').value ? new Date(document.getElementById('visitor-from').value).toISOString() : new Date().toISOString(),
        valid_until: document.getElementById('visitor-until').value ? new Date(document.getElementById('visitor-until').value).toISOString() : null
    };
    try {
        if (id) {
            const { error } = await sbClient.from('visitor_passes').update(data).eq('id', id);
            if (error) throw error;
        } else {
            data.created_by = currentUserId;
            data.pass_type = 'pre_auth_guest';
            data.status = 'approved';
            data.qr_token = Math.random().toString(36).substring(2, 10).toUpperCase();
            const { error } = await sbClient.from('visitor_passes').insert(data);
            if (error) throw error;
        }
        showToast(id ? 'Pass updated.' : 'Pass created!', 'success');
        closeModal('createVisitorModal');
        await loadVisitors();
    } catch (err) {
        showToast(err.message || 'Failed to save pass.', 'error');
    }
};

window.updateVisitorStatus = async function(id, status) {
    if (!hasPermission('visitors:approve')) { showToast("Access Denied.", "error"); return; }
    try {
        const updates = { status };
        if (status === 'approved') updates.approved_by = currentUserId;
        const { error } = await sbClient.from('visitor_passes').update(updates).eq('id', id);
        if (error) throw error;
        showToast(`Pass ${status.replace('_', ' ')}.`, 'success');
        await loadVisitors();
    } catch (err) {
        showToast(err.message, 'error');
    }
};

// --- ASSETS ---
let allAssets = [];
let assetFilter = 'all';

window.openAssetsModal = async function() {
    if (!hasPermission('assets:view')) { showToast("Access Denied.", "error"); return; }
    openModal('assetsModal');
    const btn = document.getElementById('btn-create-asset');
    if (btn) btn.style.display = hasPermission('assets:create') ? '' : 'none';
    await loadAssets();
};

async function loadAssets() {
    const container = document.getElementById('assets-container');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
    try {
        const { data, error } = await sbClient.from('assets').select('*').order('name', { ascending: true });
        if (error) throw error;
        allAssets = data || [];
        renderAssets(assetFilter);
    } catch (err) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--color-rose);">Failed to load assets.</div>';
    }
}

window.filterAssets = function(status) {
    assetFilter = status;
    document.querySelectorAll('#asset-filter-pills .pill').forEach(p => p.classList.remove('active'));
    const btn = document.querySelector(`#asset-filter-pills [data-asset="${status}"]`);
    if (btn) btn.classList.add('active');
    renderAssets(status);
};

function renderAssets(status) {
    const container = document.getElementById('assets-container');
    if (!container) return;
    let items = allAssets;
    if (status !== 'all') items = items.filter(a => a.status === status);
    if (items.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-cubes"></i> No assets found.</div>';
        return;
    }
    const canManage = hasPermission('assets:manage');
    const canCreate = hasPermission('assets:create');
    container.innerHTML = items.map(a => {
        const statusColors = { operational:'var(--color-emerald)', under_maintenance:'var(--color-yellow)', broken:'var(--color-rose)', decommissioned:'var(--text-muted)' };
        const sc = statusColors[a.status] || 'var(--text-muted)';
        const warrantyDate = a.warranty_expiry ? new Date(a.warranty_expiry + 'T00:00:00') : null;
        const warrantyExpired = warrantyDate && warrantyDate < new Date();
        const warrantyStr = warrantyDate ? warrantyDate.toLocaleDateString('en-IN') + (warrantyExpired ? ' <span style="color:var(--color-rose);">(Expired)</span>' : '') : '--';
        return `<div class="data-card">
            <div class="data-card-top">
                <div class="data-card-title">${escapeHtml(a.name)}</div>
                <span class="pill" style="background:${sc}20; color:${sc};">${a.status.replace(/_/g, ' ')}</span>
            </div>
            <div class="data-card-body">
                <div class="data-card-row"><span class="data-label">Category</span> ${escapeHtml(a.category)}</div>
                ${a.location ? `<div class="data-card-row"><span class="data-label">Location</span> ${escapeHtml(a.location)}</div>` : ''}
                ${a.purchase_cost > 0 ? `<div class="data-card-row"><span class="data-label">Cost</span> ₹${Number(a.purchase_cost).toLocaleString('en-IN')}</div>` : ''}
                <div class="data-card-row"><span class="data-label">Warranty</span> ${warrantyStr}</div>
                ${a.serial_no ? `<div class="data-card-row"><span class="data-label">S/N</span> ${escapeHtml(a.serial_no)}</div>` : ''}
                ${a.notes ? `<div class="data-card-row"><span class="data-label">Notes</span> ${escapeHtml(a.notes)}</div>` : ''}
            </div>
            <div class="data-card-actions">
                ${canCreate ? `<button class="btn btn-sm btn-slate" onclick="editAsset('${a.id}')"><i class="fa-solid fa-pen"></i></button>` : ''}
                ${canManage ? `<button class="btn btn-sm btn-primary" onclick="scheduleMaintenance('${a.id}')"><i class="fa-solid fa-wrench"></i> Maintenance</button>` : ''}
            </div>
        </div>`;
    }).join('');
}

window.openCreateAssetModal = function(data = null) {
    if (!hasPermission('assets:create')) { showToast("Access Denied.", "error"); return; }
    document.getElementById('create-asset-title').textContent = data ? 'Edit Asset' : 'New Asset';
    document.getElementById('edit-asset-id').value = data ? data.id : '';
    document.getElementById('asset-name').value = data ? data.name : '';
    document.getElementById('asset-category').value = data ? data.category : 'equipment';
    document.getElementById('asset-location').value = data ? data.location : '';
    document.getElementById('asset-purchase-date').value = data ? data.purchase_date : '';
    document.getElementById('asset-cost').value = data ? data.purchase_cost : '';
    document.getElementById('asset-warranty').value = data ? data.warranty_expiry : '';
    document.getElementById('asset-serial').value = data ? data.serial_no : '';
    document.getElementById('asset-status').value = data ? data.status : 'operational';
    document.getElementById('asset-notes').value = data ? data.notes : '';
    openModal('createAssetModal');
};

window.saveAsset = async function(e) {
    e.preventDefault();
    if (!sbClient || !hasPermission('assets:create')) { showToast("Access Denied.", "error"); return; }
    const id = document.getElementById('edit-asset-id').value;
    const data = {
        name: document.getElementById('asset-name').value.trim(),
        category: document.getElementById('asset-category').value,
        location: document.getElementById('asset-location').value.trim(),
        purchase_date: document.getElementById('asset-purchase-date').value || null,
        purchase_cost: parseFloat(document.getElementById('asset-cost').value) || 0,
        warranty_expiry: document.getElementById('asset-warranty').value || null,
        serial_no: document.getElementById('asset-serial').value.trim(),
        status: document.getElementById('asset-status').value,
        notes: document.getElementById('asset-notes').value.trim()
    };
    try {
        if (id) {
            const { error } = await sbClient.from('assets').update(data).eq('id', id);
            if (error) throw error;
            showToast('Asset updated.', 'success');
        } else {
            data.created_by = currentUserId;
            const { error } = await sbClient.from('assets').insert(data);
            if (error) throw error;
            showToast('Asset added!', 'success');
        }
        closeModal('createAssetModal');
        await loadAssets();
    } catch (err) {
        showToast(err.message || 'Failed to save asset.', 'error');
    }
};

window.editAsset = function(id) {
    const item = allAssets.find(a => a.id === id);
    if (item) openCreateAssetModal(item);
};

window.scheduleMaintenance = async function(assetId) {
    if (!hasPermission('assets:manage')) { showToast("Access Denied.", "error"); return; }
    const task = prompt('Maintenance task:');
    if (!task) return;
    const freq = prompt('Frequency (weekly/monthly/quarterly/yearly):', 'monthly') || 'monthly';
    const nextDue = prompt('Next due date (YYYY-MM-DD):');
    try {
        const { error } = await sbClient.from('maintenance_schedules').insert({
            asset_id: assetId, task, frequency: freq,
            next_due: nextDue || null, created_at: new Date().toISOString()
        });
        if (error) throw error;
        // Update asset status
        await sbClient.from('assets').update({ status: 'under_maintenance' }).eq('id', assetId);
        showToast('Maintenance scheduled!', 'success');
        await loadAssets();
    } catch (err) {
        showToast(err.message, 'error');
    }
};

// --- POLLS ---
let allPolls = [];
let myPollVotes = {};

window.openPollsModal = async function() {
    if (!hasPermission('polls:view')) { showToast("Access Denied.", "error"); return; }
    openModal('pollsModal');
    const btn = document.getElementById('btn-create-poll');
    if (btn) btn.style.display = hasPermission('polls:create') ? '' : 'none';
    await loadPolls();
};

async function loadPolls() {
    const container = document.getElementById('polls-container');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
    try {
        const [pollsRes, votesRes] = await Promise.all([
            sbClient.from('polls').select('*').order('created_at', { ascending: false }),
            currentUserId ? sbClient.from('poll_votes').select('*').eq('user_id', currentUserId) : { data: [] }
        ]);
        if (pollsRes.error) throw pollsRes.error;
        allPolls = pollsRes.data || [];
        myPollVotes = {};
        (votesRes.data || []).forEach(v => { myPollVotes[v.poll_id] = v; });
        renderPolls();
    } catch (err) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--color-rose);">Failed to load polls.</div>';
    }
}

function renderPolls() {
    const container = document.getElementById('polls-container');
    if (!container) return;
    if (allPolls.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-square-poll-vertical"></i> No polls created yet.</div>';
        return;
    }
    const canVote = hasPermission('polls:vote');
    container.innerHTML = allPolls.map(p => {
        const options = p.options || [];
        const totalVotes = options.reduce((s, o) => s + (o.votes || 0), 0);
        const userVote = myPollVotes[p.id];
        const hasVoted = !!userVote;
        const isExpired = p.expires_at && new Date(p.expires_at) < new Date();
        const pollStatus = isExpired || p.status === 'closed' ? 'closed' : 'active';
        return `<div class="data-card">
            <div class="data-card-top">
                <div class="data-card-title">${escapeHtml(p.title)}</div>
                <span class="pill" style="background:${pollStatus === 'active' ? 'var(--color-emerald)20;color:var(--color-emerald)' : 'var(--text-muted)20;color:var(--text-muted)'};">${pollStatus}</span>
            </div>
            ${p.description ? `<div class="data-card-body"><div class="data-card-row">${escapeHtml(p.description)}</div></div>` : ''}
            <div class="poll-options" style="padding:8px 12px;">
                ${options.map((o, i) => {
                    const pct = totalVotes > 0 ? Math.round((o.votes || 0) / totalVotes * 100) : 0;
                    const isSelected = hasVoted && userVote.selected_options.includes(i);
                    return `<div class="poll-option ${pollStatus === 'closed' ? 'poll-result' : ''}" onclick="${pollStatus === 'active' && canVote ? `castVote('${p.id}',${i},'${p.type}')` : ''}" style="${isSelected ? 'border-color:var(--color-indigo);' : ''}">
                        <div style="display:flex;justify-content:space-between;width:100%;position:relative;z-index:1;">
                            <span>${escapeHtml(o.text)}</span>
                            ${hasVoted || pollStatus === 'closed' ? `<span>${o.votes || 0} (${pct}%)</span>` : ''}
                        </div>
                        ${hasVoted || pollStatus === 'closed' ? `<div class="poll-bar" style="width:${pct}%;${isSelected ? 'background:var(--color-indigo);' : ''}"></div>` : ''}
                    </div>`;
                }).join('')}
                <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;">${totalVotes} vote${totalVotes !== 1 ? 's' : ''}${hasVoted ? ' &middot; You voted' : ''}</div>
            </div>
        </div>`;
    }).join('');
}

window.openCreatePollModal = function() {
    if (!hasPermission('polls:create')) { showToast("Access Denied.", "error"); return; }
    document.getElementById('create-poll-title').textContent = 'New Poll';
    document.getElementById('edit-poll-id').value = '';
    document.getElementById('poll-title').value = '';
    document.getElementById('poll-description').value = '';
    document.getElementById('poll-type').value = 'single';
    document.getElementById('poll-options').value = '';
    document.getElementById('poll-expires').value = '';
    openModal('createPollModal');
};

window.savePoll = async function(e) {
    e.preventDefault();
    if (!sbClient || !hasPermission('polls:create')) { showToast("Access Denied.", "error"); return; }
    const id = document.getElementById('edit-poll-id').value;
    const optionsText = document.getElementById('poll-options').value.trim().split('\n').filter(Boolean);
    if (optionsText.length < 2) { showToast('Add at least 2 options.', 'error'); return; }
    const optionsJson = optionsText.map(t => ({ text: t.trim(), votes: 0 }));
    const data = {
        title: document.getElementById('poll-title').value.trim(),
        description: document.getElementById('poll-description').value.trim(),
        type: document.getElementById('poll-type').value,
        options: optionsJson,
        expires_at: document.getElementById('poll-expires').value ? new Date(document.getElementById('poll-expires').value).toISOString() : null
    };
    try {
        if (id) {
            const { error } = await sbClient.from('polls').update(data).eq('id', id);
            if (error) throw error;
        } else {
            data.created_by = currentUserId;
            const { error } = await sbClient.from('polls').insert(data);
            if (error) throw error;
        }
        showToast(id ? 'Poll updated.' : 'Poll created!', 'success');
        closeModal('createPollModal');
        await loadPolls();
    } catch (err) {
        showToast(err.message || 'Failed to save poll.', 'error');
    }
};

window.castVote = async function(pollId, optionIndex, type) {
    if (!currentUserId) { showToast('Please log in to vote.', 'error'); return; }
    if (!hasPermission('polls:vote')) { showToast("Access Denied.", "error"); return; }
    const existing = myPollVotes[pollId];
    let selected;
    if (existing) {
        if (type === 'single') {
            if (existing.selected_options.includes(optionIndex)) { showToast('Already voted for this option.', 'info'); return; }
            selected = [optionIndex];
        } else {
            const set = new Set(existing.selected_options);
            if (set.has(optionIndex)) set.delete(optionIndex); else if (set.size < 10) set.add(optionIndex);
            selected = [...set];
            if (selected.length === existing.selected_options.length && !existing.selected_options.includes(optionIndex)) return;
        }
        await sbClient.from('poll_votes').update({ selected_options: selected }).eq('id', existing.id);
    } else {
        selected = [optionIndex];
        await sbClient.from('poll_votes').insert({ poll_id: pollId, user_id: currentUserId, selected_options: selected });
    }
    showToast('Vote recorded!', 'success');
    await loadPolls();
};

// --- PARKING ---
let allParking = [];
let parkingFilter = 'all';

window.openParkingModal = async function() {
    if (!hasPermission('parking:view')) { showToast("Access Denied.", "error"); return; }
    openModal('parkingModal');
    const btn = document.getElementById('btn-create-parking');
    const canManage = hasPermission('parking:assign') || hasPermission('parking:manage');
    if (btn) btn.style.display = canManage ? '' : 'none';
    await loadParking();
};

async function loadParking() {
    const container = document.getElementById('parking-container');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
    try {
        const { data, error } = await sbClient.from('parking_slots').select('*').order('slot_number', { ascending: true });
        if (error) throw error;
        allParking = data || [];
        renderParking(parkingFilter);
    } catch (err) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--color-rose);">Failed to load parking slots.</div>';
    }
}

window.filterParking = function(status) {
    parkingFilter = status;
    document.querySelectorAll('#parking-filter-pills .pill').forEach(p => p.classList.remove('active'));
    const btn = document.querySelector(`#parking-filter-pills [data-park="${status}"]`);
    if (btn) btn.classList.add('active');
    renderParking(status);
};

function renderParking(status) {
    const container = document.getElementById('parking-container');
    if (!container) return;
    let slots = allParking;
    if (status !== 'all') slots = slots.filter(s => s.status === status);
    if (slots.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-square-parking"></i> No parking slots found.</div>';
        return;
    }
    const canManage = hasPermission('parking:assign') || hasPermission('parking:manage');
    const typeIcons = { car:'<i class="fa-solid fa-car"></i>', bike:'<i class="fa-solid fa-motorcycle"></i>', visitor:'<i class="fa-solid fa-clock"></i>', disabled:'<i class="fa-solid fa-wheelchair"></i>' };
    const statusColors = { available:'var(--color-emerald)', allotted:'var(--color-indigo)', reserved:'var(--color-yellow)', maintenance:'var(--color-rose)' };
    container.innerHTML = slots.map(s => {
        const sc = statusColors[s.status] || 'var(--text-muted)';
        const icon = typeIcons[s.type] || '<i class="fa-solid fa-car"></i>';
        return `<div class="parking-card ${s.status}" style="border-left:4px solid ${sc};">
            <div class="parking-icon">${icon}</div>
            <div class="parking-info">
                <div class="parking-slot">${escapeHtml(s.slot_number)}</div>
                <div class="parking-meta">
                    ${s.floor ? `<span>Floor ${escapeHtml(s.floor)}</span>` : ''}
                    <span class="pill" style="background:${sc}20; color:${sc}; font-size:0.6rem;">${s.status}</span>
                </div>
                ${s.allotted_to_flat ? `<div class="parking-allotted"><i class="fa-solid fa-user"></i> ${escapeHtml(s.allotted_to_flat)} ${s.vehicle_no ? '· ' + escapeHtml(s.vehicle_no) : ''}</div>` : ''}
            </div>
            ${canManage ? `<button class="btn btn-sm btn-slate" onclick="editParking('${s.id}')" style="align-self:center;"><i class="fa-solid fa-pen"></i></button>` : ''}
        </div>`;
    }).join('');
}

window.openCreateParkingModal = function(data = null) {
    const canManage = hasPermission('parking:assign') || hasPermission('parking:manage');
    if (!canManage) { showToast("Access Denied.", "error"); return; }
    document.getElementById('create-parking-title').textContent = data ? 'Edit Slot' : 'New Parking Slot';
    document.getElementById('edit-parking-id').value = data ? data.id : '';
    document.getElementById('parking-slot').value = data ? data.slot_number : '';
    document.getElementById('parking-floor').value = data ? data.floor : '';
    document.getElementById('parking-type').value = data ? data.type : 'car';
    document.getElementById('parking-status').value = data ? data.status : 'available';
    document.getElementById('parking-flat').value = data ? data.allotted_to_flat : '';
    document.getElementById('parking-vehicle').value = data ? data.vehicle_no : '';
    document.getElementById('parking-notes').value = data ? data.notes : '';
    openModal('createParkingModal');
};

window.saveParking = async function(e) {
    e.preventDefault();
    const canManage = hasPermission('parking:assign') || hasPermission('parking:manage');
    if (!canManage) { showToast("Access Denied.", "error"); return; }
    const id = document.getElementById('edit-parking-id').value;
    const data = {
        slot_number: document.getElementById('parking-slot').value.trim(),
        floor: document.getElementById('parking-floor').value.trim(),
        type: document.getElementById('parking-type').value,
        status: document.getElementById('parking-status').value,
        allotted_to_flat: document.getElementById('parking-flat').value.trim(),
        vehicle_no: document.getElementById('parking-vehicle').value.trim(),
        notes: document.getElementById('parking-notes').value.trim()
    };
    try {
        if (!sbClient) return;
        if (id) {
            const { error } = await sbClient.from('parking_slots').update(data).eq('id', id);
            if (error) throw error;
            showToast('Slot updated.', 'success');
        } else {
            const { error } = await sbClient.from('parking_slots').insert(data);
            if (error) throw error;
            showToast('Slot added!', 'success');
        }
        closeModal('createParkingModal');
        await loadParking();
    } catch (err) {
        showToast(err.message || 'Failed to save slot.', 'error');
    }
};

window.editParking = function(id) {
    const item = allParking.find(s => s.id === id);
    if (item) openCreateParkingModal(item);
};

