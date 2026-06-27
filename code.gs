/**
 * Nexco Edu - Backend Server (Overhauled & Restructured)
 * Sinkronisasi 100% dengan fungsi pemanggilan di Index.html
 * * Sesi dikelola sepenuhnya oleh Client (Stateless) guna mencegah session bleeding pada eksekusi server terpusat.
 */

// Mengambil Spreadsheet aktif secara aman (skrip harus terikat/bound dengan Spreadsheet)
function getActiveSS() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("Tidak dapat mengakses Spreadsheet aktif. Pastikan skrip Apps Script ini terikat (bound) pada dokumen Spreadsheet Anda.");
  }
  return ss;
}

// 1. WEB APP ENTRY POINT (Menyajikan Tampilan HTML)
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Nexco Edu')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// FUNGSI MENERIMA PERMINTAAN API DARI HOSTING EKSTERNAL (Fungsionalitas Integrasi Baru)
function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    const args = postData.arguments || [];
    
    let result;
    // Jalankan fungsi secara dinamis sesuai nama aksi yang dilemparkan klien eksternal
    if (typeof this[action] === 'function') {
      result = this[action].apply(null, args);
    } else {
      throw new Error("Fungsi " + action + " tidak didefinisikan di cloud backend.");
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "GAS doPost Fatal Error: " + err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Helper: Konversi paksa objek Date ke String format ISO sebelum dikirim ke browser (Anti-Null Bug GAS)
function sanitizeData(rows) {
  return rows.map(row => {
    const cleanRow = {};
    for (let key in row) {
      if (row[key] instanceof Date) {
        cleanRow[key] = row[key].toISOString();
      } else {
        cleanRow[key] = row[key];
      }
    }
    return cleanRow;
  });
}

// Helper: Enkripsi Kata Sandi Native SHA-256
function hashPassword(password) {
  try {
    const rawHash = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256, 
      password, 
      Utilities.Charset.UTF_8
    );
    let hash = "";
    for (let i = 0; i < rawHash.length; i++) {
      let byteValue = rawHash[i];
      if (byteValue < 0) byteValue += 256;
      let byteString = byteValue.toString(16);
      if (byteString.length == 1) byteString = "0" + byteString;
      hash += byteString;
    }
    return hash;
  } catch (err) {
    throw new Error("Gagal mengenkripsi kata sandi: " + err.message);
  }
}

// 2. SETUP DATABASE OTOMATIS & SEEDER AWAL
function setupDatabase() {
  try {
    const ss = getActiveSS();
    
    // Skema Struktur Database Google Sheets (Kolom allowed_tools tetap dijaga untuk validitas struktur, namun nilainya diabaikan)
    const tables = {
      'users': ['id', 'email', 'password_hash', 'nama', 'role', 'allowed_tools', 'created_at'],
      'videos': ['id', 'judul', 'deskripsi', 'video_url', 'ebook_url', 'kategori_id', 'urutan', 'created_at'],
      'gems': ['id', 'nama', 'akses_url', 'image_url', 'deskripsi', 'created_at'],
      'categories': ['id', 'nama', 'created_at'],
      'progress': ['id', 'user_id', 'video_id', 'is_completed', 'is_bookmarked', 'updated_at']
    };

    // Buat sheet secara otomatis jika belum terkonfigurasi
    for (let sheetName in tables) {
      let sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow(tables[sheetName]); 
      } else if (sheet.getLastRow() === 0) {
        sheet.appendRow(tables[sheetName]);
      }
    }

    // Seeder Akun Default
    const userSheet = ss.getSheetByName('users');
    if (userSheet.getLastRow() <= 1) { 
      const adminPass = hashPassword('admin123');
      const userPass = hashPassword('user123');
      userSheet.appendRow(['u_admin', 'admin@nexcoedu.com', adminPass, 'Iwan Setiawan (Admin)', 'admin', '', new Date().toISOString()]);
      userSheet.appendRow(['u_user', 'user@nexcoedu.com', userPass, 'Budi Siswanto', 'user', '', new Date().toISOString()]);
    }

    // Seeder Kategori Default
    const catSheet = ss.getSheetByName('categories');
    if (catSheet.getLastRow() <= 1) {
      catSheet.appendRow(['c1', 'Prompt Engineering', new Date().toISOString()]);
      catSheet.appendRow(['c2', 'Python AI', new Date().toISOString()]);
      catSheet.appendRow(['c3', 'Advanced AI', new Date().toISOString()]);
    }

    // Seeder Modul Video Default
    const videoSheet = ss.getSheetByName('videos');
    if (videoSheet.getLastRow() <= 1) {
      videoSheet.appendRow(['v1', 'Pengenalan Prompt Engineering Dasar', 'Pelajari cara berinteraksi secara optimal dengan LLMs.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://example.com/ebook-prompt.pdf', 'c1', 1, new Date().toISOString()]);
      videoSheet.appendRow(['v2', 'Membuat Agentic AI dengan Python', 'Tutorial membangun agen cerdas otomatis.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://example.com/ebook-python.pdf', 'c2', 2, new Date().toISOString()]);
    }

    // Seeder Tools AI Default
    const gemSheet = ss.getSheetByName('gems');
    if (gemSheet.getLastRow() <= 1) {
      gemSheet.appendRow(['g1', 'ChatGPT Workspace', 'https://chat.openai.com', 'https://images.unsplash.com/photo-1677442136019-21780efad99a?w=400', 'Gunakan ChatGPT Workspace untuk membantu koding terstruktur.', new Date().toISOString()]);
    }

    return "Database Nexco Edu Berhasil Dikonfigurasi!";
  } catch (err) {
    return "Gagal melakukan setup database: " + err.toString();
  }
}

