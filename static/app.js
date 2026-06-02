// JavaScript Controller - Multi-Building Residence Management (Vite + Supabase Serverless with RBAC)

window.sbClient = null;
let loadedEntries = [];
let activeReportTab = 'date-wise-cashbook';
window.currentUserRole = 'viewer';
window.currentUserId = null;
let loadedTickets = [];
let selectedTicketId = null;
let ticketScope = 'ALL';
window.rolesData = [];
window.currentRolePermissions = [];
let currentUserAssignedFloors = [];
window.buildingConfig = null;
let googlePickerReady = false;
let gdrivePickerInited = false;

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
    dashboard_bg_url: ''
};

function getWingsList() {
    return (buildingConfig?.wings || DEFAULT_BUILDING_CONFIG.wings).split(',').map(s => s.trim()).filter(Boolean);
}

function getFlatTypesList() {
    return (buildingConfig?.flat_types || DEFAULT_BUILDING_CONFIG.flat_types).split(',').map(s => s.trim()).filter(Boolean);
}

function getFloorCount() {
    return buildingConfig?.floors || DEFAULT_BUILDING_CONFIG.floors;
}

function getBuildingName() {
    return buildingConfig?.building_name || DEFAULT_BUILDING_CONFIG.building_name;
}

function getBlockName() {
    return buildingConfig?.block_name || '';
}

function getAllFlats() {
    const floors = getFloorCount();
    const wings = getWingsList();
    const flats = [];
    for (let f = 1; f <= floors; f++) {
        wings.forEach(w => {
            flats.push(`${f}${w}`);
        });
    }
    return flats;
}

// Update all UI elements with building name from config
function updateBuildingUI() {
    const name = getBuildingName();
    const block = getBlockName();
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
    // Apply dashboard background image
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
}

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
    if (nameEl) nameEl.textContent = getBuildingName().toUpperCase();
    const dtEl = document.getElementById('dashboard-date-time');
    if (dtEl) dtEl.textContent = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    
    loadDashStats();
}

async function loadDashStats() {
    if (!sbClient) return;
    
    // Wrap each query individually so one failure doesn't break all
    async function safeQuery(label, fn) {
        try { return await fn(); } catch (e) { console.warn('Dashboard stat [' + label + ']:', e); return null; }
    }
    
    // Owner stats
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
    
    // Events
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
    
    // Tickets
    const ticketsResult = await safeQuery('tickets', async () => {
        const { data } = await sbClient.from('tickets')
            .select('id')
            .in('status', ['open', 'in_progress', 'pending_approval']);
        return (data || []).length;
    });
    document.getElementById('dash-open-tickets').textContent = ticketsResult ?? '-';
    
    // This month income
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
    
    // Recent activity
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
            : `${r.owner_name || 'Resident'}${r.owner_flat_no ? ' (' + r.owner_flat_no + ')' : ''}`;
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
}

// Load building config from Supabase
async function loadBuildingConfig() {
    if (!sbClient) return;
    try {
        const { data, error } = await sbClient.from('building_config').select('*').eq('id', 1).single();
        if (error && error.code === 'PGRST116') {
            buildingConfig = { ...DEFAULT_BUILDING_CONFIG };
            updateBuildingUI();
            return;
        }
        if (error) throw error;
        buildingConfig = data || { ...DEFAULT_BUILDING_CONFIG };
        if (buildingConfig.floors) buildingConfig.floors = parseInt(buildingConfig.floors, 10);
        updateBuildingUI();
        initGoogleDrivePicker();
    } catch (err) {
        console.warn("Could not load building config, using defaults:", err);
        buildingConfig = { ...DEFAULT_BUILDING_CONFIG };
        updateBuildingUI();
    }
}

// Save building config to Supabase
async function saveBuildingConfig(config) {
    if (!sbClient) return false;
    try {
        const { error } = await sbClient.from('building_config').upsert({
            id: 1,
            building_name: config.building_name,
            block_name: config.block_name || '',
            address: config.address || '',
            google_api_key: config.google_api_key || '',
            google_client_id: config.google_client_id || '',
            vapid_public_key: config.vapid_public_key || '',
            vapid_private_key: config.vapid_private_key || '',
            floors: parseInt(config.floors, 10) || 8,
            wings: config.wings || 'A,B,C,D,E,F,G,H',
            flat_types: config.flat_types || '1BHK,2BHK,3BHK',
            dashboard_bg_url: config.dashboard_bg_url || ''
        }, { onConflict: 'id' });
        if (error) throw error;
        buildingConfig = config;
        if (buildingConfig.floors) buildingConfig.floors = parseInt(buildingConfig.floors, 10);
        initGoogleDrivePicker();
        updateBuildingUI();
        return true;
    } catch (err) {
        console.error("saveBuildingConfig error:", err);
        showToast("Failed to save building configuration.", "error");
        return false;
    }
}

