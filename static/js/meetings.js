// ==========================================
// MEETINGS & RESOLUTIONS (AGM TRACKER)
// ==========================================

window.openMeetingsModal = async function() {
    if (!hasPermission('meetings:view')) { showToast("Access Denied.", "error"); return; }
    openModal('meetingsModal');
    const canCreate = hasPermission('meetings:create');
    const btn = document.getElementById('btn-create-meeting');
    if (btn) btn.style.display = canCreate ? '' : 'none';
    await loadMeetingsList();
};

window.openCreateMeetingModal = function(meetingData = null) {
    if (!hasPermission('meetings:create')) { showToast("Access Denied.", "error"); return; }
    document.getElementById('create-meeting-title').textContent = meetingData ? 'Edit Meeting' : 'New Meeting';
    document.getElementById('edit-meeting-id').value = meetingData ? meetingData.id : '';
    document.getElementById('meeting-title').value = meetingData ? meetingData.title : '';
    document.getElementById('meeting-type').value = meetingData ? meetingData.type : 'AGM';
    document.getElementById('meeting-date').value = meetingData ? meetingData.meeting_date : '';
    document.getElementById('meeting-description').value = meetingData ? meetingData.description : '';
    document.getElementById('meeting-quorum').value = meetingData ? (meetingData.quorum_required || '') : '';
    document.getElementById('btn-submit-meeting').innerHTML = '<i class="fa-solid fa-save"></i> Save';
    openModal('createMeetingModal');
};

window.saveMeeting = async function(e) {
    e.preventDefault();
    if (!sbClient) return;
    const id = document.getElementById('edit-meeting-id').value;
    const data = {
        title: document.getElementById('meeting-title').value.trim(),
        type: document.getElementById('meeting-type').value,
        meeting_date: document.getElementById('meeting-date').value,
        description: document.getElementById('meeting-description').value.trim(),
        quorum_required: parseInt(document.getElementById('meeting-quorum').value) || 0
    };
    try {
        if (id) {
            const { error } = await sbClient.from('meetings').update(data).eq('id', id);
            if (error) throw error;
            showToast('Meeting updated.', 'success');
        } else {
            data.created_by = currentUserId;
            const { error } = await sbClient.from('meetings').insert(data);
            if (error) throw error;
            showToast('Meeting created!', 'success');
        }
        closeModal('createMeetingModal');
        await loadMeetingsList();
    } catch (err) {
        showToast(err.message || 'Failed to save meeting.', 'error');
    }
};

async function loadMeetingsList() {
    const container = document.getElementById('meetings-list-container');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
    try {
        const { data, error } = await sbClient.from('meetings').select('*').order('meeting_date', { ascending: false });
        if (error) throw error;
        const meetings = data || [];
        if (meetings.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">No meetings scheduled yet.</div>';
            return;
        }
        container.innerHTML = meetings.map(m => renderMeetingCard(m)).join('');
    } catch (err) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--color-rose);">Failed to load meetings.</div>';
    }
}