// Helper: Membaca sheet dan memetakan baris menjadi array of objects secara dinamis
function readSheetData(sheetName) {
  const ss = getActiveSS();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  
  const headers = rows[0];
  return rows.slice(1).map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      if (header) {
        let val = row[index];
        // Cast boolean secara eksplisit agar dikenali dengan benar di frontend
        if (header === 'is_completed' || header === 'is_bookmarked') {
          val = (val === true || val === 'true' || val === 1);
        }
        obj[header] = val;
      }
    });
    return obj;
  });
}

// 3. AUTENTIKASI SERVER-SIDE & MANAJEMEN SESI (REVISI SISI SERVER: Tanpa Storage Properties Service untuk menghindari Session Bleeding)
function loginUser(email, password) {
  try {
    const ss = getActiveSS();
    const sheet = ss.getSheetByName('users');
    if (!sheet) return { success: false, message: "Tabel pengguna belum dikonfigurasi. Harap setup database terlebih dahulu." };
    
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0];
    const emailIdx = headers.indexOf('email');
    const passHashIdx = headers.indexOf('password_hash');
    const idIdx = headers.indexOf('id');
    const namaIdx = headers.indexOf('nama');
    const roleIdx = headers.indexOf('role');

    const inputHash = hashPassword(password);

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][emailIdx] === email && rows[i][passHashIdx] === inputHash) {
        const userObj = {
          id: rows[i][idIdx],
          email: rows[i][emailIdx],
          nama: rows[i][namaIdx],
          role: rows[i][roleIdx],
          allowed_tools: "" // Nilai default kosong karena fitur batasan dicabut
        };
        return { success: true, user: userObj };
      }
    }
    return { success: false, message: "Email atau kata sandi Anda salah. Silakan coba kembali." };
  } catch (err) {
    return { success: false, message: "Gagal memproses otentikasi: " + err.toString() };
  }
}

// REVISI SESI: Memverifikasi validitas ID Sesi yang dilemparkan secara stateless dari klien
function checkServerSession(userId) {
  try {
    if (!userId) return { active: false };

    const ss = getActiveSS();
    const sheet = ss.getSheetByName('users');
    if (!sheet) return { active: false };

    const rows = sheet.getDataRange().getValues();
    const headers = rows[0];
    const idIdx = headers.indexOf('id');
    const emailIdx = headers.indexOf('email');
    const namaIdx = headers.indexOf('nama');
    const roleIdx = headers.indexOf('role');

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][idIdx] === userId) {
        return {
          active: true,
          user: {
            id: rows[i][idIdx],
            email: rows[i][emailIdx],
            nama: rows[i][namaIdx],
            role: rows[i][roleIdx],
            allowed_tools: "" // Selalu kosong agar bebas akses
          }
        };
      }
    }
    return { active: false };
  } catch (err) {
    return { active: false, message: err.toString() };
  }
}

// Sesi ditangani lokal, fungsi logout server ditiadakan namun tetap mereturn status sukses agar tidak merusak UI lama
function logoutUser() {
  return { success: true };
}

