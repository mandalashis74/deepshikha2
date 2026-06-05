// ==========================================
// COMMITTEE MANAGEMENT SYSTEM
// ==========================================

window.openCommitteeModal = async function() {
    if (!hasPermission('committee:view')) {
        showToast("Access Denied.", "error");
        return;
    }
    openModal('committeeModal');
    const container = document.getElementById('committee-list-container');
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
    try {
        const [posRes, memRes] = await Promise.all([
            sbClient.from('committee_positions').select('*').order('sort_order'),
            sbClient.from('committee_members')
                .select('*, committee_positions!inner(title, slug, category, description)')
                .eq('is_active', true)
        ]);
        const positions = posRes.data || [];
        const members = memRes.data || [];
        if (positions.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">No committee positions configured.</div>';
            return;
        }
        const executive = positions.filter(p => p.category === 'executive');
        const sub = positions.filter(p => p.category === 'subcommittee');
        let html = '';
        if (executive.length) {
            html += '<h3 style="margin:0 0 12px; font-size:0.95rem; color:var(--color-indigo);"><i class="fa-solid fa-star"></i> Executive Committee</h3>';
            html += executive.map(pos => renderCommitteeMemberCard(pos, members.find(m => m.position_id === pos.id))).join('');
        }
        if (sub.length) {
            html += '<h3 style="margin:20px 0 12px; font-size:0.95rem; color:var(--color-violet);"><i class="fa-solid fa-users"></i> Sub-Committees</h3>';
            html += sub.map(pos => renderCommitteeMemberCard(pos, members.find(m => m.position_id === pos.id))).join('');
        }
        container.innerHTML = html || '<div style="text-align:center; padding:40px; color:var(--text-muted);">No committee members assigned.</div>';
    } catch (err) {
        console.error('openCommitteeModal error:', err);
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--color-rose);">Failed to load committee.</div>';
    }
};

function renderCommitteeMemberCard(position, member) {
    const isFilled = !!member;
    return `<div class="committee-card">
        <div class="committee-card-left">
            <div class="committee-pos-icon"><i class="fa-solid ${position.category === 'executive' ? 'fa-star' : 'fa-user-tie'}"></i></div>
            <div>
                <div class="committee-pos-title">${position.title}</div>
                <div class="committee-pos-desc">${position.description || ''}</div>
            </div>
        </div>
        <div class="committee-card-right">
            ${isFilled ? `<div class="committee-member-info">
                <span class="committee-member-name">${escapeHtml(member.owner_name || 'Member')}</span>
                ${member.flat_no ? `<span class="committee-member-flat">Flat ${escapeHtml(member.flat_no)}</span>` : ''}
            </div>` : `<span class="committee-vacant">Vacant</span>`}
        </div>
    </div>`;
}

window.openCommitteeManageModal = async function() {
    if (!hasPermission('committee:manage')) {
        showToast("Access Denied.", "error");
        return;
    }
    openModal('committeeManageModal');
    await loadCommitteeManageView();
};

async function loadCommitteeManageView() {
    const container = document.getElementById('committee-manage-container');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
    try {
        const [posRes, memRes, profilesRes] = await Promise.all([
            sbClient.from('committee_positions').select('*').order('sort_order'),
            sbClient.from('committee_members')
                .select('*, committee_positions!inner(title, slug)')
                .eq('is_active', true),
            sbClient.from('profiles').select('id, email').order('email')
        ]);
        const positions = posRes.data || [];
        const members = memRes.data || [];
        const profiles = profilesRes.data || [];
        const executive = positions.filter(p => p.category === 'executive');
        const sub = positions.filter(p => p.category === 'subcommittee');
        let html = '<div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;">';
        html += '<button class="btn btn-indigo" style="font-size:0.75rem;padding:4px 12px;" onclick="createCommitteePosition()"><i class="fa-solid fa-plus"></i> Add Position</button>';
        html += '</div>';
        if (executive.length) {
            html += '<h3 style="margin:0 0 12px; font-size:0.9rem; color:var(--color-indigo);"><i class="fa-solid fa-star"></i> Executive Committee</h3>';
            html += executive.map(pos => renderCommitteeManageRow(pos, members, profiles, positions)).join('');
        }
        if (sub.length) {
            html += '<h3 style="margin:20px 0 12px; font-size:0.9rem; color:var(--color-violet);"><i class="fa-solid fa-users"></i> Sub-Committees</h3>';
            html += sub.map(pos => renderCommitteeManageRow(pos, members, profiles, positions)).join('');
        }
        if (!executive.length && !sub.length) {
            html += '<div style="text-align:center; padding:40px; color:var(--text-muted);">No committee positions configured.</div>';
        }
        container.innerHTML = html;
    } catch (err) {
        console.error('loadCommitteeManageView error:', err);
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--color-rose);">Failed to load.</div>';
    }
}

