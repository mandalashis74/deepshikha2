// ============================================================
// Gate & Security Management Module
// Guard tablet view, resident approval, pre-auth passes,
// monthly staff check-in/out, overstay alerts
// ============================================================

let _gatePasses = [];
let _monthlyStaff = [];
let _serviceStaff = []; // parsed from owners.service_person JSON
let _owners = [];
let _pendingApprovals = [];
let _gateChannels = [];
let _gateView = 'guard';
let _ivrFallbackPending = null;
let _overstayCheckInterval = null;

// Guestimated max durations per purpose (minutes)
const _PURPOSE_DURATION = {
    'delivery': 15, 'food delivery': 15, 'amazon': 15, 'swiggy': 15, 'zomato': 15,
    'plumber': 120, 'electrician': 120, 'technician': 90, 'maid': 240, 'cook': 240,
    'guest': 180, 'other': 60
};

const _MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function _hasGate(perm) {
    if (currentUserRole === 'admin') return true;
    if (!window.currentRolePermissions) return false;
    return window.currentRolePermissions.includes(perm);
}

function _isGuard() {
    const role = currentUserRole || '';
    return role === 'admin' || role === 'security' || _hasGate('gate:guard');
}

function _flatNo() { return localStorage.getItem('currentFlatNo') || ''; }

function _userName() { return window.currentUserName || window.currentUserEmail || 'Unknown'; }

function _userId() { return window.currentUserId || null; }

function _formatDT(d) {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleString('en-IN', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

function _timeAgo(d) {
    if (!d) return '';
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff/60) + 'm ago';
    return Math.floor(diff/3600) + 'h ago';
}

function _durationStr(mins) {
    if (!mins) return '';
    if (mins < 60) return mins + ' min';
    return Math.floor(mins/60) + 'h ' + (mins%60) + 'm';
}

function _getPurposeDuration(purpose) {
    const p = (purpose || '').toLowerCase().trim();
    for (const [k, v] of Object.entries(_PURPOSE_DURATION)) {
        if (p.includes(k)) return v;
    }
    return 20;
}

function _qrCodeFor(pass) {
    // Simple hash-based code for scanning
    return pass.qr_token || (pass.id ? pass.id.substring(0, 8) : '');
}

// ============================================================
// ENTRY POINT
// ============================================================
window.openGateModal = async function() {
    if (!_hasGate('gate:view') && !_isGuard()) {
        showToast('Access Denied', 'error');
        return;
    }
    closeModal('visitorsModal');
    const modal = document.getElementById('gateModal');
    if (!modal) return;
    modal.style.display = 'block';
    await _loadData();
    // Populate staff flat datalist
    const datalist = document.getElementById('gs-flat-list');
    if (datalist && _owners.length > 0) {
        datalist.innerHTML = _owners.map(o => '<option value="' + escapeHtml(o.flat_no) + '">').join('');
    }
    _subscribeRealtime();
    _render();
};

// ============================================================
// DATA LOADING
// ============================================================
async function _loadData() {
    const flatNo = _flatNo();
    _pendingApprovals = [];
    // Fetch pending approvals for this flat (immediate_inward)
    if (flatNo) {
        try {
            const { data } = await sbClient.from('visitor_passes')
                .select('*')
                .eq('flat_no', flatNo)
                .eq('status', 'pending')
                .eq('pass_type', 'immediate_inward')
                .order('created_at', { ascending: false })
                .limit(10);
            if (data) _pendingApprovals = data;
        } catch {}
    }
    // Fetch all recent gate passes
    try {
        let q = sbClient.from('visitor_passes').select('*').order('created_at', { ascending: false }).limit(50);
        if (!_isGuard() && flatNo) q = q.eq('flat_no', flatNo);
        const { data } = await q;
        if (data) _gatePasses = data;
    } catch { _gatePasses = []; }
    // Fetch monthly staff
    try {
        let q = sbClient.from('monthly_staff').select('*').eq('is_active', true).order('name');
        if (!_isGuard() && flatNo) q = q.eq('flat_no', flatNo);
        const { data } = await q;
        if (data) _monthlyStaff = data;
    } catch { _monthlyStaff = []; }
    // Fetch owners with service_person data
    try {
        const { data } = await sbClient.from('owners').select('flat_no, owner_name, service_person').order('flat_no');
        if (data) {
            _owners = data;
            // Parse service_person JSON into a flat list
            _serviceStaff = [];
            for (const o of data) {
                if (!o.service_person) continue;
                let arr;
                try { arr = typeof o.service_person === 'string' ? JSON.parse(o.service_person) : o.service_person; } catch { arr = []; }
                if (!Array.isArray(arr)) continue;
                for (const sp of arr) {
                    if (!sp || !sp.name) continue;
                    // Check if this person already has a monthly_staff record
                    const existing = _monthlyStaff.find(m => m.flat_no === o.flat_no && m.name === sp.name && m.purpose === (sp.role || ''));
                    _serviceStaff.push({
                        flat_no: o.flat_no,
                        name: sp.name,
                        purpose: sp.role || '',
                        age: sp.age || '',
                        gender: sp.gender || '',
                        monthly_staff_id: existing ? existing.id : null,
                        phone: existing ? existing.phone : '',
                        photo_url: existing ? existing.photo_url : '',
                        id_card_no: existing ? existing.id_card_no : '',
                        _fromService: true,
                        _staffRecord: existing || null
                    });
                }
            }
        }
    } catch { _owners = []; _serviceStaff = []; }
}

// Lightweight refresh of owners/service-person data only
async function _loadOwners() {
    try {
        const { data } = await sbClient.from('owners').select('flat_no, owner_name, service_person').order('flat_no');
        if (data) {
            _owners = data;
            _serviceStaff = [];
            for (const o of data) {
                if (!o.service_person) continue;
                let arr;
                try { arr = typeof o.service_person === 'string' ? JSON.parse(o.service_person) : o.service_person; } catch { arr = []; }
                if (!Array.isArray(arr)) continue;
                for (const sp of arr) {
                    if (!sp || !sp.name) continue;
                    const existing = _monthlyStaff.find(m => m.flat_no === o.flat_no && m.name === sp.name && m.purpose === (sp.role || ''));
                    _serviceStaff.push({
                        flat_no: o.flat_no, name: sp.name, purpose: sp.role || '',
                        age: sp.age || '', gender: sp.gender || '',
                        monthly_staff_id: existing ? existing.id : null,
                        phone: existing ? existing.phone : '',
                        photo_url: existing ? existing.photo_url : '',
                        id_card_no: existing ? existing.id_card_no : '',
                        _fromService: true, _staffRecord: existing || null
                    });
                }
            }
        }
    } catch { /* ignore */ }
}

// ============================================================
// REALTIME SUBSCRIPTIONS
// ============================================================
function _subscribeRealtime() {
    _unsubscribeGate();
    const flatNo = _flatNo();
    // Guard: listen for status changes on all passes
    if (_isGuard()) {
        const ch = sbClient.channel('gate-guard-all')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'visitor_passes' },
                (payload) => {
                    _handlePassChange(payload);
                })
            .subscribe();
        _gateChannels.push(ch);
    }
    // Resident: listen for new pending passes for their flat
    if (flatNo) {
        const ch = sbClient.channel('gate-resident-' + flatNo)
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'visitor_passes',
                  filter: 'flat_no=eq.' + flatNo + '&status=eq.pending&pass_type=eq.immediate_inward' },
                (payload) => {
                    _showApprovalPopup(payload.new);
                })
            .subscribe();
        _gateChannels.push(ch);
    }
    // Overstay monitor (guard only)
    if (_isGuard()) {
        if (_overstayCheckInterval) clearInterval(_overstayCheckInterval);
        _overstayCheckInterval = setInterval(_checkOverstays, 30000);
    }
}

