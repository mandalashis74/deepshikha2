// ==========================================
// USERS AND ROLES MANAGEMENT
// ==========================================

// Building Configuration Modal
window.openBuildingConfigModal = function() {
    if (currentUserRole !== 'admin') {
        showToast("Access Denied. Building Setup is available only for administrators.", "error");
        return;
    }
    document.getElementById("cfg-building-name").value = getBuildingName();
    document.getElementById("cfg-block-name").value = getBlockName();
    document.getElementById("cfg-address").value = buildingConfig?.address || '';
    document.getElementById("cfg-gapi-key").value = buildingConfig?.google_api_key || '';
    document.getElementById("cfg-gclient-id").value = buildingConfig?.google_client_id || '';
    document.getElementById("cfg-vapid-public").value = buildingConfig?.vapid_public_key || '';
    document.getElementById("cfg-vapid-private").value = buildingConfig?.vapid_private_key || '';
    document.getElementById("cfg-floors").value = getFloorCount();
    document.getElementById("cfg-wings").value = getWingsList().join(',');
    document.getElementById("cfg-flat-types").value = getFlatTypesList().join(',');
    document.getElementById("cfg-dash-bg").value = buildingConfig?.dashboard_bg_url || '';
    openModal('buildingConfigModal');
};

window.handleSaveBuildingConfig = async function(e) {
    e.preventDefault();
    const config = {
        building_name: document.getElementById("cfg-building-name").value.trim(),
        block_name: document.getElementById("cfg-block-name").value.trim(),
        address: document.getElementById("cfg-address").value.trim(),
        google_api_key: document.getElementById("cfg-gapi-key").value.trim(),
        google_client_id: document.getElementById("cfg-gclient-id").value.trim(),
        vapid_public_key: document.getElementById("cfg-vapid-public").value.trim(),
        vapid_private_key: document.getElementById("cfg-vapid-private").value.trim(),
        floors: parseInt(document.getElementById("cfg-floors").value, 10) || 8,
        wings: document.getElementById("cfg-wings").value.trim().toUpperCase(),
        flat_types: document.getElementById("cfg-flat-types").value.trim().toUpperCase(),
        dashboard_bg_url: document.getElementById("cfg-dash-bg").value.trim()
    };
    const saved = await saveBuildingConfig(config);
    if (saved) {
        showToast("Building configuration saved!", "success");
        closeModal('buildingConfigModal');
        // Re-seed if flats changed
        await ensureOwnersPopulated();
        // Refresh directory if open
        const dirModal = document.getElementById('ownersDirectoryModal');
        if (dirModal && dirModal.style.display === 'block') {
            await loadOwnersDirectory();
        }
    }
};

