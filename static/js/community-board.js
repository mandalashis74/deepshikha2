// ==========================================
// COMMUNITY BOARD
// ==========================================
const BOARD_CATEGORIES = [
    { slug: 'classifieds', name: 'Classifieds', icon: 'fa-cart-shopping', tags: ['Selling', 'Rent out', 'Looking for'] },
    { slug: 'recommendations', name: 'Recommendations', icon: 'fa-thumbs-up', tags: ['Offering', 'Requesting'] },
    { slug: 'carpooling', name: 'Carpooling', icon: 'fa-car', tags: ['Offering ride', 'Looking for ride'] },
    { slug: 'hobbies', name: 'Hobbies & Clubs', icon: 'fa-baseball', tags: [] }
];
let currentBoardCategory = 'all';
let currentBoardTag = '';
let boardAllPosts = [];
let boardMyUpvotes = new Set();

window.openBoardModal = async function() {
    if (!hasPermission('board:view')) {
        showToast("Access Denied.", "error");
        return;
    }
    unsubscribeReplies();
    openModal('boardModal');
    await loadBoardCategories();
};

window.loadBoardCategories = function() {
    const container = document.getElementById('board-category-tabs');
    if (!container) return;
    let html = `<button class="board-tab ${currentBoardCategory === 'all' ? 'active' : ''}" onclick="switchBoardCategory('all')">
        <i class="fa-solid fa-layer-group"></i> All Posts
    </button>`;
    html += BOARD_CATEGORIES.map(c =>
        `<button class="board-tab ${currentBoardCategory === c.slug ? 'active' : ''}" onclick="switchBoardCategory('${c.slug}')">
            <i class="fa-solid ${c.icon}"></i> ${c.name}
        </button>`
    ).join('');
    container.innerHTML = html;
    updateFilterPills(currentBoardCategory);
    loadBoardPosts();
};

window.switchBoardCategory = function(slug) {
    currentBoardCategory = slug;
    currentBoardTag = '';
    loadBoardCategories();
};

window.updateFilterPills = function(slug) {
    const container = document.getElementById('board-filter-pills');
    if (!container) return;
    if (slug === 'all') {
        container.innerHTML = '';
        return;
    }
    const cat = BOARD_CATEGORIES.find(c => c.slug === slug);
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
            .in('status', ['active', 'closed']);
        if (currentBoardCategory !== 'all') {
            q = q.eq('category_slug', currentBoardCategory);
        }
        q = q.order('created_at', { ascending: false });
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
    const authorDisplay = post.is_anonymous ? 'Verified Resident (Anonymous)' : (window.displayStructured(post.owner_name, 'name') || 'Resident');
    const isClosed = post.status === 'closed';
    const priceHtml = post.price ? `<div class="board-meta-row"><span class="board-price"><i class="fa-solid fa-indian-rupee-sign"></i> ${Number(post.price).toLocaleString()}${post.tag === 'Selling' || post.tag === 'Rent out' ? '' : ''}</span></div>` : '';
    const tagBadge = post.tag ? `<span class="board-tag">${post.tag}</span>` : '';
    const replyCount = post.reply_count || 0;
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
            <button class="board-chat-btn" onclick="toggleReplies('${post.id}', this)">
                <i class="fa-solid fa-comment"></i> <span class="reply-count">${replyCount}</span> Chat / Reply
            </button>
        </div>
        <div id="board-replies-${post.id}" class="board-replies-container" style="display:none;"></div>
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

window.toggleReplies = function(postId, btnEl) {
    const container = document.getElementById('board-replies-' + postId);
    if (!container) return;
    if (container.style.display === 'block') {
        container.style.display = 'none';
        unsubscribeReplies();
        return;
    }
    container.style.display = 'block';
    subscribeToReplies(postId);
    if (!container.dataset.loaded) {
        loadReplies(postId);
    }
};

let boardRepliesCache = {};
let replySubscription = null;

function subscribeToReplies(postId) {
    if (replySubscription) replySubscription.unsubscribe();
    replySubscription = sbClient.channel('replies-' + postId)
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'community_replies', filter: 'post_id=eq.' + postId },
            async (payload) => {
                if (!boardRepliesCache[postId]) boardRepliesCache[postId] = [];
                if (!boardRepliesCache[postId].find(r => r.id === payload.new.id)) {
                    boardRepliesCache[postId].push(payload.new);
                    renderReplies(postId);
                    const container = document.getElementById('board-replies-' + postId);
                    if (container) {
                        const postEl = container.closest('.board-card');
                        if (postEl) {
                            const countSpan = postEl.querySelector('.reply-count');
                            if (countSpan) countSpan.textContent = parseInt(countSpan.textContent) + 1;
                        }
                    }
                }
            }
        )
        .subscribe();
}

function unsubscribeReplies() {
    if (replySubscription) {
        replySubscription.unsubscribe();
        replySubscription = null;
    }
}

