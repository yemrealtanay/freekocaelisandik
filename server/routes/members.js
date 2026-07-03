const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { requireAuth } = require('../auth');

// Helper to check if user has access to a district
function checkDistrictAccess(user, district) {
  if (user.role === 'ADMIN') return true;
  return user.district === district;
}

// GET /api/members (List & Search & Filter, Scoped by User District)
router.get('/', requireAuth, async (req, res) => {
  let { district, role, search } = req.query;

  // Enforce district access
  if (req.user.role === 'USER') {
    district = req.user.district; // Force to user's assigned district
  } else if (!district) {
    // If Admin and no district selected, default to the first district or return empty
    // Let's require a district for the members list, or return all if admin requests.
    // In our design, admin selects a district from a dropdown, so district is passed.
    // If not passed, we can list all or default. Let's allow listing all if district is empty (for Admin).
  }

  try {
    const db = await getDb();
    
    let query = 'SELECT m.*, (SELECT t.note FROM timeline_events t WHERE t.member_id = m.id ORDER BY t.created_at DESC LIMIT 1) as latest_note, (SELECT t.date FROM timeline_events t WHERE t.member_id = m.id ORDER BY t.created_at DESC LIMIT 1) as latest_action_date FROM members m WHERE 1=1';
    const params = [];

    if (district) {
      query += ' AND m.district = ?';
      params.push(district);
    }

    if (role && role !== 'TUM' && role !== 'ALL') {
      query += ' AND m.role = ?';
      params.push(role);
    }

    if (search) {
      query += ' AND (m.first_name LIKE ? OR m.last_name LIKE ? OR (m.first_name || " " || m.last_name) LIKE ? OR m.phone LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    query += ' ORDER BY m.first_name ASC, m.last_name ASC';

    const members = await db.all(query, params);
    
    // Also get totals for count display
    let countQuery = 'SELECT COUNT(*) as count FROM members WHERE 1=1';
    const countParams = [];
    if (district) {
      countQuery += ' AND district = ?';
      countParams.push(district);
    }
    const totalInDistrict = await db.get(countQuery, countParams);

    res.json({
      members,
      displayedCount: members.length,
      totalCount: totalInDistrict ? totalInDistrict.count : 0
    });
  } catch (error) {
    console.error('List members error:', error);
    res.status(500).json({ message: 'Üyeler listelenirken hata oluştu.' });
  }
});

// POST /api/members (Add single member, Scoped)
router.post('/', requireAuth, async (req, res) => {
  const { tckn, first_name, last_name, phone, province, district, school, ballot_no, role } = req.body;

  if (!first_name || !last_name || !district) {
    return res.status(400).json({ message: 'Ad, Soyad ve İlçe alanları zorunludur.' });
  }

  if (!checkDistrictAccess(req.user, district)) {
    return res.status(403).json({ message: 'Bu ilçeye üye ekleme yetkiniz bulunmamaktadır.' });
  }

  try {
    const db = await getDb();
    const memberId = 'member-' + Math.random().toString(36).substr(2, 9);
    
    await db.run(
      `INSERT INTO members (id, tckn, first_name, last_name, phone, province, district, school, ballot_no, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        memberId,
        tckn || '',
        first_name.toUpperCase(),
        last_name.toUpperCase(),
        phone || '',
        province || 'KOCAELİ',
        district,
        school || '',
        ballot_no || '',
        role || 'GOREVSIZ'
      ]
    );

    // Write initial log
    const eventId = 'event-' + Math.random().toString(36).substr(2, 9);
    const today = new Date().toISOString().split('T')[0];
    await db.run(
      'INSERT INTO timeline_events (id, member_id, user_id, type, date, note) VALUES (?, ?, ?, ?, ?, ?)',
      [eventId, memberId, req.user.id, 'SYSTEM', today, 'Üye sisteme manuel olarak eklendi.']
    );

    res.status(201).json({
      message: 'Üye başarıyla eklendi.',
      memberId
    });
  } catch (error) {
    console.error('Create member error:', error);
    res.status(500).json({ message: 'Üye eklenirken hata oluştu.' });
  }
});

// PUT /api/members/:id (Update member details, Scoped)
router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { tckn, first_name, last_name, phone, province, school, ballot_no, role } = req.body;

  try {
    const db = await getDb();
    const member = await db.get('SELECT * FROM members WHERE id = ?', [id]);

    if (!member) {
      return res.status(404).json({ message: 'Üye bulunamadı.' });
    }

    if (!checkDistrictAccess(req.user, member.district)) {
      return res.status(403).json({ message: 'Bu üyenin bilgilerini değiştirme yetkiniz bulunmamaktadır.' });
    }

    // Capture role change event if role is updated
    let roleChangeNote = null;
    if (role && role !== member.role) {
      roleChangeNote = `Görev durumu güncellendi: ${member.role} -> ${role}`;
    }

    await db.run(
      `UPDATE members 
       SET tckn = ?, first_name = ?, last_name = ?, phone = ?, province = ?, school = ?, ballot_no = ?, role = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        tckn !== undefined ? tckn : member.tckn,
        first_name ? first_name.toUpperCase() : member.first_name,
        last_name ? last_name.toUpperCase() : member.last_name,
        phone !== undefined ? phone : member.phone,
        province || member.province,
        school !== undefined ? school : member.school,
        ballot_no !== undefined ? ballot_no : member.ballot_no,
        role || member.role,
        id
      ]
    );

    const today = new Date().toISOString().split('T')[0];
    if (roleChangeNote) {
      const eventId = 'event-' + Math.random().toString(36).substr(2, 9);
      await db.run(
        'INSERT INTO timeline_events (id, member_id, user_id, type, date, note) VALUES (?, ?, ?, ?, ?, ?)',
        [eventId, id, req.user.id, 'ROLE_CHANGE', today, roleChangeNote]
      );
    }

    res.json({ message: 'Üye bilgileri başarıyla güncellendi.' });
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ message: 'Üye güncellenirken hata oluştu.' });
  }
});

