const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../db');
const { generateToken, getUserNeighborhoods, requireAuth } = require('../auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'E-posta ve şifre gereklidir.' });
  }

  try {
    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);

    if (!user) {
      return res.status(401).json({ message: 'E-posta veya şifre hatalı.' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ message: 'Hesabınız pasife alınmıştır. Yöneticiyle görüşün.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'E-posta veya şifre hatalı.' });
    }

    const token = generateToken(user);
    const neighborhoods = user.role === 'USER' ? await getUserNeighborhoods(db, user.id) : [];
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        district: user.district,
        neighborhoods
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Sunucu hatası oluştu.' });
  }
});

// GET /api/auth/me
// requireAuth already loads the user fresh from the DB (incl. status and neighborhoods)
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
