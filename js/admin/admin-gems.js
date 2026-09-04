/**
 * Nexco Edu - Module Admin Gems (AI Tools) Management
 * Menangani CRUD Direktori Tools & Gems AI.
 */

const AdminGemsModule = {
    renderGemsTable: function () {
        const container = document.getElementById('admin-gems-table-body');
        if (!container) return;

        const gems = window.appState.gems || [];
        const categories = window.appState.categories || [];

        if (gems.length === 0) {
            container.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-500">Belum ada Tools AI.</td></tr>`;
            return;
        }

        let html = '';
        gems.forEach((g, idx) => {
            const cat = categories.find(c => c.id === g.kategori_id);
            const catName = cat ? cat.nama : 'Umum';

            html += `
                <tr class="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td class="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">${idx + 1}</td>
                    <td class="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">${g.nama}</td>
                    <td class="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">${catName}</td>
                    <td class="px-4 py-3 text-sm text-indigo-600 dark:text-indigo-400 truncate max-w-xs">
                        <a href="${g.akses_url}" target="_blank" class="hover:underline">${g.akses_url}</a>
                    </td>
                    <td class="px-4 py-3 text-sm text-right space-x-2">
                        <button onclick="AdminGemsModule.deleteGem('${g.id}')" class="px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 rounded-lg hover:bg-rose-100">
                            <i class="fa-solid fa-trash mr-1"></i> Hapus
                        </button>
                    </td>
                </tr>
            `;
        });
        container.innerHTML = html;
    },

    saveGem: function (payload) {
        showLoader("Menyimpan Tool AI...");
        FirebaseService.saveGemOnServer(payload).then(res => {
            hideLoader();
            if (res.success) {
                showSuccessToast("Tool AI berhasil disimpan!");
                loadSystemBundledData(appState.currentUser ? appState.currentUser.id : null, () => {
                    AdminGemsModule.renderGemsTable();
                });
            } else {
                showErrorAlert(res.message);
            }
        });
    },

    deleteGem: function (id) {
        Swal.fire({
            title: 'Hapus Tool AI?',
            text: "Tool AI ini akan dihapus permanen.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#EF4444',
            confirmButtonText: 'Ya, Hapus!'
        }).then(res => {
            if (res.isConfirmed) {
                showLoader("Menghapus Tool AI...");
                FirebaseService.deleteGemOnServer(id).then(r => {
                    hideLoader();
                    if (r.success) {
                        showSuccessToast("Tool AI berhasil dihapus!");
                        loadSystemBundledData(appState.currentUser ? appState.currentUser.id : null, () => {
                            AdminGemsModule.renderGemsTable();
                        });
                    } else {
                        showErrorAlert(r.message);
                    }
                });
            }
        });
    }
};

window.AdminGemsModule = AdminGemsModule;
