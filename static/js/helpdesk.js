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

