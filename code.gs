/**
 * Nexco Edu - Backend Server (External API Mode)
 * Sesi dikelola sepenuhnya secara stateless oleh Client eksternal.
 */

// Mengambil Spreadsheet aktif secara aman (skrip harus terikat/bound dengan Spreadsheet)
function getActiveSS() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("Tidak dapat mengakses Spreadsheet aktif. Pastikan skrip Apps Script ini terikat (bound) pada dokumen Spreadsheet Anda.");
  }
  return ss;
}

// 1. WEB APP ENTRY POINT (API Endpoint Cek Status untuk External Deploy)
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({
    status: "active",
    message: "Nexco Edu API Server Active (External Mode)"
  })).setMimeType(ContentService.MimeType.JSON);
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
    
    // Skema Struktur Database Google Sheets (Bersih & Sesuai Kebutuhan Aktif)
    const tables = {
      'users': ['id', 'email', 'password_hash', 'nama', 'role', 'allowed_tools', 'created_at'],
      'videos': ['id', 'judul', 'deskripsi', 'video_url', 'ebook_url', 'kategori_id', 'urutan', 'created_at'],
      'gems': ['id', 'nama', 'akses_url', 'image_url', 'deskripsi', 'kategori_id', 'created_at'],
      'categories': ['id', 'nama', 'created_at'],
      'prompts': ['id', 'judul', 'deskripsi', 'prompt_text', 'kategori_id', 'created_at'],
      'settings': ['key', 'value', 'updated_at']
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
      userSheet.appendRow(['u_user', 'user@nexcoedu.com', userPass, 'Budi Siswanto', 'user', 'c1', new Date().toISOString()]);
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
      gemSheet.appendRow(['g1', 'ChatGPT Workspace', 'https://chat.openai.com', 'https://images.unsplash.com/photo-1677442136019-21780efad99a?w=1920&h=1080&fit=crop', 'Gunakan ChatGPT Workspace untuk membantu koding terstruktur.', 'c1', new Date().toISOString()]);
    }

    // Seeder Prompt Templates Default
    const promptSheet = ss.getSheetByName('prompts');
    if (promptSheet.getLastRow() <= 1) {
      promptSheet.appendRow(['p1', 'Prompt Pembuat Landing Page Berkonversi Tinggi', 'Gunakan prompt ini untuk membuat struktur landing page yang berfokus pada konversi penjualan.', 'Tulis teks landing page untuk produk saas HRIS dengan format bento grid. Fokuskan pada value proposition kemudahan onboarding karyawan baru. Sediakan headline, subheadline, 3 benefit utama, dan tombol Call to Action (CTA).', 'c1', new Date().toISOString()]);
      promptSheet.appendRow(['p2', 'Prompt Script Python Chatbot Dasar', 'Template prompt untuk generate script python chatbot telegram.', 'Buatkan script python sederhana menggunakan library python-telegram-bot versi terbaru untuk chatbot auto reply yang membalas kata kunci /start dan info produk.', 'c2', new Date().toISOString()]);
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
        obj[header] = row[index];
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
    const allowedToolsIdx = headers.indexOf('allowed_tools');

    const inputHash = hashPassword(password);

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][emailIdx] === email && rows[i][passHashIdx] === inputHash) {
        const userObj = {
          id: rows[i][idIdx],
          email: rows[i][emailIdx],
          nama: rows[i][namaIdx],
          role: rows[i][roleIdx],
          allowed_tools: allowedToolsIdx !== -1 ? String(rows[i][allowedToolsIdx]) : ""
        };
        return { success: true, user: userObj };
      }
    }
    return { success: false, message: "Email atau kata sandi Anda salah. Silakan coba kembali." };
  } catch (err) {
    return { success: false, message: "Gagal memproses otentikasi: " + err.toString() };
  }
}

function checkServerSession(userId) {
  try {
    const ss = getActiveSS();
    const sheet = ss.getSheetByName('users');
    if (!sheet) return { active: false };
    
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0];
    const emailIdx = headers.indexOf('email');
    const idIdx = headers.indexOf('id');
    const namaIdx = headers.indexOf('nama');
    const roleIdx = headers.indexOf('role');
    const allowedToolsIdx = headers.indexOf('allowed_tools');

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][idIdx] === userId) {
        return {
          active: true,
          user: {
            id: rows[i][idIdx],
            email: rows[i][emailIdx],
            nama: rows[i][namaIdx],
            role: rows[i][roleIdx],
            allowed_tools: allowedToolsIdx !== -1 ? String(rows[i][allowedToolsIdx]) : ""
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

// 4. PEMUATAN DATA UTAMA
function fetchInitialBundledData(userId) {
  try {
    const videos = sanitizeData(readSheetData('videos'));
    const gems = sanitizeData(readSheetData('gems'));
    const categories = sanitizeData(readSheetData('categories'));
    const prompts = sanitizeData(readSheetData('prompts'));
    
    let users = [];
    
    if (userId) {
      const allUsers = readSheetData('users');
      const currentUserRecord = allUsers.find(u => u.id === userId);
      if (currentUserRecord && currentUserRecord.role === 'admin') {
        // Hapus hash password demi standar proteksi data pengguna
        users = allUsers.map(u => {
          const { password_hash, ...safeUser } = u;
          return safeUser;
        });
      }
    }

    const aiApiKey = getAiApiKeyFromServer();

    return {
      success: true,
      videos: videos,
      gems: gems,
      categories: categories,
      prompts: prompts,
      users: users,
      aiApiKey: aiApiKey
    };
  } catch (err) {
    return { success: false, message: "Gagal memuat bundel data utama: " + err.toString() };
  }
}

// Helper & Server Functions untuk AI API Key
function getAiApiKeyFromServer() {
  try {
    const settings = readSheetData('settings');
    const record = settings.find(s => s && String(s.key).trim() === 'ai_api_key');
    return record && record.value ? String(record.value).trim() : '';
  } catch (e) {
    return '';
  }
}

function saveAiApiKeyOnServer(apiKey) {
  try {
    const ss = getActiveSS();
    let sheet = ss.getSheetByName('settings');
    if (!sheet) {
      sheet = ss.insertSheet('settings');
      sheet.appendRow(['key', 'value', 'updated_at']);
    }
    
    const rows = sheet.getDataRange().getValues();
    const timestamp = new Date().toISOString();
    let found = false;
    const cleanKey = String(apiKey || '').trim();
    
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === 'ai_api_key') {
        sheet.getRange(i + 1, 2).setValue(cleanKey);
        sheet.getRange(i + 1, 3).setValue(timestamp);
        found = true;
        break;
      }
    }
    
    if (!found) {
      sheet.appendRow(['ai_api_key', cleanKey, timestamp]);
    }
    SpreadsheetApp.flush();
    return { success: true, aiApiKey: cleanKey };
  } catch (err) {
    return { success: false, message: "Gagal menyimpan AI API Key: " + err.toString() };
  }
}

// 5. MANAJEMEN CRUD VIDEO
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
          
           const updatedObj = { id: payload.id, ...mappedData, created_at: formatHelperDate(rows[i][7]) };
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
        SpreadsheetApp.flush();
        return { success: true };
      }
    }
    throw new Error("Modul video tidak ditemukan.");
  } catch (err) {
    return { success: false, message: "Gagal menghapus video: " + err.toString() };
  }
}