window.openUsersModal = async function() {
    if (!hasPermission('users:manage')) {
        showToast("Access Denied. You don't have permission to manage users.", "error");
        return;
    }
    
    openModal("usersModal");
    const tbody = document.getElementById("users-table-body");
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Loading users...</td></tr>';
    
    try {
        const { data: profiles, error } = await sbClient
            .from('profiles')
            .select('id, email, role, assigned_floors')
            .order('email');
            
        if (error) throw error;
        
        if (!profiles || profiles.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No registered users found.</td></tr>';
            return;
        }
        
        // Only administrators can assign or view the Administrator option.
        const canAssignAdministrator = currentUserRole === 'admin';
        const roleOptionsMap = rolesData
            .filter(r => canAssignAdministrator || r.name !== 'admin')
            .map(r => 
            ({ value: r.name, label: r.label || r.name })
        );
        
        tbody.innerHTML = '';
        profiles.forEach(p => {
            const tr = document.createElement("tr");
            let roleOptions = roleOptionsMap.map(r => 
                `<option value="${r.value}" ${r.value === p.role ? 'selected' : ''}>${r.label}</option>`
            ).join('');
            
            // Prevent changing own role via UI for safety. Non-admins cannot change administrator rows.
            const isRestrictedAdminRow = p.role === 'admin' && !canAssignAdministrator;
            const disableSelect = p.id === currentUserId
                ? 'disabled title="Cannot change your own role"'
                : isRestrictedAdminRow
                    ? 'disabled title="Only administrators can change administrator users"'
                    : '';
            
            const userFloors = Array.isArray(p.assigned_floors) ? p.assigned_floors : [];
            const floorsText = userFloors.length > 0 ? `Floor ${userFloors.sort().join(', Floor ')}` : 'All';
            
            tr.innerHTML = `
                <td>${p.email}</td>
                <td>
                    <select id="role-select-${p.id}" class="filter-select" ${disableSelect}>
                        ${roleOptions}
                    </select>
                </td>
                <td style="text-align: center;">
                    <span style="font-size:0.8rem; color:var(--text-secondary);">${floorsText}</span>
                    <button class="btn btn-slate" style="padding: 2px 6px; font-size: 0.65rem; margin-left: 4px;" onclick="openAssignFloorsModal('${p.id}', '${escapeHtml(p.email)}')">
                        <i class="fa-solid fa-layer-group"></i>
                    </button>
                </td>
                <td>
                    <button class="btn btn-emerald" style="padding: 4px 8px; font-size: 0.8rem;" ${disableSelect} onclick="updateUserRole('${p.id}')">Save Role</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
    } catch (err) {
        console.error("Error fetching users:", err);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">Failed to load users.</td></tr>';
        showToast("Error loading users.", "error");
    }
};

window.updateUserRole = async function(userId) {
    if (!hasPermission('users:role_change')) {
        showToast("Access Denied.", "error");
        return;
    }
    
    const select = document.getElementById(`role-select-${userId}`);
    const newRole = select.value;
    if (newRole === 'admin' && currentUserRole !== 'admin') {
        showToast("Only administrators can assign the Administrator role.", "error");
        return;
    }
    
    try {
        const { error } = await sbClient
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId);
            
        if (error) throw error;
        showToast("User role updated successfully!", "success");
    } catch (err) {
        console.error("Error updating user role:", err);
        showToast("Failed to update user role: " + (err.message || err.details || JSON.stringify(err)), "error");
    }
};

window.openAssignFloorsModal = async function(userId, userEmail) {
    if (!hasPermission('users:role_change')) {
        showToast("Access Denied.", "error");
        return;
    }
    
    document.getElementById("assign-floors-user-id").value = userId;
    document.getElementById("assign-floors-user-email").textContent = userEmail;
    
    // Dynamically generate floor checkboxes from config
    const container = document.getElementById("floor-checkboxes-container");
    const count = getFloorCount();
    container.innerHTML = '';
    for (let i = 1; i <= count; i++) {
        const label = document.createElement('label');
        label.className = 'floor-checkbox-label';
        label.innerHTML = `<input type="checkbox" class="floor-checkbox" value="${i}"> Floor ${i}`;
        container.appendChild(label);
    }
    
    // Fetch current floor assignments
    try {
        const { data, error } = await sbClient.from('profiles').select('assigned_floors').eq('id', userId).single();
        if (error) throw error;
        
        const assigned = data && Array.isArray(data.assigned_floors) ? data.assigned_floors : [];
        
        // Check/uncheck boxes
        document.querySelectorAll(".floor-checkbox").forEach(cb => {
            cb.checked = assigned.includes(parseInt(cb.value));
        });
    } catch (err) {
        console.error("Error fetching floor assignments:", err);
        showToast("Failed to load floor assignments.", "error");
        return;
    }
    
    openModal("floorAssignmentModal");
};

window.saveFloorAssignment = async function() {
    if (!hasPermission('users:role_change')) {
        showToast("Access Denied.", "error");
        return;
    }
    
    const userId = document.getElementById("assign-floors-user-id").value;
    const checkedBoxes = document.querySelectorAll(".floor-checkbox:checked");
    const floors = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
    
    try {
        const { error } = await sbClient.from('profiles').update({ assigned_floors: floors }).eq('id', userId);
        if (error) throw error;
        
        showToast("Floor assignments saved!", "success");
        closeModal("floorAssignmentModal");
        openUsersModal();
    } catch (err) {
        console.error("Error saving floor assignments:", err);
        showToast("Failed to save floor assignments.", "error");
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

// ==========================================
// DYNAMIC ROLE MANAGEMENT (CRUD)
// ==========================================

const PERMISSION_GROUPS = [
    {
        label: 'Dashboard', actions: [
            { perm: 'dashboard:view', col: 'view', label: 'View' }
        ]
    },
    {
        label: 'Income', actions: [
            { perm: 'income:create', col: 'add', label: 'Add' },
            { perm: 'income:delete', col: 'delete', label: 'Delete' }
        ]
    },
    {
        label: 'Expense', actions: [
            { perm: 'expense:create', col: 'add', label: 'Add' },
            { perm: 'expense:delete', col: 'delete', label: 'Delete' }
        ]
    },
    {
        label: 'History', actions: [
            { perm: 'history:view', col: 'view', label: 'View' }
        ]
    },
    {
        label: 'Reports', actions: [
            { perm: 'reports:view', col: 'view', label: 'View' }
        ]
    },
    {
        label: 'Ledger', actions: [
            { perm: 'ledger:import', col: 'other', label: 'Import' },
            { perm: 'ledger:export', col: 'other', label: 'Export' }
        ]
    },
    {
        label: 'Owners', actions: [
            { perm: 'owners:upload', col: 'other', label: 'Upload' },
            { perm: 'owners:edit_any', col: 'edit', label: 'Edit Any' },
            { perm: 'owners:edit_own', col: 'other', label: 'Edit Own' }
        ]
    },
    {
        label: 'Expense Heads', actions: [
            { perm: 'expense_heads:manage', col: 'other', label: 'Access' },
            { perm: 'expense_heads:create', col: 'add', label: 'Add' },
            { perm: 'expense_heads:delete', col: 'delete', label: 'Delete' }
        ]
    },
    {
        label: 'Users', actions: [
            { perm: 'users:manage', col: 'other', label: 'View List' },
            { perm: 'users:role_change', col: 'other', label: 'Change Role' }
        ]
    },
    {
        label: 'Tickets', actions: [
            { perm: 'tickets:assign', col: 'other', label: 'Assign' },
            { perm: 'tickets:recommend', col: 'other', label: 'Recommend' },
            { perm: 'tickets:approve', col: 'approve', label: 'Approve' },
            { perm: 'tickets:resolve', col: 'other', label: 'Resolve' },
            { perm: 'tickets:close', col: 'other', label: 'Close' },
            { perm: 'tickets:reopen', col: 'other', label: 'Reopen' },
            { perm: 'tickets:archive', col: 'other', label: 'Archive' },
            { perm: 'tickets:delete', col: 'delete', label: 'Delete' },
            { perm: 'tickets:comment', col: 'other', label: 'Comment' }
        ]
    },
    {
        label: 'Events', actions: [
            { perm: 'events:view', col: 'view', label: 'View' },
            { perm: 'events:create', col: 'add', label: 'Create' },
            { perm: 'events:delete', col: 'delete', label: 'Delete' },
            { perm: 'events:contribute', col: 'other', label: 'Contribute' },
            { perm: 'events:perform', col: 'other', label: 'Perform' },
            { perm: 'events:manage_vendors', col: 'other', label: 'Vendors' },
            { perm: 'events:manage_competitions', col: 'other', label: 'Competitions' },
            { perm: 'events:vote', col: 'other', label: 'Vote' },
            { perm: 'events:score', col: 'other', label: 'Score' },
            { perm: 'events:upload_gallery', col: 'other', label: 'Gallery' },
            { perm: 'events:generate_passes', col: 'other', label: 'Passes' }
        ]
    },
    {
        label: 'Community Board', actions: [
            { perm: 'board:view', col: 'view', label: 'View' },
            { perm: 'board:create', col: 'add', label: 'Post' },
            { perm: 'board:moderate', col: 'other', label: 'Moderate' }
        ]
    },
    {
        label: 'Committee', actions: [
            { perm: 'committee:view', col: 'view', label: 'View' },
            { perm: 'committee:manage', col: 'edit', label: 'Manage' }
        ]
    },
    {
        label: 'Meetings', actions: [
            { perm: 'meetings:view', col: 'view', label: 'View' },
            { perm: 'meetings:create', col: 'add', label: 'Create' },
            { perm: 'meetings:manage', col: 'edit', label: 'Manage' }
        ]
    },
    {
        label: 'Resolutions', actions: [
            { perm: 'resolutions:view', col: 'view', label: 'View' }
        ]
    },
    {
        label: 'Documents', actions: [
            { perm: 'documents:view', col: 'view', label: 'View' },
            { perm: 'documents:upload', col: 'add', label: 'Upload' },
            { perm: 'documents:delete', col: 'delete', label: 'Delete' }
        ]
    },
    {
        label: 'Compliance', actions: [
            { perm: 'compliance:view', col: 'view', label: 'View' },
            { perm: 'compliance:create', col: 'add', label: 'Create' },
            { perm: 'compliance:manage', col: 'edit', label: 'Manage' }
        ]
    },
    {
        label: 'Vendors', actions: [
            { perm: 'vendors:view', col: 'view', label: 'View' },
            { perm: 'vendors:create', col: 'add', label: 'Create' },
            { perm: 'vendors:manage', col: 'edit', label: 'Manage' }
        ]
    },
    {
        label: 'Visitors', actions: [
            { perm: 'visitors:view', col: 'view', label: 'View' },
            { perm: 'visitors:create', col: 'add', label: 'Create' },
            { perm: 'visitors:approve', col: 'approve', label: 'Approve' }
        ]
    },
    {
        label: 'Assets', actions: [
            { perm: 'assets:view', col: 'view', label: 'View' },
            { perm: 'assets:create', col: 'add', label: 'Create' },
            { perm: 'assets:manage', col: 'edit', label: 'Manage' }
        ]
    },
    {
        label: 'Polls', actions: [
            { perm: 'polls:view', col: 'view', label: 'View' },
            { perm: 'polls:create', col: 'add', label: 'Create' },
            { perm: 'polls:vote', col: 'other', label: 'Vote' }
        ]
    },
    {
        label: 'Parking', actions: [
            { perm: 'parking:view', col: 'view', label: 'View' },
            { perm: 'parking:assign', col: 'edit', label: 'Assign' },
            { perm: 'parking:manage', col: 'edit', label: 'Manage' }
        ]
    },
    {
        label: 'Handover', actions: [
            { perm: 'handover:view', col: 'view', label: 'View' },
            { perm: 'handover:create', col: 'add', label: 'Create' }
        ]
    },
    {
        label: 'Analytics', actions: [
            { perm: 'analytics:view', col: 'view', label: 'View' }
        ]
    },
    {
        label: 'Maintenance', actions: [
            { perm: 'maintenance:view', col: 'view', label: 'View' },
            { perm: 'maintenance:manage_rates', col: 'edit', label: 'Rates' },
            { perm: 'maintenance:collect', col: 'add', label: 'Collect' }
        ]
    },
    {
        label: 'Security', actions: [
            { perm: 'security:view', col: 'view', label: 'View' },
            { perm: 'security:manage', col: 'edit', label: 'Manage' }
        ]
    }
];

const ALL_PERMISSIONS = [];
PERMISSION_GROUPS.forEach(g => {
    g.actions.forEach(a => {
        ALL_PERMISSIONS.push({ id: a.perm, label: g.label + ' — ' + a.label, group: g.label, col: a.col });
    });
});

const MATRIX_COLUMNS = [
    { key: 'view', label: 'View' },
    { key: 'add', label: 'Add' },
    { key: 'edit', label: 'Edit' },
    { key: 'delete', label: 'Delete' },
    { key: 'approve', label: 'Approve' },
    { key: 'other', label: 'Other' }
];

window.openRolesModal = async function() {
    if (!hasPermission('users:role_change')) {
        showToast("Access Denied.", "error");
        return;
    }
    await loadRoles();
    renderRolesManager();
    openModal('rolesModal');
};

function renderRolesManager() {
    const container = document.getElementById("roles-manager-list");
    if (!container) return;
    
    if (rolesData.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">No roles defined.</div>';
        return;
    }
    
    container.innerHTML = '';
    rolesData.forEach(role => {
        const card = document.createElement("div");
        card.className = "category-item";
        card.style.flexDirection = "column";
        card.style.alignItems = "stretch";
        card.style.padding = "12px";
        card.style.marginBottom = "8px";
        
        const permSet = new Set(role.permissions || []);
        const permCount = permSet.size;
        const groupSummary = PERMISSION_GROUPS.map(g => {
            const active = g.actions.filter(a => permSet.has(a.perm));
            return active.length > 0 ? `${g.label}(${active.map(a => a.label).join(',')})` : null;
        }).filter(Boolean).join(' · ');
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <div>
                    <strong style="color: var(--text-primary); font-size: 0.95rem;">${role.label || role.name}</strong>
                    <code style="margin-left: 8px; font-size: 0.7rem; color: var(--text-muted);">${role.name}</code>
                    <span class="badge badge-income" style="margin-left: 8px; font-size: 0.6rem; padding: 1px 6px;">${permCount}</span>
                </div>
                <div style="display: flex; gap: 6px;">
                    <button class="btn btn-indigo" style="padding: 4px 10px; font-size: 0.7rem;" onclick="openEditRoleModal('${role.name}')">
                        <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    ${role.name !== 'admin' ? `<button class="btn btn-rose" style="padding: 4px 10px; font-size: 0.7rem;" onclick="handleDeleteRole('${role.name}')">
                        <i class="fa-solid fa-trash-can"></i> Delete
                    </button>` : ''}
                </div>
            </div>
            <div style="font-size: 0.7rem; color: var(--text-secondary); line-height: 1.5;">
                ${groupSummary || '<em>No permissions</em>'}
            </div>
        `;
        container.appendChild(card);
    });
}

window.openAddRoleModal = function() {
    const modal = document.getElementById("editRoleModal");
    if (!modal) return;
    
    document.getElementById("edit-role-mode").value = "add";
    document.getElementById("edit-role-original-name").value = "";
    document.getElementById("edit-role-name").value = "";
    document.getElementById("edit-role-label").value = "";
    document.getElementById("edit-role-color").value = "var(--text-secondary)";
    
    // Build permission checkboxes
    renderPermissionCheckboxes([]);
    
    document.getElementById("edit-role-modal-title").textContent = "Add New Role";
    openModal("editRoleModal");
};

window.openEditRoleModal = function(roleName) {
    const role = rolesData.find(r => r.name === roleName);
    if (!role) return;
    
    const modal = document.getElementById("editRoleModal");
    if (!modal) return;
    
    document.getElementById("edit-role-mode").value = "edit";
    document.getElementById("edit-role-original-name").value = role.name;
    document.getElementById("edit-role-name").value = role.name;
    document.getElementById("edit-role-label").value = role.label || '';
    document.getElementById("edit-role-color").value = role.color || 'var(--text-secondary)';
    
    renderPermissionCheckboxes(role.permissions || []);
    
    document.getElementById("edit-role-modal-title").textContent = "Edit Role";
    openModal("editRoleModal");
};

function renderPermissionCheckboxes(selectedPerms) {
    const container = document.getElementById("edit-role-permissions");
    if (!container) return;
    
    container.innerHTML = '';
    
    // Build matrix header
    let headerHtml = '<div style="display:flex; align-items:center; padding:8px 0; border-bottom:1px solid var(--border-color); font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">';
    headerHtml += '<div style="width:130px; flex-shrink:0;">Module</div>';
    MATRIX_COLUMNS.forEach(col => {
        headerHtml += `<div style="flex:1; text-align:center;">${col.label}</div>`;
    });
    headerHtml += '</div>';
    container.innerHTML = headerHtml;
    
    // Build matrix rows
    PERMISSION_GROUPS.forEach(group => {
        const row = document.createElement("div");
        row.style.cssText = 'display:flex; align-items:stretch; border-bottom:1px solid rgba(255,255,255,0.04);';
        
        const labelCell = document.createElement("div");
        labelCell.style.cssText = 'width:130px; flex-shrink:0; padding:10px 4px; font-size:0.82rem; font-weight:600; color:var(--text-primary); display:flex; align-items:center;';
        labelCell.textContent = group.label;
        row.appendChild(labelCell);
        
        const colMap = {};
        MATRIX_COLUMNS.forEach(c => { colMap[c.key] = []; });
        group.actions.forEach(a => {
            if (colMap[a.col]) colMap[a.col].push(a);
        });
        
        MATRIX_COLUMNS.forEach(col => {
            const cell = document.createElement("div");
            cell.style.cssText = 'flex:1; text-align:center; padding:8px 2px; display:flex; flex-direction:column; align-items:center; gap:4px; justify-content:center;';
            
            const items = colMap[col.key] || [];
            if (items.length === 0) {
                cell.innerHTML = '<span style="color:var(--text-muted); font-size:0.6rem;">—</span>';
            } else {
                items.forEach(a => {
                    const checked = selectedPerms.includes(a.perm) ? 'checked' : '';
                    const labelId = `perm-${a.perm}`;
                    const wrapper = document.createElement("label");
                    wrapper.style.cssText = 'display:inline-flex; align-items:center; gap:3px; cursor:pointer; font-size:0.65rem; color:var(--text-secondary); white-space:nowrap;';
                    wrapper.htmlFor = labelId;
                    wrapper.innerHTML = `
                        <input type="checkbox" id="${labelId}" value="${a.perm}" ${checked} style="accent-color:var(--color-indigo); margin:0; width:12px; height:12px;">
                        ${a.label}
                    `;
                    cell.appendChild(wrapper);
                });
            }
            row.appendChild(cell);
        });
        
        container.appendChild(row);
    });
}

window.handleSaveRole = async function(e) {
    e.preventDefault();
    if (!sbClient) return;
    if (!hasPermission('users:role_change')) {
        showToast("Access Denied.", "error");
        return;
    }
    
    const mode = document.getElementById("edit-role-mode").value;
    const originalName = document.getElementById("edit-role-original-name").value;
    const name = document.getElementById("edit-role-name").value.trim();
    const label = document.getElementById("edit-role-label").value.trim();
    const color = document.getElementById("edit-role-color").value.trim();
    
    // Gather selected permissions
    const checkboxes = document.querySelectorAll("#edit-role-permissions input[type='checkbox']:checked");
    const permissions = Array.from(checkboxes).map(cb => cb.value);
    
    if (!name || !label) {
        showToast("Role name and label are required.", "error");
        return;
    }
    
    const btn = e.target.querySelector("button[type=submit]");
    if (btn) { btn.disabled = true; btn.textContent = "Saving..."; }
    
    try {
        if (mode === "add") {
            // Insert new role
            const { error } = await sbClient.from('roles').insert({
                name: name,
                label: label,
                permissions: permissions,
                color: color || 'var(--text-secondary)',
                priority: rolesData.length > 0 ? Math.min(...rolesData.map(r => r.priority || 0)) - 10 : 0
            });
            if (error) throw error;
            showToast(`Role "${label}" created!`, "success");
        } else {
            // Update existing role
            const { error } = await sbClient.from('roles')
                .update({
                    name: name,
                    label: label,
                    permissions: permissions,
                    color: color || 'var(--text-secondary)'
                })
                .eq('name', originalName);
            if (error) throw error;
            showToast(`Role "${label}" updated!`, "success");
        }
        
        closeModal('editRoleModal');
        await loadRoles();
        renderRolesManager();
        
        // Re-apply RBAC for current user in case their role's permissions changed
        applyRbacRestrictions(currentUserRole);
        
    } catch (err) {
        console.error("handleSaveRole error:", err);
        showToast(err.message || "Failed to save role.", "error");
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Role'; }
    }
};

window.handleDeleteRole = async function(roleName) {
    if (!sbClient) return;
    if (!hasPermission('users:role_change')) {
        showToast("Access Denied.", "error");
        return;
    }
    
    if (roleName === 'admin') {
        showToast("Cannot delete the default admin role.", "error");
        return;
    }
    
    const role = rolesData.find(r => r.name === roleName);
    if (!role) return;
    
    if (!confirm(`Are you sure you want to delete the role "${role.label || roleName}"?\n\nUsers with this role will retain it but lose all associated permissions until reassigned.`)) {
        return;
    }
    
    try {
        const { error } = await sbClient.from('roles').delete().eq('name', roleName);
        if (error) throw error;
        
        showToast(`Role "${role.label || roleName}" deleted.`, "success");
        await loadRoles();
        renderRolesManager();
        applyRbacRestrictions(currentUserRole);
    } catch (err) {
        console.error("handleDeleteRole error:", err);
        showToast(err.message || "Failed to delete role.", "error");
    }
};