// 4. PEMUATAN DATA UTAMA (REVISI SISI SERVER: Berdasarkan payload userId dari parameter browser pengakses)
function fetchInitialBundledData(userId) {
  try {
    const videos = sanitizeData(readSheetData('videos'));
    const gems = sanitizeData(readSheetData('gems'));
    const categories = sanitizeData(readSheetData('categories'));
    const allProgress = sanitizeData(readSheetData('progress'));
    
    let userProgress = [];
    let users = [];
    
    if (userId) {
      const allUsers = readSheetData('users');
      const currentUserRecord = allUsers.find(u => u.id === userId);
      if (currentUserRecord) {
        if (currentUserRecord.role === 'admin') {
          // Admin berhak melihat progres belajar seluruh pengguna
          userProgress = allProgress;
          // Hapus hash password demi standar proteksi data pengguna
          users = allUsers.map(u => {
            const { password_hash, ...safeUser } = u;
            return safeUser;
          });
        } else {
          // Pengguna biasa hanya bisa melihat progresnya sendiri
          userProgress = allProgress.filter(p => p.user_id === userId);
        }
      }
    }

    return {
      success: true,
      videos: videos,
      gems: gems,
      categories: categories,
      progress: userProgress,
      users: users
    };
  } catch (err) {
    return { success: false, message: "Gagal memuat bundel data utama: " + err.toString() };
  }
}

// 5. UPDATE PROGRES BELAJAR (SINKRON DENGAN INDEX.HTML OPTIMISTIC UI)
function syncUserProgressOnServer(userId, videoId, statusType, statusValue) {
  try {
    const ss = getActiveSS();
    const sheet = ss.getSheetByName('progress');
    const rows = sheet.getDataRange().getValues();

    let recordFound = false;
    let targetRowNum = -1;
    let currentData = null;

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][1] === userId && rows[i][2] === videoId) {
        recordFound = true;
        targetRowNum = i + 1;
        
        const colIdx = statusType === 'is_completed' ? 4 : 5;
        sheet.getRange(targetRowNum, colIdx).setValue(statusValue);
        sheet.getRange(targetRowNum, 6).setValue(new Date().toISOString());
        
        currentData = {
          id: rows[i][0],
          user_id: userId,
          video_id: videoId,
          is_completed: statusType === 'is_completed' ? statusValue : (rows[i][3] === true || rows[i][3] === 'true'),
          is_bookmarked: statusType === 'is_bookmarked' ? statusValue : (rows[i][4] === true || rows[i][4] === 'true'),
          updated_at: new Date().toISOString()
        };
        break;
      }
    }

    if (!recordFound) {
      const newId = 'p_' + new Date().getTime();
      const isCompleted = statusType === 'is_completed' ? statusValue : false;
      const isBookmarked = statusType === 'is_bookmarked' ? statusValue : false;
      const timestamp = new Date().toISOString();

      sheet.appendRow([newId, userId, videoId, isCompleted, isBookmarked, timestamp]);
      currentData = {
        id: newId,
        user_id: userId,
        video_id: videoId,
        is_completed: isCompleted,
        is_bookmarked: isBookmarked,
        updated_at: timestamp
      };
    }

    SpreadsheetApp.flush();
    return { success: true, data: currentData };
  } catch (err) {
    return { success: false, message: "Gagal mensinkronisasikan progress ke server: " + err.toString() };
  }
}

// 6. MANAJEMEN CRUD VIDEO (SINKRON DENGAN INDEX.HTML)
function saveVideoOnServer(payload) {
  try {
    const ss = getActiveSS();
    const sheet = ss.getSheetByName('videos');
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0];

    const mappedData = {
      judul: payload.judul,
      deskripsi: payload.deskripsi,
      video_url: payload.video_url,
      ebook_url: payload.ebook_url,
      kategori_id: payload.kategori_id,
      urutan: parseInt(payload.urutan) || 1
    };

    if (payload.id) {
      // Edit Data Video Eksisting
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === payload.id) {
          const rowNum = i + 1;
          headers.forEach((header, colIdx) => {
            if (header !== 'id' && header !== 'created_at' && mappedData[header] !== undefined) {
              sheet.getRange(rowNum, colIdx + 1).setValue(mappedData[header]);
            }
          });
          SpreadsheetApp.flush();
          
          const updatedObj = { id: payload.id, ...mappedData, created_at: rows[i][7] };
          return { success: true, data: updatedObj };
        }
      }
      throw new Error("Modul video tidak ditemukan di server.");
    } else {
      // Tambah Data Video Baru
      const newId = 'v_' + new Date().getTime();
      const timestamp = new Date().toISOString();
      const newRow = headers.map(header => {
        if (header === 'id') return newId;
        if (header === 'created_at') return timestamp;
        return mappedData[header] !== undefined ? mappedData[header] : '';
      });
      
      sheet.appendRow(newRow);
      SpreadsheetApp.flush();
      
      const newObj = { id: newId, ...mappedData, created_at: timestamp };
      return { success: true, data: newObj };
    }
  } catch (err) {
    return { success: false, message: "Gagal menyimpan modul video: " + err.toString() };
  }
}

