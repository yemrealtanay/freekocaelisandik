const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { getDb } = require('../db');
const { requireAdmin } = require('../auth');
const { logAction } = require('../logger');

function normalizeText(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/i̇/g, 'i')
    .replace(/\s+/g, '');
}

function buildSearchIndex(member) {
  const parts = [
    member.first_name,
    member.last_name,
    member.phone,
    member.tckn,
    member.school,
    member.ballot_no,
    member.district
  ];
  return parts.map(normalizeText).join('|');
}

// Configure multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls') {
      cb(null, true);
    } else {
      cb(new Error('Sadece Excel dosyaları (.xlsx, .xls) yüklenebilir.'));
    }
  }
});

// GET /api/uploads/status (List uploads or check specific status, Admin only)
router.get('/status', requireAdmin, async (req, res) => {
  const { id } = req.query;

  try {
    const db = await getDb();
    if (id) {
      const uploadRecord = await db.get('SELECT * FROM uploads WHERE id = ?', [id]);
      if (!uploadRecord) {
        return res.status(404).json({ message: 'Yükleme kaydı bulunamadı.' });
      }
      return res.json(uploadRecord);
    } else {
      // Return 10 most recent uploads
      const uploads = await db.all('SELECT * FROM uploads ORDER BY created_at DESC LIMIT 10');
      return res.json(uploads);
    }
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ message: 'Yükleme durumu sorgulanırken hata oluştu.' });
  }
});

// POST /api/uploads/analyze (Upload Excel for header analysis, Admin only)
router.post('/analyze', requireAdmin, upload.single('excel'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Lütfen bir Excel dosyası seçin.' });
  }

  const filePath = req.file.path;
  const fileName = req.file.filename;

  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    if (rows.length === 0) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Excel dosyasında veri bulunamadı.' });
    }

    const headers = Object.keys(rows[0]);

    const guessedMapping = {
      tckn: '',
      first_name: '',
      last_name: '',
      phone: '',
      ballot_area: '',
      ballot_no: '',
      role: '',
      district_name: '',
      description: ''
    };

    const normalize = (str) => {
      if (!str) return '';
      return str.toString().toLowerCase()
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/[^a-z0-9]/g, '');
    };

    const ruleMaps = {
      tckn: ['tckn', 'tcno', 'tckimlikno', 'tckimlik', 'kimlikno', 'tc', 'tckimliknumarasi'],
      first_name: ['adi', 'ad', 'isim', 'firstname', 'adiniz'],
      last_name: ['soyadi', 'soyad', 'soyisim', 'lastname', 'soyadiniz'],
      phone: ['ceptelefon', 'telefon', 'tel', 'phone', 'gsm', 'cep', 'mobil', 'telefonno'],
      ballot_area: ['sandikalani', 'okul', 'yer', 'adres', 'adresalani', 'okuladi', 'okulu', 'sandikyeri'],
      ballot_no: ['sandikno', 'sandik', 'sandiknumarasi', 'no'],
      role: ['durum', 'durumu', 'rol', 'rolu', 'gorev', 'gorevi', 'role', 'duty', 'position', 'unvan', 'sifat'],
      district_name: ['ilceadi', 'ilce', 'ilcedurumu', 'ilce_adi', 'district', 'town'],
      description: ['aciklama', 'not', 'durum', 'detay', 'description', 'notlar', 'aciklamalar']
    };

    headers.forEach(header => {
      const normHeader = normalize(header);
      Object.keys(ruleMaps).forEach(field => {
        if (!guessedMapping[field]) {
          const matches = ruleMaps[field].some(kw => normHeader === kw || normHeader.includes(kw));
          if (matches) {
            guessedMapping[field] = header;
          }
        }
      });
    });

    const previewRows = rows.slice(0, 3);

    res.json({
      tempFileId: fileName,
      headers,
      guessedMapping,
      previewRows
    });
  } catch (error) {
    console.error('Excel analyze error:', error);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ message: 'Excel dosyası analiz edilemedi.' });
  }
});

