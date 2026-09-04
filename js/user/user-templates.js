/**
 * Nexco Edu - Module User App Templates Showcase
 * Menangani Katalog App Showcase untuk Pengguna.
 */

const UserTemplatesModule = {
    getAllowedCategoryIds: function () {
        const currentUser = window.appState.currentUser;
        if (!currentUser) return [];
        if (currentUser.role === 'admin') return ['all'];

        const tplId = currentUser.category_template_id || currentUser.allowed_tools || '';
        if (!tplId) return [];

        const tpl = (window.appState.category_templates || []).find(t => t.id === tplId);
        if (!tpl || !tpl.kategori_ids) return [];

        return tpl.kategori_ids.split(',').map(s => s.trim()).filter(Boolean);
    },

    renderTemplates: function (filterCatId = 'Semua') {
        const container = document.getElementById('user-templates-grid');
        if (!container) return;

        const allowedCats = this.getAllowedCategoryIds();
        let templates = window.appState.templates || [];

        if (!allowedCats.includes('all')) {
            templates = templates.filter(t => allowedCats.includes(t.kategori_id));
        }

        if (filterCatId !== 'Semua') {
            templates = templates.filter(t => t.kategori_id === filterCatId);
        }

        if (templates.length === 0) {
            container.innerHTML = `
                <div class="col-span-full py-12 text-center text-slate-500 dark:text-slate-400">
                    <i class="fa-solid fa-cubes text-4xl mb-3 text-slate-300"></i>
                    <p class="text-lg font-medium">Tidak ada Template App yang tersedia.</p>
                </div>
            `;
            return;
        }

        let html = '';
        templates.forEach(t => {
            const photo = t.foto_app || 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600';

            html += `
                <div class="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                    <img src="${photo}" class="w-full h-44 object-cover" alt="${t.nama_app}">
                    <div class="p-5 flex-1 flex flex-col justify-between">
                        <div>
                            <h3 class="text-base font-bold text-slate-900 dark:text-white mb-2 leading-snug">${t.nama_app}</h3>
                            <p class="text-xs text-slate-600 dark:text-slate-300 mb-4 line-clamp-3">${t.deskripsi_app}</p>
                        </div>
                        <div class="flex items-center space-x-2 pt-2">
                            ${t.demo_url ? `<a href="${t.demo_url}" target="_blank" class="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl text-center">Live Demo</a>` : ''}
                            ${t.link_code ? `<a href="${t.link_code}" target="_blank" class="flex-1 py-2 px-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-medium text-xs rounded-xl text-center">Source Code</a>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }
};

window.UserTemplatesModule = UserTemplatesModule;