function renderCommitteeManageRow(position, members, profiles, allPositions) {
    const existing = members.find(m => m.position_id === position.id);
    const profileOptions = profiles.map(p =>
        `<option value="${p.id}">${p.email}</option>`
    ).join('');
    const idx = allPositions.findIndex(p => p.id === position.id);
    const isFirst = idx === 0;
    const isLast = idx === allPositions.length - 1;
    return `<div class="committee-mgmt-row">
        <div class="committee-mgmt-info">
            <strong>${escapeHtml(position.title)}</strong>
            <span style="font-size:0.8rem; color:var(--text-muted); display:block;">${position.description || ''}</span>
        </div>
        <div class="committee-mgmt-action">
            <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
                <div style="display:flex;gap:2px;margin-right:4px;">
                    <button class="btn btn-sm" style="padding:2px 6px;font-size:0.6rem;" onclick="moveCommitteePosition('${position.id}','up')" ${isFirst ? 'disabled' : ''} title="Move up"><i class="fa-solid fa-chevron-up"></i></button>
                    <button class="btn btn-sm" style="padding:2px 6px;font-size:0.6rem;" onclick="moveCommitteePosition('${position.id}','down')" ${isLast ? 'disabled' : ''} title="Move down"><i class="fa-solid fa-chevron-down"></i></button>
                </div>
                <button class="btn btn-sm" style="padding:2px 8px;font-size:0.65rem;" onclick="editCommitteePosition('${position.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                ${existing
                    ? `<span style="font-size:0.85rem; color:var(--text-primary);">
                            ${escapeHtml(existing.owner_name || 'Assigned')}
                            ${existing.flat_no ? `(Flat ${escapeHtml(existing.flat_no)})` : ''}
                       </span>
                       <button class="btn btn-rose" style="padding:2px 6px; font-size:0.65rem;" onclick="removeCommitteeMember('${existing.id}')">Remove</button>`
                    : `<select id="assign-select-${position.id}" class="filter-select" style="max-width:160px;font-size:0.7rem;padding:2px 4px;">
                            <option value="">-- Select --</option>
                            ${profileOptions}
                        </select>
                        <button class="btn btn-emerald" style="padding:2px 6px; font-size:0.65rem;" onclick="assignCommitteeMember('${position.id}')">Assign</button>`
                }
                <button class="btn btn-rose" style="padding:2px 6px;font-size:0.65rem;" onclick="deleteCommitteePosition('${position.id}')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        </div>
    </div>`;
}

// ---- POSITION CRUD ----

window.createCommitteePosition = async function() {
    const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const { value: form } = await Swal.fire({
        title: 'Add Committee Position',
        html: `
            <div style="text-align:left;">
                <label style="font-size:0.8rem;color:var(--text-secondary);">Title</label>
                <input id="swal-pos-title" class="swal2-input" placeholder="e.g. Vice President" style="width:100%;">
                <label style="font-size:0.8rem;color:var(--text-secondary);margin-top:8px;display:block;">Slug (auto-generated, edit if needed)</label>
                <input id="swal-pos-slug" class="swal2-input" placeholder="vice_president" style="width:100%;">
                <label style="font-size:0.8rem;color:var(--text-secondary);margin-top:8px;display:block;">Description</label>
                <textarea id="swal-pos-desc" class="swal2-textarea" placeholder="Responsibilities of this position..." style="width:100%;min-height:60px;"></textarea>
                <label style="font-size:0.8rem;color:var(--text-secondary);margin-top:8px;display:block;">Category</label>
                <select id="swal-pos-cat" class="swal2-select" style="width:100%;">
                    <option value="executive">Executive Committee</option>
                    <option value="subcommittee">Sub-Committee</option>
                </select>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Create',
        preConfirm: () => {
            const title = document.getElementById('swal-pos-title').value.trim();
            const slug = document.getElementById('swal-pos-slug').value.trim() || slugify(title);
            if (!title) { Swal.showValidationMessage('Title is required'); return; }
            return { title, slug, description: document.getElementById('swal-pos-desc').value.trim(), category: document.getElementById('swal-pos-cat').value };
        }
    });
    if (!form) return;
    try {
        const { data: max } = await sbClient.from('committee_positions')
            .select('sort_order').order('sort_order', { ascending: false }).limit(1);
        const sort_order = (max?.[0]?.sort_order ?? 0) + 1;
        const { error } = await sbClient.from('committee_positions').insert({
            title: form.title, slug: form.slug, description: form.description,
            category: form.category, sort_order
        });
        if (error) throw error;
        showToast(`Position "${form.title}" created.`, 'success');
        await loadCommitteeManageView();
    } catch (err) {
        console.error('createCommitteePosition error:', err);
        showToast(err.message || 'Failed to create position.', 'error');
    }
};

window.editCommitteePosition = async function(positionId) {
    const { data: pos } = await sbClient.from('committee_positions').select('*').eq('id', positionId).single();
    if (!pos) { showToast('Position not found.', 'error'); return; }
    const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const { value: form } = await Swal.fire({
        title: 'Edit Committee Position',
        html: `
            <div style="text-align:left;">
                <label style="font-size:0.8rem;color:var(--text-secondary);">Title</label>
                <input id="swal-pos-title" class="swal2-input" value="${escapeHtml(pos.title)}" style="width:100%;">
                <label style="font-size:0.8rem;color:var(--text-secondary);margin-top:8px;display:block;">Slug</label>
                <input id="swal-pos-slug" class="swal2-input" value="${escapeHtml(pos.slug)}" style="width:100%;">
                <label style="font-size:0.8rem;color:var(--text-secondary);margin-top:8px;display:block;">Description</label>
                <textarea id="swal-pos-desc" class="swal2-textarea" style="width:100%;min-height:60px;">${escapeHtml(pos.description || '')}</textarea>
                <label style="font-size:0.8rem;color:var(--text-secondary);margin-top:8px;display:block;">Category</label>
                <select id="swal-pos-cat" class="swal2-select" style="width:100%;">
                    <option value="executive" ${pos.category === 'executive' ? 'selected' : ''}>Executive Committee</option>
                    <option value="subcommittee" ${pos.category === 'subcommittee' ? 'selected' : ''}>Sub-Committee</option>
                </select>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Save',
        preConfirm: () => {
            const title = document.getElementById('swal-pos-title').value.trim();
            const slug = document.getElementById('swal-pos-slug').value.trim() || slugify(title);
            if (!title) { Swal.showValidationMessage('Title is required'); return; }
            return { title, slug, description: document.getElementById('swal-pos-desc').value.trim(), category: document.getElementById('swal-pos-cat').value };
        }
    });
    if (!form) return;
    try {
        const { error } = await sbClient.from('committee_positions').update({
            title: form.title, slug: form.slug, description: form.description, category: form.category
        }).eq('id', positionId);
        if (error) throw error;
        showToast('Position updated.', 'success');
        await loadCommitteeManageView();
    } catch (err) {
        console.error('editCommitteePosition error:', err);
        showToast(err.message || 'Failed to update position.', 'error');
    }
};