// Generate floor options HTML for any select element
function getFloorOptions(selectedFloor) {
    const count = getFloorCount();
    let html = '<option value="">All Floors</option>';
    for (let i = 1; i <= count; i++) {
        const sel = String(i) === String(selectedFloor) ? 'selected' : '';
        html += `<option value="${i}" ${sel}>Floor ${i}</option>`;
    }
    return html;
}

// Cultural Events module loaded from static/js/events.js


// Community Board module loaded from static/js/community-board.js

// --- AUTHENTICATION & SESSION CONTROLLERS ---

function setupAuthListener() {
    if (!sbClient) return;
    
    // Bind sign in / sign out updates
    sbClient.auth.onAuthStateChange((event, session) => {
        if (session) {
            currentUserId = session.user.id;
            
            // Push to next tick to avoid Supabase Auth Web Locks deadlock
            setTimeout(async () => {
                try {
                    if (localStorage.getItem("isSoftLogin") === "true") {
                        const flatNo = localStorage.getItem("currentFlatNo");
                        await handleSoftUserSession(session.user, flatNo);
                    } else {
                        await handleUserSession(session.user);
                    }
                    // Hide only on successful session loading
                    document.getElementById("auth-container").style.display = "none";
                    const openTarget = new URLSearchParams(window.location.search).get('open');
                    if (openTarget === 'board' && hasPermission('board:view')) {
                        setTimeout(() => openBoardModal(), 200);
                        window.history.replaceState({}, document.title, window.location.pathname);
                    }
                } catch (err) {
                    console.error("Session initialization failed:", err);
                    // Clear any invalid session
                    localStorage.removeItem("isSoftLogin");
                    localStorage.removeItem("currentFlatNo");
                    await sbClient.auth.signOut();
                    
                    currentUserId = null;
                    document.getElementById("auth-container").style.display = "block";
                    const sideProfile = document.getElementById("side-user-profile");
                    if (sideProfile) sideProfile.style.display = "none";
                    currentUserRole = 'viewer';
                    applyRbacRestrictions('viewer');
                }
            }, 0);
        } else {
            if (localStorage.getItem("isSoftLogin") === "true") {
                const flatNo = localStorage.getItem("currentFlatNo");
                autoLoginSharedAccount(flatNo);
            } else {
                currentUserId = null;
                document.getElementById("auth-container").style.display = "block";
                const sideProfile = document.getElementById("side-user-profile");
                if (sideProfile) sideProfile.style.display = "none";
                currentUserRole = 'viewer';
                applyRbacRestrictions('viewer');
            }
        }
    });
}

