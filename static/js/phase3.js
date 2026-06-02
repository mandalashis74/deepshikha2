// ==========================================
// PHASE 3: DOCUMENT VAULT & COMPLIANCE CALENDAR
// ==========================================

// --- DOCUMENT VAULT ---
let allDocuments = [];

window.openDocumentsModal = async function() {
    if (!hasPermission('documents:view')) { showToast("Access Denied.", "error"); return; }
    openModal('documentsModal');
    const btn = document.getElementById('btn-upload-doc');
    if (btn) btn.style.display = hasPermission('documents:upload') ? '' : 'none';
    await loadDocuments();
};

async function loadDocuments() {
    const container = document.getElementById('documents-container');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
    try {
        const { data, error } = await sbClient.from('document_vault').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        allDocuments = data || [];
        renderDocuments('all');
    } catch (err) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--color-rose);">Failed to load documents.</div>';
    }
}

window.filterDocuments = function(category) {
    document.querySelectorAll('#doc-filter-pills .pill').forEach(p => p.classList.remove('active'));
    const btn = document.querySelector(`#doc-filter-pills [data-cat="${category}"]`);
    if (btn) btn.classList.add('active');
    renderDocuments(category);
};

function renderDocuments(category) {
    const container = document.getElementById('documents-container');
    if (!container) return;
    let docs = allDocuments;
    if (category !== 'all') docs = docs.filter(d => d.category === category);
    if (docs.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-folder-open"></i> No documents found.</div>';
        return;
    }
    const canDelete = hasPermission('documents:delete');
    container.innerHTML = docs.map(d => {
        const dateStr = new Date(d.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
        const icon = getDocIcon(d.file_type || d.file_url);
        const tags = (d.tags || []).filter(Boolean);
        return `<div class="doc-card">
            <div class="doc-icon">${icon}</div>
            <div class="doc-body">
                <div class="doc-title">${escapeHtml(d.title)}</div>
                ${d.description ? `<div class="doc-desc">${escapeHtml(d.description)}</div>` : ''}
                <div class="doc-meta">
                    <span class="doc-cat">${escapeHtml(d.category.replace(/_/g, ' '))}</span>
                    <span>v${d.version}</span>
                    <span>${dateStr}</span>
                    ${d.file_size ? `<span>${formatFileSize(d.file_size)}</span>` : ''}
                    ${tags.map(t => `<span class="doc-tag">${escapeHtml(t)}</span>`).join(' ')}
                </div>
                <div class="doc-card-actions">
                    <a href="${escapeHtml(d.file_url)}" target="_blank" class="btn btn-sm btn-primary"><i class="fa-solid fa-eye"></i> View</a>
                    ${canDelete ? `<button class="btn btn-sm btn-rose" onclick="deleteDocument('${d.id}')"><i class="fa-solid fa-trash"></i></button>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

function getDocIcon(fileType) {
    const ft = (fileType || '').toLowerCase();
    if (ft.includes('pdf')) return '<i class="fa-solid fa-file-pdf" style="color:var(--color-rose);"></i>';
    if (ft.includes('doc')) return '<i class="fa-solid fa-file-word" style="color:var(--color-indigo);"></i>';
    if (ft.includes('xls') || ft.includes('csv')) return '<i class="fa-solid fa-file-excel" style="color:var(--color-emerald);"></i>';
    if (ft.includes('jpg') || ft.includes('jpeg') || ft.includes('png') || ft.includes('gif')) return '<i class="fa-solid fa-file-image" style="color:var(--color-purple);"></i>';
    return '<i class="fa-solid fa-file-lines" style="color:var(--text-muted);"></i>';
}

function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

window.openUploadDocModal = function() {
    if (!hasPermission('documents:upload')) { showToast("Access Denied.", "error"); return; }
    document.getElementById('upload-doc-title').textContent = 'Upload Document';
    document.getElementById('edit-doc-id').value = '';
    document.getElementById('doc-title').value = '';
    document.getElementById('doc-description').value = '';
    document.getElementById('doc-category').value = 'legal';
    document.getElementById('doc-tags').value = '';
    document.getElementById('doc-file').value = '';
    document.getElementById('doc-url').value = '';
    openModal('uploadDocModal');
};

window.saveDocument = async function(e) {
    e.preventDefault();
    if (!sbClient || !hasPermission('documents:upload')) { showToast("Access Denied.", "error"); return; }
    const title = document.getElementById('doc-title').value.trim();
    const description = document.getElementById('doc-description').value.trim();
    const category = document.getElementById('doc-category').value;
    const tagsRaw = document.getElementById('doc-tags').value.trim();
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
    const fileInput = document.getElementById('doc-file');
    const urlInput = document.getElementById('doc-url').value.trim();
    const editId = document.getElementById('edit-doc-id').value;
    let fileUrl = urlInput;
    let fileSize = 0;
    let fileType = '';
    try {
        if (fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            fileType = file.type || file.name.split('.').pop();
            fileSize = file.size;
            const ext = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2,8)}.${ext}`;
            const { data: uploadData, error: uploadError } = await sbClient.storage.from('documents').upload(fileName, file, { upsert: false });
            if (uploadError) throw uploadError;
            const { data: urlData } = sbClient.storage.from('documents').getPublicUrl(fileName);
            fileUrl = urlData.publicUrl;
        }
        if (!fileUrl) { showToast('Please select a file or enter a URL.', 'error'); return; }
        if (editId) {
            const { error } = await sbClient.from('document_vault').update({ title, description, category, tags }).eq('id', editId);
            if (error) throw error;
            showToast('Document updated.', 'success');
        } else {
            const { error } = await sbClient.from('document_vault').insert({
                title, description, category, tags,
                file_url: fileUrl, file_size: fileSize, file_type: fileType,
                uploaded_by: currentUserId
            });
            if (error) throw error;
            showToast('Document uploaded!', 'success');
        }
        closeModal('uploadDocModal');
        await loadDocuments();
    } catch (err) {
        showToast(err.message || 'Failed to save document.', 'error');
    }
};

window.deleteDocument = async function(id) {
    if (!hasPermission('documents:delete')) { showToast("Access Denied.", "error"); return; }
    if (!confirm('Delete this document permanently?')) return;
    try {
        const { error } = await sbClient.from('document_vault').delete().eq('id', id);
        if (error) throw error;
        showToast('Document deleted.', 'success');
        await loadDocuments();
    } catch (err) {
        showToast(err.message, 'error');
    }
};

// --- COMPLIANCE CALENDAR ---
let allCompliance = [];

window.openComplianceModal = async function() {
    if (!hasPermission('compliance:view')) { showToast("Access Denied.", "error"); return; }
    openModal('complianceModal');
    const btn = document.getElementById('btn-create-compliance');
    if (btn) btn.style.display = hasPermission('compliance:create') ? '' : 'none';
    await loadCompliance();
};

async function loadCompliance() {
    const container = document.getElementById('compliance-container');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
    try {
        const { data, error } = await sbClient.from('compliance_calendar').select('*').order('due_date', { ascending: true });
        if (error) throw error;
        allCompliance = data || [];
        const today = new Date().toISOString().split('T')[0];
        for (const c of allCompliance) {
            if (c.status === 'pending' && c.due_date < today) {
                sbClient.from('compliance_calendar').update({ status: 'overdue' }).eq('id', c.id).then(() => {});
                c.status = 'overdue';
            }
        }
        renderCompliance('all');
    } catch (err) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--color-rose);">Failed to load compliance events.</div>';
    }
}

window.filterCompliance = function(status) {
    document.querySelectorAll('#comp-filter-pills .pill').forEach(p => p.classList.remove('active'));
    const btn = document.querySelector(`#comp-filter-pills [data-status="${status}"]`);
    if (btn) btn.classList.add('active');
    renderCompliance(status);
};

function renderCompliance(status) {
    const container = document.getElementById('compliance-container');
    if (!container) return;
    let items = allCompliance;
    if (status !== 'all') items = items.filter(c => c.status === status);
    if (items.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-calendar-check"></i> No compliance events found.</div>';
        return;
    }
    const canManage = hasPermission('compliance:manage');
    const canCreate = hasPermission('compliance:create');
    container.innerHTML = items.map(c => {
        const dueStr = new Date(c.due_date + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
        const isOverdue = c.status === 'overdue' || (c.status === 'pending' && c.due_date < new Date().toISOString().split('T')[0]);
        const statusColor = c.status === 'completed' ? 'var(--color-emerald)' : c.status === 'waived' ? 'var(--text-muted)' : isOverdue ? 'var(--color-rose)' : 'var(--color-yellow)';
        const daysLeft = Math.ceil((new Date(c.due_date + 'T23:59:59') - new Date()) / (1000*60*60*24));
        const daysStr = c.status === 'completed' ? '' : isOverdue ? `<span style="color:var(--color-rose);">${Math.abs(daysLeft)} days overdue</span>` :
            daysLeft <= (c.reminder_days || 7) ? `<span style="color:var(--color-yellow);">${daysLeft} days left</span>` : `${daysLeft} days left`;
        return `<div class="compliance-card ${c.status}">
            <div class="compliance-indicator" style="background:${statusColor};"></div>
            <div class="compliance-body">
                <div class="compliance-top">
                    <div class="compliance-title">${escapeHtml(c.title)}</div>
                    <div class="compliance-status-badge" style="background:${statusColor}20; color:${statusColor};">${c.status}</div>
                </div>
                ${c.description ? `<div class="compliance-desc">${escapeHtml(c.description)}</div>` : ''}
                <div class="compliance-meta">
                    <span><i class="fa-solid fa-calendar"></i> ${dueStr}</span>
                    <span class="compliance-cat">${escapeHtml(c.category.replace(/_/g, ' '))}</span>
                    ${daysStr ? `<span>${daysStr}</span>` : ''}
                    ${c.recurring ? `<span><i class="fa-solid fa-rotate"></i> ${c.recurrence_pattern}</span>` : ''}
                </div>
                <div class="compliance-card-actions">
                    ${canManage && c.status !== 'completed' ? `<button class="btn btn-sm btn-success" onclick="markComplianceComplete('${c.id}')"><i class="fa-solid fa-check"></i> Complete</button>` : ''}
                    ${canManage && c.status === 'completed' ? `<button class="btn btn-sm btn-slate" onclick="markCompliancePending('${c.id}')"><i class="fa-solid fa-rotate-left"></i> Reopen</button>` : ''}
                    ${canCreate ? `<button class="btn btn-sm btn-slate" onclick="editCompliance('${c.id}')"><i class="fa-solid fa-pen"></i></button>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

window.openCreateComplianceModal = function(data = null) {
    if (!hasPermission('compliance:create')) { showToast("Access Denied.", "error"); return; }
    document.getElementById('create-compliance-title').textContent = data ? 'Edit Compliance Event' : 'New Compliance Event';
    document.getElementById('edit-compliance-id').value = data ? data.id : '';
    document.getElementById('comp-title').value = data ? data.title : '';
    document.getElementById('comp-description').value = data ? data.description : '';
    document.getElementById('comp-category').value = data ? data.category : 'government_filing';
    document.getElementById('comp-due-date').value = data ? data.due_date : '';
    document.getElementById('comp-reminder').value = data ? (data.reminder_days || 7) : 7;
    const recurring = data ? (data.recurring ? 'true' : 'false') : 'false';
    document.getElementById('comp-recurring').value = recurring;
    document.getElementById('comp-recurrence-pattern').style.display = recurring === 'true' ? '' : 'none';
    document.getElementById('comp-recurrence').value = data ? (data.recurrence_pattern || 'yearly') : 'yearly';
    openModal('createComplianceModal');
};

window.saveCompliance = async function(e) {
    e.preventDefault();
    if (!sbClient || !hasPermission('compliance:create')) { showToast("Access Denied.", "error"); return; }
    const id = document.getElementById('edit-compliance-id').value;
    const data = {
        title: document.getElementById('comp-title').value.trim(),
        description: document.getElementById('comp-description').value.trim(),
        category: document.getElementById('comp-category').value,
        due_date: document.getElementById('comp-due-date').value,
        reminder_days: parseInt(document.getElementById('comp-reminder').value) || 7,
        recurring: document.getElementById('comp-recurring').value === 'true',
        recurrence_pattern: document.getElementById('comp-recurring').value === 'true' ? document.getElementById('comp-recurrence').value : ''
    };
    try {
        if (id) {
            const { error } = await sbClient.from('compliance_calendar').update(data).eq('id', id);
            if (error) throw error;
            showToast('Compliance event updated.', 'success');
        } else {
            data.created_by = currentUserId;
            const { error } = await sbClient.from('compliance_calendar').insert(data);
            if (error) throw error;
            showToast('Compliance event created!', 'success');
        }
        closeModal('createComplianceModal');
        await loadCompliance();
    } catch (err) {
        showToast(err.message || 'Failed to save compliance event.', 'error');
    }
};

window.markComplianceComplete = async function(id) {
    if (!hasPermission('compliance:manage')) { showToast("Access Denied.", "error"); return; }
    try {
        const { error } = await sbClient.from('compliance_calendar').update({
            status: 'completed', completed_at: new Date().toISOString(), completed_by: currentUserId
        }).eq('id', id);
        if (error) throw error;
        showToast('Marked as completed!', 'success');
        const item = allCompliance.find(c => c.id === id);
        if (item && item.recurring && item.recurrence_pattern) {
            const nextDate = calcNextDate(item.due_date, item.recurrence_pattern);
            if (nextDate) {
                await sbClient.from('compliance_calendar').insert({
                    title: item.title, description: item.description, category: item.category,
                    due_date: nextDate, status: 'pending', reminder_days: item.reminder_days,
                    recurring: true, recurrence_pattern: item.recurrence_pattern, created_by: currentUserId
                });
            }
        }
        await loadCompliance();
    } catch (err) {
        showToast(err.message, 'error');
    }
};

window.markCompliancePending = async function(id) {
    if (!hasPermission('compliance:manage')) { showToast("Access Denied.", "error"); return; }
    try {
        const { error } = await sbClient.from('compliance_calendar').update({
            status: 'pending', completed_at: null, completed_by: null
        }).eq('id', id);
        if (error) throw error;
        showToast('Reopened.', 'success');
        await loadCompliance();
    } catch (err) {
        showToast(err.message, 'error');
    }
};

window.editCompliance = function(id) {
    const item = allCompliance.find(c => c.id === id);
    if (item) openCreateComplianceModal(item);
};

function calcNextDate(currentDate, pattern) {
    const d = new Date(currentDate + 'T00:00:00');
    if (pattern === 'yearly') d.setFullYear(d.getFullYear() + 1);
    else if (pattern === 'monthly') d.setMonth(d.getMonth() + 1);
    else if (pattern === 'quarterly') d.setMonth(d.getMonth() + 3);
    else return null;
    return d.toISOString().split('T')[0];
}

