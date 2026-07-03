const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { getDb } = require('../db');
const { requireAdmin } = require('../auth');

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

// POST /api/uploads (Upload Excel and parse async, Admin only)
router.post('/', requireAdmin, upload.single('excel'), async (req, res) => {
  const { district } = req.body;

  if (!req.file) {
    return res.status(400).json({ message: 'Lütfen bir Excel dosyası yükleyin.' });
  }

  if (!district) {
    // Delete file if district is missing
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ message: 'Lütfen yüklenecek ilçeyi seçin.' });
  }

  const uploadId = 'upload-' + Math.random().toString(36).substr(2, 9);
  const filePath = req.file.path;
  const fileName = req.file.filename;

  try {
    const db = await getDb();
    
    // Save initial PENDING status
    await db.run(
      'INSERT INTO uploads (id, district, filename, status) VALUES (?, ?, ?, ?)',
      [uploadId, district, fileName, 'PENDING']
    );

    // Start background processing
    processExcelInBackground(uploadId, filePath, district, req.user.id);

    // Return success response immediately
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

// Background Worker
async function processExcelInBackground(uploadId, filePath, district, userId) {
  let db;
  try {
    db = await getDb();
    
    // Update status to PROCESSING
    await db.run('UPDATE uploads SET status = ? WHERE id = ?', ['PROCESSING', uploadId]);

    // Parse Excel workbook
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with empty fields as empty string
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    let successCount = 0;
    let errorCount = 0;

    const today = new Date().toISOString().split('T')[0];

    // Read rows sequentially (sqlite3 runs single-threaded, transactions are best)
    await db.run('BEGIN TRANSACTION');

    for (const row of rows) {
      // Map columns case-insensitively or standard naming
      // Headers: TCKN, Adi, Soyadi, CepTelefon, IlAdi, IlceAdi, SandikAlani, SandikNo, Aciklama
      const tckn = String(row['TCKN'] || '').trim();
      const firstName = String(row['Adi'] || row['AD'] || row['Ad'] || '').trim().toUpperCase();
      const lastName = String(row['Soyadi'] || row['SOYADI'] || row['Soyad'] || '').trim().toUpperCase();
      let phone = String(row['CepTelefon'] || row['Telefon'] || row['TELEFON'] || '').trim();
      const province = String(row['IlAdi'] || row['IL'] || 'KOCAELİ').trim().toUpperCase();
      const rowDistrict = String(row['IlceAdi'] || row['ILCE'] || district).trim().toUpperCase();
      const school = String(row['SandikAlani'] || row['Okul'] || row['YER'] || '').trim();
      const ballotNo = String(row['SandikNo'] || '').trim();
      const aciklama = String(row['Aciklama'] || row['Not'] || '').trim();

      if (!firstName || !lastName) {
        // Skip invalid rows
        continue;
      }

      // Format telephone (e.g. remove spaces, handle leading zero)
      // Standard format in db can be just digits or formatted. We can normalize it.
      let normalizedPhone = phone.replace(/\D/g, '');
      if (normalizedPhone.startsWith('90') && normalizedPhone.length === 12) {
        normalizedPhone = normalizedPhone.substring(2);
      }
      if (normalizedPhone.startsWith('0') && normalizedPhone.length === 11) {
        normalizedPhone = normalizedPhone.substring(1);
      }

      try {
        // Upsert Member logic:
        // Try to find matching member by TCKN (if provided) or (firstName, lastName, phone)
        let existingMember = null;
        if (tckn) {
          existingMember = await db.get('SELECT * FROM members WHERE tckn = ? AND district = ?', [tckn, district]);
        }
        
        if (!existingMember && normalizedPhone) {
          existingMember = await db.get(
            'SELECT * FROM members WHERE first_name = ? AND last_name = ? AND phone LIKE ? AND district = ?',
            [firstName, lastName, '%' + normalizedPhone, district]
          );
        }

        let memberId;

        if (existingMember) {
          memberId = existingMember.id;
          // Update details
          await db.run(
            `UPDATE members 
             SET tckn = ?, phone = ?, province = ?, school = ?, ballot_no = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
              tckn || existingMember.tckn,
              normalizedPhone || existingMember.phone,
              province,
              school || existingMember.school,
              ballotNo || existingMember.ballot_no,
              memberId
            ]
          );
        } else {
          memberId = 'member-' + Math.random().toString(36).substr(2, 9);
          await db.run(
            `INSERT INTO members (id, tckn, first_name, last_name, phone, province, district, school, ballot_no, role)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'GOREVSIZ')`,
            [memberId, tckn, firstName, lastName, normalizedPhone, province, district, school, ballotNo]
          );
        }

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