function _unsubscribeGate() {
    _gateChannels.forEach(ch => { try { sbClient.removeChannel(ch); } catch {} });
    _gateChannels = [];
    if (_overstayCheckInterval) { clearInterval(_overstayCheckInterval); _overstayCheckInterval = null; }
}

function _handlePassChange(payload) {
    const ev = payload.eventType;
    const row = payload.new || payload.old;
    if (ev === 'INSERT') {
        _gatePasses.unshift(row);
        if (_gatePasses.length > 100) _gatePasses.pop();
    } else if (ev === 'UPDATE') {
        const idx = _gatePasses.findIndex(p => p.id === row.id);
        if (idx >= 0) _gatePasses[idx] = payload.new;
        // If this was a pending approval for current viewer, remove from pending list
        if (row.status !== 'pending') {
            const pi = _pendingApprovals.findIndex(p => p.id === row.id);
            if (pi >= 0) _pendingApprovals.splice(pi, 1);
        }
    } else if (ev === 'DELETE') {
        _gatePasses = _gatePasses.filter(p => p.id !== row.id);
    }
    // Re-render if modal is open
    const modal = document.getElementById('gateModal');
    if (modal && modal.style.display === 'block') _render();
}

// ============================================================
// OVERSTAY DETECTION
// ============================================================
async function _checkOverstays() {
    const modal = document.getElementById('gateModal');
    if (!modal || modal.style.display !== 'block') return;
    const now = new Date();
    const overstays = _gatePasses.filter(p => {
        if (p.status !== 'checked_in' || !p.checked_in_at) return false;
        const dur = p.expected_duration_min || _getPurposeDuration(p.purpose);
        const checkIn = new Date(p.checked_in_at);
        const elapsed = (now - checkIn) / 60000;
        return elapsed > dur;
    });
    const container = document.getElementById('gate-overstay-badge');
    if (container) {
        container.textContent = overstays.length || '';
        container.style.display = overstays.length ? 'inline' : 'none';
    }
}

// ============================================================
// RENDER
// ============================================================
async function _render() {
    const container = document.getElementById('gate-container');
    const toolbar = document.getElementById('gate-toolbar');
    if (!container) return;
    _renderToolbar(toolbar);
    if (_gateView === 'guard') {
        if (_isGuard()) await _renderGuardDashboard(container);
        else { _gateView = 'resident'; await _renderResidentPanel(container); }
    } else if (_gateView === 'resident') {
        await _renderResidentPanel(container);
    } else if (_gateView === 'staff') {
        await _loadOwners();
        await _renderMonthlyStaff(container);
    } else if (_gateView === 'log') {
        await _renderGateLog(container);
    } else if (_gateView === 'overstays') {
        await _renderOverstays(container);
    }
}

function _renderToolbar(toolbar) {
    if (!toolbar) return;
    toolbar.innerHTML = '';
    const tabs = document.createElement('div');
    tabs.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;';
    const views = [];
    if (_isGuard()) views.push({key:'guard', label:'<i class="fa-solid fa-shield"></i> Gate', cls:'btn-indigo'});
    if (_flatNo()) views.push({key:'resident', label:'<i class="fa-solid fa-bell"></i> Approvals <span id="gate-approval-count" style="background:var(--color-rose);color:#fff;border-radius:10px;padding:0 6px;font-size:0.65rem;">' + _pendingApprovals.length + '</span>', cls:'btn-rose'});
    views.push({key:'staff', label:'<i class="fa-solid fa-users"></i> Staff', cls:'btn-teal'});
    views.push({key:'log', label:'<i class="fa-solid fa-clock-rotate-left"></i> Log', cls:'btn-slate'});
    if (_isGuard()) views.push({key:'overstays', label:'<i class="fa-solid fa-triangle-exclamation"></i> Overstays <span id="gate-overstay-badge" style="display:none;background:var(--color-rose);color:#fff;border-radius:10px;padding:0 6px;font-size:0.65rem;"></span>', cls:'btn-rose'});
    for (const v of views) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm ' + v.cls;
        btn.style.cssText = 'border-radius:6px;font-size:0.75rem;padding:4px 10px;'
            + (_gateView === v.key ? 'opacity:1;' : 'opacity:0.7;');
        btn.innerHTML = v.label;
        btn.onclick = () => { _gateView = v.key; _render(); };
        tabs.appendChild(btn);
    }
    toolbar.appendChild(tabs);
}

