const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbDir = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = process.env.DB_PATH || path.join(dbDir, 'db.sqlite');

let db = null;

// 48 official neighborhoods from the member list Excel
const GOLCUK_NEIGHBORHOODS = [
  "ATATÜRK MAH.",
  "AYVAZPINARI MAH.",
  "CUMHURİYET MAH.",
  "DENİZ EVLER MAH.",
  "DEĞİRMENDERE MERKEZ MAH.",
  "DEĞİRMENDERE YALI MAH.",
  "DONANMA MAH.",
  "DUMLUPINAR MAH.",
  "DÜZAĞAÇ MAH.",
  "ESKİFERHADİYE MAH.",
  "FERHADİYE MAH.",
  "HALIDERE YALI MAH.",
  "HALIDERE YENİ MAH.",
  "HAMİDİYE MAH.",
  "HASANEYN MAH.",
  "HİSAREYN MERKEZ MAH.",
  "KARAKÖPRÜ MAH.",
  "KAVAKLI MAH.",
  "KÖRFEZ MAH.",
  "LÜTFİYE MAH.",
  "MAMURİYE MAH.",
  "MERKEZ MAH.",
  "MESRURİYE MAH.",
  "NÜZHETİYE MAH.",
  "NİMETİYE MAH.",
  "PANAYIR MAH.",
  "PİYALEPAŞA MAH.",
  "SARAYLI MAH.",
  "SELİMİYE MAH.",
  "TOPÇULAR MAH.",
  "ULAŞLI YALI MAH.",
  "ULAŞLI YAVUZ SULTAN SELİM MAH.",
  "YAZLIK MERKEZ MAH.",
  "YAZLIK YENİ MAH.",
  "YENİ MAH.",
  "YUKARI MAH.",
  "YUNUS EMRE MAH.",
  "YÜZBAŞILAR MAH.",
  "ÇİFTLİK MAH.",
  "ÖRCÜN MAH.",
  "ÜMMİYE MAH.",
  "İCADİYE MAH.",
  "İHSANİYE MERKEZ MAH.",
  "İPEK YOLU MAH.",
  "İRŞADİYE MAH.",
  "ŞEHİTLER MAH.",
  "ŞEVKETİYE MAH.",
  "ŞİRİNKÖY MAH."
];

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

async function getDb() {
  if (db) return db;

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await db.run('PRAGMA foreign_keys = ON');

  // Initialize core tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      district TEXT DEFAULT 'Gölcük',
      neighborhood TEXT,
      role TEXT NOT NULL CHECK(role IN ('ADMIN', 'USER')),
      status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'PASSIVE')) DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS neighborhoods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      district TEXT NOT NULL DEFAULT 'Gölcük',
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      sno INTEGER,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT,
      district TEXT NOT NULL DEFAULT 'Gölcük',
      neighborhood TEXT NOT NULL,
      vote_stance TEXT NOT NULL DEFAULT 'BELIRTILMEDI', -- DESTEKLIYOR, KARARSIZ, MESAFELI, GELMEYECEK, BELIRTILMEDI
      contact_status TEXT NOT NULL DEFAULT 'GORUSULMEDI', -- GORUSULDU, GORUSULMEDI
      has_voted INTEGER NOT NULL DEFAULT 0, -- 0: Oy Kullanmadı, 1: Oy Kullandı
      voted_at DATETIME,
      last_contact_date TEXT,
      search_index TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_members_district ON members(district);
    CREATE INDEX IF NOT EXISTS idx_members_neighborhood ON members(neighborhood);
    CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);
    CREATE INDEX IF NOT EXISTS idx_members_name ON members(first_name, last_name);
    CREATE INDEX IF NOT EXISTS idx_members_vote_stance ON members(vote_stance);

    CREATE TABLE IF NOT EXISTS timeline_events (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL, -- CALL, SMS, VISIT, NOTE, SECIM_OYU, DURUM_DEGISIKLIGI, SYSTEM
      date TEXT NOT NULL, -- YYYY-MM-DD
      note TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_timeline_member ON timeline_events(member_id);

    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      district TEXT NOT NULL,
      filename TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      user_name TEXT NOT NULL,
      action_type TEXT NOT NULL,
      details TEXT NOT NULL,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration: Ensure has_voted, voted_at, sno columns exist in members table
  const memberCols = await db.all('PRAGMA table_info(members)');
  const colNames = memberCols.map(c => c.name);

  if (!colNames.includes('has_voted')) {
    await db.run('ALTER TABLE members ADD COLUMN has_voted INTEGER NOT NULL DEFAULT 0');
  }
  if (!colNames.includes('voted_at')) {
    await db.run('ALTER TABLE members ADD COLUMN voted_at DATETIME');
  }
  if (!colNames.includes('sno')) {
    await db.run('ALTER TABLE members ADD COLUMN sno INTEGER');
  }

  await db.run('CREATE INDEX IF NOT EXISTS idx_members_has_voted ON members(has_voted)');

  // Seed 48 official neighborhoods
  const insertNeighborhoodStmt = await db.prepare(
    'INSERT OR IGNORE INTO neighborhoods (district, name) VALUES (?, ?)'
  );
  for (const nName of GOLCUK_NEIGHBORHOODS) {
    await insertNeighborhoodStmt.run('Gölcük', nName);
  }
  await insertNeighborhoodStmt.finalize();

  // Seed default admin user if not exists
  const adminExists = await db.get('SELECT * FROM users WHERE email = ?', ['admin@kocaeli-org.local']);
  if (!adminExists) {
    const adminId = 'admin-' + Math.random().toString(36).substr(2, 9);
    const passwordHash = await bcrypt.hash('admin123', 10);
    await db.run(
      'INSERT INTO users (id, name, email, password_hash, district, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [adminId, 'Admin Kullanıcı', 'admin@kocaeli-org.local', passwordHash, 'Gölcük', 'ADMIN', 'ACTIVE']
    );
    console.log('Seeded default admin user successfully.');
  }

  // Seed default mahalle sorumlusu if not exists
  const repExists = await db.get('SELECT * FROM users WHERE email = ?', ['sorumlu@kocaeli-org.local']);
  if (!repExists) {
    const repId = 'user-' + Math.random().toString(36).substr(2, 9);
    const passwordHash = await bcrypt.hash('sorumlu123', 10);
    await db.run(
      'INSERT INTO users (id, name, email, password_hash, district, neighborhood, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [repId, 'Ahmet Yılmaz (Mahalle Sorumlusu)', 'sorumlu@kocaeli-org.local', passwordHash, 'Gölcük', 'DEĞİRMENDERE MERKEZ MAH.', 'USER', 'ACTIVE']
    );
    console.log('Seeded default mahalle sorumlusu successfully.');
  }

  return db;
}

module.exports = {
  getDb,
  dbPath,
  GOLCUK_NEIGHBORHOODS,
  normalizeText,
  buildSearchIndex
};
