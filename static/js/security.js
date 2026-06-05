let securityPersonnel = [];

function hasSecurityPermission(perm) {
    if (currentUserRole === 'admin') return true;
    if (!window.currentRolePermissions) return false;
    return window.currentRolePermissions.includes(perm);
}

async function loadSecurityPersonnel() {
    const { data, error } = await sbClient.from('security_personnel').select('*').eq('is_active', true).order('display_order').order('name');
    if (error) { showToast('Error loading security personnel: ' + error.message, 'error'); return []; }
    securityPersonnel = data || [];
    return securityPersonnel;
}

window.openSecurityModal = async function() {
    if (!hasSecurityPermission('security:view')) {
        showToast('Access Denied.', 'error'); return;
    }
    openModal('securityModal');
    await renderSecurityRoster();
};

async function renderSecurityRoster() {
    const container = document.getElementById('security-container');
    const toolbar = document.getElementById('security-toolbar');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
    toolbar.innerHTML = '';

    if (hasSecurityPermission('security:manage')) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.innerHTML = '<i class="fa-solid fa-plus"></i> Add Personnel';
        btn.onclick = () => openCreateSecurityModal();
        toolbar.appendChild(btn);
    }

    const personnel = await loadSecurityPersonnel();
    if (personnel.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fa-solid fa-shield-halved"></i><br>No security personnel assigned yet.</div>';
        return;
    }

    const shifts = [
        { key: 'morning', label: '🌅 Morning (6 AM – 2 PM)', icon: 'fa-sun' },
        { key: 'evening', label: '🌆 Evening (2 PM – 10 PM)', icon: 'fa-cloud-sun' },
        { key: 'night', label: '🌙 Night (10 PM – 6 AM)', icon: 'fa-moon' }
    ];

    let html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;">';
    for (const shift of shifts) {
        const members = personnel.filter(p => p.shift === shift.key);
        html += `<div class="data-card" style="padding:16px;">
            <div style="font-size:1rem;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:8px;">
                <i class="fa-solid ${shift.icon}"></i> ${shift.label}
                <span style="margin-left:auto;font-size:0.75rem;color:var(--text-secondary);">${members.length} personnel</span>
            </div>`;
        if (members.length === 0) {
            html += '<div style="color:var(--text-muted);font-size:0.85rem;padding:12px 0;">No personnel assigned to this shift.</div>';
        } else {
            for (const m of members) {
                html += '<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-top:1px solid var(--border-color);">';
                if (m.photo_url) {
                    html += `<img src="${escapeHtml(m.photo_url)}" alt="" style="width:44px;height:44px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'">`;
                } else {
                    html += '<div style="width:44px;height:44px;border-radius:50%;background:var(--color-violet);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;"><i class="fa-solid fa-user-shield"></i></div>';
                }
                html += '<div style="flex:1;">';
                html += `<div style="font-weight:600;">${escapeHtml(m.name)}</div>`;
                html += `<div style="font-size:0.8rem;color:var(--text-secondary);">${escapeHtml(m.designation || 'Security Guard')}`;
                if (m.phone) html += ` · ${escapeHtml(m.phone)}`;
                html += '</div></div>';
                if (hasSecurityPermission('security:manage')) {
                    html += `<button class="btn btn-sm" onclick='editSecurityPersonnel("${m.id}")' title="Edit"><i class="fa-solid fa-pen"></i></button>`;
                    html += ` <button class="btn btn-sm" onclick='removeSecurityPersonnel("${m.id}")' title="Remove" style="color:var(--color-rose);"><i class="fa-solid fa-trash"></i></button>`;
                }
                html += '</div>';
            }
        }
        html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
}

window.openCreateSecurityModal = function(personId) {
    if (!hasSecurityPermission('security:manage')) { showToast('Access Denied.', 'error'); return; }
    document.getElementById('edit-security-id').value = personId || '';
    document.getElementById('create-security-title').textContent = personId ? 'Edit Security Personnel' : 'Add Security Personnel';
    if (personId) {
        const person = securityPersonnel.find(p => p.id === personId);
        if (person) {
            document.getElementById('security-name').value = person.name;
            document.getElementById('security-shift').value = person.shift;
            document.getElementById('security-phone').value = person.phone || '';
            document.getElementById('security-designation').value = person.designation || '';
            document.getElementById('security-photo').value = person.photo_url || '';
        }
    } else {
        document.getElementById('create-security-form').reset();
        document.getElementById('edit-security-id').value = '';
    }
    openModal('createSecurityModal');
};

window.saveSecurityPersonnel = async function(e) {
    e.preventDefault();
    if (!hasSecurityPermission('security:manage')) { showToast('Access Denied.', 'error'); return; }
    const editId = document.getElementById('edit-security-id').value;
    const name = document.getElementById('security-name').value.trim();
    const shift = document.getElementById('security-shift').value;
    const phone = document.getElementById('security-phone').value.trim();
    const designation = document.getElementById('security-designation').value.trim() || 'Security Guard';
    const photoUrl = document.getElementById('security-photo').value.trim();

    const payload = { name, shift, phone, designation, photo_url: photoUrl };
    if (editId) {
        const { error } = await sbClient.from('security_personnel').update(payload).eq('id', editId);
        if (error) { showToast('Error: ' + error.message, 'error'); return; }
        showToast('Personnel updated!', 'success');
    } else {
        payload.created_by = currentUserId;
        const { error } = await sbClient.from('security_personnel').insert(payload);
        if (error) { showToast('Error: ' + error.message, 'error'); return; }
        showToast('Personnel added!', 'success');
    }
    closeModal('createSecurityModal');
    await renderSecurityRoster();
};

window.editSecurityPersonnel = function(personId) {
    openCreateSecurityModal(personId);
};

window.removeSecurityPersonnel = async function(personId) {
    if (!hasSecurityPermission('security:manage')) { showToast('Access Denied.', 'error'); return; }
    const { isConfirmed: remove } = await Swal.fire({ title: 'Confirm', text: 'Remove this personnel from the roster?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc2626', confirmButtonText: 'Remove', cancelButtonText: 'Cancel' });
    if (!remove) return;
    const { error } = await sbClient.from('security_personnel').update({ is_active: false }).eq('id', personId);
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    showToast('Personnel removed.', 'success');
    await renderSecurityRoster();
};