// ============================================================
// GUARD DASHBOARD
// ============================================================
async function _renderGuardDashboard(container) {
    container.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fa-solid fa-spinner fa-spin"></i></div>';
    let html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">';

    // LEFT: Quick Entry Form
    html += '<div style="background:var(--bg-card);border-radius:12px;padding:16px;border:1px solid var(--border-color);">';
    html += '<h3 style="margin:0 0 12px;font-size:0.95rem;"><i class="fa-solid fa-right-to-bracket"></i> Immediate Entry</h3>';
    html += '<form id="gate-quick-form" onsubmit="event.preventDefault();gateQuickEntry()">';
    html += '<div class="input-field"><label>Visitor Name</label><input type="text" id="gq-name" required placeholder="e.g. Amazon delivery"></div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
    html += '<div class="input-field"><label>Company</label><input type="text" id="gq-company" placeholder="Amazon / Swiggy"></div>';
    html += '<div class="input-field"><label>Vehicle No.</label><input type="text" id="gq-vehicle" placeholder="MH-01-AB-1234"></div>';
    html += '</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
    html += '<div class="input-field"><label>Flat No.</label><input type="text" id="gq-flat" required placeholder="A-101" list="gq-flat-list"></div>';
    html += '<div class="input-field"><label>Purpose</label><select id="gq-purpose"><option value="Delivery">Delivery</option><option value="Food Delivery">Food Delivery</option><option value="Guest">Guest</option><option value="Technician">Technician</option><option value="Plumber">Plumber</option><option value="Electrician">Electrician</option><option value="Other">Other</option></select></div>';
    html += '</div>';
    html += '<button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px;"><i class="fa-solid fa-paper-plane"></i> Request Entry</button>';
    html += '</form>';
    html += '<datalist id="gq-flat-list">';
    if (window._flatsForDatalist) {
        window._flatsForDatalist.forEach(f => { html += '<option value="' + f + '">'; });
    }
    html += '</datalist>';
    html += '</div>';

    // RIGHT: Pending / Active entries
    html += '<div style="background:var(--bg-card);border-radius:12px;padding:16px;border:1px solid var(--border-color);max-height:400px;overflow-y:auto;">';
    html += '<h3 style="margin:0 0 12px;font-size:0.95rem;"><i class="fa-solid fa-list"></i> Active Entries</h3>';
    const active = _gatePasses.filter(p => p.status === 'pending' || p.status === 'approved' || p.status === 'checked_in');
    if (active.length === 0) {
        html += '<div style="text-align:center;padding:20px;color:var(--text-muted);"><i class="fa-solid fa-circle-check" style="font-size:1.5rem;color:var(--color-emerald);"></i><br>No active entries</div>';
    } else {
        for (const p of active) {
            const dur = p.expected_duration_min || _getPurposeDuration(p.purpose);
            const isOverstay = p.status === 'checked_in' && p.checked_in_at && ((Date.now() - new Date(p.checked_in_at).getTime()) / 60000) > dur;
            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-color);font-size:0.8rem;">';
            html += '<div><strong>' + escapeHtml(p.visitor_name) + '</strong><br><span style="font-size:0.7rem;color:var(--text-muted);">' + escapeHtml(p.flat_no) + ' · ' + (p.company_name || p.purpose || '') + '</span></div>';
            html += '<div style="text-align:right;">';
            if (p.status === 'pending') html += '<span style="color:var(--color-orange);font-weight:700;"><i class="fa-solid fa-clock"></i> Pending</span>';
            else if (p.status === 'approved') html += '<span style="color:var(--color-emerald);"><i class="fa-solid fa-check"></i> Approved</span>';
            else if (p.status === 'checked_in') {
                const minsAgo = Math.floor((Date.now() - new Date(p.checked_in_at).getTime()) / 60000);
                html += '<span style="color:' + (isOverstay ? 'var(--color-rose)' : 'var(--color-emerald)') + ';"><i class="fa-solid fa-person-walking"></i> In (' + minsAgo + 'min)</span>';
                if (isOverstay) html += '<br><span style="color:var(--color-rose);font-size:0.7rem;"><i class="fa-solid fa-triangle-exclamation"></i> Overstay</span>';
            }
            html += '</div></div>';
        }
    }
    html += '</div>';

    // Bottom: Monthly Staff Quick Check-in
    html += '</div><div style="margin-top:16px;background:var(--bg-card);border-radius:12px;padding:16px;border:1px solid var(--border-color);">';
    html += '<h3 style="margin:0 0 12px;font-size:0.95rem;"><i class="fa-solid fa-user-clock"></i> Staff Check-in / Check-out</h3>';
    // Build unified staff list (service persons + monthly_staff)
    let allStaff = [];
    const seen = new Set();
    // Service persons from owners directory
    for (const sp of _serviceStaff) {
        const key = sp.flat_no + '|' + sp.name + '|' + sp.purpose;
        if (!seen.has(key)) { seen.add(key); allStaff.push(sp); }
    }
    // Monthly staff not already covered
    for (const ms of _monthlyStaff) {
        const key = ms.flat_no + '|' + ms.name + '|' + (ms.purpose || '');
        if (!seen.has(key)) {
            seen.add(key);
            allStaff.push({
                flat_no: ms.flat_no, name: ms.name, purpose: ms.purpose || '',
                monthly_staff_id: ms.id, phone: ms.phone || '', photo_url: ms.photo_url || '',
                _fromService: false, _staffRecord: ms
            });
        }
    }
    if (allStaff.length === 0) {
        html += '<div style="text-align:center;padding:16px;color:var(--text-muted);">No staff found. Add service persons in <a href="#" onclick="closeModal(\'gateModal\');openOwnersDirectoryModal();return false;" style="color:var(--color-indigo);">Owners Directory</a>.</div>';
    } else {
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;">';
        for (const s of allStaff) {
            const sid = s.monthly_staff_id;
            const checkedIn = sid ? _gatePasses.filter(p => p.monthly_staff_id === sid && p.status === 'checked_in').length > 0 : false;
            html += '<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg-body);border-radius:8px;border:1px solid var(--border-color);">';
            if (s.photo_url) html += '<img src="' + escapeHtml(s.photo_url) + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">';
            else html += '<div style="width:36px;height:36px;border-radius:50%;background:var(--color-indigo);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.9rem;font-weight:700;">' + (s.name.charAt(0).toUpperCase()) + '</div>';
            html += '<div style="flex:1;min-width:0;"><strong style="font-size:0.8rem;">' + escapeHtml(s.name) + '</strong><br><span style="font-size:0.65rem;color:var(--text-muted);">' + escapeHtml(s.flat_no) + ' · ' + escapeHtml(s.purpose || '') + '</span></div>';
            if (checkedIn) {
                html += '<button class="btn btn-sm" style="background:var(--color-rose);color:#fff;font-size:0.65rem;padding:2px 8px;" onclick="gateStaffCheckOut(\'' + escapeHtml(s.flat_no) + '\',\'' + escapeHtml(s.name) + '\',\'' + escapeHtml(s.purpose || '') + '\')"><i class="fa-solid fa-right-from-bracket"></i> Out</button>';
            } else {
                html += '<button class="btn btn-sm" style="background:var(--color-emerald);color:#fff;font-size:0.65rem;padding:2px 8px;" onclick="gateStaffCheckIn(\'' + escapeHtml(s.flat_no) + '\',\'' + escapeHtml(s.name) + '\',\'' + escapeHtml(s.purpose || '') + '\')"><i class="fa-solid fa-right-to-bracket"></i> In</button>';
            }
            html += '</div>';
        }
        html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
}

