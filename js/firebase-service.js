/**
 * Nexco Edu - Firebase Backend API Service Adaptor
 * Menggantikan seluruh 28 fungsi backend Google Apps Script (code.gs) dengan Firebase Auth & Firestore.
 * Dilengkapi Smart Caching & Seeder Data Otomatis.
 */

// Helper SHA-256 (jika dibutuhkan untuk sinkronisasi legasi)
async function hashPassword(password) {
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const FirebaseService = {
    waitForAuth: function () {
        return new Promise((resolve) => {
            if (!window.firebaseAuth) return resolve(null);
            if (firebaseAuth.currentUser) {
                return resolve(firebaseAuth.currentUser);
            }
            let resolved = false;
            const unsubscribe = firebaseAuth.onAuthStateChanged((user) => {
                if (!resolved) {
                    resolved = true;
                    if (typeof unsubscribe === 'function') unsubscribe();
                    resolve(user);
                }
            });
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    resolve(firebaseAuth.currentUser);
                }
            }, 1500);
        });
    },

    // 1. OTENTIKASI & MANAJEMEN SESI PENGGUNA
    loginUser: async function (email, password) {
        try {
            // Seeder otomatis jika database baru kosong
            await this.seedAllDataIfNeeded();

            const lowerEmail = (email || '').toLowerCase().trim();
            const isAdminEmail = lowerEmail.includes('admin') || lowerEmail === 'admin@nexcoedu.com';

            // Coba login via Firebase Auth
            let userCredential;
            try {
                userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password);
            } catch (authErr) {
                // Fallback login manual via Firestore jika akun dibuat tanpa Auth SDK langsung
                try {
                    const snapshot = await firebaseDb.collection('users').where('email', '==', email).get();
                    let matchedDoc = !snapshot.empty ? snapshot.docs[0] : null;
                    if (!matchedDoc && lowerEmail !== email) {
                        const snap2 = await firebaseDb.collection('users').where('email', '==', lowerEmail).get();
                        if (!snap2.empty) matchedDoc = snap2.docs[0];
                    }

                    if (matchedDoc) {
                        const userData = matchedDoc.data();
                        const inputHash = await hashPassword(password);
                        if (userData.password_hash && userData.password_hash === inputHash) {
                            // Coba daftarkan/hubungkan ke Firebase Auth secara otomatis agar token request.auth valid
                            try {
                                userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
                            } catch (createAuthErr) {
                                try {
                                    userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password);
                                } catch(reAuthErr){}
                            }
                            
                            const userObj = { id: matchedDoc.id, ...userData };
                            delete userObj.password_hash;
                            if (isAdminEmail || userData.role === 'admin') {
                                userObj.role = 'admin';
                            }

                            if (userCredential && userCredential.user) {
                                const uid = userCredential.user.uid;
                                try {
                                    await firebaseDb.collection('users').doc(uid).set({
                                        ...userData,
                                        role: userObj.role,
                                        id: uid,
                                        firebase_uid: uid,
                                        updated_at: new Date().toISOString()
                                    }, { merge: true });
                                    userObj.id = uid;
                                } catch(syncErr){}
                            }

                            CacheManager.set('user_' + userObj.id, userObj, 15 * 60 * 1000);
                            return { success: true, user: userObj };
                        }
                    }
                } catch (fsErr) {
                    console.warn("Firestore user fallback search warning:", fsErr);
                }

                if (authErr.code === 'auth/operation-not-allowed') {
                    return { success: false, message: "Metode Email/Password belum diaktifkan di Firebase Console (Authentication -> Sign-in method)." };
                }
                if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/wrong-password') {
                    return { success: false, message: "Email atau kata sandi Anda salah. Silakan periksa kembali kredensial Anda." };
                }
                return { success: false, message: "Email atau kata sandi salah / pengguna belum terdaftar (" + authErr.message + ")." };
            }

            const uid = userCredential.user.uid;
            let userObj = null;

            try {
                const userDoc = await firebaseDb.collection('users').doc(uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    userObj = { id: userDoc.id, ...userData };
                    delete userObj.password_hash;
                } else {
                    const snapshot = await firebaseDb.collection('users').where('email', '==', email).get();
                    let matchedDoc = !snapshot.empty ? snapshot.docs[0] : null;
                    if (!matchedDoc && lowerEmail !== email) {
                        const snap2 = await firebaseDb.collection('users').where('email', '==', lowerEmail).get();
                        if (!snap2.empty) matchedDoc = snap2.docs[0];
                    }

                    if (matchedDoc) {
                        const userData = matchedDoc.data();
                        userObj = { id: matchedDoc.id, ...userData };
                        delete userObj.password_hash;
                    }
                }
            } catch (docErr) {
                console.warn("User doc fetch error:", docErr);
            }

            if (!userObj) {
                const role = isAdminEmail ? 'admin' : 'user';
                const defaultNama = isAdminEmail ? 'Administrator' : email.split('@')[0];
                userObj = { id: uid, email: email, nama: defaultNama, role: role, created_at: new Date().toISOString() };
            } else if (isAdminEmail) {
                userObj.role = 'admin';
            }

            // Sync doc users/{uid} di Firestore
            try {
                await firebaseDb.collection('users').doc(uid).set({
                    ...userObj,
                    id: uid,
                    firebase_uid: uid,
                    updated_at: new Date().toISOString()
                }, { merge: true });
                userObj.id = uid;
            } catch (sErr) {
                console.warn("User doc sync error:", sErr);
            }

            CacheManager.set('user_' + userObj.id, userObj, 15 * 60 * 1000);
            CacheManager.set('user_' + uid, userObj, 15 * 60 * 1000);

            return { success: true, user: userObj };
        } catch (err) {
            console.error("Firebase Login Error:", err);
            return { success: false, message: "Gagal memproses otentikasi: " + err.message };
        }
    },

    checkServerSession: async function (userId) {
        try {
            if (!userId) return { active: false, message: "ID pengguna tidak valid." };
            
            // Tunggu hingga Firebase Auth memuat state otentikasi penuh
            await this.waitForAuth();

            // 1. Cek Cache Lokal terlebih dahulu
            const cachedUser = CacheManager.get('user_' + userId);
            if (cachedUser) {
                return { active: true, user: cachedUser };
            }

            // 2. Lookup Firestore by Document ID
            try {
                const userDoc = await firebaseDb.collection('users').doc(userId).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    const { password_hash, ...safeUser } = userData;
                    safeUser.id = userDoc.id;
                    if (safeUser.email && safeUser.email.toLowerCase().includes('admin')) {
                        safeUser.role = 'admin';
                    }
                    safeUser.category_template_id = safeUser.category_template_id || safeUser.allowed_tools || "";
                    CacheManager.set('user_' + userId, safeUser, 15 * 60 * 1000);
                    return { active: true, user: safeUser };
                }
            } catch (dErr) {
                console.warn("Doc lookup warning in checkServerSession:", dErr);
            }

            // 3. Lookup Firestore by Email
            try {
                const snapshot = await firebaseDb.collection('users').where('email', '==', userId).get();
                if (!snapshot.empty) {
                    const matchedDoc = snapshot.docs[0];
                    const userData = matchedDoc.data();
                    const { password_hash, ...safeUser } = userData;
                    safeUser.id = matchedDoc.id;
                    if (safeUser.email && safeUser.email.toLowerCase().includes('admin')) {
                        safeUser.role = 'admin';
                    }
                    safeUser.category_template_id = safeUser.category_template_id || safeUser.allowed_tools || "";
                    CacheManager.set('user_' + userId, safeUser, 15 * 60 * 1000);
                    return { active: true, user: safeUser };
                }
            } catch (eErr) {
                console.warn("Email lookup warning in checkServerSession:", eErr);
            }

            // 4. Fallback jika user terautentikasi di Firebase Auth
            if (window.firebaseAuth && firebaseAuth.currentUser) {
                const curUser = firebaseAuth.currentUser;
                if (curUser.uid === userId || curUser.email === userId) {
                    const isAdm = (curUser.email && (curUser.email.toLowerCase().includes('admin') || curUser.email.toLowerCase() === 'admin@nexcoedu.com'));
                    const fallbackUser = {
                        id: curUser.uid,
                        email: curUser.email || userId,
                        nama: curUser.displayName || (curUser.email ? curUser.email.split('@')[0] : (isAdm ? 'Administrator' : 'User')),
                        role: isAdm ? 'admin' : 'user',
                        category_template_id: ''
                    };
                    try {
                        await firebaseDb.collection('users').doc(curUser.uid).set(fallbackUser, { merge: true });
                    } catch(sErr){}
                    CacheManager.set('user_' + userId, fallbackUser, 15 * 60 * 1000);
                    return { active: true, user: fallbackUser };
                }
            }

            // 5. Fallback ke edu_user di localStorage (mencegah logout paksa saat offline / temporary error)
            const localEdu = localStorage.getItem('edu_user');
            if (localEdu) {
                try {
                    const parsedLocal = JSON.parse(localEdu);
                    if (parsedLocal.id === userId || parsedLocal.email === userId) {
                        return { active: true, user: parsedLocal };
                    }
                } catch(lErr){}
            }

            return { active: false, message: "Pengguna tidak ditemukan." };
        } catch (err) {
            console.warn("checkServerSession error, fallback to local session:", err);
            const localEdu = localStorage.getItem('edu_user');
            if (localEdu) {
                try {
                    const parsedLocal = JSON.parse(localEdu);
                    if (parsedLocal.id === userId || parsedLocal.email === userId) {
                        return { active: true, user: parsedLocal };
                    }
                } catch(lErr){}
            }
            return { active: false, message: err.message };
        }
    },

    logoutUser: async function () {
        try {
            await firebaseAuth.signOut();
            CacheManager.clearAll();
            return { success: true };
        } catch (err) {
            return { success: true };
        }
    },

    // 2. PEMUATAN BUNDEL DATA UTAMA (CACHED SMART QUERY)
    fetchInitialBundledData: async function (userId) {
        try {
            // Tunggu hingga Firebase Auth memuat token otentikasi penuh
            await this.waitForAuth();
            // Cek Cache Lokal Utama terlebih dahulu
            const cachedBundle = CacheManager.get('bundled_data');
            if (cachedBundle) {
                // Jalankan seeder di latar belakang jika database masih kosong sama sekali
                this.seedAllDataIfNeeded();
                return { success: true, ...cachedBundle };
            }

            // Ambil Data Firestore secara Paralel
            const [
                categoriesSnap,
                categoryTemplatesSnap,
                videosSnap,
                gemsSnap,
                promptsSnap,
                templatesSnap,
                appRequestsSnap,
                settingsSnap
            ] = await Promise.all([
                firebaseDb.collection('categories').get(),
                firebaseDb.collection('category_templates').get(),
                firebaseDb.collection('videos').get(),
                firebaseDb.collection('gems').get(),
                firebaseDb.collection('prompts').get(),
                firebaseDb.collection('templates').get(),
                firebaseDb.collection('app_requests').get(),
                firebaseDb.collection('settings').doc('global').get()
            ]);

            // Jika database baru kosong, jalankan Seeder Otomatis
            if (categoriesSnap.empty && videosSnap.empty) {
                await this.seedAllData();
                return this.fetchInitialBundledData(userId);
            }

            const categories = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const category_templates = categoryTemplatesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const videos = videosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const gems = gemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const prompts = promptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            let templates = templatesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Jika templates di database masih kosong sama sekali, inisialisasi 4 template showcase awal
            if (templates.length === 0) {
                const now = new Date().toISOString();
                const defaultAppTemplates = [
                    {
                        id: 't_inventaris',
                        nama_app: 'Gas UMKM (WebApp Inventaris)',
                        kategori_id: categories.length > 0 ? categories[0].id : 'c_genai',
                        foto_app: '/demo image/inventaris.jpg',
                        demo_url: 'https://script.google.com/macros/s/AKfycbx88seLsCE3Unc7Gyvf5v2Asy1m080Y-10gsMpghw6HN7--fZJDGSfStsCSjCHY29ts/exec',
                        link_code: 'https://github.com/nexco/gas-umkm',
                        deskripsi_app: 'Gas UMKM adalah solusi platform manajemen inventaris (webapp) berbasis digital yang dirancang khusus untuk meningkatkan efisiensi operasional dan akurasi tata kelola logistik usaha. Terintegrasi Gas Gem AI Asisten (Gemini 3.1 Flash-Lite) untuk pengelolaan database interaktif.<br/><br/>Akun Login:<br/>Username: admin<br/>Password: admin123<br/>Lalu ke pengaturan > Klik simpan Api Key agar Kalian bisa coba chatbotnya.',
                        is_in_gallery: true,
                        created_at: now
                    },
                    {
                        id: 't_tahfidz',
                        nama_app: 'TahfidzQ (Pencatatan Tahfidz)',
                        kategori_id: categories.length > 1 ? categories[1].id : 'c_webdev',
                        foto_app: '/demo image/tahfidz.webp',
                        demo_url: 'https://script.google.com/macros/s/AKfycbwNo_bVTcKmnLmLj7TYHkeS1gIV7KThjfbHPLwbxongpVigao2MRb7e6czuKQBcVW5f/exec',
                        link_code: 'https://github.com/nexco/tahfidzq',
                        deskripsi_app: 'TahfidzQ adalah platform berbasis web responsif (webapp) untuk memodernisasi tata kelola dan pencatatan progres hafalan Al-Qur\'an secara digital dengan peran khusus santri dan pengajar.<br/><br/>Akun Login:<br/>Username (pengajar): hanan | Password: 123<br/>Username (santri): Yusuf | Password: 123',
                        is_in_gallery: true,
                        created_at: now
                    },
                    {
                        id: 't_perpus',
                        nama_app: 'Pustaka Pro (Manajemen Perpustakaan)',
                        kategori_id: categories.length > 1 ? categories[1].id : 'c_webdev',
                        foto_app: '/demo image/perpus.webp',
                        demo_url: 'https://script.google.com/macros/s/AKfycbwNo_bVTcKmnLmLj7TYHkeS1gIV7KThjfbHPLwbxongpVigao2MRb7e6czuKQBcVW5f/exec',
                        link_code: 'https://github.com/nexco/pustaka-pro',
                        deskripsi_app: 'Pustaka Pro adalah platform web-based application (Administrator Console) untuk digitalisasi, otomatisasi, dan optimalisasi tata kelola operasional perpustakaan dan sirkulasi peminjaman secara transparan dan real-time.<br/><br/>Akun Login:<br/>Username: admin | Password: admin123',
                        is_in_gallery: true,
                        created_at: now
                    },
                    {
                        id: 't_uang',
                        nama_app: 'Dompet Pintar (Manajemen Keuangan)',
                        kategori_id: categories.length > 0 ? categories[0].id : 'c_genai',
                        foto_app: '/demo image/uang.webp',
                        demo_url: 'https://script.google.com/macros/s/AKfycbwtFBCZ1tKT81yoRhHlo8113_S3Y_Bu1_gdoNBMsJc4EfH-ZA9rzCvEX9BXXrrNCE3m9w/exec',
                        link_code: 'https://github.com/nexco/dompet-pintar',
                        deskripsi_app: 'Dompet Pintar adalah platform aplikasi seluler responsif untuk pencatatan, pelacakan, dan analisis tata kelola finansial personal secara digital yang terintegrasi AI Chatbot.<br/>Untuk mencoba Chatbot: ke pengaturan > Klik simpan Api Key, lalu kalian bisa Chat dengan Chatbotnya.',
                        is_in_gallery: true,
                        created_at: now
                    }
                ];

                templates = defaultAppTemplates;
                try {
                    const batch = firebaseDb.batch();
                    defaultAppTemplates.forEach(item => batch.set(firebaseDb.collection('templates').doc(item.id), item));
                    batch.commit().catch(e => console.warn("Seed default templates async warning:", e));
                } catch(seedTplErr) {
                    console.warn("Auto seed templates error:", seedTplErr);
                }
            }
            const app_requests = appRequestsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const aiApiKey = settingsSnap.exists ? (settingsSnap.data().ai_api_key || '') : '';

            let users = [];
            if (userId) {
                let isUserAdmin = false;
                try {
                    const userDoc = await firebaseDb.collection('users').doc(userId).get();
                    if (userDoc.exists && userDoc.data().role === 'admin') {
                        isUserAdmin = true;
                    } else {
                        const snap = await firebaseDb.collection('users').where('email', '==', userId).get();
                        if (!snap.empty && snap.docs[0].data().role === 'admin') {
                            isUserAdmin = true;
                        }
                    }
                } catch(uErr){}

                if (!isUserAdmin && window.appState && appState.currentUser && appState.currentUser.role === 'admin') {
                    isUserAdmin = true;
                }

                if (isUserAdmin) {
                    try {
                        const usersSnap = await firebaseDb.collection('users').get();
                        users = usersSnap.docs.map(doc => {
                            const { password_hash, ...u } = doc.data();
                            u.id = doc.id;
                            u.category_template_id = u.category_template_id || u.allowed_tools || "";
                            return u;
                        });
                    } catch(fsUsersErr){
                        console.warn("Failed fetching users list for admin:", fsUsersErr);
                    }
                }
            }

            const bundleResult = {
                videos: videos,
                gems: gems,
                categories: categories,
                category_templates: category_templates,
                prompts: prompts,
                templates: templates,
                users: users,
                app_requests: app_requests,
                aiApiKey: aiApiKey
            };

            // Simpan ke Smart Cache Layer (TTL 30 Menit)
            CacheManager.set('bundled_data', bundleResult, 30 * 60 * 1000);

            return { success: true, ...bundleResult };
        } catch (err) {
            console.error("Gagal memuat bundel data Firestore:", err);
            return { success: false, message: "Gagal memuat bundel data utama: " + err.message };
        }
    },

    // 3. SETTINGS & AI API KEY
    getAiApiKeyFromServer: async function () {
        try {
            const doc = await firebaseDb.collection('settings').doc('global').get();
            return doc.exists ? (doc.data().ai_api_key || '') : '';
        } catch (e) {
            return '';
        }
    },

    saveAiApiKeyOnServer: async function (apiKey) {
        try {
            const cleanKey = String(apiKey || '').trim();
            const timestamp = new Date().toISOString();

            await firebaseDb.collection('settings').doc('global').set({
                ai_api_key: cleanKey,
                updated_at: timestamp
            }, { merge: true });

            CacheManager.invalidate('bundled_data');
            return { success: true, aiApiKey: cleanKey };
        } catch (err) {
            return { success: false, message: "Gagal menyimpan AI API Key: " + err.message };
        }
    },

    // 4. MANAJEMEN CRUD VIDEO
    saveVideoOnServer: async function (payload) {
        try {
            const timestamp = new Date().toISOString();
            const dataToSave = {
                judul: payload.judul || '',
                deskripsi: payload.deskripsi || '',
                video_url: payload.video_url || '',
                kategori_id: payload.kategori_id || '',
                urutan: parseInt(payload.urutan) || 1,
                updated_at: timestamp
            };

            let videoId = payload.id;
            if (videoId) {
                await firebaseDb.collection('videos').doc(videoId).set(dataToSave, { merge: true });
            } else {
                videoId = 'v_' + new Date().getTime();
                dataToSave.id = videoId;
                dataToSave.created_at = timestamp;
                await firebaseDb.collection('videos').doc(videoId).set(dataToSave);
            }

            CacheManager.invalidate('bundled_data');
            return { success: true, data: { id: videoId, ...dataToSave } };
        } catch (err) {
            return { success: false, message: "Gagal menyimpan modul video: " + err.message };
        }
    },

    deleteVideoOnServer: async function (id) {
        try {
            await firebaseDb.collection('videos').doc(id).delete();
            CacheManager.invalidate('bundled_data');
            return { success: true };
        } catch (err) {
            return { success: false, message: "Gagal menghapus video: " + err.message };
        }
    },

    // 5. MANAJEMEN CRUD KATEGORI
    saveCategoryOnServer: async function (payload) {
        try {
            const timestamp = new Date().toISOString();
            let catId = payload.id;
            const dataToSave = {
                nama: payload.nama,
                updated_at: timestamp
            };

            if (catId) {
                await firebaseDb.collection('categories').doc(catId).set(dataToSave, { merge: true });
            } else {
                catId = 'c_' + new Date().getTime();
                dataToSave.id = catId;
                dataToSave.created_at = timestamp;
                await firebaseDb.collection('categories').doc(catId).set(dataToSave);
            }

            CacheManager.invalidate('bundled_data');
            return { success: true, data: { id: catId, ...dataToSave } };
        } catch (err) {
            return { success: false, message: "Gagal menyimpan kategori: " + err.message };
        }
    },

    deleteCategoryOnServer: async function (id) {
        try {
            await firebaseDb.collection('categories').doc(id).delete();
            CacheManager.invalidate('bundled_data');
            return { success: true };
        } catch (err) {
            return { success: false, message: "Gagal menghapus kategori: " + err.message };
        }
    },

    // 6. MANAJEMEN CRUD TEMPLATE KATEGORI (HAK AKSES)
    saveCategoryTemplateOnServer: async function (payload) {
        try {
            const timestamp = new Date().toISOString();
            let tplId = payload.id;
            const dataToSave = {
                nama: payload.nama,
                kategori_ids: payload.kategori_ids || "",
                updated_at: timestamp
            };

            if (tplId) {
                await firebaseDb.collection('category_templates').doc(tplId).set(dataToSave, { merge: true });
            } else {
                tplId = 'ct_' + new Date().getTime();
                dataToSave.id = tplId;
                dataToSave.created_at = timestamp;
                await firebaseDb.collection('category_templates').doc(tplId).set(dataToSave);
            }

            CacheManager.invalidate('bundled_data');
            return { success: true, data: { id: tplId, ...dataToSave } };
        } catch (err) {
            return { success: false, message: "Gagal menyimpan template kategori: " + err.message };
        }
    },

    deleteCategoryTemplateOnServer: async function (id) {
        try {
            await firebaseDb.collection('category_templates').doc(id).delete();
            CacheManager.invalidate('bundled_data');
            return { success: true };
        } catch (err) {
            return { success: false, message: "Gagal menghapus template kategori: " + err.message };
        }
    },

    // 7. MANAJEMEN CRUD TOOLS AI (GEMS)
    saveGemOnServer: async function (payload) {
        try {
            const timestamp = new Date().toISOString();
            let gemId = payload.id;
            const dataToSave = {
                nama: payload.nama || '',
                akses_url: payload.akses_url || '',
                deskripsi: payload.deskripsi || '',
                kategori_id: payload.kategori_id || '',
                updated_at: timestamp
            };

            if (gemId) {
                await firebaseDb.collection('gems').doc(gemId).set(dataToSave, { merge: true });
            } else {
                gemId = 'g_' + new Date().getTime();
                dataToSave.id = gemId;
                dataToSave.created_at = timestamp;
                await firebaseDb.collection('gems').doc(gemId).set(dataToSave);
            }

            CacheManager.invalidate('bundled_data');
            return { success: true, data: { id: gemId, ...dataToSave } };
        } catch (err) {
            return { success: false, message: "Gagal menyimpan Tools AI: " + err.message };
        }
    },

    deleteGemOnServer: async function (id) {
        try {
            await firebaseDb.collection('gems').doc(id).delete();
            CacheManager.invalidate('bundled_data');
            return { success: true };
        } catch (err) {
            return { success: false, message: "Gagal menghapus Tools AI: " + err.message };
        }
    },

    // 8. UPDATE PROFIL PENGGUNA
    updateProfileOnServer: async function (userId, nama, pass) {
        try {
            const updatePayload = { nama: nama, updated_at: new Date().toISOString() };
            if (pass && pass.trim() !== '') {
                updatePayload.password_hash = await hashPassword(pass);
                // Jika user yang aktif saat ini sama, update password Auth
                if (firebaseAuth.currentUser) {
                    try {
                        await firebaseAuth.currentUser.updatePassword(pass);
                    } catch (e) {
                        console.warn("Auth password update non-critical warning:", e);
                    }
                }
            }

            await firebaseDb.collection('users').doc(userId).set(updatePayload, { merge: true });
            CacheManager.invalidate('user_' + userId);
            CacheManager.invalidate('bundled_data');
            return { success: true, nama: nama };
        } catch (err) {
            return { success: false, message: "Gagal memperbarui profil: " + err.message };
        }
    },

    // 9. MANAJEMEN CRUD PENGGUNA
    saveUserOnServer: async function (payload) {
        try {
            const timestamp = new Date().toISOString();
            const tplId = payload.category_template_id || payload.allowed_tools || "";
            const dataToSave = {
                nama: payload.nama || '',
                email: payload.email || '',
                role: payload.role || 'user',
                category_template_id: tplId,
                allowed_tools: tplId,
                updated_at: timestamp
            };

            if (payload.password && payload.password.trim() !== '') {
                dataToSave.password_hash = await hashPassword(payload.password);
            }

            let userId = payload.id;
            if (userId) {
                await firebaseDb.collection('users').doc(userId).set(dataToSave, { merge: true });
            } else {
                // Cek email unik
                const checkSnap = await firebaseDb.collection('users').where('email', '==', payload.email).get();
                if (!checkSnap.empty) {
                    throw new Error("Email (" + payload.email + ") sudah terdaftar di sistem.");
                }

                if (!dataToSave.password_hash) {
                    dataToSave.password_hash = await hashPassword('user123');
                }

                userId = 'u_' + new Date().getTime() + '_' + Math.floor(Math.random() * 10000);
                dataToSave.id = userId;
                dataToSave.created_at = timestamp;
                await firebaseDb.collection('users').doc(userId).set(dataToSave);
            }

            CacheManager.invalidate('bundled_data');
            return { success: true, data: { id: userId, ...dataToSave }, message: "Pengguna berhasil disimpan!" };
        } catch (err) {
            return { success: false, message: "Gagal menyimpan pengguna: " + err.message };
        }
    },

    deleteUserOnServer: async function (id, activeUserId) {
        try {
            if (activeUserId === id) {
                throw new Error("Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.");
            }
            await firebaseDb.collection('users').doc(id).delete();
            CacheManager.invalidate('bundled_data');
            return { success: true };
        } catch (err) {
            return { success: false, message: "Gagal menghapus pengguna: " + err.message };
        }
    },

    // 10. MANAJEMEN CRUD PROMPTS
    savePromptOnServer: async function (payload) {
        try {
            const timestamp = new Date().toISOString();
            let promptId = payload.id;
            const dataToSave = {
                judul: payload.judul || '',
                deskripsi: payload.deskripsi || '',
                prompt_text: payload.prompt_text || '',
                kategori_id: payload.kategori_id || '',
                updated_at: timestamp
            };

            if (promptId) {
                await firebaseDb.collection('prompts').doc(promptId).set(dataToSave, { merge: true });
            } else {
                promptId = 'p_' + new Date().getTime();
                dataToSave.id = promptId;
                dataToSave.created_at = timestamp;
                await firebaseDb.collection('prompts').doc(promptId).set(dataToSave);
            }

            CacheManager.invalidate('bundled_data');
            return { success: true, id: promptId };
        } catch (err) {
            return { success: false, message: "Gagal menyimpan prompt: " + err.message };
        }
    },

    deletePromptOnServer: async function (id) {
        try {
            await firebaseDb.collection('prompts').doc(id).delete();
            CacheManager.invalidate('bundled_data');
            return { success: true };
        } catch (err) {
            return { success: false, message: "Gagal menghapus prompt: " + err.message };
        }
    },

    // 11. MANAJEMEN CRUD TEMPLATES APP
    saveTemplateOnServer: async function (payload) {
        try {
            const timestamp = new Date().toISOString();
            let tplId = payload.id;
            const dataToSave = {
                foto_app: payload.foto_app || '',
                kategori_id: payload.kategori_id || '',
                nama_app: payload.nama_app || '',
                deskripsi_app: payload.deskripsi_app || '',
                demo_url: payload.demo_url || '',
                link_code: payload.link_code || '',
                is_in_gallery: payload.is_in_gallery === true || payload.is_in_gallery === 'true',
                updated_at: timestamp
            };

            if (tplId) {
                await firebaseDb.collection('templates').doc(tplId).set(dataToSave, { merge: true });
            } else {
                tplId = 't_' + new Date().getTime();
                dataToSave.id = tplId;
                dataToSave.created_at = timestamp;
                await firebaseDb.collection('templates').doc(tplId).set(dataToSave);
            }

            CacheManager.invalidate('bundled_data');
            return { success: true, data: { id: tplId, ...dataToSave } };
        } catch (err) {
            return { success: false, message: "Gagal menyimpan Template App: " + err.message };
        }
    },

    deleteTemplateOnServer: async function (id) {
        try {
            await firebaseDb.collection('templates').doc(id).delete();
            CacheManager.invalidate('bundled_data');
            return { success: true };
        } catch (err) {
            return { success: false, message: "Gagal menghapus Template App: " + err.message };
        }
    },

    // 12. MANAJEMEN REQUEST PEMBUATAN APLIKASI
    saveAppRequestOnServer: async function (payload) {
        try {
            const timestamp = new Date().toISOString();
            const reqId = 'req_' + new Date().getTime();
            const dataToSave = {
                id: reqId,
                nama_pemohon: (payload.nama_pemohon || payload.nama || 'Anonim').toString().trim(),
                judul_app: (payload.judul_app || payload.judul || 'Tanpa Judul').toString().trim(),
                deskripsi_app: (payload.deskripsi_app || payload.deskripsi || '').toString().trim(),
                status: payload.status || 'Pending',
                created_at: timestamp
            };

            await firebaseDb.collection('app_requests').doc(reqId).set(dataToSave);
            CacheManager.invalidate('bundled_data');
            return { success: true, data: dataToSave, message: "Request pembuatan aplikasi berhasil dikirim!" };
        } catch (err) {
            return { success: false, message: "Gagal mengirim request aplikasi: " + err.message };
        }
    },

    updateAppRequestStatusOnServer: async function (id, status) {
        try {
            await firebaseDb.collection('app_requests').doc(id).set({
                status: status,
                updated_at: new Date().toISOString()
            }, { merge: true });
            CacheManager.invalidate('bundled_data');
            return { success: true, id: id, status: status };
        } catch (err) {
            return { success: false, message: err.message };
        }
    },

    deleteAppRequestOnServer: async function (id) {
        try {
            await firebaseDb.collection('app_requests').doc(id).delete();
            CacheManager.invalidate('bundled_data');
            return { success: true };
        } catch (err) {
            return { success: false, message: err.message };
        }
    },

    // 13. SEEDER DATA OTOMATIS JIKA DATABASE FIRESTORE KOSONG
    seedAllDataIfNeeded: async function () {
        try {
            const checkCat = await firebaseDb.collection('categories').limit(1).get();
            if (checkCat.empty) {
                await this.seedAllData();
            }
        } catch (e) {
            console.warn("Seeder check warning:", e);
        }
    },

    seedAllData: async function () {
        const now = new Date().toISOString();
        const batch = firebaseDb.batch();

        // 1. Categories
        const categories = [
            { id: 'c_genai', nama: 'Generative AI & Prompting', created_at: now },
            { id: 'c_webdev', nama: 'Web App Development & Cloud', created_at: now },
            { id: 'c_design', nama: 'UI/UX & Digital Product Design', created_at: now },
            { id: 'c_mobile', nama: 'Mobile App Development', created_at: now },
            { id: 'c_datasci', nama: 'Data Science & Machine Learning', created_at: now }
        ];
        categories.forEach(item => batch.set(firebaseDb.collection('categories').doc(item.id), item));

        // 2. Category Templates
        const templates = [
            { id: 'ct_vip', nama: 'Paket Full Access VIP', kategori_ids: 'c_genai,c_webdev,c_design,c_mobile,c_datasci', created_at: now },
            { id: 'ct_starter', nama: 'Paket Starter Web & Design', kategori_ids: 'c_webdev,c_design', created_at: now },
            { id: 'ct_ai_spec', nama: 'Paket Spesialis AI & Data Science', kategori_ids: 'c_genai,c_datasci', created_at: now },
            { id: 'ct_mobile_spec', nama: 'Paket Spesialis Mobile & Web App', kategori_ids: 'c_webdev,c_mobile', created_at: now }
        ];
        templates.forEach(item => batch.set(firebaseDb.collection('category_templates').doc(item.id), item));

        // 3. Users Initial
        const adminPass = await hashPassword('admin123');
        const userPass = await hashPassword('user123');
        const users = [
            { id: 'u_admin', email: 'admin@nexcoedu.com', password_hash: adminPass, nama: 'Iwan Setiawan (Admin Utama)', role: 'admin', category_template_id: '', created_at: now },
            { id: 'u_budi', email: 'user@nexcoedu.com', password_hash: userPass, nama: 'Budi Siswanto (Siswa VIP)', role: 'user', category_template_id: 'ct_vip', created_at: now },
            { id: 'u_siti', email: 'siti@nexcoedu.com', password_hash: userPass, nama: 'Siti Rahmawati (Starter Web)', role: 'user', category_template_id: 'ct_starter', created_at: now },
            { id: 'u_agus', email: 'agus@nexcoedu.com', password_hash: userPass, nama: 'Agus Pratama (AI Specialist)', role: 'user', category_template_id: 'ct_ai_spec', created_at: now },
            { id: 'u_dewi', email: 'dewi@nexcoedu.com', password_hash: userPass, nama: 'Dewi Anggraini (Mobile Dev)', role: 'user', category_template_id: 'ct_mobile_spec', created_at: now }
        ];
        users.forEach(item => batch.set(firebaseDb.collection('users').doc(item.id), item));

        // 4. Videos
        const videos = [
            { id: 'v_1', judul: 'Fundamental Generative AI & Prompting', deskripsi: '<h3>Panduan Utama Generative AI</h3><p>Pelajari konsep dasar <strong>Large Language Models (LLM)</strong> dan cara menyusun prompt yang efektif untuk otomasi pekerjaan harian.</p>', video_url: 'https://www.youtube.com/watch?v=kCc8FmEb1nY', kategori_id: 'c_genai', urutan: 1, created_at: now },
            { id: 'v_2', judul: 'Membangun Chatbot AI Otonom dengan Gemini API', deskripsi: '<h3>Integrasi Gemini 3.1 Flash API</h3><p>Tutorial praktis menghubungkan Google Apps Script dengan <strong>Gemini API</strong>.</p>', video_url: 'https://www.youtube.com/watch?v=dFzc7yM0p4Q', kategori_id: 'c_genai', urutan: 2, created_at: now },
            { id: 'v_3', judul: 'Modern Full-Stack Web Architecture dengan Google Apps Script', deskripsi: '<h3>Arsitektur Serverless Web App</h3><p>Membuat aplikasi web modern cepat berbasis RESTful API.</p>', video_url: 'https://www.youtube.com/watch?v=w7ejDZ8SWv8', kategori_id: 'c_webdev', urutan: 1, created_at: now },
            { id: 'v_4', judul: 'Desain Dashboard Enterprise Responsif & Dark Mode', deskripsi: '<h3>Prinsip UI/UX Dashboard</h3><p>Panduan mendesain tata letak dashboard yang nyaman di mata.</p>', video_url: 'https://www.youtube.com/watch?v=ZvN8iSmzB50', kategori_id: 'c_webdev', urutan: 2, created_at: now }
        ];
        videos.forEach(item => batch.set(firebaseDb.collection('videos').doc(item.id), item));

        // 5. Gems (AI Tools)
        const gems = [
            { id: 'g_1', nama: 'ChatGPT Pro Assistant', akses_url: 'https://chatgpt.com', deskripsi: 'Asisten AI serbaguna untuk penulisan kode, analisa dokumen, dan riset cepat.', kategori_id: 'c_genai', created_at: now },
            { id: 'g_2', nama: 'Claude Sonnet Architect', akses_url: 'https://claude.ai', deskripsi: 'Spesialis analisis arsitektur perangkat lunak dan penulisan dokumen teknis mendalam.', kategori_id: 'c_genai', created_at: now },
            { id: 'g_3', nama: 'Midjourney Image Studio', akses_url: 'https://midjourney.com', deskripsi: 'Generasi aset visual, logo, dan ilustrasi UI berkualitas profesional.', kategori_id: 'c_design', created_at: now }
        ];
        gems.forEach(item => batch.set(firebaseDb.collection('gems').doc(item.id), item));

        // 6. Prompts
        const prompts = [
            { id: 'p_1', judul: 'Arsitektur Full-Stack Clean Code', deskripsi: 'Prompt untuk menghasilkan struktur kode web app modular', prompt_text: 'Rancang arsitektur aplikasi web full-stack yang modular, handal...', kategori_id: 'c_webdev', created_at: now },
            { id: 'p_2', judul: 'Design System Token Generator', deskripsi: 'Prompt untuk menghasilkan palet warna HEX dan variabel CSS', prompt_text: 'Rancang token sistem desain lengkap dengan variabel warna CSS...', kategori_id: 'c_design', created_at: now }
        ];
        prompts.forEach(item => batch.set(firebaseDb.collection('prompts').doc(item.id), item));

        // 7. App Templates & Showcase Apps
        const appTemplates = [
            {
                id: 't_inventaris',
                nama_app: 'Gas UMKM (WebApp Inventaris)',
                kategori_id: 'c_genai',
                foto_app: '/demo image/inventaris.jpg',
                demo_url: 'https://script.google.com/macros/s/AKfycbx88seLsCE3Unc7Gyvf5v2Asy1m080Y-10gsMpghw6HN7--fZJDGSfStsCSjCHY29ts/exec',
                link_code: 'https://github.com/nexco/gas-umkm',
                deskripsi_app: 'Gas UMKM adalah solusi platform manajemen inventaris (webapp) berbasis digital yang dirancang khusus untuk meningkatkan efisiensi operasional dan akurasi tata kelola logistik usaha. Terintegrasi Gas Gem AI Asisten (Gemini 3.1 Flash-Lite) untuk pengelolaan database interaktif.<br/><br/>Akun Login:<br/>Username: admin<br/>Password: admin123<br/>Lalu ke pengaturan > Klik simpan Api Key agar Kalian bisa coba chatbotnya.',
                is_in_gallery: true,
                created_at: now
            },
            {
                id: 't_tahfidz',
                nama_app: 'TahfidzQ (Pencatatan Tahfidz)',
                kategori_id: 'c_webdev',
                foto_app: '/demo image/tahfidz.webp',
                demo_url: 'https://script.google.com/macros/s/AKfycbwNo_bVTcKmnLmLj7TYHkeS1gIV7KThjfbHPLwbxongpVigao2MRb7e6czuKQBcVW5f/exec',
                link_code: 'https://github.com/nexco/tahfidzq',
                deskripsi_app: 'TahfidzQ adalah platform berbasis web responsif (webapp) untuk memodernisasi tata kelola dan pencatatan progres hafalan Al-Qur\'an secara digital dengan peran khusus santri dan pengajar.<br/><br/>Akun Login:<br/>Username (pengajar): hanan | Password: 123<br/>Username (santri): Yusuf | Password: 123',
                is_in_gallery: true,
                created_at: now
            },
            {
                id: 't_perpus',
                nama_app: 'Pustaka Pro (Manajemen Perpustakaan)',
                kategori_id: 'c_webdev',
                foto_app: '/demo image/perpus.webp',
                demo_url: 'https://script.google.com/macros/s/AKfycbwNo_bVTcKmnLmLj7TYHkeS1gIV7KThjfbHPLwbxongpVigao2MRb7e6czuKQBcVW5f/exec',
                link_code: 'https://github.com/nexco/pustaka-pro',
                deskripsi_app: 'Pustaka Pro adalah platform web-based application (Administrator Console) untuk digitalisasi, otomatisasi, dan optimalisasi tata kelola operasional perpustakaan dan sirkulasi peminjaman secara transparan dan real-time.<br/><br/>Akun Login:<br/>Username: admin | Password: admin123',
                is_in_gallery: true,
                created_at: now
            },
            {
                id: 't_uang',
                nama_app: 'Dompet Pintar (Manajemen Keuangan)',
                kategori_id: 'c_genai',
                foto_app: '/demo image/uang.webp',
                demo_url: 'https://script.google.com/macros/s/AKfycbwtFBCZ1tKT81yoRhHlo8113_S3Y_Bu1_gdoNBMsJc4EfH-ZA9rzCvEX9BXXrrNCE3m9w/exec',
                link_code: 'https://github.com/nexco/dompet-pintar',
                deskripsi_app: 'Dompet Pintar adalah platform aplikasi seluler responsif untuk pencatatan, pelacakan, dan analisis tata kelola finansial personal secara digital yang terintegrasi AI Chatbot.<br/>Untuk mencoba Chatbot: ke pengaturan > Klik simpan Api Key, lalu kalian bisa Chat dengan Chatbotnya.',
                is_in_gallery: true,
                created_at: now
            }
        ];
        appTemplates.forEach(item => batch.set(firebaseDb.collection('templates').doc(item.id), item));

        // 8. Settings
        batch.set(firebaseDb.collection('settings').doc('global'), { ai_api_key: '', updated_at: now });

        await batch.commit();
        console.log("Firebase Firestore Seeder Data berhasil dieksekusi!");
    }
};

window.FirebaseService = FirebaseService;
