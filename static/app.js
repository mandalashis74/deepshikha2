// JavaScript Controller - Multi-Building Residence Management (Vite + Supabase Serverless with RBAC)

window.sbClient = null;
let loadedEntries = [];
let activeReportTab = 'date-wise-cashbook';
window.currentUserRole = 'viewer';
window.currentUserId = null;
window.currentUserEmail = null;
window.currentUserName = '';
let loadedTickets = [];
let selectedTicketId = null;
let ticketScope = 'ALL';
window.rolesData = [];
window.currentRolePermissions = [];
let currentUserAssignedFloors = [];
window.buildingConfig = null;
window.googlePickerReady = false;
window.gdrivePickerInited = false;

// Default building config fallback
const DEFAULT_BUILDING_CONFIG = {
    building_name: 'My Residency',
    block_name: '',
    address: '',
    google_api_key: '',
    google_client_id: '',
    vapid_public_key: '',
    vapid_private_key: '',
    floors: 8,
    wings: 'A,B,C,D,E,F,G,H',
    flat_types: '1BHK,2BHK,3BHK',
    dashboard_bg_url: '',
    flat_include_block: false,
    flat_include_wing: false,
    flat_include_floor: true,
    flat_include_wing_letter: true,
    flat_delimiter: '',
    flat_exceptions: ''
};
window.DEFAULT_BUILDING_CONFIG = DEFAULT_BUILDING_CONFIG;

window.getWingsList = function() {
    return (buildingConfig?.wings || DEFAULT_BUILDING_CONFIG.wings).split(',').map(s => s.trim()).filter(Boolean);
};

window.getFlatTypesList = function() {
    return (buildingConfig?.flat_types || DEFAULT_BUILDING_CONFIG.flat_types).split(',').map(s => s.trim()).filter(Boolean);
};

window.getFloorCount = function() {
    return buildingConfig?.floors || DEFAULT_BUILDING_CONFIG.floors;
};

window.getBuildingName = function() {
    return buildingConfig?.building_name || DEFAULT_BUILDING_CONFIG.building_name;
};

window.getBlockName = function() {
    return buildingConfig?.block_name || '';
};

window.getAllFlats = function() {
    const floors = window.getFloorCount();
    const wings = window.getWingsList();
    const cfg = window.buildingConfig || DEFAULT_BUILDING_CONFIG;
    const delim = cfg.flat_delimiter || '';
    const blockName = cfg.flat_include_block && cfg.block_name ? cfg.block_name.trim() : '';
    const exceptions = cfg.flat_exceptions ? cfg.flat_exceptions.split(',').map(s => s.trim()).filter(Boolean) : [];
    const flats = [];
    for (let f = 1; f <= floors; f++) {
        wings.forEach((w, wi) => {
            let parts = [];
            if (blockName) parts.push(blockName);
            if (cfg.flat_include_wing) parts.push(String(wi + 1));
            if (cfg.flat_include_floor) parts.push(String(f));
            if (cfg.flat_include_wing_letter) parts.push(w);
            let flatNo = parts.join(delim);
            // If no components selected, fallback to floor+wing
            if (!flatNo) flatNo = `${f}${w}`;
            flats.push(flatNo);
        });
    }
    // Apply exceptions: replace generated flats with custom ones if provided
    if (exceptions.length > 0) {
        // Exceptions replace flats at corresponding indices (or append)
        exceptions.forEach((ex, i) => {
            if (i < flats.length) flats[i] = ex;
            else flats.push(ex);
        });
    }
    return flats;
};

window.updateBuildingUI = function() {
    const name = window.getBuildingName();
    const block = window.getBlockName();
    const fullName = block ? `${name} (${block})` : name;
    
    const sidebarName = document.getElementById('sidebar-building-name');
    if (sidebarName) sidebarName.textContent = name.toUpperCase();
    
    const sidebarSub = document.getElementById('sidebar-building-sub');
    if (sidebarSub) sidebarSub.textContent = block ? `${block} - Residence Management` : 'Residence Management';
    
    const authName = document.getElementById('auth-building-name');
    if (authName) authName.textContent = fullName.toUpperCase();
    
    const authSub = document.getElementById('auth-building-sub');
    if (authSub) authSub.textContent = block ? `${block} - Flat Owners Portal` : 'Flat Owners Portal';
    
    document.title = `${name} - Residence Management`;
    const workspace = document.querySelector('.workspace');
    if (workspace) {
        const bgUrl = buildingConfig?.dashboard_bg_url || '';
        if (bgUrl) {
            workspace.style.setProperty('--dash-bg', `url('${bgUrl}')`);
            workspace.classList.add('has-bg');
        } else {
            workspace.style.removeProperty('--dash-bg');
            workspace.classList.remove('has-bg');
        }
    }
    renderLavishDashboard();
};

// ==========================================
// LAVISH DASHBOARD
// ==========================================

function renderLavishDashboard() {
    const now = new Date();
    const hour = now.getHours();
    let greet = 'Good Evening';
    if (hour < 12) greet = 'Good Morning';
    else if (hour < 17) greet = 'Good Afternoon';
    
    const greetEl = document.getElementById('dashboard-greeting');
    if (greetEl) greetEl.textContent = greet + '!';
    const nameEl = document.getElementById('dashboard-building-name');
    if (nameEl) nameEl.textContent = window.getBuildingName().toUpperCase();
    const dtEl = document.getElementById('dashboard-date-time');
    if (dtEl) dtEl.textContent = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    
    window.loadDashStats();
}