// POST /api/uploads/import (Start actual import with user mappings, Admin only)
router.post('/import', requireAdmin, async (req, res) => {
  const { tempFileId, district, mapping } = req.body;

  if (!tempFileId || !district || !mapping) {
    return res.status(400).json({ message: 'Dosya, ilçe ve sütun eşleştirmesi zorunludur.' });
  }

  const uploadPath = path.join(__dirname, '../uploads');
  const filePath = path.join(uploadPath, tempFileId);

  if (!fs.existsSync(filePath)) {
    return res.status(400).json({ message: 'Geçici dosya bulunamadı veya süresi dolmuş.' });
  }

  const uploadId = 'upload-' + Math.random().toString(36).substr(2, 9);

  try {
    const db = await getDb();

    await db.run(
      'INSERT INTO uploads (id, district, filename, status) VALUES (?, ?, ?, ?)',
      [uploadId, district, tempFileId.replace(/^\d+-/, ''), 'PENDING']
    );

    processExcelInBackground(uploadId, filePath, district, req.user.id, mapping);

    const logDetails = district === 'ALL_DISTRICTS'
      ? 'Tüm ilçeler için toplu üye aktarımı başlatıldı (Sütun Eşleştirmeli).'
      : `${district} ilçesi için toplu üye aktarımı başlatıldı (Sütun Eşleştirmeli).`;
    await logAction(req, 'EXCEL_UPLOAD', logDetails);

    res.json({
      message: 'Aktarım işlemi başlatıldı. Durumu takip edebilirsiniz.',
      uploadId,
      status: 'PENDING'
    });
  } catch (error) {
    console.error('Import initiation error:', error);
    res.status(500).json({ message: 'Aktarım başlatılamadı.' });
  }
});

// POST /api/uploads (Upload Excel and parse async, Admin only - Legacy fallback)
router.post('/', requireAdmin, upload.single('excel'), async (req, res) => {
  const { district } = req.body;

  if (!req.file) {
    return res.status(400).json({ message: 'Lütfen bir Excel dosyası yükleyin.' });
  }

  if (!district) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ message: 'Lütfen yüklenecek ilçeyi seçin.' });
  }

  const uploadId = 'upload-' + Math.random().toString(36).substr(2, 9);
  const filePath = req.file.path;
  const fileName = req.file.filename;

  try {
    const db = await getDb();
    
    await db.run(
      'INSERT INTO uploads (id, district, filename, status) VALUES (?, ?, ?, ?)',
      [uploadId, district, fileName, 'PENDING']
    );

    // Call worker without custom mapping (it will use fallback headers)
    processExcelInBackground(uploadId, filePath, district, req.user.id, null);

    await logAction(req, 'EXCEL_UPLOAD', `${district} ilçesi için toplu üye aktarımı başlatıldı.`);

    res.json({
      message: 'Excel dosyası başarıyla yüklendi. Arka planda işleme başlandı.',
      uploadId,
      status: 'PENDING'
    });
  } catch (error) {
    console.error('Upload route error:', error);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ message: 'Yükleme başlatılamadı.' });
  }
});

const DISTRICTS = [
  'Başiskele', 'Çayırova', 'Darıca', 'Derince', 'Dilovası', 
  'Gebze', 'Gölcük', 'İzmit', 'Kandıra', 'Karamürsel', 'Kartepe', 'Körfez'
];

function resolveDistrictName(val) {
  if (!val) return null;
  const normalized = val.toString().trim().toUpperCase()
    .replace(/İ/g, 'I')
    .replace(/ı/g, 'I')
    .replace(/Ğ/g, 'G')
    .replace(/ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/ü/g, 'U')
    .replace(/Ş/g, 'S')
    .replace(/ş/g, 'S')
    .replace(/Ö/g, 'O')
    .replace(/ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/ç/g, 'C');

  return DISTRICTS.find(d => {
    const dNorm = d.toUpperCase()
      .replace(/İ/g, 'I')
      .replace(/ı/g, 'I')
      .replace(/Ğ/g, 'G')
      .replace(/ğ/g, 'G')
      .replace(/Ü/g, 'U')
      .replace(/ü/g, 'U')
      .replace(/Ş/g, 'S')
      .replace(/ş/g, 'S')
      .replace(/Ö/g, 'O')
      .replace(/ö/g, 'O')
      .replace(/Ç/g, 'C')
      .replace(/ç/g, 'C');
    return normalized === dNorm || normalized.includes(dNorm);
  }) || null;
}

