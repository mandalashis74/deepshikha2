// JavaScript Controller - Multi-Building Residence Management (Vite + Supabase Serverless with RBAC)

let sbClient = null;
let loadedEntries = [];
let activeReportTab = 'date-wise-cashbook';
let currentUserRole = 'viewer';
let currentUserId = null;
let loadedTickets = [];
let selectedTicketId = null;
let ticketScope = 'ALL';
let rolesData = [];
let currentRolePermissions = [];
let currentUserAssignedFloors = [];
let buildingConfig = null;
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

// ==========================================
// CULTURAL EVENTS MODULE
// ==========================================

let eventsData = [];
let currentEvent = null;
let currentSuccessEventId = null;
let lastContributionData = null;

window.openEventsModal = async function() {
    if (!hasPermission('events:view')) {
        showToast("Access Denied: You don't have permission to view events.", "error");
        return;
    }
    openModal('eventsModal');
    await loadEventsList();
};

window.loadEventsList = async function() {
    if (!sbClient) return;
    const container = document.getElementById('events-list-container');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">Loading events...</div>';
    
    const statusFilter = document.getElementById('events-filter-status')?.value || '';
    
    try {
        let q = sbClient.from('cultural_events').select('*').order('start_date', { ascending: true });
        if (statusFilter) q = q.eq('status', statusFilter);
        const { data, error } = await q;
        if (error) throw error;
        eventsData = data || [];
        
        const canCreate = hasPermission('events:create');
        document.getElementById('btn-create-event').style.display = canCreate ? 'inline-flex' : 'none';
        
        if (eventsData.length === 0) {
            container.innerHTML = '<div class="no-events-msg"><i class="fa-solid fa-calendar-xmark" style="font-size:2rem; display:block; margin-bottom:8px;"></i>No cultural events found.<br><span style="font-size:0.8rem;">Events will appear here once created by the committee.</span></div>';
            return;
        }
        
        container.innerHTML = '';
        const canEdit = hasPermission('events:create');
        eventsData.forEach(evt => {
            container.appendChild(renderEventCard(evt, canEdit));
        });
    } catch (err) {
        console.error("loadEventsList error:", err);
        container.innerHTML = '<div class="no-events-msg">Failed to load events.</div>';
    }
};