// GET /api/members/:id/timeline (Get timeline logs, Scoped)
router.get('/:id/timeline', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const db = await getDb();
    const member = await db.get('SELECT district FROM members WHERE id = ?', [id]);

    if (!member) {
      return res.status(404).json({ message: 'Üye bulunamadı.' });
    }

    if (!checkDistrictAccess(req.user, member.district)) {
      return res.status(403).json({ message: 'Bu üyenin bilgilerini görme yetkiniz bulunmamaktadır.' });
    }

    const events = await db.all(
      `SELECT t.*, u.name as user_name 
       FROM timeline_events t 
       LEFT JOIN users u ON t.user_id = u.id 
       WHERE t.member_id = ? 
       ORDER BY t.created_at DESC`,
      [id]
    );

    res.json(events);
  } catch (error) {
    console.error('Get timeline error:', error);
    res.status(500).json({ message: 'Zaman akışı yüklenirken hata oluştu.' });
  }
});

// POST /api/members/:id/timeline (Add timeline log, Scoped)
router.post('/:id/timeline', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { type, date, note } = req.body;

  if (!type || !date || !note) {
    return res.status(400).json({ message: 'Tür, tarih ve not alanları zorunludur.' });
  }

  try {
    const db = await getDb();
    const member = await db.get('SELECT district FROM members WHERE id = ?', [id]);

    if (!member) {
      return res.status(404).json({ message: 'Üye bulunamadı.' });
    }

    if (!checkDistrictAccess(req.user, member.district)) {
      return res.status(403).json({ message: 'Bu üyeye not ekleme yetkiniz bulunmamaktadır.' });
    }

    const eventId = 'event-' + Math.random().toString(36).substr(2, 9);
    await db.run(
      'INSERT INTO timeline_events (id, member_id, user_id, type, date, note) VALUES (?, ?, ?, ?, ?, ?)',
      [eventId, id, req.user.id, type, date, note]
    );

    // Touch member's updated_at field
    await db.run('UPDATE members SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);

    res.status(201).json({ message: 'İşlem başarıyla zaman akışına eklendi.' });
  } catch (error) {
    console.error('Add timeline event error:', error);
    res.status(500).json({ message: 'Zaman akışına işlem eklenirken hata oluştu.' });
  }
});

// DELETE /api/members/:id (Delete member, Scoped)
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const db = await getDb();
    const member = await db.get('SELECT district FROM members WHERE id = ?', [id]);

    if (!member) {
      return res.status(404).json({ message: 'Üye bulunamadı.' });
    }

    if (!checkDistrictAccess(req.user, member.district)) {
      return res.status(403).json({ message: 'Bu üyeyi silme yetkiniz bulunmamaktadır.' });
    }

    await db.run('DELETE FROM members WHERE id = ?', [id]);
    res.json({ message: 'Üye başarıyla silindi.' });
  } catch (error) {
    console.error('Delete member error:', error);
    res.status(500).json({ message: 'Üye silinirken hata oluştu.' });
  }
});

module.exports = router;
