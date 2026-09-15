const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getDb } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'kocaeli_uye_yonetim_sistemi_secret_key_12345';

function generateToken(user) {
  // Only identity goes into the token; district/neighborhood scope is loaded fresh on every request
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function getUserNeighborhoods(db, userId) {
  const rows = await db.all(
    'SELECT neighborhood FROM user_neighborhoods WHERE user_id = ? ORDER BY neighborhood ASC',
    [userId]
  );
  return rows.map(r => r.neighborhood);
}

async function requireAuth(req, res, next) {
  let token = null;

  // Extract from Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Extract from cookie (if browser sends it)
  else if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').reduce((acc, c) => {
      const parts = c.split('=');
      acc[parts[0].trim()] = (parts[1] || '').trim();
      return acc;
    }, {});
    token = cookies['token'];
  }

  if (!token) {
    return res.status(401).json({ message: 'Yetkilendirme hatası: Giriş yapmalısınız.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ message: 'Geçersiz veya süresi dolmuş oturum.' });
  }

  try {
    const db = await getDb();
    const user = await db.get('SELECT id, name, email, role, district, status FROM users WHERE id = ?', [decoded.id]);

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ message: 'Oturumunuz geçersiz veya hesabınız aktif değil.' });
    }

    user.neighborhoods = user.role === 'USER' ? await getUserNeighborhoods(db, user.id) : [];
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth user load error:', error);
    return res.status(500).json({ message: 'Sunucu hatası oluştu.' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Bu işlemi yapmak için yetkiniz bulunmamaktadır (Admin yetkisi gerekir).' });
    }
    next();
  });
}

module.exports = {
  generateToken,
  getUserNeighborhoods,
  requireAuth,
  requireAdmin
};
