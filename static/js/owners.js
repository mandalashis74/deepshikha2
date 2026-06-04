// --- OWNERS & RESIDENTS DIRECTORY (CRM) ---
let allOwnersData = [];
let pendingSelectFlat = null;

window.openOwnersDirectoryModal = function(selectFlatNo) {
    openModal('ownersDirectoryModal');
    pendingSelectFlat = selectFlatNo || null;
    loadOwnersDirectory();
};

window.loadOwnersDirectory = async function(filterText = "") {
    if (!sbClient) return;
    
    const grid = document.getElementById("flats-grid");
    if (!grid) return;
    
    if (!filterText) {
        grid.innerHTML = `<div style="grid-column: span 3; text-align: center; color: var(--text-secondary); padding: 20px;"><i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i>Loading flats...</div>`;
    }
    
    // Populate floor filter dynamically from config
    const floorFilter = document.getElementById('directory-floor-filter');
    if (floorFilter) {
        const count = getFloorCount();
        let opts = '<option value="">All Floors</option>';
        for (let i = 1; i <= count; i++) {
            opts += `<option value="${i}">Floor ${i}</option>`;
        }
        floorFilter.innerHTML = opts;
    }
    
    try {
        let { data, error } = await sbClient.from('owners').select('*').order('flat_no');
        if (error) throw error;
        
        allOwnersData = filterFlatsByAssignment(data || []);
        renderOwnersGrid(allOwnersData, filterText);

        if (pendingSelectFlat) {
            const target = allOwnersData.find(o => o.flat_no === pendingSelectFlat);
            if (target) {
                window.selectFlatForEdit(pendingSelectFlat);
                const search = document.getElementById("directory-search");
                if (search) search.value = pendingSelectFlat;
            }
            pendingSelectFlat = null;
        }
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
               window.displayStructured(item.owner_name, 'name').toLowerCase().includes(query) || 
               window.displayStructured(item.contact_no, 'phone').toLowerCase().includes(query) ||
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
        let badgeClass = "badge-income";
        if (item.occupancy_status === 'tenant-occupied') {
            statusText = "Tenant";
            badgeClass = "badge-tenant";
        } else if (item.occupancy_status === 'vacant') {
            statusText = "Vacant";
            badgeClass = "badge-expense";
        }
        
        // Soft login: highlight own flat, dim others
        const isSoftLogin = localStorage.getItem("isSoftLogin") === "true";
        const myFlat = localStorage.getItem("currentFlatNo") || '';
        const isMyFlat = isSoftLogin && item.flat_no === myFlat;
        if (isMyFlat) {
            card.classList.add("my-flat");
        } else if (isSoftLogin) {
            card.classList.add("dimmed");
        }
        
        card.innerHTML = `
            <h4>${item.flat_no}${isMyFlat ? ' <i class="fa-solid fa-house" style="color:var(--color-indigo);font-size:0.7rem;"></i>' : ''}</h4>
            <p style="font-weight: 600;">${window.displayStructured(item.owner_name, 'name') || 'Unknown'}${item.occupancy_status === 'tenant-occupied' && item.tenant_name ? `<br><span style="font-weight:400;font-size:0.75rem;color:var(--text-muted);">Tenant: ${item.tenant_name}</span>` : ''}</p>
            <div style="display:flex; gap:4px; flex-wrap:wrap;">
                <span class="badge ${badgeClass}" style="font-size: 0.6rem; padding: 1px 6px;">${statusText}</span>
                ${item.flat_type ? `<span class="badge badge-income" style="font-size: 0.6rem; padding: 1px 6px; background:rgba(99,102,241,0.12); color:var(--color-indigo);">${item.flat_type}</span>` : ''}
            </div>
        `;
        grid.appendChild(card);
    });
}

window.filterOwnersDirectory = function() {
    const query = document.getElementById("directory-search").value;
    const floor = document.getElementById("directory-floor-filter") ? document.getElementById("directory-floor-filter").value : "";
    renderOwnersGrid(allOwnersData, query, floor);
};