async function handleUserSession(user) {
    if (!sbClient) return;
    
    try {
        // Load roles first
        await loadRoles();
        
        // Query user's profile role + assigned floors from the profiles table
        let { data, error } = await sbClient.from('profiles').select('role, assigned_floors').eq('id', user.id).single();
        
        if (error) {
            // Profile row might not have been created yet by the DB trigger due to latency
            console.warn("Profile fetching failed, retrying in 1s...", error);
            await new Promise(resolve => setTimeout(resolve, 1000));
            const retryRes = await sbClient.from('profiles').select('role, assigned_floors').eq('id', user.id).single();
            data = retryRes.data;
            if (retryRes.error) throw retryRes.error;
        }
        
        currentUserRole = data && data.role ? data.role.toLowerCase().trim() : "viewer";
        currentUserAssignedFloors = data && Array.isArray(data.assigned_floors) ? data.assigned_floors : [];
        
        // Update user profile in sidebar
        const sideProfile = document.getElementById("side-user-profile");
        const sideEmail = document.getElementById("side-user-email");
        const sideRole = document.getElementById("side-user-role");
        
        if (sideProfile && sideEmail && sideRole) {
            sideEmail.textContent = user.email;
            sideRole.textContent = currentUserRole.toUpperCase();
            const roleColor = getRoleColor(currentUserRole);
            sideRole.className = "badge";
            sideRole.style.borderColor = roleColor.replace('var(', '').replace(')', '').trim()
                ? `rgba(255,255,255,0.2)` : 'var(--border-color)';
            sideRole.style.color = roleColor;
            sideProfile.style.display = "flex";
        }
        
        // Show notification toggle
        const notifBtn = document.getElementById('side-notif-toggle');
        if (notifBtn) {
            notifBtn.style.display = 'flex';
            updateNotificationBtn();
        }
        // Auto-subscribe if previously subscribed
        if (localStorage.getItem('pushSubscribed') === 'true' && buildingConfig?.vapid_public_key) {
            doSubscribe().catch(() => {});
        }
        
        // Apply RBAC modifications to view buttons and actions
        applyRbacRestrictions(currentUserRole);
        
        // Merge committee position permissions on top of base role
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
                    applyRbacRestrictions(currentUserRole);
                }
            } catch (_) {}
        }
        
        // Seed owners defaults if they don't exist yet
        await ensureOwnersPopulated();
        
        // Load data registries
        loadFlats();
        loadExpenseHeads();
        refreshDashboard();
    } catch (e) {
        console.error("handleUserSession error:", e);
        showToast("Error retrieving user profile role credentials.", "error");
    }
}

// Committee module loaded from static/js/committee.js

// ==========================================
// Meetings & Resolutions module loaded from static/js/meetings.js

// ==========================================
// Phase 3: Document Vault & Compliance module loaded from static/js/phase3.js

// Phase 4: Vendors, Visitors, Assets, Polls, Parking loaded from static/js/phase4.js

// Committee Handover Tool loaded from static/js/handover.js

// Admin Dashboard Analytics loaded from static/js/analytics.js

// ==========================================
// DYNAMIC ROLE & PERMISSION SYSTEM
// ==========================================

async function loadRoles() {
    if (!sbClient) return;
    try {
        const { data, error } = await sbClient.from('roles').select('*').order('priority', { ascending: false });
        if (error) {
            // roles table might not exist yet; use default hardcoded roles as fallback
            console.warn("Could not load roles from DB, using defaults:", error);
            rolesData = getDefaultRoles();
        } else if (data && data.length > 0) {
            // Merge DB roles with defaults to ensure new permissions propagate
            const defaults = getDefaultRoles();
            rolesData = data.map(dbRole => {
                const def = defaults.find(d => d.name === dbRole.name);
                if (def) {
                    const merged = [...new Set([...(dbRole.permissions || []), ...def.permissions])];
                    return { ...dbRole, permissions: merged };
                }
                return dbRole;
            });
        } else {
            rolesData = getDefaultRoles();
        }
    } catch (e) {
        console.warn("Error loading roles, using defaults:", e);
        rolesData = getDefaultRoles();
    }
}

function getDefaultRoles() {
    return [
        { name: 'admin', label: 'Administrator', permissions: ['dashboard:view','income:create','income:delete','expense:create','expense:delete','history:view','reports:view','ledger:import','ledger:export','owners:upload','owners:edit_any','owners:edit_own','expense_heads:manage','expense_heads:create','expense_heads:delete','users:manage','users:role_change','tickets:assign','tickets:recommend','tickets:approve','tickets:resolve','tickets:close','tickets:reopen','tickets:archive','tickets:delete','tickets:comment','events:view','events:create','events:delete','events:contribute','events:perform','events:manage_vendors','events:manage_competitions','events:vote','events:score','events:upload_gallery','events:generate_passes','board:view','board:create','board:moderate','committee:view','committee:manage','meetings:view','meetings:create','meetings:manage','resolutions:view','documents:view','documents:upload','documents:delete','compliance:view','compliance:create','compliance:manage','vendors:view','vendors:create','vendors:manage','visitors:view','visitors:create','visitors:approve','assets:view','assets:create','assets:manage','polls:view','polls:create','polls:vote','parking:view','parking:assign','parking:manage','handover:view','handover:create','analytics:view','maintenance:view','maintenance:manage_rates','maintenance:collect','security:view','security:manage'], color: 'var(--color-emerald)' },
        { name: 'editor', label: 'Editor', permissions: ['dashboard:view','income:create','expense:create','history:view','reports:view','ledger:export','tickets:resolve','tickets:comment','board:view','board:create','board:moderate'], color: 'var(--color-rose)' },
        { name: 'floor_manager', label: 'Floor Manager', permissions: ['dashboard:view','income:create','history:view','reports:view','tickets:recommend','tickets:comment','board:view','board:create'], color: 'var(--color-yellow)' },
        { name: 'committee_member', label: 'Committee Member', permissions: ['dashboard:view','history:view','reports:view','tickets:approve','tickets:comment','board:view','board:create','board:moderate','committee:view','meetings:view','meetings:create','meetings:manage','resolutions:view','documents:view','documents:upload','compliance:view','compliance:create','compliance:manage','vendors:view','vendors:create','visitors:view','visitors:create','visitors:approve','assets:view','assets:create','assets:manage','polls:view','polls:create','polls:vote','parking:view','parking:assign','handover:view','handover:create','analytics:view','maintenance:view','maintenance:manage_rates','maintenance:collect','security:view','security:manage'], color: 'var(--color-violet)' },
        { name: 'viewer', label: 'Viewer (Resident)', permissions: ['dashboard:view','owners:edit_own','tickets:comment','events:view','board:view','board:create','committee:view','meetings:view','resolutions:view','documents:view','compliance:view','vendors:view','visitors:view','visitors:create','assets:view','polls:view','polls:vote','parking:view','maintenance:view','security:view'], color: 'var(--text-secondary)' }
    ];
}