// 6. MANAJEMEN CRUD KATEGORI
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
          return { success: true, data: { id: payload.id, nama: payload.nama, created_at: formatHelperDate(rows[i][2]) } };
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

// 7. MANAJEMEN CRUD TOOLS AI
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
      deskripsi: payload.deskripsi,
      kategori_id: payload.kategori_id
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
           return { success: true, data: { id: payload.id, ...mappedData, created_at: formatHelperDate(rows[i][headers.indexOf('created_at')]) } };
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

// 8. UPDATE PROFIL PENGGUNA
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

// 9. MANAJEMEN CRUD PENGGUNA
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
      allowed_tools: payload.allowed_tools || ""
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
            allowed_tools: payload.allowed_tools || "",
            created_at: rows[i][headers.indexOf('created_at')] 
          };
          return { success: true, data: updatedObj };
        }
      }
      throw new Error("Akun tidak ditemukan di server.");
    } else {
      // Mode Tambah Pengguna Baru
      const emailIdx = headers.indexOf('email');
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][emailIdx] === payload.email) {
          throw new Error("Email ini sudah terdaftar di sistem.");
        }
      }

      const newId = 'u_' + new Date().getTime();
      const timestamp = new Date().toISOString();
      
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
        allowed_tools: payload.allowed_tools || "",
        created_at: timestamp 
      };
      return { success: true, data: newObj };
    }
  } catch (err) {
    return { success: false, message: "Gagal menyimpan pengguna: " + err.toString() };
  }
}

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
        SpreadsheetApp.flush();
        return { success: true };
      }
    }
    throw new Error("Pengguna tidak ditemukan.");
  } catch (err) {
    return { success: false, message: "Gagal menghapus pengguna: " + err.toString() };
  }
}

// 10. MANAJEMEN CRUD PROMPT TEMPLATE
function savePromptOnServer(payload) {
  try {
    const ss = getActiveSS();
    let sheet = ss.getSheetByName('prompts');
    if (!sheet) {
      setupDatabase();
      sheet = ss.getSheetByName('prompts');
    }
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0];

    const mappedData = {
      judul: payload.judul,
      deskripsi: payload.deskripsi,
      prompt_text: payload.prompt_text,
      kategori_id: payload.kategori_id
    };

    if (payload.id) {
      // Edit Mode
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === payload.id) {
          const rowNum = i + 1;
          headers.forEach((header, colIdx) => {
            if (header !== 'id' && header !== 'created_at' && mappedData[header] !== undefined) {
              sheet.getRange(rowNum, colIdx + 1).setValue(mappedData[header]);
            }
          });
          SpreadsheetApp.flush();
          return { success: true, id: payload.id };
        }
      }
      throw new Error("Prompt tidak ditemukan di server.");
    } else {
      // Create Mode
      const newId = 'p_' + new Date().getTime();
      const timestamp = new Date().toISOString();
      const newRow = headers.map(header => {
        if (header === 'id') return newId;
        if (header === 'created_at') return timestamp;
        return mappedData[header] !== undefined ? mappedData[header] : '';
      });
      sheet.appendRow(newRow);
      SpreadsheetApp.flush();
      return { success: true, id: newId };
    }
  } catch (err) {
    return { success: false, message: "Gagal menyimpan prompt: " + err.toString() };
  }
}

function deletePromptOnServer(id) {
  try {
    const ss = getActiveSS();
    const sheet = ss.getSheetByName('prompts');
    if (!sheet) return { success: false, message: "Tabel prompt tidak ditemukan." };
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === id) {
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        return { success: true };
      }
    }
    return { success: false, message: "Data tidak ditemukan." };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

// Helper: Format raw Google Sheets Date object or value to ISO String for safe JSON serialization
function formatHelperDate(val) {
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (!val) return new Date().toISOString();
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? String(val) : d.toISOString();
  } catch (e) {
    return String(val);
  }
}