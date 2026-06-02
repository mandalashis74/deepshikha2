// ==========================================
// PHASE 4: COMMITTEE HANDOVER TOOL
// ==========================================
let allHandovers = [];
let handoverFilter = 'all';
let currentHandoverChecklist = [];

window.openHandoverModal = async function() {
    if (!hasPermission('handover:view')) { showToast("Access Denied.", "error"); return; }
    openModal('handoverModal');
    const btn = document.getElementById('btn-create-handover');
    if (btn) btn.style.display = hasPermission('handover:create') ? '' : 'none';
    await loadHandovers();
};

async function loadHandovers() {
    const container = document.getElementById('handover-container');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
    try {
        const { data, error } = await sbClient.from('committee_handovers').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        allHandovers = data || [];
        renderHandovers(handoverFilter);
    } catch (err) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--color-rose);">Failed to load handovers.</div>';
    }
}

window.filterHandovers = function(status) {
    handoverFilter = status;
    document.querySelectorAll('#handover-filter-pills .pill').forEach(p => p.classList.remove('active'));
    const btn = document.querySelector(`#handover-filter-pills [data-ho="${status}"]`);
    if (btn) btn.classList.add('active');
    renderHandovers(status);
};

function renderHandovers(status) {
    const container = document.getElementById('handover-container');
    if (!container) return;
    let items = allHandovers;
    if (status !== 'all') items = items.filter(h => h.status === status);
    if (items.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-handshake"></i> No handover records found.</div>';
        return;
    }
    const canCreate = hasPermission('handover:create');
    container.innerHTML = items.map(h => {
        const statusColors = { draft:'var(--text-muted)', in_progress:'var(--color-yellow)', completed:'var(--color-emerald)', cancelled:'var(--color-rose)' };
        const sc = statusColors[h.status] || 'var(--text-muted)';
        const dateStr = new Date(h.handover_date + 'T00:00:00').toLocaleDateString('en-IN');
        return `<div class="data-card">
            <div class="data-card-top">
                <div class="data-card-title">${escapeHtml(h.from_term)} &rarr; ${escapeHtml(h.to_term)}</div>
                <span class="pill" style="background:${sc}20; color:${sc};">${h.status.replace(/_/g, ' ')}</span>
            </div>
            <div class="data-card-body">
                <div class="data-card-row"><span class="data-label">Date</span> ${dateStr}</div>
                ${h.notes ? `<div class="data-card-row"><span class="data-label">Notes</span> ${escapeHtml(h.notes).substring(0, 120)}${h.notes.length > 120 ? '...' : ''}</div>` : ''}
                ${h.acknowledged_at ? `<div class="data-card-row"><span class="data-label">Acknowledged</span> ${new Date(h.acknowledged_at).toLocaleDateString('en-IN')}</div>` : ''}
            </div>
            <div class="data-card-actions">
                <button class="btn btn-sm btn-primary" onclick="openHandoverDetail('${h.id}')"><i class="fa-solid fa-list-check"></i> Checklist</button>
                ${canCreate && h.status !== 'completed' ? `<button class="btn btn-sm btn-slate" onclick="editHandover('${h.id}')"><i class="fa-solid fa-pen"></i></button>` : ''}
                ${h.status === 'completed' ? `<button class="btn btn-sm btn-success" onclick="exportHandoverSummary('${h.id}')"><i class="fa-solid fa-download"></i> Export</button>` : ''}
            </div>
        </div>`;
    }).join('');
}

window.openCreateHandoverModal = function(data = null) {
    if (!hasPermission('handover:create')) { showToast("Access Denied.", "error"); return; }
    document.getElementById('create-handover-title').textContent = data ? 'Edit Handover' : 'New Committee Handover';
    document.getElementById('edit-handover-id').value = data ? data.id : '';
    document.getElementById('handover-from').value = data ? data.from_term : '';
    document.getElementById('handover-to').value = data ? data.to_term : '';
    document.getElementById('handover-date').value = data ? data.handover_date : new Date().toISOString().split('T')[0];
    document.getElementById('handover-notes').value = data ? data.notes : '';
    openModal('createHandoverModal');
};