function hasPermission(perm) {
    return currentRolePermissions.includes(perm);
}

function getRoleData(roleName) {
    return rolesData.find(r => r.name === roleName) || null;
}

function getRoleColor(roleName) {
    const r = getRoleData(roleName);
    return r ? (r.color || 'var(--text-secondary)') : 'var(--text-secondary)';
}

function getRoleLabel(roleName) {
    const r = getRoleData(roleName);
    return r ? (r.label || roleName) : roleName;
}

function applyRbacRestrictions(role) {
    const roleData = getRoleData(role);
    currentRolePermissions = roleData ? [...roleData.permissions] : [];
    
    const setBlock = (id, show) => { const el = document.getElementById(id); if (el) el.style.display = show ? "block" : "none"; };
    const setNav = (id, show) => { const el = document.getElementById(id); if (el) el.style.display = show ? "flex" : "none"; };
    
    // Sidebar nav items
    setNav("side-collect-fee", hasPermission('income:create'));
    setNav("side-record-expense", hasPermission('expense:create'));
    setNav("side-import", hasPermission('ledger:import'));
    setNav("side-owners-upload", hasPermission('owners:upload'));
    setNav("side-export", hasPermission('ledger:export'));
    setNav("side-manage-users", hasPermission('users:manage'));
    setNav("side-manage-roles", hasPermission('users:role_change'));
    setNav("side-building-config", role === 'admin');
    
    const canViewDashboard = hasPermission('dashboard:view');
    setNav("side-dashboard", true);
    setNav("side-finance", canViewDashboard && role !== 'viewer');
    setNav("side-history", canViewDashboard && hasPermission('history:view'));
    setNav("side-reports", canViewDashboard && hasPermission('reports:view'));
    setNav("side-directory", true);
    setNav("side-helpdesk", true);
    setNav("side-events", hasPermission('events:view'));
    setNav("side-board", hasPermission('board:view'));
    setNav("side-committee", hasPermission('committee:view'));
    setNav("side-meetings", hasPermission('meetings:view'));
    setNav("side-resolutions", hasPermission('resolutions:view'));
    setNav("side-documents", hasPermission('documents:view'));
    setNav("side-compliance", hasPermission('compliance:view'));
    setNav("side-vendors", hasPermission('vendors:view'));
    setNav("side-visitors", hasPermission('visitors:view'));
    setNav("side-assets", hasPermission('assets:view'));
    setNav("side-polls", hasPermission('polls:view'));
    setNav("side-parking", hasPermission('parking:view'));
    setNav("side-handover", hasPermission('handover:view'));
    setNav("side-analytics", hasPermission('analytics:view'));
    
    // Dashboard + Finance modal quick-action buttons (hide for viewers)
    const hideDash = (id, show) => { const el = document.getElementById(id); if (el) el.style.display = show ? "" : "none"; };
    hideDash("dash-collect-fee", hasPermission('income:create'));
    hideDash("dash-record-expense", hasPermission('expense:create'));
    hideDash("fin-collect-fee", hasPermission('income:create'));
    hideDash("fin-record-expense", hasPermission('expense:create'));
    hideDash("dash-board", hasPermission('board:view'));
    const setBtn = (id, show) => { const el = document.getElementById(id); if (el) el.style.display = show ? "" : "none"; };
    setBtn("btn-create-post", hasPermission('board:create'));
    
    // Admin section visibility
    const hasAdminAccess = hasPermission('users:manage') || hasPermission('users:role_change');
    setBlock("side-admin-label", hasAdminAccess);
    setBlock("side-admin-nav", hasAdminAccess);
    setNav("side-manage-committee", hasPermission('committee:manage'));
    
    // Workspace visibility
    setBlock("workspace", canViewDashboard);
    
    // Refresh ledger lists so that edit buttons disappear or appear
    if (loadedEntries.length > 0) {
        renderTable(loadedEntries);
    }
}

