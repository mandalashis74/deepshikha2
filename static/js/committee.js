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
        if (positions.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">No committee positions configured. Run the SQL migration.</div>';
            return;
        }
        const executive = positions.filter(p => p.category === 'executive');
        const sub = positions.filter(p => p.category === 'subcommittee');
        let html = '';
        if (executive.length) {
            html += '<h3 style="margin:0 0 12px; font-size:0.9rem; color:var(--color-indigo);"><i class="fa-solid fa-star"></i> Executive Committee</h3>';
            html += executive.map(pos => renderCommitteeManageRow(pos, members, profiles)).join('');
        }
        if (sub.length) {
            html += '<h3 style="margin:20px 0 12px; font-size:0.9rem; color:var(--color-violet);"><i class="fa-solid fa-users"></i> Sub-Committees</h3>';
            html += sub.map(pos => renderCommitteeManageRow(pos, members, profiles)).join('');
        }
        container.innerHTML = html;
    } catch (err) {
        console.error('loadCommitteeManageView error:', err);
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--color-rose);">Failed to load.</div>';
    }
}

function renderCommitteeManageRow(position, members, profiles) {
    const existing = members.find(m => m.position_id === position.id);
    const profileOptions = profiles.map(p =>
        `<option value="${p.id}">${p.email}</option>`
    ).join('');
    return `<div class="committee-mgmt-row">
        <div class="committee-mgmt-info">
            <strong>${position.title}</strong>
            <span style="font-size:0.8rem; color:var(--text-muted); display:block;">${position.description || ''}</span>
        </div>
        <div class="committee-mgmt-action">
            ${existing
                ? `<span style="font-size:0.85rem; color:var(--text-primary);">
                        ${escapeHtml(existing.owner_name || 'Assigned')}
                        ${existing.flat_no ? `(Flat ${escapeHtml(existing.flat_no)})` : ''}
                   </span>
                   <button class="btn btn-rose" style="padding:3px 8px; font-size:0.7rem;" onclick="removeCommitteeMember('${existing.id}')">Remove</button>`
                : `<select id="assign-select-${position.id}" class="filter-select" style="max-width:200px;">
                        <option value="">-- Select user --</option>
                        ${profileOptions}
                    </select>
                    <button class="btn btn-emerald" style="padding:3px 8px; font-size:0.7rem;" onclick="assignCommitteeMember('${position.id}')">Assign</button>`
            }
        </div>
    </div>`;
}

window.assignCommitteeMember = async function(positionId) {
    const select = document.getElementById(`assign-select-${positionId}`);
    const userId = select?.value;
    if (!userId) { showToast('Select a user first.', 'warning'); return; }
    if (!confirm('Assign this user to the position?')) return;
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
    if (!confirm('Remove this committee member?')) return;
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