// ============================================================
// RESIDENT PANEL (Approvals + Pre-Auth Passes)
// ============================================================
async function _renderResidentPanel(container) {
    const flatNo = _flatNo();
    container.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fa-solid fa-spinner fa-spin"></i></div>';
    let html = '';

    // Pending Approvals section
    html += '<div style="background:var(--bg-card);border-radius:12px;padding:16px;border:1px solid var(--border-color);margin-bottom:16px;">';
    html += '<h3 style="margin:0 0 12px;font-size:0.95rem;"><i class="fa-solid fa-bell"></i> Pending Approvals</h3>';
    if (_pendingApprovals.length === 0) {
        html += '<div style="text-align:center;padding:20px;color:var(--text-muted);"><i class="fa-solid fa-circle-check" style="font-size:1.5rem;color:var(--color-emerald);"></i><br>No pending requests</div>';
    } else {
        for (const p of _pendingApprovals) {
            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--bg-body);border-radius:8px;margin-bottom:8px;border:1px solid var(--border-color);">';
            html += '<div><strong>' + escapeHtml(p.visitor_name) + '</strong><br><span style="font-size:0.75rem;color:var(--text-muted);">' + (p.company_name || p.purpose || '') + (p.vehicle_no ? ' · ' + escapeHtml(p.vehicle_no) : '') + '</span></div>';
            html += '<div style="display:flex;gap:6px;">';
            html += '<button class="btn btn-sm" style="background:var(--color-emerald);color:#fff;" onclick="gateApproveEntry(\'' + p.id + '\')"><i class="fa-solid fa-check"></i> Approve</button>';
            html += '<button class="btn btn-sm" style="background:var(--color-rose);color:#fff;" onclick="gateDenyEntry(\'' + p.id + '\')"><i class="fa-solid fa-xmark"></i> Deny</button>';
            html += '</div></div>';
        }
    }
    html += '</div>';

    // Pre-Auth Guest Pass section
    html += '<div style="background:var(--bg-card);border-radius:12px;padding:16px;border:1px solid var(--border-color);margin-bottom:16px;">';
    html += '<h3 style="margin:0 0 12px;font-size:0.95rem;"><i class="fa-solid fa-qrcode"></i> Pre-Authenticated Guest Pass</h3>';
    html += '<form id="gate-pre-auth-form" onsubmit="event.preventDefault();gateCreatePreAuth()">';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
    html += '<div class="input-field"><label>Guest Name</label><input type="text" id="gp-name" required placeholder="Full name"></div>';
    html += '<div class="input-field"><label>Phone</label><input type="text" id="gp-phone" placeholder="+91-9999999999"></div>';
    html += '</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
    html += '<div class="input-field"><label>Vehicle No.</label><input type="text" id="gp-vehicle" placeholder="MH-01-AB-1234"></div>';
    html += '<div class="input-field"><label>Purpose</label><input type="text" id="gp-purpose" placeholder="Family visit / Friend" value="Guest"></div>';
    html += '</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
    html += '<div class="input-field"><label>Valid Until</label><input type="datetime-local" id="gp-valid-until" value="' + new Date(Date.now() + 86400000).toISOString().slice(0,16) + '"></div>';
    html += '</div>';
    html += '<button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px;"><i class="fa-solid fa-qrcode"></i> Generate QR Pass</button>';
    html += '</form></div>';

    // Recent / Active passes for this flat
    html += '<div style="background:var(--bg-card);border-radius:12px;padding:16px;border:1px solid var(--border-color);">';
    html += '<h3 style="margin:0 0 12px;font-size:0.95rem;"><i class="fa-solid fa-clock-rotate-left"></i> Recent Passes</h3>';
    const myPasses = _gatePasses.filter(p => p.flat_no === flatNo).slice(0, 20);
    if (myPasses.length === 0) {
        html += '<div style="text-align:center;padding:16px;color:var(--text-muted);">No gate passes yet</div>';
    } else {
        html += '<table class="data-table"><thead><tr><th>Visitor</th><th>Type</th><th>Status</th><th>Time</th></tr></thead><tbody>';
        for (const p of myPasses) {
            const typeLabel = p.pass_type === 'immediate_inward' ? 'Ad-hoc' : p.pass_type === 'pre_auth_guest' ? 'Pre-Auth' : p.pass_type === 'monthly_pass' ? 'Staff' : 'Visitor';
            const statusLabel = p.status === 'pending' ? 'Pending' : p.status === 'approved' ? 'Approved' : p.status === 'checked_in' ? 'Checked In' : p.status === 'checked_out' ? 'Done' : p.status === 'rejected' ? 'Rejected' : p.status;
            const statusColor = p.status === 'pending' ? 'var(--color-orange)' : p.status === 'approved' || p.status === 'checked_in' ? 'var(--color-emerald)' : p.status === 'rejected' ? 'var(--color-rose)' : 'var(--text-muted)';
            html += '<tr><td><strong>' + escapeHtml(p.visitor_name) + '</strong>' + (p.company_name ? '<br><span style="font-size:0.7rem;">' + escapeHtml(p.company_name) + '</span>' : '') + '</td>';
            html += '<td style="font-size:0.75rem;">' + typeLabel + '</td>';
            html += '<td style="color:' + statusColor + ';font-weight:600;">' + statusLabel + '</td>';
            html += '<td style="font-size:0.75rem;">' + _timeAgo(p.created_at) + '</td></tr>';
        }
        html += '</tbody></table>';
    }
    html += '</div>';

    container.innerHTML = html;
}