// ==========================================
// FLOOR-MANAGER: ASSIGNED FLOORS SYSTEM
// ==========================================

function getFlatFloor(flatNo) {
    if (!flatNo) return null;
    const match = flatNo.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : null;
}

function isFlatAccessible(flatNo) {
    if (currentUserAssignedFloors.length === 0) return true;
    const floor = getFlatFloor(flatNo);
    return floor !== null && currentUserAssignedFloors.includes(floor);
}

function filterFlatsByAssignment(data) {
    if (currentUserAssignedFloors.length === 0) return data;
    return data.filter(item => isFlatAccessible(item.flat_no));
}

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
async function ensureOwnersPopulated() {
    if (!sbClient) return;
    try {
        const { data, error } = await sbClient.from('owners').select('flat_no').limit(1);
        if (error) throw error;
        
        if (!data || data.length === 0) {
            const defaultOwners = [];
            const allFlats = getAllFlats();
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
}

// Load dropdown flats from Supabase owners registry
async function loadFlats() {
    if (!sbClient) return;
    try {
        let { data, error } = await sbClient.from('owners').select('flat_no, owner_name').order('flat_no');
        if (error) throw error;
        
        data = filterFlatsByAssignment(data);
        
        const flatSelect = document.getElementById("inc-flat");
        const histFlat = document.getElementById("hist-flat");
        
        const currentVal = flatSelect ? flatSelect.value : "";
        const currentHistVal = histFlat ? histFlat.value : "ALL";
        
        if (flatSelect) {
            flatSelect.innerHTML = '<option value="" disabled selected>Select Room & Tenant</option>';
            data.forEach(item => {
                const opt = document.createElement("option");
                const label = `${item.flat_no} - ${item.owner_name}`;
                opt.value = label;
                opt.textContent = label;
                flatSelect.appendChild(opt);
            });
            if (currentVal && data.some(item => `${item.flat_no} - ${item.owner_name}` === currentVal)) {
                flatSelect.value = currentVal;
            }
        }
        
        if (histFlat) {
            histFlat.innerHTML = '<option value="ALL">All Flats</option>';
            data.forEach(item => {
                const opt = document.createElement("option");
                opt.value = item.flat_no;
                opt.textContent = `${item.flat_no} - ${item.owner_name}`;
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
                opt.textContent = `${item.flat_no} - ${item.owner_name}`;
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

// Refresh dashboard stats and statements list
async function refreshDashboard() {
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
        
        // Update KPIs
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
        
        renderTable(loadedEntries);
        
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
}

// Format number to currency (e.g. 1500 -> Rs. 1,500.00)
window.formatCurrency = function(val) {
    return "Rs. " + Number(val).toLocaleString('en-IN', {
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

let _modalZIndex = 100;
window.openModal = function(modalId) {
    const el = document.getElementById(modalId);
    if (!el) return;
    el.style.display = 'block';
    _modalZIndex += 10;
    el.style.zIndex = _modalZIndex;
};

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.style.display = "none";
    const form = modal.querySelector("form");
    if (form) form.reset();
};

// Handle income form submission
window.handleIncomeSubmit = async function(e) {
    e.preventDefault();
    if (!sbClient) {
        showToast("Database not connected.", "error");
        return;
    }
    
    if (!hasPermission('income:create')) {
        showToast("Access Denied: You don't have permission to record income entries.", "error");
        return;
    }
    
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
    const year = document.getElementById("inc-year").value;
    const month = document.getElementById("inc-month").value;
    const amount = document.getElementById("inc-amount").value;
    const date = document.getElementById("inc-date").value;

    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;

    if (!flat || flat === "Select Room & Tenant" || !amount || !date) {
        showToast("Please fill out all fields.", "error");
        btn.disabled = false;
        return;
    }

    try {
        const flatNo = flat.split(" - ")[0].trim();
        const amtVal = parseFloat(amount);
        if (isNaN(amtVal)) throw new Error("Amount must be a valid number.");

        const { data, error } = await sbClient.from('income').insert({
            flat_no: flatNo,
            year: year,
            month: month,
            amount: amtVal,
            date_received: date,
            category: category,
            event_name: category === "Special Event" ? eventName : null,
            remarks: remarks || null
        }).select('id').single();
        
        if (error) throw error;
        
        showToast(`Payment logged for Flat ${flatNo}`, "success", {
            text: '<i class="fa-solid fa-file-pdf"></i> Receipt',
            callback: () => generateReceipt(data.id)
        });
        
        document.getElementById("inc-amount").value = "";
        if (document.getElementById("inc-event")) document.getElementById("inc-event").value = "";
        if (document.getElementById("inc-remarks")) document.getElementById("inc-remarks").value = "";
        document.getElementById("inc-category").value = "Monthly Maintenance";
        toggleEventNameField("Monthly Maintenance");
        
        closeModal('incomeModal');
        refreshDashboard();
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
async function loadExpenseHeads() {
    if (!sbClient) return;
    try {
        const { data, error } = await sbClient.from('expense_heads').select('id, name').order('name');
        if (error) throw error;
        
        // Populate select in Expense modal
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
        
        // Populate category manager list inside the modal
        const managerList = document.getElementById("category-manager-list");
        if (managerList) {
            managerList.innerHTML = "";
            if (data.length === 0) {
                managerList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 10px;">No custom expense heads defined.</div>`;
            } else {
                data.forEach(item => {
                    const div = document.createElement("div");
                    div.className = "category-item";
                    
                    const deleteBtn = hasPermission('expense_heads:delete')
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
}

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

async function loadFlatsForSoftLogin() {
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
                opt.label = item.owner_name ? `${item.flat_no} - ${item.owner_name}` : item.flat_no;
                softOptions.appendChild(opt);
            });
        }
    } catch (err) {
        console.error("loadFlatsForSoftLogin error:", err);
    }
}

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
        const dbContact = String(data.contact_no || '').trim().replace(/\D/g, '');
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

async function handleSoftUserSession(user, flatNo) {
    if (!sbClient) return;
    
    try {
        await loadRoles();
        
        // Update user profile in sidebar
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
        
        currentUserRole = 'viewer';
        applyRbacRestrictions('viewer');
        
        await ensureOwnersPopulated();
        loadFlats();
        loadExpenseHeads();
        refreshDashboard();
    } catch (e) {
        console.error("handleSoftUserSession error:", e);
        showToast("Error retrieving flat details.", "error");
    }
}

async function autoLoginSharedAccount(flatNo) {
    if (!sbClient) return;
    // Use a fresh email to bypass the old unverified 'resident@deepsikha.in' account
    const email = "resident_v2@deepsikha.in";
    const password = "resident123";
    
    try {
        const { error } = await sbClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            // Account might not exist, sign up
            const { error: signUpError } = await sbClient.auth.signUp({
                email: email,
                password: password
            });
            if (signUpError) throw signUpError;
            
            // Retry sign in
            const { error: retryError } = await sbClient.auth.signInWithPassword({
                email: email,
                password: password
            });
            if (retryError) throw retryError;
        }
    } catch (err) {
        console.error("autoLoginSharedAccount error:", err);
        localStorage.removeItem("isSoftLogin");
        localStorage.removeItem("currentFlatNo");
        document.getElementById("auth-container").style.display = "block";
        
        // Show specific error for email confirmation
        if (err.message && err.message.toLowerCase().includes("invalid login credentials")) {
            showToast("Soft Login blocked by Supabase. Please disable 'Confirm Email' in Supabase Auth Settings, or manually confirm 'resident@deepsikha.in' via SQL.", "error");
        } else {
            showToast("Authentication failed: " + err.message, "error");
        }
    }
}

// Users & Roles Management loaded from static/js/users.js

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
            sbClient = window.supabase.createClient(url.trim(), key.trim());
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

