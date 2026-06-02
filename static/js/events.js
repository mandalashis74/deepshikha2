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
            <button class="event-tab" data-tab="coupons" onclick="switchDetailTab('coupons')"><i class="fa-solid fa-ticket"></i> Food Coupons</button>
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
        case 'coupons':
            content.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Loading...</div>';
            loadTabData('coupons');
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
        } else if (tabName === 'coupons') {
            const { data: coupons } = await sbClient.from('event_food_coupons').select('*').eq('event_id', currentEvent.id);
            const { data: registrations } = await sbClient.from('food_coupon_registrations').select('*');
            const myFlat = localStorage.getItem('currentFlatNo') || '';
            content.innerHTML = renderCouponsTab(coupons || [], registrations || [], myFlat, hasPermission('events:create'));
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

// ===== FOOD COUPONS =====

function renderCouponsTab(coupons, registrations, myFlat, isAdmin) {
    const totalRegs = registrations.reduce((acc, r) => { acc[r.coupon_id] = (acc[r.coupon_id] || 0) + r.count; return acc; }, {});
    const myRegs = registrations.filter(r => r.flat_no === myFlat);
    const myRegMap = {};
    myRegs.forEach(r => { myRegMap[r.coupon_id] = r; });

    let html = '';

    if (isAdmin) {
        html += `<div style="margin-bottom:12px;">
            <button class="btn btn-indigo" style="font-size:0.8rem;padding:4px 12px;" onclick="openCouponModal()"><i class="fa-solid fa-plus"></i> Add Coupon Type</button>
            <button class="btn btn-slate" style="font-size:0.8rem;padding:4px 12px;margin-left:6px;" onclick="toggleCouponRegView()"><i class="fa-solid fa-list"></i> <span id="coupon-reg-toggle">View Registrations</span></button>
        </div>`;
    }

    const showRegs = sessionStorage.getItem('couponShowRegs') === 'true';
    if (showRegs && isAdmin) {
        return renderCouponRegistrations(registrations, coupons);
    }

    if (!coupons || coupons.length === 0) {
        html += '<div style="text-align:center;padding:20px;color:var(--text-muted);"><i class="fa-solid fa-ticket" style="font-size:1.5rem;display:block;margin-bottom:8px;"></i>No food coupons configured for this event.</div>';
        return html;
    }

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;">';
    for (const c of coupons) {
        const booked = totalRegs[c.id] || 0;
        const remaining = c.quantity > 0 ? c.quantity - booked : -1;
        const isFull = remaining === 0;
        const myReg = myRegMap[c.id];
        html += `<div class="food-coupon-card">
            <div class="food-coupon-header">
                <span class="food-coupon-type">${escapeHtml(c.label || c.coupon_type.replace('_',' '))}</span>
                <span class="food-coupon-price">${c.price > 0 ? '₹'+formatCurrency(c.price) : '<span style="color:var(--color-emerald);">Free</span>'}</span>
            </div>
            <div style="margin-top:8px;font-size:0.8rem;color:var(--text-secondary);">
                ${c.quantity > 0 ? `<span>${remaining} / ${c.quantity} remaining</span>` : '<span>Unlimited</span>'}
                <span style="margin-left:8px;">${booked} booked</span>
            </div>
            ${c.quantity > 0 ? `<div style="margin-top:6px;height:6px;background:var(--border-color);border-radius:3px;overflow:hidden;">
                <div style="height:100%;width:${Math.min(100,(booked/c.quantity)*100)}%;background:var(--color-violet);border-radius:3px;"></div>
            </div>` : ''}
            <div style="margin-top:10px;display:flex;gap:6px;">
                ${myReg
                    ? `<span style="font-size:0.8rem;color:var(--color-emerald);"><i class="fa-solid fa-check-circle"></i> Registered (${myReg.count})</span>`
                    : !isFull && myFlat
                        ? `<button class="btn btn-sm" onclick="openCouponRegistration(${c.id},'${escapeHtml(c.label || c.coupon_type)}',${c.price})"><i class="fa-solid fa-hand"></i> Register</button>`
                        : isFull ? '<span style="font-size:0.75rem;color:var(--color-rose);">Full</span>' : ''
                }
                ${isAdmin ? `
                    <button class="btn btn-sm" onclick="openCouponModal(${c.id})" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-sm" style="color:var(--color-rose);" onclick="deleteCoupon(${c.id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
                ` : ''}
            </div>
        </div>`;
    }
    html += '</div>';
    return html;
}

function renderCouponRegistrations(registrations, coupons) {
    if (!registrations || registrations.length === 0) {
        return '<div style="text-align:center;padding:20px;color:var(--text-muted);"><i class="fa-solid fa-users" style="font-size:1.5rem;display:block;margin-bottom:8px;"></i>No registrations yet.</div>';
    }
    const couponMap = {};
    coupons.forEach(c => { couponMap[c.id] = c; });
    let html = `<div style="margin-bottom:8px;font-size:0.85rem;color:var(--text-secondary);">${registrations.length} registration(s)</div>
    <table class="data-table"><thead><tr><th>Flat</th><th>Name</th><th>Coupon</th><th>Count</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>`;
    for (const r of registrations) {
        const cp = couponMap[r.coupon_id];
        html += `<tr>
            <td>${escapeHtml(r.flat_no)}</td>
            <td>${escapeHtml(r.resident_name)}</td>
            <td>${cp ? escapeHtml(cp.label || cp.coupon_type) : '—'}</td>
            <td>${r.count}</td>
            <td>₹${formatCurrency(r.amount)}</td>
            <td>${r.status}</td>
            <td style="font-size:0.75rem;">${new Date(r.created_at).toLocaleDateString('en-IN')}</td>
        </tr>`;
    }
    html += '</tbody></table>';
    return html;
}

window.toggleCouponRegView = function() {
    const show = sessionStorage.getItem('couponShowRegs') === 'true';
    sessionStorage.setItem('couponShowRegs', !show);
    const toggle = document.getElementById('coupon-reg-toggle');
    if (toggle) toggle.textContent = show ? 'View Registrations' : 'View Coupons';
    loadTabData('coupons');
};

window.openCouponModal = async function(couponId) {
    if (!hasPermission('events:create')) { showToast('Access Denied.', 'error'); return; }
    document.getElementById('edit-coupon-id').value = couponId || '';
    document.getElementById('coupon-event-id').value = currentEvent ? currentEvent.id : '';
    document.getElementById('create-coupon-title').textContent = couponId ? 'Edit Coupon Type' : 'Add Coupon Type';
    if (couponId) {
        const { data } = await sbClient.from('event_food_coupons').select('*').eq('id', couponId).single();
        if (data) {
            document.getElementById('coupon-type').value = data.coupon_type;
            document.getElementById('coupon-label').value = data.label || '';
            document.getElementById('coupon-price').value = data.price;
            document.getElementById('coupon-qty').value = data.quantity;
        }
    } else {
        document.getElementById('create-coupon-form').reset();
        document.getElementById('edit-coupon-id').value = '';
        document.getElementById('coupon-price').value = '0';
        document.getElementById('coupon-qty').value = '0';
    }
    openModal('couponModal');
};

window.saveCoupon = async function(e) {
    e.preventDefault();
    if (!hasPermission('events:create')) { showToast('Access Denied.', 'error'); return; }
    const editId = document.getElementById('edit-coupon-id').value;
    const eventId = parseInt(document.getElementById('coupon-event-id').value);
    const couponType = document.getElementById('coupon-type').value;
    const label = document.getElementById('coupon-label').value.trim();
    const price = parseFloat(document.getElementById('coupon-price').value) || 0;
    const quantity = parseInt(document.getElementById('coupon-qty').value) || 0;

    const payload = { event_id: eventId, coupon_type: couponType, label, price, quantity };
    if (editId) {
        const { error } = await sbClient.from('event_food_coupons').update(payload).eq('id', editId);
        if (error) { showToast('Error: ' + error.message, 'error'); return; }
        showToast('Coupon type updated!', 'success');
    } else {
        payload.created_by = window.currentUserId;
        const { error } = await sbClient.from('event_food_coupons').insert(payload);
        if (error) { showToast('Error: ' + error.message, 'error'); return; }
        showToast('Coupon type added!', 'success');
    }
    closeModal('couponModal');
    loadTabData('coupons');
};

window.deleteCoupon = async function(couponId) {
    if (!hasPermission('events:create')) { showToast('Access Denied.', 'error'); return; }
    if (!confirm('Delete this coupon type?')) return;
    const { error } = await sbClient.from('event_food_coupons').delete().eq('id', couponId);
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    showToast('Coupon deleted.', 'success');
    loadTabData('coupons');
};

window.openCouponRegistration = function(couponId, couponLabel, price) {
    document.getElementById('reg-coupon-id').value = couponId;
    document.getElementById('reg-coupon-label').textContent = couponLabel;
    document.getElementById('reg-price').textContent = price > 0 ? '₹' + formatCurrency(price) + ' each' : 'Free';
    document.getElementById('reg-flat').value = localStorage.getItem('currentFlatNo') || '';
    document.getElementById('reg-name').value = localStorage.getItem('currentFlatOwnerName') || '';
    document.getElementById('reg-count').value = 1;
    document.getElementById('reg-phone').value = '';
    document.getElementById('reg-submit-btn').textContent = price > 0 ? 'Register (Pay at Event)' : 'Register Free';
    openModal('couponRegModal');
};

window.saveCouponRegistration = async function(e) {
    e.preventDefault();
    const couponId = parseInt(document.getElementById('reg-coupon-id').value);
    const flatNo = document.getElementById('reg-flat').value.trim();
    const name = document.getElementById('reg-name').value.trim();
    const count = parseInt(document.getElementById('reg-count').value) || 1;
    const phone = document.getElementById('reg-phone').value.trim();

    if (!flatNo || !name) { showToast('Flat and name required.', 'error'); return; }

    const { data: coupon } = await sbClient.from('event_food_coupons').select('*').eq('id', couponId).single();
    if (!coupon) { showToast('Coupon not found.', 'error'); return; }

    const amount = coupon.price * count;

    const { data: existing } = await sbClient.from('food_coupon_registrations').select('*').eq('coupon_id', couponId).eq('flat_no', flatNo);
    if (existing && existing.length > 0) {
        showToast('You already registered for this coupon type.', 'error'); return;
    }

    const { error } = await sbClient.from('food_coupon_registrations').insert({
        coupon_id: couponId, flat_no: flatNo,
        resident_name: name, count, amount, phone
    });
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    showToast(`Registered for ${count} × ${coupon.label || coupon.coupon_type}!`, 'success');
    closeModal('couponRegModal');
    loadTabData('coupons');
};
