/**
 * Nexco Edu - Module User Gems (AI Tools) Directory
 * Menangani Direktori Tools & Gems AI dengan pembatasan hak akses paket user.
 */

const UserGemsModule = {
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

    renderGems: function (filterCatId = 'Semua') {
        const container = document.getElementById('user-gems-grid');
        if (!container) return;

        const allowedCats = this.getAllowedCategoryIds();
        let gems = window.appState.gems || [];

        if (!allowedCats.includes('all')) {
            gems = gems.filter(g => allowedCats.includes(g.kategori_id));
        }

        if (filterCatId !== 'Semua') {
            gems = gems.filter(g => g.kategori_id === filterCatId);
        }

        if (gems.length === 0) {
            container.innerHTML = `
                <div class="col-span-full py-12 text-center text-slate-500 dark:text-slate-400">
                    <i class="fa-solid fa-gem text-4xl mb-3 text-slate-300"></i>
                    <p class="text-lg font-medium">Tidak ada Tools AI yang tersedia untuk kategori ini.</p>
                </div>
            `;
            return;
        }

        let html = '';
        gems.forEach(g => {
            html += `
                <div class="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                    <div>
                        <div class="flex items-center space-x-3 mb-3">
                            <div class="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg">
                                <i class="fa-solid fa-wand-magic-sparkles"></i>
                            </div>
                            <h3 class="text-base font-bold text-slate-900 dark:text-white leading-snug">${g.nama}</h3>
                        </div>
                        <p class="text-xs text-slate-600 dark:text-slate-300 mb-4 line-clamp-3">${g.deskripsi}</p>
                    </div>
                    <a href="${g.akses_url}" target="_blank" class="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl flex items-center justify-center transition-colors">
                        <i class="fa-solid fa-arrow-up-right-from-square mr-2"></i> Buka Tool AI
                    </a>
                </div>
            `;
        });

        container.innerHTML = html;
    }
};

window.UserGemsModule = UserGemsModule;