function deleteVideoOnServer(id) {
  try {
    const ss = getActiveSS();
    const sheet = ss.getSheetByName('videos');
    const rows = sheet.getDataRange().getValues();
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === id) {
        sheet.deleteRow(i + 1);
        
        // Hapus sisa progress user terkait video ini agar spreadsheet tidak kotor
        const progSheet = ss.getSheetByName('progress');
        const progRows = progSheet.getDataRange().getValues();
        for (let j = progRows.length - 1; j >= 1; j--) {
          if (progRows[j][2] === id) {
            progSheet.deleteRow(j + 1);
          }
        }
        SpreadsheetApp.flush();
        return { success: true };
      }
    }
    throw new Error("Modul video tidak ditemukan.");
  } catch (err) {
    return { success: false, message: "Gagal menghapus video: " + err.toString() };
  }
}

// 7. MANAJEMEN CRUD KATEGORI (SINKRON DENGAN INDEX.HTML)
function saveCategoryOnServer(payload) {
  try {
    const ss = getActiveSS();
    const sheet = ss.getSheetByName('categories');
    const rows = sheet.getDataRange().getValues();

    if (payload.id) {
      // Edit Kategori Eksisting
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === payload.id) {
          const rowNum = i + 1;
          sheet.getRange(rowNum, 2).setValue(payload.nama);
          SpreadsheetApp.flush();
          return { success: true, data: { id: payload.id, nama: payload.nama, created_at: rows[i][2] } };
        }
      }
      throw new Error("Kategori tidak ditemukan.");
    } else {
      // Tambah Kategori Baru
      const newId = 'c_' + new Date().getTime();
      const timestamp = new Date().toISOString();
      sheet.appendRow([newId, payload.nama, timestamp]);
      SpreadsheetApp.flush();
      return { success: true, data: { id: newId, nama: payload.nama, created_at: timestamp } };
    }
  } catch (err) {
    return { success: false, message: "Gagal menyimpan kategori: " + err.toString() };
  }
}

function deleteCategoryOnServer(id) {
  try {
    const ss = getActiveSS();
    const sheet = ss.getSheetByName('categories');
    const rows = sheet.getDataRange().getValues();
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === id) {
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        return { success: true };
      }
    }
    throw new Error("Kategori tidak ditemukan.");
  } catch (err) {
    return { success: false, message: "Gagal menghapus kategori: " + err.toString() };
  }
}

// 8. MANAJEMEN CRUD TOOLS AI (SINKRON DENGAN INDEX.HTML)
function saveGemOnServer(payload) {
  try {
    const ss = getActiveSS();
    const sheet = ss.getSheetByName('gems');
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0];

    const mappedData = {
      nama: payload.nama,
      akses_url: payload.akses_url,
      image_url: payload.image_url,
      deskripsi: payload.deskripsi
    };

    if (payload.id) {
      // Edit Tools Eksisting
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === payload.id) {
          const rowNum = i + 1;
          headers.forEach((header, colIdx) => {
            if (header !== 'id' && header !== 'created_at' && mappedData[header] !== undefined) {
              sheet.getRange(rowNum, colIdx + 1).setValue(mappedData[header]);
            }
          });
          SpreadsheetApp.flush();
          return { success: true, data: { id: payload.id, ...mappedData, created_at: rows[i][5] } };
        }
      }
      throw new Error("Tools AI tidak ditemukan.");
    } else {
      // Tambah Tools Baru
      const newId = 'g_' + new Date().getTime();
      const timestamp = new Date().toISOString();
      const newRow = headers.map(header => {
        if (header === 'id') return newId;
        if (header === 'created_at') return timestamp;
        return mappedData[header] !== undefined ? mappedData[header] : '';
      });
      sheet.appendRow(newRow);
      SpreadsheetApp.flush();
      return { success: true, data: { id: newId, ...mappedData, created_at: timestamp } };
    }
  } catch (err) {
    return { success: false, message: "Gagal menyimpan konfigurasi Tools AI: " + err.toString() };
  }
}

function deleteGemOnServer(id) {
  try {
    const ss = getActiveSS();
    const sheet = ss.getSheetByName('gems');
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === id) {
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        return { success: true };
      }
    }
    throw new Error("Tools AI tidak ditemukan.");
  } catch (err) {
    return { success: false, message: "Gagal menghapus Tools AI: " + err.toString() };
  }
}

