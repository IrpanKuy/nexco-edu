/**
 * Nexco Edu - Module Admin Dashboard
 * Menangani tampilan statistik dan kartu ringkasan di portal Admin.
 */

const AdminDashboardModule = {
    render: function () {
        const state = window.appState;
        
        // Render total stats
        const totalUsersEl = document.getElementById('stat-total-users');
        const totalVideosEl = document.getElementById('stat-total-videos');
        const totalGemsEl = document.getElementById('stat-total-gems');
        const totalRequestsEl = document.getElementById('stat-total-requests');

        if (totalUsersEl) totalUsersEl.textContent = state.users ? state.users.length : 0;
        if (totalVideosEl) totalVideosEl.textContent = state.videos ? state.videos.length : 0;
        if (totalGemsEl) totalGemsEl.textContent = state.gems ? state.gems.length : 0;
        if (totalRequestsEl) totalRequestsEl.textContent = state.app_requests ? state.app_requests.length : 0;

        // Render recent app requests badge/list if exists
        const pendingRequests = (state.app_requests || []).filter(r => r.status === 'Pending').length;
        const badgeReq = document.getElementById('badge-pending-requests');
        if (badgeReq) {
            badgeReq.textContent = pendingRequests;
            badgeReq.style.display = pendingRequests > 0 ? 'inline-flex' : 'none';
        }
    }
};

window.AdminDashboardModule = AdminDashboardModule;
