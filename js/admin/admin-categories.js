/**
 * Nexco Edu - Module Admin Categories & Category Templates Management
 * Menangani CRUD Kategori Utama dan Paket Template Hak Akses Kategori.
 */

const AdminCategoriesModule = {
    renderCategoriesTable: function () {
        const container = document.getElementById('admin-categories-table-body');
        if (!container) return;

        const categories = window.appState.categories || [];
        if (categories.length === 0) {
            container.innerHTML = `<tr><td colspan="3" class="py-6 text-center text-slate-500">Belum ada kategori.</td></tr>`;
            return;
        }

        let html = '';
        categories.forEach((cat, idx) => {
            html += `
                <tr class="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td class="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">${idx + 1}</td>
                    <td class="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">${cat.nama}</td>
                    <td class="px-4 py-3 text-sm text-right space-x-2">
                        <button onclick="AdminCategoriesModule.deleteCategory('${cat.id}')" class="px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 rounded-lg hover:bg-rose-100">
                            <i class="fa-solid fa-trash mr-1"></i> Hapus
                        </button>
                    </td>
                </tr>
            `;
        });
        container.innerHTML = html;
    },

    renderCategoryTemplatesTable: function () {
        const container = document.getElementById('admin-category-templates-table-body');
        if (!container) return;

        const templates = window.appState.category_templates || [];
        const categories = window.appState.categories || [];

        if (templates.length === 0) {
            container.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-slate-500">Belum ada paket hak akses.</td></tr>`;
            return;
        }

        let html = '';
        templates.forEach((tpl, idx) => {
            const catIds = (tpl.kategori_ids || '').split(',').map(s => s.trim());
            const catNames = catIds.map(id => {
                const c = categories.find(cat => cat.id === id);
                return c ? c.nama : id;
            }).filter(Boolean).join(', ');

            html += `
                <tr class="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td class="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">${idx + 1}</td>
                    <td class="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">${tpl.nama}</td>
                    <td class="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 font-normal">${catNames || 'Tidak ada kategori'}</td>
                    <td class="px-4 py-3 text-sm text-right space-x-2">
                        <button onclick="AdminCategoriesModule.deleteCategoryTemplate('${tpl.id}')" class="px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 rounded-lg hover:bg-rose-100">
                            <i class="fa-solid fa-trash mr-1"></i> Hapus
                        </button>
                    </td>
                </tr>
            `;
        });
        container.innerHTML = html;
    },

    saveCategory: function (nama) {
        showLoader("Menyimpan Kategori...");
        FirebaseService.saveCategoryOnServer({ nama: nama }).then(res => {
            hideLoader();
            if (res.success) {
                showSuccessToast("Kategori berhasil ditambahkan!");
                loadSystemBundledData(appState.currentUser ? appState.currentUser.id : null, () => {
                    AdminCategoriesModule.renderCategoriesTable();
                });
            } else {
                showErrorAlert(res.message);
            }
        });
    },

    deleteCategory: function (id) {
        Swal.fire({
            title: 'Hapus Kategori?',
            text: "Kategori ini akan dihapus dari sistem.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#EF4444',
            confirmButtonText: 'Ya, Hapus!'
        }).then(res => {
            if (res.isConfirmed) {
                showLoader("Menghapus Kategori...");
                FirebaseService.deleteCategoryOnServer(id).then(r => {
                    hideLoader();
                    if (r.success) {
                        showSuccessToast("Kategori berhasil dihapus!");
                        loadSystemBundledData(appState.currentUser ? appState.currentUser.id : null, () => {
                            AdminCategoriesModule.renderCategoriesTable();
                        });
                    } else {
                        showErrorAlert(r.message);
                    }
                });
            }
        });
    },

    deleteCategoryTemplate: function (id) {
        Swal.fire({
            title: 'Hapus Paket Hak Akses?',
            text: "Paket hak akses ini akan dihapus dari sistem.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#EF4444',
            confirmButtonText: 'Ya, Hapus!'
        }).then(res => {
            if (res.isConfirmed) {
                showLoader("Menghapus Paket...");
                FirebaseService.deleteCategoryTemplateOnServer(id).then(r => {
                    hideLoader();
                    if (r.success) {
                        showSuccessToast("Paket berhasil dihapus!");
                        loadSystemBundledData(appState.currentUser ? appState.currentUser.id : null, () => {
                            AdminCategoriesModule.renderCategoryTemplatesTable();
                        });
                    } else {
                        showErrorAlert(r.message);
                    }
                });
            }
        });
    }
};

window.AdminCategoriesModule = AdminCategoriesModule;