// 9. UPDATE PROFIL PENGGUNA (SINKRON DENGAN INDEX.HTML)
function updateProfileOnServer(userId, nama, pass) {
  try {
    const ss = getActiveSS();
    const sheet = ss.getSheetByName('users');
    const rows = sheet.getDataRange().getValues();
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === userId) {
        const rowNum = i + 1;
        sheet.getRange(rowNum, 4).setValue(nama); // Index kolom 4 = nama
        if (pass && pass.trim() !== '') {
          const hashed = hashPassword(pass);
          sheet.getRange(rowNum, 3).setValue(hashed); // Index kolom 3 = password_hash
        }
        SpreadsheetApp.flush();
        return { success: true, nama: nama };
      }
    }
    throw new Error("Akun pengguna tidak dapat ditemukan.");
  } catch (err) {
    return { success: false, message: "Gagal memperbarui profil: " + err.toString() };
  }
}

// 10. MANAJEMEN CRUD PENGGUNA (REVISI SISI SERVER: Kolom allowed_tools dikirim kosong karena semua pengguna mendapatkan semua akses)
function saveUserOnServer(payload) {
  try {
    const ss = getActiveSS();
    const sheet = ss.getSheetByName('users');
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0];

    const mappedData = {
      nama: payload.nama,
      email: payload.email,
      role: payload.role,
      allowed_tools: "" // Default kosong (Tidak ada batasan selektif tools lagi)
    };

    // Jika kata sandi diisi/diubah
    if (payload.password && payload.password.trim() !== '') {
      mappedData.password_hash = hashPassword(payload.password);
    }

    if (payload.id) {
      // Mode Edit Pengguna
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === payload.id) {
          const rowNum = i + 1;
          headers.forEach((header, colIdx) => {
            if (header !== 'id' && header !== 'created_at' && mappedData[header] !== undefined) {
              sheet.getRange(rowNum, colIdx + 1).setValue(mappedData[header]);
            }
          });
          SpreadsheetApp.flush();
          
          const updatedObj = { 
            id: payload.id, 
            nama: payload.nama,
            email: payload.email,
            role: payload.role,
            allowed_tools: "",
            created_at: rows[i][headers.indexOf('created_at')] 
          };
          return { success: true, data: updatedObj };
        }
      }
      throw new Error("Akun tidak ditemukan di server.");
    } else {
      // Mode Tambah Pengguna Baru (Deteksi Duplikasi Email)
      const emailIdx = headers.indexOf('email');
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][emailIdx] === payload.email) {
          throw new Error("Email ini sudah terdaftar di sistem.");
        }
      }

      const newId = 'u_' + new Date().getTime();
      const timestamp = new Date().toISOString();
      
      // Jika kata sandi kosong pada user baru, set default
      if (!mappedData.password_hash) {
        mappedData.password_hash = hashPassword('user123');
      }

      const newRow = headers.map(header => {
        if (header === 'id') return newId;
        if (header === 'created_at') return timestamp;
        return mappedData[header] !== undefined ? mappedData[header] : '';
      });
      
      sheet.appendRow(newRow);
      SpreadsheetApp.flush();
      
      const newObj = { 
        id: newId, 
        nama: payload.nama,
        email: payload.email,
        role: payload.role,
        allowed_tools: "",
        created_at: timestamp 
      };
      return { success: true, data: newObj };
    }
  } catch (err) {
    return { success: false, message: "Gagal menyimpan pengguna: " + err.toString() };
  }
}

// REVISI SISI SERVER: Menggunakan payload activeUserId dari parameter klien browser untuk membatasi aksi self-delete
function deleteUserOnServer(id, activeUserId) {
  try {
    if (activeUserId === id) {
      throw new Error("Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.");
    }

    const ss = getActiveSS();
    const sheet = ss.getSheetByName('users');
    const rows = sheet.getDataRange().getValues();
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === id) {
        sheet.deleteRow(i + 1);
        
        // Hapus sisa progres agar spreadsheet tetap bersih
        const progSheet = ss.getSheetByName('progress');
        const progRows = progSheet.getDataRange().getValues();
        for (let j = progRows.length - 1; j >= 1; j--) {
          if (progRows[j][1] === id) {
            progSheet.deleteRow(j + 1);
          }
        }
        SpreadsheetApp.flush();
        return { success: true };
      }
    }
    throw new Error("Pengguna tidak ditemukan.");
  } catch (err) {
    return { success: false, message: "Gagal menghapus pengguna: " + err.toString() };
  }
}