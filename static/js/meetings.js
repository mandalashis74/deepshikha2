// ==========================================
// MEETINGS & RESOLUTIONS (AGM TRACKER)
// ==========================================

window.openMeetingsModal = async function() {
    if (!hasPermission('meetings:view')) { showToast("Access Denied.", "error"); return; }
    openModal('meetingsModal');
    const canCreate = hasPermission('meetings:create');
    const btn = document.getElementById('btn-create-meeting');
    if (btn) btn.style.display = canCreate ? '' : 'none';
    const resolutionsBtn = document.getElementById('btn-view-resolutions');
    if (resolutionsBtn) resolutionsBtn.style.display = '';
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
        const [meetingsRes, attendanceRes, myAttendanceRes, resolutionsRes] = await Promise.all([
            sbClient.from('meetings').select('*').order('meeting_date', { ascending: false }),
            sbClient.from('meeting_attendance').select('meeting_id, flat_no, user_id'),
            currentUserId ? sbClient.from('meeting_attendance').select('meeting_id').eq('user_id', currentUserId) : { data: [] },
            sbClient.from('resolutions').select('id, meeting_id, resolution_number, title, status').in('status', ['passed', 'rejected'])
        ]);
        if (meetingsRes.error) throw meetingsRes.error;
        const meetings = meetingsRes.data || [];
        const attendanceCounts = {};
        const uniqueFlatsPerMeeting = {};
        (attendanceRes.data || []).forEach(a => {
            if (!uniqueFlatsPerMeeting[a.meeting_id]) {
                uniqueFlatsPerMeeting[a.meeting_id] = new Set();
            }
            const identifier = (a.flat_no && a.flat_no.trim()) || a.user_id || a.id;
            if (identifier) {
                uniqueFlatsPerMeeting[a.meeting_id].add(identifier);
            }
        });
        Object.keys(uniqueFlatsPerMeeting).forEach(mId => {
            attendanceCounts[mId] = uniqueFlatsPerMeeting[mId].size;
        });
        const myCheckedIn = new Set((myAttendanceRes.data || []).map(a => a.meeting_id));
        const resolutionsByMeeting = {};
        (resolutionsRes.data || []).forEach(r => {
            if (!resolutionsByMeeting[r.meeting_id]) resolutionsByMeeting[r.meeting_id] = [];
            resolutionsByMeeting[r.meeting_id].push(r);
        });
        if (meetings.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">No meetings scheduled yet.</div>';
            return;
        }
        container.innerHTML = meetings.map(m => renderMeetingCard(m, attendanceCounts[m.id] || 0, myCheckedIn.has(m.id), resolutionsByMeeting[m.id] || [])).join('');
    } catch (err) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--color-rose);">Failed to load meetings.</div>';
    }
}

