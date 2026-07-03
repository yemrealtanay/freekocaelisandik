const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'db.sqlite');

let db = null;

async function getDb() {
  if (db) return db;

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await db.run('PRAGMA foreign_keys = ON');

  // Initialize tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      district TEXT, -- NULL for admin who has access to all
      role TEXT NOT NULL CHECK(role IN ('ADMIN', 'USER')),
      status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'PASSIVE')) DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      tckn TEXT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT,
      province TEXT DEFAULT 'KOCAELİ',
      district TEXT NOT NULL,
      school TEXT,
      ballot_no TEXT,
      role TEXT NOT NULL CHECK(role IN ('GOREVSIZ', 'SANDIK_GOREVLISI', 'SANDIK_SORUMLUSU', 'MUSAHIT', 'YEDEK')) DEFAULT 'GOREVSIZ',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_members_district ON members(district);
    CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);
    CREATE INDEX IF NOT EXISTS idx_members_name ON members(first_name, last_name);

    CREATE TABLE IF NOT EXISTS timeline_events (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL, -- e.g. CALL, SMS, EMAIL, VISIT, NOTE, ROLE_CHANGE, SYSTEM
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
  `);

  // Seed default admin user if not exists
  const adminExists = await db.get('SELECT * FROM users WHERE email = ?', ['admin@kocaeli-org.local']);
  if (!adminExists) {
    const adminId = 'admin-' + Math.random().toString(36).substr(2, 9);
    const passwordHash = await bcrypt.hash('admin123456', 10);
    await db.run(
      'INSERT INTO users (id, name, email, password_hash, district, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [adminId, 'Admin Kullanıcı', 'admin@kocaeli-org.local', passwordHash, null, 'ADMIN', 'ACTIVE']
    );
    console.log('Seeded default admin user successfully.');
  }

  return db;
}

module.exports = {
  getDb
};
