/**
 * Nexco Edu - Module Admin Prompts Management
 * Menangani CRUD Prompt Engineering Library.
 */

const AdminPromptsModule = {
    renderPromptsTable: function () {
        const container = document.getElementById('admin-prompts-table-body');
        if (!container) return;

        const prompts = window.appState.prompts || [];
        const categories = window.appState.categories || [];

        if (prompts.length === 0) {
            container.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-500">Belum ada Prompt Template.</td></tr>`;
            return;
        }

        let html = '';
        prompts.forEach((p, idx) => {
            const cat = categories.find(c => c.id === p.kategori_id);
            const catName = cat ? cat.nama : 'Umum';

            html += `
                <tr class="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td class="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">${idx + 1}</td>
                    <td class="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">${p.judul}</td>
                    <td class="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">${catName}</td>
                    <td class="px-4 py-3 text-sm text-slate-500 truncate max-w-xs">${p.deskripsi}</td>
                    <td class="px-4 py-3 text-sm text-right space-x-2">
                        <button onclick="AdminPromptsModule.deletePrompt('${p.id}')" class="px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 rounded-lg hover:bg-rose-100">
                            <i class="fa-solid fa-trash mr-1"></i> Hapus
                        </button>
                    </td>
                </tr>
            `;
        });
        container.innerHTML = html;
    },

    savePrompt: function (payload) {
        showLoader("Menyimpan Prompt...");
        FirebaseService.savePromptOnServer(payload).then(res => {
            hideLoader();
            if (res.success) {
                showSuccessToast("Prompt berhasil disimpan!");
                loadSystemBundledData(appState.currentUser ? appState.currentUser.id : null, () => {
                    AdminPromptsModule.renderPromptsTable();
                });
            } else {
                showErrorAlert(res.message);
            }
        });
    },

    deletePrompt: function (id) {
        Swal.fire({
            title: 'Hapus Prompt Template?',
            text: "Prompt ini akan dihapus permanen.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#EF4444',
            confirmButtonText: 'Ya, Hapus!'
        }).then(res => {
            if (res.isConfirmed) {
                showLoader("Menghapus Prompt...");
                FirebaseService.deletePromptOnServer(id).then(r => {
                    hideLoader();
                    if (r.success) {
                        showSuccessToast("Prompt berhasil dihapus!");
                        loadSystemBundledData(appState.currentUser ? appState.currentUser.id : null, () => {
                            AdminPromptsModule.renderPromptsTable();
                        });
                    } else {
                        showErrorAlert(r.message);
                    }
                });
            }
        });
    }
};

window.AdminPromptsModule = AdminPromptsModule;