window.saveHandover = async function(e) {
    e.preventDefault();
    if (!sbClient || !hasPermission('handover:create')) { showToast("Access Denied.", "error"); return; }
    const id = document.getElementById('edit-handover-id').value;
    const data = {
        from_term: document.getElementById('handover-from').value.trim(),
        to_term: document.getElementById('handover-to').value.trim(),
        handover_date: document.getElementById('handover-date').value || new Date().toISOString().split('T')[0],
        notes: document.getElementById('handover-notes').value.trim()
    };
    try {
        if (id) {
            const { error } = await sbClient.from('committee_handovers').update(data).eq('id', id);
            if (error) throw error;
            showToast('Handover updated.', 'success');
        } else {
            data.created_by = currentUserId;
            data.status = 'draft';
            const { data: newHo, error } = await sbClient.from('committee_handovers').insert(data).select();
            if (error) throw error;
            // Auto-generate checklist items
            if (newHo && newHo[0]) {
                await generateChecklist(newHo[0].id);
            }
            showToast('Handover created with checklist!', 'success');
        }
        closeModal('createHandoverModal');
        await loadHandovers();
    } catch (err) {
        showToast(err.message || 'Failed to save handover.', 'error');
    }
};

window.editHandover = function(id) {
    const item = allHandovers.find(h => h.id === id);
    if (item) openCreateHandoverModal(item);
};

async function generateChecklist(handoverId) {
    const defaultItems = [
        { section: 'Finance', items: ['Ledger books handed over', 'Bank account details shared', 'Outstanding dues list provided', 'Audit report shared'] },
        { section: 'Meetings & Resolutions', items: ['Minutes of all meetings handed over', 'Resolution register shared', 'Pending resolutions list'] },
        { section: 'Vendors & Contracts', items: ['Vendor list with contract details shared', 'AMC documents handed over', 'Pending payments list'] },
        { section: 'Assets', items: ['Asset register handed over', 'Maintenance schedules shared', 'Warranty documents transferred'] },
        { section: 'Documents', items: ['Society by-laws / registration docs', 'Insurance policies handed over', 'Tax filings shared'] },
        { section: 'Compliance', items: ['Compliance calendar handed over', 'Pending compliance items listed', 'Govt inspection reports'] },
        { section: 'Community Board', items: ['Moderator access transferred', 'Archived posts handed over'] },
        { section: 'Parking', items: ['Parking allotment list shared', 'Pending requests list'] },
        { section: 'Cultural Events', items: ['Event history shared', 'Vendor contacts handed over', 'Budget vs actual report'] },
        { section: 'Helpdesk', items: ['Pending tickets list', 'Common issues documentation'] }
    ];
    const checklistInserts = [];
    let sortOrder = 0;
    defaultItems.forEach(sec => {
        sec.items.forEach(item => {
            checklistInserts.push({
                handover_id: handoverId,
                section: sec.section,
                item: item,
                sort_order: sortOrder++
            });
        });
    });
    const { error } = await sbClient.from('handover_checklist').insert(checklistInserts);
    if (error) console.error('Failed to generate checklist:', error);
}

window.openHandoverDetail = async function(handoverId) {
    const ho = allHandovers.find(h => h.id === handoverId);
    if (!ho) return;
    document.getElementById('handover-detail-title').textContent = `Handover: ${ho.from_term} → ${ho.to_term}`;
    const meta = document.getElementById('handover-detail-meta');
    meta.innerHTML = `<span style="font-weight:600;">Status:</span> ${ho.status.replace(/_/g, ' ')} &middot; <span style="font-weight:600;">Date:</span> ${new Date(ho.handover_date + 'T00:00:00').toLocaleDateString('en-IN')}`;
    openModal('handoverDetailModal');
    await loadChecklist(handoverId);
};

