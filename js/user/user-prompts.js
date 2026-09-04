/**
 * Nexco Edu - Module User Prompts Library
 * Menangani Prompt Engineering Library dengan pencarian & fungsi Salin Teks.
 */

const UserPromptsModule = {
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

    renderPrompts: function (filterCatId = 'Semua', searchQuery = '') {
        const container = document.getElementById('user-prompts-grid');
        if (!container) return;

        const allowedCats = this.getAllowedCategoryIds();
        let prompts = window.appState.prompts || [];

        if (!allowedCats.includes('all')) {
            prompts = prompts.filter(p => allowedCats.includes(p.kategori_id));
        }

        if (filterCatId !== 'Semua') {
            prompts = prompts.filter(p => p.kategori_id === filterCatId);
        }

        if (searchQuery.trim() !== '') {
            const q = searchQuery.toLowerCase();
            prompts = prompts.filter(p => p.judul.toLowerCase().includes(q) || p.prompt_text.toLowerCase().includes(q) || p.deskripsi.toLowerCase().includes(q));
        }

        if (prompts.length === 0) {
            container.innerHTML = `
                <div class="col-span-full py-12 text-center text-slate-500 dark:text-slate-400">
                    <i class="fa-solid fa-terminal text-4xl mb-3 text-slate-300"></i>
                    <p class="text-lg font-medium">Tidak ada prompt yang ditemukan.</p>
                </div>
            `;
            return;
        }

        let html = '';
        prompts.forEach(p => {
            html += `
                <div class="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                    <div>
                        <h3 class="text-base font-bold text-slate-900 dark:text-white mb-1.5 leading-snug">${p.judul}</h3>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mb-3">${p.deskripsi}</p>
                        <div class="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3.5 text-xs font-mono text-slate-700 dark:text-slate-300 max-h-36 overflow-y-auto mb-4 whitespace-pre-wrap select-all">${p.prompt_text}</div>
                    </div>
                    <button onclick="UserPromptsModule.copyPrompt('${p.id}')" class="w-full py-2.5 px-4 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-300 font-medium text-xs rounded-xl flex items-center justify-center transition-colors">
                        <i class="fa-regular fa-copy mr-2"></i> Salin Prompt Text
                    </button>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    copyPrompt: function (promptId) {
        const p = (window.appState.prompts || []).find(item => item.id === promptId);
        if (!p) return;

        navigator.clipboard.writeText(p.prompt_text).then(() => {
            showSuccessToast("Prompt berhasil disalin ke clipboard!");
        }).catch(() => {
            showErrorToast("Gagal menyalin prompt.");
        });
    }
};

window.UserPromptsModule = UserPromptsModule;
