const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb, dbPath } = require('../db');
const { requireAdmin } = require('../auth');
const { logAction } = require('../logger');

// GET /api/users (List users, Admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const users = await db.all('SELECT id, name, email, district, neighborhood, role, status, created_at FROM users ORDER BY created_at DESC');
    res.json(users);
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ message: 'Kullanıcılar listelenirken hata oluştu.' });
  }
});

// POST /api/users (Create user, Admin only)
router.post('/', requireAdmin, async (req, res) => {
  const { name, email, password, district, neighborhood, role } = req.body;

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
    const userDistrict = role === 'ADMIN' ? null : (district || 'Gölcük');
    const userNeighborhood = role === 'ADMIN' ? null : (neighborhood || null);

    await db.run(
      'INSERT INTO users (id, name, email, password_hash, district, neighborhood, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, name, email, passwordHash, userDistrict, userNeighborhood, role, 'ACTIVE']
    );

    await logAction(req, 'USER_CREATE', `${name} (${email}) kullanıcısı oluşturuldu. Rol: ${role}, İlçe: ${userDistrict || 'Hepsi'}, Mahalle: ${userNeighborhood || 'Tümü'}`);

    res.status(201).json({
      message: 'Kullanıcı başarıyla oluşturuldu.',
      user: { id: userId, name, email, district: userDistrict, neighborhood: userNeighborhood, role, status: 'ACTIVE' }
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

// GET /api/users/dashboard-stats (Get DB statistics, Available to authenticated users)
const { requireAuth } = require('../auth');
router.get('/dashboard-stats', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    let { district } = req.query;

    if (req.user.role === 'USER') {
      district = req.user.district || 'Gölcük';
    } else if (!district) {
      district = 'Gölcük';
    }

    const isUser = req.user.role === 'USER';
    const userNeighborhood = isUser ? req.user.neighborhood : null;

    let whereClause = 'district = ?';
    let queryParams = [district];

    if (userNeighborhood) {
      whereClause += ' AND neighborhood = ?';
      queryParams.push(userNeighborhood);
    }

    // 1. Total User Count (Admin only)
    let totalUsers = 0;
    if (!isUser) {
      const userCount = await db.get('SELECT COUNT(*) as count FROM users');
      totalUsers = userCount ? userCount.count : 0;
    }
    
    // 2. Total Member Count for target district/neighborhood
    const memberCount = await db.get(
      `SELECT COUNT(*) as count FROM members WHERE ${whereClause}`,
      queryParams
    );
    const totalMembers = memberCount ? memberCount.count : 0;

    // 3. Stance counts
    const stanceRows = await db.all(
      `SELECT vote_stance, COUNT(*) as count FROM members WHERE ${whereClause} GROUP BY vote_stance`,
      queryParams
    );
    const stanceBreakdown = {
      DESTEKLIYOR: 0,
      KARARSIZ: 0,
      MESAFELI: 0,
      BELIRTILMEDI: 0
    };
    stanceRows.forEach(r => {
      if (r.vote_stance && stanceBreakdown[r.vote_stance] !== undefined) {
        stanceBreakdown[r.vote_stance] = r.count;
      } else {
        stanceBreakdown.BELIRTILMEDI += r.count;
      }
    });

    // 4. Contacted vs Not Contacted
    const contactedResult = await db.get(
      `SELECT COUNT(*) as count FROM members 
       WHERE ${whereClause} AND (contact_status = 'GORUSULDU' OR vote_stance IN ('DESTEKLIYOR', 'KARARSIZ', 'MESAFELI'))`,
      queryParams
    );
    const contactedMembers = contactedResult ? contactedResult.count : 0;
    const notContactedMembers = Math.max(0, totalMembers - contactedMembers);
    const contactRate = totalMembers > 0 ? Math.round((contactedMembers / totalMembers) * 100) : 0;

    // 5. Neighborhood Breakdown
    const neighborhoodRows = await db.all(`
      SELECT 
        neighborhood,
        COUNT(*) as total_members,
        SUM(CASE WHEN contact_status = 'GORUSULDU' OR vote_stance IN ('DESTEKLIYOR', 'KARARSIZ', 'MESAFELI') THEN 1 ELSE 0 END) as contacted_count,
        SUM(CASE WHEN vote_stance = 'DESTEKLIYOR' THEN 1 ELSE 0 END) as destekliyor_count,
        SUM(CASE WHEN vote_stance = 'KARARSIZ' THEN 1 ELSE 0 END) as kararsiz_count,
        SUM(CASE WHEN vote_stance = 'MESAFELI' THEN 1 ELSE 0 END) as mesafeli_count,
        SUM(CASE WHEN vote_stance = 'BELIRTILMEDI' OR vote_stance IS NULL THEN 1 ELSE 0 END) as belirtilmedi_count
      FROM members 
      WHERE ${whereClause} AND neighborhood IS NOT NULL AND neighborhood != ''
      GROUP BY neighborhood
      ORDER BY total_members DESC, neighborhood ASC
    `, queryParams);

    // 6. Representative Activity Statistics
    // Admins see all representatives. Mahalle Sorumlulari only see their own performance.
    let repQuery = `
      SELECT 
        u.id as user_id, 
        u.name as user_name, 
        u.email as user_email, 
        u.neighborhood as user_neighborhood, 
        u.district as user_district,
        u.role as user_role,
        COUNT(t.id) as total_interactions,
        COUNT(DISTINCT t.member_id) as unique_members_contacted,
        MAX(t.date) as last_active_date
      FROM users u
      LEFT JOIN timeline_events t ON t.user_id = u.id AND t.type NOT IN ('SYSTEM', 'SISTEM')
    `;
    const repParams = [];

    if (isUser) {
      repQuery += ' WHERE u.id = ?';
      repParams.push(req.user.id);
    }

    repQuery += ' GROUP BY u.id ORDER BY total_interactions DESC, u.name ASC';
    const representativeRows = await db.all(repQuery, repParams);

    res.json({
      district,
      neighborhood: userNeighborhood || null,
      isNeighborhoodScoped: !!userNeighborhood,
      totalUsers,
      totalMembers,
      contactedMembers,
      notContactedMembers,
      contactRate,
      stanceBreakdown,
      neighborhoodsData: neighborhoodRows,
      representativeStats: representativeRows
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'İstatistikler yüklenemedi.' });
  }
});

// GET /api/users/download-db (Download SQLite DB file, Admin only)
router.get('/download-db', requireAdmin, async (req, res) => {
  const fs = require('fs');
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