async function loadChecklist(handoverId) {
    const container = document.getElementById('handover-checklist-container');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
    try {
        const { data, error } = await sbClient.from('handover_checklist').select('*').eq('handover_id', handoverId).order('sort_order', { ascending: true });
        if (error) throw error;
        currentHandoverChecklist = data || [];
        renderChecklist(handoverId);
    } catch (err) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--color-rose);">Failed to load checklist.</div>';
    }
}

function renderChecklist(handoverId) {
    const container = document.getElementById('handover-checklist-container');
    if (!container) return;
    const canCreate = hasPermission('handover:create');
    const ho = allHandovers.find(h => h.id === handoverId);
    const isCompleted = ho && ho.status === 'completed';
    const sections = [...new Set(currentHandoverChecklist.map(c => c.section))];
    const total = currentHandoverChecklist.length;
    const done = currentHandoverChecklist.filter(c => c.is_completed).length;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    let html = `<div style="margin-bottom:12px; display:flex; align-items:center; gap:10px;">
        <div style="flex:1; height:8px; background:var(--border-color); border-radius:4px; overflow:hidden;">
            <div style="height:100%; width:${pct}%; background:var(--color-emerald); border-radius:4px; transition:width 0.3s;"></div>
        </div>
        <span style="font-size:0.8rem; color:var(--text-secondary); white-space:nowrap;">${done}/${total} (${pct}%)</span>
    </div>`;
    sections.forEach(sec => {
        const items = currentHandoverChecklist.filter(c => c.section === sec);
        const secDone = items.filter(c => c.is_completed).length;
        html += `<div style="margin-bottom:10px;">
            <div style="font-size:0.8rem; font-weight:700; color:var(--text-primary); margin-bottom:4px; display:flex; justify-content:space-between;">
                <span>${escapeHtml(sec)}</span>
                <span style="color:var(--text-muted); font-weight:400;">${secDone}/${items.length}</span>
            </div>`;
        items.forEach(c => {
            html += `<label class="handover-checklist-item" style="display:flex; align-items:flex-start; gap:8px; padding:6px 8px; border-radius:6px; cursor:${canCreate && !isCompleted ? 'pointer' : 'default'}; ${c.is_completed ? 'opacity:0.7;' : ''}" onclick="${canCreate && !isCompleted ? `toggleChecklistItem('${c.id}', ${!c.is_completed}, '${handoverId}')` : ''}">
                <input type="checkbox" ${c.is_completed ? 'checked' : ''} ${!canCreate || isCompleted ? 'disabled' : ''} style="margin-top:2px; accent-color:var(--color-emerald);" onchange="${canCreate && !isCompleted ? `toggleChecklistItem('${c.id}', this.checked, '${handoverId}')` : ''}">
                <div style="flex:1;">
                    <div style="font-size:0.85rem; ${c.is_completed ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">${escapeHtml(c.item)}</div>
                    ${c.notes ? `<div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">${escapeHtml(c.notes)}</div>` : ''}
                </div>
            </label>`;
        });
        html += `</div>`;
    });
    container.innerHTML = html;

    // Detail actions
    const actionsDiv = document.getElementById('handover-detail-actions');
    let actionsHtml = '';
    if (canCreate && !isCompleted) {
        actionsHtml += `<button class="btn btn-sm btn-success" onclick="completeHandover('${handoverId}')"><i class="fa-solid fa-check-circle"></i> Mark Complete</button>`;
    }
    if (isCompleted && !ho.acknowledged_at) {
        actionsHtml += `<button class="btn btn-sm btn-primary" onclick="acknowledgeHandover('${handoverId}')"><i class="fa-solid fa-signature"></i> Acknowledge Receipt</button>`;
    }
    if (isCompleted) {
        actionsHtml += `<button class="btn btn-sm btn-slate" onclick="exportHandoverSummary('${handoverId}')"><i class="fa-solid fa-download"></i> Export Summary</button>`;
    }
    actionsDiv.innerHTML = actionsHtml;
}

window.toggleChecklistItem = async function(itemId, completed, handoverId) {
    if (!hasPermission('handover:create')) return;
    try {
        const updates = { is_completed: completed, completed_by: completed ? currentUserId : null, completed_at: completed ? new Date().toISOString() : null };
        const { error } = await sbClient.from('handover_checklist').update(updates).eq('id', itemId);
        if (error) throw error;
        // Update handover status to in_progress if it was draft
        if (completed) {
            await sbClient.from('committee_handovers').update({ status: 'in_progress' }).eq('id', handoverId).eq('status', 'draft');
        }
        await loadChecklist(handoverId);
        await loadHandovers();
    } catch (err) {
        showToast(err.message, 'error');
    }
};

window.completeHandover = async function(handoverId) {
    if (!hasPermission('handover:create')) { showToast("Access Denied.", "error"); return; }
    if (!confirm('Mark this handover as complete? All checklist items should be done before proceeding.')) return;
    try {
        const { error } = await sbClient.from('committee_handovers').update({ status: 'completed' }).eq('id', handoverId);
        if (error) throw error;
        showToast('Handover completed!', 'success');
        closeModal('handoverDetailModal');
        await loadHandovers();
    } catch (err) {
        showToast(err.message, 'error');
    }
};

window.acknowledgeHandover = async function(handoverId) {
    if (!hasPermission('handover:create')) { showToast("Access Denied.", "error"); return; }
    if (!confirm('Acknowledge receipt of all handover documents?')) return;
    try {
        const { error } = await sbClient.from('committee_handovers').update({
            acknowledged_by: currentUserId, acknowledged_at: new Date().toISOString()
        }).eq('id', handoverId);
        if (error) throw error;
        showToast('Handover acknowledged!', 'success');
        await loadChecklist(handoverId);
        await loadHandovers();
    } catch (err) {
        showToast(err.message, 'error');
    }
};

window.exportHandoverSummary = async function(handoverId) {
    const ho = allHandovers.find(h => h.id === handoverId);
    if (!ho) return;
    try {
        const { data: checklist } = await sbClient.from('handover_checklist').select('*').eq('handover_id', handoverId).order('sort_order', { ascending: true });
        const lines = [];
        lines.push('========================================');
        lines.push('  COMMITTEE HANDOVER SUMMARY');
        lines.push('========================================');
        lines.push(`  From Term: ${ho.from_term}`);
        lines.push(`  To Term:   ${ho.to_term}`);
        lines.push(`  Date:      ${new Date(ho.handover_date + 'T00:00:00').toLocaleDateString('en-IN')}`);
        lines.push(`  Status:    ${ho.status}`);
        if (ho.acknowledged_at) lines.push(`  Acknowledged: ${new Date(ho.acknowledged_at).toLocaleDateString('en-IN')}`);
        lines.push('');
        if (ho.notes) { lines.push('Notes:'); lines.push(`  ${ho.notes}`); lines.push(''); }
        lines.push('Checklist:');
        lines.push('----------------------------------------');
        const sections = [...new Set((checklist || []).map(c => c.section))];
        sections.forEach(sec => {
            const items = (checklist || []).filter(c => c.section === sec);
            const done = items.filter(c => c.is_completed).length;
            lines.push(`\n[${sec}] (${done}/${items.length})`);
            items.forEach(c => {
                lines.push(`  ${c.is_completed ? '[✓]' : '[ ]'} ${c.item}${c.notes ? ' — ' + c.notes : ''}`);
            });
        });
        lines.push('');
        lines.push('========================================');
        lines.push('  Generated: ' + new Date().toLocaleString('en-IN'));
        lines.push('========================================');

        const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `handover_${ho.from_term}_${ho.to_term}.txt`;
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('Summary exported!', 'success');
    } catch (err) {
        showToast('Failed to export summary.', 'error');
    }
};