function renderEventCard(evt, canEdit = false) {
    const card = document.createElement('div');
    card.className = 'event-card';
    card.onclick = () => openEventDetail(evt);
    
    const now = new Date();
    const startDate = new Date(evt.start_date);
    const endDate = new Date(evt.end_date);
    let statusBadge = '';
    let countdownText = '';
    
    if (evt.status === 'completed') {
        statusBadge = '<span class="badge badge-expense">Completed</span>';
    } else if (now >= startDate && now <= endDate) {
        statusBadge = '<span class="badge badge-income" style="background:var(--color-emerald);">Live</span>';
        countdownText = 'Happening Now!';
    } else if (now < startDate) {
        const days = Math.ceil((startDate - now) / (1000 * 60 * 60 * 24));
        statusBadge = '<span class="badge badge-income" style="background:var(--color-indigo);">Upcoming</span>';
        countdownText = days === 0 ? 'Starts Today!' : days === 1 ? '1 day away' : `${days} days away`;
    } else {
        statusBadge = '<span class="badge badge-expense">Ended</span>';
    }
    
    // Count contributions from income table
    fetchContributionStats(evt.id).then(stats => {
        const fill = evt.target_amount > 0 ? Math.min(100, (stats.collected / evt.target_amount) * 100) : 0;
        const progressEl = card.querySelector('.event-progress-fill');
        if (progressEl) progressEl.style.width = fill + '%';
        const statsEl = card.querySelector('.event-contrib-stats');
        if (statsEl) statsEl.textContent = `₹${stats.collected.toLocaleString()} collected`;
    });
    
    const dateStr = `${startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    const endDateStr = endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    
    card.innerHTML = `
        <div class="event-card-header">
            <div>
                <h3>${evt.name}</h3>
                <p style="font-size:0.8rem; color:var(--text-secondary); margin:4px 0 0 0;">
                    <i class="fa-solid fa-calendar"></i> ${dateStr}${endDateStr !== dateStr ? ' - ' + endDateStr : ''}
                </p>
            </div>
            <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                ${statusBadge}
                ${countdownText ? `<div class="event-countdown">${countdownText}</div>` : ''}
                ${canEdit ? `<div style="display:flex; gap:4px; margin-top:2px;">
                    <button class="btn btn-indigo" style="font-size:0.65rem; padding:2px 8px;" onclick="event.stopPropagation(); openCreateEventModal(${evt.id})"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-rose" style="font-size:0.65rem; padding:2px 8px;" onclick="event.stopPropagation(); deleteEvent(${evt.id}, '${evt.name.replace(/'/g, "\\'")}')"><i class="fa-solid fa-trash"></i></button>
                </div>` : ''}
            </div>
        </div>
        ${evt.target_amount > 0 ? `
        <div class="event-progress-bar">
            <div class="event-progress-fill" style="width:0%;"></div>
        </div>
        <div class="event-stats">
            <span><i class="fa-solid fa-indian-rupee-sign"></i> <span class="event-contrib-stats">Loading...</span></span>
            <span><i class="fa-solid fa-bullseye"></i> Target: ₹${evt.target_amount.toLocaleString()}</span>
        </div>` : `
        <div class="event-stats">
            ${evt.contribution_amount > 0 ? `<span><i class="fa-solid fa-tag"></i> Contribution: ₹${evt.contribution_amount.toLocaleString()}</span>` : ''}
        </div>`}
    `;
    return card;
}

async function fetchContributionStats(eventId) {
    try {
        const q = sbClient.from('income')
            .select('amount')
            .eq('category', 'Cultural Event');
        const { data, error } = await q.eq('event_id', eventId);
        if (error) throw error;
        const collected = (data || []).reduce((sum, r) => sum + Number(r.amount || 0), 0);
        return { count: (data || []).length, collected };
    } catch {
        return { count: 0, collected: 0 };
    }
}

window.openCreateEventModal = function(eventData = null) {
    if (!hasPermission('events:create')) {
        showToast("Access Denied.", "error");
        return;
    }
    if (eventData && typeof eventData === 'number') {
        eventData = eventsData.find(e => e.id === eventData) || null;
    }
    if (!eventData && document.getElementById('edit-event-id').value) {
        const cachedId = Number(document.getElementById('edit-event-id').value);
        eventData = eventsData.find(e => e.id === cachedId) || null;
    }
    document.getElementById('create-event-title').textContent = eventData ? 'Edit Event' : 'New Event';
    document.getElementById('edit-event-id').value = eventData ? eventData.id : '';
    document.getElementById('event-name').value = eventData ? eventData.name : '';
    document.getElementById('event-description').value = eventData ? (eventData.description || '') : '';
    document.getElementById('event-start-date').value = eventData ? eventData.start_date : '';
    document.getElementById('event-end-date').value = eventData ? eventData.end_date : '';
    document.getElementById('event-contribution').value = eventData ? (eventData.contribution_amount || '') : '';
    document.getElementById('event-target').value = eventData ? (eventData.target_amount || '') : '';
    document.getElementById('event-banner').value = eventData ? (eventData.banner_url || '') : '';
    document.getElementById('event-status').value = eventData ? (eventData.status || 'upcoming') : 'upcoming';
    document.getElementById('event-notes').value = eventData ? (eventData.committee_notes || '') : '';
    // Reset banner preview and trigger preview if URL exists
    const preview = document.getElementById('banner-preview');
    if (preview) preview.style.display = 'none';
    const bannerUrl = document.getElementById('event-banner').value.trim();
    if (bannerUrl) previewBanner();
    openModal('createEventModal');
};

window.bannerPreviewError = function(imgEl) {
    if (imgEl.dataset.errored === 'true') return;
    imgEl.dataset.errored = 'true';
    imgEl.style.display = 'none';
    const parent = imgEl.parentElement;
    if (parent.querySelector('.banner-error-msg')) return;
    const errorDiv = document.createElement('div');
    errorDiv.className = 'banner-error-msg';
    errorDiv.style.cssText = 'padding:12px;text-align:center;color:#e11d48;font-size:0.8rem;';
    errorDiv.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Invalid or blocked image URL. Check the link or try a different image host.';
    parent.appendChild(errorDiv);
};

window.convertImageUrl = function(url) {
    if (!url) return url;
    const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (driveMatch) return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
    return url;
};

window.resolveGooglePhotosUrl = async function(url) {
    // Try Edge Function first
    try {
        const supabaseUrl = localStorage.getItem('supabaseUrl');
        if (supabaseUrl) {
            const resp = await fetch(`${supabaseUrl}/functions/v1/resolve-image-url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('supabaseKey')}` },
                body: JSON.stringify({ url })
            });
            if (resp.ok) {
                const data = await resp.json();
                if (data.directUrl) return data.directUrl;
            }
        }
    } catch {}
    // Fallback: try CORS proxy
    try {
        const resp = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
        if (!resp.ok) return null;
        const html = await resp.text();
        const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
        if (ogMatch) return ogMatch[1];
        const lhMatch = html.match(/https?:\/\/lh3\.googleusercontent\.com\/[^"'\s]+/);
        if (lhMatch) return lhMatch[0];
        return null;
    } catch {
        return null;
    }
};

window.previewBanner = function() {
    const rawUrl = document.getElementById('event-banner').value.trim();
    const preview = document.getElementById('banner-preview');
    if (!rawUrl) { preview.style.display = 'none'; return; }
    const converted = convertImageUrl(rawUrl);
    preview.style.display = 'block';
    // Reset preview: restore img element, remove any error div
    let img = document.getElementById('banner-preview-img');
    if (!img) {
        preview.innerHTML = '<img id="banner-preview-img" src="" style="width:100%; max-height:120px; object-fit:cover; display:block;" onerror="bannerPreviewError(this)">';
        img = document.getElementById('banner-preview-img');
    }
    // Remove any stale error messages
    preview.querySelectorAll('.banner-error-msg').forEach(el => el.remove());
    img.dataset.errored = 'false';
    img.style.display = 'block';
    if (converted !== rawUrl) {
        document.getElementById('event-banner').value = converted;
    }
    img.src = converted;
};

window.testBannerUrl = function() {
    const rawUrl = document.getElementById('event-banner').value.trim();
    if (!rawUrl) { showToast('Paste a URL first.', 'info'); return; }
    if (rawUrl.match(/photos\.app\.goo\.gl/i)) {
        showToast('Attempting to convert Google Photos link...', 'info');
        resolveGooglePhotosUrl(rawUrl).then(directUrl => {
            if (directUrl) {
                document.getElementById('event-banner').value = directUrl;
                previewBanner();
                showToast('Google Photos link converted! Preview above.', 'success');
            } else {
                showToast('Auto-conversion failed. Deploy "resolve-image-url" Edge Function or use imgur.com for reliable uploads.', 'error');
            }
        });
        return;
    }
    const converted = convertImageUrl(rawUrl);
    const url = converted || rawUrl;
    previewBanner();
    if (converted && converted !== rawUrl) {
        showToast('Google Drive link converted to direct image URL. Preview loading...', 'info');
    }
    fetch(url, { method: 'HEAD', mode: 'no-cors' }).then(() => {
        showToast('URL reachable. Check preview above.', 'success');
    }).catch(() => {
        showToast('URL may not be accessible (CORS/blocked). Preview above will show if valid.', 'warning');
    });
};

window.deleteEvent = async function(eventId, eventName) {
    if (!hasPermission('events:delete')) {
        showToast("Access Denied.", "error");
        return;
    }
    if (!confirm(`Delete "${eventName}"? This will also remove all associated schedules, vendors, performances, competitions, gallery photos, and visitor passes.`)) return;
    if (!sbClient) return;
    try {
        const { error } = await sbClient.from('cultural_events').delete().eq('id', eventId);
        if (error) throw error;
        showToast('Event deleted successfully!', 'success');
        eventsData = eventsData.filter(e => e.id !== eventId);
        await loadEventsList();
    } catch (err) {
        console.error('deleteEvent error:', err);
        showToast(err.message || 'Failed to delete event.', 'error');
    }
};

window.saveEvent = async function(e) {
    e.preventDefault();
    if (!sbClient || !hasPermission('events:create')) return;
    
    const id = document.getElementById('edit-event-id').value;
    let bannerUrl = document.getElementById('event-banner').value.trim();
    if (bannerUrl.match(/photos\.app\.goo\.gl/i)) {
        showToast('Google Photos links need conversion. Click "Test" to auto-convert first.', 'error');
        return;
    }
    bannerUrl = convertImageUrl(bannerUrl);
    const data = {
        name: document.getElementById('event-name').value.trim(),
        description: document.getElementById('event-description').value.trim(),
        start_date: document.getElementById('event-start-date').value,
        end_date: document.getElementById('event-end-date').value,
        contribution_amount: parseFloat(document.getElementById('event-contribution').value) || 0,
        target_amount: parseFloat(document.getElementById('event-target').value) || 0,
        banner_url: bannerUrl,
        status: document.getElementById('event-status').value,
        committee_notes: document.getElementById('event-notes').value.trim()
    };
    
    try {
        if (id) {
            const { error } = await sbClient.from('cultural_events').update(data).eq('id', id);
            if (error) throw error;
            showToast('Event updated successfully!', 'success');
        } else {
            const { error } = await sbClient.from('cultural_events').insert(data);
            if (error) throw error;
            showToast('Event created successfully!', 'success');
        }
        closeModal('createEventModal');
        await loadEventsList();
    } catch (err) {
        console.error('saveEvent error:', err);
        showToast(err.message || 'Failed to save event.', 'error');
    }
};

window.openEventDetail = async function(event) {
    currentEvent = event;
    const hasAdminPerms = hasPermission('events:create');
    const canPerform = hasPermission('events:perform');
    
    // Fetch schedules, vendors, performances, gallery
    let schedules = [], vendors = [], performances = [], gallery = [];
    try {
        const [schedRes, vendRes, perfRes] = await Promise.all([
            sbClient.from('event_schedules').select('*').eq('event_id', event.id).order('sort_order'),
            sbClient.from('event_vendors').select('*').eq('event_id', event.id),
            sbClient.from('event_performances').select('*').eq('event_id', event.id).order('slot_order')
        ]);
        schedules = schedRes.data || [];
        vendors = vendRes.data || [];
        performances = perfRes.data || [];
    } catch (err) {
        console.error('Error loading event details:', err);
    }
    
    document.getElementById('event-detail-name').textContent = event.name;
    
    const now = new Date();
    const startDate = new Date(event.start_date);
    const endDate = new Date(event.end_date);
    
    let statusHtml = '';
    if (event.status === 'completed') statusHtml = '<span class="badge badge-expense">Completed</span>';
    else if (now >= startDate && now <= endDate) statusHtml = '<span class="badge badge-income" style="background:var(--color-emerald);">Live</span>';
    else if (now < startDate) statusHtml = '<span class="badge badge-income" style="background:var(--color-indigo);">Upcoming</span>';
    else statusHtml = '<span class="badge badge-expense">Ended</span>';
    
    const dateStr = startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const endDateStr = endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    
    let bodyHtml = `
        ${event.banner_url ? `<img src="${event.banner_url}" class="event-detail-banner" onerror="this.style.display='none'">` : ''}
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
            <div>
                <p style="font-size:0.85rem; color:var(--text-secondary);">
                    <i class="fa-solid fa-calendar"></i> ${dateStr}${endDateStr !== dateStr ? ' - ' + endDateStr : ''}
                </p>
                ${event.description ? `<p style="font-size:0.85rem; color:var(--text-secondary); margin-top:4px;">${event.description}</p>` : ''}
            </div>
            ${statusHtml}
        </div>
        ${hasAdminPerms ? `<div style="margin-bottom:12px; display:flex; gap:6px;">
            <button type="button" class="btn btn-indigo" style="font-size:0.8rem; padding:4px 12px;" onclick="event.stopPropagation(); openCreateEventModal(${event.id})"><i class="fa-solid fa-pen"></i> Edit</button>
            <button type="button" class="btn btn-rose" style="font-size:0.8rem; padding:4px 12px;" onclick="event.stopPropagation(); closeModal('eventDetailModal'); setTimeout(()=>deleteEvent(${event.id}, '${event.name.replace(/'/g, "\\'")}'), 300)"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>` : ''}
        
        <div class="event-tabs" id="detail-tabs">
            <button class="event-tab active" data-tab="schedule" onclick="switchDetailTab('schedule')"><i class="fa-solid fa-list"></i> Schedule</button>
            <button class="event-tab" data-tab="stalls" onclick="switchDetailTab('stalls')"><i class="fa-solid fa-shop"></i> Food & Stalls</button>
            <button class="event-tab" data-tab="performances" onclick="switchDetailTab('performances')"><i class="fa-solid fa-palette"></i> Performances</button>
            <button class="event-tab" data-tab="competitions" onclick="switchDetailTab('competitions')"><i class="fa-solid fa-trophy"></i> Competitions</button>
            <button class="event-tab" data-tab="gallery" onclick="switchDetailTab('gallery')"><i class="fa-solid fa-image"></i> Gallery</button>
        </div>
        <div id="detail-tab-content">
            ${renderScheduleTab(schedules)}
        </div>
    `;
    
    document.getElementById('event-detail-body').innerHTML = bodyHtml;
    
    // Footer buttons
    const footer = document.getElementById('event-detail-footer');
    let footerHtml = '';
    if (canPerform && event.status !== 'completed') {
        footerHtml += `<button class="btn btn-slate" onclick="openPerformanceSignup(${event.id})"><i class="fa-solid fa-palette"></i> Register Performance</button>`;
    }
    if (hasPermission('events:generate_passes') && event.status !== 'completed') {
        footerHtml += `<button class="btn btn-slate" onclick="openVisitorPassModal(${event.id})"><i class="fa-solid fa-passport"></i> Visitor Pass</button>`;
    }
    footerHtml += `<button class="btn btn-slate" onclick="openVolunteerModal(${event.id})"><i class="fa-solid fa-handshake-angle"></i> Volunteer</button>`;
    if (hasPermission('events:create')) {
        footerHtml += `<button class="btn btn-slate" onclick="openSendNotificationModal(${event.id})"><i class="fa-solid fa-bullhorn"></i> Notify</button>`;
    }
    footerHtml += `<button type="button" class="btn btn-slate" onclick="closeModal('eventDetailModal')">Close</button>`;
    footer.innerHTML = footerHtml;
    
    openModal('eventDetailModal');
};

window.switchDetailTab = function(tabName) {
    document.querySelectorAll('.event-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabName);
    });
    
    const content = document.getElementById('detail-tab-content');
    switch (tabName) {
        case 'schedule':
            content.innerHTML = renderScheduleTab([]);
            loadTabData('schedule');
            break;
        case 'stalls':
            content.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Loading...</div>';
            loadTabData('stalls');
            break;
        case 'performances':
            content.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Loading...</div>';
            loadTabData('performances');
            break;
        case 'competitions':
            content.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Loading...</div>';
            loadTabData('competitions');
            break;
        case 'gallery':
            content.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Loading...</div>';
            loadTabData('gallery');
            break;
    }
};

async function loadTabData(tabName) {
    if (!currentEvent || !sbClient) return;
    const content = document.getElementById('detail-tab-content');
    const isAdmin = hasPermission('events:manage_vendors') || hasPermission('events:manage_competitions');
    
    try {
        if (tabName === 'schedule') {
            const { data } = await sbClient.from('event_schedules').select('*').eq('event_id', currentEvent.id).order('sort_order');
            content.innerHTML = renderScheduleTab(data || [], isAdmin);
        } else if (tabName === 'stalls') {
            const { data } = await sbClient.from('event_vendors').select('*').eq('event_id', currentEvent.id);
            content.innerHTML = renderStallsTab(data || [], isAdmin);
        } else if (tabName === 'performances') {
            const { data } = await sbClient.from('event_performances').select('*').eq('event_id', currentEvent.id).order('slot_order');
            const myFlatPerf = localStorage.getItem('currentFlatNo') || '';
            const isAdminPerf = hasPermission('events:create');
            content.innerHTML = renderPerformancesTab(data || [], myFlatPerf, isAdminPerf, currentEvent?.id);
        } else if (tabName === 'competitions') {
            const { data: comps } = await sbClient.from('event_competitions').select('*').eq('event_id', currentEvent.id);
            const { data: votes } = await sbClient.from('event_votes').select('competition_id, nominee_flat');
            content.innerHTML = renderCompetitionsTab(comps || [], votes || [], isAdmin);
        } else if (tabName === 'gallery') {
            const { data } = await sbClient.from('event_gallery').select('*').eq('event_id', currentEvent.id).order('created_at', { ascending: false });
            content.innerHTML = renderGalleryTab(data || [], hasPermission('events:upload_gallery'));
        }
    } catch (err) {
        console.error(`Error loading ${tabName}:`, err);
        content.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Failed to load data.</div>';
    }
}

function renderScheduleTab(schedules, isAdmin) {
    const adminBtns = isAdmin ? `<div style="margin-bottom:12px;"><button class="btn btn-indigo" style="font-size:0.8rem; padding:4px 12px;" onclick="openScheduleEntryModal()"><i class="fa-solid fa-plus"></i> Add Entry</button></div>` : '';
    if (!schedules || schedules.length === 0) {
        return adminBtns + '<div style="text-align:center; padding:20px; color:var(--text-muted);"><i class="fa-solid fa-clock" style="font-size:1.5rem; display:block; margin-bottom:8px;"></i>No schedule entries yet.</div>';
    }
    let html = adminBtns;
    schedules.forEach(s => {
        const timeStr = s.time_from ? `${s.time_from.slice(0,5)}${s.time_to ? ' - '+s.time_to.slice(0,5) : ''}` : '';
        html += `<div class="schedule-item">
            <div class="schedule-time">${s.day_label}${timeStr ? '<br><span style="font-weight:400;font-size:0.75rem;">'+timeStr+'</span>' : ''}</div>
            <div class="schedule-activity">
                <h4>${s.activity}</h4>
                ${s.location ? '<p><i class="fa-solid fa-location-dot"></i> '+s.location+'</p>' : ''}
                ${s.notes ? '<p>'+s.notes+'</p>' : ''}
            </div>
            ${isAdmin ? `<div style="display:flex; gap:4px; align-items:center;">
                <button class="btn btn-slate" style="padding:2px 8px; font-size:0.7rem;" onclick="editScheduleEntry(${s.id})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-rose" style="padding:2px 8px; font-size:0.7rem;" onclick="deleteScheduleEntry(${s.id})"><i class="fa-solid fa-trash-can"></i></button>
            </div>` : ''}
        </div>`;
    });
    return html;
}

function renderStallsTab(vendors, isAdmin) {
    const adminBtns = isAdmin ? `<div style="margin-bottom:12px;"><button class="btn btn-indigo" style="font-size:0.8rem; padding:4px 12px;" onclick="openVendorModal()"><i class="fa-solid fa-plus"></i> Add Vendor</button></div>` : '';
    if (!vendors || vendors.length === 0) {
        return adminBtns + '<div style="text-align:center; padding:20px; color:var(--text-muted);"><i class="fa-solid fa-shop" style="font-size:1.5rem; display:block; margin-bottom:8px;"></i>No stalls or vendors registered yet.</div>';
    }
    let html = adminBtns;
    vendors.forEach(v => {
        html += `<div class="stall-card">
            <span class="stall-no">${v.stall_no || '-'}</span>
            <span class="stall-name">${v.vendor_name}</span>
            <span class="stall-category">${v.category}</span>
            <span style="font-weight:600;">₹${v.amount.toLocaleString()}</span>
            <span class="${v.status === 'confirmed' ? 'badge badge-income' : 'badge badge-expense'}">${v.status}</span>
            ${isAdmin ? `<div style="display:flex; gap:4px;">
                <button class="btn btn-slate" style="padding:2px 8px; font-size:0.7rem;" onclick="editVendor(${v.id})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-rose" style="padding:2px 8px; font-size:0.7rem;" onclick="deleteVendor(${v.id})"><i class="fa-solid fa-trash-can"></i></button>
            </div>` : ''}
        </div>`;
    });
    return html;
}

function renderCompetitionsTab(competitions, votes, isAdmin) {
    const adminBtns = isAdmin ? `<div style="margin-bottom:12px;"><button class="btn btn-indigo" style="font-size:0.8rem; padding:4px 12px;" onclick="openCompetitionModal()"><i class="fa-solid fa-plus"></i> New Competition</button></div>` : '';
    if (!competitions || competitions.length === 0) {
        return adminBtns + '<div style="text-align:center; padding:20px; color:var(--text-muted);"><i class="fa-solid fa-trophy" style="font-size:1.5rem; display:block; margin-bottom:8px;"></i>No competitions yet.</div>';
    }
    let html = adminBtns;
    competitions.forEach(c => {
        const voteCount = (votes || []).filter(v => v.competition_id === c.id).length;
        const canVote = hasPermission('events:vote') && c.judge_type !== 'judges' && c.status === 'open';
        const canScore = hasPermission('events:score') && c.judge_type !== 'residents' && c.status !== 'declared';
        html += `<div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--border-radius-sm); padding:12px; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h4 style="font-size:0.95rem; font-weight:700; margin:0;">${c.name}</h4>
                    <p style="font-size:0.8rem; color:var(--text-secondary); margin:2px 0;">${c.description || ''}</p>
                    <p style="font-size:0.75rem; color:var(--text-muted);">
                        ${c.judge_type === 'residents' ? 'Resident Voting' : c.judge_type === 'judges' ? 'Judges Only' : 'Resident Voting + Judges'} 
                        | Max Score: ${c.max_score} 
                        | <span class="badge ${c.status === 'open' ? 'badge-income' : c.status === 'closed' ? 'badge-tenant' : 'badge-expense'}">${c.status}</span>
                        ${voteCount > 0 ? ` | ${voteCount} vote(s)` : ''}
                    </p>
                </div>
                <div style="display:flex; gap:6px;">
                    ${canVote ? `<button class="btn btn-indigo" style="padding:4px 10px; font-size:0.75rem;" onclick="voteCompetition(${c.id})"><i class="fa-solid fa-thumbs-up"></i> Vote</button>` : ''}
                    ${canScore ? `<button class="btn btn-emerald" style="padding:4px 10px; font-size:0.75rem;" onclick="openScoreModal(${c.id})"><i class="fa-solid fa-star"></i> Score</button>` : ''}
                    ${isAdmin ? `
                        <button class="btn btn-slate" style="padding:4px 10px; font-size:0.75rem;" onclick="editCompetition(${c.id})"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-rose" style="padding:4px 10px; font-size:0.75rem;" onclick="deleteCompetition(${c.id})"><i class="fa-solid fa-trash-can"></i></button>
                    ` : ''}
                </div>
            </div>
        </div>`;
    });
    return html;
}

let _performancesData = [];

function renderPerformancesTab(performances, myFlat = '', isAdmin = false, eventId = null) {
    _performancesData = performances || [];
    if (!performances || performances.length === 0) {
        return '<div style="text-align:center; padding:20px; color:var(--text-muted);"><i class="fa-solid fa-palette" style="font-size:1.5rem; display:block; margin-bottom:8px;"></i>No performances registered yet.<br><span style="font-size:0.8rem;">Be the first to sign up!</span></div>';
    }
    let html = '';
    performances.forEach(p => {
        const canEdit = isAdmin || (p.flat_no === myFlat);
        html += `<div class="performance-item">
            <div>
                <div class="performer">${p.performer_name} ${p.is_star ? '<span style="display:inline-flex;align-items:center;gap:2px;font-size:0.65rem;font-weight:700;color:#92400e;background:#fef3c7;padding:1px 6px;border-radius:10px;margin-left:4px;vertical-align:middle;"><i class="fa-solid fa-star" style="color:#f59e0b;"></i> STAR</span>' : ''}</div>
                <div class="perf-type"><i class="fa-solid fa-music"></i> ${p.performance_type}</div>
                ${p.flat_no ? `<div style="font-size:0.7rem;color:var(--text-muted);">Flat ${p.flat_no}</div>` : ''}
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                <span class="perf-status">${p.status}</span>
                ${p.requirements ? `<span style="font-size:0.7rem;color:var(--text-muted);">${p.requirements}</span>` : ''}
                ${canEdit ? `<div style="display:flex; gap:4px; margin-top:2px;">
                    <button class="btn btn-indigo" style="font-size:0.6rem; padding:1px 6px;" onclick="openPerformanceSignup(${eventId || currentEvent?.id}, ${p.id})"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-rose" style="font-size:0.6rem; padding:1px 6px;" onclick="deletePerformance(${p.id}, '${p.performer_name.replace(/'/g, "\\'")}')"><i class="fa-solid fa-trash"></i></button>
                </div>` : ''}
            </div>
        </div>`;
    });
    return html;
}

function renderGalleryTab(photos, canUpload) {
    const uploadBtn = canUpload ? `<div style="margin-bottom:12px;"><button class="btn btn-indigo" style="font-size:0.8rem; padding:4px 12px;" onclick="openGalleryPhotoModal(${currentEvent?.id})"><i class="fa-solid fa-plus"></i> Add Photo</button></div>` : '';
    if (!photos || photos.length === 0) {
        return uploadBtn + '<div style="text-align:center; padding:20px; color:var(--text-muted);"><i class="fa-solid fa-image" style="font-size:1.5rem; display:block; margin-bottom:8px;"></i>No photos yet.</div>';
    }
    let html = uploadBtn + '<div class="gallery-grid">';
    photos.forEach(p => {
        html += `<div style="position:relative;">
            <img src="${p.image_url}" alt="${p.caption || 'Photo'}" onerror="this.parentElement.innerHTML='<div style=\\'text-align:center;padding:20px;color:var(--text-muted);font-size:0.8rem;\\'><i class=\\'fa-solid fa-image\\'></i><br>Failed to load</div>'">
            ${p.caption ? `<div style="font-size:0.75rem; color:var(--text-secondary); padding:4px 0; text-align:center;">${p.caption}</div>` : ''}
            ${canUpload ? `<button class="btn btn-rose" style="position:absolute; top:4px; right:4px; padding:2px 6px; font-size:0.7rem;" onclick="deleteGalleryPhoto(${p.id})"><i class="fa-solid fa-xmark"></i></button>` : ''}
        </div>`;
    });
    html += '</div>';
    return html;
}

// === GOOGLE DRIVE PICKER ===
function getGdriveCredentials() {
    const key = buildingConfig?.google_api_key || '';
    const cid = buildingConfig?.google_client_id || '';
    return { key, clientId: cid };
}

function hasGdriveCredentials() {
    const { key, clientId } = getGdriveCredentials();
    return !!(key && clientId);
}

window.showGdriveSetupGuide = function() {
    const html = `
        <div style="font-size:0.85rem; line-height:1.6; color:var(--text-primary);">
            <h3 style="margin-bottom:10px;"><i class="fa-brands fa-google"></i> Google Drive Setup Guide</h3>
            <ol style="padding-left:18px; display:flex; flex-direction:column; gap:8px;">
                <li>Go to <a href="https://console.cloud.google.com/" target="_blank" style="color:var(--color-indigo);">Google Cloud Console</a></li>
                <li>Create a new project or select an existing one</li>
                <li>Go to <strong>APIs &amp; Services → Library</strong> and enable the <strong>Google Picker API</strong></li>
                <li>Go to <strong>APIs &amp; Services → Credentials</strong></li>
                <li>Click <strong>Create Credentials → API Key</strong> — copy the key</li>
                <li>Click <strong>Create Credentials → OAuth client ID</strong>
                    <ul style="padding-left:16px; margin-top:4px;">
                        <li>Application type: <strong>Web application</strong></li>
                        <li>Name: <strong>Residence Management Gallery</strong></li>
                        <li>Authorized JavaScript origins: add your domain (e.g. <code>http://localhost:5173</code> and your production URL)</li>
                        <li>Click <strong>Create</strong> and copy the Client ID</li>
                    </ul>
                </li>
                <li><strong>Optional:</strong> In <strong>OAuth consent screen</strong>, add the scope <code>.../auth/drive.readonly</code> and test users</li>
                <li>Paste the <strong>API Key</strong> and <strong>Client ID</strong> in the Building Setup form above</li>
            </ol>
            <p style="margin-top:10px; color:var(--text-muted);">Users will see a Google pop-up to select photos from their Drive. Only image files are supported.</p>
        </div>
    `;
    showCustomModal('Google Drive Setup Guide', html);
};

window.initGoogleDrivePicker = function() {
    if (gdrivePickerInited) return;
    if (!hasGdriveCredentials()) return;
    gdrivePickerInited = true;
    const { key, clientId } = getGdriveCredentials();
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = function() {
        gapi.load('picker', function() {
            googlePickerReady = true;
            console.log('Google Picker API loaded');
        });
    };
    document.head.appendChild(script);
};

let _pickerCallback = null;

window.openDrivePicker = function(callback) {
    if (!hasGdriveCredentials() || !googlePickerReady) {
        showToast('Google Drive not configured or still loading. Use manual URL instead.', 'error');
        return;
    }
    const { key, clientId } = getGdriveCredentials();
    _pickerCallback = callback;

    gapi.load('auth', function() {
        gapi.auth.authorize({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/drive.readonly',
            immediate: false
        }, function(authResult) {
            if (authResult && !authResult.error) {
                const picker = new google.picker.PickerBuilder()
                    .addView(google.picker.ViewId.PHOTOS)
                    .addView(google.picker.ViewId.DOCS_IMAGES_AND_VIDEOS)
                    .setOAuthToken(authResult.access_token)
                    .setDeveloperKey(key)
                    .setCallback(function(data) {
                        if (data.action === google.picker.Action.PICKED) {
                            const doc = data.docs[0];
                            const url = doc.url || doc.embedUrl || '';
                            if (_pickerCallback) _pickerCallback(url);
                            _pickerCallback = null;
                        }
                    })
                    .build();
                picker.setVisible(true);
            } else {
                showToast('Google Drive authentication failed or was cancelled.', 'error');
            }
        });
    });
};

// === PUSH NOTIFICATIONS ===
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
}

window.showVapidSetupGuide = function() {
    const html = `
        <div style="font-size:0.85rem; line-height:1.6; color:var(--text-primary);">
            <h3 style="margin-bottom:10px;"><i class="fa-solid fa-bell"></i> Push Notification Setup Guide</h3>
            <p>VAPID keys identify your application server to the browser push service.</p>
            <ol style="padding-left:18px; display:flex; flex-direction:column; gap:8px; margin-top:10px;">
                <li>Click <strong>"Generate Keys"</strong> in the Building Setup form — this creates a public/private key pair in your browser</li>
                <li>Or visit <a href="https://web-push-codelab.glitch.me/" target="_blank" style="color:var(--color-indigo);">web-push-codelab</a> to generate keys manually</li>
                <li>Paste both keys into the form and save</li>
            </ol>
            <p style="margin-top:10px; color:var(--text-muted);">After saving, residents will be prompted to enable notifications. Admins can send notifications from event details.</p>
        </div>
    `;
    showCustomModal('Push Notification Setup', html);
};

window.generateVapidKeys = async function() {
    try {
        const key = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
        const publicKey = await crypto.subtle.exportKey('raw', key.publicKey);
        const privateKey = await crypto.subtle.exportKey('pkcs8', key.privateKey);
        const pubB64 = btoa(String.fromCharCode(...new Uint8Array(publicKey))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        const privB64 = btoa(String.fromCharCode(...new Uint8Array(privateKey))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        document.getElementById('cfg-vapid-public').value = pubB64;
        document.getElementById('cfg-vapid-private').value = privB64;
        showToast('VAPID keys generated! Save the configuration.', 'success');
    } catch (err) {
        console.error('generateVapidKeys error:', err);
        showToast('Failed to generate keys. Try the manual method.', 'error');
    }
};

window.registerPushSubscription = async function() {
    if (!buildingConfig?.vapid_public_key || !buildingConfig?.vapid_private_key) {
        showToast('Push notifications not configured. Ask admin to set up VAPID keys.', 'info');
        return false;
    }
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        showToast('Push notifications not supported in this browser.', 'error');
        return false;
    }
    if (Notification.permission === 'denied') {
        showToast('Notifications blocked. Enable them in browser settings.', 'error');
        return false;
    }
    if (Notification.permission === 'granted') {
        return await doSubscribe();
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        return await doSubscribe();
    }
    showToast('Notification permission denied.', 'info');
    return false;
};

async function doSubscribe() {
    try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(buildingConfig.vapid_public_key)
        });
        const subJson = subscription.toJSON();
        const flatNo = localStorage.getItem('currentFlatNo') || '';
        if (!sbClient) return false;
        const { error } = await sbClient.from('push_subscriptions').upsert({
            flat_no: flatNo,
            endpoint: subJson.endpoint,
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
            user_agent: navigator.userAgent || '',
            last_active: new Date().toISOString()
        }, { onConflict: 'endpoint' });
        if (error) throw error;
        localStorage.setItem('pushSubscribed', 'true');
        showToast('Push notifications enabled!', 'success');
        updateNotificationBtn();
        return true;
    } catch (err) {
        console.error('doSubscribe error:', err);
        showToast('Failed to subscribe: ' + err.message, 'error');
        return false;
    }
}

window.unregisterPushSubscription = async function() {
    try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                await subscription.unsubscribe();
                const { error } = await sbClient.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
                if (error) console.error('Error removing subscription:', error);
            }
        }
        localStorage.setItem('pushSubscribed', 'false');
        showToast('Notifications disabled.', 'info');
        updateNotificationBtn();
    } catch (err) {
        console.error('unregisterPushSubscription error:', err);
    }
};

window.togglePushSubscription = async function() {
    const enabled = localStorage.getItem('pushSubscribed') === 'true';
    if (enabled) {
        await unregisterPushSubscription();
    } else {
        await registerPushSubscription();
    }
};

window.updateNotificationBtn = function() {
    const btn = document.getElementById('side-notif-toggle');
    if (!btn) return;
    const enabled = localStorage.getItem('pushSubscribed') === 'true';
    btn.innerHTML = enabled
        ? '<i class="fa-solid fa-bell"></i><span>Notifications: ON</span>'
        : '<i class="fa-solid fa-bell-slash"></i><span>Notifications: OFF</span>';
};

window.openSendNotificationModal = function(eventId) {
    document.getElementById('notif-event-id').value = eventId;
    const event = eventsData.find(e => e.id === eventId) || currentEvent;
    document.getElementById('notif-title').value = event ? `${event.name} — Update` : 'Event Update';
    document.getElementById('notif-message').value = '';
    document.getElementById('btn-send-notif').disabled = false;
    document.getElementById('btn-send-notif').innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send';
    openModal('sendNotificationModal');
};

window.sendEventNotificationFromModal = async function(e) {
    e.preventDefault();
    const eventId = Number(document.getElementById('notif-event-id').value);
    const title = document.getElementById('notif-title').value;
    const message = document.getElementById('notif-message').value;
    const btn = document.getElementById('btn-send-notif');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
    
    // Log notification to a notifications table for history
    try {
        if (sbClient) {
            await sbClient.from('event_notifications').insert({
                event_id: eventId, title, message, sent_at: new Date().toISOString()
            }).catch(() => {}); // table may not exist
        }
    } catch (_) {}
    
    await sendEventNotification(eventId, title, message);
    closeModal('sendNotificationModal');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send';
};

window.sendEventNotification = async function(eventId, title, body) {
    if (!hasPermission('events:create')) { showToast('Access Denied.', 'error'); return; }
    if (!sbClient) return;
    const event = eventsData.find(e => e.id === eventId) || currentEvent;
    if (!event) return;
    try {
        const edgeUrl = `${localStorage.getItem('supabaseUrl')}/functions/v1/send-notification`;
        const anonKey = localStorage.getItem('supabaseKey');
        const response = await fetch(edgeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
            body: JSON.stringify({ event_id: eventId, title, body, building_name: getBuildingName() })
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(errText || response.statusText);
        }
        showToast('Notification sent to all subscribers!', 'success');
    } catch (err) {
        console.error('sendEventNotification error:', err);
        showToast('Edge Function not deployed. Send failed: ' + err.message, 'error');
    }
};

window.sendCommunityBoardNotification = async function(post) {
    if (!sbClient || !post) return;
    try {
        const category = BOARD_CATEGORIES.find(c => c.slug === post.category_slug)?.name || 'Community Board';
        const title = 'New Community Board Post';
        const body = `${category}${post.tag ? ' • ' + post.tag : ''}: ${post.title}`;
        try {
            await sbClient.from('community_notifications').insert({
                post_id: post.id,
                title,
                message: body,
                sent_by: currentUserId,
                sent_at: new Date().toISOString()
            });
        } catch (_) {}
        const edgeUrl = `${localStorage.getItem('supabaseUrl')}/functions/v1/send-notification`;
        const anonKey = localStorage.getItem('supabaseKey');
        const response = await fetch(edgeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
            body: JSON.stringify({
                title,
                body,
                building_name: getBuildingName(),
                url: '/?open=board'
            })
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(errText || response.statusText);
        }
    } catch (err) {
        console.error('sendCommunityBoardNotification error:', err);
    }
};

// === GALLERY ===
window.openGalleryPhotoModal = function(eventId) {
    if (!hasPermission('events:upload_gallery')) return;
    document.getElementById('gallery-event-id').value = eventId;
    document.getElementById('gallery-url').value = '';
    document.getElementById('gallery-caption').value = '';
    const area = document.getElementById('gdrive-btn-area');
    if (area) {
        area.style.display = hasGdriveCredentials() ? 'block' : 'none';
    }
    openModal('galleryPhotoModal');
};

window.pickDrivePhoto = function(url) {
    if (url) {
        document.getElementById('gallery-url').value = url;
        document.getElementById('gallery-url').dispatchEvent(new Event('input'));
        showToast('Photo selected from Google Drive!', 'success');
    }
};

window.addGalleryPhoto = async function(e) {
    e.preventDefault();
    if (!sbClient || !hasPermission('events:upload_gallery')) return;
    const eventId = Number(document.getElementById('gallery-event-id').value);
    const imageUrl = document.getElementById('gallery-url').value;
    const caption = document.getElementById('gallery-caption').value;
    const folder = document.getElementById('gallery-folder').value;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    try {
        const { error } = await sbClient.from('event_gallery').insert({
            event_id: eventId, image_url: imageUrl, caption
        });
        if (error) throw error;
        showToast('Photo added to gallery!', 'success');
        closeModal('galleryPhotoModal');
        loadTabData('gallery');
    } catch (err) {
        console.error('addGalleryPhoto error:', err);
        showToast(err.message || 'Failed to add photo.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Add Photo';
    }
};

window.deleteGalleryPhoto = async function(photoId) {
    if (!sbClient || !hasPermission('events:upload_gallery')) return;
    if (!confirm('Delete this photo?')) return;
    try {
        const { error } = await sbClient.from('event_gallery').delete().eq('id', photoId);
        if (error) throw error;
        showToast('Photo deleted.', 'success');
        loadTabData('gallery');
    } catch (err) {
        console.error('deleteGalleryPhoto error:', err);
        showToast(err.message || 'Failed to delete.', 'error');
    }
};

// === EXPENSES ===
window.openExpenseModal = function(eventId) {
    if (!hasPermission('events:manage_vendors')) return;
    document.getElementById('expense-event-id').value = eventId;
    document.getElementById('expense-desc').value = '';
    document.getElementById('expense-amount').value = '';
    document.getElementById('expense-category').value = 'decoration';
    document.getElementById('expense-vendor').value = '';
    document.getElementById('expense-invoice').value = '';
    openModal('eventExpenseModal');
};

window.addEventExpense = async function(e) {
    e.preventDefault();
    if (!sbClient || !hasPermission('events:manage_vendors')) return;
    const eventId = Number(document.getElementById('expense-event-id').value);
    const description = document.getElementById('expense-desc').value;
    const amount = Number(document.getElementById('expense-amount').value);
    const category = document.getElementById('expense-category').value;
    const vendorName = document.getElementById('expense-vendor').value;
    const invoiceUrl = document.getElementById('expense-invoice').value;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    try {
        const { error } = await sbClient.from('event_expenses').insert({
            event_id: eventId, description, amount, category,
            vendor_name: vendorName, invoice_url: invoiceUrl
        });
        if (error) throw error;
        showToast('Expense added!', 'success');
        closeModal('eventExpenseModal');
        loadEventContributionsFinance();
    } catch (err) {
        console.error('addEventExpense error:', err);
        showToast(err.message || 'Failed to add expense.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Add Expense';
    }
};

// === VOLUNTEERS ===
window.openVolunteerModal = function(eventId) {
    const flatNo = localStorage.getItem('currentFlatNo') || '';
    document.getElementById('volunteer-event-id').value = eventId;
    document.getElementById('volunteer-name').value = '';
    document.getElementById('volunteer-contact').value = '';
    document.getElementById('volunteer-role').value = '';
    document.getElementById('volunteer-availability').value = '';
    openModal('volunteerModal');
};

window.submitVolunteer = async function(e) {
    e.preventDefault();
    if (!sbClient) return;
    const eventId = Number(document.getElementById('volunteer-event-id').value);
    const flatNo = localStorage.getItem('currentFlatNo') || '';
    const name = document.getElementById('volunteer-name').value;
    const contact = document.getElementById('volunteer-contact').value;
    const rolePref = document.getElementById('volunteer-role').value;
    const availability = document.getElementById('volunteer-availability').value;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    try {
        const { error } = await sbClient.from('event_volunteers').insert({
            event_id: eventId, flat_no: flatNo, volunteer_name: name,
            contact, role_preference: rolePref, availability
        });
        if (error) throw error;
        showToast('You have signed up as a volunteer!', 'success');
        closeModal('volunteerModal');
    } catch (err) {
        console.error('submitVolunteer error:', err);
        showToast(err.message || 'Failed to sign up.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Sign Up';
    }
};

// === CONTRIBUTION PAYMENT ===
window.openContributionModal = function(eventId) {
    if (!hasPermission('events:contribute')) {
        showToast("Access Denied.", "error");
        return;
    }
    const event = eventsData.find(e => e.id === eventId) || currentEvent;
    if (!event) return;
    
    // Get current user's flat
    let flatNo = localStorage.getItem('currentFlatNo') || '';
    const userEmail = localStorage.getItem('userEmail') || '';
    
    document.getElementById('contrib-event-id').value = event.id;
    document.getElementById('contrib-event-name').textContent = event.name;
    document.getElementById('contrib-flat-info').textContent = flatNo ? `Flat ${flatNo}` : userEmail ? `User: ${userEmail}` : '';
    document.getElementById('contrib-amount-display').textContent = `₹${Number(event.contribution_amount || 0).toLocaleString()}`;
    document.getElementById('contrib-late-fee').textContent = '₹0';
    document.getElementById('contrib-total').textContent = `₹${Number(event.contribution_amount || 0).toLocaleString()}`;
    document.getElementById('contrib-voluntary-check').checked = false;
    document.getElementById('contrib-voluntary-row').style.display = 'none';
    document.getElementById('contrib-voluntary-amount').value = '';
    
    openModal('payContributionModal');
};

window.toggleVoluntary = function() {
    const checked = document.getElementById('contrib-voluntary-check').checked;
    document.getElementById('contrib-voluntary-row').style.display = checked ? 'block' : 'none';
    updateContributionTotal();
};

function updateContributionTotal() {
    const eventId = document.getElementById('contrib-event-id').value;
    const event = eventsData.find(e => e.id === Number(eventId));
    if (!event) return;
    let total = Number(event.contribution_amount || 0);
    if (document.getElementById('contrib-voluntary-check').checked) {
        total += Number(document.getElementById('contrib-voluntary-amount').value) || 0;
    }
    document.getElementById('contrib-total').textContent = `₹${total.toLocaleString()}`;
}

// Finance module: open contribution modal for the event selected in the finance dropdown
window.openContributionModalFromFinance = function() {
    const select = document.getElementById('finance-event-select');
    const eventId = Number(select.value);
    if (!eventId) { showToast('Select an event first.', 'error'); return; }
    openContributionModal(eventId);
};

// Finance module: open expense modal for the event selected in the finance dropdown
window.openExpenseModalFromFinance = function() {
    const select = document.getElementById('finance-event-select');
    const eventId = Number(select.value);
    if (!eventId) { showToast('Select an event first.', 'error'); return; }
    if (!hasPermission('events:manage_vendors')) { showToast('Access Denied.', 'error'); return; }
    openExpenseModal(eventId);
};

// Finance module: load events dropdown + contributions & expenses for selected event
window.loadEventContributionsFinance = async function() {
    const container = document.getElementById('finance-event-contributions');
    const select = document.getElementById('finance-event-select');
    const eventId = Number(select.value);
    const canManageExpenses = hasPermission('events:manage_vendors');

    // Populate dropdown if empty
    if (select.options.length <= 1 && sbClient) {
        try {
            const { data } = await sbClient.from('cultural_events').select('id, name').order('start_date', { ascending: false });
            (data || []).forEach(ev => {
                const opt = document.createElement('option');
                opt.value = ev.id;
                opt.textContent = ev.name;
                select.appendChild(opt);
            });
        } catch (err) {
            console.error('load events for finance:', err);
        }
        if (eventId) select.value = eventId;
    }

    if (!eventId) {
        container.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; padding:8px 0;">Select an event to view contributions & expenses.</p>';
        return;
    }

    container.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; padding:12px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</p>';

    try {
        const [evtRes, incRes, expRes] = await Promise.all([
            sbClient.from('cultural_events').select('id, name, contribution_amount, target_amount').eq('id', eventId).maybeSingle(),
            sbClient.from('income').select('flat_no, amount, date_received').eq('category', 'Cultural Event').eq('event_id', eventId).order('date_received', { ascending: false }),
            sbClient.from('event_expenses').select('*').eq('event_id', eventId).order('created_at', { ascending: false })
        ]);
        const event = evtRes.data;
        const contributions = incRes.data || [];
        const expenses = expRes.data || [];
        const totalCollected = contributions.reduce((s, c) => s + Number(c.amount || 0), 0);
        const totalSpent = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
        const balance = totalCollected - totalSpent;
        const count = contributions.length;
        const target = event?.target_amount || 0;
        const collectFill = target > 0 ? Math.min(100, (totalCollected / target) * 100) : 0;
        const maxVal = Math.max(totalCollected, totalSpent, target, 1);
        const spentPct = (totalSpent / maxVal) * 100;
        const collectPct = (totalCollected / maxVal) * 100;

        let html = `
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:10px;">
                <div style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.2); border-radius:8px; padding:10px; text-align:center;">
                    <div style="font-size:1rem; font-weight:800; color:var(--color-emerald);">₹${totalCollected.toLocaleString()}</div>
                    <div style="font-size:0.7rem; color:var(--text-secondary);">Collected</div>
                </div>
                <div style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); border-radius:8px; padding:10px; text-align:center;">
                    <div style="font-size:1rem; font-weight:800; color:var(--color-rose);">₹${totalSpent.toLocaleString()}</div>
                    <div style="font-size:0.7rem; color:var(--text-secondary);">Spent</div>
                </div>
                <div style="background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.2); border-radius:8px; padding:10px; text-align:center;">
                    <div style="font-size:1rem; font-weight:800; color:${balance >= 0 ? 'var(--color-emerald)' : 'var(--color-rose)'};">₹${balance.toLocaleString()}</div>
                    <div style="font-size:0.7rem; color:var(--text-secondary);">Balance</div>
                </div>
            </div>
            ${target > 0 ? `
            <div style="margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-bottom:2px;">
                    <span>Collected: ₹${totalCollected.toLocaleString()}</span>
                    <span>Target: ₹${target.toLocaleString()}</span>
                </div>
                <div style="height:5px; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden;">
                    <div style="height:100%; background:var(--color-emerald); border-radius:3px; width:${collectFill}%;"></div>
                </div>
            </div>` : ''}
            <div style="margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-bottom:2px;">
                    <span>Collected</span>
                    <span>Spent</span>
                </div>
                <div style="height:16px; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden; display:flex;">
                    <div style="height:100%; background:var(--color-emerald); width:${collectPct}%; transition:width 0.5s;"></div>
                    <div style="height:100%; background:var(--color-rose); width:${spentPct}%; transition:width 0.5s;"></div>
                </div>
            </div>
            ${canManageExpenses ? `<div style="margin-bottom:10px;"><button class="btn btn-indigo" style="font-size:0.75rem; padding:3px 10px;" onclick="openExpenseModalFromFinance()"><i class="fa-solid fa-plus"></i> Add Expense</button></div>` : ''}
            ${expenses.length > 0 ? `
            <div style="margin-bottom:10px;">
                <h4 style="font-size:0.8rem; font-weight:700; margin-bottom:4px;"><i class="fa-solid fa-receipt"></i> Event Expenses</h4>
                ${expenses.map(e => `
                    <div style="display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px solid rgba(255,255,255,0.04); font-size:0.8rem;">
                        <div>
                            <span style="font-weight:600;">${e.description}</span>
                            <span style="color:var(--text-muted); margin-left:4px;">(${e.category})</span>
                            ${e.vendor_name ? `<span style="color:var(--text-muted);"> - ${e.vendor_name}</span>` : ''}
                        </div>
                        <div style="text-align:right;">
                            <span style="color:var(--color-rose); font-weight:600;">-₹${Number(e.amount).toLocaleString()}</span>
                            ${e.invoice_url ? ` <a href="${e.invoice_url}" target="_blank" style="color:var(--color-indigo); font-size:0.7rem;">Invoice</a>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>` : ''}
            <div>
                <h4 style="font-size:0.8rem; font-weight:700; margin-bottom:4px;">Resident Contributions (${count})</h4>
                ${count === 0 ? '<p style="font-size:0.8rem; color:var(--text-muted);">No contributions yet.</p>' : ''}
                ${contributions.map(c => `
                    <div style="display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px solid rgba(255,255,255,0.04); font-size:0.8rem;">
                        <span style="font-weight:600;">${c.flat_no}</span>
                        <span>₹${Number(c.amount).toLocaleString()} <span style="color:var(--text-muted); font-size:0.7rem;">${c.date_received ? new Date(c.date_received).toLocaleDateString('en-IN') : ''}</span></span>
                    </div>
                `).join('')}
            </div>
        `;
        container.innerHTML = html;
    } catch (err) {
        console.error('loadEventContributionsFinance error:', err);
        container.innerHTML = '<p style="color:var(--color-rose); font-size:0.85rem;">Error loading data.</p>';
    }
};

window.submitContribution = async function(e) {
    e.preventDefault();
    if (!sbClient || !hasPermission('events:contribute')) return;
    
    const eventId = Number(document.getElementById('contrib-event-id').value);
    const event = eventsData.find(ev => ev.id === eventId);
    if (!event) { showToast('Event not found.', 'error'); return; }
    
    const flatNo = localStorage.getItem('currentFlatNo') || 'Unknown';
    const amount = Number(event.contribution_amount || 0);
    const voluntary = document.getElementById('contrib-voluntary-check').checked ? (Number(document.getElementById('contrib-voluntary-amount').value) || 0) : 0;
    const total = amount + voluntary;
    const paymentMode = document.getElementById('contrib-payment-mode').value;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.toLocaleString('en-US', { month: 'long' });
    const dateStr = now.toISOString().split('T')[0];
    
    const submitBtn = document.getElementById('btn-pay-contribution');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
    
    try {
        const { data, error } = await sbClient.from('income').insert({
            flat_no: flatNo,
            year: String(year),
            month: month,
            amount: total,
            date_received: dateStr,
            category: 'Cultural Event',
            event_name: event.name,
            event_id: event.id,
            remarks: `Voluntary: ₹${voluntary}, Mode: ${paymentMode}`
        }).select('id').single();
        
        if (error) throw error;
        
        lastContributionData = {
            id: data.id,
            flat_no: flatNo,
            amount: total,
            baseAmount: amount,
            voluntaryAmount: voluntary,
            paymentMode: paymentMode,
            eventName: event.name,
            date: dateStr,
            receiptNo: `RWA/EVT/${year}/${flatNo.replace(/\s/g, '')}`
        };
        currentSuccessEventId = event.id;
        
        closeModal('payContributionModal');
        
        // Show success
        document.getElementById('contrib-success-amount').textContent = `₹${total.toLocaleString()}`;
        document.getElementById('contrib-success-details').innerHTML = `
            <p><strong>Receipt No:</strong> ${lastContributionData.receiptNo}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} | ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
            <p><strong>Payment Mode:</strong> ${paymentMode}</p>
            <p><strong>Event:</strong> ${event.name}</p>
            <p style="color:var(--text-muted); font-size:0.8rem; margin-top:8px;">Your society ledger has been updated instantly.</p>
        `;
        openModal('contribSuccessModal');
        
        showToast(`Contribution of ₹${total} recorded for ${event.name}!`, 'success');
        await loadEventsList();
    } catch (err) {
        console.error('submitContribution error:', err);
        showToast(err.message || 'Failed to record contribution.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Proceed to Pay';
    }
};

window.downloadContributionReceipt = function() {
    if (!lastContributionData) {
        showToast('No receipt data available.', 'error');
        return;
    }
    const d = lastContributionData;
    const { jsPDF } = window.jspdf;
    if (!jsPDF) { showToast('PDF library not loaded.', 'error'); return; }
    
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' });
    const name = getBuildingName();
    const block = getBlockName();
    const fullName = block ? `${name} (${block})` : name;
    
    // Border
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.3);
    doc.rect(5, 5, 200, 138);
    
    // Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(fullName, 105, 20, { align: 'center' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Cultural Event Contribution Receipt', 105, 26, { align: 'center' });
    
    // Watermark
    doc.setFontSize(22);
    doc.setTextColor(200, 200, 200);
    doc.setFont('helvetica', 'bold');
    doc.text('RECEIPT', 105, 75, { align: 'center', angle: 30 });
    doc.setTextColor(0, 0, 0);
    
    // Receipt metadata
    doc.setFontSize(8);
    doc.text(`Receipt No: ${d.receiptNo}`, 12, 34);
    doc.text(`Date: ${new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, 12, 39);
    doc.text(`Financial Year: FY ${new Date().getFullYear()}-${(new Date().getFullYear() + 1) % 100}`, 12, 44);
    
    // Resident details
    doc.setFont('helvetica', 'bold');
    doc.text('Resident Details', 12, 52);
    doc.setFont('helvetica', 'normal');
    doc.text(`Flat No: ${d.flat_no}`, 12, 58);
    
    // Table
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(12, 65, 198, 65);
    doc.setFont('helvetica', 'bold');
    doc.text('Description', 14, 71);
    doc.text('Amount', 160, 71);
    doc.line(12, 74, 198, 74);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Subscription for ${d.eventName}`, 14, 80);
    doc.text(`₹${d.baseAmount.toLocaleString()}`, 160, 80);
    
    if (d.voluntaryAmount > 0) {
        doc.text('Voluntary Donation', 14, 86);
        doc.text(`₹${d.voluntaryAmount.toLocaleString()}`, 160, 86);
    }
    
    doc.line(12, 90, 198, 90);
    doc.setFont('helvetica', 'bold');
    doc.text('Total', 14, 96);
    doc.text(`₹${d.amount.toLocaleString()}`, 160, 96);
    
    // Amount in words
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const words = numberToWords(d.amount);
    doc.text(`Rupees ${words} Only`, 14, 104);
    
    // Footer
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('This is a digitally generated receipt, no physical signature required.', 105, 118, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('RWA Managing Committee', 105, 125, { align: 'center' });
    
    try {
        const pdfDataUri = doc.output('datauristring');
        const newTab = window.open();
        if (newTab) {
            newTab.document.write(`<iframe width='100%' height='100%' src='${pdfDataUri}'></iframe>`);
        } else {
            doc.save(`Receipt_${d.receiptNo}.pdf`);
        }
    } catch (err) {
        console.error('PDF output error:', err);
        showToast(err.message || 'Failed to generate PDF.', 'error');
    }
};

// === PERFORMANCE SIGNUP ===
window.openPerformanceSignup = async function(eventId, perfId = null) {
    const perfData = perfId ? _performancesData.find(p => p.id === perfId) : null;
    if (!perfData && !hasPermission('events:perform')) {
        showToast("Access Denied.", "error");
        return;
    }
    if (perfData) {
        const myFlat = localStorage.getItem('currentFlatNo') || '';
        const isAdmin = hasPermission('events:create');
        if (perfData.flat_no !== myFlat && !isAdmin) {
            showToast("Access Denied.", "error");
            return;
        }
    }
    document.getElementById('perf-event-id').value = eventId;
    document.getElementById('perf-id').value = perfData ? perfData.id : '';
    document.getElementById('perf-modal-title').textContent = perfData ? 'Edit Performance' : 'Register Performance';
    document.getElementById('perf-type').value = perfData ? perfData.performance_type : 'dance';
    document.getElementById('perf-requirements').value = perfData ? (perfData.requirements || '') : '';
    document.getElementById('perf-is-star').checked = perfData ? !!perfData.is_star : false;
    document.getElementById('btn-perf-submit').innerHTML = perfData ? '<i class="fa-solid fa-floppy-disk"></i> Update' : '<i class="fa-solid fa-check"></i> Register';

    const myFlat = localStorage.getItem('currentFlatNo') || '';
    const flatInput = document.getElementById('perf-flat-filter');
    flatInput.value = perfData ? perfData.flat_no : myFlat;
    await loadFamilyMembers(flatInput.value);

    if (perfData) {
        const searchInput = document.getElementById('perf-name-search');
        const dropdown = document.getElementById('perf-name-dropdown');
        const options = dropdown.querySelectorAll('.sd-option');
        let found = false;
        options.forEach(opt => {
            if (opt.dataset.value === perfData.performer_name) {
                found = true;
                searchInput.value = opt.textContent;
                opt.classList.add('selected');
            }
        });
        if (found) {
            document.querySelector('input[name="perf-type-rad"][value="inhouse"]').checked = true;
            document.getElementById('perf-inhouse-group').style.display = '';
            document.getElementById('perf-guest-group').style.display = 'none';
            document.getElementById('perf-name').value = '';
        } else {
            document.querySelector('input[name="perf-type-rad"][value="guest"]').checked = true;
            document.getElementById('perf-inhouse-group').style.display = 'none';
            document.getElementById('perf-guest-group').style.display = '';
            document.getElementById('perf-name').value = perfData.performer_name;
        }
    } else {
        document.querySelector('input[name="perf-type-rad"][value="inhouse"]').checked = true;
        document.getElementById('perf-inhouse-group').style.display = '';
        document.getElementById('perf-guest-group').style.display = 'none';
        document.getElementById('perf-name').value = '';
        document.getElementById('perf-name-search').value = '';
    }

    closeModal('contribSuccessModal');
    openModal('performanceModal');
};

window.togglePerformerType = function() {
    const val = document.querySelector('input[name="perf-type-rad"]:checked').value;
    document.getElementById('perf-inhouse-group').style.display = val === 'inhouse' ? '' : 'none';
    document.getElementById('perf-guest-group').style.display = val === 'guest' ? '' : 'none';
    document.getElementById('perf-name-search').required = val === 'inhouse';
    document.getElementById('perf-name').required = val === 'guest';
};

let _familyMembersList = [];

window.loadFamilyMembers = async function(flatNo, clearSearch = false) {
    const dropdown = document.getElementById('perf-name-dropdown');
    dropdown.innerHTML = '';
    _familyMembersList = [];
    document.getElementById('perf-name-search').value = '';
    document.getElementById('perf-name-search').dataset.selected = '';
    const btn = document.getElementById('btn-load-family');
    if (!sbClient || !flatNo) {
        dropdown.innerHTML = '<div class="sd-empty">Enter a flat number and click Load.</div>';
        return;
    }
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    try {
        const { data, error } = await sbClient.from('owners').select('owner_name, family_members').eq('flat_no', flatNo.toUpperCase()).maybeSingle();
        if (error) throw error;
        if (!data) {
            dropdown.innerHTML = '<div class="sd-empty">No data found for this flat.</div>';
            return;
        }
        const ownerName = data.owner_name || '';
        if (ownerName) _familyMembersList.push({ name: ownerName, label: ownerName + ' (Self)' });
        let members = [];
        try { members = JSON.parse(data.family_members || '[]'); } catch(e) { members = []; }
        if (!Array.isArray(members)) members = [];
        members.forEach(m => {
            if (!m || !m.name) return;
            _familyMembersList.push({ name: m.name, label: m.name + (m.relation ? ' (' + m.relation + ')' : '') });
        });
        renderFamilyDropdown();
        dropdown.classList.add('show');
    } catch (err) {
        console.error('loadFamilyMembers error:', err);
        dropdown.innerHTML = '<div class="sd-empty">Error loading family members.</div>';
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Load';
    }
};

function renderFamilyDropdown(filter = '') {
    const dropdown = document.getElementById('perf-name-dropdown');
    const searchVal = document.getElementById('perf-name-search').dataset.selected || '';
    const filtered = filter
        ? _familyMembersList.filter(m => m.label.toLowerCase().includes(filter.toLowerCase()))
        : _familyMembersList;
    if (filtered.length === 0) {
        dropdown.innerHTML = '<div class="sd-empty">No matching members.</div>';
        return;
    }
    dropdown.innerHTML = filtered.map(m =>
        `<div class="sd-option${m.name === searchVal ? ' selected' : ''}" data-value="${m.name.replace(/"/g, '&quot;')}" onclick="selectFamilyMember(this)">${m.label}</div>`
    ).join('');
}