// ============================================================
// MONTHLY STAFF MANAGEMENT
// ============================================================
async function _renderMonthlyStaff(container) {
    container.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fa-solid fa-spinner fa-spin"></i></div>';
    // Build unified staff list: service persons + standalone monthly_staff records
    const usedFlats = new Set();
    const flatStaffMap = {};
    // Service persons from owners directory
    for (const sp of _serviceStaff) {
        if (!flatStaffMap[sp.flat_no]) flatStaffMap[sp.flat_no] = [];
        flatStaffMap[sp.flat_no].push(sp);
        usedFlats.add(sp.flat_no);
    }
    // Any monthly_staff records not matched to a service person
    for (const ms of _monthlyStaff) {
        if (!flatStaffMap[ms.flat_no]) flatStaffMap[ms.flat_no] = [];
        const already = flatStaffMap[ms.flat_no].some(s => s.monthly_staff_id === ms.id || (s.name === ms.name && s.purpose === (ms.purpose || '')));
        if (!already) {
            flatStaffMap[ms.flat_no].push({
                flat_no: ms.flat_no,
                name: ms.name,
                purpose: ms.purpose || '',
                age: '', gender: '',
                monthly_staff_id: ms.id,
                phone: ms.phone || '',
                photo_url: ms.photo_url || '',
                id_card_no: ms.id_card_no || '',
                _fromService: false,
                _staffRecord: ms
            });
            usedFlats.add(ms.flat_no);
        }
    }
    // All flats from owners directory (including those with no staff)
    const flatList = _owners.length > 0 ? _owners : [];
    const staffCount = Object.values(flatStaffMap).reduce((s, arr) => s + arr.length, 0);

    let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
    html += '<h3 style="margin:0;font-size:0.95rem;"><i class="fa-solid fa-users"></i> Staff Directory by Flat</h3>';
    html += '<span style="font-size:0.8rem;color:var(--text-muted);">' + flatList.length + ' flats · ' + staffCount + ' staff</span>';
    html += '</div>';
    if (flatList.length === 0) {
        html += '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fa-solid fa-user-plus" style="font-size:2rem;"></i><br><br>No flats found. Import owners first in Administration.</div>';
        container.innerHTML = html;
        return;
    }
    // Staff are managed in Owners Directory - link to it
    html += '<div style="background:var(--bg-body);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:0.8rem;color:var(--text-muted);display:flex;align-items:center;gap:8px;border:1px solid var(--border-color);">';
    html += '<i class="fa-solid fa-circle-info" style="color:var(--color-indigo);"></i>';
    html += '<span>Staff profiles are managed in <a href="#" onclick="closeModal(\'gateModal\');openOwnersDirectoryModal();return false;" style="color:var(--color-indigo);text-decoration:underline;">Owners & Residents Directory</a>. Add or edit service persons there.</span>';
    html += '</div>';

    for (const flat of flatList) {
        const staffArr = flatStaffMap[flat.flat_no] || [];
        const ownerName = flat.owner_name ? (window.displayStructured ? window.displayStructured(flat.owner_name, 'name') : flat.owner_name) : '';
        html += '<div style="background:var(--bg-card);border-radius:10px;border:1px solid var(--border-color);margin-bottom:10px;overflow:hidden;">';
        // Flat header - collapsible
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg-body);border-bottom:1px solid var(--border-color);cursor:pointer;" onclick="const b=this.nextElementSibling;b.style.display=b.style.display===\'none\'?\'block\':\'none\'">';
        html += '<div><strong style="font-size:0.9rem;">' + escapeHtml(flat.flat_no) + '</strong>';
        if (ownerName) html += ' <span style="font-size:0.75rem;color:var(--text-muted);">(' + escapeHtml(ownerName) + ')</span>';
        html += ' <span style="font-size:0.7rem;color:var(--text-muted);">· ' + staffArr.length + ' staff</span>';
        html += '</div>';
        html += '<div><i class="fa-solid fa-chevron-down" style="color:var(--text-muted);font-size:0.75rem;"></i></div></div>';
        // Staff body
        html += '<div style="display:' + (staffArr.length > 0 ? 'block' : 'block') + ';">';
        if (staffArr.length === 0) {
            html += '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:0.8rem;">No staff registered. <a href="#" onclick="closeModal(\'gateModal\');openOwnersDirectoryModal();return false;" style="color:var(--color-indigo);">Add in Owners Directory &rarr;</a></div>';
        } else {
            for (const s of staffArr) {
                // Check gate activity
                const sid = s.monthly_staff_id;
                const todayPass = sid ? _gatePasses.filter(p => p.monthly_staff_id === sid && p.status === 'checked_in') : [];
                const isCheckedIn = todayPass.length > 0;
                const allPasses = sid ? _gatePasses.filter(p => p.monthly_staff_id === sid) : [];
                allPasses.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
                const lastPass = allPasses[0];
                html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border-color);">';
                if (s.photo_url) html += '<img src="' + escapeHtml(s.photo_url) + '" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">';
                else html += '<div style="width:40px;height:40px;border-radius:50%;background:var(--color-indigo);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.9rem;flex-shrink:0;font-weight:700;">' + (s.name.charAt(0).toUpperCase()) + '</div>';
                html += '<div style="flex:1;min-width:0;">';
                html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">';
                html += '<strong style="font-size:0.85rem;">' + escapeHtml(s.name) + '</strong>';
                html += '<span style="font-size:0.7rem;color:var(--text-muted);background:var(--bg-body);padding:1px 8px;border-radius:10px;">' + escapeHtml(s.purpose || 'Staff') + '</span>';
                if (s.gender) html += '<span style="font-size:0.65rem;color:var(--text-muted);">' + escapeHtml(s.gender) + (s.age ? ', ' + escapeHtml(s.age) : '') + '</span>';
                if (s.phone) html += '<span style="font-size:0.65rem;color:var(--text-muted);"><i class="fa-solid fa-phone"></i> ' + escapeHtml(s.phone) + '</span>';
                html += '</div>';
                if (isCheckedIn) html += '<span style="font-size:0.7rem;color:var(--color-emerald);"><i class="fa-solid fa-circle"></i> On premises</span>';
                else if (lastPass) html += '<span style="font-size:0.7rem;color:var(--text-muted);">Last: ' + _timeAgo(lastPass.created_at) + '</span>';
                else html += '<span style="font-size:0.7rem;color:var(--text-muted);">Not yet checked in</span>';
                html += '</div>';
                html += '<div style="display:flex;gap:4px;flex-shrink:0;">';
                if (_isGuard()) {
                    if (isCheckedIn) {
                        html += '<button class="btn btn-sm" style="background:var(--color-rose);color:#fff;font-size:0.6rem;padding:2px 6px;" onclick="gateStaffCheckOut(\'' + escapeHtml(s.flat_no) + '\',\'' + escapeHtml(s.name) + '\',\'' + escapeHtml(s.purpose || '') + '\')"><i class="fa-solid fa-right-from-bracket"></i></button>';
                    } else {
                        html += '<button class="btn btn-sm" style="background:var(--color-emerald);color:#fff;font-size:0.6rem;padding:2px 6px;" onclick="gateStaffCheckIn(\'' + escapeHtml(s.flat_no) + '\',\'' + escapeHtml(s.name) + '\',\'' + escapeHtml(s.purpose || '') + '\')"><i class="fa-solid fa-right-to-bracket"></i></button>';
                    }
                }
                html += '</div></div>';
            }
        }
        // Link to add more staff via Owners Directory
        html += '<div style="padding:8px 14px;text-align:center;border-top:1px dashed var(--border-color);">';
        html += '<a href="#" onclick="closeModal(\'gateModal\');openOwnersDirectoryModal();return false;" style="font-size:0.75rem;color:var(--color-indigo);"><i class="fa-solid fa-plus"></i> Manage staff for ' + escapeHtml(flat.flat_no) + ' in Owners Directory</a>';
        html += '</div>';
        html += '</div></div>';
    }
    container.innerHTML = html;
}

