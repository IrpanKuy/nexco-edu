/**
 * Nexco Edu - Module Admin App Requests Management
 * Menangani Manajemen Permohonan Aplikasi Custom dari Pengguna dan Pembaruan Status.
 */

const AdminAppRequestsModule = {
    renderAppRequestsTable: function () {
        const container = document.getElementById('admin-app-requests-table-body');
        if (!container) return;

        const requests = window.appState.app_requests || [];

        if (requests.length === 0) {
            container.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-slate-500">Belum ada request aplikasi.</td></tr>`;
            return;
        }

        let html = '';
        requests.forEach((r, idx) => {
            let statusBadge = '';
            if (r.status === 'Pending') {
                statusBadge = `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">Pending</span>`;
            } else if (r.status === 'Diproses') {
                statusBadge = `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">Diproses</span>`;
            } else if (r.status === 'Selesai') {
                statusBadge = `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">Selesai</span>`;
            } else {
                statusBadge = `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">Ditolak</span>`;
            }

            html += `
                <tr class="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td class="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">${idx + 1}</td>
                    <td class="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">${r.nama_pemohon}</td>
                    <td class="px-4 py-3 text-sm text-slate-900 dark:text-white font-medium">${r.judul_app}</td>
                    <td class="px-4 py-3 text-sm text-slate-500 truncate max-w-xs">${r.deskripsi_app}</td>
                    <td class="px-4 py-3 text-sm">${statusBadge}</td>
                    <td class="px-4 py-3 text-sm text-right space-x-1">
                        <select onchange="AdminAppRequestsModule.updateStatus('${r.id}', this.value)" class="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1">
                            <option value="Pending" ${r.status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="Diproses" ${r.status === 'Diproses' ? 'selected' : ''}>Diproses</option>
                            <option value="Selesai" ${r.status === 'Selesai' ? 'selected' : ''}>Selesai</option>
                            <option value="Ditolak" ${r.status === 'Ditolak' ? 'selected' : ''}>Ditolak</option>
                        </select>
                        <button onclick="AdminAppRequestsModule.deleteRequest('${r.id}')" class="px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 rounded-lg hover:bg-rose-100">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        container.innerHTML = html;
    },

    updateStatus: function (id, newStatus) {
        showLoader("Memperbarui Status Request...");
        FirebaseService.updateAppRequestStatusOnServer(id, newStatus).then(res => {
            hideLoader();
            if (res.success) {
                showSuccessToast("Status request berhasil diperbarui!");
                loadSystemBundledData(appState.currentUser ? appState.currentUser.id : null, () => {
                    AdminAppRequestsModule.renderAppRequestsTable();
                });
            } else {
                showErrorAlert(res.message);
            }
        });
    },

    deleteRequest: function (id) {
        Swal.fire({
            title: 'Hapus Permohonan Aplikasi?',
            text: "Request ini akan dihapus permanen.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#EF4444',
            confirmButtonText: 'Ya, Hapus!'
        }).then(res => {
            if (res.isConfirmed) {
                showLoader("Menghapus Request...");
                FirebaseService.deleteAppRequestOnServer(id).then(r => {
                    hideLoader();
                    if (r.success) {
                        showSuccessToast("Request berhasil dihapus!");
                        loadSystemBundledData(appState.currentUser ? appState.currentUser.id : null, () => {
                            AdminAppRequestsModule.renderAppRequestsTable();
                        });
                    } else {
                        showErrorAlert(r.message);
                    }
                });
            }
        });
    }
};

window.AdminAppRequestsModule = AdminAppRequestsModule;