window.showFamilyDropdown = function() {
    const dropdown = document.getElementById('perf-name-dropdown');
    if (_familyMembersList.length > 0) {
        renderFamilyDropdown(document.getElementById('perf-name-search').value);
        dropdown.classList.add('show');
    }
};

window.filterFamilyDropdown = function() {
    const val = document.getElementById('perf-name-search').value;
    document.getElementById('perf-name-search').dataset.selected = '';
    renderFamilyDropdown(val);
    document.getElementById('perf-name-dropdown').classList.add('show');
};

window.selectFamilyMember = function(el) {
    const searchInput = document.getElementById('perf-name-search');
    searchInput.value = el.textContent;
    searchInput.dataset.selected = el.dataset.value;
    document.getElementById('perf-name-dropdown').classList.remove('show');
    document.getElementById('perf-name-dropdown').querySelectorAll('.sd-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
};

window.navigateFamilyDropdown = function(e) {
    const dropdown = document.getElementById('perf-name-dropdown');
    if (!dropdown.classList.contains('show')) return;
    const items = dropdown.querySelectorAll('.sd-option:not(.sd-empty)');
    if (items.length === 0) return;
    let idx = -1;
    items.forEach((item, i) => { if (item.classList.contains('highlighted')) idx = i; });
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        items.forEach(item => item.classList.remove('highlighted'));
        const next = (idx + 1) % items.length;
        items[next].classList.add('highlighted');
        items[next].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        items.forEach(item => item.classList.remove('highlighted'));
        const prev = (idx <= 0) ? items.length - 1 : idx - 1;
        items[prev].classList.add('highlighted');
        items[prev].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
        e.preventDefault();
        const highlighted = dropdown.querySelector('.sd-option.highlighted');
        if (highlighted) selectFamilyMember(highlighted);
    } else if (e.key === 'Escape') {
        dropdown.classList.remove('show');
    }
};

document.addEventListener('click', function(e) {
    const container = document.getElementById('perf-inhouse-group');
    if (container && !container.contains(e.target)) {
        const dd = document.getElementById('perf-name-dropdown');
        if (dd) dd.classList.remove('show');
    }
});

window.deletePerformance = async function(perfId, performerName) {
    const perf = _performancesData.find(p => p.id === perfId);
    const myFlat = localStorage.getItem('currentFlatNo') || '';
    const isAdmin = hasPermission('events:create');
    if (!perf) return;
    if (perf.flat_no !== myFlat && !isAdmin) {
        showToast("Access Denied.", "error");
        return;
    }
    if (!confirm(`Delete performance by "${performerName}"?`)) return;
    if (!sbClient) return;
    try {
        const { data: deleted, error } = await sbClient.from('event_performances').delete().eq('id', perfId).select('id');
        if (error) throw error;
        if (!deleted || deleted.length === 0) {
            showToast('Delete blocked by database policy. Run scratch/add_performance_delete_policy.sql in Supabase SQL Editor.', 'error');
            return;
        }
        showToast('Performance removed.', 'success');
        loadTabData('performances');
    } catch (err) {
        console.error('deletePerformance error:', err);
        showToast(err.message || 'Failed to delete.', 'error');
    }
};

window.submitPerformance = async function(e) {
    e.preventDefault();
    if (!sbClient) return;
    
    const id = document.getElementById('perf-id').value;
    const eventId = Number(document.getElementById('perf-event-id').value);
    const flatNo = localStorage.getItem('currentFlatNo') || 'Unknown';
    const perfType = document.getElementById('perf-type').value;
    const requirements = document.getElementById('perf-requirements').value.trim();
    const isStar = document.getElementById('perf-is-star').checked;
    const perfTypeRad = document.querySelector('input[name="perf-type-rad"]:checked').value;
    const performerName = perfTypeRad === 'inhouse'
        ? (document.getElementById('perf-name-search').dataset.selected || document.getElementById('perf-name-search').value.trim())
        : document.getElementById('perf-name').value.trim();
    
    if (!performerName) {
        showToast('Please select or enter a performer name.', 'error');
        return;
    }
    
    if (!id && !hasPermission('events:perform')) {
        showToast("Access Denied.", "error");
        return;
    }
    
    try {
        if (id) {
            const { error } = await sbClient.from('event_performances').update({
                performer_name: performerName,
                performance_type: perfType,
                requirements: requirements,
                is_star: isStar
            }).eq('id', id);
            if (error) throw error;
            showToast('Performance updated!', 'success');
        } else {
            const { error } = await sbClient.from('event_performances').insert({
                event_id: eventId,
                flat_no: flatNo,
                performer_name: performerName,
                performance_type: perfType,
                requirements: requirements,
                status: 'registered',
                is_star: isStar
            });
            if (error) throw error;
            showToast('Performance registered!', 'success');
        }
        closeModal('performanceModal');
        loadTabData('performances');
    } catch (err) {
        console.error('submitPerformance error:', err);
        showToast(err.message || 'Failed.', 'error');
    }
};

// ==========================================
// EVENT SCHEDULE MANAGEMENT
// ==========================================

window.openScheduleEntryModal = function(entry = null) {
    document.getElementById('schedule-modal-title').textContent = entry ? 'Edit Schedule Entry' : 'Add Schedule Entry';
    document.getElementById('schedule-entry-id').value = entry ? entry.id : '';
    document.getElementById('sched-day').value = entry ? entry.day_label : '';
    document.getElementById('sched-time-from').value = entry ? entry.time_from || '' : '';
    document.getElementById('sched-time-to').value = entry ? entry.time_to || '' : '';
    document.getElementById('sched-activity').value = entry ? entry.activity : '';
    document.getElementById('sched-location').value = entry ? entry.location || '' : '';
    document.getElementById('sched-notes').value = entry ? entry.notes || '' : '';
    openModal('scheduleEntryModal');
};

window.editScheduleEntry = async function(id) {
    if (!sbClient) return;
    const { data } = await sbClient.from('event_schedules').select('*').eq('id', id).single();
    if (data) openScheduleEntryModal(data);
};

window.saveScheduleEntry = async function(e) {
    e.preventDefault();
    if (!sbClient || !currentEvent) return;
    const id = document.getElementById('schedule-entry-id').value;
    const data = {
        event_id: currentEvent.id,
        day_label: document.getElementById('sched-day').value.trim(),
        time_from: document.getElementById('sched-time-from').value || null,
        time_to: document.getElementById('sched-time-to').value || null,
        activity: document.getElementById('sched-activity').value.trim(),
        location: document.getElementById('sched-location').value.trim(),
        notes: document.getElementById('sched-notes').value.trim()
    };
    try {
        if (id) {
            await sbClient.from('event_schedules').update(data).eq('id', id);
        } else {
            const { data: max } = await sbClient.from('event_schedules').select('sort_order').eq('event_id', currentEvent.id).order('sort_order', { ascending: false }).limit(1);
            data.sort_order = (max?.[0]?.sort_order ?? 0) + 1;
            await sbClient.from('event_schedules').insert(data);
        }
        showToast('Schedule entry saved!', 'success');
        closeModal('scheduleEntryModal');
        loadTabData('schedule');
    } catch (err) {
        showToast(err.message || 'Failed to save.', 'error');
    }
};

window.deleteScheduleEntry = async function(id) {
    if (!confirm('Delete this schedule entry?')) return;
    try {
        await sbClient.from('event_schedules').delete().eq('id', id);
        showToast('Entry deleted.', 'success');
        loadTabData('schedule');
    } catch (err) {
        showToast(err.message || 'Failed to delete.', 'error');
    }
};

// ==========================================
// VENDOR MANAGEMENT
// ==========================================

window.openVendorModal = function(vendor = null) {
    document.getElementById('vendor-modal-title').textContent = vendor ? 'Edit Vendor' : 'Add Vendor / Stall';
    document.getElementById('vendor-id').value = vendor ? vendor.id : '';
    document.getElementById('vendor-name').value = vendor ? vendor.vendor_name : '';
    document.getElementById('vendor-stall-no').value = vendor ? vendor.stall_no || '' : '';
    document.getElementById('vendor-category').value = vendor ? vendor.category : 'food';
    document.getElementById('vendor-amount').value = vendor ? vendor.amount || '' : '';
    document.getElementById('vendor-contact').value = vendor ? vendor.contact || '' : '';
    document.getElementById('vendor-status').value = vendor ? vendor.status : 'pending';
    openModal('vendorModal');
};

window.editVendor = async function(id) {
    if (!sbClient) return;
    const { data } = await sbClient.from('event_vendors').select('*').eq('id', id).single();
    if (data) openVendorModal(data);
};

window.saveVendor = async function(e) {
    e.preventDefault();
    if (!sbClient || !currentEvent) return;
    const id = document.getElementById('vendor-id').value;
    const data = {
        event_id: currentEvent.id,
        vendor_name: document.getElementById('vendor-name').value.trim(),
        stall_no: document.getElementById('vendor-stall-no').value.trim(),
        category: document.getElementById('vendor-category').value,
        amount: parseFloat(document.getElementById('vendor-amount').value) || 0,
        contact: document.getElementById('vendor-contact').value.trim(),
        status: document.getElementById('vendor-status').value
    };
    try {
        if (id) {
            await sbClient.from('event_vendors').update(data).eq('id', id);
        } else {
            await sbClient.from('event_vendors').insert(data);
        }
        showToast('Vendor saved!', 'success');
        closeModal('vendorModal');
        loadTabData('stalls');
    } catch (err) {
        showToast(err.message || 'Failed to save.', 'error');
    }
};