// Field definitions for structured rows
const STRUCTURED_FIELDS = {
    owner: [
        { key: 'name', label: 'Name', type: 'text' }
    ],
    contact: [
        { key: 'phone', label: 'Phone', type: 'text' }
    ],
    family: [
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'relation', label: 'Relation', type: 'text' },
        { key: 'gender', label: 'Gender', type: 'select', options: ['', 'Male', 'Female', 'Other'] }
    ],
    service: [
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'role', label: 'Role', type: 'text' },
        { key: 'age', label: 'Age', type: 'number' },
        { key: 'gender', label: 'Gender', type: 'select', options: ['', 'Male', 'Female', 'Other'] }
    ],
    vehicle: [
        { key: 'number', label: 'Vehicle No', type: 'text' },
        { key: 'type', label: 'Type', type: 'select', options: ['', 'Car', 'Bike', 'Scooter', 'Bicycle', 'Other'] }
    ]
};

function getContainerId(prefix) {
    const map = { owner: 'owner-names-container', contact: 'contact-numbers-container', family: 'family-members-container', service: 'service-person-container', vehicle: 'vehicle-container' };
    return map[prefix] || '';
}

// displayStructured is defined in app.js on window.*

// Helper: parse JSON array from owner field (handles plain text fallback)
function parseStructuredField(value, prefix) {
    if (!value) return [];
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) {
            if (prefix === 'owner') return [{ name: value }];
            if (prefix === 'contact') return [{ phone: value }];
            if (prefix === 'family') {
                return value.split(',').map(s => ({ name: s.trim(), relation: '', gender: '' })).filter(s => s.name);
            }
        }
    }
    return [];
}

// Collect structured rows data as JSON string
function collectStructuredRows(prefix) {
    const fields = STRUCTURED_FIELDS[prefix];
    if (!fields) return '';
    const container = document.getElementById(getContainerId(prefix));
    if (!container) return '';
    const rows = container.querySelectorAll('.structured-row');
    if (rows.length === 0) return '';
    const data = [];
    rows.forEach(row => {
        const entry = {};
        fields.forEach(f => {
            const input = row.querySelector(`[id^="${prefix}-${f.key}-"]`);
            const val = input ? input.value.trim() : '';
            entry[f.key] = val;
        });
        if (entry[fields[0].key]) {
            data.push(entry);
        }
    });
    return data.length > 0 ? JSON.stringify(data) : '';
}

// Helper: render structured rows inside selectFlatForEdit
function renderStructuredRows(prefix, value, canEdit) {
    const fields = STRUCTURED_FIELDS[prefix];
    if (!fields) return '';
    const rows = parseStructuredField(value, prefix);
    if (rows.length === 0 && !canEdit) {
        return '<span style="color:var(--text-muted); font-size:0.85rem;">None</span>';
    }
    if (rows.length === 0) {
        return '';
    }
    
    let html = '<div class="structured-table-container">';
    html += '<table class="structured-table">';
    html += '<thead><tr>';
    fields.forEach(f => {
        html += `<th>${f.label}</th>`;
    });
    if (canEdit) html += '<th></th>';
    html += '</tr></thead>';
    html += '<tbody class="structured-rows">';
    
    rows.forEach((row, i) => {
        html += '<tr class="structured-row">';
        fields.forEach(f => {
            const val = row[f.key] || '';
            if (canEdit) {
                if (f.type === 'select') {
                    html += `<td><select class="structured-input" id="${prefix}-${f.key}-${i}" style="width:100%;">`;
                    f.options.forEach(opt => {
                        const sel = opt === val ? 'selected' : '';
                        html += `<option value="${opt}" ${sel}>${opt || 'Select'}</option>`;
                    });
                    html += '</select></td>';
                } else {
                    html += `<td><input type="${f.type}" class="structured-input" id="${prefix}-${f.key}-${i}" value="${escapeHtml(val)}" placeholder="${f.label}" style="width:100%;"></td>`;
                }
            } else {
                html += `<td>${escapeHtml(val) || '—'}</td>`;
            }
        });
        if (canEdit) {
            html += `<td><button type="button" class="btn btn-rose" onclick="removeStructuredRow(this)" style="padding:4px 8px; font-size:0.75rem;"><i class="fa-solid fa-times"></i></button></td>`;
        }
        html += '</tr>';
    });
    
    html += '</tbody></table></div>';
    return html;
}