// ============================================================
// GATE LOG
// ============================================================
async function _renderGateLog(container) {
    container.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fa-solid fa-spinner fa-spin"></i></div>';
    // Build log from recent passes
    const entries = _gatePasses.slice(0, 100);
    if (entries.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fa-solid fa-clock-rotate-left" style="font-size:2rem;"></i><br><br>No gate activity yet</div>';
        return;
    }
    let html = '<table class="data-table"><thead><tr><th>Visitor</th><th>Flat</th><th>Type</th><th>Status</th><th>In</th><th>Out</th><th>Duration</th></tr></thead><tbody>';
    for (const p of entries) {
        const typeLabel = p.pass_type === 'immediate_inward' ? 'Ad-hoc' : p.pass_type === 'pre_auth_guest' ? 'Pre-Auth' : 'Staff';
        const inTime = p.checked_in_at ? _formatDT(p.checked_in_at) : '—';
        const outTime = p.checked_out_at ? _formatDT(p.checked_out_at) : (p.status === 'checked_in' ? '<span style="color:var(--color-emerald);">Active</span>' : '—');
        let duration = '—';
        if (p.checked_in_at && p.checked_out_at) {
            duration = _durationStr(Math.round((new Date(p.checked_out_at) - new Date(p.checked_in_at)) / 60000));
        } else if (p.checked_in_at) {
            duration = _durationStr(Math.round((Date.now() - new Date(p.checked_in_at)) / 60000)) + ' (ongoing)';
        }
        const statusColor = p.status === 'pending' ? 'var(--color-orange)' : p.status === 'approved' || p.status === 'checked_in' ? 'var(--color-emerald)' : p.status === 'rejected' ? 'var(--color-rose)' : 'var(--text-muted)';
        html += '<tr><td><strong>' + escapeHtml(p.visitor_name) + '</strong></td>';
        html += '<td>' + escapeHtml(p.flat_no) + '</td>';
        html += '<td style="font-size:0.75rem;">' + typeLabel + '</td>';
        html += '<td style="color:' + statusColor + ';font-weight:600;font-size:0.75rem;">' + p.status + '</td>';
        html += '<td style="font-size:0.75rem;">' + inTime + '</td>';
        html += '<td style="font-size:0.75rem;">' + outTime + '</td>';
        html += '<td style="font-size:0.75rem;">' + duration + '</td></tr>';
    }
    html += '</tbody></table>';
    container.innerHTML = html;
}

// ============================================================
// OVERSTAYS VIEW
// ============================================================
async function _renderOverstays(container) {
    const overstays = _gatePasses.filter(p => {
        if (p.status !== 'checked_in' || !p.checked_in_at) return false;
        const dur = p.expected_duration_min || _getPurposeDuration(p.purpose);
        const elapsed = (Date.now() - new Date(p.checked_in_at).getTime()) / 60000;
        return elapsed > dur;
    });
    if (overstays.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fa-solid fa-circle-check" style="font-size:2rem;color:var(--color-emerald);"></i><br><br>No overstay alerts</div>';
        return;
    }
    let html = '<div style="margin-bottom:12px;font-size:0.85rem;color:var(--color-rose);"><i class="fa-solid fa-triangle-exclamation"></i> ' + overstays.length + ' visitor(s) overstayed</div>';
    html += '<div style="display:grid;gap:8px;">';
    for (const p of overstays) {
        const dur = p.expected_duration_min || _getPurposeDuration(p.purpose);
        const elapsed = Math.round((Date.now() - new Date(p.checked_in_at).getTime()) / 60000);
        html += '<div style="background:var(--bg-card);border-radius:8px;padding:12px;border:1px solid var(--color-rose);display:flex;justify-content:space-between;align-items:center;">';
        html += '<div><strong>' + escapeHtml(p.visitor_name) + '</strong><br><span style="font-size:0.75rem;color:var(--text-muted);">' + escapeHtml(p.flat_no) + ' · ' + (p.company_name || p.purpose || '') + '</span></div>';
        html += '<div style="text-align:right;font-size:0.75rem;"><span style="color:var(--color-rose);font-weight:700;">' + _durationStr(elapsed) + '</span> (expected ' + _durationStr(dur) + ')<br>';
        html += '<button class="btn btn-sm" style="background:var(--color-indigo);color:#fff;font-size:0.65rem;padding:2px 8px;margin-top:4px;" onclick="gateCheckOut(\'' + p.id + '\')"><i class="fa-solid fa-right-from-bracket"></i> Force Check-out</button>';
        html += '</div></div>';
    }
    html += '</div>';
    container.innerHTML = html;
}

