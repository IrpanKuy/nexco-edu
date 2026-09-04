/**
 * Nexco Edu - Module Admin Users Management
 * Menangani manajemen CRUD Pengguna, Peran (Admin/User), dan Hak Akses (Category Template).
 */

const AdminUsersModule = {
    renderUsersTable: function () {
        const container = document.getElementById('admin-users-table-body');
        if (!container) return;

        const users = window.appState.users || [];
        const templates = window.appState.category_templates || [];

        if (users.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="5" class="py-8 text-center text-slate-500 dark:text-slate-400">
                        <i class="fa-solid fa-users-slash text-3xl mb-2"></i>
                        <p>Belum ada data pengguna.</p>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        users.forEach((u, index) => {
            const tpl = templates.find(t => t.id === u.category_template_id);
            const templateName = tpl ? tpl.nama : (u.role === 'admin' ? 'Akses Penuh (Admin)' : 'Tanpa Paket');
            const roleBadge = u.role === 'admin'
                ? `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">Admin</span>`
                : `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">Siswa / User</span>`;

            html += `
                <tr class="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td class="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">${index + 1}</td>
                    <td class="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">
                        <div>${u.nama}</div>
                        <div class="text-xs font-normal text-slate-500 dark:text-slate-400">${u.email}</div>
                    </td>
                    <td class="px-4 py-3 text-sm">${roleBadge}</td>
                    <td class="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 font-medium">${templateName}</td>
                    <td class="px-4 py-3 text-sm text-right space-x-2">
                        <button onclick="AdminUsersModule.openEditUserModal('${u.id}')" class="px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg hover:bg-indigo-100 transition-colors">
                            <i class="fa-solid fa-pen-to-square mr-1"></i> Edit
                        </button>
                        <button onclick="AdminUsersModule.deleteUser('${u.id}')" class="px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 rounded-lg hover:bg-rose-100 transition-colors">
                            <i class="fa-solid fa-trash mr-1"></i> Hapus
                        </button>
                    </td>
                </tr>
            `;
        });

        container.innerHTML = html;
    },

    saveUser: function (payload) {
        showLoader("Menyimpan Pengguna...");
        FirebaseService.saveUserOnServer(payload).then(res => {
            hideLoader();
            if (res.success) {
                showSuccessToast(res.message || "Pengguna berhasil disimpan!");
                loadSystemBundledData(appState.currentUser ? appState.currentUser.id : null, () => {
                    AdminUsersModule.renderUsersTable();
                });
            } else {
                showErrorAlert(res.message);
            }
        });
    },

    deleteUser: function (userId) {
        if (appState.currentUser && appState.currentUser.id === userId) {
            showErrorAlert("Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.");
            return;
        }

        Swal.fire({
            title: 'Hapus Akun Pengguna?',
            text: "Akun ini akan dihapus secara permanen dari sistem.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#EF4444',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal'
        }).then((result) => {
            if (result.isConfirmed) {
                showLoader("Menghapus Pengguna...");
                FirebaseService.deleteUserOnServer(userId, appState.currentUser ? appState.currentUser.id : null).then(res => {
                    hideLoader();
                    if (res.success) {
                        showSuccessToast("Pengguna berhasil dihapus!");
                        loadSystemBundledData(appState.currentUser ? appState.currentUser.id : null, () => {
                            AdminUsersModule.renderUsersTable();
                        });
                    } else {
                        showErrorAlert(res.message);
                    }
                });
            }
        });
    }
};

window.AdminUsersModule = AdminUsersModule;