window.deleteVendor = async function(id) {
    if (!confirm('Delete this vendor?')) return;
    try {
        await sbClient.from('event_vendors').delete().eq('id', id);
        showToast('Vendor deleted.', 'success');
        loadTabData('stalls');
    } catch (err) {
        showToast(err.message || 'Failed to delete.', 'error');
    }
};

// ==========================================
// COMPETITION MANAGEMENT
// ==========================================

window.openCompetitionModal = function(comp = null) {
    document.getElementById('competition-modal-title').textContent = comp ? 'Edit Competition' : 'New Competition';
    document.getElementById('competition-id').value = comp ? comp.id : '';
    document.getElementById('comp-name').value = comp ? comp.name : '';
    document.getElementById('comp-desc').value = comp ? comp.description || '' : '';
    document.getElementById('comp-judge-type').value = comp ? comp.judge_type : 'residents';
    document.getElementById('comp-max-score').value = comp ? comp.max_score : 10;
    document.getElementById('comp-status').value = comp ? comp.status : 'open';
    openModal('competitionModal');
};

window.editCompetition = async function(id) {
    if (!sbClient) return;
    const { data } = await sbClient.from('event_competitions').select('*').eq('id', id).single();
    if (data) openCompetitionModal(data);
};

window.saveCompetition = async function(e) {
    e.preventDefault();
    if (!sbClient || !currentEvent) return;
    const id = document.getElementById('competition-id').value;
    const data = {
        event_id: currentEvent.id,
        name: document.getElementById('comp-name').value.trim(),
        description: document.getElementById('comp-desc').value.trim(),
        judge_type: document.getElementById('comp-judge-type').value,
        max_score: parseFloat(document.getElementById('comp-max-score').value) || 10,
        status: document.getElementById('comp-status').value
    };
    try {
        if (id) {
            await sbClient.from('event_competitions').update(data).eq('id', id);
        } else {
            await sbClient.from('event_competitions').insert(data);
        }
        showToast('Competition saved!', 'success');
        closeModal('competitionModal');
        loadTabData('competitions');
    } catch (err) {
        showToast(err.message || 'Failed to save.', 'error');
    }
};

window.deleteCompetition = async function(id) {
    if (!confirm('Delete this competition?')) return;
    try {
        await sbClient.from('event_competitions').delete().eq('id', id);
        showToast('Competition deleted.', 'success');
        loadTabData('competitions');
    } catch (err) {
        showToast(err.message || 'Failed to delete.', 'error');
    }
};

// ==========================================
// JUDGE SCORING
// ==========================================

window.openScoreModal = function(competitionId) {
    document.getElementById('score-competition-id').value = competitionId;
    const comp = currentEvent ? null : null;
    // Find competition name from the DOM
    document.getElementById('score-comp-name').textContent = 'Scoring';
    document.getElementById('score-participant-name').value = '';
    document.getElementById('score-participant-flat').value = '';
    document.getElementById('score-value').value = '';
    openModal('scoreModal');
};

window.submitScore = async function(e) {
    e.preventDefault();
    if (!sbClient) return;
    const competitionId = document.getElementById('score-competition-id').value;
    const data = {
        competition_id: parseInt(competitionId),
        judge_id: 0,
        participant_name: document.getElementById('score-participant-name').value.trim(),
        participant_flat: document.getElementById('score-participant-flat').value.trim() || 'Unknown',
        score: parseFloat(document.getElementById('score-value').value)
    };
    try {
        await sbClient.from('event_scores').insert(data);
        showToast('Score submitted!', 'success');
        closeModal('scoreModal');
    } catch (err) {
        showToast(err.message || 'Failed to submit score.', 'error');
    }
};

// ==========================================
// RESIDENT VOTING
// ==========================================

window.voteCompetition = async function(competitionId) {
    if (!sbClient) return;
    const voterFlat = localStorage.getItem('currentFlatNo');
    if (!voterFlat) { showToast('Please set your flat number in your profile first.', 'error'); return; }
    
    const nomineeFlat = prompt('Enter the flat number you want to vote for:');
    if (!nomineeFlat) return;
    
    try {
        const { error } = await sbClient.from('event_votes').insert({
            competition_id: competitionId,
            nominee_flat: nomineeFlat.toUpperCase(),
            voter_flat: voterFlat
        });
        if (error) throw error;
        showToast('Vote recorded!', 'success');
        loadTabData('competitions');
    } catch (err) {
        if (err.code === '23505') {
            showToast('You have already voted in this competition.', 'warning');
        } else {
            showToast(err.message || 'Failed to vote.', 'error');
        }
    }
};

// ==========================================
// VISITOR PASS
// ==========================================

window.openVisitorPassModal = function(eventId) {
    document.getElementById('pass-event-id').value = eventId;
    document.getElementById('pass-guest-name').value = '';
    document.getElementById('pass-guest-contact').value = '';
    document.getElementById('pass-date').value = new Date().toISOString().split('T')[0];
    openModal('visitorPassModal');
};

window.generateVisitorPass = async function(e) {
    e.preventDefault();
    if (!sbClient || !hasPermission('events:generate_passes')) return;
    
    const eventId = Number(document.getElementById('pass-event-id').value);
    const flatNo = localStorage.getItem('currentFlatNo') || 'Unknown';
    const guestName = document.getElementById('pass-guest-name').value.trim();
    const guestContact = document.getElementById('pass-guest-contact').value.trim();
    const passDate = document.getElementById('pass-date').value;
    
    try {
        const { error } = await sbClient.from('event_visitor_passes').insert({
            event_id: eventId,
            flat_no: flatNo,
            guest_name: guestName,
            guest_contact: guestContact || null,
            pass_date: passDate,
            status: 'active'
        });
        if (error) throw error;
        
        const evt = eventsData.find(e => e.id === eventId);
        showToast(`Pass generated for ${guestName} (${evt?.name || 'Event'})!`, 'success', {
            text: '<i class="fa-solid fa-download"></i> Download',
            callback: () => downloadVisitorPass({ guestName, passDate, flatNo, eventName: evt?.name || 'Event' })
        });
        closeModal('visitorPassModal');
    } catch (err) {
        showToast(err.message || 'Failed to generate pass.', 'error');
    }
};

function downloadVisitorPass(data) {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) { showToast('PDF library not loaded.', 'error'); return; }
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 120] });
    const name = getBuildingName();
    
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.5);
    doc.rect(2, 2, 76, 116);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(name.toUpperCase(), 40, 12, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('FESTIVAL VISITOR PASS', 40, 18, { align: 'center' });
    
    doc.setFontSize(7);
    doc.text(`Event: ${data.eventName}`, 8, 28);
    doc.text(`Guest: ${data.guestName}`, 8, 35);
    doc.text(`Flat: ${data.flatNo}`, 8, 42);
    doc.text(`Date: ${new Date(data.passDate).toLocaleDateString('en-IN')}`, 8, 49);
    
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text('Please show this pass at the security gate.', 40, 90, { align: 'center' });
    
    try {
        doc.autoPrint({ variant: 'non-conform' });
        const pdfUri = doc.output('datauristring');
        const tab = window.open();
        if (tab) tab.document.write(`<iframe width='100%' height='100%' src='${pdfUri}'></iframe>`);
        else doc.save(`Pass_${data.guestName.replace(/\s/g, '_')}.pdf`);
    } catch (err) {
        showToast('Failed to generate pass PDF.', 'error');
    }
}

// Add "Generate Visitor Pass" button to event detail footer
// (handled inside openEventDetail)

document.addEventListener("DOMContentLoaded", () => {
    // Set default dates to today
    const today = new Date().toISOString().split('T')[0];
    const incDateInput = document.getElementById("inc-date");
    const expDateInput = document.getElementById("exp-date");
    if (incDateInput) incDateInput.value = today;
    if (expDateInput) expDateInput.value = today;

    // Set default selected year and month in main filter bar based on current local date
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
    if (filterMonth) {
        filterMonth.value = currentMonth;
    }

    // Bind filters
    if (filterYear) filterYear.addEventListener("change", refreshDashboard);
    if (filterMonth) filterMonth.addEventListener("change", refreshDashboard);

    // Initialize Supabase Client
    if (initSupabase()) {
        setupAuthListener();
        loadBuildingConfig();
        loadFlatsForSoftLogin();
    } else {
        openSupabaseConfig();
    }
});

// Toast System
function showToast(message, type = "success", actionBtn = null) {
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

    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = "slideInRight 0.3s ease reverse";
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
}

// Initialize Supabase Client using LocalStorage or Fallback env variables
function initSupabase() {
    let url = localStorage.getItem('supabaseUrl') || "";
    let key = localStorage.getItem('supabaseKey') || "";
    
    // Fallback to Vite env variables if localstorage is empty
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
}

// ==========================================
// COMMUNITY BOARD
// ==========================================
const BOARD_CATEGORIES = [
    { slug: 'classifieds', name: 'Classifieds', icon: 'fa-cart-shopping', tags: ['Selling', 'Rent out', 'Looking for'] },
    { slug: 'recommendations', name: 'Recommendations', icon: 'fa-thumbs-up', tags: ['Offering', 'Requesting'] },
    { slug: 'carpooling', name: 'Carpooling', icon: 'fa-car', tags: ['Offering ride', 'Looking for ride'] },
    { slug: 'hobbies', name: 'Hobbies & Clubs', icon: 'fa-baseball', tags: [] }
];
let currentBoardCategory = 'classifieds';
let currentBoardTag = '';
let boardAllPosts = [];
let boardMyUpvotes = new Set();

window.openBoardModal = async function() {
    if (!hasPermission('board:view')) {
        showToast("Access Denied.", "error");
        return;
    }
    openModal('boardModal');
    await loadBoardCategories();
};

window.loadBoardCategories = function() {
    const container = document.getElementById('board-category-tabs');
    if (!container) return;
    container.innerHTML = BOARD_CATEGORIES.map(c =>
        `<button class="board-tab ${currentBoardCategory === c.slug ? 'active' : ''}" onclick="switchBoardCategory('${c.slug}')">
            <i class="fa-solid ${c.icon}"></i> ${c.name}
        </button>`
    ).join('');
    updateFilterPills(currentBoardCategory);
    loadBoardPosts();
};

window.switchBoardCategory = function(slug) {
    currentBoardCategory = slug;
    currentBoardTag = '';
    loadBoardCategories();
};

window.updateFilterPills = function(slug) {
    const cat = BOARD_CATEGORIES.find(c => c.slug === slug);
    const container = document.getElementById('board-filter-pills');
    if (!container) return;
    const tags = cat?.tags || [];
    container.innerHTML = `<button class="board-pill ${currentBoardTag === '' ? 'active' : ''}" onclick="currentBoardTag=''; loadBoardPosts(); updateFilterPills('${slug}');">All</button>`
        + tags.map(t =>
            `<button class="board-pill ${currentBoardTag === t ? 'active' : ''}" onclick="currentBoardTag='${t}'; loadBoardPosts(); updateFilterPills('${slug}');">${t}</button>`
        ).join('');
};

window.loadBoardPosts = async function() {
    if (!sbClient) return;
    const container = document.getElementById('board-posts-container');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
    try {
        let q = sbClient.from('community_posts')
            .select('*')
            .in('status', ['active', 'closed'])
            .eq('category_slug', currentBoardCategory)
            .order('created_at', { ascending: false });
        if (currentBoardTag) {
            q = q.eq('tag', currentBoardTag);
        }
        const { data, error } = await q;
        if (error) throw error;
        boardAllPosts = data || [];
        // Load user's upvotes
        if (currentUserId) {
            const { data: uvData } = await sbClient.from('community_upvotes')
                .select('post_id').eq('user_id', currentUserId);
            boardMyUpvotes = new Set((uvData || []).map(u => u.post_id));
        }
        if (boardAllPosts.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-inbox"></i><br>No posts yet. Be the first to post!</div>';
            return;
        }
        container.innerHTML = boardAllPosts.map(p => renderPostCard(p)).join('');
    } catch (err) {
        console.error('loadBoardPosts error:', err);
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--color-rose);">Failed to load posts.</div>';
    }
};

