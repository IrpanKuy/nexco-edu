/**
 * Nexco Edu - Module Admin Videos Management
 * Menangani CRUD Video Pembelajaran, Embed Player, dan Pengurutan Video.
 */

const AdminVideosModule = {
    renderVideosTable: function () {
        const container = document.getElementById('admin-videos-table-body');
        if (!container) return;

        const videos = window.appState.videos || [];
        const categories = window.appState.categories || [];

        if (videos.length === 0) {
            container.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-500">Belum ada modul video.</td></tr>`;
            return;
        }

        let html = '';
        videos.forEach((v, idx) => {
            const cat = categories.find(c => c.id === v.kategori_id);
            const catName = cat ? cat.nama : 'Umum';

            html += `
                <tr class="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td class="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">${v.urutan || (idx + 1)}</td>
                    <td class="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">${v.judul}</td>
                    <td class="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">${catName}</td>
                    <td class="px-4 py-3 text-sm text-indigo-600 dark:text-indigo-400 truncate max-w-xs">
                        <a href="${v.video_url}" target="_blank" class="hover:underline">${v.video_url}</a>
                    </td>
                    <td class="px-4 py-3 text-sm text-right space-x-2">
                        <button onclick="AdminVideosModule.deleteVideo('${v.id}')" class="px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 rounded-lg hover:bg-rose-100">
                            <i class="fa-solid fa-trash mr-1"></i> Hapus
                        </button>
                    </td>
                </tr>
            `;
        });
        container.innerHTML = html;
    },

    saveVideo: function (payload) {
        showLoader("Menyimpan Modul Video...");
        FirebaseService.saveVideoOnServer(payload).then(res => {
            hideLoader();
            if (res.success) {
                showSuccessToast("Video berhasil disimpan!");
                loadSystemBundledData(appState.currentUser ? appState.currentUser.id : null, () => {
                    AdminVideosModule.renderVideosTable();
                });
            } else {
                showErrorAlert(res.message);
            }
        });
    },

    deleteVideo: function (id) {
        Swal.fire({
            title: 'Hapus Modul Video?',
            text: "Video ini akan dihapus permanen.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#EF4444',
            confirmButtonText: 'Ya, Hapus!'
        }).then(res => {
            if (res.isConfirmed) {
                showLoader("Menghapus Video...");
                FirebaseService.deleteVideoOnServer(id).then(r => {
                    hideLoader();
                    if (r.success) {
                        showSuccessToast("Video berhasil dihapus!");
                        loadSystemBundledData(appState.currentUser ? appState.currentUser.id : null, () => {
                            AdminVideosModule.renderVideosTable();
                        });
                    } else {
                        showErrorAlert(r.message);
                    }
                });
            }
        });
    }
};

window.AdminVideosModule = AdminVideosModule;
