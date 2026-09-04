/**
 * Nexco Edu - Shared Core UI State & Helper Utilities
 * Mengelola state global aplikasi, tema, modal/alert UI, dan penanganan sesi pengguna.
 */

// Penampung State Aplikasi Global
let appState = {
    currentUser: null,
    videos: [],
    gems: [],
    categories: [],
    category_templates: [],
    prompts: [],
    templates: [],
    users: [],
    app_requests: [],
    aiApiKey: '',
    activeView: '',
    categoryFilter: 'Semua',
    promptCategoryFilter: 'Semua',
    charts: {}
};
window.appState = appState;

// Preferensi Tema Gelap/Terang (Default: Terang)
const savedTheme = localStorage.getItem('edu_theme') || 'light';
if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
} else {
    document.documentElement.classList.remove('dark');
}

function toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('edu_theme', 'light');
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('edu_theme', 'dark');
    }
}

function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    const isSecured = input.style.webkitTextSecurity !== 'none' && input.style.mozTextSecurity !== 'none';
    if (isSecured) {
        input.style.webkitTextSecurity = 'none';
        input.style.mozTextSecurity = 'none';
        icon.className = 'fa-solid fa-eye';
    } else {
        input.style.webkitTextSecurity = 'disc';
        input.style.mozTextSecurity = 'disc';
        icon.className = 'fa-solid fa-eye-slash';
    }
}

/* --- TOAST & ALERT UTILITIES --- */
function showSuccessToast(message) { Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 }).fire({ icon: 'success', title: message }); }
function showErrorToast(message) { Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 }).fire({ icon: 'error', title: message }); }
function showSuccessAlert(title) { Swal.fire({ icon: 'success', title: title, timer: 1500, showConfirmButton: false }); }
function showErrorAlert(text) { Swal.fire({ icon: 'error', title: 'Terjadi Kesalahan', text: text, confirmButtonColor: '#4F46E5' }); }

function showLoader(text) {
    Swal.fire({
        title: text || 'Memproses Data...',
        text: 'Mohon tunggu sebentar...',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        background: document.documentElement.classList.contains('dark') ? '#1B263B' : '#FFFFFF',
        color: document.documentElement.classList.contains('dark') ? '#E0E1DD' : '#1B263B',
        didOpen: () => {
            Swal.showLoading();
        }
    });
}

function hideLoader() {
    if (Swal.isVisible()) {
        Swal.close();
    }
    const globalLoader = document.getElementById('global-loader');
    if (globalLoader) {
        globalLoader.classList.add('hidden');
    }
}

/* --- SESSION VERIFICATION & DATA FETCHING --- */
function verifySessionAndInit(expectedRole, onSuccessCallback) {
    const storedUser = localStorage.getItem('edu_user');
    if (storedUser) {
        try {
            const parsedUser = JSON.parse(storedUser);
            const userEmail = (parsedUser.email || '').toLowerCase().trim();
            if (userEmail.includes('admin') || userEmail === 'admin@nexcoedu.com' || parsedUser.id === 'u_admin') {
                parsedUser.role = 'admin';
            }
            if (expectedRole && parsedUser.role !== expectedRole) {
                window.location.href = parsedUser.role === 'admin' ? 'admin.html' : 'user.html';
                return;
            }
            
            // Set currentUser immediately for instant UI responsiveness
            appState.currentUser = parsedUser;
            if (onSuccessCallback) onSuccessCallback(parsedUser);

            // Silent background server session check via Firebase
            if (window.FirebaseService) {
                FirebaseService.checkServerSession(parsedUser.id || parsedUser.email).then(res => {
                    if (res && res.active === true && res.user) {
                        appState.currentUser = res.user;
                        localStorage.setItem('edu_user', JSON.stringify(res.user));
                        if (expectedRole && res.user.role !== expectedRole) {
                            window.location.href = res.user.role === 'admin' ? 'admin.html' : 'user.html';
                        }
                    } else if (res && res.success !== false && res.active === false) {
                        localStorage.removeItem('edu_user');
                        window.location.href = 'login.html';
                    }
                }).catch(err => {
                    console.warn('Verifikasi sesi server latar belakang:', err);
                });
            }
        } catch (e) {
            localStorage.removeItem('edu_user');
            window.location.href = 'login.html';
        }
    } else {
        window.location.href = 'login.html';
    }
}

function loadSystemBundledData(userId, callback) {
    if (window.FirebaseService) {
        FirebaseService.fetchInitialBundledData(userId).then(res => {
            if (res && res.success) {
                appState.videos = res.videos || [];
                appState.gems = res.gems || [];
                appState.categories = res.categories || [];
                appState.category_templates = res.category_templates || [];
                appState.prompts = res.prompts || [];
                appState.templates = res.templates || [];
                appState.users = res.users || [];
                appState.app_requests = res.app_requests || [];
                appState.aiApiKey = res.aiApiKey || '';
                window.appState = appState;

                if (callback) callback();
            } else {
                hideLoader();
                showErrorToast('Gagal memuat database: ' + (res ? res.message : 'Respon kosong'));
            }
        }).catch(err => {
            console.warn('Sync data bundel server latar belakang:', err);
            hideLoader();
            showErrorToast('Koneksi server gagal: ' + err.toString());
        });
    }
}

function handleLogout() {
    Swal.fire({
        title: 'Apakah Anda ingin keluar?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#415A77',
        confirmButtonText: 'Ya, Keluar!',
        cancelButtonText: 'Batal',
        background: document.documentElement.classList.contains('dark') ? '#1B263B' : '#FFFFFF',
        color: document.documentElement.classList.contains('dark') ? '#E0E1DD' : '#1B263B'
    }).then((result) => {
        if (result.isConfirmed) {
            showLoader("Mengakhiri Sesi Pengguna...");
            localStorage.removeItem('edu_user');
            appState.currentUser = null;
            if (window.FirebaseService) {
                FirebaseService.logoutUser().then(() => {
                    window.location.href = 'login.html';
                });
            } else {
                window.location.href = 'login.html';
            }
        }
    });
}

/* --- HELPER YOUTUBE ID & EMBED PARSER --- */
function getYouTubeId(url) {
    if (!url) return '';
    const trimmedUrl = url.trim();

    if (trimmedUrl.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(trimmedUrl)) {
        return trimmedUrl;
    }

    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = trimmedUrl.match(regExp);

    if (match && match[1]) {
        return match[1];
    }

    const fallbackRegExp = /(?:\/|=)([a-zA-Z0-9_-]{11})(?:[&?.\s]|$)/;
    const fallbackMatch = trimmedUrl.match(fallbackRegExp);
    if (fallbackMatch && fallbackMatch[1]) {
        return fallbackMatch[1];
    }

    return '';
}

function getYouTubeEmbedUrl(url) {
    if (!url) return '';
    const id = getYouTubeId(url);
    return id ? 'https://www.youtube.com/embed/' + id : url;
}

function startVideo(videoId, context) {
    const videoData = appState.videos.find(v => v.id === videoId);
    if (!videoData) return;

    const container = document.getElementById('video-frame-' + context + '-' + videoId);
    if (container) {
        const embedUrl = getYouTubeEmbedUrl(videoData.video_url);
        container.innerHTML = '<iframe class="w-full h-full rounded-2xl" src="' + embedUrl + '?autoplay=1" title="Video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';
    }
}
