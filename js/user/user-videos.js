/**
 * Nexco Edu - Module User Videos Hub
 * Menangani tampilan Video Pembelajaran berdasarkan filter Hak Akses Kategori (category_template_id).
 */

const UserVideosModule = {
    getAllowedCategoryIds: function () {
        // Tampilkan semua video tanpa pembatasan hak akses apapun untuk semua user
        return ['all'];
    },

    renderVideos: function (filterCatId = 'Semua') {
        const container = document.getElementById('user-videos-grid');
        if (!container) return;

        let videos = window.appState.videos || [];

        // Semua video ditampilkan tanpa pembatasan hak akses kategori untuk semua user

        // Filter berdasar kategori yang dipilih di UI
        if (filterCatId !== 'Semua') {
            videos = videos.filter(v => v.kategori_id === filterCatId);
        }

        if (videos.length === 0) {
            container.innerHTML = `
                <div class="col-span-full py-12 text-center text-slate-500 dark:text-slate-400">
                    <i class="fa-solid fa-film text-4xl mb-3 text-slate-300"></i>
                    <p class="text-lg font-medium">Tidak ada video yang tersedia untuk kategori ini.</p>
                </div>
            `;
            return;
        }

        let html = '';
        videos.forEach(v => {
            const embedUrl = getYouTubeEmbedUrl(v.video_url);
            const youtubeId = getYouTubeId(v.video_url);
            const thumbUrl = youtubeId ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg` : 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600';

            html += `
                <div class="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                    <div class="relative w-full aspect-video bg-slate-900 overflow-hidden" id="video-frame-user-${v.id}">
                        <img src="${thumbUrl}" class="w-full h-full object-cover opacity-80" alt="${v.judul}">
                        <button onclick="startVideo('${v.id}', 'user')" class="absolute inset-0 m-auto w-14 h-14 bg-indigo-600/90 text-white rounded-full flex items-center justify-center hover:bg-indigo-600 hover:scale-105 transition-all shadow-lg">
                            <i class="fa-solid fa-play text-xl ml-1"></i>
                        </button>
                    </div>
                    <div class="p-5 flex-1 flex flex-col">
                        <h3 class="text-base font-bold text-slate-900 dark:text-white mb-2 leading-snug">${v.judul}</h3>
                        <div class="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 prose dark:prose-invert max-w-none">${v.deskripsi}</div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }
};

window.UserVideosModule = UserVideosModule;