function renderMeetingCard(m, attendanceCount = 0, isCheckedIn = false, resolutions = []) {
    const canManage = hasPermission('meetings:manage');
    const canCreate = hasPermission('meetings:create');
    const statusColors = { scheduled: 'var(--color-yellow)', ongoing: 'var(--color-indigo)', completed: 'var(--color-emerald)', cancelled: 'var(--color-rose)' };
    const statusColor = statusColors[m.status] || 'var(--text-muted)';
    const dateStr = new Date(m.meeting_date + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
    const quorumHtml = m.quorum_required ? `<span style="font-size:0.75rem; color:var(--text-muted);">Quorum: ${m.quorum_met || 0}/${m.quorum_required}</span>` : '';
    const isAgmType = m.type === 'AGM' || m.type === 'SGM';
    const canCheckIn = isAgmType || canManage;
    const resolutionsHtml = resolutions.length > 0 ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border-color);">
        <div style="font-size:0.75rem;font-weight:600;color:var(--text-secondary);margin-bottom:4px;"><i class="fa-solid fa-scale-balanced"></i> Resolutions</div>
        ${resolutions.map(r => `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:0.78rem;">
            <span style="color:var(--text-muted);min-width:60px;">${escapeHtml(r.resolution_number)}</span>
            <span style="flex:1;color:var(--text-primary);">${escapeHtml(r.title)}</span>
            <span style="font-size:0.65rem;color:${r.status === 'passed' ? 'var(--color-emerald)' : 'var(--color-rose)'};">${r.status}</span>
        </div>`).join('')}
    </div>` : '';
    return `<div class="meeting-card">
        <div class="meeting-card-top">
            <div>
                <span class="meeting-status" style="background:${statusColor}20; color:${statusColor};">${m.type}</span>
                <span class="meeting-status" style="background:${statusColor}20; color:${statusColor};">${m.status}</span>
            </div>
            <div class="meeting-card-actions">
                ${canCheckIn && !isCheckedIn && m.status !== 'completed' && m.status !== 'cancelled' ? `<button class="meeting-btn-icon" onclick="markMeetingAttendance('${m.id}')" title="Check In"><i class="fa-solid fa-clipboard-check"></i></button>` : ''}
                ${isCheckedIn ? `<span style="font-size:0.75rem; color:var(--color-emerald);"><i class="fa-solid fa-check-circle"></i> Checked In</span>` : ''}
                ${isAgmType && canManage ? `<button class="meeting-btn-icon" onclick="openAttendanceManager('${m.id}')" title="Manage Attendance"><i class="fa-solid fa-users"></i></button>` : ''}
                ${canManage && m.status !== 'completed' ? `<button class="meeting-btn-icon" onclick="Swal.fire({title:'Complete Meeting', text:'Mark this meeting as completed?', icon:'question', showCancelButton:true, confirmButtonColor:'#10b981', cancelButtonColor:'#ef4444', confirmButtonText:'Yes, complete!'}).then((r)=>{if(r.isConfirmed){sbClient.from('meetings').update({status:'completed'}).eq('id','${m.id}').then(()=>loadMeetingsList()).catch(()=>{})}})" title="Complete"><i class="fa-solid fa-check-circle"></i></button>` : ''}
                ${canCreate ? `<button class="meeting-btn-icon" onclick="openCreateResolutionModal('${m.id}')" title="Add Resolution"><i class="fa-solid fa-gavel"></i></button>` : ''}
                ${canManage ? `<button class="meeting-btn-icon" onclick="uploadMeetingMinutes('${m.id}')" title="Upload/Update Minutes"><i class="fa-solid fa-file-pdf"></i></button>` : ''}
                ${canCreate ? `<button class="meeting-btn-icon" onclick="openCreateMeetingModal(${JSON.stringify(m).replace(/'/g, "&#39;")})" title="Edit"><i class="fa-solid fa-pen"></i></button>` : ''}
            </div>
        </div>
        <div class="meeting-title">${escapeHtml(m.title)}</div>
        ${m.description ? `<div class="meeting-desc">${escapeHtml(m.description)}</div>` : ''}
        <div class="meeting-meta">
            <span><i class="fa-solid fa-calendar"></i> ${dateStr}</span>
            <span style="font-size:0.75rem; color:var(--text-secondary);"><i class="fa-solid fa-user-check"></i> ${attendanceCount} checked in</span>
            ${quorumHtml}
            ${m.minutes_url ? `<span><i class="fa-solid fa-file-lines"></i> <a href="${escapeHtml(m.minutes_url)}" target="_blank" style="color:var(--color-indigo);">Minutes</a></span>` : ''}
        </div>
        ${resolutionsHtml}
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
    Swal.fire({
        title: 'Publish Minutes',
        input: 'url',
        inputLabel: 'Enter the URL of the uploaded Minutes of Meeting document:',
        inputPlaceholder: 'https://example.com/minutes.pdf',
        showCancelButton: true,
        confirmButtonColor: '#6366f1',
        cancelButtonColor: '#6875f5',
        confirmButtonText: 'Publish',
        inputValidator: (value) => {
            if (!value) {
                return 'Please enter a valid URL!';
            }
        }
    }).then((result) => {
        if (result.isConfirmed && result.value) {
            const url = result.value.trim();
            sbClient.from('meetings').update({ minutes_url: url, status: 'completed' }).eq('id', meetingId)
                .then(() => { showToast('Minutes published!', 'success'); loadMeetingsList(); })
                .catch(err => showToast(err.message, 'error'));
        }
    });
};

