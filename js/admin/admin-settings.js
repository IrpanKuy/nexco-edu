/**
 * Nexco Edu - Module Admin Settings Management
 * Menangani Pengaturan Sistem & Simpan AI API Key.
 */

const AdminSettingsModule = {
    renderSettings: function () {
        const inputKey = document.getElementById('input-ai-api-key');
        if (inputKey) {
            inputKey.value = window.appState.aiApiKey || '';
        }
    },

    saveAiApiKey: function (keyVal) {
        showLoader("Menyimpan AI API Key...");
        FirebaseService.saveAiApiKeyOnServer(keyVal).then(res => {
            hideLoader();
            if (res.success) {
                showSuccessToast("AI API Key berhasil disimpan!");
                window.appState.aiApiKey = res.aiApiKey;
            } else {
                showErrorAlert(res.message);
            }
        });
    }
};

window.AdminSettingsModule = AdminSettingsModule;
