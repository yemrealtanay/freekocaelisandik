const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { getDb, GOLCUK_NEIGHBORHOODS } = require('../db');
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
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSearchIndex(member) {
  const parts = [
    member.sno,
    member.first_name,
    member.last_name,
    member.phone,
    member.neighborhood,
    member.district
  ];
  return parts.filter(Boolean).map(normalizeText).join(' ');
}

function parseExcelWorksheet(worksheet) {
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  if (!rawRows || rawRows.length === 0) return { headers: [], dataRows: [], headerRowIndex: 0 };

  const keywords = ['sno', 'ad', 'adi', 'soyad', 'soyadi', 'telefon', 'mahalle'];
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) continue;
    const matches = row.filter(cell => {
      const s = String(cell).toLowerCase().trim().replace(/ı/g, 'i').replace(/[^a-z0-9]/g, '');
      return keywords.some(kw => s.includes(kw));
    });
    if (matches.length >= 2) {
      headerRowIndex = i;
      break;
    }
  }

  const rawHeaders = rawRows[headerRowIndex] || [];
  const headers = rawHeaders.map((h, i) => {
    const str = String(h || '').trim();
    return str ? str : `Sütun_${i + 1}`;
  });

  const dataRows = [];
  for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!Array.isArray(row) || row.every(c => c === "" || c === null || c === undefined)) {
      continue;
    }
    const obj = {};
    headers.forEach((h, colIdx) => {
      obj[h] = row[colIdx] !== undefined ? String(row[colIdx]).trim() : '';
    });
    if (Object.values(obj).some(v => v !== '')) {
      dataRows.push(obj);
    }
  }

  return { headers, dataRows, headerRowIndex };
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
    
    const { headers, dataRows } = parseExcelWorksheet(worksheet);
    if (dataRows.length === 0 || headers.length === 0) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Excel dosyasında geçerli veri bulunamadı.' });
    }

    const guessedMapping = {
      sno: '',
      first_name: '',
      last_name: '',
      phone: '',
      neighborhood: ''
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
      sno: ['sno', 'sirano', 'sira', 'sn', 'no'],
      first_name: ['adi', 'ad', 'isim', 'firstname', 'adiniz'],
      last_name: ['soyadi', 'soyad', 'soyisim', 'lastname', 'soyadiniz'],
      phone: ['telefon', 'ceptelefon', 'tel', 'phone', 'gsm', 'cep', 'mobil', 'telefonno'],
      neighborhood: ['mahalle', 'mah', 'mahallesi', 'koy', 'semt', 'adres']
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

    const previewRows = dataRows.slice(0, 5);

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
  const { tempFileId, district = 'Gölcük', mapping } = req.body;

  if (!tempFileId || !mapping) {
    return res.status(400).json({ message: 'Dosya ve sütun eşleştirmesi zorunludur.' });
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

    await logAction(req, 'EXCEL_UPLOAD', `${district} ilçesi için üye listesi aktarımı başlatıldı.`);

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

// Match raw neighborhood against the 48 official Golcuk neighborhoods
function resolveGolcukNeighborhood(raw) {
  if (!raw) return 'MERKEZ MAH.';
  const trimmed = raw.toString().trim().toUpperCase()
    .replace(/İ/g, 'I')
    .replace(/İ/g, 'I');

  const match = GOLCUK_NEIGHBORHOODS.find(n => {
    const nNorm = n.toUpperCase().replace(/İ/g, 'I').replace(/İ/g, 'I');
    return nNorm === trimmed || trimmed.includes(nNorm) || nNorm.includes(trimmed);
  });

  return match || 'MERKEZ MAH.';
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
    
    const { dataRows: rows } = parseExcelWorksheet(worksheet);

    let successCount = 0;
    let errorCount = 0;

    const today = new Date().toISOString().split('T')[0];
    const targetDistrict = district || 'Gölcük';

    const map = mapping || {
      sno: 'SNo',
      first_name: 'Adı',
      last_name: 'Soyadı',
      phone: 'Telefon',
      neighborhood: 'Mahalle'
    };

    await db.run('BEGIN TRANSACTION');

    for (const row of rows) {
      const getValue = (key, fallbackKeys = []) => {
        if (map && map[key] && row[map[key]] !== undefined) {
          return String(row[map[key]]).trim();
        }
        for (const fk of fallbackKeys) {
          if (row[fk] !== undefined) return String(row[fk]).trim();
        }
        return '';
      };

      const rawSno = getValue('sno', ['SNo', 'S.No', 'Sira', 'No']);
      const parsedSno = rawSno ? parseInt(rawSno, 10) : null;
      const firstName = getValue('first_name', ['Adı', 'Adi', 'AD', 'Ad']).toUpperCase();
      const lastName = getValue('last_name', ['Soyadı', 'Soyadi', 'SOYADI', 'Soyad']).toUpperCase();
      const rawPhone = getValue('phone', ['Telefon', 'TELEFON', 'CepTelefon', 'Tel']);
      const rawNeighborhood = getValue('neighborhood', ['Mahalle', 'MAHALLE', 'Mah']);

      if (!firstName || !lastName) {
        continue;
      }

      const neighborhood = resolveGolcukNeighborhood(rawNeighborhood);

      // Normalize phone
      let normalizedPhone = rawPhone.replace(/\D/g, '');
      if (normalizedPhone.startsWith('90') && normalizedPhone.length === 12) {
        normalizedPhone = normalizedPhone.substring(2);
      }
      if (normalizedPhone.startsWith('0') && normalizedPhone.length === 11) {
        normalizedPhone = normalizedPhone.substring(1);
      }

      try {
        let existingMember = null;
        if (parsedSno) {
          existingMember = await db.get(
            'SELECT id, neighborhood, phone FROM members WHERE sno = ? AND district = ?',
            [parsedSno, targetDistrict]
          );
        }

        if (!existingMember && normalizedPhone) {
          existingMember = await db.get(
            'SELECT id, neighborhood, phone FROM members WHERE first_name = ? AND last_name = ? AND phone = ? AND district = ?',
            [firstName, lastName, normalizedPhone, targetDistrict]
          );
        }

        if (!existingMember) {
          existingMember = await db.get(
            'SELECT id, neighborhood, phone FROM members WHERE first_name = ? AND last_name = ? AND district = ?',
            [firstName, lastName, targetDistrict]
          );
        }

        if (existingMember) {
          // Update existing member fields
          const searchIndex = buildSearchIndex({
            sno: parsedSno,
            first_name: firstName,
            last_name: lastName,
            phone: normalizedPhone || existingMember.phone,
            district: targetDistrict,
            neighborhood
          });

          await db.run(
            `UPDATE members 
             SET sno = ?, phone = COALESCE(NULLIF(?, ''), phone), neighborhood = ?, search_index = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [parsedSno, normalizedPhone, neighborhood, searchIndex, existingMember.id]
          );
          successCount++;
          continue;
        }

        // Insert new member
        const memberId = 'member-' + Math.random().toString(36).substr(2, 9);
        const searchIndex = buildSearchIndex({
          sno: parsedSno,
          first_name: firstName,
          last_name: lastName,
          phone: normalizedPhone,
          district: targetDistrict,
          neighborhood
        });

        await db.run(
          `INSERT INTO members (id, sno, first_name, last_name, phone, district, neighborhood, vote_stance, contact_status, has_voted, search_index)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'BELIRTILMEDI', 'GORUSULMEDI', 0, ?)`,
          [memberId, parsedSno, firstName, lastName, normalizedPhone, targetDistrict, neighborhood, searchIndex]
        );

        const eventId = 'event-' + Math.random().toString(36).substr(2, 9);
        await db.run(
          'INSERT INTO timeline_events (id, member_id, user_id, type, date, note) VALUES (?, ?, ?, ?, ?, ?)',
          [eventId, memberId, userId, 'SYSTEM', today, 'Excel içe aktarma ile listeye eklendi.']
        );

        successCount++;
      } catch (err) {
        console.error('Row insert error:', err, row);
        errorCount++;
      }
    }

    await db.run('COMMIT');

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
        // Rollback failed or already completed
      }
    }
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
