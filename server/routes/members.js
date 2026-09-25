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
    member.sno,
    member.first_name,
    member.last_name,
    member.phone,
    member.neighborhood,
    member.district
  ];
  return parts.filter(Boolean).map(normalizeText).join(' ');
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

// GET /api/members/neighborhoods (List official neighborhoods with counts, Scoped)
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
      SELECT n.name as neighborhood, COUNT(m.id) as count 
      FROM neighborhoods n
      LEFT JOIN members m ON m.neighborhood = n.name AND m.district = n.district
      WHERE n.district = ?
    `;
    const params = [district];

    const scopedNeighborhoods = getScopedNeighborhoods(req.user);
    if (scopedNeighborhoods.length) {
      query += ` AND n.name IN (${inPlaceholders(scopedNeighborhoods)})`;
      params.push(...scopedNeighborhoods);
    }

    query += ' GROUP BY n.name ORDER BY n.name ASC';

    const neighborhoods = await db.all(query, params);
    res.json(neighborhoods);
  } catch (error) {
    console.error('List neighborhoods error:', error);
    res.status(500).json({ message: 'Mahalleler listelenirken hata oluştu.' });
  }
});

// GET /api/members (List & Search & Filter, Scoped by User District & Neighborhood)
router.get('/', requireAuth, async (req, res) => {
  let { district, search, neighborhood, vote_stance, contact_status, voted_status } = req.query;

  // Enforce district & neighborhood access
  const scopedNeighborhoods = getScopedNeighborhoods(req.user);
  if (req.user.role === 'USER') {
    district = req.user.district || 'Gölcük';
    if (scopedNeighborhoods.length && neighborhood && !scopedNeighborhoods.includes(neighborhood)) {
      neighborhood = 'TUM';
    }
  } else if (!district) {
    district = 'Gölcük';
  }

  try {
    const db = await getDb();
    
    let whereConditions = ['1=1'];
    const params = [];

    if (district && district !== 'ALL' && district !== 'TUM') {
      whereConditions.push('m.district = ?');
      params.push(district);
    }

    if (neighborhood && neighborhood !== 'TUM' && neighborhood !== 'ALL') {
      whereConditions.push('m.neighborhood = ?');
      params.push(neighborhood);
    }

    if (scopedNeighborhoods.length) {
      whereConditions.push(`m.neighborhood IN (${inPlaceholders(scopedNeighborhoods)})`);
      params.push(...scopedNeighborhoods);
    }

    if (vote_stance && vote_stance !== 'TUM' && vote_stance !== 'ALL') {
      if (vote_stance === 'BELIRTILMEDI') {
        whereConditions.push("(m.vote_stance = 'BELIRTILMEDI' OR m.vote_stance IS NULL OR m.vote_stance = '')");
      } else if (vote_stance === 'GORUSULEN') {
        whereConditions.push("(m.contact_status = 'GORUSULDU' OR m.vote_stance IN ('DESTEKLIYOR', 'KARARSIZ', 'MESAFELI', 'GELMEYECEK'))");
      } else {
        whereConditions.push('m.vote_stance = ?');
        params.push(vote_stance);
      }
    }

    if (contact_status && contact_status !== 'TUM' && contact_status !== 'ALL') {
      if (contact_status === 'GORUSULDU') {
        whereConditions.push("(m.contact_status = 'GORUSULDU' OR m.vote_stance IN ('DESTEKLIYOR', 'KARARSIZ', 'MESAFELI', 'GELMEYECEK'))");
      } else if (contact_status === 'GORUSULMEDI') {
        whereConditions.push("(m.contact_status = 'GORUSULMEDI' OR m.contact_status IS NULL OR m.contact_status = '') AND (m.vote_stance = 'BELIRTILMEDI' OR m.vote_stance IS NULL OR m.vote_stance = '')");
      } else {
        whereConditions.push('m.contact_status = ?');
        params.push(contact_status);
      }
    }

    if (voted_status && voted_status !== 'TUM' && voted_status !== 'ALL') {
      if (voted_status === 'KULLANDI' || voted_status === '1') {
        whereConditions.push('m.has_voted = 1');
      } else if (voted_status === 'KULLANMADI' || voted_status === '0') {
        whereConditions.push('(m.has_voted = 0 OR m.has_voted IS NULL)');
      }
    }

    if (search) {
      const searchTerms = normalizeText(search).split(' ').filter(Boolean);
      searchTerms.forEach(term => {
        whereConditions.push('m.search_index LIKE ?');
        params.push(`%${term}%`);
      });
    }

    const whereClause = whereConditions.join(' AND ');

    const query = `
      SELECT m.*, 
        (SELECT t.note FROM timeline_events t WHERE t.member_id = m.id ORDER BY CASE WHEN t.type IN ('SYSTEM', 'SISTEM') THEN 1 ELSE 0 END, t.created_at DESC, t.rowid DESC LIMIT 1) as latest_note, 
        (SELECT t.date FROM timeline_events t WHERE t.member_id = m.id ORDER BY CASE WHEN t.type IN ('SYSTEM', 'SISTEM') THEN 1 ELSE 0 END, t.created_at DESC, t.rowid DESC LIMIT 1) as latest_action_date,
        (SELECT u.name FROM timeline_events t JOIN users u ON t.user_id = u.id WHERE t.member_id = m.id ORDER BY CASE WHEN t.type IN ('SYSTEM', 'SISTEM') THEN 1 ELSE 0 END, t.created_at DESC, t.rowid DESC LIMIT 1) as latest_action_user
      FROM members m 
      WHERE ${whereClause}
      ORDER BY CASE WHEN m.sno IS NULL THEN 1 ELSE 0 END, m.sno ASC, m.first_name ASC
    `;

    const members = await db.all(query, params);

    res.json({
      members,
      displayedCount: members.length,
      totalCount: members.length
    });
  } catch (error) {
    console.error('List members error:', error);
    res.status(500).json({ message: 'Üyeler listelenirken hata oluştu.' });
  }
});

// PATCH /api/members/:id/toggle-vote (Instant 1-tap election-day voting toggle, Scoped)
router.patch('/:id/toggle-vote', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const db = await getDb();
    const member = await db.get(
      'SELECT id, sno, first_name, last_name, district, neighborhood, has_voted FROM members WHERE id = ?',
      [id]
    );

    if (!member) {
      return res.status(404).json({ message: 'Üye bulunamadı.' });
    }

    if (!checkMemberAccess(req.user, member)) {
      return res.status(403).json({ message: 'Bu üyenin oy durumunu değiştirme yetkiniz bulunmamaktadır.' });
    }

    const newHasVoted = member.has_voted === 1 ? 0 : 1;
    const today = new Date().toISOString().split('T')[0];
    const votedAt = newHasVoted === 1 ? new Date().toISOString() : null;

    await db.run(
      'UPDATE members SET has_voted = ?, voted_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newHasVoted, votedAt, id]
    );

    const eventId = 'event-' + Math.random().toString(36).substr(2, 9);
    const noteText = newHasVoted === 1 
      ? 'Seçim Günü: Sandıkta oy kullandı olarak işaretlendi. ✅' 
      : 'Seçim Günü: Oy kullanma işareti kaldırıldı. ⏳';

    await db.run(
      'INSERT INTO timeline_events (id, member_id, user_id, type, date, note) VALUES (?, ?, ?, ?, ?, ?)',
      [eventId, id, req.user.id, 'SECIM_OYU', today, noteText]
    );

    await logAction(
      req, 
      'MEMBER_VOTE_TOGGLE', 
      `${member.first_name} ${member.last_name} (${member.neighborhood || member.district}) seçim günü oy durumu: ${newHasVoted === 1 ? 'Oy Kullandı ✅' : 'Oy Kullanmadı ⏳'}`
    );

    res.json({
      message: newHasVoted === 1 ? 'Oy kullandı olarak kaydedildi.' : 'Oy kullanma işareti kaldırıldı.',
      member: {
        id,
        has_voted: newHasVoted,
        voted_at: votedAt
      }
    });
  } catch (error) {
    console.error('Toggle vote error:', error);
    res.status(500).json({ message: 'Oy durumu güncellenirken hata oluştu.' });
  }
});

// POST /api/members (Add single member, Scoped)
router.post('/', requireAuth, async (req, res) => {
  const { sno, first_name, last_name, phone, district = 'Gölcük', neighborhood, vote_stance, has_voted } = req.body;

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
    
    const parsedSno = sno ? parseInt(sno, 10) : null;
    const cleanFirstName = first_name.trim().toUpperCase();
    const cleanLastName = last_name.trim().toUpperCase();
    const cleanPhone = phone ? phone.toString().replace(/\D/g, '').trim() : '';
    const cleanNeighborhood = (neighborhood || 'MERKEZ MAH.').trim().toUpperCase();
    const cleanStance = vote_stance || 'BELIRTILMEDI';
    const contactStatus = cleanStance !== 'BELIRTILMEDI' ? 'GORUSULDU' : 'GORUSULMEDI';
    const votedVal = has_voted === 1 || has_voted === true ? 1 : 0;
    const votedAtVal = votedVal === 1 ? new Date().toISOString() : null;

    const searchIndex = buildSearchIndex({
      sno: parsedSno,
      first_name: cleanFirstName,
      last_name: cleanLastName,
      phone: cleanPhone,
      neighborhood: cleanNeighborhood,
      district
    });

    await db.run(
      `INSERT INTO members (id, sno, first_name, last_name, phone, district, neighborhood, vote_stance, contact_status, has_voted, voted_at, search_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        memberId,
        parsedSno,
        cleanFirstName,
        cleanLastName,
        cleanPhone,
        district,
        cleanNeighborhood,
        cleanStance,
        contactStatus,
        votedVal,
        votedAtVal,
        searchIndex
      ]
    );

    // Write initial log
    const eventId = 'event-' + Math.random().toString(36).substr(2, 9);
    const today = new Date().toISOString().split('T')[0];
    await db.run(
      'INSERT INTO timeline_events (id, member_id, user_id, type, date, note) VALUES (?, ?, ?, ?, ?, ?)',
      [eventId, memberId, req.user.id, 'SISTEM', today, 'Üye sisteme eklendi.']
    );

    await logAction(req, 'MEMBER_CREATE', `${cleanFirstName} ${cleanLastName} (${cleanNeighborhood}) sisteme eklendi.`);

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
    sno, first_name, last_name, phone, neighborhood, 
    vote_stance, contact_status, has_voted,
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
    const newSno = sno !== undefined ? (sno ? parseInt(sno, 10) : null) : member.sno;
    const newFirstName = first_name ? first_name.trim().toUpperCase() : member.first_name;
    const newLastName = last_name ? last_name.trim().toUpperCase() : member.last_name;
    const newPhone = phone !== undefined ? phone.toString().replace(/\D/g, '').trim() : member.phone;
    const newNeighborhood = neighborhood !== undefined ? neighborhood.trim().toUpperCase() : member.neighborhood;
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

    // Has voted status
    let newHasVoted = member.has_voted || 0;
    let newVotedAt = member.voted_at;
    if (has_voted !== undefined) {
      newHasVoted = has_voted === 1 || has_voted === true ? 1 : 0;
      if (newHasVoted !== member.has_voted) {
        newVotedAt = newHasVoted === 1 ? new Date().toISOString() : null;
      }
    }
    
    const searchIndex = buildSearchIndex({
      sno: newSno,
      first_name: newFirstName,
      last_name: newLastName,
      phone: newPhone,
      district: member.district,
      neighborhood: newNeighborhood
    });

    await db.run(
      `UPDATE members 
       SET sno = ?, first_name = ?, last_name = ?, phone = ?, neighborhood = ?, vote_stance = ?, contact_status = ?, has_voted = ?, voted_at = ?, last_contact_date = ?, search_index = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        newSno,
        newFirstName,
        newLastName,
        newPhone,
        newNeighborhood,
        newVoteStance,
        newContactStatus,
        newHasVoted,
        newVotedAt,
        newLastContactDate,
        searchIndex,
        id
      ]
    );

    const stanceLabels = {
      DESTEKLIYOR: 'Destekliyor',
      KARARSIZ: 'Kararsız',
      MESAFELI: 'Mesafeli',
      GELMEYECEK: 'Oy Vermeye Gelmeyecek',
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

    // Has voted status changed via PUT form
    if (has_voted !== undefined && newHasVoted !== member.has_voted) {
      const eventId = 'event-' + Math.random().toString(36).substr(2, 9);
      const noteText = newHasVoted === 1 
        ? 'Seçim Günü: Sandıkta oy kullandı olarak işaretlendi. ✅' 
        : 'Seçim Günü: Oy kullanma işareti kaldırıldı. ⏳';
      await db.run(
        'INSERT INTO timeline_events (id, member_id, user_id, type, date, note) VALUES (?, ?, ?, ?, ?, ?)',
        [eventId, id, req.user.id, 'SECIM_OYU', today, noteText]
      );
    }

    await logAction(req, 'MEMBER_UPDATE', `${newFirstName} ${newLastName} (${newNeighborhood || member.district}) bilgileri güncellendi.`);

    res.json({ 
      message: 'Üye bilgileri başarıyla güncellendi.',
      member: {
        id,
        sno: newSno,
        vote_stance: newVoteStance,
        contact_status: newContactStatus,
        has_voted: newHasVoted,
        voted_at: newVotedAt,
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
       ORDER BY t.created_at DESC, t.rowid DESC`,
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
    const member = await db.get('SELECT id, first_name, last_name, district, neighborhood FROM members WHERE id = ?', [id]);

    if (!member) {
      return res.status(404).json({ message: 'Üye bulunamadı.' });
    }

    if (!checkMemberAccess(req.user, member)) {
      return res.status(403).json({ message: 'Bu üyeyi silme yetkiniz bulunmamaktadır.' });
    }

    await db.run('DELETE FROM members WHERE id = ?', [id]);
    await logAction(req, 'MEMBER_DELETE', `${member.first_name} ${member.last_name} (${member.neighborhood || member.district}) isimli üye silindi.`);
    res.json({ message: 'Üye başarıyla silindi.' });
  } catch (error) {
    console.error('Delete member error:', error);
    res.status(500).json({ message: 'Üye silinirken hata oluştu.' });
  }
});

module.exports = router;