function renderPostCard(post) {
    const isSoftLogin = localStorage.getItem("isSoftLogin") === "true";
    const myFlat = localStorage.getItem("currentFlatNo") || '';
    const isMine = isSoftLogin && post.owner_flat_no === myFlat;
    const canModerate = hasPermission('board:moderate');
    const canCreate = hasPermission('board:create');
    const hasUpvoted = boardMyUpvotes.has(post.id);
    const timeAgo = formatRelativeTime(post.created_at);
    const authorDisplay = post.is_anonymous ? 'Verified Resident (Anonymous)' : (post.owner_name || 'Resident');
    const isClosed = post.status === 'closed';
    const priceHtml = post.price ? `<div class="board-meta-row"><span class="board-price"><i class="fa-solid fa-indian-rupee-sign"></i> ${Number(post.price).toLocaleString()}${post.tag === 'Selling' || post.tag === 'Rent out' ? '' : ''}</span></div>` : '';
    const tagBadge = post.tag ? `<span class="board-tag">${post.tag}</span>` : '';
    return `<div class="board-card${isClosed ? ' closed' : ''}">
        <div class="board-card-header">
            <div><span class="board-cat-badge"><i class="fa-solid ${BOARD_CATEGORIES.find(c => c.slug === post.category_slug)?.icon || 'fa-message'}"></i> ${BOARD_CATEGORIES.find(c => c.slug === post.category_slug)?.name || post.category_slug}${tagBadge ? ' ' + tagBadge : ''}</span></div>
            <div class="board-card-menu">
                ${isMine || canModerate ? `<button class="board-menu-btn" onclick="event.stopPropagation();${isClosed ? '' : `closeBoardPost('${post.id}')`}" title="${isClosed ? 'Already closed' : 'Mark as Closed'}"><i class="fa-solid fa-check-circle"></i></button>` : ''}
                ${isMine || canModerate ? `<button class="board-menu-btn" onclick="event.stopPropagation();deleteBoardPost('${post.id}')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>` : ''}
                ${!isMine ? `<button class="board-menu-btn" onclick="event.stopPropagation();reportBoardPost('${post.id}')" title="Report"><i class="fa-solid fa-flag"></i></button>` : ''}
                <button class="board-menu-btn" onclick="event.stopPropagation();this.closest('.board-card').classList.toggle('expanded')" title="Toggle details"><i class="fa-solid fa-ellipsis-vertical"></i></button>
            </div>
        </div>
        <div class="board-card-body">
            <div class="board-title">${post.title}${isClosed ? ' <span class="board-closed-badge">Closed</span>' : ''}</div>
            ${post.description ? `<div class="board-desc">${escapeHtml(post.description)}</div>` : ''}
            ${priceHtml}
        </div>
        <div class="board-card-footer">
            <div class="board-author">
                <i class="fa-solid fa-user"></i> ${authorDisplay}${post.is_anonymous ? '' : ` (${post.owner_flat_no || '-'})`}
            </div>
            <div class="board-time"><i class="fa-solid fa-clock"></i> ${timeAgo}</div>
        </div>
        <div class="board-actions">
            <button class="board-upvote-btn ${hasUpvoted ? 'upvoted' : ''}" onclick="upvotePost('${post.id}', this)">
                <i class="fa-solid ${hasUpvoted ? 'fa-caret-up' : 'fa-caret-up'}"></i> <span>${post.upvote_count || 0}</span> Support Idea
            </button>
            <button class="board-chat-btn" onclick="showToast('Chat coming soon!', 'info')">
                <i class="fa-solid fa-comment"></i> Chat / Reply
            </button>
        </div>
    </div>`;
}

window.upvotePost = async function(postId, btnEl) {
    if (!currentUserId) { showToast('Please log in to support ideas.', 'error'); return; }
    const isUpvoted = boardMyUpvotes.has(postId);
    const span = btnEl.querySelector('span');
    const current = parseInt(span.textContent) || 0;
    try {
        if (isUpvoted) {
            const { error } = await sbClient.from('community_upvotes').delete()
                .eq('post_id', postId).eq('user_id', currentUserId);
            if (error) throw error;
            boardMyUpvotes.delete(postId);
            const newCount = Math.max(0, current - 1);
            await sbClient.from('community_posts').update({ upvote_count: newCount }).eq('id', postId);
            span.textContent = newCount;
        } else {
            const { error } = await sbClient.from('community_upvotes').insert({ post_id: postId, user_id: currentUserId });
            if (error) throw error;
            boardMyUpvotes.add(postId);
            const newCount = current + 1;
            await sbClient.from('community_posts').update({ upvote_count: newCount }).eq('id', postId);
            span.textContent = newCount;
        }
        btnEl.classList.toggle('upvoted');
    } catch (err) {
        console.error('upvotePost error:', err);
        showToast('Failed to update support.', 'error');
    }
};

window.openCreatePostModal = function() {
    if (!hasPermission('board:create')) {
        showToast('Access Denied.', 'error');
        return;
    }
    document.getElementById('create-post-title').textContent = 'New Post';
    document.getElementById('create-post-form').reset();
    document.getElementById('post-anonymous').checked = false;
    document.getElementById('post-price-field').style.display = 'none';
    const catSelect = document.getElementById('post-category');
    catSelect.innerHTML = BOARD_CATEGORIES.map(c => `<option value="${c.slug}">${c.name}</option>`).join('');
    catSelect.value = currentBoardCategory;
    updatePostTags();
    openModal('createPostModal');
};

window.updatePostTags = function() {
    const slug = document.getElementById('post-category').value;
    const cat = BOARD_CATEGORIES.find(c => c.slug === slug);
    const tagField = document.getElementById('post-tag-field');
    const tagSelect = document.getElementById('post-tag');
    const priceField = document.getElementById('post-price-field');
    if (cat && cat.tags.length > 0) {
        tagField.style.display = 'block';
        tagSelect.innerHTML = cat.tags.map(t => `<option value="${t}">${t}</option>`).join('');
    } else {
        tagField.style.display = 'none';
    }
    priceField.style.display = slug === 'classifieds' ? 'block' : 'none';
};

window.saveBoardPost = async function(e) {
    e.preventDefault();
    if (!sbClient || !currentUserId) {
        showToast('You must be logged in.', 'error');
        return;
    }
    const isSoftLogin = localStorage.getItem("isSoftLogin") === "true";
    const flatNo = localStorage.getItem("currentFlatNo") || '';
    let ownerName = `Flat ${flatNo}`;
    if (flatNo) {
        const { data } = await sbClient.from('owners').select('owner_name').eq('flat_no', flatNo).maybeSingle();
        if (data?.owner_name) ownerName = data.owner_name;
    }
    const categorySlug = document.getElementById('post-category').value;
    const tagSelect = document.getElementById('post-tag');
    const tag = tagSelect.style.display !== 'none' ? tagSelect.value : '';
    const data = {
        category_slug: categorySlug,
        tag,
        title: document.getElementById('post-title').value.trim(),
        description: document.getElementById('post-description').value.trim(),
        price: categorySlug === 'classifieds' ? (parseFloat(document.getElementById('post-price').value) || null) : null,
        expiry_date: new Date(Date.now() + parseInt(document.getElementById('post-expiry').value) * 86400000).toISOString().split('T')[0],
        is_anonymous: document.getElementById('post-anonymous').checked,
        created_by: currentUserId,
        owner_flat_no: flatNo,
        owner_name: ownerName,
        status: 'active'
    };
    try {
        const { data: createdPost, error } = await sbClient.from('community_posts').insert(data).select().single();
        if (error) throw error;
        showToast('Post published!', 'success');
        sendCommunityBoardNotification(createdPost || data);
        closeModal('createPostModal');
        await loadBoardPosts();
    } catch (err) {
        console.error('saveBoardPost error:', err);
        showToast(err.message || 'Failed to create post.', 'error');
    }
};

window.closeBoardPost = async function(postId) {
    if (!confirm('Mark this post as closed?')) return;
    try {
        const { error } = await sbClient.from('community_posts').update({ status: 'closed' }).eq('id', postId);
        if (error) throw error;
        showToast('Post marked as closed.', 'success');
        await loadBoardPosts();
    } catch (err) {
        console.error('closeBoardPost error:', err);
        showToast('Failed to close post.', 'error');
    }
};

window.deleteBoardPost = async function(postId) {
    if (!confirm('Delete this post permanently?')) return;
    try {
        const { error } = await sbClient.from('community_posts').delete().eq('id', postId);
        if (error) throw error;
        showToast('Post deleted.', 'success');
        await loadBoardPosts();
    } catch (err) {
        console.error('deleteBoardPost error:', err);
        showToast('Failed to delete post.', 'error');
    }
};

window.reportBoardPost = async function(postId) {
    if (!currentUserId) { showToast('Please log in to report.', 'error'); return; }
    const reason = prompt('Why are you reporting this post?');
    if (!reason) return;
    try {
        const { error } = await sbClient.from('community_reports').insert({
            post_id: postId,
            reported_by: currentUserId,
            reason
        });
        if (error) throw error;
        showToast('Report submitted. Moderators will review.', 'success');
    } catch (err) {
        console.error('reportBoardPost error:', err);
        showToast('Failed to submit report.', 'error');
    }
};

function formatRelativeTime(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
}

// Scroll workspace to top (Dashboard nav click)
window.scrollToTop = function() {
    const workspace = document.querySelector(".workspace");
    if (workspace) workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.openFinancePage = function() {
    openModal('financeModal');
    refreshDashboard();
    setTimeout(loadEventContributionsFinance, 100);
};

// Update DB connection status pill in Header & Sidebar
function updateDbStatus(isConnected, message) {
    const badge = document.getElementById("db-status-badge");
    const text = document.getElementById("db-status-text");
    const sideBadge = document.getElementById("db-status-badge-side");
    const sideText = document.getElementById("db-status-text-side");
    
    const updateOne = (badgeEl, textEl, clickable) => {
        if (!badgeEl || !textEl) return;
        if (isConnected) {
            badgeEl.className = "badge badge-income";
            badgeEl.style.borderColor = "rgba(16, 185, 129, 0.4)";
            textEl.textContent = "Connected";
        } else {
            badgeEl.className = "badge badge-expense";
            badgeEl.style.borderColor = "rgba(244, 63, 94, 0.4)";
            textEl.textContent = message || "Disconnected";
        }
        badgeEl.style.cursor = clickable ? "pointer" : "default";
    };
    
    updateOne(badge, text, true);
    updateOne(sideBadge, sideText, false);
}

// Open Supabase credentials dialog
window.openSupabaseConfig = function() {
    const url = localStorage.getItem('supabaseUrl') || "";
    const key = localStorage.getItem('supabaseKey') || "";
    const sbUrlInput = document.getElementById("sb-url");
    const sbKeyInput = document.getElementById("sb-key");
    if (sbUrlInput) sbUrlInput.value = url;
    if (sbKeyInput) sbKeyInput.value = key;
    openModal("supabaseConfigModal");
};

// Save Supabase credentials and reconnect
window.saveSupabaseConfig = function(e) {
    e.preventDefault();
    const url = document.getElementById("sb-url").value.trim();
    const key = document.getElementById("sb-key").value.trim();
    
    localStorage.setItem('supabaseUrl', url);
    localStorage.setItem('supabaseKey', key);
    
    closeModal("supabaseConfigModal");
    
    if (initSupabase()) {
        showToast("Supabase credentials saved successfully!", "success");
        setupAuthListener();
        loadBuildingConfig();
        loadFlatsForSoftLogin();
    } else {
        showToast("Invalid credentials. Connection failed.", "error");
    }
};

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
        { name: 'admin', label: 'Administrator', permissions: ['dashboard:view','income:create','income:delete','expense:create','expense:delete','history:view','reports:view','ledger:import','ledger:export','owners:upload','owners:edit_any','owners:edit_own','expense_heads:manage','expense_heads:create','expense_heads:delete','users:manage','users:role_change','tickets:assign','tickets:recommend','tickets:approve','tickets:resolve','tickets:close','tickets:reopen','tickets:archive','tickets:delete','tickets:comment','events:view','events:create','events:delete','events:contribute','events:perform','events:manage_vendors','events:manage_competitions','events:vote','events:score','events:upload_gallery','events:generate_passes','board:view','board:create','board:moderate'], color: 'var(--color-emerald)' },
        { name: 'editor', label: 'Editor', permissions: ['dashboard:view','income:create','expense:create','history:view','reports:view','ledger:export','tickets:resolve','tickets:comment','board:view','board:create','board:moderate'], color: 'var(--color-rose)' },
        { name: 'floor_manager', label: 'Floor Manager', permissions: ['dashboard:view','income:create','history:view','reports:view','tickets:recommend','tickets:comment','board:view','board:create'], color: 'var(--color-yellow)' },
        { name: 'committee_member', label: 'Committee Member', permissions: ['dashboard:view','history:view','reports:view','tickets:approve','tickets:comment','board:view','board:create','board:moderate'], color: 'var(--color-violet)' },
        { name: 'viewer', label: 'Viewer (Resident)', permissions: ['dashboard:view','owners:edit_own','tickets:comment','events:view','board:view','board:create'], color: 'var(--text-secondary)' }
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
function formatCurrency(val) {
    return "Rs. " + Number(val).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Render entries into table
function renderTable(entries) {
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

        const canDelete = (entry.type === "INCOME" && hasPermission('income:delete')) || (entry.type === "EXPENSE" && hasPermission('expense:delete'));
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
            <td class="text-center">${formatDateDisplay(entry.date)}</td>
            <td class="text-center">
                ${actions}
                ${deleteButton}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Client-side local filtering in ledger table
window.filterTable = function() {
    const query = document.getElementById("table-search").value.toLowerCase().trim();
    if (!query) {
        renderTable(loadedEntries);
        return;
    }

    const filtered = loadedEntries.filter(entry => {
        return entry.description.toLowerCase().includes(query) || 
               entry.type.toLowerCase().includes(query) ||
               String(entry.id).includes(query);
    });
    renderTable(filtered);
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

// --- OWNERS & RESIDENTS DIRECTORY (CRM) ---
let allOwnersData = [];

window.openOwnersDirectoryModal = function() {
    openModal('ownersDirectoryModal');
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
               item.owner_name.toLowerCase().includes(query) || 
               (item.contact_no && item.contact_no.includes(query)) ||
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
            <p style="font-weight: 600;">${item.owner_name}</p>
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
    const map = { family: 'family-members-container', service: 'service-person-container', vehicle: 'vehicle-container' };
    return map[prefix] || '';
}

// Helper: parse JSON array from owner field (handles plain text fallback for family_members)
function parseStructuredField(value, prefix) {
    if (!value) return [];
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) {
            if (prefix === 'family') {
                return value.split(',').map(s => ({ name: s.trim(), relation: '', gender: '' })).filter(s => s.name);
            }
        }
    }
    return [];
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
    let html = '<div class="structured-rows">';
    rows.forEach((row, i) => {
        if (canEdit) {
            html += '<div class="structured-row">';
            fields.forEach(f => {
                const val = row[f.key] || '';
                if (f.type === 'select') {
                    html += `<select class="structured-input" id="${prefix}-${f.key}-${i}" style="flex:1;">`;
                    f.options.forEach(opt => {
                        const sel = opt === val ? 'selected' : '';
                        html += `<option value="${opt}" ${sel}>${opt || 'Select'}</option>`;
                    });
                    html += '</select>';
                } else {
                    html += `<input type="${f.type}" class="structured-input" id="${prefix}-${f.key}-${i}" value="${escapeHtml(val)}" placeholder="${f.label}" style="flex:1;">`;
                }
            });
            html += `<button type="button" class="btn btn-rose" onclick="removeStructuredRow(this)" style="padding:4px 8px; font-size:0.75rem;"><i class="fa-solid fa-times"></i></button>`;
            html += '</div>';
        } else {
            html += '<div class="structured-row">';
            fields.forEach((f, fi) => {
                const val = row[f.key] || '';
                html += `<span style="flex:1; ${fi > 0 ? 'color:var(--text-secondary);' : ''}">${escapeHtml(val)}</span>`;
            });
            html += '</div>';
        }
    });
    html += '</div>';
    return html;
}

// Add a new empty structured row
window.addStructuredRow = function(prefix) {
    const fields = STRUCTURED_FIELDS[prefix];
    if (!fields) return;
    const container = document.getElementById(getContainerId(prefix));
    if (!container) return;
    const count = container.querySelectorAll('.structured-row').length;
    const row = document.createElement('div');
    row.className = 'structured-row';
    let innerHtml = '';
    fields.forEach(f => {
        if (f.type === 'select') {
            innerHtml += `<select class="structured-input" id="${prefix}-${f.key}-${count}" style="flex:1;">`;
            f.options.forEach(opt => {
                innerHtml += `<option value="${opt}">${opt || 'Select'}</option>`;
            });
            innerHtml += '</select>';
        } else {
            innerHtml += `<input type="${f.type}" class="structured-input" id="${prefix}-${f.key}-${count}" placeholder="${f.label}" style="flex:1;">`;
        }
    });
    innerHtml += `<button type="button" class="btn btn-rose" onclick="removeStructuredRow(this)" style="padding:4px 8px; font-size:0.75rem;"><i class="fa-solid fa-times"></i></button>`;
    row.innerHTML = innerHtml;
    if (container.querySelector('.structured-rows')) {
        container.querySelector('.structured-rows').appendChild(row);
    } else {
        const wrapper = document.createElement('div');
        wrapper.className = 'structured-rows';
        wrapper.appendChild(row);
        container.appendChild(wrapper);
    }
};

// Remove a structured row
window.removeStructuredRow = function(btn) {
    const row = btn.closest('.structured-row');
    if (row) row.remove();
};

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
        let hasValue = false;
        fields.forEach(f => {
            const input = row.querySelector(`[id^="${prefix}-${f.key}-"]`);
            const val = input ? input.value.trim() : '';
            entry[f.key] = val;
            if (f.key === 'name') {
                if (val) hasValue = true;
            }
        });
        // Require at least the first field (name/number) to have a value
        if (entry[fields[0].key]) {
            data.push(entry);
        }
    });
    return data.length > 0 ? JSON.stringify(data) : '';
}

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
    
    // Always render fields as disabled initially — user must tap "Enable Editing" to modify
    const statusOptions = [
        { value: 'owner-occupied', label: 'Owner Occupied' },
        { value: 'tenant-occupied', label: 'Tenant Occupied' },
        { value: 'vacant', label: 'Vacant' }
    ];
    
    let selectHTML = `<select id="edit-status" disabled>`;
    statusOptions.forEach(opt => {
        const selected = opt.value === item.occupancy_status ? "selected" : "";
        selectHTML += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
    });
    selectHTML += `</select>`;
    
    const showPasscode = isOwnFlat || canEditAny;
    
    detailSide.innerHTML = `
        <div class="card" style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; margin-bottom: 16px;">
                <h3 style="font-size: 1.2rem; font-weight: 700; color: var(--color-indigo);">Flat ${item.flat_no} Details</h3>
                <span class="badge ${item.occupancy_status === 'vacant' ? 'badge-expense' : 'badge-income'}">${item.occupancy_status.replace('-', ' ')}</span>
            </div>
            
            <form id="edit-owner-form" onsubmit="saveOwnerProfile(event)">
                <input type="hidden" id="edit-flat-no" value="${item.flat_no}">
                
                <div class="input-field">
                    <label for="edit-owner-name">Owner Name</label>
                    <input type="text" id="edit-owner-name" value="${item.owner_name || ''}" disabled required>
                </div>
                
                <div class="input-field">
                    <label for="edit-contact">Contact No</label>
                    <input type="text" id="edit-contact" value="${item.contact_no || ''}" disabled>
                </div>
                
                ${showPasscode ? `
                <div class="input-field">
                    <label for="edit-passcode">Passcode (For Soft Login)</label>
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
                    <label for="edit-parking">Parking Space No</label>
                    <input type="text" id="edit-parking" value="${item.parking_no || 'None'}" disabled>
                </div>
                
                <div class="input-field">
                    <label for="edit-status">Occupancy Status</label>
                    ${selectHTML}
                </div>
                
                <div class="input-field">
                    <label for="edit-flat-type">Flat Type</label>
                    <select id="edit-flat-type" disabled>
                        <option value="">-- Select --</option>
                        ${getFlatTypesList().map(t => `<option value="${t}" ${item.flat_type === t ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                </div>
                
                <div class="input-field">
                    <label>Family Members</label>
                    <div id="family-members-container">
                        ${renderStructuredRows('family', item.family_members, false)}
                    </div>
                    ${canEdit ? '<button type="button" class="btn btn-slate btn-add-structured-row" onclick="addStructuredRow(\'family\')" style="margin-top: 6px; font-size:0.8rem; padding:4px 12px; display:none;"><i class="fa-solid fa-plus"></i> Add Member</button>' : ''}
                </div>
                
                <div class="input-field">
                    <label>Service Person Details</label>
                    <div id="service-person-container">
                        ${renderStructuredRows('service', item.service_person, false)}
                    </div>
                    ${canEdit ? '<button type="button" class="btn btn-slate btn-add-structured-row" onclick="addStructuredRow(\'service\')" style="margin-top: 6px; font-size:0.8rem; padding:4px 12px; display:none;"><i class="fa-solid fa-plus"></i> Add Person</button>' : ''}
                </div>
                
                <div class="input-field">
                    <label>Vehicle Details</label>
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

window.enableOwnerEditing = function() {
    const form = document.getElementById("edit-owner-form");
    if (!form) return;
    
    const flatNo = document.getElementById("edit-flat-no").value;
    const item = allOwnersData.find(o => o.flat_no === flatNo);
    if (!item) return;
    
    // Enable all inputs and selects inside the form
    form.querySelectorAll("input, select, textarea").forEach(el => el.disabled = false);
    
    // Re-render structured rows with canEdit=true to get editable fields
    const familyContainer = document.getElementById("family-members-container");
    if (familyContainer) familyContainer.innerHTML = renderStructuredRows('family', item.family_members, true);
    
    const serviceContainer = document.getElementById("service-person-container");
    if (serviceContainer) serviceContainer.innerHTML = renderStructuredRows('service', item.service_person, true);
    
    const vehicleContainer = document.getElementById("vehicle-container");
    if (vehicleContainer) vehicleContainer.innerHTML = renderStructuredRows('vehicle', item.vehicle_details, true);
    
    // Show save button
    const saveActions = document.getElementById("save-profile-actions");
    if (saveActions) saveActions.style.display = "flex";
    
    // Hide the enable button
    const enableBtn = document.getElementById("btn-enable-edit");
    if (enableBtn) enableBtn.style.display = "none";
    
    // Show add buttons for structured rows
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
    
    const ownerName = document.getElementById("edit-owner-name").value.trim();
    const contactNo = document.getElementById("edit-contact").value.trim();
    
    const passcodeInput = document.getElementById("edit-passcode");
    let passcode = undefined;
    if (passcodeInput) {
        const passcodeVal = passcodeInput.value.trim();
        passcode = passcodeVal ? parseInt(passcodeVal) : null;
    }
    const parkingNo = document.getElementById("edit-parking").value.trim();
    const status = document.getElementById("edit-status").value;
    const flatType = document.getElementById("edit-flat-type").value;
    const family = collectStructuredRows('family');
    const servicePerson = collectStructuredRows('service');
    const vehicleDetails = collectStructuredRows('vehicle');
    
    const submitBtn = e.target.querySelector("button[type=submit]");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving...";
    }
    
    try {
        const updateData = {
            owner_name: ownerName,
            contact_no: contactNo,
            parking_no: parkingNo,
            occupancy_status: status,
            flat_type: flatType,
            family_members: family,
            service_person: servicePerson,
            vehicle_details: vehicleDetails
        };
        
        if (passcode !== undefined) {
            updateData.passcode = passcode;
        }

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

// Modal handling
let _modalZIndex = 100;
window.openModal = function(modalId) {
    const el = document.getElementById(modalId);
    if (!el) return;
    el.style.display = 'block';
    _modalZIndex += 10;
    el.style.zIndex = _modalZIndex;
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

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.style.display = "none";
    
    const form = modal.querySelector("form");
    if (form) {
        form.reset();
        const dropzoneText = form.querySelector(".dropzone-text");
        if (dropzoneText) {
            if (modalId === "importModal") {
                dropzoneText.textContent = "Click or drag Excel file here";
            } else {
                dropzoneText.textContent = "Click or drag owners.xlsx file here";
            }
            dropzoneText.style.color = "var(--text-secondary)";
        }
    }
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
        const { data, error } = await sbClient.from('income').select('id, flat_no, year, month, amount, date_received, category, event_name, remarks').eq('id', entryId).single();
        if (error || !data) throw new Error("Receipt data not found.");
        
        // Fetch owner name
        const { data: ownerData } = await sbClient.from('owners').select('owner_name').eq('flat_no', data.flat_no).single();
        const ownerName = ownerData ? ownerData.owner_name : `Flat ${data.flat_no}`;
        
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
        doc.text(formatDateDisplay(data.date_received), 160, 45);
        
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
        
        // Totals & Words
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text("Total Paid:", 12, 84);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(5, 150, 105); // emerald 600
        doc.text(`Rs. ${data.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 34, 84);
        
        // Words text
        const amtWords = numberToWords(data.amount);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
        doc.text("Amount in Words:", 12, 94);
        
        doc.setFont("helvetica", "oblique");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        const splitWords = doc.splitTextToSize(amtWords, 115);
        doc.text(splitWords, 12, 99);
        
        // Remarks
        if (data.remarks && data.category !== "Other") {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(51, 65, 85);
            doc.text("Remarks:", 12, 112);
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105);
            const splitRemarks = doc.splitTextToSize(data.remarks, 115);
            doc.text(splitRemarks, 12, 117);
        }
        
        // Signature Line
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.line(140, 94, 185, 94);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text("Authorized Signatory", 162.5, 98, { align: "center" });
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(getBuildingName(), 162.5, 102, { align: "center" });
        
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
            let q = sbClient.from('income').select('id, flat_no, year, month, amount, date_received, category, event_name, remarks');
            
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
            <td>${formatDateDisplay(entry.date)}</td>
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

// --- FINANCIAL REPORTS CONTROLLERS ---

window.openReportsModal = function() {
    openModal('reportsModal');
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const todayStr = now.toISOString().split('T')[0];
    const currentMonthPad = String(now.getMonth() + 1).padStart(2, '0');
    const startOfMonthStr = `${currentYear}-${currentMonthPad}-01`;
    
    const repStartDateInput = document.getElementById("rep-start-date");
    const repEndDateInput = document.getElementById("rep-end-date");
    const repYearSelect = document.getElementById("rep-year");
    
    if (repStartDateInput) repStartDateInput.value = startOfMonthStr;
    if (repEndDateInput) repEndDateInput.value = todayStr;
    if (repYearSelect) repYearSelect.value = currentYear.toString();
    
    switchReportTab('date-wise-cashbook');
};

window.switchReportTab = function(tabId) {
    activeReportTab = tabId;
    
    document.querySelectorAll('.report-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeTabBtn = document.getElementById(`tab-${tabId}`);
    if (activeTabBtn) activeTabBtn.classList.add('active');
    
    const filterDates = document.getElementById('rep-filter-dates');
    const filterYear = document.getElementById('rep-filter-year');
    
    if (tabId === 'date-wise-cashbook') {
        if (filterDates) filterDates.classList.remove('hidden');
        if (filterYear) filterYear.classList.add('hidden');
    } else if (tabId === 'helpdesk-stats') {
        if (filterDates) filterDates.classList.add('hidden');
        if (filterYear) filterYear.classList.add('hidden');
    } else {
        if (filterDates) filterDates.classList.add('hidden');
        if (filterYear) filterYear.classList.remove('hidden');
    }
    
    loadActiveReport();
};

window.loadActiveReport = async function() {
    const sheet = document.getElementById("report-sheet");
    if (!sheet) return;
    
    sheet.innerHTML = `
        <div class="text-center" style="padding: 40px; color: var(--text-muted);">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 12px; display: block;"></i>
            Generating report, please wait...
        </div>
    `;
    
    try {
        if (activeReportTab === 'date-wise-cashbook') {
            const startDate = document.getElementById("rep-start-date").value;
            const endDate = document.getElementById("rep-end-date").value;
            if (!startDate || !endDate) {
                sheet.innerHTML = `<div class="text-center" style="padding: 30px; color: #e11d48;">Please select both Start and End dates.</div>`;
                return;
            }
            const data = await getCashbookDatewise(startDate, endDate);
            renderDateWiseCashbook(data);
        } else if (activeReportTab === 'month-wise-cashbook') {
            const year = document.getElementById("rep-year").value;
            const data = await getCashbookMonthwise(year);
            renderMonthWiseCashbook(data);
        } else if (activeReportTab === 'income-expenditure') {
            const year = document.getElementById("rep-year").value;
            const data = await getIncomeExpenditure(year);
            renderIncomeExpenditure(data);
        } else if (activeReportTab === 'helpdesk-stats') {
            await renderHelpdeskReport();
        }
    } catch (err) {
        console.error("Report loader error:", err);
        sheet.innerHTML = `<div class="text-center" style="padding: 30px; color: #e11d48;"><i class="fa-solid fa-triangle-exclamation"></i> Error loading report. Please try again.</div>`;
    }
};

window.printActiveReport = function() {
    window.print();
};

function formatDateDisplay(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

// Generate Date-Wise Cash Book calculation via Supabase client
async function getCashbookDatewise(startDate, endDate) {
    const { data: incData, error: incErr } = await sbClient.from('income').select('amount').lt('date_received', startDate);
    if (incErr) throw incErr;
    const incBefore = incData.reduce((sum, item) => sum + parseFloat(item.amount), 0.0);
    
    const { data: expData, error: expErr } = await sbClient.from('expenses').select('amount').lt('date_spent', startDate);
    if (expErr) throw expErr;
    const expBefore = expData.reduce((sum, item) => sum + parseFloat(item.amount), 0.0);
    
    const openingBalance = incBefore - expBefore;
    
    const { data: incomes, error: incRangeErr } = await sbClient.from('income')
        .select('id, flat_no, year, amount, date_received, category, event_name, remarks')
        .gte('date_received', startDate)
        .lte('date_received', endDate);
    if (incRangeErr) throw incRangeErr;
    
    const { data: expenses, error: expRangeErr } = await sbClient.from('expenses')
        .select('id, expense_head, description, amount, date_spent')
        .gte('date_spent', startDate)
        .lte('date_spent', endDate);
    if (expRangeErr) throw expRangeErr;
    
    const { data: owners } = await sbClient.from('owners').select('flat_no, owner_name');
    const ownersMap = {};
    if (owners) {
        owners.forEach(o => {
            ownersMap[o.flat_no] = o.owner_name;
        });
    }
    
    const transactions = [];
    
    incomes.forEach(r => {
        let receiptYear = r.year;
        try {
            const yInt = parseInt(r.year.substring(0, 4), 10);
            receiptYear = `${yInt}-${String(yInt+1).substring(2)}`;
        } catch (e) {}
        const receiptId = `DR-${receiptYear}-${String(r.id).padStart(4, '0')}`;
        const ownerName = ownersMap[r.flat_no] || `Flat ${r.flat_no}`;
        
        let particulars = `Flat ${r.flat_no} - ${ownerName}`;
        if (r.category === 'Special Event') {
            particulars += ` (${r.event_name} Subscription)`;
        } else if (r.category === 'Other') {
            particulars += ` (Other: ${r.remarks || 'Misc'})`;
        } else {
            particulars += ` (Maintenance)`;
        }
        
        transactions.push({
            id: r.id,
            date: r.date_received,
            type: "INCOME",
            particulars: particulars,
            ref_no: receiptId,
            debit: parseFloat(r.amount),
            credit: 0.0
        });
    });
    
    expenses.forEach(r => {
        transactions.push({
            id: r.id,
            date: r.date_spent,
            type: "EXPENSE",
            particulars: `[${r.expense_head}] ${r.description}`,
            ref_no: `EXP-${String(r.id).padStart(4, '0')}`,
            debit: 0.0,
            credit: parseFloat(r.amount)
        });
    });
    
    transactions.sort((a, b) => {
        if (a.date !== b.date) {
            return a.date.localeCompare(b.date);
        }
        return a.type === "INCOME" ? -1 : 1;
    });
    
    const totalDebit = transactions.reduce((sum, t) => sum + t.debit, 0.0);
    const totalCredit = transactions.reduce((sum, t) => sum + t.credit, 0.0);
    
    return {
        start_date: startDate,
        end_date: endDate,
        opening_balance: openingBalance,
        transactions: transactions,
        total_debit: totalDebit,
        total_credit: totalCredit,
        closing_balance: openingBalance + totalDebit - totalCredit
    };
}

// Generate Month-Wise Cash Book calculation via Supabase client
async function getCashbookMonthwise(year) {
    const startOfYear = `${year}-01-01`;
    
    const { data: incData, error: incErr } = await sbClient.from('income').select('amount').lt('date_received', startOfYear);
    if (incErr) throw incErr;
    const incBefore = incData.reduce((sum, item) => sum + parseFloat(item.amount), 0.0);
    
    const { data: expData, error: expErr } = await sbClient.from('expenses').select('amount').lt('date_spent', startOfYear);
    if (expErr) throw expErr;
    const expBefore = expData.reduce((sum, item) => sum + parseFloat(item.amount), 0.0);
    
    const openingBalance = incBefore - expBefore;
    
    const { data: incomes, error: incRangeErr } = await sbClient.from('income').select('amount, month').eq('year', year);
    if (incRangeErr) throw incRangeErr;
    
    const { data: expenses, error: expRangeErr } = await sbClient.from('expenses').select('amount, month').eq('year', year);
    if (expRangeErr) throw expRangeErr;
    
    const incByMonth = {};
    const expByMonth = {};
    
    incomes.forEach(r => {
        incByMonth[r.month] = (incByMonth[r.month] || 0.0) + parseFloat(r.amount);
    });
    
    expenses.forEach(r => {
        expByMonth[r.month] = (expByMonth[r.month] || 0.0) + parseFloat(r.amount);
    });
    
    const monthsList = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthlySummaries = [];
    let runningBal = openingBalance;
    
    monthsList.forEach(m => {
        const receipts = incByMonth[m] || 0.0;
        const payments = expByMonth[m] || 0.0;
        
        const mOpening = runningBal;
        const mClosing = mOpening + receipts - payments;
        runningBal = mClosing;
        
        monthlySummaries.push({
            month: m,
            opening_balance: mOpening,
            receipts: receipts,
            payments: payments,
            closing_balance: mClosing
        });
    });
    
    return {
        year: year,
        opening_balance_year: openingBalance,
        monthly_summaries: monthlySummaries,
        total_receipts: monthlySummaries.reduce((sum, m) => sum + m.receipts, 0.0),
        total_payments: monthlySummaries.reduce((sum, m) => sum + m.payments, 0.0),
        closing_balance_year: runningBal
    };
}

// Generate Income and Expenditure report calculation via Supabase client
async function getIncomeExpenditure(year) {
    const { data: incomes, error: incErr } = await sbClient.from('income').select('flat_no, amount, category, event_name').eq('year', year);
    if (incErr) throw incErr;
    
    const { data: expenses, error: expErr } = await sbClient.from('expenses').select('expense_head, amount').eq('year', year);
    if (expErr) throw expErr;
    
    const incomeByFlat = {};
    const incomeByGroup = {};
    incomes.forEach(r => {
        incomeByFlat[r.flat_no] = (incomeByFlat[r.flat_no] || 0.0) + parseFloat(r.amount);
        
        let groupName = "Monthly Maintenance Charge Collections";
        if (r.category === "Special Event") {
            groupName = `${r.event_name} Collections`;
        } else if (r.category === "Other") {
            groupName = "Other Collections";
        }
        incomeByGroup[groupName] = (incomeByGroup[groupName] || 0.0) + parseFloat(r.amount);
    });
    
    const expenseByGroup = {};
    expenses.forEach(r => {
        const head = r.expense_head || "Miscellaneous";
        expenseByGroup[head] = (expenseByGroup[head] || 0.0) + parseFloat(r.amount);
    });
    
    const { data: owners } = await sbClient.from('owners').select('flat_no, owner_name');
    const ownersMap = {};
    if (owners) {
        owners.forEach(o => {
            ownersMap[o.flat_no] = o.owner_name;
        });
    }
    
    const incomeDetails = [];
    Object.keys(incomeByFlat).forEach(flat => {
        const amount = incomeByFlat[flat];
        incomeDetails.push({
            flat_no: flat,
            owner_name: ownersMap[flat] || `Flat ${flat}`,
            amount: amount
        });
    });
    incomeDetails.sort((a, b) => a.flat_no.localeCompare(b.flat_no));
    
    const expenditures = [];
    let totalExpenditure = 0.0;
    Object.keys(expenseByGroup).forEach(head => {
        const amount = expenseByGroup[head];
        totalExpenditure += amount;
        expenditures.push({
            category: head,
            amount: amount
        });
    });
    expenditures.sort((a, b) => a.category.localeCompare(b.category));
    
    const finalIncomes = [];
    let totalIncome = 0.0;
    Object.keys(incomeByGroup).forEach(group => {
        const amount = incomeByGroup[group];
        totalIncome += amount;
        finalIncomes.push({
            category: group,
            amount: amount
        });
    });
    finalIncomes.sort((a, b) => a.category.localeCompare(b.category));
    
    const surplus = totalIncome - totalExpenditure;
    
    return {
        year: year,
        incomes: finalIncomes,
        income_details: incomeDetails,
        expenditures: expenditures,
        total_income: totalIncome,
        total_expenditure: totalExpenditure,
        surplus_deficit: surplus
    };
}

function renderDateWiseCashbook(data) {
    const sheet = document.getElementById("report-sheet");
    if (!sheet) return;
    
    let rowsHTML = "";
    let runningBal = data.opening_balance;
    
    rowsHTML += `
        <tr class="row-opening">
            <td>${formatDateDisplay(data.start_date)}</td>
            <td>-</td>
            <td>Opening Balance B/F</td>
            <td class="text-right">-</td>
            <td class="text-right">-</td>
            <td class="text-right rep-bal">${formatCurrency(runningBal)}</td>
        </tr>
    `;
    
    if (data.transactions.length === 0) {
        rowsHTML += `
            <tr>
                <td colspan="6" class="text-center" style="color: #64748b; padding: 20px;">
                    No transactions recorded during this period.
                </td>
            </tr>
        `;
    } else {
        data.transactions.forEach(t => {
            runningBal = runningBal + t.debit - t.credit;
            
            const drText = t.debit > 0 ? formatCurrency(t.debit) : "-";
            const crText = t.credit > 0 ? formatCurrency(t.credit) : "-";
            
            rowsHTML += `
                <tr>
                    <td>${formatDateDisplay(t.date)}</td>
                    <td><code>${t.ref_no}</code></td>
                    <td>${t.particulars}</td>
                    <td class="text-right ${t.debit > 0 ? 'amt-dr' : ''}">${drText}</td>
                    <td class="text-right ${t.credit > 0 ? 'amt-cr' : ''}">${crText}</td>
                    <td class="text-right rep-bal">${formatCurrency(runningBal)}</td>
                </tr>
            `;
        });
    }
    
    rowsHTML += `
        <tr class="row-closing">
            <td>${formatDateDisplay(data.end_date)}</td>
            <td>-</td>
            <td>Closing Balance C/F</td>
            <td class="text-right">-</td>
            <td class="text-right">-</td>
            <td class="text-right rep-bal">${formatCurrency(data.closing_balance)}</td>
        </tr>
    `;
    
    sheet.innerHTML = `
        <div class="report-header">
            <h2>${getBuildingName().toUpperCase()}${getBlockName() ? ` (${getBlockName().toUpperCase()})` : ''}</h2>
            <p><strong>DATE-WISE CASH BOOK</strong></p>
            <p>Period: ${formatDateDisplay(data.start_date)} to ${formatDateDisplay(data.end_date)}</p>
        </div>
        
        <div class="report-summary-cards">
            <div class="report-sum-card">
                <h4>Opening Balance</h4>
                <p>${formatCurrency(data.opening_balance)}</p>
            </div>
            <div class="report-sum-card sum-debit">
                <h4>Total Receipts (+)</h4>
                <p>${formatCurrency(data.total_debit)}</p>
            </div>
            <div class="report-sum-card sum-credit">
                <h4>Total Payments (-)</h4>
                <p>${formatCurrency(data.total_credit)}</p>
            </div>
        </div>
        
        <table class="report-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Voucher/Ref No</th>
                    <th>Particulars</th>
                    <th class="text-right">Receipts (Dr)</th>
                    <th class="text-right">Payments (Cr)</th>
                    <th class="text-right">Balance</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHTML}
            </tbody>
        </table>
    `;
}

function renderMonthWiseCashbook(data) {
    const sheet = document.getElementById("report-sheet");
    if (!sheet) return;
    
    let rowsHTML = "";
    data.monthly_summaries.forEach(m => {
        const rcptText = m.receipts > 0 ? formatCurrency(m.receipts) : "-";
        const pymtText = m.payments > 0 ? formatCurrency(m.payments) : "-";
        
        rowsHTML += `
            <tr>
                <td><strong>${m.month}</strong></td>
                <td class="text-right">${formatCurrency(m.opening_balance)}</td>
                <td class="text-right amt-dr">${rcptText}</td>
                <td class="text-right amt-cr">${pymtText}</td>
                <td class="text-right rep-bal">${formatCurrency(m.closing_balance)}</td>
            </tr>
        `;
    });
    
    sheet.innerHTML = `
        <div class="report-header">
            <h2>${getBuildingName().toUpperCase()}${getBlockName() ? ` (${getBlockName().toUpperCase()})` : ''}</h2>
            <p><strong>MONTH-WISE CASH BOOK SUMMARY</strong></p>
            <p>Year: ${data.year}</p>
        </div>
        
        <div class="report-summary-cards">
            <div class="report-sum-card">
                <h4>Year Opening</h4>
                <p>${formatCurrency(data.opening_balance_year)}</p>
            </div>
            <div class="report-sum-card sum-debit">
                <h4>Total Receipts</h4>
                <p>${formatCurrency(data.total_receipts)}</p>
            </div>
            <div class="report-sum-card sum-credit">
                <h4>Total Payments</h4>
                <p>${formatCurrency(data.total_payments)}</p>
            </div>
        </div>
        
        <table class="report-table">
            <thead>
                <tr>
                    <th>Month</th>
                    <th class="text-right">Opening Balance</th>
                    <th class="text-right">Receipts (Dr)</th>
                    <th class="text-right">Payments (Cr)</th>
                    <th class="text-right">Closing Balance</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHTML}
            </tbody>
        </table>
    `;
}

function renderIncomeExpenditure(data) {
    const sheet = document.getElementById("report-sheet");
    if (!sheet) return;
    
    let incRowsHTML = "";
    if (data.incomes.length === 0) {
        incRowsHTML += `<tr><td colspan="2" class="text-center" style="color: #64748b;">No Income Recorded</td></tr>`;
    } else {
        data.incomes.forEach(inc => {
            incRowsHTML += `
                <tr>
                    <td>${inc.category}</td>
                    <td class="text-right amt-dr">${formatCurrency(inc.amount)}</td>
                </tr>
            `;
        });
    }
    
    let expRowsHTML = "";
    if (data.expenditures.length === 0) {
        expRowsHTML += `<tr><td colspan="2" class="text-center" style="color: #64748b;">No Expenditures Recorded</td></tr>`;
    } else {
        data.expenditures.forEach(exp => {
            expRowsHTML += `
                <tr>
                    <td>${exp.category}</td>
                    <td class="text-right amt-cr">${formatCurrency(exp.amount)}</td>
                </tr>
            `;
        });
    }
    
    const isSurplus = data.surplus_deficit >= 0;
    const absVal = Math.abs(data.surplus_deficit);
    
    let detailsRowsHTML = "";
    if (data.income_details.length === 0) {
        detailsRowsHTML += `<tr><td colspan="3" class="text-center" style="color: #64748b;">No Flat collections found.</td></tr>`;
    } else {
        data.income_details.forEach(det => {
            detailsRowsHTML += `
                <tr>
                    <td><strong>Flat ${det.flat_no}</strong></td>
                    <td>${det.owner_name}</td>
                    <td class="text-right amt-dr">${formatCurrency(det.amount)}</td>
                </tr>
            `;
        });
    }
    
    sheet.innerHTML = `
        <div class="report-header">
            <h2>${getBuildingName().toUpperCase()}${getBlockName() ? ` (${getBlockName().toUpperCase()})` : ''}</h2>
            <p><strong>INCOME AND EXPENDITURE ACCOUNT</strong></p>
            <p>For the Year Ended: 31st December ${data.year}</p>
        </div>
        
        <div class="inc-exp-grid">
            <div class="inc-exp-column col-expense">
                <h3>Expenditure (Debit)</h3>
                <table class="inc-exp-table">
                    <tbody>
                        ${expRowsHTML}
                        <tr class="total-row">
                            <td><strong>Total Expenditure</strong></td>
                            <td class="text-right">${formatCurrency(data.total_expenditure)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="inc-exp-column col-income">
                <h3>Income (Credit)</h3>
                <table class="inc-exp-table">
                    <tbody>
                        ${incRowsHTML}
                        <tr class="total-row">
                            <td><strong>Total Income</strong></td>
                            <td class="text-right">${formatCurrency(data.total_income)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="surplus-card ${isSurplus ? 'positive' : 'negative'}">
            ${isSurplus 
                ? `<i class="fa-solid fa-circle-arrow-up"></i> Excess of Income over Expenditure (Surplus): <strong>${formatCurrency(absVal)}</strong>`
                : `<i class="fa-solid fa-circle-arrow-down"></i> Excess of Expenditure over Income (Deficit): <strong>${formatCurrency(absVal)}</strong>`
            }
        </div>
        
        <div style="margin-top: 30px;">
            <h4 style="color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin-bottom: 12px; font-weight: 700;">
                <i class="fa-solid fa-list-ul"></i> Flat Collections Detailed breakdown:
            </h4>
            <table class="report-table" style="font-size: 0.8rem;">
                <thead>
                    <tr>
                        <th>Flat No</th>
                        <th>Owner / Tenant Name</th>
                        <th class="text-right">Total Maintenance Paid (Rs.)</th>
                    </tr>
                </thead>
                <tbody>
                    ${detailsRowsHTML}
                </tbody>
            </table>
        </div>
    `;
}

// Convert numbers into words for PDF receipts
function numberToWords(number) {
    try {
        const val = Math.round(parseFloat(number) * 100) / 100;
        if (isNaN(val)) return "";
        const rupees = Math.floor(val);
        const paise = Math.round((val - rupees) * 100);
        
        function convertBelowThousand(n) {
            const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", 
                           "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
            const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
            
            let res = "";
            if (n >= 100) {
                res += units[Math.floor(n / 100)] + " Hundred ";
                n %= 100;
            }
            if (n >= 20) {
                res += tens[Math.floor(n / 10)] + " ";
                n %= 10;
            }
            if (n > 0) {
                res += units[n] + " ";
            }
            return res.trim();
        }
        
        function convertWholeNumber(num) {
            if (num === 0) return "Zero";
            let crore = Math.floor(num / 10000000);
            num %= 10000000;
            let lakh = Math.floor(num / 100000);
            num %= 100000;
            let thousand = Math.floor(num / 1000);
            num %= 1000;
            
            let parts = [];
            if (crore > 0) parts.push(convertBelowThousand(crore) + " Crore");
            if (lakh > 0) parts.push(convertBelowThousand(lakh) + " Lakh");
            if (thousand > 0) parts.push(convertBelowThousand(thousand) + " Thousand");
            if (num > 0) parts.push(convertBelowThousand(num));
            return parts.join(" ").trim();
        }
        
        if (rupees === 0 && paise === 0) {
            return "Zero Rupees Only";
        }
        
        let words = "";
        if (rupees > 0) {
            words += convertWholeNumber(rupees) + " Rupees";
        }
        if (paise > 0) {
            if (rupees > 0) {
                words += " and ";
            }
            words += convertBelowThousand(paise) + " Paise";
        }
        return words.trim() + " Only";
    } catch (e) {
        console.error("Number to words conversion failed:", e);
        return "";
    }
}

// Clean date attributes extracted from Excel files
function cleanSpreadsheetDate(rawVal, year, monthName) {
    const monthMap = {
        "January": "01", "February": "02", "March": "03", "April": "04",
        "May": "05", "June": "06", "July": "07", "August": "08",
        "September": "09", "October": "10", "November": "11", "December": "12"
    };
    const fallbackMonthNum = monthMap[monthName] || "05";
    const fallback = `${year}-${fallbackMonthNum}-01`;
    
    if (!rawVal) return fallback;
    
    if (rawVal instanceof Date) {
        // Add 12 hours to safely push past any precision-related midnight issues from Excel floats
        const safeDate = new Date(rawVal.getTime() + 12 * 60 * 60 * 1000);
        const y = safeDate.getFullYear();
        const m = String(safeDate.getMonth() + 1).padStart(2, '0');
        const d = String(safeDate.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    
    const valStr = String(rawVal).trim();
    if (!valStr || valStr.toLowerCase() === "nan" || valStr.toLowerCase() === "null") {
        return fallback;
    }
    
    if (/^\d{4}-\d{2}-\d{2}$/.test(valStr)) {
        return valStr;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(valStr)) {
        return valStr.split(' ')[0];
    }
    
    const cleanStr = valStr.split(' ')[0];
    const seps = ['/', '.', '-'];
    for (let sep of seps) {
        const parts = cleanStr.split(sep);
        if (parts.length === 3) {
            let day, month, yr;
            if (parts[0].length === 4) {
                yr = parts[0];
                month = parts[1];
                day = parts[2];
            } else {
                day = parts[0];
                month = parts[1];
                yr = parts[2];
            }
            if (day.length < 2) day = "0" + day;
            if (month.length < 2) month = "0" + month;
            if (yr.length === 2) yr = "20" + yr;
            if (day.length === 2 && month.length === 2 && yr.length === 4) {
                const d = parseInt(day, 10);
                const m = parseInt(month, 10);
                const y = parseInt(yr, 10);
                if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
                    return `${yr}-${month}-${day}`;
                }
            }
        }
    }
    
    return fallback;
}

// Parse month details out of a column header string
function parseMonthLabel(label) {
    if (!label) return null;
    const cleanLabel = String(label).trim();
    const m = cleanLabel.match(/([A-Za-z]+)['\-\s]*(\d+)/);
    if (m) {
        let monthName = m[1].trim();
        monthName = monthName.charAt(0).toUpperCase() + monthName.slice(1).toLowerCase();
        let yearShort = m[2].trim();
        if (yearShort.length === 2) {
            yearShort = "20" + yearShort;
        }
        return { year: yearShort, month: monthName };
    }
    return null;
}

// Handle bulk ledger imports via SheetJS
window.handleImportSubmit = async function(e) {
    e.preventDefault();
    if (!sbClient) {
        showToast("Database not connected.", "error");
        return;
    }
    
    if (!hasPermission('ledger:import')) {
        showToast("Access Denied: You don't have permission to import ledgers.", "error");
        return;
    }
    
    const fileInput = document.getElementById("import-file");
    if (!fileInput.files || !fileInput.files[0]) return;
    
    const btn = document.getElementById("btn-import-submit");
    btn.disabled = true;
    btn.textContent = "Uploading & Parsing...";
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = async function(event) {
        try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const sheetNames = workbook.SheetNames;
            
            let incomeSheetName = null;
            let expenseSheetName = null;
            
            sheetNames.forEach(s => {
                const sClean = s.trim().toUpperCase();
                if (sClean.includes("DETAIL")) {
                    incomeSheetName = s;
                } else if (sClean.includes("MC") && !sClean.includes("WISE") && !incomeSheetName) {
                    incomeSheetName = s;
                }
                
                if (sClean.includes("EXPENSE") && !sClean.includes("INCOME")) {
                    expenseSheetName = s;
                }
            });
            
            if (!incomeSheetName) {
                incomeSheetName = sheetNames[0];
            }
            
            const { error: delIncError } = await sbClient.from('income').delete().gt('id', -1);
            if (delIncError) throw delIncError;
            
            const { error: delExpError } = await sbClient.from('expenses').delete().gt('id', -1);
            if (delExpError) throw delExpError;
            
            let importedIncomeCount = 0;
            let importedExpensesCount = 0;
            
            // --- 1. PARSE INCOME SHEET ---
            const incSheet = workbook.Sheets[incomeSheetName];
            const incRows = XLSX.utils.sheet_to_json(incSheet, { header: 1 });
            
            let headerRowIdx = -1;
            let isSimpleIncome = false;
            let simpleFlatIdx = -1, simpleDateIdx = -1, simpleAmtIdx = -1;

            for (let r = 0; r < incRows.length; r++) {
                const rowCells = incRows[r].map(v => String(v || '').toUpperCase().trim());
                
                const fIdx = rowCells.findIndex(v => v === "FLAT NO" || v === "FLAT NO.");
                const dIdx = rowCells.findIndex(v => v === "DATE RECEIVED" || v === "DATE");
                const aIdx = rowCells.findIndex(v => v === "AMOUNT");
                
                if (fIdx !== -1 && dIdx !== -1 && aIdx !== -1) {
                    isSimpleIncome = true;
                    simpleFlatIdx = fIdx;
                    simpleDateIdx = dIdx;
                    simpleAmtIdx = aIdx;
                    headerRowIdx = r;
                    break;
                }
                
                if (rowCells.includes("FLAT NO.") || rowCells.includes("FLAT NO")) {
                    headerRowIdx = r;
                    break;
                }
            }
            
            if (headerRowIdx !== -1) {
                const columnsRow = incRows[headerRowIdx];
                const dataRows = incRows.slice(headerRowIdx + 1);
                const incomeInserts = [];
                
                let flatColIdx = -1;
                for (let c = 0; c < columnsRow.length; c++) {
                    if (String(columnsRow[c] || '').toUpperCase().includes("FLAT")) {
                        flatColIdx = c;
                        break;
                    }
                }
                
                let monthPairs = [];
                if (headerRowIdx > 0) {
                    const monthRow = incRows[headerRowIdx - 1];
                    for (let i = 5; i < monthRow.length; i++) {
                        const val = monthRow[i];
                        if (val) {
                            let parsedDate = null;
                            if (val instanceof Date) {
                                parsedDate = val;
                            } else {
                                const d = new Date(val);
                                if (!isNaN(d.getTime())) {
                                    parsedDate = d;
                                }
                            }
                            if (parsedDate) {
                                const yr = String(parsedDate.getFullYear());
                                const mn = parsedDate.toLocaleString('en-US', { month: 'long' });
                                monthPairs.push({ year: yr, month: mn, amtIdx: i, dtIdx: i + 1 });
                            }
                        }
                    }
                }
                
                if (monthPairs.length === 0) {
                    monthPairs = [
                        { year: "2025", month: "April", amtIdx: 5, dtIdx: 6 },
                        { year: "2025", month: "May", amtIdx: 7, dtIdx: 8 },
                        { year: "2025", month: "June", amtIdx: 9, dtIdx: 10 },
                        { year: "2025", month: "July", amtIdx: 11, dtIdx: 12 },
                        { year: "2025", month: "August", amtIdx: 13, dtIdx: 14 },
                        { year: "2025", month: "September", amtIdx: 15, dtIdx: 16 },
                        { year: "2025", month: "October", amtIdx: 17, dtIdx: 18 },
                        { year: "2025", month: "November", amtIdx: 19, dtIdx: 20 },
                        { year: "2025", month: "December", amtIdx: 21, dtIdx: 22 },
                        { year: "2026", month: "January", amtIdx: 23, dtIdx: 24 },
                        { year: "2026", month: "February", amtIdx: 25, dtIdx: 26 },
                        { year: "2026", month: "March", amtIdx: 27, dtIdx: 28 },
                        { year: "2026", month: "April", amtIdx: 29, dtIdx: 30 },
                        { year: "2026", month: "May", amtIdx: 31, dtIdx: 32 }
                    ];
                }
                
                if (isSimpleIncome) {
                    dataRows.forEach(row => {
                        const flatVal = String(row[simpleFlatIdx] || '').trim().toUpperCase().replace(/\s+/g, '');
                        if (!flatVal || flatVal === "NAN" || flatVal.includes("FLOOR") || flatVal.length > 8) return;
                        
                        const rawAmt = row[simpleAmtIdx];
                        const rawDt = row[simpleDateIdx];
                        let amtVal = parseFloat(rawAmt);
                        if (!isNaN(amtVal) && amtVal > 0) {
                            const dateStr = cleanSpreadsheetDate(rawDt, "2026", "May");
                            const parsedD = new Date(dateStr);
                            const actualYear = String(parsedD.getFullYear());
                            const monthsArr = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                            const actualMonth = monthsArr[parsedD.getMonth()] || "May";
                            incomeInserts.push({
                                flat_no: flatVal,
                                year: actualYear,
                                month: actualMonth,
                                amount: amtVal,
                                date_received: dateStr
                            });
                        }
                    });
                } else if (flatColIdx !== -1) {
                    dataRows.forEach(row => {
                        const flatVal = String(row[flatColIdx] || '').trim().toUpperCase().replace(/\s+/g, '');
                        if (!flatVal || flatVal === "NAN" || flatVal.includes("FLOOR") || flatVal.length > 8) {
                            return;
                        }
                        
                        monthPairs.forEach(mp => {
                            if (mp.amtIdx < row.length) {
                                const rawAmt = row[mp.amtIdx];
                                const rawDt = mp.dtIdx < row.length ? row[mp.dtIdx] : "";
                                
                                let amtVal = parseFloat(rawAmt);
                                if (isNaN(amtVal) || String(rawAmt).toUpperCase().includes("ROOM") || String(rawAmt).toUpperCase().includes("TYPE")) {
                                    amtVal = 0.0;
                                }
                                
                                if (amtVal > 0) {
                                    const dateStr = cleanSpreadsheetDate(rawDt, mp.year, mp.month);
                                    const parsedD = new Date(dateStr);
                                    const actualYear = String(parsedD.getFullYear());
                                    const monthsArr = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                                    const actualMonth = monthsArr[parsedD.getMonth()] || mp.month;
                                    incomeInserts.push({
                                        flat_no: flatVal,
                                        year: actualYear,
                                        month: actualMonth,
                                        amount: amtVal,
                                        date_received: dateStr
                                    });
                                }
                            }
                        });
                    });
                }
                    
                    if (incomeInserts.length > 0) {
                        const uniqueFlats = [...new Set(incomeInserts.map(i => i.flat_no))];
                        const ownerUpserts = uniqueFlats.map(f => ({ flat_no: f, owner_name: `Flat ${f}` }));
                        const { error: ownErr } = await sbClient.from('owners').upsert(ownerUpserts, { onConflict: 'flat_no', ignoreDuplicates: true });
                        if (ownErr) console.warn("Owner upsert warning:", ownErr);

                        const chunkSize = 200;
                        for (let i = 0; i < incomeInserts.length; i += chunkSize) {
                            const chunk = incomeInserts.slice(i, i + chunkSize);
                            const { error: insErr } = await sbClient.from('income').insert(chunk);
                            if (insErr) throw insErr;
                        }
                        importedIncomeCount = incomeInserts.length;
                    }
            }
            
            // --- 2. PARSE EXPENSE SHEET ---
            if (expenseSheetName) {
                const expSheet = workbook.Sheets[expenseSheetName];
                const expRows = XLSX.utils.sheet_to_json(expSheet, { header: 1 });
                
                let expHeaderIdx = -1;
                let isSimpleExpense = false;
                let expDescIdx = -1, expDateIdx = -1, expAmtIdx = -1;

                for (let r = 0; r < expRows.length; r++) {
                    const rowCells = expRows[r].map(v => String(v || '').toUpperCase().trim());
                    
                    const dIdx = rowCells.findIndex(v => v === "DESCRIPTION");
                    const dateIdx = rowCells.findIndex(v => v === "DATE SPENT" || v === "DATE");
                    const aIdx = rowCells.findIndex(v => v === "AMOUNT");

                    if (dIdx !== -1 && dateIdx !== -1 && aIdx !== -1) {
                        isSimpleExpense = true;
                        expDescIdx = dIdx;
                        expDateIdx = dateIdx;
                        expAmtIdx = aIdx;
                        expHeaderIdx = r;
                        break;
                    }

                    const rowTxt = expRows[r].map(v => String(v || '')).join('').toUpperCase();
                    if (rowTxt.includes("DESCRIPTION")) {
                        expHeaderIdx = r;
                        break;
                    }
                }
                
                if (expHeaderIdx !== -1 && (isSimpleExpense || expRows.length > 2)) {
                    const dfExpData = expRows.slice(expHeaderIdx + 1);
                    const expenseInserts = [];
                    const row1 = expRows[1] || [];
                    const row2 = expRows[2] || [];
                    
                    let currentMonth = null;
                    const expMonthCols = [];
                    
                    for (let i = 2; i < row1.length; i++) {
                        const val1 = row1[i];
                        const val2 = row2[i];
                        if (val1 && String(val1).trim() !== "") {
                            currentMonth = String(val1).trim();
                        }
                        if (currentMonth) {
                            if (val2) {
                                const val2Clean = String(val2).trim().toUpperCase();
                                if (val2Clean.includes("AMOUNT")) {
                                    let dateIdx = null;
                                    if (i + 1 < row2.length) {
                                        const nextVal = row2[i+1];
                                        if (nextVal) {
                                            const nextValClean = String(nextVal).trim().toUpperCase();
                                            if (nextValClean.includes("DATE") || nextValClean.includes("DT OF") || nextValClean.includes("PAYMENT")) {
                                                dateIdx = i + 1;
                                            }
                                        }
                                    }
                                    const parsed = parseMonthLabel(currentMonth);
                                    if (parsed) {
                                        expMonthCols.push({
                                            year: parsed.year,
                                            month: parsed.month,
                                            amtCol: i,
                                            dtCol: dateIdx
                                        });
                                    }
                                }
                            }
                        }
                    }
                    
                    if (isSimpleExpense) {
                        dfExpData.forEach(row => {
                            const desc = String(row[expDescIdx] || '').trim();
                            if (!desc || desc.toUpperCase().includes("SR.") || desc.toUpperCase().includes("TOTAL") || desc.length < 3) return;
                            
                            const rawAmt = row[expAmtIdx];
                            const rawDt = row[expDateIdx];
                            let parsedAmt = parseFloat(rawAmt);
                            
                            if (!isNaN(parsedAmt) && parsedAmt > 0) {
                                const dateStr = cleanSpreadsheetDate(rawDt, "2026", "May");
                                const parsedD = new Date(dateStr);
                                const actualYear = String(parsedD.getFullYear());
                                const monthsArr = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                                const actualMonth = monthsArr[parsedD.getMonth()] || "May";
                                expenseInserts.push({
                                    year: actualYear,
                                    month: actualMonth,
                                    expense_head: 'Uncategorized',
                                    description: desc,
                                    amount: parsedAmt,
                                    date_spent: dateStr
                                });
                            }
                        });
                    } else {
                        dfExpData.forEach(row => {
                            if (row.length < 3) return;
                            const desc = String(row[1] || '').trim();
                            if (!desc || desc.toUpperCase().includes("SR.") || desc.toUpperCase().includes("TOTAL") || desc.length < 3) {
                                return;
                            }
                            
                            expMonthCols.forEach(emc => {
                                if (emc.amtCol < row.length) {
                                    const amtValRaw = row[emc.amtCol];
                                    const dtValRaw = (emc.dtCol !== null && emc.dtCol < row.length) ? row[emc.dtCol] : "";
                                    
                                    let parsedAmt = parseFloat(amtValRaw);
                                    if (isNaN(parsedAmt)) {
                                        parsedAmt = 0.0;
                                    }
                                    
                                    if (parsedAmt > 0) {
                                        const dateStr = cleanSpreadsheetDate(dtValRaw, emc.year, emc.month);
                                        const parsedD = new Date(dateStr);
                                        const actualYear = String(parsedD.getFullYear());
                                        const monthsArr = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                                        const actualMonth = monthsArr[parsedD.getMonth()] || emc.month;
                                        expenseInserts.push({
                                            year: actualYear,
                                            month: actualMonth,
                                            expense_head: 'Uncategorized',
                                            description: desc,
                                            amount: parsedAmt,
                                            date_spent: dateStr
                                        });
                                    }
                                }
                            });
                        });
                    }
                    
                    if (expenseInserts.length > 0) {
                        const chunkSize = 200;
                        for (let i = 0; i < expenseInserts.length; i += chunkSize) {
                            const chunk = expenseInserts.slice(i, i + chunkSize);
                            const { error: insErr } = await sbClient.from('expenses').insert(chunk);
                            if (insErr) throw insErr;
                        }
                        importedExpensesCount = expenseInserts.length;
                    }
                }
            }
            
            showToast(`Excel imports finished successfully!\nParsed ${importedIncomeCount} income collections and ${importedExpensesCount} expense vouchers.`, "success");
            closeModal("importModal");
            refreshDashboard();
            
        } catch (err) {
            console.error("Ledger import error:", err);
            showToast(err.message || "Failed parsing document structure.", "error");
        } finally {
            btn.disabled = false;
            btn.textContent = "Upload & Parse";
        }
    };
    
    reader.readAsArrayBuffer(file);
};

// Handle owners registry updates via SheetJS
window.handleOwnersSubmit = async function(e) {
    e.preventDefault();
    if (!sbClient) {
        showToast("Database not connected.", "error");
        return;
    }
    
    if (!hasPermission('owners:upload')) {
        showToast("Access Denied: You don't have permission to upload owner mappings.", "error");
        return;
    }
    
    const fileInput = document.getElementById("owners-file");
    if (!fileInput.files || !fileInput.files[0]) return;
    
    const btn = document.getElementById("btn-owners-submit");
    btn.disabled = true;
    btn.textContent = "Uploading...";
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = async function(event) {
        try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            
            let headerRowIdx = -1;
            for (let r = 0; r < rows.length; r++) {
                const rowStr = rows[r].map(v => String(v || '').toUpperCase()).join(' ');
                if (rowStr.includes("FLAT NO") || rowStr.includes("FLAT")) {
                    headerRowIdx = r;
                    break;
                }
            }
            
            let startIdx = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
            const upsertData = [];
            
            for (let r = startIdx; r < rows.length; r++) {
                const row = rows[r];
                if (!row || row.length < 3) continue;
                
                const nameVal = String(row[1] || '').trim();
                const flatVal = String(row[2] || '').trim().toUpperCase().replace(/\s+/g, '');
                
                if (flatVal && flatVal !== "NAN" && flatVal !== "UNDEFINED") {
                    const ownerName = (nameVal && nameVal !== "nan" && nameVal !== "undefined") ? nameVal : `Flat ${flatVal}`;
                    upsertData.push({
                        flat_no: flatVal,
                        owner_name: ownerName
                    });
                }
            }
            
            if (upsertData.length === 0) {
                throw new Error("No valid owner mappings found in the spreadsheet.");
            }
            
            const { error } = await sbClient.from('owners').upsert(upsertData, { onConflict: 'flat_no' });
            if (error) throw error;
            
            showToast(`Successfully loaded ${upsertData.length} owner mappings!`);
            closeModal("ownersModal");
            loadFlats();
        } catch (err) {
            console.error("Owners import error:", err);
            showToast(err.message || "Failed parsing owners spreadsheet.", "error");
        } finally {
            btn.disabled = false;
            btn.textContent = "Upload Mapping";
        }
    };
    
    reader.readAsArrayBuffer(file);
};

// Export entire ledger dynamically using SheetJS
window.exportLedgerToExcel = async function() {
    if (!sbClient) {
        showToast("Database not connected.", "error");
        return;
    }
    
    try {
        showToast("Generating spreadsheet...", "success");
        
        const { data: incomeData, error: incErr } = await sbClient.from('income').select('id, flat_no, year, month, amount, date_received').order('id');
        if (incErr) throw incErr;
        
        const { data: expenseData, error: expErr } = await sbClient.from('expenses').select('id, year, month, description, amount, date_spent').order('id');
        if (expErr) throw expErr;
        
        const formattedIncome = incomeData.map(item => ({
            "ID": item.id,
            "Flat Details": item.flat_no,
            "Year": item.year,
            "Month": item.month,
            "Amount Paid (Rs.)": item.amount,
            "Date Received": item.date_received
        }));
        
        const formattedExpense = expenseData.map(item => ({
            "ID": item.id,
            "Year": item.year,
            "Month": item.month,
            "Description": item.description,
            "Amount Spent (Rs.)": item.amount,
            "Date Spent": item.date_spent
        }));
        
        const wb = XLSX.utils.book_new();
        const wsInc = XLSX.utils.json_to_sheet(formattedIncome);
        const wsExp = XLSX.utils.json_to_sheet(formattedExpense);
        
        XLSX.utils.book_append_sheet(wb, wsInc, "Income Summary");
        XLSX.utils.book_append_sheet(wb, wsExp, "Expense Summary");
        
        const dateStr = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '');
        const buildingSlug = getBuildingName().replace(/\s+/g, '_').toLowerCase();
        const filename = `${buildingSlug}_ledger_${dateStr}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        showToast("Spreadsheet downloaded successfully!");
    } catch (err) {
        console.error("Export ledger error:", err);
        showToast("Could not export ledger.", "error");
    }
};

// --- SUPPORT HELPDESK & TICKET SYSTEM ---

window.openTicketsModal = async function() {
    openModal('ticketsModal');
    await loadTickets();
};

window.openNewTicketModal = function() {
    openModal('newTicketModal');
    document.getElementById("new-ticket-form").reset();
};

window.setTicketScope = function(scope) {
    ticketScope = scope;
    const btnAll = document.getElementById("scope-btn-all");
    const btnMy = document.getElementById("scope-btn-my");
    if (btnAll) btnAll.classList.toggle("active", scope === 'ALL');
    if (btnMy) btnMy.classList.toggle("active", scope === 'MY');
    filterTickets();
};

window.loadTickets = async function() {
    if (!sbClient) return;
    
    const listContainer = document.getElementById("tickets-list");
    if (listContainer) {
        listContainer.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; color: var(--color-yellow);"></i><p style="margin-top: 8px; font-size: 0.85rem; color: var(--text-secondary);">Loading tickets...</p></div>';
    }
    
    try {
        // Fetch all tickets
        const { data: ticketsData, error: ticketsErr } = await sbClient
            .from('tickets')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (ticketsErr) throw ticketsErr;
        
        // Fetch all profiles
        const { data: profilesData, error: profilesErr } = await sbClient
            .from('profiles')
            .select('id, email, role');
            
        if (profilesErr) throw profilesErr;
        
        const profileMap = {};
        if (profilesData) {
            profilesData.forEach(p => {
                profileMap[p.id] = p;
            });
        }
        
        loadedTickets = (ticketsData || []).map(t => {
            const creator = profileMap[t.created_by];
            const fm = profileMap[t.floor_manager_id];
            const resolver = profileMap[t.resolved_by];
            const assignee = profileMap[t.assigned_to];
            
            const approvals = Array.isArray(t.committee_approvals) ? t.committee_approvals : [];
            const approverEmails = approvals.map(uid => profileMap[uid]?.email || 'Unknown Member');
            
            return {
                ...t,
                creator_email: creator ? creator.email : 'Unknown',
                floor_manager_email: fm ? fm.email : 'Unknown',
                resolver_email: resolver ? resolver.email : 'Unknown',
                assigned_email: assignee ? assignee.email : 'Unassigned',
                approver_emails: approverEmails
            };
        });
        
        // Render KPIs
        calculateAndRenderKPIs();
        
        filterTickets();
        
        // Retain selection if valid
        if (selectedTicketId) {
            const stillExists = loadedTickets.some(t => t.id === selectedTicketId);
            if (stillExists) {
                selectTicket(selectedTicketId);
            } else {
                selectedTicketId = null;
                resetDetailPanel();
            }
        } else {
            resetDetailPanel();
        }
        
    } catch (err) {
        console.error("loadTickets error:", err);
        showToast("Failed to load helpdesk tickets.", "error");
        if (listContainer) {
            listContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--color-rose);"><i class="fa-solid fa-triangle-exclamation"></i><p style="margin-top: 8px; font-size: 0.85rem;">Error loading tickets.</p></div>';
        }
    }
};

function calculateAndRenderKPIs() {
    const openStatuses = ['Pending', 'Recommended', 'Approved', 'Reopened'];
    const resolvedStatuses = ['Resolved', 'Closed'];
    
    let openCount = 0;
    let resolvedCount = 0;
    let totalResolveTimeMs = 0;
    let resolvedWithTimeCount = 0;
    
    loadedTickets.forEach(t => {
        if (openStatuses.includes(t.status)) {
            openCount++;
        } else if (resolvedStatuses.includes(t.status)) {
            resolvedCount++;
        }
        
        // Calculate resolution time
        if (t.resolved_at && t.created_at) {
            const diff = new Date(t.resolved_at) - new Date(t.created_at);
            if (diff > 0) {
                totalResolveTimeMs += diff;
                resolvedWithTimeCount++;
            }
        }
    });
    
    const openEl = document.getElementById("kpi-open-count");
    const resolvedEl = document.getElementById("kpi-resolved-count");
    const avgEl = document.getElementById("kpi-avg-time");
    
    if (openEl) openEl.textContent = openCount;
    if (resolvedEl) resolvedEl.textContent = resolvedCount;
    
    if (avgEl) {
        if (resolvedWithTimeCount > 0) {
            const avgMs = totalResolveTimeMs / resolvedWithTimeCount;
            const avgHours = avgMs / (1000 * 60 * 60);
            if (avgHours < 24) {
                avgEl.textContent = `${avgHours.toFixed(1)}h`;
            } else {
                avgEl.textContent = `${(avgHours / 24).toFixed(1)}d`;
            }
        } else {
            avgEl.textContent = "N/A";
        }
    }
}

function resetDetailPanel() {
    const detailPanel = document.getElementById("tickets-detail-side");
    if (detailPanel) {
        detailPanel.innerHTML = `
            <div class="detail-placeholder">
                <i class="fa-solid fa-clipboard-list" style="font-size: 3.5rem; color: var(--text-muted);"></i>
                <p style="margin-top: 10px;">Select a complaint ticket from the list to view its details and workflow tracking.</p>
            </div>
        `;
    }
}

window.filterTickets = function() {
    const statusFilter = document.getElementById("ticket-filter-status").value;
    const catFilter = document.getElementById("ticket-filter-category").value;
    const searchVal = document.getElementById("ticket-search").value.toLowerCase().trim();
    
    const filtered = loadedTickets.filter(t => {
        // Scope filter
        if (ticketScope === 'MY' && t.created_by !== currentUserId) {
            return false;
        }
        
        if (t.archived && !hasPermission('tickets:archive')) {
            return false;
        }
        
        const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
        const matchesCat = catFilter === 'ALL' || t.category === catFilter;
        
        const text = `${t.ticket_number || ''} ${t.title} ${t.flat_no || ''} ${t.creator_email} ${t.description}`.toLowerCase();
        const matchesSearch = !searchVal || text.includes(searchVal);
        
        return matchesStatus && matchesCat && matchesSearch;
    });
    
    renderTicketsList(filtered);
};

function renderTicketsList(tickets) {
    const listContainer = document.getElementById("tickets-list");
    if (!listContainer) return;
    
    if (tickets.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--text-muted); font-size: 0.9rem;"><i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 8px;"></i><p>No complaints found</p></div>';
        return;
    }
    
    listContainer.innerHTML = '';
    tickets.forEach(t => {
        const card = document.createElement("div");
        card.className = `ticket-card ${t.id === selectedTicketId ? 'active' : ''}`;
        card.onclick = () => selectTicket(t.id);
        
        // Calculate Age
        const createdDate = new Date(t.created_at);
        const diffMs = new Date() - createdDate;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        let ageText = `${diffDays} days open`;
        if (diffDays === 0) ageText = "Filed today";
        
        // SLA check
        const isOverdue = diffDays >= 3 && !['Closed', 'Resolved'].includes(t.status);
        const overdueBadge = isOverdue ? `<span class="sla-overdue-tag"><i class="fa-solid fa-clock"></i> SLA Overdue</span>` : '';
        
        // Priority Badge Class
        const pBadge = getPriorityBadgeClass(t.priority);
        
        card.innerHTML = `
            <div class="ticket-card-header">
                <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted);">${escapeHtml(t.ticket_number || ('#' + t.id))}</span>
                <span class="badge ${getStatusBadgeClass(t.status)}">${t.status}</span>
            </div>
            <h4 style="margin: 4px 0;">${escapeHtml(t.title)}</h4>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin: 4px 0;">
                <span class="badge ${pBadge}" style="font-size:0.7rem; padding: 2px 6px;">${t.priority || 'Medium'}</span>
                ${overdueBadge}
            </div>
            <div class="ticket-card-meta">
                <span><i class="fa-solid fa-door-open"></i> Flat ${escapeHtml(t.flat_no || 'N/A')}</span>
                <span><i class="fa-solid fa-calendar-day"></i> ${ageText}</span>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 'Pending': return 'badge-pending';
        case 'Recommended': return 'badge-recommended';
        case 'Approved': return 'badge-approved';
        case 'Resolved': return 'badge-resolved';
        case 'Closed': return 'badge-closed';
        case 'Reopened': return 'badge-reopened';
        default: return 'badge-pending';
    }
}

function getPriorityBadgeClass(priority) {
    switch (priority) {
        case 'Low': return 'badge-low';
        case 'Medium': return 'badge-medium';
        case 'High': return 'badge-high';
        case 'Urgent': return 'badge-urgent';
        default: return 'badge-medium';
    }
}

window.selectTicket = function(id) {
    const isStateChange = selectedTicketId !== id;
    selectedTicketId = id;
    
    // Re-render list to show active highlight correctly
    filterTickets();
    
    const ticket = loadedTickets.find(t => t.id === id);
    if (!ticket) return;
    
    const detailPanel = document.getElementById("tickets-detail-side");
    if (!detailPanel) return;
    
    // Build Timeline Steps
    const stepsHtml = buildTimelineHtml(ticket);
    
    // Build Actions block
    const actionsHtml = buildActionsHtml(ticket);
    
    // SLA Tracking detail
    const createdDate = new Date(ticket.created_at);
    const diffMs = new Date() - createdDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    let ageDetailText = `${diffDays} days open`;
    if (diffDays === 0) ageDetailText = "Filed today";
    
    const isOverdue = diffDays >= 3 && !['Closed', 'Resolved'].includes(ticket.status);
    const overdueBanner = isOverdue ? 
        `<div style="background: rgba(244,63,94,0.08); border: 1px solid var(--color-rose); color: var(--color-rose); padding: 10px 14px; border-radius: var(--border-radius-sm); font-size: 0.85rem; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-circle-exclamation" style="font-size: 1.1rem;"></i>
            <strong>SLA Warning:</strong> This complaint has been open for ${diffDays} days without resolution (exceeds 3-day SLA limit).
         </div>` : '';
         
    // Render Attachments
    let attachmentsHtml = '';
    const attachments = Array.isArray(ticket.attachments) ? ticket.attachments : [];
    if (attachments.length > 0) {
        attachmentsHtml += `<div style="margin-top: 14px;">
            <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 8px;">Complaint Attachments</h4>
            <div class="comment-attachments">`;
        attachments.forEach(att => {
            if (att.type.startsWith('image/')) {
                attachmentsHtml += `
                    <div class="attachment-thumb" onclick="window.open('${att.data}', '_blank')">
                        <img src="${att.data}" alt="${escapeHtml(att.name)}">
                    </div>`;
            } else {
                attachmentsHtml += `
                    <a href="${att.data}" target="_blank" class="btn btn-slate" style="font-size:0.75rem; padding: 6px 12px; display: inline-flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-file-pdf"></i> ${escapeHtml(att.name)}
                    </a>`;
            }
        });
        attachmentsHtml += `</div></div>`;
    }
    
    // Render Admin assign controls
    let assignHtml = '';
    if (hasPermission('tickets:assign')) {
        assignHtml = `
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); padding: 12px; margin-bottom: 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <span style="font-size: 0.85rem; font-weight:600;"><i class="fa-solid fa-user-tag"></i> Assign Complaint:</span>
                <select id="assign-ticket-select" onchange="assignTicket(${ticket.id}, this.value)" style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); color: var(--text-primary); padding: 4px 8px; font-size: 0.85rem;">
                    <option value="">-- Select Assignee --</option>
                </select>
            </div>
        `;
        fetchAssigneesForDropdown(ticket.assigned_to);
    }
    
    // Render Admin control actions (Archive/Delete)
    let adminControlsHtml = '';
    const canArchive = hasPermission('tickets:archive');
    const canDeleteTicket = hasPermission('tickets:delete');
    if (canArchive || canDeleteTicket) {
        let archiveBtn = '';
        if (canArchive) {
            archiveBtn = `<button class="btn btn-slate" onclick="archiveTicket(${ticket.id})" style="flex: 1; font-size: 0.8rem; padding: 8px;">
                <i class="fa-solid fa-box-archive"></i> ${ticket.archived ? 'Unarchive' : 'Archive'} Ticket
            </button>`;
        }
        let deleteBtn = '';
        if (canDeleteTicket) {
            deleteBtn = `<button class="btn btn-rose" onclick="deleteTicket(${ticket.id})" style="flex: 1; font-size: 0.8rem; padding: 8px;">
                <i class="fa-solid fa-trash-can"></i> Delete Permanently
            </button>`;
        }
        adminControlsHtml = `
            <div style="display: flex; gap: 12px; margin-top: 16px;">
                ${archiveBtn}
                ${deleteBtn}
            </div>
        `;
    }
    
    const animationClass = isStateChange ? 'animate-status-change' : '';
    
    detailPanel.innerHTML = `
        <div class="ticket-detail-view ${animationClass}" style="animation: fadeIn 0.3s ease;">
            ${overdueBanner}
            
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; gap: 10px;">
                <div>
                    <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 2px;">
                        ${escapeHtml(ticket.ticket_number || ('#' + ticket.id))}
                    </span>
                    <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary); margin: 0;">${escapeHtml(ticket.title)}</h3>
                    <div style="display: flex; gap: 12px; margin-top: 6px; font-size: 0.8rem; color: var(--text-secondary); flex-wrap: wrap;">
                        <span><i class="fa-solid fa-tag"></i> ${ticket.category.toUpperCase()}</span>
                        <span><i class="fa-solid fa-door-open"></i> Flat ${escapeHtml(ticket.flat_no || 'N/A')}</span>
                        <span><i class="fa-solid fa-user"></i> By: ${escapeHtml(ticket.creator_email)}</span>
                        <span><i class="fa-solid fa-user-shield"></i> Assigned: <strong>${escapeHtml(ticket.assigned_email)}</strong></span>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                    <span class="badge ${getStatusBadgeClass(ticket.status)}" style="padding: 4px 10px; font-size: 0.8rem;">${ticket.status}</span>
                    <span class="badge ${getPriorityBadgeClass(ticket.priority)}" style="font-size: 0.75rem; padding: 2px 8px;">${ticket.priority || 'Medium'}</span>
                </div>
            </div>
            
            <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); padding: 14px; margin-bottom: 14px;">
                <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 8px;">Complaint Description</h4>
                <p style="font-size: 0.9rem; line-height: 1.5; color: var(--text-primary); white-space: pre-wrap; margin: 0;">${escapeHtml(ticket.description)}</p>
                ${attachmentsHtml}
            </div>
            
            ${assignHtml}
            
            <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 12px;">Workflow Tracking</h4>
            <div class="workflow-timeline">
                ${stepsHtml}
            </div>
            
            ${actionsHtml}
            
            <!-- Threaded Comments Section -->
            <div class="comments-section">
                <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 12px;">Comments & Resolution History</h4>
                <div class="comments-container" id="comments-container">
                    <div style="text-align: center; padding: 10px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading comments...</div>
                </div>
                
                <form id="comment-submit-form" onsubmit="submitComment(event, ${ticket.id})" class="comment-form">
                    <div class="input-field" style="margin: 0;">
                        <textarea id="comment-new-text" placeholder="Add a comment or update note here..." rows="2" style="width: 100%; padding: 8px; background-color: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: var(--border-radius-sm); outline: none; font-family: inherit; font-size: 0.85rem;" required></textarea>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                        <input type="file" id="comment-attachment" accept="image/*,application/pdf" style="font-size:0.75rem; color:var(--text-secondary); max-width: 200px;">
                        <button type="submit" class="btn btn-yellow" style="font-size: 0.8rem; padding: 6px 12px;">
                            <i class="fa-solid fa-paper-plane"></i> Send
                        </button>
                    </div>
                </form>
            </div>
            
            ${adminControlsHtml}
        </div>
    `;
    
    // Load comments thread
    loadComments(ticket.id);
};

async function fetchAssigneesForDropdown(currentAssigneeId) {
    if (!sbClient) return;
    try {
        const { data: profiles, error } = await sbClient
            .from('profiles')
            .select('id, email, role')
            .order('email');
            
        if (error) throw error;
        
        const select = document.getElementById("assign-ticket-select");
        if (!select) return;
        
        select.innerHTML = '<option value="">-- Unassigned --</option>';
        profiles.forEach(p => {
            const roleLabel = p.role.replace('_', ' ').toUpperCase();
            select.innerHTML += `<option value="${p.id}" ${p.id === currentAssigneeId ? 'selected' : ''}>
                ${escapeHtml(p.email)} (${roleLabel})
            </option>`;
        });
    } catch (err) {
        console.error("fetchAssigneesForDropdown error:", err);
    }
}

window.assignTicket = async function(ticketId, assigneeId) {
    if (!sbClient) return;
    
    try {
        const updateVal = assigneeId === "" ? null : assigneeId;
        const { error } = await sbClient
            .from('tickets')
            .update({ assigned_to: updateVal })
            .eq('id', ticketId);
            
        if (error) throw error;
        
        showToast("Ticket assignee updated successfully!", "success");
        await loadTickets();
    } catch (err) {
        console.error("assignTicket error:", err);
        showToast("Failed to assign ticket.", "error");
    }
};

window.archiveTicket = async function(ticketId) {
    if (!sbClient) return;
    const ticket = loadedTickets.find(t => t.id === ticketId);
    if (!ticket) return;
    
    try {
        const { error } = await sbClient
            .from('tickets')
            .update({ archived: !ticket.archived })
            .eq('id', ticketId);
            
        if (error) throw error;
        
        showToast(ticket.archived ? "Ticket unarchived successfully!" : "Ticket archived successfully!", "success");
        await loadTickets();
    } catch (err) {
        console.error("archiveTicket error:", err);
        showToast("Failed to change ticket archive state.", "error");
    }
};

window.deleteTicket = async function(ticketId) {
    if (!sbClient) return;
    if (!confirm("Are you sure you want to permanently delete this complaint ticket? This cannot be undone.")) return;
    
    try {
        const { error } = await sbClient
            .from('tickets')
            .delete()
            .eq('id', ticketId);
            
        if (error) throw error;
        
        showToast("Ticket deleted permanently.", "success");
        selectedTicketId = null;
        await loadTickets();
    } catch (err) {
        console.error("deleteTicket error:", err);
        showToast("Failed to delete ticket.", "error");
    }
};

window.loadComments = async function(ticketId) {
    const container = document.getElementById("comments-container");
    if (!container) return;
    
    try {
        const { data: comments, error } = await sbClient
            .from('ticket_comments')
            .select('*')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true });
            
        if (error) throw error;
        
        // Fetch profiles to get email
        const { data: profiles } = await sbClient.from('profiles').select('id, email');
        const profileMap = {};
        if (profiles) {
            profiles.forEach(p => { profileMap[p.id] = p.email; });
        }
        
        if (!comments || comments.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 14px; color: var(--text-muted); font-size: 0.8rem;">No comments yet. Add the first comment below!</div>';
            return;
        }
        
        container.innerHTML = '';
        comments.forEach(c => {
            const authorEmail = profileMap[c.user_id] || 'Unknown User';
            const isOwn = c.user_id === currentUserId;
            
            let attHtml = '';
            const attList = Array.isArray(c.attachments) ? c.attachments : [];
            if (attList.length > 0) {
                attHtml += '<div class="comment-attachments">';
                attList.forEach(att => {
                    if (att.type.startsWith('image/')) {
                        attHtml += `
                            <div class="attachment-thumb" onclick="window.open('${att.data}', '_blank')">
                                <img src="${att.data}" alt="${escapeHtml(att.name)}">
                            </div>`;
                    } else {
                        attHtml += `
                            <a href="${att.data}" target="_blank" class="btn btn-slate" style="font-size:0.7rem; padding: 4px 8px; display:inline-flex; align-items:center; gap: 4px;">
                                <i class="fa-solid fa-file-pdf"></i> ${escapeHtml(att.name)}
                            </a>`;
                    }
                });
                attHtml += '</div>';
            }
            
            container.innerHTML += `
                <div class="comment-bubble ${isOwn ? 'own-comment' : ''}">
                    <div class="comment-meta">
                        <span class="comment-author">${escapeHtml(authorEmail)}</span>
                        <span>${formatTicketDate(c.created_at)}</span>
                    </div>
                    <div class="comment-text">${escapeHtml(c.comment)}</div>
                    ${attHtml}
                </div>
            `;
        });
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
        
    } catch (err) {
        console.error("loadComments error:", err);
        container.innerHTML = '<div style="text-align: center; padding: 10px; color: var(--color-rose);">Failed to load comments history.</div>';
    }
};

window.submitComment = async function(e, ticketId) {
    e.preventDefault();
    if (!sbClient || !currentUserId) return;
    if (!hasPermission('tickets:comment')) {
        showToast("You don't have permission to comment on tickets.", "error");
        return;
    }
    
    const textarea = document.getElementById("comment-new-text");
    const text = textarea.value.trim();
    const fileInput = document.getElementById("comment-attachment");
    
    const btn = document.querySelector("#comment-submit-form button[type='submit']");
    btn.disabled = true;
    
    try {
        let attachments = [];
        if (fileInput && fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            const base64 = await getFileBase64(file);
            attachments.push({
                name: file.name,
                type: file.type,
                data: base64
            });
        }
        
        const { error } = await sbClient
            .from('ticket_comments')
            .insert({
                ticket_id: ticketId,
                user_id: currentUserId,
                comment: text,
                attachments: attachments
            });
            
        if (error) throw error;
        
        textarea.value = '';
        if (fileInput) fileInput.value = '';
        
        showToast("Comment added!", "success");
        await loadComments(ticketId);
    } catch (err) {
        console.error("submitComment error:", err);
        showToast("Failed to post comment.", "error");
    } finally {
        btn.disabled = false;
    }
};

function getFileBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function buildTimelineHtml(ticket) {
    const status = ticket.status;
    const isPending = status === 'Pending';
    const isRecommended = status === 'Recommended';
    const isApproved = status === 'Approved';
    const isResolved = status === 'Resolved';
    const isClosed = status === 'Closed';
    const isReopened = status === 'Reopened';
    
    // Step 1: Filed
    let step1Class = 'completed';
    let step1Desc = `Filed by ${escapeHtml(ticket.creator_email)} on ${formatTicketDate(ticket.created_at)}`;
    if (isReopened) {
        step1Class = 'active pulse-status';
        step1Desc = `Complaint reopened by complainer on ${formatTicketDate(ticket.created_at)}.<br><strong>Reason:</strong> ${escapeHtml(ticket.complainer_feedback || '')}`;
    } else if (isPending) {
        step1Class = 'active pulse-status';
    }
    
    // Step 2: Floor Manager Recommendation
    let step2Class = '';
    let step2Desc = 'Awaiting Floor Manager review & recommendation.';
    if (ticket.recommended_at) {
        step2Class = 'completed';
        step2Desc = `Recommended by Floor Manager (${escapeHtml(ticket.floor_manager_email)}) on ${formatTicketDate(ticket.recommended_at)}.<br><strong>Note:</strong> ${escapeHtml(ticket.floor_manager_recommendation)}`;
    } else if (isPending || isReopened) {
        step2Class = 'active pulse-status';
    }
    
    // Step 3: Committee Approval
    let step3Class = '';
    const approvalCount = Array.isArray(ticket.committee_approvals) ? ticket.committee_approvals.length : 0;
    let step3Desc = `Awaiting Committee approvals (${approvalCount} of 3 approved).`;
    if (ticket.approved_at) {
        step3Class = 'completed';
        step3Desc = `Approved by 3 Committee Members on ${formatTicketDate(ticket.approved_at)}.<br><strong>Approvers:</strong> ${escapeHtml(ticket.approver_emails.join(', '))}`;
    } else if (isRecommended) {
        step3Class = 'active pulse-status';
        if (approvalCount > 0) {
            step3Desc += `<br><strong>Approved so far:</strong> ${escapeHtml(ticket.approver_emails.join(', '))}`;
        }
    }
    
    // Step 4: Action & Resolution
    let step4Class = '';
    let step4Desc = 'Awaiting resolution actions by maintenance team/editor.';
    if (ticket.resolved_at) {
        step4Class = 'completed';
        step4Desc = `Resolved by ${escapeHtml(ticket.resolver_email)} on ${formatTicketDate(ticket.resolved_at)}.<br><strong>Action Details:</strong> ${escapeHtml(ticket.resolution_details)}`;
    } else if (isApproved) {
        step4Class = 'active pulse-status';
    }
    
    // Step 5: Closure & Feedback
    let step5Class = '';
    let step5Desc = 'Awaiting resident closure acknowledgement.';
    if (ticket.closed_at) {
        step5Class = 'completed';
        step5Desc = `Closed on ${formatTicketDate(ticket.closed_at)}.<br><strong>Resident Feedback:</strong> ${escapeHtml(ticket.complainer_feedback || 'No feedback provided.')}`;
    } else if (isResolved) {
        step5Class = 'active pulse-status';
    }
    
    return `
        <div class="workflow-step ${step1Class}">
            <div class="workflow-step-title"><i class="fa-solid fa-file-invoice"></i> Step 1: Filed</div>
            <div class="workflow-step-desc">${step1Desc}</div>
        </div>
        <div class="workflow-step ${step2Class}">
            <div class="workflow-step-title"><i class="fa-solid fa-user-tie"></i> Step 2: Manager Recommendation</div>
            <div class="workflow-step-desc">${step2Desc}</div>
        </div>
        <div class="workflow-step ${step3Class}">
            <div class="workflow-step-title"><i class="fa-solid fa-users"></i> Step 3: Committee Approvals</div>
            <div class="workflow-step-desc">${step3Desc}</div>
        </div>
        <div class="workflow-step ${step4Class}">
            <div class="workflow-step-title"><i class="fa-solid fa-wrench"></i> Step 4: Resolution Action</div>
            <div class="workflow-step-desc">${step4Desc}</div>
        </div>
        <div class="workflow-step ${step5Class}">
            <div class="workflow-step-title"><i class="fa-solid fa-circle-check"></i> Step 5: Closure & Feedback</div>
            <div class="workflow-step-desc">${step5Desc}</div>
        </div>
    `;
}

function buildActionsHtml(ticket) {
    const status = ticket.status;
    const isPending = status === 'Pending';
    const isRecommended = status === 'Recommended';
    const isApproved = status === 'Approved';
    const isResolved = status === 'Resolved';
    const isReopened = status === 'Reopened';
    
    const isCreator = ticket.created_by === currentUserId;
    const canRecommend = hasPermission('tickets:recommend');
    const canApprove = hasPermission('tickets:approve');
    const canResolve = hasPermission('tickets:resolve');
    const canClose = hasPermission('tickets:close');
    const canReopen = hasPermission('tickets:reopen');
    
    let html = '';
    
    // 1. Floor Manager Action
    if (canRecommend && (isPending || isReopened)) {
        html += `
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed var(--border-color);">
                <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--color-yellow); margin-bottom: 10px;"><i class="fa-solid fa-user-edit"></i> Floor Manager Action</h4>
                <form id="fm-recommend-form" onsubmit="submitRecommendation(event, ${ticket.id})">
                    <div class="input-field" style="margin-bottom: 10px;">
                        <label for="fm-recommend-text">Recommendation Notes</label>
                        <textarea id="fm-recommend-text" placeholder="Explain your assessment and recommend specific actions..." rows="3" style="width: 100%; padding: 8px; background-color: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: var(--border-radius-sm); outline: none; font-family: inherit; font-size: 0.85rem;" required></textarea>
                    </div>
                    <button type="submit" class="btn btn-yellow btn-full">
                        <i class="fa-solid fa-check"></i> Submit Recommendation
                    </button>
                </form>
            </div>
        `;
    }
    
    // 2. Committee Approval Action
    if (canApprove && isRecommended) {
        const approvals = Array.isArray(ticket.committee_approvals) ? ticket.committee_approvals : [];
        const alreadyApproved = approvals.includes(currentUserId);
        
        html += `
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed var(--border-color);">
                <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--color-violet); margin-bottom: 10px;"><i class="fa-solid fa-signature"></i> Committee Approval Action</h4>
        `;
        
        if (alreadyApproved) {
            html += `
                <div style="padding: 10px; background: rgba(139,92,246,0.05); border: 1px solid rgba(139,92,246,0.2); border-radius: var(--border-radius-sm); color: var(--color-violet); font-size: 0.85rem; text-align: center;">
                    <i class="fa-solid fa-circle-check"></i> You have already approved this complaint. Awaiting other members (${approvals.length} of 3 approved).
                </div>
            `;
        } else {
            html += `
                <button type="button" class="btn btn-violet btn-full" onclick="approveComplaint(${ticket.id})">
                    <i class="fa-solid fa-thumbs-up"></i> Approve Complaint (${approvals.length} of 3 approvals)
                </button>
            `;
        }
        
        html += `</div>`;
    }
    
    // 3. Action & Resolution Form
    if (canResolve && isApproved) {
        html += `
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed var(--border-color);">
                <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--color-teal); margin-bottom: 10px;"><i class="fa-solid fa-wrench"></i> Record Action & Resolution</h4>
                <form id="editor-resolve-form" onsubmit="submitResolution(event, ${ticket.id})">
                    <div class="input-field" style="margin-bottom: 10px;">
                        <label for="editor-resolve-text">Resolution Details</label>
                        <textarea id="editor-resolve-text" placeholder="Detail the resolution actions taken (e.g. replaced parts, repaired leakage)..." rows="3" style="width: 100%; padding: 8px; background-color: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: var(--border-radius-sm); outline: none; font-family: inherit; font-size: 0.85rem;" required></textarea>
                    </div>
                    <button type="submit" class="btn btn-teal btn-full">
                        <i class="fa-solid fa-check-double"></i> Mark Resolved
                    </button>
                </form>
            </div>
        `;
    }
    
    // 4. Complainer Feedback Form (Creator or permission holders)
    if ((isCreator || canClose || canReopen) && isResolved) {
        html += `
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed var(--border-color);">
                <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--color-emerald); margin-bottom: 10px;"><i class="fa-solid fa-comment-dots"></i> Resident Acknowledgement</h4>
                <div class="input-field" style="margin-bottom: 10px;">
                    <label for="complainer-feedback-text">Feedback / Comments (Required for Reopening)</label>
                    <textarea id="complainer-feedback-text" placeholder="Optional comments on resolution. REQUIRED if reopening the ticket for further review..." rows="3" style="width: 100%; padding: 8px; background-color: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: var(--border-radius-sm); outline: none; font-family: inherit; font-size: 0.85rem;"></textarea>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <button type="button" class="btn btn-rose btn-full" onclick="reopenTicket(${ticket.id})">
                        <i class="fa-solid fa-redo"></i> Reopen / Request Review
                    </button>
                    <button type="button" class="btn btn-emerald btn-full" onclick="closeTicket(${ticket.id})">
                        <i class="fa-solid fa-lock"></i> Accept & Close
                    </button>
                </div>
            </div>
        `;
    }
    
    return html;
}

window.handleCreateTicket = async function(e) {
    e.preventDefault();
    if (!sbClient || !currentUserId) {
        showToast("You must be logged in to file a complaint.", "error");
        return;
    }
    
    const title = document.getElementById("ticket-title").value.trim();
    const category = document.getElementById("ticket-category").value;
    const flatNo = document.getElementById("ticket-flat").value;
    const priority = document.getElementById("ticket-priority").value;
    const desc = document.getElementById("ticket-desc").value.trim();
    const fileInput = document.getElementById("ticket-attachments");
    
    const btn = document.querySelector("#new-ticket-form button[type='submit']");
    btn.disabled = true;
    btn.textContent = "Submitting...";
    
    try {
        let attachments = [];
        if (fileInput && fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            const base64 = await getFileBase64(file);
            attachments.push({
                name: file.name,
                type: file.type,
                data: base64
            });
        }
        
        // Count existing tickets to generate ticket_number
        const { count, error: countErr } = await sbClient
            .from('tickets')
            .select('*', { count: 'exact', head: true });
            
        if (countErr) throw countErr;
        
        const countVal = count || 0;
        const currentYear = new Date().getFullYear();
        const ticketNum = `TKT-${currentYear}-${String(countVal + 1).padStart(3, '0')}`;
        
        const { error } = await sbClient
            .from('tickets')
            .insert({
                title: title,
                category: category,
                flat_no: flatNo,
                priority: priority,
                description: desc,
                created_by: currentUserId,
                attachments: attachments,
                ticket_number: ticketNum,
                status: 'Pending'
            });
            
        if (error) throw error;
        
        showToast(`Complaint filed! Assigned Ticket Number: ${ticketNum}`, "success");
        closeModal('newTicketModal');
        await loadTickets();
        
    } catch (err) {
        console.error("handleCreateTicket error:", err);
        showToast(err.message || "Failed to submit complaint.", "error");
    } finally {
        btn.disabled = false;
        btn.textContent = "Submit Ticket";
    }
};

window.submitRecommendation = async function(e, ticketId) {
    e.preventDefault();
    if (!sbClient) return;
    
    const notes = document.getElementById("fm-recommend-text").value.trim();
    const btn = document.querySelector("#fm-recommend-form button[type='submit']");
    btn.disabled = true;
    btn.textContent = "Submitting...";
    
    try {
        const { error } = await sbClient
            .from('tickets')
            .update({
                floor_manager_id: currentUserId,
                floor_manager_recommendation: notes,
                recommended_at: new Date().toISOString(),
                status: 'Recommended'
            })
            .eq('id', ticketId);
            
        if (error) throw error;
        
        showToast("Recommendation submitted successfully!", "success");
        await loadTickets();
        
    } catch (err) {
        console.error("submitRecommendation error:", err);
        showToast("Failed to submit recommendation.", "error");
    }
};

window.approveComplaint = async function(ticketId) {
    if (!sbClient || !currentUserId) return;
    
    const ticket = loadedTickets.find(t => t.id === ticketId);
    if (!ticket) return;
    
    const approvals = Array.isArray(ticket.committee_approvals) ? [...ticket.committee_approvals] : [];
    if (approvals.includes(currentUserId)) {
        showToast("You have already approved this ticket.", "warning");
        return;
    }
    
    approvals.push(currentUserId);
    
    // Check if 3 approvals reached
    const approvalsReached = approvals.length >= 3;
    const updateData = {
        committee_approvals: approvals
    };
    
    if (approvalsReached) {
        updateData.status = 'Approved';
        updateData.approved_at = new Date().toISOString();
    }
    
    try {
        const { error } = await sbClient
            .from('tickets')
            .update(updateData)
            .eq('id', ticketId);
            
        if (error) throw error;
        
        if (approvalsReached) {
            showToast("Approved! Ticket transitioned to Approved status.", "success");
        } else {
            showToast(`Approval recorded (${approvals.length}/3 approvals).`, "success");
        }
        
        await loadTickets();
        
    } catch (err) {
        console.error("approveComplaint error:", err);
        showToast("Failed to record approval.", "error");
    }
};

window.submitResolution = async function(e, ticketId) {
    e.preventDefault();
    if (!sbClient) return;
    
    const details = document.getElementById("editor-resolve-text").value.trim();
    const btn = document.querySelector("#editor-resolve-form button[type='submit']");
    btn.disabled = true;
    btn.textContent = "Saving...";
    
    try {
        const { error } = await sbClient
            .from('tickets')
            .update({
                resolved_by: currentUserId,
                resolution_details: details,
                resolved_at: new Date().toISOString(),
                status: 'Resolved'
            })
            .eq('id', ticketId);
            
        if (error) throw error;
        
        showToast("Resolution details logged successfully!", "success");
        await loadTickets();
        
    } catch (err) {
        console.error("submitResolution error:", err);
        showToast("Failed to save resolution details.", "error");
    }
};

window.reopenTicket = async function(ticketId) {
    if (!sbClient) return;
    
    const feedback = document.getElementById("complainer-feedback-text").value.trim();
    if (!feedback) {
        showToast("Please provide comments explaining why you are reopening this complaint.", "warning");
        return;
    }
    
    try {
        const { error } = await sbClient
            .from('tickets')
            .update({
                status: 'Reopened',
                complainer_feedback: feedback,
                floor_manager_id: null,
                floor_manager_recommendation: null,
                recommended_at: null,
                committee_approvals: [],
                approved_at: null,
                resolved_by: null,
                resolution_details: null,
                resolved_at: null,
                closed_at: null
            })
            .eq('id', ticketId);
            
        if (error) throw error;
        
        showToast("Complaint reopened for further review.", "info");
        await loadTickets();
        
    } catch (err) {
        console.error("reopenTicket error:", err);
        showToast("Failed to reopen ticket.", "error");
    }
};

window.closeTicket = async function(ticketId) {
    if (!sbClient) return;
    
    const feedback = document.getElementById("complainer-feedback-text").value.trim();
    
    try {
        const { error } = await sbClient
            .from('tickets')
            .update({
                status: 'Closed',
                complainer_feedback: feedback || 'Closed by resident.',
                closed_at: new Date().toISOString()
            })
            .eq('id', ticketId);
            
        if (error) throw error;
        
        showToast("Complaint successfully acknowledged and closed.", "success");
        await loadTickets();
        
    } catch (err) {
        console.error("closeTicket error:", err);
        showToast("Failed to close ticket.", "error");
    }
};

// --- Helpdesk Analytics Reporting Tab ---
async function renderHelpdeskReport() {
    const sheet = document.getElementById("report-sheet");
    if (!sheet || !sbClient) return;
    
    try {
        const { data: tickets, error } = await sbClient.from('tickets').select('*');
        if (error) throw error;
        
        const safeTickets = tickets || [];
        
        // 1. Compute stats
        const total = safeTickets.length;
        const byCategory = {};
        const byStatus = {};
        const byPriority = {};
        let resolvedCount = 0;
        let totalMs = 0;
        
        safeTickets.forEach(t => {
            byCategory[t.category] = (byCategory[t.category] || 0) + 1;
            byStatus[t.status] = (byStatus[t.status] || 0) + 1;
            byPriority[t.priority || 'Medium'] = (byPriority[t.priority || 'Medium'] || 0) + 1;
            
            if (t.resolved_at && t.created_at) {
                const diff = new Date(t.resolved_at) - new Date(t.created_at);
                if (diff > 0) {
                    resolvedCount++;
                    totalMs += diff;
                }
            }
        });
        
        const avgHours = resolvedCount > 0 ? (totalMs / resolvedCount / (1000 * 60 * 60)) : 0;
        const avgTimeText = avgHours > 0 ? (avgHours < 24 ? `${avgHours.toFixed(1)} hrs` : `${(avgHours/24).toFixed(1)} days`) : 'N/A';
        
        // 2. Generate report DOM
        let html = `
            <div style="font-family: inherit; color: #1e293b;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 24px;">
                    <div>
                        <h2 style="font-size: 1.5rem; font-weight: 800; color: #d97706;"><i class="fa-solid fa-chart-line"></i> Support Helpdesk & Complaints Analytics</h2>
                        <p style="color: #64748b; font-size: 0.85rem; margin-top: 4px;">Summary of resident complaints, workflow execution, and performance metrics.</p>
                    </div>
                    <button class="btn btn-slate" onclick="printActiveReport()"><i class="fa-solid fa-print"></i> Print Summary</button>
                </div>
                
                <!-- Summary Metrics cards -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 30px;">
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center;">
                        <span style="font-size: 2rem; font-weight: 800; color: #1e293b;">${total}</span>
                        <span style="display: block; font-size: 0.75rem; color: #64748b; text-transform: uppercase; margin-top: 4px;">Total Filed</span>
                    </div>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center;">
                        <span style="font-size: 2rem; font-weight: 800; color: #d97706;">${byStatus['Pending'] || 0}</span>
                        <span style="display: block; font-size: 0.75rem; color: #64748b; text-transform: uppercase; margin-top: 4px;">Pending Review</span>
                    </div>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center;">
                        <span style="font-size: 2rem; font-weight: 800; color: #059669;">${(byStatus['Closed'] || 0) + (byStatus['Resolved'] || 0)}</span>
                        <span style="display: block; font-size: 0.75rem; color: #64748b; text-transform: uppercase; margin-top: 4px;">Resolved/Closed</span>
                    </div>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center;">
                        <span style="font-size: 1.8rem; font-weight: 800; color: #6366f1;">${avgTimeText}</span>
                        <span style="display: block; font-size: 0.75rem; color: #64748b; text-transform: uppercase; margin-top: 4px;">Avg Resolution Speed</span>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                    <!-- Category Chart -->
                    <div>
                        <h3 style="font-size: 1.05rem; color: #1e293b; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">Complaints by Category</h3>
                        <div style="display: flex; flex-direction: column; gap: 12px;">`;
        
        const categories = ['plumbing', 'electrical', 'lift', 'security', 'cleanliness', 'billing', 'other'];
        categories.forEach(cat => {
            const count = byCategory[cat] || 0;
            const pct = total > 0 ? (count / total * 100) : 0;
            html += `
                <div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #334155; margin-bottom: 4px;">
                        <span style="text-transform: capitalize;">${cat}</span>
                        <span style="font-weight: 600;">${count} (${pct.toFixed(0)}%)</span>
                    </div>
                    <div style="height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                        <div style="width: ${pct}%; height: 100%; background: #d97706; border-radius: 4px;"></div>
                    </div>
                </div>`;
        });
        
        html += `       </div>
                    </div>
                    
                    <!-- Priority Breakdown -->
                    <div>
                        <h3 style="font-size: 1.05rem; color: #1e293b; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">Complaints by Priority</h3>
                        <div style="display: flex; flex-direction: column; gap: 12px;">`;
        
        const priorities = ['Low', 'Medium', 'High', 'Urgent'];
        const pColors = {
            'Low': '#9ca3af',
            'Medium': '#d97706',
            'High': '#f97316',
            'Urgent': '#e11d48'
        };
        priorities.forEach(prio => {
            const count = byPriority[prio] || 0;
            const pct = total > 0 ? (count / total * 100) : 0;
            html += `
                <div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #334155; margin-bottom: 4px;">
                        <span>${prio} Priority</span>
                        <span style="font-weight: 600;">${count}</span>
                    </div>
                    <div style="height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                        <div style="width: ${pct}%; height: 100%; background: ${pColors[prio]}; border-radius: 4px;"></div>
                    </div>
                </div>`;
        });
        
        html += `       </div>
                    </div>
                </div>
            </div>
        `;
        
        sheet.innerHTML = html;
        
    } catch (err) {
        console.error("renderHelpdeskReport error:", err);
        sheet.innerHTML = '<div style="color:#e11d48; padding:20px; text-align:center;">Failed to generate helpdesk report summary.</div>';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatTicketDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

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
    }
];

// Flatten for quick lookups
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
        
        // Module label cell
        const labelCell = document.createElement("div");
        labelCell.style.cssText = 'width:130px; flex-shrink:0; padding:10px 4px; font-size:0.82rem; font-weight:600; color:var(--text-primary); display:flex; align-items:center;';
        labelCell.textContent = group.label;
        row.appendChild(labelCell);
        
        // Column cells
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
