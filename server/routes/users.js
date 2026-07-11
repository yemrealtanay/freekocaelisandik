const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../db');
const { requireAdmin } = require('../auth');
const { logAction } = require('../logger');

// GET /api/users (List users, Admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const users = await db.all('SELECT id, name, email, district, role, status, created_at FROM users ORDER BY created_at DESC');
    res.json(users);
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ message: 'Kullanıcılar listelenirken hata oluştu.' });
  }
});

// POST /api/users (Create user, Admin only)
router.post('/', requireAdmin, async (req, res) => {
  const { name, email, password, district, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'Ad soyad, e-posta, şifre ve rol zorunludur.' });
  }

  try {
    const db = await getDb();
    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ message: 'Bu e-posta adresi zaten kullanımda.' });
    }

    const userId = 'user-' + Math.random().toString(36).substr(2, 9);
    const passwordHash = await bcrypt.hash(password, 10);
    // If role is ADMIN, district should be null. If role is USER, district can be specified.
    const userDistrict = role === 'ADMIN' ? null : district;

    await db.run(
      'INSERT INTO users (id, name, email, password_hash, district, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, name, email, passwordHash, userDistrict, role, 'ACTIVE']
    );

    await logAction(req, 'USER_CREATE', `${name} (${email}) isimli kullanıcı oluşturuldu. Rol: ${role}, Sorumlu İlçe: ${userDistrict || 'Hepsi'}`);

    res.status(201).json({
      message: 'Kullanıcı başarıyla oluşturuldu.',
      user: { id: userId, name, email, district: userDistrict, role, status: 'ACTIVE' }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Kullanıcı oluşturulurken hata oluştu.' });
  }
});

// PATCH /api/users/:id/status (Toggle user status, Admin only)
router.patch('/:id/status', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['ACTIVE', 'PASSIVE'].includes(status)) {
    return res.status(400).json({ message: 'Geçersiz durum değeri.' });
  }

  if (id === req.user.id) {
    return res.status(400).json({ message: 'Kendi hesabınızı pasif hale getiremezsiniz.' });
  }

  try {
    const db = await getDb();
    const targetUser = await db.get('SELECT name, email FROM users WHERE id = ?', [id]);
    const result = await db.run('UPDATE users SET status = ? WHERE id = ?', [status, id]);
    if (result.changes === 0) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
    }
    
    if (targetUser) {
      await logAction(req, 'USER_STATUS_CHANGE', `${targetUser.name} (${targetUser.email}) kullanıcısının durumu ${status === 'ACTIVE' ? 'Aktif' : 'Pasif'} yapıldı.`);
    }

    res.json({ message: 'Kullanıcı durumu güncellendi.', status });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Kullanıcı durumu güncellenemedi.' });
  }
});

// DELETE /api/users/:id (Delete user, Admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  if (id === req.user.id) {
    return res.status(400).json({ message: 'Kendi hesabınızı silemezsiniz.' });
  }

  try {
    const db = await getDb();
    const targetUser = await db.get('SELECT name, email FROM users WHERE id = ?', [id]);
    const result = await db.run('DELETE FROM users WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
    }

    if (targetUser) {
      await logAction(req, 'USER_DELETE', `${targetUser.name} (${targetUser.email}) kullanıcısı sistemden silindi.`);
    }

    res.json({ message: 'Kullanıcı başarıyla silindi.' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Kullanıcı silinirken hata oluştu.' });
  }
});