// Add a new empty structured row
window.addStructuredRow = function(prefix) {
    const fields = STRUCTURED_FIELDS[prefix];
    if (!fields) return;
    const container = document.getElementById(getContainerId(prefix));
    if (!container) return;
    
    const tbody = container.querySelector('.structured-rows');
    if (!tbody) return;
    
    const count = tbody.querySelectorAll('.structured-row').length;
    const row = document.createElement("tr");
    row.className = 'structured-row';
    let innerHtml = '';
    fields.forEach(f => {
        if (f.type === 'select') {
            innerHtml += `<td><select class="structured-input" id="${prefix}-${f.key}-${count}" style="width:100%;">`;
            f.options.forEach(opt => {
                innerHtml += `<option value="${opt}">${opt || 'Select'}</option>`;
            });
            innerHtml += '</select></td>';
        } else {
            innerHtml += `<td><input type="${f.type}" class="structured-input" id="${prefix}-${f.key}-${count}" placeholder="${f.label}" style="width:100%;"></td>`;
        }
    });
    innerHtml += `<td><button type="button" class="btn btn-rose" onclick="removeStructuredRow(this)" style="padding:4px 8px; font-size:0.75rem;"><i class="fa-solid fa-times"></i></button></td>`;
    row.innerHTML = innerHtml;
    tbody.appendChild(row);
};