window.loadDashStats = async function() {
    if (!sbClient) return;
    
    async function safeQuery(label, fn) {
        try { return await fn(); } catch (e) { console.warn('Dashboard stat [' + label + ']:', e); return null; }
    }
    
    const ownersResult = await safeQuery('owners', async () => {
        const { data } = await sbClient.from('owners').select('flat_no, occupancy_status');
        return data || [];
    });
    const owners = ownersResult || [];
    const totalFlats = owners.length;
    const occupied = owners.filter(o => o.occupancy_status && o.occupancy_status !== 'vacant').length;
    const ownerOcc = owners.filter(o => o.occupancy_status === 'owner-occupied').length;
    const tenantOcc = owners.filter(o => o.occupancy_status === 'tenant-occupied').length;
    const vacant = owners.filter(o => !o.occupancy_status || o.occupancy_status === 'vacant').length;
    
    document.getElementById('dash-total-flats').textContent = totalFlats;
    document.getElementById('dash-occupied-flats').textContent = occupied;
    
    const pct = n => totalFlats ? Math.round(n / totalFlats * 100) : 0;
    document.getElementById('dash-owner-pct').textContent = pct(ownerOcc) + '%';
    document.getElementById('dash-owner-bar').style.width = pct(ownerOcc) + '%';
    document.getElementById('dash-tenant-pct').textContent = pct(tenantOcc) + '%';
    document.getElementById('dash-tenant-bar').style.width = pct(tenantOcc) + '%';
    document.getElementById('dash-vacant-pct').textContent = pct(vacant) + '%';
    document.getElementById('dash-vacant-bar').style.width = pct(vacant) + '%';
    
    const eventsData = await safeQuery('events', async () => {
        const { data } = await sbClient.from('cultural_events')
            .select('id, name, start_date, status')
            .in('status', ['upcoming', 'active', 'ongoing'])
            .order('start_date', { ascending: true })
            .limit(5);
        return data || [];
    });
    const eventsList = eventsData || [];
    const activeEvents = eventsList.filter(e => e.status === 'active' || e.status === 'ongoing').length;
    document.getElementById('dash-active-events').textContent = activeEvents || eventsList.length;
    
    const eventsContainer = document.getElementById('dash-events-list');
    if (eventsList.length === 0) {
        eventsContainer.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; padding:12px; text-align:center;">No upcoming events</div>';
    } else {
        eventsContainer.innerHTML = eventsList.map(e => {
            const d = new Date(e.start_date + 'T00:00:00');
            const today = new Date();
            today.setHours(0,0,0,0);
            const diff = Math.ceil((d - today) / 86400000);
            return `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.04);">
                <div>
                    <div style="font-weight:600; font-size:0.9rem;">${e.name}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${d.toLocaleDateString('en-IN', { day:'numeric', month:'short' })}</div>
                </div>
                <span style="font-size:0.75rem; padding:2px 8px; border-radius:10px; background:rgba(99,102,241,0.1); color:var(--color-indigo);">
                    ${diff <= 0 ? 'Live' : diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : `${diff}d`}
                </span>
            </div>`;
        }).join('');
    }
    
    const ticketsResult = await safeQuery('tickets', async () => {
        const { data } = await sbClient.from('tickets')
            .select('id')
            .in('status', ['open', 'in_progress', 'pending_approval']);
        return (data || []).length;
    });
    document.getElementById('dash-open-tickets').textContent = ticketsResult ?? '-';
    
    const year = new Date().getFullYear().toString();
    const month = new Date().toLocaleString('en-US', { month: 'long' });
    const incomeResult = await safeQuery('income', async () => {
        const { data } = await sbClient.from('income')
            .select('amount')
            .eq('year', year)
            .eq('month', month);
        return (data || []).reduce((s, r) => s + Number(r.amount || 0), 0);
    });
    document.getElementById('dash-month-income').textContent = incomeResult !== null ? '₹' + incomeResult.toLocaleString('en-IN') : '-';
    
    const recentIncome = await safeQuery('recent_income', async () => {
        const { data } = await sbClient.from('income')
            .select('flat_no, amount, date_received, category')
            .order('date_received', { ascending: false })
            .limit(5);
        return data || [];
    });
    const recentExpense = await safeQuery('recent_expense', async () => {
        const { data } = await sbClient.from('expenses')
            .select('description, amount, date_spent')
            .order('date_spent', { ascending: false })
            .limit(5);
        return data || [];
    });
    const recentBoardPosts = await safeQuery('recent_board_posts', async () => {
        const { data } = await sbClient.from('community_posts')
            .select('title, owner_name, owner_flat_no, is_anonymous, created_at')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(5);
        return data || [];
    });
    
    const activity = [];
    (recentIncome || []).forEach(r => activity.push({
        icon: 'fa-arrow-trend-up',
        color: 'var(--color-emerald)',
        text: `Flat ${r.flat_no} — ${r.category}`,
        amount: `+₹${Number(r.amount).toLocaleString('en-IN')}`,
        date: r.date_received
    }));
    (recentExpense || []).forEach(r => activity.push({
        icon: 'fa-arrow-trend-down',
        color: 'var(--color-rose)',
        text: r.description?.substring(0, 40),
        amount: `-₹${Number(r.amount).toLocaleString('en-IN')}`,
        date: r.date_spent
    }));
    (recentBoardPosts || []).forEach(r => {
        const sender = r.is_anonymous
            ? 'Verified Resident'
            : `${window.displayStructured(r.owner_name, 'name') || 'Resident'}${r.owner_flat_no ? ' (' + r.owner_flat_no + ')' : ''}`;
        activity.push({
            icon: 'fa-message',
            color: 'var(--color-violet)',
            text: escapeHtml(r.title || 'Community message').substring(0, 45),
            amount: `by ${escapeHtml(sender)}`,
            date: r.created_at
        });
    });
    activity.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    
    const actContainer = document.getElementById('dash-recent-activity');
    if (activity.length === 0) {
        actContainer.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; padding:12px; text-align:center;">No recent activity</div>';
    } else {
        actContainer.innerHTML = activity.slice(0, 7).map(a => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.04);">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid ${a.icon}" style="color:${a.color}; width:16px;"></i>
                    <span style="font-size:0.85rem;">${a.text}</span>
                </div>
                <span style="font-weight:600; font-size:0.85rem; color:${a.color};">${a.amount}</span>
            </div>
        `).join('');
    }
};

window.loadBuildingConfig = async function() {
    if (!sbClient) return;
    try {
        const { data, error } = await sbClient.from('building_config').select('*').eq('id', 1).single();
        if (error && error.code === 'PGRST116') {
            window.buildingConfig = { ...DEFAULT_BUILDING_CONFIG };
            window.updateBuildingUI();
            return;
        }
        if (error) throw error;
        window.buildingConfig = data || { ...DEFAULT_BUILDING_CONFIG };
        if (buildingConfig.floors) buildingConfig.floors = parseInt(buildingConfig.floors, 10);
        window.updateBuildingUI();
        initGoogleDrivePicker();
    } catch (err) {
        console.warn("Could not load building config, using defaults:", err);
        window.buildingConfig = { ...DEFAULT_BUILDING_CONFIG };
        window.updateBuildingUI();
    }
};

window.saveBuildingConfig = async function(config) {
    if (!sbClient) return false;
    window.buildingConfig = config;
    try {
        if (buildingConfig.floors) buildingConfig.floors = parseInt(buildingConfig.floors, 10);
        await sbClient.from('building_config').upsert({
            id: 1,
            building_name: config.building_name,
            block_name: config.block_name,
            address: config.address,
            google_api_key: config.google_api_key,
            google_client_id: config.google_client_id,
            vapid_public_key: config.vapid_public_key,
            vapid_private_key: config.vapid_private_key,
            floors: parseInt(config.floors, 10) || 8,
            wings: config.wings,
            flat_types: config.flat_types,
            dashboard_bg_url: config.dashboard_bg_url,
            flat_include_block: config.flat_include_block || false,
            flat_include_wing: config.flat_include_wing || false,
            flat_include_floor: config.flat_include_floor !== false,
            flat_include_wing_letter: config.flat_include_wing_letter !== false,
            flat_delimiter: config.flat_delimiter || '',
            flat_exceptions: config.flat_exceptions || ''
        }, { onConflict: 'id' });
        initGoogleDrivePicker();
        window.updateBuildingUI();
        return true;
    } catch (err) {
        console.error("saveBuildingConfig error:", err);
        showToast("Failed to save building configuration.", "error");
        return false;
    }
};

// Generate floor options HTML for any select element
window.getFloorOptions = function(selectedFloor) {
    const count = window.getFloorCount();
    let html = '<option value="">All Floors</option>';
    for (let i = 1; i <= count; i++) {
        const sel = String(i) === String(selectedFloor) ? 'selected' : '';
        html += `<option value="${i}" ${sel}>Floor ${i}</option>`;
    }
    return html;
};

// Cultural Events module loaded from static/js/events.js


// Community Board module loaded from static/js/community-board.js

// --- AUTHENTICATION & SESSION CONTROLLERS ---

window.setupAuthListener = function() {
    if (!sbClient) return;
    
    sbClient.auth.onAuthStateChange((event, session) => {
        if (session) {
            window.currentUserId = session.user.id;
            window.currentUserEmail = session.user.email;
            window.currentUserName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email || '';
            
            setTimeout(async () => {
                try {
                    if (localStorage.getItem("isSoftLogin") === "true") {
                        const flatNo = localStorage.getItem("currentFlatNo");
                        await window.handleSoftUserSession(session.user, flatNo);
                    } else {
                        await window.handleUserSession(session.user);
                    }
                    document.getElementById("auth-container").style.display = "none";
                    const openTarget = new URLSearchParams(window.location.search).get('open');
                    if (openTarget === 'board' && window.hasPermission('board:view')) {
                        setTimeout(() => openBoardModal(), 200);
                        window.history.replaceState({}, document.title, window.location.pathname);
                    }
                } catch (err) {
                    console.error("Session initialization failed:", err);
                    localStorage.removeItem("isSoftLogin");
                    localStorage.removeItem("currentFlatNo");
                    await sbClient.auth.signOut();
                    
                    window.currentUserId = null;
                    document.getElementById("auth-container").style.display = "block";
                    const sideProfile = document.getElementById("side-user-profile");
                    if (sideProfile) sideProfile.style.display = "none";
                    window.currentUserRole = 'viewer';
                    window.applyRbacRestrictions('viewer');
                }
            }, 0);
        } else {
            if (localStorage.getItem("isSoftLogin") === "true") {
                const flatNo = localStorage.getItem("currentFlatNo");
                window.autoLoginSharedAccount(flatNo);
            } else {
                window.currentUserId = null;
                document.getElementById("auth-container").style.display = "block";
                const sideProfile = document.getElementById("side-user-profile");
                if (sideProfile) sideProfile.style.display = "none";
                window.currentUserRole = 'viewer';
                window.applyRbacRestrictions('viewer');
            }
        }
    });
};

window.handleUserSession = async function(user) {
    if (!sbClient) return;
    
    try {
        await window.loadRoles();
        
        let { data, error } = await sbClient.from('profiles').select('role, assigned_floors').eq('id', user.id).single();
        
        if (error) {
            console.warn("Profile fetching failed, retrying in 1s...", error);
            await new Promise(resolve => setTimeout(resolve, 1000));
            const retryRes = await sbClient.from('profiles').select('role, assigned_floors').eq('id', user.id).single();
            data = retryRes.data;
            if (retryRes.error) throw retryRes.error;
        }
        
        window.currentUserRole = data && data.role ? data.role.toLowerCase().trim() : "viewer";
        currentUserAssignedFloors = data && Array.isArray(data.assigned_floors) ? data.assigned_floors : [];
        
        const sideProfile = document.getElementById("side-user-profile");
        const sideEmail = document.getElementById("side-user-email");
        const sideRole = document.getElementById("side-user-role");
        
        if (sideProfile && sideEmail && sideRole) {
            sideEmail.textContent = user.email;
            sideRole.textContent = currentUserRole.toUpperCase();
            const roleColor = window.getRoleColor(currentUserRole);
            sideRole.className = "badge";
            sideRole.style.borderColor = roleColor.replace('var(', '').replace(')', '').trim()
                ? `rgba(255,255,255,0.2)` : 'var(--border-color)';
            sideRole.style.color = roleColor;
            sideProfile.style.display = "flex";
        }
        
        const notifBtn = document.getElementById('side-notif-toggle');
        if (notifBtn) {
            notifBtn.style.display = 'flex';
            updateNotificationBtn();
        }
        if (localStorage.getItem('pushSubscribed') === 'true' && buildingConfig?.vapid_public_key) {
            doSubscribe().catch(() => {});
        }
        
        window.applyRbacRestrictions(currentUserRole);
        
        if (currentUserId) {
            try {
                const { data: cm } = await sbClient.from('committee_members')
                    .select('position_id, committee_positions!inner(permissions_override)')
                    .eq('user_id', currentUserId)
                    .eq('is_active', true)
                    .maybeSingle();
                if (cm?.committee_positions?.permissions_override?.length) {
                    const overrides = cm.committee_positions.permissions_override;
                    overrides.forEach(p => { if (!currentRolePermissions.includes(p)) currentRolePermissions.push(p); });
                    window.applyRbacRestrictions(currentUserRole);
                }
            } catch (_) {}
        }
        
        await window.ensureOwnersPopulated();
        
        window.loadFlats();
        window.loadExpenseHeads();
        window.refreshDashboard();
    } catch (e) {
        console.error("handleUserSession error:", e);
        showToast("Error retrieving user profile role credentials.", "error");
    }
};

// Committee module loaded from static/js/committee.js

// ==========================================
// Meetings & Resolutions module loaded from static/js/meetings.js

window.rolesData = [];

window.loadRoles = async function() {
    if (!sbClient) return;
    try {
        const { data, error } = await sbClient.from('roles').select('*').order('priority', { ascending: false });
        if (error) {
            console.warn("Could not load roles from DB, using defaults:", error);
            window.rolesData = window.getDefaultRoles();
        } else if (data && data.length > 0) {
            const defaults = window.getDefaultRoles();
            window.rolesData = data.map(dbRole => {
                const def = defaults.find(d => d.name === dbRole.name);
                if (def) {
                    const merged = [...new Set([...(dbRole.permissions || []), ...def.permissions])];
                    return { ...dbRole, permissions: merged };
                }
                return dbRole;
            });
        } else {
            window.rolesData = window.getDefaultRoles();
        }
    } catch (e) {
        console.warn("Error loading roles, using defaults:", e);
        window.rolesData = window.getDefaultRoles();
    }
};

window.getDefaultRoles = function() {
    return [
        { name: 'admin', label: 'Administrator', permissions: ['dashboard:view','income:create','income:delete','expense:create','expense:delete','history:view','reports:view','ledger:import','ledger:export','owners:upload','owners:edit_any','owners:edit_own','expense_heads:manage','expense_heads:create','expense_heads:delete','users:manage','users:role_change','tickets:assign','tickets:recommend','tickets:approve','tickets:resolve','tickets:close','tickets:reopen','tickets:archive','tickets:delete','tickets:comment','events:view','events:create','events:delete','events:contribute','events:perform','events:manage_vendors','events:manage_competitions','events:vote','events:score','events:upload_gallery','events:generate_passes','board:view','board:create','board:moderate','committee:view','committee:manage','meetings:view','meetings:create','meetings:manage','resolutions:view','documents:view','documents:upload','documents:delete','compliance:view','compliance:create','compliance:manage','vendors:view','vendors:create','vendors:manage','visitors:view','visitors:create','visitors:approve','assets:view','assets:create','assets:manage','polls:view','polls:create','polls:vote','parking:view','parking:assign','parking:manage','handover:view','handover:create','analytics:view','maintenance:view','maintenance:manage_rates','maintenance:collect','security:view','security:manage','gate:view','gate:guard'], color: 'var(--color-emerald)' },
        { name: 'editor', label: 'Editor', permissions: ['dashboard:view','income:create','expense:create','history:view','reports:view','ledger:export','tickets:resolve','tickets:comment','board:view','board:create','board:moderate','meetings:view','resolutions:view'], color: 'var(--color-rose)' },
        { name: 'floor_manager', label: 'Floor Manager', permissions: ['dashboard:view','income:create','history:view','reports:view','tickets:recommend','tickets:comment','board:view','board:create','meetings:view','resolutions:view'], color: 'var(--color-yellow)' },
        { name: 'committee_member', label: 'Committee Member', permissions: ['dashboard:view','history:view','reports:view','tickets:approve','tickets:comment','board:view','board:create','board:moderate','committee:view','meetings:view','meetings:create','meetings:manage','resolutions:view','documents:view','documents:upload','compliance:view','compliance:create','compliance:manage','vendors:view','vendors:create','visitors:view','visitors:create','visitors:approve','assets:view','assets:create','assets:manage','polls:view','polls:create','polls:vote','parking:view','parking:assign','handover:view','handover:create','analytics:view','maintenance:view','maintenance:manage_rates','maintenance:collect','security:view','security:manage','gate:view','gate:guard'], color: 'var(--color-violet)' },
        { name: 'viewer', label: 'Viewer (Resident)', permissions: ['dashboard:view','owners:edit_own','tickets:comment','events:view','board:view','board:create','committee:view','meetings:view','resolutions:view','documents:view','compliance:view','vendors:view','visitors:view','visitors:create','assets:view','polls:view','polls:vote','parking:view','maintenance:view','security:view','gate:view'], color: 'var(--text-secondary)' }
    ];
};

window.hasPermission = function(perm) {
    return (window.currentRolePermissions || []).includes(perm);
};

window.getRoleData = function(roleName) {
    return (window.rolesData || []).find(r => r.name === roleName) || null;
};

window.getRoleColor = function(roleName) {
    const r = window.getRoleData(roleName);
    return r ? (r.color || 'var(--text-secondary)') : 'var(--text-secondary)';
};

window.getRoleLabel = function(roleName) {
    const r = window.getRoleData(roleName);
    return r ? (r.label || roleName) : roleName;
};

window.applyRbacRestrictions = function(role) {
    const roleData = window.getRoleData(role);
    window.currentRolePermissions = roleData ? [...roleData.permissions] : [];
    
    const setBlock = (id, show) => { const el = document.getElementById(id); if (el) el.style.display = show ? "block" : "none"; };
    const setNav = (id, show) => { const el = document.getElementById(id); if (el) el.style.display = show ? "flex" : "none"; };
    
    setNav("side-import", window.hasPermission('ledger:import'));
    setNav("side-owners-upload", window.hasPermission('owners:upload'));
    setNav("side-export", window.hasPermission('ledger:export'));
    setNav("side-manage-users", window.hasPermission('users:manage'));
    setNav("side-manage-roles", window.hasPermission('users:role_change'));
    setNav("side-building-config", role === 'admin');
    
    const canViewDashboard = window.hasPermission('dashboard:view');
    setNav("side-dashboard", true);
    setNav("side-finance", canViewDashboard && role !== 'viewer');
    setNav("side-history", canViewDashboard && window.hasPermission('history:view'));
    setNav("side-reports", canViewDashboard && window.hasPermission('reports:view'));
    setNav("side-directory", true);
    setNav("side-helpdesk", true);
    setNav("side-events", window.hasPermission('events:view'));
    setNav("side-board", window.hasPermission('board:view'));
    setNav("side-committee", window.hasPermission('committee:view'));
    setNav("side-meetings", window.hasPermission('meetings:view'));
    setNav("side-resolutions", window.hasPermission('resolutions:view'));
    setNav("side-documents", window.hasPermission('documents:view'));
    setNav("side-compliance", window.hasPermission('compliance:view'));
    setNav("side-vendors", window.hasPermission('vendors:view'));
    setNav("side-visitors", window.hasPermission('visitors:view'));
    setNav("side-gate", window.hasPermission('gate:view'));
    setNav("side-assets", window.hasPermission('assets:view'));
    setNav("side-polls", window.hasPermission('polls:view'));
    setNav("side-parking", window.hasPermission('parking:view'));
    setNav("side-handover", window.hasPermission('handover:view'));
    setNav("side-analytics", window.hasPermission('analytics:view'));
    
    const hideDash = (id, show) => { const el = document.getElementById(id); if (el) el.style.display = show ? "" : "none"; };
    hideDash("dash-collect-fee", window.hasPermission('income:create'));
    hideDash("dash-record-expense", window.hasPermission('expense:create'));
    hideDash("fin-collect-fee", window.hasPermission('income:create'));
    hideDash("fin-record-expense", window.hasPermission('expense:create'));
    hideDash("dash-board", window.hasPermission('board:view'));
    const setBtn = (id, show) => { const el = document.getElementById(id); if (el) el.style.display = show ? "" : "none"; };
    setBtn("btn-create-post", window.hasPermission('board:create'));
    
    const hasAdminAccess = window.hasPermission('users:manage') || window.hasPermission('users:role_change');
    setBlock("side-admin-label", hasAdminAccess);
    setBlock("side-admin-nav", hasAdminAccess);
    setNav("side-manage-committee", window.hasPermission('committee:manage'));
    
    setBlock("workspace", canViewDashboard);
    
    if (loadedEntries.length > 0) {
        window.renderTable(loadedEntries);
    }

    // Collapse all groups by default
    document.querySelectorAll('.collapse-wrap').forEach(function(wrap) {
        wrap.classList.add('collapsed');
        var header = wrap.previousElementSibling;
        if (header && header.classList.contains('collapse-header')) {
            header.classList.add('collapsed');
        }
    });
};

// ==========================================
// FLOOR-MANAGER: ASSIGNED FLOORS SYSTEM
// ==========================================

window.getFlatFloor = function(flatNo) {
    if (!flatNo) return null;
    const match = flatNo.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : null;
};

window.isFlatAccessible = function(flatNo) {
    if (currentUserAssignedFloors.length === 0) return true;
    const floor = window.getFlatFloor(flatNo);
    return floor !== null && currentUserAssignedFloors.includes(floor);
};

window.filterFlatsByAssignment = function(data) {
    if (currentUserAssignedFloors.length === 0) return data;
    return data.filter(item => window.isFlatAccessible(item.flat_no));
};

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
window.ensureOwnersPopulated = async function() {
    if (!sbClient) return;
    try {
        const { data, error } = await sbClient.from('owners').select('flat_no').limit(1);
        if (error) throw error;
        
        if (!data || data.length === 0) {
            const defaultOwners = [];
            const allFlats = window.getAllFlats();
            allFlats.forEach(flat_no => {
                defaultOwners.push({
                    flat_no: flat_no,
                    owner_name: `Flat ${flat_no}`,
                    contact_no: ''
                });
            });
            if (defaultOwners.length > 0) {
                const { error: insertError } = await sbClient.from('owners').insert(defaultOwners);
                if (insertError) throw insertError;
                console.log("Building owner mappings seeded successfully!");
            }
        }
    } catch (e) {
        console.error("ensureOwnersPopulated error:", e);
    }
};

// Load dropdown flats from Supabase owners registry
window.loadFlats = async function() {
    if (!sbClient) return;
    try {
        let { data, error } = await sbClient.from('owners').select('flat_no, owner_name').order('flat_no');
        if (error) throw error;
        
        data = window.filterFlatsByAssignment(data);
        
        const flatSelect = document.getElementById("inc-flat");
        const histFlat = document.getElementById("hist-flat");
        
        const currentVal = flatSelect ? flatSelect.value : "";
        const currentHistVal = histFlat ? histFlat.value : "ALL";
        
        if (flatSelect) {
            flatSelect.innerHTML = '<option value="" disabled selected>Select Room & Tenant</option>';
            data.forEach(item => {
                const opt = document.createElement("option");
                const ownerDisp = window.displayStructured(item.owner_name, 'name');
                const label = `${item.flat_no} - ${ownerDisp || 'Unknown'}`;
                opt.value = label;
                opt.textContent = label;
                flatSelect.appendChild(opt);
            });
            if (currentVal && data.some(item => `${item.flat_no} - ${window.displayStructured(item.owner_name, 'name') || 'Unknown'}` === currentVal)) {
                flatSelect.value = currentVal;
            }
        }
        
        if (histFlat) {
            histFlat.innerHTML = '<option value="ALL">All Flats</option>';
            data.forEach(item => {
                const opt = document.createElement("option");
                opt.value = item.flat_no;
                opt.textContent = `${item.flat_no} - ${window.displayStructured(item.owner_name, 'name') || 'Unknown'}`;
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
                    return;
                }
                const opt = document.createElement("option");
                opt.value = item.flat_no;
                opt.textContent = `${item.flat_no} - ${window.displayStructured(item.owner_name, 'name') || 'Unknown'}`;
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

window.renderTable = function(entries) {
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

        const canDelete = (entry.type === "INCOME" && window.hasPermission('income:delete')) || (entry.type === "EXPENSE" && window.hasPermission('expense:delete'));
        const deleteButton = canDelete
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
            <td class="text-center">${window.formatDateDisplay(entry.date)}</td>
            <td class="text-center">
                ${actions}
                ${deleteButton}
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.filterTable = function() {
    const query = document.getElementById("table-search").value.toLowerCase().trim();
    if (!query) {
        window.renderTable(loadedEntries);
        return;
    }

    const filtered = loadedEntries.filter(entry => {
        return entry.description.toLowerCase().includes(query) || 
               entry.type.toLowerCase().includes(query) ||
               String(entry.id).includes(query);
    });
    window.renderTable(filtered);
};

// Refresh dashboard stats and statements list
window.refreshDashboard = async function() {
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
        
        document.getElementById("stat-income").textContent = formatCurrency(totalIncome);
        document.getElementById("stat-expense").textContent = formatCurrency(totalExpense);
        document.getElementById("stat-cash").textContent = formatCurrency(cashInHand);

        const entries = [];
        
        incomeData.forEach(r => {
            let desc = `Flat ${r.flat_no} Maintenance Fee`;
            if (r.category === 'Special Event') {
                desc = `Flat ${r.flat_no} ${r.event_name} Subscription`;
            } else if (r.category === 'Cultural Event') {
                desc = `Flat ${r.flat_no} ${r.event_name} Contribution`;
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
        
        window.renderTable(loadedEntries);
        
        const exportBtn = document.getElementById("side-export");
        if (exportBtn) {
            exportBtn.onclick = (e) => {
                e.preventDefault();
                exportLedgerToExcel();
            };
        }

    } catch (err) {
        console.error("Dashboard refresh error:", err);
        showToast("Error loading financial dashboard.", "error");
    }
};

// Format number to currency (e.g. 1500 -> Rs. 1,500.00)
window.formatCurrency = function(val) {
    return "₹" + Number(val).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

window.showToast = function(message, type = "success", actionBtn = null) {
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
    setTimeout(() => {
        toast.style.animation = "slideInRight 0.3s ease reverse";
        setTimeout(() => { toast.remove(); }, 300);
    }, 4000);
};

window.escapeHtml = function(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

window.displayStructured = function(value, key) {
    if (!value) return '';
    if (typeof value === 'string') {
        try { value = JSON.parse(value); } catch (e) { return value; }
    }
    if (Array.isArray(value)) {
        return value.map(o => o[key] || '').filter(Boolean).join(', ');
    }
    return String(value);
};

let _modalZIndex = 100;
window.openModal = function(modalId) {
    const el = document.getElementById(modalId);
    if (!el) return;
    el.style.display = 'block';
    _modalZIndex += 10;
    el.style.zIndex = _modalZIndex;
    el.onclick = function(e) {
        if (e.target === el) closeModal(modalId);
    };
};

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.style.display = "none";
    modal.onclick = null;
    const form = modal.querySelector("form");
    if (form) form.reset();
};

// Helper: insert into income with fallback for missing columns
const INCOME_NEW_COLS = ['payment_mode', 'ref_number', 'payment_date', 'status', 'approved_by', 'approved_at', 'deposit_status', 'deposited_by', 'deposited_at'];
async function insertIncomeRow(data) {
    const tryInsert = async (d) => {
        const { data: result, error } = await sbClient.from('income').insert(d).select('id').single();
        if (error) throw error;
        return result;
    };
    try {
        return await tryInsert(data);
    } catch (err) {
        // Check if any new column is missing - strip them and retry
        const missingCol = INCOME_NEW_COLS.find(c => err.message && err.message.includes(`"${c}"`));
        if (missingCol) {
            const stripped = { ...data };
            for (const col of INCOME_NEW_COLS) delete stripped[col];
            // Also remove collected_by if that fails too (legacy)
            try {
                return await tryInsert(stripped);
            } catch (err2) {
                if (err2.message && err2.message.includes('collected_by')) {
                    delete stripped.collected_by;
                    return await tryInsert(stripped);
                }
                throw err2;
            }
        }
        if (err.message && err.message.includes('collected_by')) {
            const stripped = { ...data };
            delete stripped.collected_by;
            for (const col of INCOME_NEW_COLS) delete stripped[col];
            return await tryInsert(stripped);
        }
        throw err;
    }
}

// Handle income form submission
window.handleIncomeSubmit = async function(e) {
    e.preventDefault();
    if (!sbClient) {
        showToast("Database not connected.", "error");
        return;
    }
    
    if (!hasPermission('income:create')) {
        // Soft-login users may submit payment requests for their own flat
        const isSoftLogin = localStorage.getItem('isSoftLogin') === 'true';
        const softLoginFlat = localStorage.getItem('currentFlatNo') || '';
        const flatVal = document.getElementById("inc-flat").value;
        const ownFlatNo = flatVal.split(" - ")[0].trim();
        if (!isSoftLogin || ownFlatNo !== softLoginFlat) {
            showToast("Access Denied: You don't have permission to record income entries.", "error");
            return;
        }
    }
    
    const form = e.target;
    const isMulti = form.dataset.multiMonth === 'true';
    
    const flat = document.getElementById("inc-flat").value;
    
    // Floor restriction validation
    if (currentUserAssignedFloors.length > 0) {
        const flatNo = flat.split(' - ')[0];
        const floor = getFlatFloor(flatNo);
        if (floor === null || !currentUserAssignedFloors.includes(floor)) {
            showToast("Access Denied: You can only collect fees for flats on your assigned floors.", "error");
            return;
        }
    }
    const category = document.getElementById("inc-category").value;
    const eventName = document.getElementById("inc-event") ? document.getElementById("inc-event").value.trim() : "";
    const remarks = document.getElementById("inc-remarks") ? document.getElementById("inc-remarks").value.trim() : "";
    const date = document.getElementById("inc-date").value;
    const amount = document.getElementById("inc-amount").value;
    const paymentMode = document.getElementById("inc-payment-mode") ? document.getElementById("inc-payment-mode").value : '';
    const refNumber = document.getElementById("inc-ref-number") ? document.getElementById("inc-ref-number").value.trim() : '';
    const isSelfService = localStorage.getItem('isSoftLogin') === 'true' && (flat.split(" - ")[0].trim() === (localStorage.getItem('currentFlatNo') || ''));
    const paymentStatus = isSelfService ? 'pending' : 'approved';

    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;

    if (!flat || flat === "Select Room & Tenant" || !amount || !date) {
        showToast("Please fill out all fields.", "error");
        btn.disabled = false;
        return;
    }

    const flatNo = flat.split(" - ")[0].trim();
    const amtVal = parseFloat(amount);
    if (isNaN(amtVal)) throw new Error("Amount must be a valid number.");

    try {
        let data;
        if (isMulti && category === 'Monthly Maintenance') {
            // Multi-month: insert one row per checked checkbox
            const cbs = document.querySelectorAll('.inc-mm-cb:checked');
            if (cbs.length === 0) {
                showToast('Select at least one month.', 'warning');
                btn.disabled = false;
                return;
            }
            const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
            let insertedCount = 0;
            let lastId = null;
            const totalRate = Array.from(cbs).reduce((s, cb) => s + parseFloat(cb.dataset.rate || 0), 0);
            if (totalRate === 0) { showToast('No applicable rate for selected months.', 'error'); btn.disabled = false; return; }
            
            if (amtVal < totalRate) {
                // Partial payment: apply full amount to the current month only
                const now = new Date();
                const curMonth = now.getMonth() + 1;
                const curYear = now.getFullYear();
                const insertData = {
                    flat_no: flatNo,
                    year: String(curYear),
                    month: monthNames[curMonth - 1],
                    amount: Math.round(amtVal * 100) / 100,
                    date_received: date,
                    category: 'Monthly Maintenance',
                    remarks: (remarks || '') + ' (partial payment)',
                    collected_by: window.currentUserName || window.currentUserEmail || null,
                    payment_mode: paymentMode || null,
                    ref_number: refNumber || null,
                    payment_date: date,
                    status: paymentStatus,
                    approved_by: null,
                    approved_at: null
                };
                data = await insertIncomeRow(insertData);
                insertedCount = 1;
                lastId = data.id;
                if (isSelfService) {
                    showToast(`Payment request of ₹${formatCurrency(amtVal)} submitted for ${flatNo}. Awaiting approval.`, "success");
                } else {
                    showToast(`₹${formatCurrency(amtVal)} partial payment for ${monthNames[curMonth - 1]} ${curYear} (${flatNo}).`, "success", {
                        text: '<i class="fa-solid fa-file-pdf"></i> Receipt',
                        callback: () => generateReceipt(lastId)
                    });
                }
            } else {
                // Full payment: prorate across all selected months
                for (const cb of cbs) {
                    const cbMonth = parseInt(cb.dataset.month);
                    const cbYear = parseInt(cb.dataset.year);
                    const rateAmt = parseFloat(cb.dataset.rate || 0);
                    const prorated = (rateAmt / totalRate) * amtVal;
                    const monthName = monthNames[cbMonth - 1];
                    const insertData = {
                        flat_no: flatNo,
                        year: String(cbYear),
                        month: monthName,
                        amount: Math.round(prorated * 100) / 100,
                        date_received: date,
                        category: 'Monthly Maintenance',
                        collected_by: window.currentUserName || window.currentUserEmail || null,
                        payment_mode: paymentMode || null,
                        ref_number: refNumber || null,
                        payment_date: date,
                        status: paymentStatus,
                        approved_by: null,
                        approved_at: null
                    };
                    if (remarks) insertData.remarks = remarks;
                    data = await insertIncomeRow(insertData);
                    insertedCount++;
                    lastId = data.id;
                }
                if (isSelfService) {
                    showToast(`Payment request of ₹${formatCurrency(amtVal)} submitted for ${flatNo}. Awaiting approval.`, "success");
                } else {
                    showToast(`₹${formatCurrency(amtVal)} collected from ${flatNo} (${insertedCount} month${insertedCount > 1 ? 's' : ''}).`, "success", {
                        text: '<i class="fa-solid fa-file-pdf"></i> Receipt (last entry)',
                        callback: () => generateReceipt(lastId)
                    });
                }
            }
            
            // Reset multi-month UI
            form.dataset.multiMonth = '';
            const multiSection = document.getElementById('inc-multi-month');
            const singleSection = document.getElementById('inc-single-month');
            if (multiSection) multiSection.classList.add('hidden');
            if (singleSection) singleSection.classList.remove('hidden');
            const incAmount = document.getElementById('inc-amount');
            if (incAmount) incAmount.required = true;
        } else {
            // Single month (original behavior)
            const year = document.getElementById("inc-year").value;
            const month = document.getElementById("inc-month").value;
            const insertData = {
                flat_no: flatNo,
                year: year,
                month: month,
                amount: amtVal,
                date_received: date,
                category: category,
                event_name: category === "Special Event" ? eventName : null,
                remarks: remarks || null,
                collected_by: window.currentUserName || window.currentUserEmail || null,
                payment_mode: paymentMode || null,
                ref_number: refNumber || null,
                payment_date: date,
                status: paymentStatus,
                approved_by: null,
                approved_at: null
            };
            data = await insertIncomeRow(insertData);
            
            if (isSelfService) {
                showToast(`Payment request of ₹${formatCurrency(amtVal)} submitted for ${flatNo}. Awaiting approval.`, "success");
            } else {
                showToast(`Payment logged for Flat ${flatNo}`, "success", {
                    text: '<i class="fa-solid fa-file-pdf"></i> Receipt',
                    callback: () => generateReceipt(data.id)
                });
            }
        }
        
        document.getElementById("inc-amount").value = "";
        document.getElementById("inc-mm-override").value = "";
        if (document.getElementById("inc-event")) document.getElementById("inc-event").value = "";
        if (document.getElementById("inc-remarks")) document.getElementById("inc-remarks").value = "";
        if (document.getElementById("inc-payment-mode")) document.getElementById("inc-payment-mode").value = "";
        if (document.getElementById("inc-ref-number")) document.getElementById("inc-ref-number").value = "";
        document.getElementById("inc-category").value = "Monthly Maintenance";
        toggleEventNameField("Monthly Maintenance");
        
        closeModal('incomeModal');
        refreshDashboard();
        
        if (category === 'Monthly Maintenance' && typeof window.refreshMaintenanceCollectionsTab === 'function') {
            window.refreshMaintenanceCollectionsTab();
        }
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
    
    if (!hasPermission('expense:create')) {
        showToast("Access Denied: You don't have permission to record expense entries.", "error");
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
window.loadExpenseHeads = async function() {
    if (!sbClient) return;
    try {
        const { data, error } = await sbClient.from('expense_heads').select('id, name').order('name');
        if (error) throw error;
        
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
        
        const managerList = document.getElementById("category-manager-list");
        if (managerList) {
            managerList.innerHTML = "";
            if (data.length === 0) {
                managerList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 10px;">No custom expense heads defined.</div>`;
            } else {
                data.forEach(item => {
                    const div = document.createElement("div");
                    div.className = "category-item";
                    
                    const deleteBtn = window.hasPermission('expense_heads:delete')
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
};

window.openExpenseHeadsModal = function() {
    const addForm = document.getElementById("add-head-form");
    if (addForm) {
        addForm.style.display = hasPermission('expense_heads:create') ? 'flex' : 'none';
    }
    loadExpenseHeads();
    openModal('expenseHeadsModal');
};

window.handleAddExpenseHead = async function(e) {
    e.preventDefault();
    if (!sbClient) return;
    if (!hasPermission('expense_heads:create')) {
        showToast("Access Denied: You don't have permission to add expense categories.", "error");
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
    if (!hasPermission('expense_heads:delete')) {
        showToast("Access Denied: You don't have permission to delete expense categories.", "error");
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

// Owners & Residents Directory loaded from static/js/owners.js

// Financial Reports + Import/Export loaded from static/js/reports.js

// Support Helpdesk & Ticket System loaded from static/js/helpdesk.js

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

window.loadFlatsForSoftLogin = async function() {
    if (!sbClient) return;
    try {
        const { data, error } = await sbClient.from('owners').select('flat_no, owner_name').order('flat_no');
        if (error) throw error;
        
        console.log("Successfully loaded flats for soft login. Count:", data ? data.length : 0);
        
        const softOptions = document.getElementById("soft-flat-options");
        if (softOptions) {
            softOptions.innerHTML = '';
            data.forEach(item => {
                const opt = document.createElement("option");
                opt.value = item.flat_no;
                opt.label = item.owner_name ? `${item.flat_no} - ${window.displayStructured(item.owner_name, 'name')}` : item.flat_no;
                softOptions.appendChild(opt);
            });
        }
    } catch (err) {
        console.error("loadFlatsForSoftLogin error:", err);
    }
};

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
        const contactVal = window.displayStructured(data.contact_no, 'phone');
        const dbContact = String(contactVal || '').trim().replace(/\D/g, '');
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

window.handleSoftUserSession = async function(user, flatNo) {
    if (!sbClient) return;
    
    try {
        await window.loadRoles();
        
        const sideProfile = document.getElementById("side-user-profile");
        const sideEmail = document.getElementById("side-user-email");
        const sideRole = document.getElementById("side-user-role");
        
        if (sideProfile && sideEmail && sideRole) {
            sideEmail.textContent = `Flat ${flatNo}`;
            sideRole.textContent = "RESIDENT";
            sideRole.className = "badge";
            sideRole.style.borderColor = "var(--border-color)";
            sideRole.style.color = "var(--text-secondary)";
            sideProfile.style.display = "flex";
        }
        
        window.currentUserRole = 'viewer';
        window.applyRbacRestrictions('viewer');
        
        await window.ensureOwnersPopulated();
        window.loadFlats();
        window.loadExpenseHeads();
        window.refreshDashboard();

        // Auto-open own flat in Owners Directory for soft login
        if (flatNo) {
            setTimeout(() => window.openOwnersDirectoryModal(flatNo), 800);
        }
    } catch (e) {
        console.error("handleSoftUserSession error:", e);
        showToast("Error retrieving flat details.", "error");
    }
};

window.autoLoginSharedAccount = async function(flatNo) {
    if (!sbClient) return;
    const email = "resident_v2@deepsikha.in";
    const password = "resident123";
    
    try {
        // Try sign-up first; if already registered, that's fine
        await sbClient.auth.signUp({ email, password });
    } catch (_) { /* user likely already exists — proceed */ }
    
    try {
        const { error } = await sbClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
    } catch (err) {
        console.error("autoLoginSharedAccount error:", err);
        localStorage.removeItem("isSoftLogin");
        localStorage.removeItem("currentFlatNo");
        document.getElementById("auth-container").style.display = "block";
        
        if (err.message && err.message.toLowerCase().includes("invalid login credentials")) {
            showToast("Soft Login blocked by Supabase. Please disable 'Confirm Email' in Supabase Auth Settings, or manually confirm 'resident_v2@deepsikha.in' via SQL.", "error");
        } else {
            showToast("Authentication failed: " + err.message, "error");
        }
    }
};

// Users & Roles Management loaded from static/js/users.js

window.toggleCollapse = function(id) {
    const wrap = document.getElementById(id);
    const header = wrap && wrap.previousElementSibling;
    if (!wrap) return;
    wrap.classList.toggle("collapsed");
    if (header && header.classList.contains("collapse-header")) {
        header.classList.toggle("collapsed");
    }
};

window.toggleSidebar = function() {
    const sidebar = document.getElementById("main-sidebar");
    const btn = document.getElementById("sidebar-toggle");
    if (!sidebar) return;
    sidebar.classList.toggle("hidden");
    document.body.classList.toggle("sidebar-hidden");
    if (btn) {
        btn.title = sidebar.classList.contains("hidden") ? "Show sidebar" : "Hide sidebar";
    }
};

window.updateDbStatus = function(isConnected, message) {
    const updateOne = (badgeEl, textEl) => {
        if (!badgeEl || !textEl) return;
        if (isConnected) {
            badgeEl.className = "badge badge-income";
            badgeEl.style.borderColor = "rgba(16, 185, 129, 0.4)";
            badgeEl.style.cursor = "pointer";
            textEl.textContent = "Connected";
        } else {
            badgeEl.className = "badge badge-expense";
            badgeEl.style.borderColor = "rgba(244, 63, 94, 0.4)";
            badgeEl.style.cursor = "pointer";
            textEl.textContent = message || "Disconnected";
        }
    };
    updateOne(document.getElementById("db-status-badge"), document.getElementById("db-status-text"));
    updateOne(document.getElementById("db-status-badge-side"), document.getElementById("db-status-text-side"));
};

window.initSupabase = function() {
    let url = localStorage.getItem('supabaseUrl') || "";
    let key = localStorage.getItem('supabaseKey') || "";
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
            window.sbClient = window.supabase.createClient(url.trim(), key.trim());
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
};

document.addEventListener("DOMContentLoaded", () => {
    const today = new Date().toISOString().split('T')[0];
    const incDateInput = document.getElementById("inc-date");
    const expDateInput = document.getElementById("exp-date");
    if (incDateInput) incDateInput.value = today;
    if (expDateInput) expDateInput.value = today;
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
    if (filterMonth) filterMonth.value = currentMonth;
    if (filterYear) filterYear.addEventListener("change", refreshDashboard);
    if (filterMonth) filterMonth.addEventListener("change", refreshDashboard);
    if (initSupabase()) {
        setupAuthListener();
        loadBuildingConfig();
        loadFlatsForSoftLogin();
    } else {
        openSupabaseConfig();
    }
});

