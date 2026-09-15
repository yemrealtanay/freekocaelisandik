const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { requireAuth } = require('../auth');
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
    member.first_name,
    member.last_name,
    member.phone,
    member.tckn,
    member.school,
    member.ballot_no,
    member.district,
    member.neighborhood
  ];
  return parts.map(normalizeText).join(' ');
}

// Helper to check if user has access to a district
function checkDistrictAccess(user, district) {
  if (user.role === 'ADMIN') return true;
  return user.district === district;
}

// Neighborhoods assigned to a representative; an empty list means the whole district
function getScopedNeighborhoods(user) {
  return user.role === 'USER' && Array.isArray(user.neighborhoods) ? user.neighborhoods : [];
}

function canAccessNeighborhood(user, neighborhood) {
  const scoped = getScopedNeighborhoods(user);
  return scoped.length === 0 || scoped.includes(neighborhood);
}

function checkMemberAccess(user, member) {
  return checkDistrictAccess(user, member.district) && canAccessNeighborhood(user, member.neighborhood);
}

function inPlaceholders(list) {
  return list.map(() => '?').join(', ');
}

// GET /api/members/neighborhoods (List neighborhoods with counts, Scoped)
router.get('/neighborhoods', requireAuth, async (req, res) => {
  let { district } = req.query;
  if (req.user.role === 'USER') {
    district = req.user.district || 'Gölcük';
  } else if (!district) {
    district = 'Gölcük';
  }

  try {
    const db = await getDb();
    let query = `
      SELECT neighborhood, COUNT(*) as count 
      FROM members 
      WHERE district = ? AND neighborhood IS NOT NULL AND neighborhood != '' 
    `;
    const params = [district];

    const scopedNeighborhoods = getScopedNeighborhoods(req.user);
    if (scopedNeighborhoods.length) {
      query += ` AND neighborhood IN (${inPlaceholders(scopedNeighborhoods)})`;
      params.push(...scopedNeighborhoods);
    }

    query += ' GROUP BY neighborhood ORDER BY neighborhood ASC';

    const neighborhoods = await db.all(query, params);
    res.json(neighborhoods);
  } catch (error) {
    console.error('List neighborhoods error:', error);
    res.status(500).json({ message: 'Mahalleler listelenirken hata oluştu.' });
  }
});

