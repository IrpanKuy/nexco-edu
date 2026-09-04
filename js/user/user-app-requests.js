/**
 * Nexco Edu - Module User App Requests
 * Menangani Form Pengajuan Permohonan Aplikasi Custom dari Pengguna.
 */

const UserAppRequestsModule = {
    submitRequest: function (judulApp, deskripsiApp) {
        const currentUser = window.appState.currentUser;
        if (!currentUser) {
            showErrorAlert("Anda harus login terlebih dahulu.");
            return;
        }

        const payload = {
            nama_pemohon: currentUser.nama || currentUser.email,
            judul_app: judulApp,
            deskripsi_app: deskripsiApp,
            status: 'Pending'
        };

        showLoader("Mengirim Request Aplikasi...");
        FirebaseService.saveAppRequestOnServer(payload).then(res => {
            hideLoader();
            if (res.success) {
                showSuccessAlert("Permohonan aplikasi Anda berhasil dikirim!");
                const form = document.getElementById('form-user-app-request');
                if (form) form.reset();
            } else {
                showErrorAlert(res.message);
            }
        });
    }
};

window.UserAppRequestsModule = UserAppRequestsModule;