window.loadReplies = async function(postId) {
    const container = document.getElementById('board-replies-' + postId);
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:16px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading replies...</div>';
    try {
        let { data, error } = await sbClient.from('community_replies')
            .select('*')
            .eq('post_id', postId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        boardRepliesCache[postId] = data || [];
        container.dataset.loaded = '1';
        renderReplies(postId);
    } catch (err) {
        console.error('loadReplies error:', err);
        container.innerHTML = '<div style="text-align:center; padding:16px; color:var(--color-rose);">Failed to load replies.</div>';
    }
};

function renderReplies(postId) {
    const container = document.getElementById('board-replies-' + postId);
    if (!container) return;
    const replies = boardRepliesCache[postId] || [];
    const isSoftLogin = localStorage.getItem("isSoftLogin") === "true";
    const myFlat = localStorage.getItem("currentFlatNo") || '';
    let listHtml = '';
    if (replies.length === 0) {
        listHtml = '<div style="text-align:center; padding:12px; color:var(--text-muted); font-size:0.8rem;">No replies yet. Be the first to reply!</div>';
    } else {
        replies.forEach(r => {
            const author = r.is_anonymous ? 'Anonymous' : (window.displayStructured(r.owner_name, 'name') || 'Resident');
            const flatInfo = r.is_anonymous ? '' : ` (${r.owner_flat_no || '-'})`;
            const isMine = isSoftLogin && r.owner_flat_no === myFlat;
            const timeAgo = formatRelativeTime(r.created_at);
            listHtml += `<div class="board-reply-item${isMine ? ' mine' : ''}">
                <div class="board-reply-header">
                    <span class="board-reply-author"><i class="fa-solid fa-user"></i> ${author}${flatInfo}</span>
                    <span class="board-reply-time">${timeAgo}</span>
                </div>
                <div class="board-reply-text">${escapeHtml(r.reply_text)}</div>
            </div>`;
        });
    }
    container.innerHTML = `
        <div class="board-replies-inner">
            <div class="board-replies-scroll">${listHtml}</div>
            <div class="board-reply-form">
                <textarea class="board-reply-input" id="reply-input-${postId}" placeholder="Write a reply..." rows="2"></textarea>
                <button class="btn btn-indigo" onclick="submitReply('${postId}')" style="font-size:0.75rem; padding:6px 14px; align-self:flex-end;">
                    <i class="fa-solid fa-paper-plane"></i> Reply
                </button>
            </div>
        </div>
    `;
}

window.submitReply = async function(postId) {
    if (!currentUserId) { showToast('Please log in to reply.', 'error'); return; }
    const input = document.getElementById('reply-input-' + postId);
    if (!input) return;
    const text = input.value.trim();
    if (!text) { showToast('Please write a reply.', 'error'); return; }
    input.disabled = true;
    try {
        const isSoftLogin = localStorage.getItem("isSoftLogin") === "true";
        const myFlat = localStorage.getItem("currentFlatNo") || '';
        let ownerName = null;
        if (isSoftLogin) {
            const { data: ownerData } = await sbClient.from('owners')
                .select('owner_name').eq('flat_no', myFlat).maybeSingle();
            if (ownerData) ownerName = ownerData.owner_name;
        }
        const { data: insertedReply, error } = await sbClient.from('community_replies').insert({
            post_id: postId,
            user_id: currentUserId,
            reply_text: text,
            owner_flat_no: isSoftLogin ? myFlat : null,
            owner_name: ownerName,
            is_anonymous: false
        }).select().single();
        if (error) throw error;
        const { data: postData } = await sbClient.from('community_posts').select('reply_count').eq('id', postId).single();
        const newCount = (postData?.reply_count || 0) + 1;
        await sbClient.from('community_posts').update({ reply_count: newCount }).eq('id', postId);
        const container = document.getElementById('board-replies-' + postId);
        if (!boardRepliesCache[postId]) boardRepliesCache[postId] = [];
        boardRepliesCache[postId].push(insertedReply);
        renderReplies(postId);
        const postEl = container ? container.closest('.board-card') : null;
        if (postEl) {
            const countSpan = postEl.querySelector('.reply-count');
            if (countSpan) countSpan.textContent = newCount;
        }
        showToast('Reply posted!', 'success');
    } catch (err) {
        console.error('submitReply error:', err);
        showToast('Failed to post reply.', 'error');
        input.disabled = false;
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
        if (data?.owner_name) ownerName = window.displayStructured(data.owner_name, 'name');
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
    const { isConfirmed: close } = await Swal.fire({ title: 'Confirm', text: 'Mark this post as closed?', icon: 'question', showCancelButton: true, confirmButtonColor: '#f59e0b', confirmButtonText: 'Close', cancelButtonText: 'Cancel' });
    if (!close) return;
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
    const { isConfirmed: delPost } = await Swal.fire({ title: 'Confirm', text: 'Delete this post permanently?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc2626', confirmButtonText: 'Delete', cancelButtonText: 'Cancel' });
    if (!delPost) return;
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

