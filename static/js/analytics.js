// ==========================================
// PHASE 5: ADMIN DASHBOARD ANALYTICS
// ==========================================

window.openAnalyticsModal = async function() {
    if (!hasPermission('analytics:view')) { showToast("Access Denied.", "error"); return; }
    openModal('analyticsModal');
    await loadAnalytics();
};

async function loadAnalytics() {
    const container = document.getElementById('analytics-container');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading analytics...</div>';
    try {
        // Gather all module data in parallel
        const [
            incRes, expRes, ticketsRes, complianceRes,
            ownersRes, vendorsRes, meetingsRes, pollsRes,
            parkingRes, assetsRes, visitorsRes
        ] = await Promise.all([
            sbClient.from('income').select('amount, date_received, category'),
            sbClient.from('expenses').select('amount, date_spent, expense_head'),
            sbClient.from('tickets').select('status'),
            sbClient.from('compliance_calendar').select('status, due_date'),
            sbClient.from('owners').select('occupancy_status'),
            sbClient.from('vendors').select('status'),
            sbClient.from('meetings').select('status'),
            sbClient.from('polls').select('status'),
            sbClient.from('parking_slots').select('status'),
            sbClient.from('assets').select('status'),
            sbClient.from('visitor_passes').select('status')
        ]);

        // Compute stats
        const income = incRes.data || [];
        const expenses = expRes.data || [];
        const tickets = ticketsRes.data || [];
        const compliance = complianceRes.data || [];
        const owners = ownersRes.data || [];

        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();

        // Monthly income/expense for chart
        const monthlyIncome = Array(12).fill(0);
        const monthlyExpense = Array(12).fill(0);
        const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

        income.forEach(i => {
            if (i.date_received) {
                const d = new Date(i.date_received + 'T00:00:00');
                const monthIdx = d.getMonth();
                monthlyIncome[monthIdx] += parseFloat(i.amount) || 0;
            }
        });
        expenses.forEach(e => {
            if (e.date_spent) {
                const d = new Date(e.date_spent + 'T00:00:00');
                const monthIdx = d.getMonth();
                monthlyExpense[monthIdx] += parseFloat(e.amount) || 0;
            }
        });

        // Summary cards
        const monthIncome = income.filter(i => {
            if (!i.date_received) return false;
            const d = new Date(i.date_received + 'T00:00:00');
            return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
        }).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

        const monthExpense = expenses.filter(e => {
            if (!e.date_spent) return false;
            const d = new Date(e.date_spent + 'T00:00:00');
            return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
        }).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

        const pendingTickets = tickets.filter(t => t.status === 'open' || t.status === 'pending').length;
        const upcomingCompliance = compliance.filter(c => c.status === 'pending' && c.due_date).length;
        const overdueCompliance = compliance.filter(c => c.status === 'overdue').length;
        const occupiedUnits = owners.filter(o => o.occupancy_status === 'occupied' || !o.occupancy_status).length;
        const vacantUnits = owners.filter(o => o.occupancy_status === 'vacant').length;
        const totalOwners = owners.length;

        // Build HTML
        const formatCurr = (n) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

        let html = `
        <!-- Summary Cards Row -->
        <div class="analytics-grid">
            <div class="analytics-card" style="border-left-color:var(--color-emerald);">
                <div class="analytics-card-icon" style="background:rgba(16,185,129,0.1);"><i class="fa-solid fa-hand-holding-dollar" style="color:var(--color-emerald);"></i></div>
                <div class="analytics-card-body">
                    <div class="analytics-card-value">${formatCurr(monthIncome)}</div>
                    <div class="analytics-card-label">Income This Month</div>
                </div>
            </div>
            <div class="analytics-card" style="border-left-color:var(--color-rose);">
                <div class="analytics-card-icon" style="background:rgba(244,63,94,0.1);"><i class="fa-solid fa-money-bill-transfer" style="color:var(--color-rose);"></i></div>
                <div class="analytics-card-body">
                    <div class="analytics-card-value">${formatCurr(monthExpense)}</div>
                    <div class="analytics-card-label">Expense This Month</div>
                </div>
            </div>
            <div class="analytics-card" style="border-left-color:var(--color-yellow);">
                <div class="analytics-card-icon" style="background:rgba(234,179,8,0.1);"><i class="fa-solid fa-ticket" style="color:var(--color-yellow);"></i></div>
                <div class="analytics-card-body">
                    <div class="analytics-card-value">${pendingTickets}</div>
                    <div class="analytics-card-label">Open Tickets</div>
                </div>
            </div>
            <div class="analytics-card" style="border-left-color:var(--color-indigo);">
                <div class="analytics-card-icon" style="background:rgba(99,102,241,0.1);"><i class="fa-solid fa-calendar-check" style="color:var(--color-indigo);"></i></div>
                <div class="analytics-card-body">
                    <div class="analytics-card-value">${upcomingCompliance} <span style="font-size:0.7rem;color:var(--color-rose);">${overdueCompliance > 0 ? '(' + overdueCompliance + ' overdue)' : ''}</span></div>
                    <div class="analytics-card-label">Compliance Due</div>
                </div>
            </div>
        </div>

        <!-- Chart + Stats Row -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:16px;">
            <div class="analytics-chart-card">
                <h3 style="font-size:0.9rem; font-weight:700; margin-bottom:8px;"><i class="fa-solid fa-chart-bar"></i> Monthly Income vs Expense</h3>
                <div style="display:flex; gap:4px; align-items:flex-end; height:160px; padding:8px 0;">
                    ${monthLabels.map((lbl, i) => {
                        const maxVal = Math.max(...monthlyIncome, ...monthlyExpense, 1);
                        const ih = Math.round((monthlyIncome[i] / maxVal) * 140);
                        const eh = Math.round((monthlyExpense[i] / maxVal) * 140);
                        return `<div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:2px; height:100%; justify-content:flex-end;">
                            <div style="width:100%; display:flex; gap:2px; align-items:flex-end; justify-content:center;">
                                <div style="width:40%; background:var(--color-emerald); border-radius:3px 3px 0 0; height:${ih}px; min-height:${monthlyIncome[i] > 0 ? '4px' : '0'}; transition:height 0.3s;" title="Income: ${formatCurr(monthlyIncome[i])}"></div>
                                <div style="width:40%; background:var(--color-rose); border-radius:3px 3px 0 0; height:${eh}px; min-height:${monthlyExpense[i] > 0 ? '4px' : '0'}; transition:height 0.3s;" title="Expense: ${formatCurr(monthlyExpense[i])}"></div>
                            </div>
                            <span style="font-size:0.55rem; color:var(--text-muted);">${lbl}</span>
                        </div>`;
                    }).join('')}
                </div>
                <div style="display:flex; gap:16px; font-size:0.72rem; color:var(--text-muted); justify-content:center;">
                    <span><span style="display:inline-block; width:10px; height:10px; background:var(--color-emerald); border-radius:2px; margin-right:4px;"></span> Income</span>
                    <span><span style="display:inline-block; width:10px; height:10px; background:var(--color-rose); border-radius:2px; margin-right:4px;"></span> Expense</span>
                </div>
                <div style="margin-top:8px; font-size:0.78rem; color:var(--text-secondary); text-align:center;">
                    Total Income: ${formatCurr(monthlyIncome.reduce((a,b) => a+b, 0))} &middot; Total Expense: ${formatCurr(monthlyExpense.reduce((a,b) => a+b, 0))}
                </div>
            </div>
            <div class="analytics-chart-card">
                <h3 style="font-size:0.9rem; font-weight:700; margin-bottom:8px;"><i class="fa-solid fa-building"></i> Occupancy</h3>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="flex:1;">
                            <div style="display:flex; justify-content:space-between; font-size:0.78rem; margin-bottom:2px;">
                                <span>Occupied</span><span>${occupiedUnits} / ${totalOwners}</span>
                            </div>
                            <div style="height:20px; background:var(--border-color); border-radius:4px; overflow:hidden;">
                                <div style="height:100%; width:${totalOwners > 0 ? Math.round(occupiedUnits/totalOwners*100) : 0}%; background:var(--color-emerald); border-radius:4px; transition:width 0.3s;"></div>
                            </div>
                        </div>
                        <span style="font-size:1.2rem; font-weight:700; color:var(--color-emerald);">${totalOwners > 0 ? Math.round(occupiedUnits/totalOwners*100) : 0}%</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="flex:1;">
                            <div style="display:flex; justify-content:space-between; font-size:0.78rem; margin-bottom:2px;">
                                <span>Vacant</span><span>${vacantUnits} / ${totalOwners}</span>
                            </div>
                            <div style="height:20px; background:var(--border-color); border-radius:4px; overflow:hidden;">
                                <div style="height:100%; width:${totalOwners > 0 ? Math.round(vacantUnits/totalOwners*100) : 0}%; background:var(--color-rose); border-radius:4px; transition:width 0.3s;"></div>
                            </div>
                        </div>
                        <span style="font-size:1.2rem; font-weight:700; color:var(--color-rose);">${totalOwners > 0 ? Math.round(vacantUnits/totalOwners*100) : 0}%</span>
                    </div>
                </div>
                <h3 style="font-size:0.9rem; font-weight:700; margin:16px 0 8px;"><i class="fa-solid fa-cubes"></i> Module Overview</h3>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:0.78rem;">
                    <div class="analytics-stat-row"><span>Vendors</span><span>${(vendorsRes.data || []).length} (${(vendorsRes.data || []).filter(v => v.status === 'active').length} active)</span></div>
                    <div class="analytics-stat-row"><span>Meetings</span><span>${(meetingsRes.data || []).length} (${(meetingsRes.data || []).filter(m => m.status === 'completed').length} done)</span></div>
                    <div class="analytics-stat-row"><span>Polls</span><span>${(pollsRes.data || []).length} (${(pollsRes.data || []).filter(p => p.status === 'active').length} active)</span></div>
                    <div class="analytics-stat-row"><span>Parking Slots</span><span>${(parkingRes.data || []).length} (${(parkingRes.data || []).filter(s => s.status === 'allotted').length} allotted)</span></div>
                    <div class="analytics-stat-row"><span>Assets</span><span>${(assetsRes.data || []).length} (${(assetsRes.data || []).filter(a => a.status === 'operational').length} OK)</span></div>
                    <div class="analytics-stat-row"><span>Visitor Passes</span><span>${(visitorsRes.data || []).length} total</span></div>
                </div>
            </div>
        </div>

        <!-- Compliance Quick View -->
        <div class="analytics-chart-card" style="margin-top:12px;">
            <h3 style="font-size:0.9rem; font-weight:700; margin-bottom:8px;"><i class="fa-solid fa-clipboard-list"></i> Compliance Status</h3>
            <div style="display:flex; gap:12px; flex-wrap:wrap;">
                ${['pending','completed','overdue','waived'].map(st => {
                    const count = compliance.filter(c => c.status === st).length;
                    const colors = { pending:'var(--color-yellow)', completed:'var(--color-emerald)', overdue:'var(--color-rose)', waived:'var(--text-muted)' };
                    return `<div style="flex:1; min-width:100px; text-align:center; padding:12px; border:1px solid var(--border-color); border-radius:8px;">
                        <div style="font-size:1.3rem; font-weight:800; color:${colors[st]};">${count}</div>
                        <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.3px;">${st}</div>
                    </div>`;
                }).join('')}
            </div>
        </div>

        <!-- Recent activity summary -->
        <div class="analytics-chart-card" style="margin-top:12px;">
            <h3 style="font-size:0.9rem; font-weight:700; margin-bottom:8px;"><i class="fa-solid fa-clock-rotate-left"></i> At a Glance</h3>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:8px; font-size:0.78rem;">
                <div class="analytics-stat-row"><span>Total Income (YTD)</span><span>${formatCurr(monthlyIncome.reduce((a,b) => a+b, 0))}</span></div>
                <div class="analytics-stat-row"><span>Total Expense (YTD)</span><span>${formatCurr(monthlyExpense.reduce((a,b) => a+b, 0))}</span></div>
                <div class="analytics-stat-row"><span>Net (YTD)</span><span style="color:${monthlyIncome.reduce((a,b) => a+b, 0) >= monthlyExpense.reduce((a,b) => a+b, 0) ? 'var(--color-emerald)' : 'var(--color-rose)'};">${formatCurr(monthlyIncome.reduce((a,b) => a+b, 0) - monthlyExpense.reduce((a,b) => a+b, 0))}</span></div>
                <div class="analytics-stat-row"><span>Total Tickets</span><span>${tickets.length}</span></div>
            </div>
        </div>
        `;
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--color-rose);">Failed to load analytics.</div>';
        console.error(err);
    }
}

