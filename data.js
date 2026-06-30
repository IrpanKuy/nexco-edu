// ================= CONFIGURATION & SHARED STATE FOR NEXCO EDU =================
const GAS_URL = "https://script.google.com/macros/s/AKfycbx3hP-6gPRF51NDA-zmqbY61XFqLxDgSWExVVrXBHp6t7reqvlgTbortRrEUmfrbVyF/exec";

// DETEKTOR OTOMATIS: Tentukan apakah berjalan di lingkungan eksternal
const isExternalHosting = typeof google === "undefined" || !google.script || !google.script.run;

if (isExternalHosting) {
    console.log("Nexco Edu: Berjalan dalam mode HOSTING EKSTERNAL.");
    window.google = {
        script: {
            run: {
                _successHandler: null,
                _failureHandler: null,
                withSuccessHandler: function (handler) {
                    this._successHandler = handler;
                    return this;
                },
                withFailureHandler: function (handler) {
                    this._failureHandler = handler;
                    return this;
                }
            }
        }
    };

    const runProxyHandler = {
        get(target, prop) {
            if (prop === 'withSuccessHandler' || prop === 'withFailureHandler' || prop.startsWith('_')) {
                return target[prop];
            }

            return function (...args) {
                const success = target._successHandler;
                const failure = target._failureHandler;

                target._successHandler = null;
                target._failureHandler = null;

                if (!GAS_URL || !GAS_URL.startsWith("https://script.google.com")) {
                    if (failure) {
                        failure(new Error("URL Apps Script (GAS_URL) belum dikonfigurasi dengan benar."));
                    } else {
                        console.error("GAS_URL is not configured.");
                    }
                    return;
                }

                fetch(GAS_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/plain;charset=utf-8'
                    },
                    body: JSON.stringify({
                        action: prop,
                        arguments: args
                    })
                })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('HTTP Error: ' + response.status);
                        }
                        return response.json();
                    })
                    .then(data => {
                        if (success) success(data);
                    })
                    .catch(err => {
                        if (failure) failure(err);
                        else console.error('GAS API External Error:', err);
                    });
            };
        }
    };

    window.google.script.run = new Proxy(window.google.script.run, runProxyHandler);
} else {
    console.log("Nexco Edu: Berjalan dalam mode HOSTING INTERNAL GAS.");
}

function validateOrPromptGasUrl(callback) {
    if (callback) callback();
}

// Penampung State Aplikasi Global
let appState = {
    currentUser: null,
    videos: [],
    gems: [],
    categories: [],
    prompts: [],
    users: [],
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
    const loader = document.getElementById('global-loader');
    if (!loader) return;
    const loaderText = loader.querySelector('h3');
    if (loaderText) loaderText.textContent = text;
    loader.classList.remove('hidden');
}

function hideLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) loader.classList.add('hidden');
}

/* --- SESSION VERIFICATION & DATA FETCHING --- */
function verifySessionAndInit(expectedRole, onSuccessCallback) {
    const storedUser = localStorage.getItem('edu_user');
    if (storedUser) {
        try {
            const parsedUser = JSON.parse(storedUser);
            google.script.run
                .withSuccessHandler(res => {
                    if (res.active) {
                        if (expectedRole && res.user.role !== expectedRole) {
                            // Redirect jika role tidak sesuai dengan halaman yang dibuka
                            window.location.href = res.user.role === 'admin' ? 'admin.html' : 'user.html';
                            return;
                        }
                        appState.currentUser = res.user;
                        if (onSuccessCallback) onSuccessCallback(res.user);
                    } else {
                        localStorage.removeItem('edu_user');
                        window.location.href = 'login.html';
                    }
                })
                .withFailureHandler(err => {
                    hideLoader();
                    showErrorToast('Gagal memverifikasi sesi server: ' + err.toString());
                })
                .checkServerSession(parsedUser.id);
        } catch (e) {
            localStorage.removeItem('edu_user');
            window.location.href = 'login.html';
        }
    } else {
        window.location.href = 'login.html';
    }
}

function loadSystemBundledData(userId, callback) {
    google.script.run
        .withSuccessHandler(res => {
            if (res.success) {
                appState.videos = res.videos || [];
                appState.gems = res.gems || [];
                appState.categories = res.categories || [];
                appState.prompts = res.prompts || [];
                appState.users = res.users || [];
                appState.aiApiKey = res.aiApiKey || '';
                window.appState = appState;
                if (callback) callback();
            } else {
                hideLoader();
                showErrorToast('Gagal memuat database: ' + res.message);
            }
        })
        .withFailureHandler(err => {
            hideLoader();
            showErrorToast('Koneksi server gagal: ' + err.toString());
        })
        .fetchInitialBundledData(userId);
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
            window.location.href = 'login.html';
        }
    });
}

/* --- HELPER YOUTUBE ID & EMBED PARSER --- */
function getYouTubeId(url) {
    if (!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : '';
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
