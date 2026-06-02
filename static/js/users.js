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

const ALL_PERMISSIONS = [
    { id: 'dashboard:view', label: 'View Dashboard' },
    { id: 'income:create', label: 'Record Income' },
    { id: 'income:delete', label: 'Delete Income' },
    { id: 'expense:create', label: 'Record Expense' },
    { id: 'expense:delete', label: 'Delete Expense' },
    { id: 'history:view', label: 'View Ledger History' },
    { id: 'reports:view', label: 'View Reports' },
    { id: 'ledger:import', label: 'Import Ledger' },
    { id: 'ledger:export', label: 'Export Ledger' },
    { id: 'owners:upload', label: 'Upload Owners' },
    { id: 'owners:edit_any', label: 'Edit Any Owner Profile' },
    { id: 'owners:edit_own', label: 'Edit Own Profile' },
    { id: 'expense_heads:manage', label: 'Access Expense Heads' },
    { id: 'expense_heads:create', label: 'Add Expense Heads' },
    { id: 'expense_heads:delete', label: 'Delete Expense Heads' },
    { id: 'users:manage', label: 'View Users List' },
    { id: 'users:role_change', label: 'Change User Roles' },
    { id: 'tickets:assign', label: 'Assign Tickets' },
    { id: 'tickets:recommend', label: 'Recommend Tickets' },
    { id: 'tickets:approve', label: 'Approve Tickets' },
    { id: 'tickets:resolve', label: 'Resolve Tickets' },
    { id: 'tickets:close', label: 'Close Tickets' },
    { id: 'tickets:reopen', label: 'Reopen Tickets' },
    { id: 'tickets:archive', label: 'Archive/View Archived' },
    { id: 'tickets:delete', label: 'Delete Tickets' },
    { id: 'tickets:comment', label: 'Comment on Tickets' },
    { id: 'events:view', label: 'View Cultural Events' },
    { id: 'events:create', label: 'Create/Edit Events' },
    { id: 'events:delete', label: 'Delete Events' },
    { id: 'events:contribute', label: 'Contribute to Events' },
    { id: 'events:perform', label: 'Register Performances' },
    { id: 'events:manage_vendors', label: 'Manage Vendors/Stalls' },
    { id: 'events:manage_competitions', label: 'Manage Competitions' },
    { id: 'events:vote', label: 'Vote in Competitions' },
    { id: 'events:score', label: 'Score as Judge' },
    { id: 'events:upload_gallery', label: 'Upload Gallery Photos' },
    { id: 'events:generate_passes', label: 'Generate Visitor Passes' },
    { id: 'board:view', label: 'View Community Board' },
    { id: 'board:create', label: 'Create Board Posts' },
    { id: 'board:moderate', label: 'Moderate Board (Delete/Close any post)' },
    { id: 'committee:view', label: 'View Committee Members' },
    { id: 'committee:manage', label: 'Manage Committee (Assign/Remove Members)' },
    { id: 'meetings:view', label: 'View Meetings & Resolutions' },
    { id: 'meetings:create', label: 'Create/Edit Meetings' },
    { id: 'meetings:manage', label: 'Manage Meetings (Attendance, Upload MoM)' },
    { id: 'resolutions:view', label: 'View Resolution Ledger' },
    { id: 'documents:view', label: 'View Document Vault' },
    { id: 'documents:upload', label: 'Upload Documents' },
    { id: 'documents:delete', label: 'Delete Documents' },
    { id: 'compliance:view', label: 'View Compliance Calendar' },
    { id: 'compliance:create', label: 'Create/Edit Compliance Events' },
    { id: 'compliance:manage', label: 'Manage Compliance Events (Mark Complete/Override)' },
    { id: 'vendors:view', label: 'View Vendors & Contracts' },
    { id: 'vendors:create', label: 'Create/Edit Vendors' },
    { id: 'vendors:manage', label: 'Manage Vendors (Terminate/Activate)' },
    { id: 'visitors:view', label: 'View Visitor Passes' },
    { id: 'visitors:create', label: 'Create Visitor Passes' },
    { id: 'visitors:approve', label: 'Approve/Check-in Passes' },
    { id: 'assets:view', label: 'View Asset Inventory' },
    { id: 'assets:create', label: 'Create/Edit Assets' },
    { id: 'assets:manage', label: 'Manage Assets (Maintenance/Status)' },
    { id: 'polls:view', label: 'View Polls & Surveys' },
    { id: 'polls:create', label: 'Create Polls & Surveys' },
    { id: 'polls:vote', label: 'Vote in Polls' },
    { id: 'parking:view', label: 'View Parking Slots' },
    { id: 'parking:assign', label: 'Assign/Manage Parking Slots' },
    { id: 'parking:manage', label: 'Manage Parking (Status/Setup)' },
    { id: 'handover:view', label: 'View Committee Handover' },
    { id: 'handover:create', label: 'Create/Manage Handover' },
    { id: 'analytics:view', label: 'View Dashboard Analytics' }
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
        
        const permCount = (role.permissions || []).length;
        const permLabels = role.permissions.map(p => {
            const found = ALL_PERMISSIONS.find(ap => ap.id === p);
            return found ? found.label : p;
        }).join(', ');
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <div>
                    <strong style="color: var(--text-primary); font-size: 0.95rem;">${role.label || role.name}</strong>
                    <code style="margin-left: 8px; font-size: 0.7rem; color: var(--text-muted);">${role.name}</code>
                    <span class="badge badge-income" style="margin-left: 8px; font-size: 0.6rem; padding: 1px 6px;">${permCount} permissions</span>
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
            <div style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.5;">
                ${permLabels || '<em>No permissions</em>'}
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
    ALL_PERMISSIONS.forEach(perm => {
        const checked = selectedPerms.includes(perm.id) ? 'checked' : '';
        const div = document.createElement("div");
        div.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 4px 0;';
        div.innerHTML = `
            <input type="checkbox" id="perm-${perm.id}" value="${perm.id}" ${checked} style="accent-color: var(--color-indigo);">
            <label for="perm-${perm.id}" style="font-size: 0.85rem; cursor: pointer; color: var(--text-primary);">${perm.label}</label>
        `;
        container.appendChild(div);
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
