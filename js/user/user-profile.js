/**
 * Nexco Edu - Module User Profile
 * Menangani Update Profil Nama & Password Pengguna.
 */

const UserProfileModule = {
    renderProfile: function () {
        const user = window.appState.currentUser;
        if (!user) return;

        const inputNama = document.getElementById('user-profile-nama');
        const inputEmail = document.getElementById('user-profile-email');

        if (inputNama) inputNama.value = user.nama || '';
        if (inputEmail) inputEmail.value = user.email || '';
    },

    updateProfile: function (namaBaru, passwordBaru) {
        const currentUser = window.appState.currentUser;
        if (!currentUser) return;

        showLoader("Memperbarui Profil...");
        FirebaseService.updateProfileOnServer(currentUser.id, namaBaru, passwordBaru).then(res => {
            hideLoader();
            if (res.success) {
                showSuccessToast("Profil berhasil diperbarui!");
                currentUser.nama = namaBaru;
                window.appState.currentUser = currentUser;
                localStorage.setItem('edu_user', JSON.stringify(currentUser));
                this.renderProfile();
            } else {
                showErrorAlert(res.message);
            }
        });
    }
};

window.UserProfileModule = UserProfileModule;