function renderMeetingCard(m) {
    const canManage = hasPermission('meetings:manage');
    const canCreate = hasPermission('meetings:create');
    const statusColors = { scheduled: 'var(--color-yellow)', ongoing: 'var(--color-indigo)', completed: 'var(--color-emerald)', cancelled: 'var(--color-rose)' };
    const statusColor = statusColors[m.status] || 'var(--text-muted)';
    const dateStr = new Date(m.meeting_date + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
    const quorumHtml = m.quorum_required ? `<span style="font-size:0.75rem; color:var(--text-muted);">Quorum: ${m.quorum_met || 0}/${m.quorum_required}</span>` : '';
    return `<div class="meeting-card">
        <div class="meeting-card-top">
            <div>
                <span class="meeting-status" style="background:${statusColor}20; color:${statusColor};">${m.type}</span>
                <span class="meeting-status" style="background:${statusColor}20; color:${statusColor};">${m.status}</span>
            </div>
            <div class="meeting-card-actions">
                ${canManage ? `<button class="meeting-btn-icon" onclick="markMeetingAttendance('${m.id}')" title="Check In"><i class="fa-solid fa-clipboard-check"></i></button>` : ''}
                ${m.status !== 'completed' && m.status !== 'cancelled' && canManage ? `<button class="meeting-btn-icon" onclick="if(confirm('Mark as completed?')){sbClient.from('meetings').update({status:'completed'}).eq('id','${m.id}').then(()=>loadMeetingsList()).catch(()=>{})}" title="Complete"><i class="fa-solid fa-check-circle"></i></button>` : ''}
                ${canCreate ? `<button class="meeting-btn-icon" onclick="openCreateResolutionModal('${m.id}')" title="Add Resolution"><i class="fa-solid fa-gavel"></i></button>` : ''}
                ${canManage && m.status !== 'completed' ? `<button class="meeting-btn-icon" onclick="uploadMeetingMinutes('${m.id}')" title="Upload Minutes"><i class="fa-solid fa-file-pdf"></i></button>` : ''}
                ${canCreate ? `<button class="meeting-btn-icon" onclick="openCreateMeetingModal(${JSON.stringify(m).replace(/'/g, "&#39;")})" title="Edit"><i class="fa-solid fa-pen"></i></button>` : ''}
            </div>
        </div>
        <div class="meeting-title">${escapeHtml(m.title)}</div>
        ${m.description ? `<div class="meeting-desc">${escapeHtml(m.description)}</div>` : ''}
        <div class="meeting-meta">
            <span><i class="fa-solid fa-calendar"></i> ${dateStr}</span>
            ${quorumHtml}
            ${m.minutes_url ? `<span><i class="fa-solid fa-file-lines"></i> <a href="${escapeHtml(m.minutes_url)}" target="_blank" style="color:var(--color-indigo);">Minutes</a></span>` : ''}
        </div>
    </div>`;
}

window.markMeetingAttendance = async function(meetingId) {
    if (!currentUserId) { showToast('Please log in.', 'error'); return; }
    const flatNo = localStorage.getItem('currentFlatNo') || '';
    try {
        const { error } = await sbClient.from('meeting_attendance').insert({
            meeting_id: meetingId, user_id: currentUserId, flat_no: flatNo, is_proxy: false
        });
        if (error) throw error;
        showToast('Attendance marked!', 'success');
        await loadMeetingsList();
    } catch (err) {
        if (err.message?.includes('duplicate') || err.code === '23505') {
            showToast('Already checked in.', 'info');
        } else {
            showToast(err.message || 'Failed to mark attendance.', 'error');
        }
    }
};

window.uploadMeetingMinutes = function(meetingId) {
    const url = prompt('Enter the URL of the uploaded Minutes of Meeting document:');
    if (!url) return;
    sbClient.from('meetings').update({ minutes_url: url.trim(), status: 'completed' }).eq('id', meetingId)
        .then(() => { showToast('Minutes published!', 'success'); loadMeetingsList(); })
        .catch(err => showToast(err.message, 'error'));
};

window.openCreateResolutionModal = function(meetingId) {
    const num = prompt('Resolution number (e.g. 2026/01):');
    if (!num) return;
    const title = prompt('Resolution title:');
    if (!title) return;
    const desc = prompt('Description (optional):');
    const category = prompt('Category (e.g. maintenance, finance, general):') || 'general';
    sbClient.from('resolutions').insert({
        meeting_id: meetingId, resolution_number: num, title, description: desc || '', category,
        status: 'passed', passed_date: new Date().toISOString().split('T')[0], created_by: currentUserId
    }).then(() => { showToast('Resolution recorded!', 'success'); loadMeetingsList(); })
    .catch(err => showToast(err.message, 'error'));
};

window.openResolutionsModal = async function() {
    if (!hasPermission('resolutions:view')) { showToast("Access Denied.", "error"); return; }
    openModal('resolutionsModal');
    await loadResolutions();
};

async function loadResolutions() {
    const container = document.getElementById('resolutions-container');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
    try {
        const { data, error } = await sbClient.from('resolutions')
            .select('*, meetings!inner(title, meeting_date)')
            .in('status', ['passed', 'rejected'])
            .order('created_at', { ascending: false });
        if (error) throw error;
        const resolutions = data || [];
        if (resolutions.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">No resolutions recorded yet.</div>';
            return;
        }
        container.innerHTML = resolutions.map(r => {
            const meetingTitle = r.meetings?.title || '';
            const meetingDate = r.meetings?.meeting_date ? new Date(r.meetings.meeting_date + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '';
            return `<div class="resolution-card">
                <div class="resolution-num">${escapeHtml(r.resolution_number)}</div>
                <div class="resolution-body">
                    <div class="resolution-title">${escapeHtml(r.title)}</div>
                    ${r.description ? `<div class="resolution-desc">${escapeHtml(r.description)}</div>` : ''}
                    <div class="resolution-meta">
                        <span>${meetingTitle}${meetingDate ? ' • ' + meetingDate : ''}</span>
                        <span class="resolution-status ${r.status}">${r.status}</span>
                        ${r.category ? `<span class="resolution-cat">${escapeHtml(r.category)}</span>` : ''}
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--color-rose);">Failed to load resolutions.</div>';
    }
}