// Remove a structured row
window.removeStructuredRow = function(btn) {
    const row = btn.closest('.structured-row');
    if (row) row.remove();
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
    
    const canEditAny = hasPermission('owners:edit_any');
    const isOwnFlat = localStorage.getItem("isSoftLogin") === "true" && localStorage.getItem("currentFlatNo") === flatNo;
    const canEdit = canEditAny || (hasPermission('owners:edit_own') && isOwnFlat);
    
    const statusColor = item.occupancy_status === 'vacant' ? 'var(--color-rose)' : item.occupancy_status === 'tenant-occupied' ? 'var(--color-orange)' : 'var(--color-emerald)';
    const statusIcon = item.occupancy_status === 'vacant' ? 'fa-door-closed' : item.occupancy_status === 'tenant-occupied' ? 'fa-user-tie' : 'fa-house-chimney-user';
    
    const statusOptions = [
        { value: 'owner-occupied', label: 'Owner Occupied' },
        { value: 'tenant-occupied', label: 'Tenant Occupied' },
        { value: 'vacant', label: 'Vacant' }
    ];
    
    let selectHTML = `<select id="edit-status" onchange="autoFillOccupancyTo()" disabled>`;
    statusOptions.forEach(opt => {
        const selected = opt.value === item.occupancy_status ? "selected" : "";
        selectHTML += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
    });
    selectHTML += `</select>`;
    
    const showPasscode = isOwnFlat || canEditAny;
    
    detailSide.innerHTML = `
        <div class="card" style="background: linear-gradient(135deg, rgba(255,255,255,0.02), rgba(99,102,241,0.04)); border: 1px solid var(--border-color); padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; margin-bottom: 16px;">
                <div>
                    <h3 style="font-size: 1.2rem; font-weight: 700; color: var(--color-indigo); margin:0;"><i class="fa-solid fa-door-open" style="color:var(--color-indigo);margin-right:8px;"></i> Flat ${item.flat_no}</h3>
                    <span style="font-size:0.7rem;color:var(--text-muted);">${item.flat_type || ''}</span>
                </div>
                <span class="badge ${item.occupancy_status === 'vacant' ? 'badge-expense' : 'badge-income'}" style="border-color:${statusColor};">
                    <i class="fa-solid ${statusIcon}" style="margin-right:4px;"></i> ${item.occupancy_status.replace('-', ' ')}
                </span>
            </div>
            
            <form id="edit-owner-form" onsubmit="saveOwnerProfile(event)">
                <input type="hidden" id="edit-flat-no" value="${item.flat_no}">
                
                <div class="input-field">
                    <label><i class="fa-solid fa-user" style="color:var(--color-indigo);width:16px;margin-right:6px;"></i> Owner Names</label>
                    <div id="owner-names-container">
                        ${renderStructuredRows('owner', item.owner_name, false)}
                    </div>
                    ${canEdit ? '<button type="button" class="btn btn-slate btn-add-structured-row" onclick="addStructuredRow(\'owner\')" style="margin-top: 6px; font-size:0.8rem; padding:4px 12px; display:none;"><i class="fa-solid fa-plus"></i> Add Owner</button>' : ''}
                </div>
                
                ${item.occupancy_status === 'tenant-occupied' ? `
                <div class="input-field">
                    <label for="edit-tenant-name">Tenant Name</label>
                    <input type="text" id="edit-tenant-name" value="${item.tenant_name || ''}" disabled>
                </div>
                ` : `<input type="hidden" id="edit-tenant-name" value="${item.tenant_name || ''}">`}
                
                <div class="input-field">
                    <label><i class="fa-solid fa-phone" style="color:var(--color-emerald);width:16px;margin-right:6px;"></i> Contact Numbers</label>
                    <div id="contact-numbers-container">
                        ${renderStructuredRows('contact', item.contact_no, false)}
                    </div>
                    ${canEdit ? '<button type="button" class="btn btn-slate btn-add-structured-row" onclick="addStructuredRow(\'contact\')" style="margin-top: 6px; font-size:0.8rem; padding:4px 12px; display:none;"><i class="fa-solid fa-plus"></i> Add Contact</button>' : ''}
                </div>
                
                ${showPasscode ? `
                <div class="input-field">
                    <label for="edit-passcode"><i class="fa-solid fa-lock" style="color:var(--color-yellow);width:16px;margin-right:6px;"></i> Passcode</label>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <input type="password" id="edit-passcode" placeholder="e.g. 1234" value="${item.passcode || ''}" disabled style="flex:1;">
                        ${canEditAny ? `
                        <button type="button" class="btn btn-slate" onclick="togglePasscodeVisibility()" style="padding:10px;" title="Show/Hide Passcode">
                            <i class="fa-solid fa-eye" id="passcode-toggle-icon"></i>
                        </button>
                        ` : ''}
                    </div>
                </div>
                ` : ''}
                
                <div class="input-field">
                    <label><i class="fa-solid fa-square-parking" style="color:var(--color-violet);width:16px;margin-right:6px;"></i> Parking Space No</label>
                    <span class="field-display" id="display-parking">${escapeHtml(item.parking_no || 'None')}</span>
                    <input type="text" id="edit-parking" value="${item.parking_no || 'None'}" style="display:none;">
                </div>

                <div class="input-field">
                    <label><i class="fa-solid fa-house-circle-check" style="color:${statusColor};width:16px;margin-right:6px;"></i> Occupancy Status</label>
                    <span class="field-display" id="display-status" style="color:${statusColor};font-weight:600;">${item.occupancy_status ? item.occupancy_status.replace(/-/g, ' ') : '—'}</span>
                    <div id="edit-status-wrap" style="display:none;">${selectHTML}</div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div class="input-field">
                        <label><i class="fa-regular fa-calendar-check" style="color:var(--color-emerald);width:16px;margin-right:6px;"></i> Occupied From</label>
                        <span class="field-display" id="display-occupancy-from">${item.occupancy_from || '—'}</span>
                        <input type="date" id="edit-occupancy-from" value="${item.occupancy_from || ''}" style="display:none;">
                    </div>
                    <div class="input-field">
                        <label><i class="fa-regular fa-calendar-xmark" style="color:var(--color-rose);width:16px;margin-right:6px;"></i> Occupied To</label>
                        <span class="field-display" id="display-occupancy-to">${item.occupancy_to || '—'}</span>
                        <input type="date" id="edit-occupancy-to" value="${item.occupancy_to || ''}" style="display:none;">
                    </div>
                </div>

                <div class="input-field">
                    <label><i class="fa-solid fa-layer-group" style="color:var(--color-violet);width:16px;margin-right:6px;"></i> Flat Type</label>
                    <span class="field-display" id="display-flat-type">${escapeHtml(item.flat_type || '—')}</span>
                    <select id="edit-flat-type" style="display:none;">
                        <option value="">-- Select --</option>
                        ${getFlatTypesList().map(t => `<option value="${t}" ${item.flat_type === t ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                </div>
                
                <div class="input-field">
                    <label><i class="fa-solid fa-people-group" style="color:var(--color-rose);width:16px;margin-right:6px;"></i> Family Members</label>
                    <div id="family-members-container">
                        ${renderStructuredRows('family', item.family_members, false)}
                    </div>
                    ${canEdit ? '<button type="button" class="btn btn-slate btn-add-structured-row" onclick="addStructuredRow(\'family\')" style="margin-top: 6px; font-size:0.8rem; padding:4px 12px; display:none;"><i class="fa-solid fa-plus"></i> Add Member</button>' : ''}
                </div>
                
                <div class="input-field">
                    <label><i class="fa-solid fa-hand-sparkles" style="color:var(--color-yellow);width:16px;margin-right:6px;"></i> Service Person</label>
                    <div id="service-person-container">
                        ${renderStructuredRows('service', item.service_person, false)}
                    </div>
                    ${canEdit ? '<button type="button" class="btn btn-slate btn-add-structured-row" onclick="addStructuredRow(\'service\')" style="margin-top: 6px; font-size:0.8rem; padding:4px 12px; display:none;"><i class="fa-solid fa-plus"></i> Add Person</button>' : ''}
                </div>
                
                <div class="input-field">
                    <label><i class="fa-solid fa-truck" style="color:var(--color-teal);width:16px;margin-right:6px;"></i> Vehicle Details</label>
                    <div id="vehicle-container">
                        ${renderStructuredRows('vehicle', item.vehicle_details, false)}
                    </div>
                    ${canEdit ? '<button type="button" class="btn btn-slate btn-add-structured-row" onclick="addStructuredRow(\'vehicle\')" style="margin-top: 6px; font-size:0.8rem; padding:4px 12px; display:none;"><i class="fa-solid fa-plus"></i> Add Vehicle</button>' : ''}
                </div>
                
                <div style="display: flex; gap: 8px; margin-top: 16px;">
                    ${canEdit ? `
                        <button type="button" class="btn btn-indigo" id="btn-enable-edit" onclick="enableOwnerEditing()" style="flex: 1;">
                            <i class="fa-solid fa-pen"></i> Enable Editing
                        </button>
                    ` : `
                        <div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; width: 100%; padding: 8px;">
                            <i class="fa-solid fa-lock"></i> Edit restricted to Owner or Administrators.
                        </div>
                    `}
                </div>
                
                <div class="modal-actions" style="margin-top: 16px; display: none;" id="save-profile-actions">
                    <button type="submit" class="btn btn-emerald" style="width: 100%;">
                        <i class="fa-solid fa-floppy-disk"></i> Save Profile
                    </button>
                </div>
            </form>
        </div>
    `;
};

window.togglePasscodeVisibility = function() {
    const input = document.getElementById("edit-passcode");
    const icon = document.getElementById("passcode-toggle-icon");
    if (!input || !icon) return;
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    icon.className = isPassword ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
};

window.autoFillOccupancyTo = function() {
    const status = document.getElementById("edit-status");
    const occTo = document.getElementById("edit-occupancy-to");
    if (!status || !occTo) return;
    if (status.value === 'vacant' && !occTo.value) {
        occTo.value = new Date().toISOString().split('T')[0];
    }
};

window.enableOwnerEditing = function() {
    const form = document.getElementById("edit-owner-form");
    if (!form) return;

    const flatNo = document.getElementById("edit-flat-no").value;
    const item = allOwnersData.find(o => o.flat_no === flatNo);
    if (!item) return;

    document.querySelectorAll('.field-display').forEach(el => el.style.display = 'none');
    const editFields = ['edit-parking', 'edit-occupancy-from', 'edit-occupancy-to'];
    editFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = '';
    });
    const editWrap = document.getElementById('edit-status-wrap');
    if (editWrap) editWrap.style.display = '';
    const flatType = document.getElementById('edit-flat-type');
    if (flatType) flatType.style.display = '';
    // Re-query the select inside wrap so autoFillOccupancyTo works
    const statusSelect = document.getElementById('edit-status');
    if (statusSelect) statusSelect.disabled = false;

    const ownerContainer = document.getElementById("owner-names-container");
    if (ownerContainer) ownerContainer.innerHTML = renderStructuredRows('owner', item.owner_name, true);

    const contactContainer = document.getElementById("contact-numbers-container");
    if (contactContainer) contactContainer.innerHTML = renderStructuredRows('contact', item.contact_no, true);
    
    const familyContainer = document.getElementById("family-members-container");
    if (familyContainer) familyContainer.innerHTML = renderStructuredRows('family', item.family_members, true);
    
    const serviceContainer = document.getElementById("service-person-container");
    if (serviceContainer) serviceContainer.innerHTML = renderStructuredRows('service', item.service_person, true);
    
    const vehicleContainer = document.getElementById("vehicle-container");
    if (vehicleContainer) vehicleContainer.innerHTML = renderStructuredRows('vehicle', item.vehicle_details, true);
    
    const saveActions = document.getElementById("save-profile-actions");
    if (saveActions) saveActions.style.display = "flex";
    
    const enableBtn = document.getElementById("btn-enable-edit");
    if (enableBtn) enableBtn.style.display = "none";
    
    document.querySelectorAll(".btn-add-structured-row").forEach(btn => btn.style.display = "inline-flex");
    
    showToast("Editing enabled. Make your changes and click Save Profile.", "info");
};

window.saveOwnerProfile = async function(e) {
    e.preventDefault();
    if (!sbClient) return;
    const flatNo = document.getElementById("edit-flat-no").value;
    const isOwnFlat = localStorage.getItem("isSoftLogin") === "true" && localStorage.getItem("currentFlatNo") === flatNo;
    
    if (!hasPermission('owners:edit_any') && !(hasPermission('owners:edit_own') && isOwnFlat)) {
        showToast("Access Denied: Only Admins or the flat owner can save profiles.", "error");
        return;
    }
    
    const ownerName = collectStructuredRows('owner');
    const contactNo = collectStructuredRows('contact');

    const passcodeInput = document.getElementById("edit-passcode");
    let passcode = undefined;
    if (passcodeInput) {
        const passcodeVal = passcodeInput.value.trim();
        passcode = passcodeVal ? parseInt(passcodeVal) : null;
    }
    const parkingNo = document.getElementById("edit-parking").value.trim();
    const status = document.getElementById("edit-status").value;
    const flatType = document.getElementById("edit-flat-type").value;
    const occupancyFrom = document.getElementById("edit-occupancy-from")?.value || null;
    const occupancyTo = document.getElementById("edit-occupancy-to")?.value || null;
    const family = collectStructuredRows('family');
    const servicePerson = collectStructuredRows('service');
    const vehicleDetails = collectStructuredRows('vehicle');

    // Use ownerName or contactNo directly; if empty JSON, fall back to empty string
    const updateData = {
        owner_name: ownerName || '',
        contact_no: contactNo || '',
        parking_no: parkingNo,
        occupancy_status: status,
        flat_type: flatType,
        occupancy_from: occupancyFrom,
        occupancy_to: occupancyTo,
        family_members: family,
        service_person: servicePerson,
        vehicle_details: vehicleDetails
    };
    
    if (passcode !== undefined) {
        updateData.passcode = passcode;
    }

    const submitBtn = e.target.querySelector("button[type=submit]");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving...";
    }
    
    try {
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
    
    if (!hasPermission('income:delete') && !hasPermission('expense:delete')) {
        showToast("Access Denied: You don't have permission to delete entries.", "error");
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

window.showCustomModal = function(title, bodyHtml) {
    const overlay = document.createElement('div');
    overlay.className = 'modal';
    overlay.style.display = 'block';
    overlay.innerHTML = `
        <div class="modal-content animate-zoom" style="max-width:600px;">
            <div class="modal-header">
                <h2>${title}</h2>
                <span class="close" onclick="document.body.removeChild(this.closest('.modal'))">&times;</span>
            </div>
            <div class="modal-body">${bodyHtml}</div>
            <div class="modal-footer">
                <button class="btn btn-slate" onclick="document.body.removeChild(this.closest('.modal'))">Close</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) document.body.removeChild(overlay);
    });
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
        const { data, error } = await sbClient.from('income').select('id, flat_no, year, month, amount, date_received, category, event_name, remarks, collected_by, payment_mode, ref_number, status, approved_by, approved_at').eq('id', entryId).single();
        if (error || !data) throw new Error("Receipt data not found.");
        
        if (data.status === 'pending') {
            showToast("Payment is pending approval. Receipt not yet available.", "warning");
            return;
        }
        if (data.status === 'rejected') {
            showToast("Payment was rejected. Please contact the society office.", "error");
            return;
        }
        
        // Fetch owner name
        const { data: ownerData } = await sbClient.from('owners').select('owner_name').eq('flat_no', data.flat_no).single();
        const rawName = ownerData ? ownerData.owner_name : '';
        const ownerName = window.displayStructured(rawName, 'name') || rawName || `Flat ${data.flat_no}`;
        
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
        doc.text(getBuildingName().toUpperCase(), 105, 74, { align: "center", angle: 15 });
        
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
        const bName = getBuildingName();
        const blkName = getBlockName();
        const fullName = blkName ? `${bName} (${blkName})` : bName;
        doc.text(fullName.toUpperCase(), 34, 17);
        
        doc.setTextColor(71, 85, 105); // slate 600
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Flat Owners Association", 34, 22);
        doc.text(buildingConfig?.address || fullName, 34, 26);
        
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
        doc.text(window.formatDateDisplay(data.date_received), 160, 45);
        
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
        
        // Payment mode on right side
        if (data.payment_mode) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(51, 65, 85);
            doc.text("Payment Mode:", 120, 76);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(15, 23, 42);
            doc.text(data.payment_mode + (data.ref_number ? ' (' + data.ref_number + ')' : ''), 138, 76);
        }
        
        // Approval info on right side
        if (data.approved_by) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7);
            doc.setTextColor(100, 116, 139);
            doc.text("Approved:", 120, 84);
            doc.setFont("helvetica", "normal");
            const apprText = data.approved_by + (data.approved_at ? ' on ' + window.formatDateDisplay(data.approved_at) : '');
            doc.text(apprText, 138, 84);
            doc.setFontSize(8);
        }
        
        // Totals & Words
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text("Total Paid:", 12, 100);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(5, 150, 105); // emerald 600
        doc.text(`Rs. ${data.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 34, 100);
        
        // Words text
        const amtWords = window.numberToWords(data.amount);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
        doc.text("Amount in Words:", 12, 110);
        
        doc.setFont("helvetica", "oblique");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        const splitWords = doc.splitTextToSize(amtWords, 115);
        doc.text(splitWords, 12, 115);
        
        // Remarks
        if (data.remarks && data.category !== "Other") {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(51, 65, 85);
            doc.text("Remarks:", 12, 128);
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105);
            const splitRemarks = doc.splitTextToSize(data.remarks, 115);
            doc.text(splitRemarks, 12, 133);
        }
        
        // Collected By
        if (data.collected_by) {
            const collectedByY = (data.remarks && data.category !== "Other") ? 142 : 128;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            doc.text("Collected by:", 12, collectedByY);
            doc.setFont("helvetica", "normal");
            doc.text(data.collected_by, 38, collectedByY);
        }
        
        // Online Receipt
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text("ONLINE RECEIPT", 170, 140);
        
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
    // Reset toggle to Period mode with current month defaults
    const toggle = document.getElementById('period-mode-toggle');
    if (toggle) toggle.checked = false;
    const now = new Date();
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const yearSelect = document.getElementById('hist-year');
    const monthSelect = document.getElementById('hist-month');
    if (yearSelect) yearSelect.value = String(now.getFullYear());
    if (monthSelect) monthSelect.value = months[now.getMonth()];
    // Force UI to period mode
    const yearField = document.getElementById('hist-year-field');
    const monthField = document.getElementById('hist-month-field');
    const startDateField = document.getElementById('hist-start-date-field');
    const endDateField = document.getElementById('hist-end-date-field');
    const startDateInput = document.getElementById('hist-start-date');
    const endDateInput = document.getElementById('hist-end-date');
    if (yearField) yearField.classList.remove('hidden');
    if (monthField) monthField.classList.remove('hidden');
    if (startDateField) startDateField.classList.add('hidden');
    if (endDateField) endDateField.classList.add('hidden');
    if (startDateInput) startDateInput.value = '';
    if (endDateInput) endDateInput.value = '';
    await loadFlats();
    fetchHistory();
};

// Toggle between period-based (Year/Month) and date-range-based filtering
window.togglePeriodMode = function() {
    const isDateRange = document.getElementById('period-mode-toggle').checked;
    const yearField = document.getElementById('hist-year-field');
    const monthField = document.getElementById('hist-month-field');
    const startDateField = document.getElementById('hist-start-date-field');
    const endDateField = document.getElementById('hist-end-date-field');
    const yearSelect = document.getElementById('hist-year');
    const monthSelect = document.getElementById('hist-month');
    const startDateInput = document.getElementById('hist-start-date');
    const endDateInput = document.getElementById('hist-end-date');
    if (!isDateRange) {
        yearField.classList.remove('hidden');
        monthField.classList.remove('hidden');
        startDateField.classList.add('hidden');
        endDateField.classList.add('hidden');
        if (startDateInput) startDateInput.value = '';
        if (endDateInput) endDateInput.value = '';
    } else {
        startDateField.classList.remove('hidden');
        endDateField.classList.remove('hidden');
        yearField.classList.add('hidden');
        monthField.classList.add('hidden');
        if (yearSelect) yearSelect.value = 'ALL';
        if (monthSelect) monthSelect.value = 'ALL';
        const now = new Date();
        const currentYear = now.getFullYear();
        const todayStr = now.toISOString().split('T')[0];
        const startOfYearStr = `${currentYear}-01-01`;
        if (startDateInput && !startDateInput.value) startDateInput.value = startOfYearStr;
        if (endDateInput && !endDateInput.value) endDateInput.value = todayStr;
    }
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
            let q = sbClient.from('income').select('id, flat_no, year, month, amount, date_received, category, event_name, remarks').or('status.eq.approved,status.is.null');
            
            if (flat) {
                q = q.eq('flat_no', flat);
            }
            
            const isPeriodMode = !document.getElementById('period-mode-toggle')?.checked;
            if (isPeriodMode) {
                if (year && year !== "ALL") {
                    q = q.eq('year', year);
                }
                if (month && month !== "ALL") {
                    q = q.eq('month', month);
                }
            } else {
                if (startDate) {
                    q = q.gte('date_received', startDate);
                }
                if (endDate) {
                    q = q.lte('date_received', endDate);
                }
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
            
            const isPeriodMode = !document.getElementById('period-mode-toggle')?.checked;
            if (isPeriodMode) {
                if (year && year !== "ALL") {
                    q = q.eq('year', year);
                }
                if (month && month !== "ALL") {
                    q = q.eq('month', month);
                }
            } else {
                if (startDate) {
                    q = q.gte('date_spent', startDate);
                }
                if (endDate) {
                    q = q.lte('date_spent', endDate);
                }
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

        const canDelete = (entry.type === "INCOME" && hasPermission('income:delete')) || (entry.type === "EXPENSE" && hasPermission('expense:delete'));
        const deleteButton = canDelete
            ? `<button class="btn-delete" title="Delete entry" onclick="deleteHistoryEntry('${entry.type}', ${entry.id}, '${entry.description.replace(/'/g, "\\'").replace(/"/g, "&quot;")}')">
                    <i class="fa-solid fa-trash-can"></i>
               </button>`
            : '';

        tr.innerHTML = `
            <td>${window.formatDateDisplay(entry.date)}</td>
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
    
    if (!hasPermission('income:delete') && !hasPermission('expense:delete')) {
        showToast("Access Denied: You don't have permission to delete entries.", "error");
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