window.openCreateResolutionModal = function(meetingId) {
    Swal.fire({
        title: 'New Resolution',
        html: `
            <div style="display:flex;flex-direction:column;gap:12px;text-align:left;">
                <div>
                    <label style="font-size:0.82rem;color:var(--text-secondary);display:block;margin-bottom:4px;">Resolution Number *</label>
                    <input id="swal-res-num" class="swal2-input" placeholder="e.g. 2026/01" style="width:100%;margin:0;">
                </div>
                <div>
                    <label style="font-size:0.82rem;color:var(--text-secondary);display:block;margin-bottom:4px;">Title *</label>
                    <input id="swal-res-title" class="swal2-input" placeholder="Resolution title" style="width:100%;margin:0;">
                </div>
                <div>
                    <label style="font-size:0.82rem;color:var(--text-secondary);display:block;margin-bottom:4px;">Description</label>
                    <textarea id="swal-res-desc" class="swal2-textarea" placeholder="Optional description" style="width:100%;margin:0;min-height:60px;"></textarea>
                </div>
                <div>
                    <label style="font-size:0.82rem;color:var(--text-secondary);display:block;margin-bottom:4px;">Category</label>
                    <select id="swal-res-cat" class="swal2-input" style="width:100%;margin:0;">
                        <option value="general">General</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="finance">Finance</option>
                        <option value="governance">Governance</option>
                        <option value="security">Security</option>
                        <option value="infrastructure">Infrastructure</option>
                    </select>
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-gavel"></i> Record Resolution',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#6366f1',
        preConfirm: () => {
            const num = document.getElementById('swal-res-num').value.trim();
            const title = document.getElementById('swal-res-title').value.trim();
            const desc = document.getElementById('swal-res-desc').value.trim();
            const category = document.getElementById('swal-res-cat').value;
            if (!num) { Swal.showValidationMessage('Resolution number is required'); return false; }
            if (!title) { Swal.showValidationMessage('Title is required'); return false; }
            return { num, title, desc, category };
        }
    }).then(result => {
        if (!result.isConfirmed) return;
        const { num, title, desc, category } = result.value;
        sbClient.from('resolutions').insert({
            meeting_id: meetingId, resolution_number: num, title,
            description: desc || '', category,
            status: 'passed', passed_date: new Date().toISOString().split('T')[0],
            created_by: currentUserId
        }).then(() => { showToast('Resolution recorded!', 'success'); loadMeetingsList(); })
        .catch(err => showToast(err.message, 'error'));
    });
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
            .select('*, meetings!inner(title, meeting_date, minutes_url, type)')
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
            const minutesUrl = r.meetings?.minutes_url;
            const meetingType = r.meetings?.type || '';
            return `<div class="resolution-card">
                <div class="resolution-num">${escapeHtml(r.resolution_number)}</div>
                <div class="resolution-body">
                    <div class="resolution-title">${escapeHtml(r.title)}</div>
                    ${r.description ? `<div class="resolution-desc">${escapeHtml(r.description)}</div>` : ''}
                    <div class="resolution-meta">
                        <span>${meetingTitle}${meetingDate ? ' • ' + meetingDate : ''} ${meetingType ? '[' + meetingType + ']' : ''}</span>
                        <span class="resolution-status ${r.status}">${r.status}</span>
                        ${r.category ? `<span class="resolution-cat">${escapeHtml(r.category)}</span>` : ''}
                        ${minutesUrl ? `<span><i class="fa-solid fa-file-lines"></i> <a href="${escapeHtml(minutesUrl)}" target="_blank" style="color:var(--color-indigo);">MoM</a></span>` : ''}
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--color-rose);">Failed to load resolutions.</div>';
    }
}