window.deleteCommitteePosition = async function(positionId) {
    const result = await Swal.fire({
        title: 'Delete Position?',
        text: 'This will also remove any members assigned to this position.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e74c3c',
        confirmButtonText: 'Delete'
    });
    if (!result.isConfirmed) return;
    try {
        const { error } = await sbClient.from('committee_positions').delete().eq('id', positionId);
        if (error) throw error;
        showToast('Position deleted.', 'success');
        await loadCommitteeManageView();
    } catch (err) {
        console.error('deleteCommitteePosition error:', err);
        showToast(err.message || 'Failed to delete position.', 'error');
    }
};

window.moveCommitteePosition = async function(positionId, direction) {
    try {
        const { data: all } = await sbClient.from('committee_positions').select('id, sort_order').order('sort_order');
        if (!all || all.length < 2) return;
        const idx = all.findIndex(p => p.id === positionId);
        if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === all.length - 1)) return;
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        await sbClient.from('committee_positions').update({ sort_order: all[swapIdx].sort_order }).eq('id', all[idx].id);
        await sbClient.from('committee_positions').update({ sort_order: all[idx].sort_order }).eq('id', all[swapIdx].id);
        showToast('Position reordered.', 'success');
        await loadCommitteeManageView();
    } catch (err) {
        console.error('moveCommitteePosition error:', err);
        showToast(err.message || 'Failed to reorder.', 'error');
    }
};

// ---- MEMBER ASSIGNMENT ----

window.assignCommitteeMember = async function(positionId) {
    const select = document.getElementById(`assign-select-${positionId}`);
    const userId = select?.value;
    if (!userId) { showToast('Select a user first.', 'warning'); return; }
    const { isConfirmed: assign } = await Swal.fire({ title: 'Confirm', text: 'Assign this user to the position?', icon: 'question', showCancelButton: true, confirmButtonColor: '#059669', confirmButtonText: 'Assign', cancelButtonText: 'Cancel' });
    if (!assign) return;
    try {
        const [posRes, profileRes] = await Promise.all([
            sbClient.from('committee_positions').select('title').eq('id', positionId).single(),
            sbClient.from('profiles').select('email').eq('id', userId).single()
        ]);
        const pos = posRes.data;
        const profile = profileRes.data;
        const { error } = await sbClient.from('committee_members').insert({
            position_id: positionId,
            user_id: userId,
            owner_name: profile?.email || 'Member',
            flat_no: '',
            term_start: new Date().toISOString().split('T')[0],
            is_active: true
        });
        if (error) throw error;
        showToast(`${profile?.email || 'User'} assigned as ${pos?.title || 'member'}.`, 'success');
        await loadCommitteeManageView();
    } catch (err) {
        console.error('assignCommitteeMember error:', err);
        showToast(err.message || 'Failed to assign.', 'error');
    }
};

window.removeCommitteeMember = async function(memberId) {
    const { isConfirmed: remove } = await Swal.fire({ title: 'Confirm', text: 'Remove this committee member?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc2626', confirmButtonText: 'Remove', cancelButtonText: 'Cancel' });
    if (!remove) return;
    try {
        const { error } = await sbClient.from('committee_members').update({ is_active: false }).eq('id', memberId);
        if (error) throw error;
        showToast('Committee member removed.', 'success');
        await loadCommitteeManageView();
    } catch (err) {
        console.error('removeCommitteeMember error:', err);
        showToast(err.message || 'Failed to remove.', 'error');
    }
};