// Background Worker
async function processExcelInBackground(uploadId, filePath, district, userId, mapping) {
  let db;
  try {
    db = await getDb();
    
    await db.run('UPDATE uploads SET status = ? WHERE id = ?', ['PROCESSING', uploadId]);

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    let successCount = 0;
    let errorCount = 0;

    const today = new Date().toISOString().split('T')[0];

    const map = mapping || {
      tckn: 'TCKN',
      first_name: 'Adi',
      last_name: 'Soyadi',
      phone: 'CepTelefon',
      ballot_area: 'SandikAlani',
      ballot_no: 'SandikNo',
      role: 'Durumu',
      district_name: 'İlceAdi',
      description: 'Aciklama'
    };

    await db.run('BEGIN TRANSACTION');

    for (const row of rows) {
      const getValueByMapKey = (row, key, defaultFieldName) => {
        if (map && map[key]) {
          return String(row[map[key]] || '').trim();
        }
        if (defaultFieldName === 'first_name') {
          return String(row['Adi'] || row['AD'] || row['Ad'] || '').trim();
        }
        if (defaultFieldName === 'last_name') {
          return String(row['Soyadi'] || row['SOYADI'] || row['Soyad'] || '').trim();
        }
        if (defaultFieldName === 'phone') {
          return String(row['CepTelefon'] || row['Telefon'] || row['TELEFON'] || '').trim();
        }
        if (defaultFieldName === 'ballot_area') {
          return String(row['SandikAlani'] || row['Okul'] || row['YER'] || '').trim();
        }
        if (defaultFieldName === 'ballot_no') {
          return String(row['SandikNo'] || '').trim();
        }
        if (defaultFieldName === 'role') {
          return String(row['Durumu'] || row['Durum'] || row['Rol'] || row['Gorev'] || '').trim();
        }
        if (defaultFieldName === 'district_name') {
          return String(row['İlceAdi'] || row['İlçe'] || row['Ilce'] || row['IlceAdi'] || '').trim();
        }
        if (defaultFieldName === 'description') {
          return String(row['Aciklama'] || row['Not'] || '').trim();
        }
        if (defaultFieldName === 'tckn') {
          return String(row['TCKN'] || '').trim();
        }
        return '';
      };

      const tckn = getValueByMapKey(row, 'tckn', 'tckn');
      const firstName = getValueByMapKey(row, 'first_name', 'first_name').toUpperCase();
      const lastName = getValueByMapKey(row, 'last_name', 'last_name').toUpperCase();
      let phone = getValueByMapKey(row, 'phone', 'phone');
      const province = 'KOCAELİ';
      const school = getValueByMapKey(row, 'ballot_area', 'ballot_area');
      const ballotNo = getValueByMapKey(row, 'ballot_no', 'ballot_no');
      const rawRole = getValueByMapKey(row, 'role', 'role');
      const aciklama = getValueByMapKey(row, 'description', 'description');

      if (!firstName || !lastName) {
        continue;
      }

      // Dynamic District Resolution
      let targetDistrict = district;
      if (district === 'ALL_DISTRICTS') {
        const rowDistrictStr = getValueByMapKey(row, 'district_name', 'district_name');
        targetDistrict = resolveDistrictName(rowDistrictStr);
        if (!targetDistrict) {
          continue; // Skip if district is invalid or outside Kocaeli
        }
      }

      // Role parsing & normalization
      const normalizeRole = (val) => {
        if (!val) return 'GOREVSIZ';
        const s = val.toString().trim().toLowerCase()
          .replace(/ı/g, 'i')
          .replace(/ğ/g, 'g')
          .replace(/ü/g, 'u')
          .replace(/ş/g, 's')
          .replace(/ö/g, 'o')
          .replace(/ç/g, 'c')
          .replace(/[^a-z0-9]/g, '');

        if (s.includes('asiluye') || s === 'asil' || s.includes('asilgorevli')) return 'ASIL_UYE';
        if (s.includes('yedekuye') || s === 'yedek' || (s.includes('yedek') && !s.includes('musahit'))) return 'YEDEK_UYE';
        if (s.includes('yedekmusahit') || (s.includes('yedek') && s.includes('musahit'))) return 'YEDEK_MUSAHIT';
        if (s.includes('musahit')) return 'MUSAHIT';
        if (s.includes('okulsorumluyardimcisi') || s.includes('yardimci')) return 'OKUL_SORUMLU_YARDIMCISI';
        if (s.includes('okulsorumlusu') || s.includes('okulsorumlu')) return 'OKUL_SORUMLUSU';
        if (s.includes('avukat')) return 'AVUKAT';
        if (s.includes('kurye')) return 'KURYE';
        if (s.includes('bilisim')) return 'BILISIM';
        if (s.includes('bolge') || s.includes('mahalle')) return 'BOLGE_MAHALLE';
        
        return 'GOREVSIZ';
      };

      const role = rawRole ? normalizeRole(rawRole) : 'GOREVSIZ';

      // Format telephone (e.g. remove spaces, handle leading zero)
      let normalizedPhone = phone.replace(/\D/g, '');
      if (normalizedPhone.startsWith('90') && normalizedPhone.length === 12) {
        normalizedPhone = normalizedPhone.substring(2);
      }
      if (normalizedPhone.startsWith('0') && normalizedPhone.length === 11) {
        normalizedPhone = normalizedPhone.substring(1);
      }

      try {
        // Duplicate Check Logic:
        let existingMember = null;
        if (tckn) {
          existingMember = await db.get(
            'SELECT id FROM members WHERE first_name = ? AND last_name = ? AND tckn = ? AND district = ?',
            [firstName, lastName, tckn, targetDistrict]
          );
        } else if (normalizedPhone) {
          existingMember = await db.get(
            'SELECT id FROM members WHERE first_name = ? AND last_name = ? AND phone = ? AND district = ?',
            [firstName, lastName, normalizedPhone, targetDistrict]
          );
        } else {
          existingMember = await db.get(
            'SELECT id FROM members WHERE first_name = ? AND last_name = ? AND district = ?',
            [firstName, lastName, targetDistrict]
          );
        }

        if (existingMember) {
          continue;
        }

        // Member doesn't exist, insert new
        const memberId = 'member-' + Math.random().toString(36).substr(2, 9);
        const searchIndex = buildSearchIndex({
          first_name: firstName,
          last_name: lastName,
          phone: normalizedPhone,
          tckn,
          school,
          ballot_no: ballotNo,
          district: targetDistrict
        });
        await db.run(
          `INSERT INTO members (id, tckn, first_name, last_name, phone, province, district, school, ballot_no, role, search_index)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [memberId, tckn, firstName, lastName, normalizedPhone, province, targetDistrict, school, ballotNo, role, searchIndex]
        );

        // Add note/activity if Aciklama is present
        if (aciklama) {
          // Check if same note already exists for this member
          const existingNote = await db.get(
            'SELECT id FROM timeline_events WHERE member_id = ? AND note = ?',
            [memberId, aciklama]
          );
          if (!existingNote) {
            const eventId = 'event-' + Math.random().toString(36).substr(2, 9);
            await db.run(
              'INSERT INTO timeline_events (id, member_id, user_id, type, date, note) VALUES (?, ?, ?, ?, ?, ?)',
              [eventId, memberId, userId, 'NOTE', today, aciklama]
            );
          }
        } else {
          // Log initial import
          const existingImportLog = await db.get(
            "SELECT id FROM timeline_events WHERE member_id = ? AND type = 'SYSTEM' AND note LIKE '%Excel%'",
            [memberId]
          );
          if (!existingImportLog) {
            const eventId = 'event-' + Math.random().toString(36).substr(2, 9);
            await db.run(
              'INSERT INTO timeline_events (id, member_id, user_id, type, date, note) VALUES (?, ?, ?, ?, ?, ?)',
              [eventId, memberId, userId, 'SYSTEM', today, 'Excel içe aktarma ile eklendi/güncellendi.']
            );
          }
        }

        successCount++;
      } catch (err) {
        console.error('Row insert error:', err, row);
        errorCount++;
      }
    }

    await db.run('COMMIT');

    // Update status to COMPLETED
    await db.run(
      'UPDATE uploads SET status = ?, error = ? WHERE id = ?',
      ['COMPLETED', `Başarıyla işlenen: ${successCount}, Hatalı: ${errorCount}`, uploadId]
    );

  } catch (error) {
    console.error('Excel processing error:', error);
    if (db) {
      try {
        await db.run('ROLLBACK');
      } catch (rollbackErr) {
        // Already rolled back or not in transaction
      }
    }
    // Update status to FAILED
    try {
      const db = await getDb();
      await db.run(
        'UPDATE uploads SET status = ?, error = ? WHERE id = ?',
        ['FAILED', error.message || 'Excel dosyası işlenirken teknik hata oluştu.', uploadId]
      );
    } catch (dbErr) {
      console.error('Failed to log error to DB:', dbErr);
    }
  } finally {
    // Delete file to save space
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkErr) {
        console.error('Failed to delete temp file:', unlinkErr);
      }
    }
  }
}

module.exports = router;