// GET /api/users/dashboard-stats (Get DB statistics, Admin only)
router.get('/dashboard-stats', requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    
    // 1. Total User Count
    const userCount = await db.get('SELECT COUNT(*) as count FROM users');
    
    // 2. Total Member Count
    const memberCount = await db.get('SELECT COUNT(*) as count FROM members');
    
    // 3. Role Breakdown
    const roleStats = await db.all('SELECT role, COUNT(*) as count FROM members GROUP BY role');
    const roleBreakdown = {
      GOREVSIZ: 0,
      ASIL_UYE: 0,
      YEDEK_UYE: 0,
      MUSAHIT: 0,
      YEDEK_MUSAHIT: 0,
      OKUL_SORUMLUSU: 0,
      OKUL_YARDIMCISI: 0,
      AVUKAT: 0,
      KURYE: 0,
      BILISIM: 0,
      BOLGE_MAHALLE: 0
    };
    roleStats.forEach(r => {
      roleBreakdown[r.role] = r.count;
    });

    // 4. PREDEFINED Kocaeli Districts
    const DISTRICTS = [
      'Başiskele', 'Çayırova', 'Darıca', 'Derince', 'Dilovası', 
      'Gebze', 'Gölcük', 'İzmit', 'Kandıra', 'Karamürsel', 'Kartepe', 'Körfez'
    ];

    function turkishToLower(str) {
      if (!str) return '';
      return str
        .replace(/İ/g, 'i')
        .replace(/I/g, 'ı')
        .replace(/Ş/g, 'ş')
        .replace(/Ç/g, 'ç')
        .replace(/Ğ/g, 'ğ')
        .replace(/Ü/g, 'ü')
        .replace(/Ö/g, 'ö')
        .toLowerCase();
    }

    // 5. Member Counts per District
    const districtStats = await db.all('SELECT district, COUNT(*) as count FROM members GROUP BY district');
    
    // 6. Assigned Member Counts per District (role !== 'GOREVSIZ')
    const districtAssignedStats = await db.all("SELECT district, COUNT(*) as count FROM members WHERE role != 'GOREVSIZ' GROUP BY district");

    // 7. Responsible Member Counts per District (roles that are responsibles)
    const districtResponsiblesStats = await db.all(`
      SELECT district, COUNT(*) as count 
      FROM members 
      WHERE role IN ('OKUL_SORUMLUSU', 'OKUL_SORUMLU_YARDIMCISI', 'BILISIM', 'BOLGE_MAHALLE') 
      GROUP BY district
    `);

    // 8. User Counts per District
    const districtUsersStats = await db.all('SELECT district, COUNT(*) as count FROM users WHERE role = "USER" GROUP BY district');

    // Combine stats per district
    const districtsData = DISTRICTS.map(distName => {
      const distNameLower = turkishToLower(distName);
      const memStat = districtStats.find(d => d.district && turkishToLower(d.district) === distNameLower) || { count: 0 };
      const assignedStat = districtAssignedStats.find(d => d.district && turkishToLower(d.district) === distNameLower) || { count: 0 };
      const respStat = districtResponsiblesStats.find(d => d.district && turkishToLower(d.district) === distNameLower) || { count: 0 };
      const userStat = districtUsersStats.find(d => d.district && turkishToLower(d.district) === distNameLower) || { count: 0 };
      
      return {
        district: distName,
        membersCount: memStat.count,
        assignedCount: assignedStat.count,
        responsiblesCount: respStat.count,
        usersCount: userStat.count
      };
    });

    res.json({
      totalUsers: userCount.count,
      totalMembers: memberCount.count,
      roleBreakdown,
      districtsData
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'İstatistikler yüklenemedi.' });
  }
});

// GET /api/users/download-db (Download SQLite DB file, Admin only)
router.get('/download-db', requireAdmin, async (req, res) => {
  const path = require('path');
  const fs = require('fs');
  const dbPath = path.join(__dirname, '../data/db.sqlite');
  
  if (fs.existsSync(dbPath)) {
    res.download(dbPath, `sandik_yedek_${new Date().toISOString().split('T')[0]}.sqlite`);
  } else {
    res.status(404).json({ message: 'Veritabanı dosyası bulunamadı.' });
  }
});

// GET /api/users/audit-logs (Get action logs, Admin only)
router.get('/audit-logs', requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const logs = await db.all('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500');
    res.json(logs);
  } catch (err) {
    console.error('Audit logs error:', err);
    res.status(500).json({ message: 'İşlem logları çekilemedi.' });
  }
});

module.exports = router;
