/**
 * Nexco Edu - Firebase Configuration & Initialization
 * Mendukung Firestore Offline Persistence (IndexedDB Cache) untuk Efisiensi Max Read Quota.
 */

// Kredensial Konfigurasi Proyek Firebase Anda
// Silakan sesuaikan variabel firebaseConfig ini dengan kredensial dari Firebase Console Anda (Project Settings -> Web App)
const firebaseConfig = {
  apiKey: "AIzaSyC3xK7LXOvVz4SmOT_zRk50V31hvT-rHe0",
  authDomain: "nexco-edu.firebaseapp.com",
  projectId: "nexco-edu",
  storageBucket: "nexco-edu.firebasestorage.app",
  messagingSenderId: "588072927909",
  appId: "1:588072927909:web:d30f508c24c4ec901d834c"
};

// Inisialisasi Aplikasi Firebase (Compat SDK Mode)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Aktifkan Firestore Offline Persistence (Cache-First Layer ke IndexedDB)
db.enablePersistence({ synchronizeTabs: true })
  .then(() => {
    console.log("Firebase Firestore Persistence (IndexedDB Cache) berhasil diaktifkan.");
  })
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("Firestore Persistence gagal: Multiple tabs terbuka sekaligus tanpa syncTab enabled.");
    } else if (err.code === 'unimplemented') {
      console.warn("Browser ini tidak mendukung Firestore Offline Persistence.");
    }
  });

window.firebaseAuth = auth;
window.firebaseDb = db;