// ============================================================
// APPROVAL POPUP (Floating overlay for resident)
// ============================================================
function _showApprovalPopup(pass) {
    // Don't show if modal is open (already visible in approvals list)
    const modal = document.getElementById('gateModal');
    if (modal && modal.style.display === 'block') return;
    // Show a floating toast
    const existing = document.getElementById('gate-approval-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'gate-approval-toast';
    toast.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99999;background:var(--bg-card);border:2px solid var(--color-indigo);border-radius:16px;padding:20px;max-width:360px;box-shadow:0 8px 32px rgba(0,0,0,0.3);animation:slideUp 0.3s ease;';
    toast.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">'
        + '<h4 style="margin:0;font-size:0.95rem;"><i class="fa-solid fa-shield-halved" style="color:var(--color-indigo);"></i> Gate Entry Request</h4>'
        + '<button onclick="this.parentElement.parentElement.remove()" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--text-muted);">&times;</button>'
        + '</div>'
        + '<div style="margin-bottom:12px;"><strong style="font-size:1.1rem;">' + escapeHtml(pass.visitor_name) + '</strong>'
        + (pass.company_name ? '<br><span style="font-size:0.8rem;color:var(--text-muted);">' + escapeHtml(pass.company_name) + '</span>' : '')
        + (pass.vehicle_no ? '<br><span style="font-size:0.8rem;color:var(--text-muted);">' + escapeHtml(pass.vehicle_no) + '</span>' : '')
        + '<br><span style="font-size:0.8rem;color:var(--text-muted);">' + (pass.purpose || '') + '</span>'
        + '</div>'
        + '<div style="display:flex;gap:8px;">'
        + '<button class="btn btn-sm" style="background:var(--color-emerald);color:#fff;flex:1;padding:10px;font-size:0.9rem;" onclick="gateApproveEntry(\'' + pass.id + '\');this.closest(\'#gate-approval-toast\').remove()"><i class="fa-solid fa-check"></i> Approve</button>'
        + '<button class="btn btn-sm" style="background:var(--color-rose);color:#fff;flex:1;padding:10px;font-size:0.9rem;" onclick="gateDenyEntry(\'' + pass.id + '\');this.closest(\'#gate-approval-toast\').remove()"><i class="fa-solid fa-xmark"></i> Deny</button>'
        + '</div>'
        + '<div id="gate-ivr-timer" style="margin-top:8px;font-size:0.75rem;color:var(--text-muted);text-align:center;"></div>';
    document.body.appendChild(toast);
    // IVR fallback timer
    _ivrFallbackPending = pass.id;
    let secs = 45;
    const timerEl = toast.querySelector('#gate-ivr-timer');
    const ivrInt = setInterval(() => {
        secs--;
        if (timerEl) timerEl.textContent = secs > 0 ? 'Auto-calling in ' + secs + 's...' : '🔔 Initiating IVR call...';
        if (secs <= 0 || !document.getElementById('gate-approval-toast')) {
            clearInterval(ivrInt);
            if (secs <= 0 && _ivrFallbackPending === pass.id) {
                // Simulated IVR - in production would call Twilio API
                showToast('⚠️ IVR call initiated to resident (simulated)', 'warning');
                _ivrFallbackPending = null;
            }
        }
    }, 1000);
}

// ============================================================
// ACTIONS
// ============================================================

// --- Guard: Quick Entry ---
window.gateQuickEntry = async function() {
    const name = document.getElementById('gq-name')?.value?.trim();
    const flat = document.getElementById('gq-flat')?.value?.trim();
    const company = document.getElementById('gq-company')?.value?.trim();
    const vehicle = document.getElementById('gq-vehicle')?.value?.trim();
    const purpose = document.getElementById('gq-purpose')?.value;
    if (!name || !flat) { showToast('Name and Flat are required', 'error'); return; }
    const estimatedMins = _getPurposeDuration(purpose + ' ' + (company || ''));
    try {
        const insData = {
            visitor_name: name,
            flat_no: flat.toUpperCase(),
            company_name: company || null,
            vehicle_no: vehicle || '',
            purpose: purpose || 'Delivery',
            pass_type: 'immediate_inward',
            status: 'pending',
            expected_duration_min: estimatedMins,
            created_by: _userId()
        };
        const { error } = await sbClient.from('visitor_passes').insert(insData);
        if (error) throw error;
        showToast('Entry request sent to ' + flat.toUpperCase(), 'success');
        document.getElementById('gq-name').value = '';
        document.getElementById('gq-vehicle').value = '';
        document.getElementById('gq-company').value = '';
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
};

// --- Resident: Approve Entry ---
window.gateApproveEntry = async function(id) {
    try {
        const now = new Date().toISOString();
        const { error } = await sbClient.from('visitor_passes')
            .update({ status: 'approved', checked_in_at: now, approved_by: _userId(), responded_at: now })
            .eq('id', id);
        if (error) throw error;
        await sbClient.from('gate_log').insert({
            pass_id: id, action: 'approve', performed_by: _userId(),
            flat_no: '', visitor_name: '', remarks: ''
        }).maybeSingle();
        showToast('Entry approved ✓', 'success');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
};

// --- Resident: Deny Entry ---
window.gateDenyEntry = async function(id) {
    try {
        const { error } = await sbClient.from('visitor_passes')
            .update({ status: 'rejected', approved_by: _userId(), responded_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
        await sbClient.from('gate_log').insert({
            pass_id: id, action: 'deny', performed_by: _userId(),
            flat_no: '', visitor_name: '', remarks: ''
        }).maybeSingle();
        showToast('Entry denied ✗', 'success');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
};

// --- Resident: Check Out (force checkout) ---
window.gateCheckOut = async function(id) {
    try {
        const now = new Date().toISOString();
        const { error } = await sbClient.from('visitor_passes')
            .update({ status: 'checked_out', checked_out_at: now })
            .eq('id', id);
        if (error) throw error;
        showToast('Checked out', 'success');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
};

// --- Resident: Create Pre-Auth Guest Pass ---
window.gateCreatePreAuth = async function() {
    const name = document.getElementById('gp-name')?.value?.trim();
    const phone = document.getElementById('gp-phone')?.value?.trim();
    const vehicle = document.getElementById('gp-vehicle')?.value?.trim();
    const purpose = document.getElementById('gp-purpose')?.value?.trim() || 'Guest';
    const validUntil = document.getElementById('gp-valid-until')?.value;
    const flatNo = _flatNo();
    if (!name || !flatNo) { showToast('Guest name required', 'error'); return; }
    const qrToken = Math.random().toString(36).substring(2, 10).toUpperCase();
    try {
        const insData = {
            visitor_name: name,
            flat_no: flatNo,
            phone: phone || '',
            vehicle_no: vehicle || '',
            purpose: purpose,
            pass_type: 'pre_auth_guest',
            status: 'approved',
            qr_token: qrToken,
            valid_until: validUntil || null,
            created_by: _userId()
        };
        const { data, error } = await sbClient.from('visitor_passes').insert(insData).select('id').single();
        if (error) throw error;
        showToast('✓ QR Pass generated!', 'success', {
            text: '<i class="fa-solid fa-share"></i> Share via WhatsApp',
            callback: () => {
                const msg = encodeURIComponent('🏢 Gate Pass\nGuest: ' + name + '\nCode: ' + qrToken + '\nFlat: ' + flatNo + '\nValid till: ' + (validUntil ? new Date(validUntil).toLocaleString('en-IN') : 'Today'));
                window.open('https://wa.me/?text=' + msg, '_blank');
            }
        });
        document.getElementById('gp-name').value = '';
        document.getElementById('gp-phone').value = '';
        document.getElementById('gp-vehicle').value = '';
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
};

// --- Guard: Staff Check In ---
window.gateStaffCheckIn = async function(flatNo, name, purpose) {
    try {
        // Find or create monthly_staff record
        let staff = _monthlyStaff.find(s => s.flat_no === flatNo && s.name === name && s.purpose === purpose);
        if (!staff) {
            const { data, error } = await sbClient.from('monthly_staff').insert({
                flat_no: flatNo, name, purpose: purpose || '', is_active: true
            }).select('id').single();
            if (error) throw error;
            staff = { id: data.id, flat_no: flatNo, name, purpose: purpose || '' };
            _monthlyStaff.push(staff);
        }
        const insData = {
            visitor_name: name,
            flat_no: flatNo,
            purpose: purpose || 'Monthly Staff',
            pass_type: 'monthly_pass',
            status: 'checked_in',
            monthly_staff_id: staff.id,
            checked_in_at: new Date().toISOString(),
            created_by: _userId()
        };
        await sbClient.from('visitor_passes').insert(insData);
        await sbClient.from('gate_log').insert({
            staff_id: staff.id, action: 'check_in', performed_by: _userId(),
            flat_no: flatNo, visitor_name: name, remarks: ''
        }).maybeSingle();
        showToast(name + ' checked in ✓', 'success');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
};

// --- Guard: Staff Check Out ---
window.gateStaffCheckOut = async function(flatNo, name, purpose) {
    try {
        const staff = _monthlyStaff.find(s => s.flat_no === flatNo && s.name === name && s.purpose === purpose);
        if (!staff) { showToast('Staff record not found', 'error'); return; }
        const now = new Date().toISOString();
        const { data: active } = await sbClient.from('visitor_passes')
            .select('id').eq('monthly_staff_id', staff.id).eq('status', 'checked_in').limit(1);
        if (active && active.length > 0) {
            await sbClient.from('visitor_passes')
                .update({ status: 'checked_out', checked_out_at: now })
                .eq('id', active[0].id);
        }
        await sbClient.from('gate_log').insert({
            staff_id: staff.id, action: 'check_out', performed_by: _userId(),
            flat_no: flatNo, visitor_name: name, remarks: ''
        }).maybeSingle();
        showToast(name + ' checked out ✓', 'success');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
};

// --- Add Staff ---
window.gateOpenAddStaff = function(prefillFlat) {
    document.getElementById('gs-id') && (document.getElementById('gs-id').value = '');
    document.getElementById('gs-name').value = '';
    document.getElementById('gs-phone').value = '';
    document.getElementById('gs-flat').value = prefillFlat || '';
    document.getElementById('gs-purpose').value = 'Maid';
    document.getElementById('gs-photo').value = '';
    document.getElementById('gs-idcard').value = '';
    document.getElementById('gs-title').textContent = 'Register Staff';
    document.getElementById('gs-submit').innerHTML = '<i class="fa-solid fa-save"></i> Register';
    const modal = document.getElementById('gateStaffModal');
    if (modal) modal.style.display = 'block';
};

window.gateOpenEditStaff = async function(staffId) {
    const staff = _monthlyStaff.find(s => s.id === staffId);
    if (!staff) { showToast('Staff not found', 'error'); return; }
    document.getElementById('gs-id').value = staff.id;
    document.getElementById('gs-name').value = staff.name || '';
    document.getElementById('gs-phone').value = staff.phone || '';
    document.getElementById('gs-flat').value = staff.flat_no || '';
    document.getElementById('gs-purpose').value = staff.purpose || 'Maid';
    document.getElementById('gs-photo').value = staff.photo_url || '';
    document.getElementById('gs-idcard').value = staff.id_card_no || '';
    document.getElementById('gs-title').textContent = 'Edit Staff';
    document.getElementById('gs-submit').innerHTML = '<i class="fa-solid fa-save"></i> Update';
    const modal = document.getElementById('gateStaffModal');
    if (modal) modal.style.display = 'block';
};

window.gateSaveStaff = async function() {
    const id = document.getElementById('gs-id')?.value;
    const name = document.getElementById('gs-name')?.value?.trim();
    const phone = document.getElementById('gs-phone')?.value?.trim();
    const flat = document.getElementById('gs-flat')?.value?.trim();
    const purpose = document.getElementById('gs-purpose')?.value;
    const photo = document.getElementById('gs-photo')?.value?.trim();
    const idcard = document.getElementById('gs-idcard')?.value?.trim();
    if (!name || !flat) { showToast('Name and Flat required', 'error'); return; }
    try {
        const payload = {
            name, phone: phone || '', flat_no: flat.toUpperCase(),
            purpose: purpose || '', photo_url: photo || '', id_card_no: idcard || ''
        };
        if (id) {
            const { error } = await sbClient.from('monthly_staff').update(payload).eq('id', id);
            if (error) throw error;
            showToast('Staff updated ✓', 'success');
        } else {
            payload.created_by = _userId();
            const { error } = await sbClient.from('monthly_staff').insert(payload);
            if (error) throw error;
            showToast('Staff added ✓', 'success');
        }
        closeModal('gateStaffModal');
        await _loadData();
        _render();
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
};

// --- QR Scanner (simulated) ---
window.gateScanQR = function() {
    // In production, this would use a camera scanner
    const code = prompt('Enter QR Code / Pass Code:');
    if (!code) return;
    // Find a matching pre-auth pass
    const pass = _gatePasses.find(p => p.qr_token === code.toUpperCase() && p.status === 'approved' && (p.pass_type === 'pre_auth_guest'));
    if (!pass) {
        showToast('Invalid or expired pass code', 'error');
        return;
    }
    // Check valid_until
    if (pass.valid_until && new Date(pass.valid_until) < new Date()) {
        showToast('This pass has expired', 'error');
        return;
    }
    // Mark as checked in
    gateApproveEntry(pass.id);
    showToast('✓ ' + pass.visitor_name + ' admitted', 'success');
};

// ============================================================
// Modal close cleanup
// ============================================================
const _origGateClose = window.closeModal;
window.closeModal = function(id) {
    if (id === 'gateModal') _unsubscribeGate();
    if (_origGateClose) _origGateClose(id);
};

// Build flat datalist for guard form on load
setTimeout(() => {
    if (window._ownersForSearch) {
        window._flatsForDatalist = window._ownersForSearch.map(o => o.flat_no).filter(Boolean);
    } else if (sbClient) {
        sbClient.from('owners').select('flat_no').then(({ data }) => {
            if (data) window._flatsForDatalist = data.map(o => o.flat_no).filter(Boolean);
        }).catch(() => {});
    }
}, 2000);