let attendanceOwners = [];
let attendanceRecords = new Set();
let attendanceRecordIds = {};
let currentAttendanceMeetingId = null;

window.openAttendanceManager = async function(meetingId) {
    if (!hasPermission('meetings:manage')) { showToast('Access Denied.', 'error'); return; }
    const { data: meeting } = await sbClient.from('meetings').select('title, type').eq('id', meetingId).single();
    if (!meeting) { showToast('Meeting not found.', 'error'); return; }
    currentAttendanceMeetingId = meetingId;
    document.getElementById('attendance-manager-title').textContent = 'Attendance · ' + meeting.title;
    openModal('attendanceManagerModal');
    const container = document.getElementById('attendance-list-container');
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
    try {
        const [ownersRes, attendanceRes] = await Promise.all([
            sbClient.from('owners').select('flat_no, owner_name, occupancy_status'),
            sbClient.from('meeting_attendance').select('id, flat_no').eq('meeting_id', meetingId)
        ]);
        if (ownersRes.error) { console.error('owners query error:', ownersRes.error); throw ownersRes.error; }
        if (attendanceRes.error) { console.error('attendance query error:', attendanceRes.error); throw attendanceRes.error; }
        attendanceOwners = (ownersRes.data || []).sort((a, b) => a.flat_no.localeCompare(b.flat_no, undefined, { numeric: true }));
        attendanceRecordIds = {};
        (attendanceRes.data || []).forEach(a => { attendanceRecordIds[a.flat_no] = a.id; });
        attendanceRecords = new Set(Object.keys(attendanceRecordIds));
        renderAttendanceList();
    } catch (err) {
        console.error('openAttendanceManager error:', err);
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--color-rose);">Failed to load owners. Check console for details.</div>';
    }
};

function renderAttendanceList() {
    const container = document.getElementById('attendance-list-container');
    container.className = 'flats-grid';
    container.style.display = 'grid';
    container.style.flexDirection = '';
    container.style.gap = '10px';
    
    const searchVal = (document.getElementById('attendance-search').value || '').toLowerCase();
    const filtered = attendanceOwners.filter(o =>
        o.flat_no.toLowerCase().includes(searchVal) ||
        (window.displayStructured(o.owner_name, 'name') || '').toLowerCase().includes(searchVal)
    );
    const checkedCount = attendanceOwners.filter(o => attendanceRecords.has(o.flat_no)).length;
    document.getElementById('attendance-summary').textContent = `${checkedCount} / ${attendanceOwners.length} checked in`;
    if (filtered.length === 0) {
        container.innerHTML = '<div style="grid-column: span 3; text-align:center; padding:40px; color:var(--text-muted);">No matching owners.</div>';
        return;
    }
    container.innerHTML = filtered.map(o => {
        const checked = attendanceRecords.has(o.flat_no);
        const name = window.displayStructured(o.owner_name, 'name') || '-';
        const badgeClass = checked ? 'badge-income' : 'badge-expense';
        const statusText = checked ? 'PRESENT' : 'ABSENT';
        
        return `<div class="flat-card ${checked ? 'active' : ''}" onclick="toggleOwnerAttendance('${o.flat_no}')">
            <h4>${escapeHtml(o.flat_no)}</h4>
            <p style="font-weight: 600;">${escapeHtml(name)}</p>
            <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:center;">
                <span class="badge ${badgeClass}" style="font-size: 0.6rem; padding: 1px 6px;">${statusText}</span>
                ${o.occupancy_status ? `<span class="badge badge-low" style="font-size: 0.6rem; padding: 1px 6px; text-transform:capitalize; background:rgba(255,255,255,0.06); border-color:var(--border-color); color:var(--text-secondary);">${o.occupancy_status.replace('-occupied', '')}</span>` : ''}
            </div>
        </div>`;
    }).join('');
}

window.filterAttendanceTable = function() {
    renderAttendanceList();
};