// GET /api/members (List & Search & Filter, Scoped by User District & Neighborhood)
router.get('/', requireAuth, async (req, res) => {
  let { district, role, search, neighborhood, vote_stance, contact_status } = req.query;

  // Enforce district & neighborhood access
  const scopedNeighborhoods = getScopedNeighborhoods(req.user);
  if (req.user.role === 'USER') {
    district = req.user.district || 'Gölcük';
    // A specific neighborhood filter must be one of the assigned ones
    if (scopedNeighborhoods.length && neighborhood && !scopedNeighborhoods.includes(neighborhood)) {
      neighborhood = 'TUM';
    }
  } else if (!district) {
    district = 'Gölcük';
  }

  try {
    const db = await getDb();
    
    let query = `
      SELECT m.*, 
        (SELECT t.note FROM timeline_events t WHERE t.member_id = m.id ORDER BY t.created_at DESC LIMIT 1) as latest_note, 
        (SELECT t.date FROM timeline_events t WHERE t.member_id = m.id ORDER BY t.created_at DESC LIMIT 1) as latest_action_date,
        (SELECT u.name FROM timeline_events t JOIN users u ON t.user_id = u.id WHERE t.member_id = m.id ORDER BY t.created_at DESC LIMIT 1) as latest_action_user
      FROM members m WHERE 1=1
    `;
    const params = [];

    if (district && district !== 'ALL' && district !== 'TUM') {
      query += ' AND m.district = ?';
      params.push(district);
    }

    if (neighborhood && neighborhood !== 'TUM' && neighborhood !== 'ALL') {
      query += ' AND m.neighborhood = ?';
      params.push(neighborhood);
    }

    if (scopedNeighborhoods.length) {
      query += ` AND m.neighborhood IN (${inPlaceholders(scopedNeighborhoods)})`;
      params.push(...scopedNeighborhoods);
    }

    if (vote_stance && vote_stance !== 'TUM' && vote_stance !== 'ALL') {
      if (vote_stance === 'BELIRTILMEDI') {
        query += " AND (m.vote_stance = 'BELIRTILMEDI' OR m.vote_stance IS NULL OR m.vote_stance = '')";
      } else if (vote_stance === 'GORUSULEN') {
        query += " AND (m.contact_status = 'GORUSULDU' OR m.vote_stance IN ('DESTEKLIYOR', 'KARARSIZ', 'MESAFELI'))";
      } else {
        query += ' AND m.vote_stance = ?';
        params.push(vote_stance);
      }
    }

    if (contact_status && contact_status !== 'TUM' && contact_status !== 'ALL') {
      if (contact_status === 'GORUSULDU') {
        query += " AND (m.contact_status = 'GORUSULDU' OR m.vote_stance IN ('DESTEKLIYOR', 'KARARSIZ', 'MESAFELI'))";
      } else if (contact_status === 'GORUSULMEDI') {
        query += " AND (m.contact_status = 'GORUSULMEDI' OR m.contact_status IS NULL OR m.contact_status = '') AND (m.vote_stance = 'BELIRTILMEDI' OR m.vote_stance IS NULL OR m.vote_stance = '')";
      } else {
        query += ' AND m.contact_status = ?';
        params.push(contact_status);
      }
    }

    if (role && role !== 'TUM' && role !== 'ALL') {
      query += ' AND m.role = ?';
      params.push(role);
    }

    if (search) {
      const searchTerms = normalizeText(search).split(' ').filter(Boolean);
      searchTerms.forEach(term => {
        query += ' AND m.search_index LIKE ?';
        params.push(`%${term}%`);
      });
    }

    query += ' ORDER BY m.first_name ASC, m.last_name ASC';

    const members = await db.all(query, params);
    
    // Also get totals for count display
    let countQuery = 'SELECT COUNT(*) as count FROM members WHERE 1=1';
    const countParams = [];
    if (district && district !== 'ALL' && district !== 'TUM') {
      countQuery += ' AND district = ?';
      countParams.push(district);
    }
    if (neighborhood && neighborhood !== 'TUM' && neighborhood !== 'ALL') {
      countQuery += ' AND neighborhood = ?';
      countParams.push(neighborhood);
    }
    if (scopedNeighborhoods.length) {
      countQuery += ` AND neighborhood IN (${inPlaceholders(scopedNeighborhoods)})`;
      countParams.push(...scopedNeighborhoods);
    }
    const totalInFilter = await db.get(countQuery, countParams);

    res.json({
      members,
      displayedCount: members.length,
      totalCount: totalInFilter ? totalInFilter.count : members.length
    });
  } catch (error) {
    console.error('List members error:', error);
    res.status(500).json({ message: 'Üyeler listelenirken hata oluştu.' });
  }
});

