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
      role TEXT NOT NULL DEFAULT 'GOREVSIZ',
      search_index TEXT,
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

  // Check if search_index column exists in members table, if not add it (Automatic migration)
  const columns = await db.all('PRAGMA table_info(members)');
  const hasSearchIndex = columns.some(c => c.name === 'search_index');
  if (!hasSearchIndex) {
    console.log('Migrating: Adding search_index column to members table...');
    await db.run('ALTER TABLE members ADD COLUMN search_index TEXT');
    
    // Re-build search index for existing members
    const membersList = await db.all('SELECT * FROM members');
    console.log(`Migrating: Rebuilding search_index for ${membersList.length} members...`);
    
    const normalizeText = (text) => {
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
        .replace(/\s+/g, '');
    };

    for (const member of membersList) {
      const parts = [
        member.first_name,
        member.last_name,
        member.phone,
        member.tckn,
        member.school,
        member.ballot_no,
        member.district
      ];
      const searchIndex = parts.map(normalizeText).join('|');
      await db.run('UPDATE members SET search_index = ? WHERE id = ?', [searchIndex, member.id]);
    }
    console.log('Migration completed successfully.');
  }

  // Migration v2: Re-build search_index with spaces and space normalization
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    const migrationCheck = await db.get("SELECT value FROM settings WHERE key = 'search_index_migration_v2'");
    if (!migrationCheck) {
      console.log('Migrating: Running search_index migration v2 (space separation)...');
      
      const normalizeText = (text) => {
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
      };

      const buildSearchIndex = (member) => {
        const parts = [
          member.first_name,
          member.last_name,
          member.phone,
          member.tckn,
          member.school,
          member.ballot_no,
          member.district
        ];
        return parts.map(normalizeText).join(' ');
      };

      const membersList = await db.all('SELECT * FROM members');
      await db.run('BEGIN TRANSACTION');
      for (const member of membersList) {
        const searchIndex = buildSearchIndex(member);
        await db.run('UPDATE members SET search_index = ? WHERE id = ?', [searchIndex, member.id]);
      }
      await db.run('COMMIT');

      await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('search_index_migration_v2', 'true')");
      console.log('Migrating: Search_index migration v2 completed successfully.');
    }
  } catch (err) {
    console.error('Failed to run search_index migration v2:', err);
    try { await db.run('ROLLBACK'); } catch(_) {}
  }

  // Migration v3: Clean up duplicate members (same TCKN, first name, and last name)
  try {
    const migrationCheck = await db.get("SELECT value FROM settings WHERE key = 'duplicate_cleanup_migration_v3'");
    if (!migrationCheck) {
      console.log('Migrating: Running duplicate members cleanup migration v3...');

      const dupGroups = await db.all(`
        SELECT tckn, first_name, last_name, COUNT(*) as count 
        FROM members 
        WHERE tckn IS NOT NULL AND tckn != '' 
        GROUP BY tckn, first_name, last_name 
        HAVING count > 1
      `);

      if (dupGroups.length > 0) {
        console.log(`Migrating: Found ${dupGroups.length} duplicate groups to resolve...`);
        await db.run('BEGIN TRANSACTION');

        for (const group of dupGroups) {
          // Select all members in the group, sorted by created_at ascending
          const membersInGroup = await db.all(
            `SELECT id, role, district FROM members 
             WHERE tckn = ? AND first_name = ? AND last_name = ? 
             ORDER BY created_at ASC`,
            [group.tckn, group.first_name, group.last_name]
          );

          if (membersInGroup.length > 1) {
            const primaryMember = membersInGroup[0];
            const duplicateMembers = membersInGroup.slice(1);

            console.log(`Migrating: Resolving duplicate group TCKN: ${group.tckn}. Keeping member ${primaryMember.id}, deleting ${duplicateMembers.length} duplicates.`);

            for (const dup of duplicateMembers) {
              // Update timeline events to point to the primary member
              await db.run(
                'UPDATE timeline_events SET member_id = ? WHERE member_id = ?',
                [primaryMember.id, dup.id]
              );

              // Delete the duplicate member
              await db.run(
                'DELETE FROM members WHERE id = ?',
                [dup.id]
              );
            }
          }
        }

        await db.run('COMMIT');
        console.log('Migrating: Duplicate members resolved successfully.');
      } else {
        console.log('Migrating: No duplicate members found.');
      }

      await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('duplicate_cleanup_migration_v3', 'true')");
    }
  } catch (err) {
    console.error('Failed to run duplicate cleanup migration v3:', err);
    try { await db.run('ROLLBACK'); } catch(_) {}
  }

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