window.toggleOwnerAttendance = async function(flatNo) {
    if (!hasPermission('meetings:manage')) { showToast('Access Denied.', 'error'); return; }
    const meetingId = currentAttendanceMeetingId;
    if (!meetingId) return;
    const isCheckedIn = attendanceRecords.has(flatNo);
    try {
        if (isCheckedIn) {
            const recordId = attendanceRecordIds[flatNo];
            if (recordId) {
                const { error } = await sbClient.from('meeting_attendance').delete().eq('id', recordId);
                if (error) throw error;
            }
            attendanceRecords.delete(flatNo);
            delete attendanceRecordIds[flatNo];
            renderAttendanceList();
            showToast(flatNo + ' checked out.', 'info');
        } else {
            const { data: newRecord, error } = await sbClient.from('meeting_attendance').insert({
                meeting_id: meetingId, flat_no: flatNo, is_proxy: true
            }).select('id').single();
            if (error) throw error;
            attendanceRecords.add(flatNo);
            attendanceRecordIds[flatNo] = newRecord.id;
            renderAttendanceList();
            showToast(flatNo + ' checked in!', 'success');
        }
    } catch (err) {
        showToast(err.message || 'Failed.', 'error');
    }
};

window.checkInAllAttendance = async function() {
    if (!hasPermission('meetings:manage')) { showToast('Access Denied.', 'error'); return; }
    const meetingId = currentAttendanceMeetingId;
    if (!meetingId) return;
    
    // Find all flats that are not currently checked in
    const uncheckedFlats = attendanceOwners.filter(o => !attendanceRecords.has(o.flat_no));
    if (uncheckedFlats.length === 0) {
        showToast('All flats are already checked in.', 'info');
        return;
    }
    
    const result = await Swal.fire({
        title: 'Check In All',
        text: `Are you sure you want to check in all remaining ${uncheckedFlats.length} flats?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, check in all!'
    });
    if (!result.isConfirmed) return;
    
    try {
        const insertPayload = uncheckedFlats.map(o => ({
            meeting_id: meetingId,
            flat_no: o.flat_no,
            is_proxy: true
        }));
        
        const { data, error } = await sbClient.from('meeting_attendance').insert(insertPayload).select('id, flat_no');
        if (error) throw error;
        
        // Add all to local state
        (data || []).forEach(row => {
            attendanceRecords.add(row.flat_no);
            attendanceRecordIds[row.flat_no] = row.id;
        });
        
        renderAttendanceList();
        showToast(`Successfully checked in ${uncheckedFlats.length} flats!`, 'success');
    } catch (err) {
        showToast(err.message || 'Failed to check in all.', 'error');
    }
};

window.checkOutAllAttendance = async function() {
    if (!hasPermission('meetings:manage')) { showToast('Access Denied.', 'error'); return; }
    const meetingId = currentAttendanceMeetingId;
    if (!meetingId) return;
    
    // Find all flats that are currently checked in
    const checkedFlats = attendanceOwners.filter(o => attendanceRecords.has(o.flat_no));
    if (checkedFlats.length === 0) {
        showToast('No flats are currently checked in.', 'info');
        return;
    }
    
    const result = await Swal.fire({
        title: 'Check Out All',
        text: `Are you sure you want to check out all ${checkedFlats.length} flats?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, check out all!'
    });
    if (!result.isConfirmed) return;
    
    try {
        const recordIds = checkedFlats.map(o => attendanceRecordIds[o.flat_no]).filter(Boolean);
        if (recordIds.length > 0) {
            const { error } = await sbClient.from('meeting_attendance').delete().in('id', recordIds);
            if (error) throw error;
        }
        
        // Remove all from local state
        checkedFlats.forEach(o => {
            attendanceRecords.delete(o.flat_no);
            delete attendanceRecordIds[o.flat_no];
        });
        
        renderAttendanceList();
        showToast(`Successfully checked out ${checkedFlats.length} flats.`, 'info');
    } catch (err) {
        showToast(err.message || 'Failed to check out all.', 'error');
    }
};