// POST /api/members (Add single member, Scoped)
router.post('/', requireAuth, async (req, res) => {
  const { tckn, first_name, last_name, phone, province, district, neighborhood, school, ballot_no, role, vote_stance } = req.body;

  if (!first_name || !last_name || !district) {
    return res.status(400).json({ message: 'Ad, Soyad ve İlçe alanları zorunludur.' });
  }

  if (!checkDistrictAccess(req.user, district)) {
    return res.status(403).json({ message: 'Bu ilçeye üye ekleme yetkiniz bulunmamaktadır.' });
  }

  if (!canAccessNeighborhood(req.user, (neighborhood || '').trim())) {
    return res.status(403).json({ message: 'Sadece size atanmış mahallelerden birine üye ekleyebilirsiniz.' });
  }

  try {
    const db = await getDb();
    const memberId = 'member-' + Math.random().toString(36).substr(2, 9);
    
    const searchIndex = buildSearchIndex({
      first_name: first_name.toUpperCase(),
      last_name: last_name.toUpperCase(),
      phone: phone || '',
      tckn: tckn || '',
      school: school || '',
      ballot_no: ballot_no || '',
      district,
      neighborhood: neighborhood || ''
    });

    await db.run(
      `INSERT INTO members (id, tckn, first_name, last_name, phone, province, district, neighborhood, school, ballot_no, role, vote_stance, contact_status, search_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        memberId,
        tckn || '',
        first_name.toUpperCase(),
        last_name.toUpperCase(),
        phone || '',
        province || 'KOCAELİ',
        district,
        neighborhood || '',
        school || '',
        ballot_no || '',
        role || 'GOREVSIZ',
        vote_stance || 'BELIRTILMEDI',
        vote_stance && vote_stance !== 'BELIRTILMEDI' ? 'GORUSULDU' : 'GORUSULMEDI',
        searchIndex
      ]
    );

    // Write initial log
    const eventId = 'event-' + Math.random().toString(36).substr(2, 9);
    const today = new Date().toISOString().split('T')[0];
    await db.run(
      'INSERT INTO timeline_events (id, member_id, user_id, type, date, note) VALUES (?, ?, ?, ?, ?, ?)',
      [eventId, memberId, req.user.id, 'SISTEM', today, 'Üye sisteme manuel olarak eklendi.']
    );

    await logAction(req, 'MEMBER_CREATE', `${first_name.toUpperCase()} ${last_name.toUpperCase()} (${neighborhood || district}) sisteme eklendi.`);

    res.status(201).json({
      message: 'Üye başarıyla eklendi.',
      memberId
    });
  } catch (error) {
    console.error('Create member error:', error);
    res.status(500).json({ message: 'Üye eklenirken hata oluştu.' });
  }
});

// PUT /api/members/:id (Update member details & status & stance, Scoped)
router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { 
    tckn, first_name, last_name, phone, province, neighborhood, 
    school, ballot_no, role, vote_stance, contact_status, 
    note, interaction_type 
  } = req.body;

  try {
    const db = await getDb();
    const member = await db.get('SELECT * FROM members WHERE id = ?', [id]);

    if (!member) {
      return res.status(404).json({ message: 'Üye bulunamadı.' });
    }

    if (!checkDistrictAccess(req.user, member.district)) {
      return res.status(403).json({ message: 'Bu üyenin bilgilerini değiştirme yetkiniz bulunmamaktadır.' });
    }

    if (!canAccessNeighborhood(req.user, member.neighborhood)) {
      return res.status(403).json({ message: 'Sadece size atanmış mahallelerdeki üyeleri güncelleyebilirsiniz.' });
    }

    if (neighborhood !== undefined && neighborhood !== member.neighborhood && !canAccessNeighborhood(req.user, neighborhood)) {
      return res.status(403).json({ message: 'Üyeyi size atanmamış bir mahalleye taşıyamazsınız.' });
    }

    const today = new Date().toISOString().split('T')[0];
    const newTckn = tckn !== undefined ? tckn : member.tckn;
    const newFirstName = first_name ? first_name.toUpperCase() : member.first_name;
    const newLastName = last_name ? last_name.toUpperCase() : member.last_name;
    const newPhone = phone !== undefined ? phone : member.phone;
    const newNeighborhood = neighborhood !== undefined ? neighborhood : member.neighborhood;
    const newSchool = school !== undefined ? school : member.school;
    const newBallotNo = ballot_no !== undefined ? ballot_no : member.ballot_no;
    const newRole = role || member.role;
    const newVoteStance = vote_stance !== undefined ? vote_stance : (member.vote_stance || 'BELIRTILMEDI');
    
    // Determine contact status and date
    let newContactStatus = contact_status || member.contact_status || 'GORUSULMEDI';
    let newLastContactDate = member.last_contact_date;

    if (vote_stance && vote_stance !== 'BELIRTILMEDI' && (!contact_status || contact_status === 'GORUSULMEDI')) {
      newContactStatus = 'GORUSULDU';
      newLastContactDate = today;
    } else if (contact_status === 'GORUSULDU') {
      newLastContactDate = today;
    }
    
    const searchIndex = buildSearchIndex({
      first_name: newFirstName,
      last_name: newLastName,
      phone: newPhone,
      tckn: newTckn,
      school: newSchool,
      ballot_no: newBallotNo,
      district: member.district,
      neighborhood: newNeighborhood
    });

    await db.run(
      `UPDATE members 
       SET tckn = ?, first_name = ?, last_name = ?, phone = ?, province = ?, neighborhood = ?, school = ?, ballot_no = ?, role = ?, vote_stance = ?, contact_status = ?, last_contact_date = ?, search_index = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        newTckn,
        newFirstName,
        newLastName,
        newPhone,
        province || member.province,
        newNeighborhood,
        newSchool,
        newBallotNo,
        newRole,
        newVoteStance,
        newContactStatus,
        newLastContactDate,
        searchIndex,
        id
      ]
    );

    const stanceLabels = {
      DESTEKLIYOR: 'Destekliyor',
      KARARSIZ: 'Kararsız',
      MESAFELI: 'Mesafeli',
      BELIRTILMEDI: 'Henüz Görüşülmedi'
    };

    // If note is present
    if (note && note.trim()) {
      const eventId = 'event-' + Math.random().toString(36).substr(2, 9);
      const evType = interaction_type || 'NOT';
      let fullNote = note.trim();
      if (vote_stance && vote_stance !== member.vote_stance) {
        fullNote = `[İntiba: ${stanceLabels[vote_stance] || vote_stance}] ${fullNote}`;
      }
      await db.run(
        'INSERT INTO timeline_events (id, member_id, user_id, type, date, note) VALUES (?, ?, ?, ?, ?, ?)',
        [eventId, id, req.user.id, evType, today, fullNote]
      );
    } else if (vote_stance && vote_stance !== member.vote_stance) {
      // Just stance changed inline without custom note
      const oldLabel = stanceLabels[member.vote_stance] || member.vote_stance;
      const newLabel = stanceLabels[vote_stance] || vote_stance;
      const eventId = 'event-' + Math.random().toString(36).substr(2, 9);
      await db.run(
        'INSERT INTO timeline_events (id, member_id, user_id, type, date, note) VALUES (?, ?, ?, ?, ?, ?)',
        [eventId, id, req.user.id, 'DURUM_DEGISIKLIGI', today, `Seçmen intibası güncellendi: ${oldLabel} ➡️ ${newLabel}`]
      );
    }

    if (role && role !== member.role) {
      const eventId = 'event-' + Math.random().toString(36).substr(2, 9);
      await db.run(
        'INSERT INTO timeline_events (id, member_id, user_id, type, date, note) VALUES (?, ?, ?, ?, ?, ?)',
        [eventId, id, req.user.id, 'GOREV_DEGISIKLIGI', today, `Görev durumu güncellendi: ${member.role} ➡️ ${role}`]
      );
    }

    await logAction(req, 'MEMBER_UPDATE', `${newFirstName} ${newLastName} (${newNeighborhood || member.district}) bilgileri güncellendi.`);

    res.json({ 
      message: 'Üye bilgileri başarıyla güncellendi.',
      member: {
        id,
        vote_stance: newVoteStance,
        contact_status: newContactStatus,
        last_contact_date: newLastContactDate,
        neighborhood: newNeighborhood
      }
    });
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
    const member = await db.get('SELECT district, neighborhood FROM members WHERE id = ?', [id]);

    if (!member) {
      return res.status(404).json({ message: 'Üye bulunamadı.' });
    }

    if (!checkMemberAccess(req.user, member)) {
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
    const member = await db.get('SELECT district, neighborhood FROM members WHERE id = ?', [id]);

    if (!member) {
      return res.status(404).json({ message: 'Üye bulunamadı.' });
    }

    if (!checkMemberAccess(req.user, member)) {
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
    const member = await db.get('SELECT district, neighborhood FROM members WHERE id = ?', [id]);

    if (!member) {
      return res.status(404).json({ message: 'Üye bulunamadı.' });
    }

    if (!checkMemberAccess(req.user, member)) {
      return res.status(403).json({ message: 'Bu üyeyi silme yetkiniz bulunmamaktadır.' });
    }

    const targetMember = await db.get('SELECT first_name, last_name, tckn FROM members WHERE id = ?', [id]);
    await db.run('DELETE FROM members WHERE id = ?', [id]);
    if (targetMember) {
      await logAction(req, 'MEMBER_DELETE', `${targetMember.first_name} ${targetMember.last_name} (TCKN: ${targetMember.tckn || '—'}, İlçe: ${member.district}) isimli üye silindi.`);
    }
    res.json({ message: 'Üye başarıyla silindi.' });
  } catch (error) {
    console.error('Delete member error:', error);
    res.status(500).json({ message: 'Üye silinirken hata oluştu.' });
  }
});

module.exports = router;
