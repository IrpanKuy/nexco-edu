/**
 * Nexco Edu - Module Admin Templates Management
 * Menangani CRUD App Showcase Templates Katalog.
 */

const AdminTemplatesModule = {
    renderTemplatesTable: function () {
        const container = document.getElementById('admin-templates-table-body');
        if (!container) return;

        const templates = window.appState.templates || [];
        const categories = window.appState.categories || [];

        if (templates.length === 0) {
            container.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-500">Belum ada Template Aplikasi.</td></tr>`;
            return;
        }

        let html = '';
        templates.forEach((t, idx) => {
            const cat = categories.find(c => c.id === t.kategori_id);
            const catName = cat ? cat.nama : 'Umum';

            html += `
                <tr class="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td class="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">${idx + 1}</td>
                    <td class="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">${t.nama_app}</td>
                    <td class="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">${catName}</td>
                    <td class="px-4 py-3 text-sm text-slate-500 truncate max-w-xs">${t.deskripsi_app}</td>
                    <td class="px-4 py-3 text-sm text-right space-x-2">
                        <button onclick="AdminTemplatesModule.deleteTemplate('${t.id}')" class="px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 rounded-lg hover:bg-rose-100">
                            <i class="fa-solid fa-trash mr-1"></i> Hapus
                        </button>
                    </td>
                </tr>
            `;
        });
        container.innerHTML = html;
    },

    saveTemplate: function (payload) {
        showLoader("Menyimpan Template App...");
        FirebaseService.saveTemplateOnServer(payload).then(res => {
            hideLoader();
            if (res.success) {
                showSuccessToast("Template App berhasil disimpan!");
                loadSystemBundledData(appState.currentUser ? appState.currentUser.id : null, () => {
                    AdminTemplatesModule.renderTemplatesTable();
                });
            } else {
                showErrorAlert(res.message);
            }
        });
    },

    deleteTemplate: function (id) {
        Swal.fire({
            title: 'Hapus Template App?',
            text: "Template ini akan dihapus permanen.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#EF4444',
            confirmButtonText: 'Ya, Hapus!'
        }).then(res => {
            if (res.isConfirmed) {
                showLoader("Menghapus Template App...");
                FirebaseService.deleteTemplateOnServer(id).then(r => {
                    hideLoader();
                    if (r.success) {
                        showSuccessToast("Template App berhasil dihapus!");
                        loadSystemBundledData(appState.currentUser ? appState.currentUser.id : null, () => {
                            AdminTemplatesModule.renderTemplatesTable();
                        });
                    } else {
                        showErrorAlert(r.message);
                    }
                });
            }
        });
    }
};

window.AdminTemplatesModule = AdminTemplatesModule;
