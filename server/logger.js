const { getDb } = require('./db');

async function logAction(req, actionType, details) {
  try {
    const db = await getDb();
    const id = 'log-' + Math.random().toString(36).substr(2, 9);
    
    // Get client IP address
    let ip = '';
    if (req) {
      ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
      // If x-forwarded-for contains a list of IPs, take the first one
      if (ip.includes(',')) {
        ip = ip.split(',')[0].trim();
      }
    }
    
    const userId = (req && req.user) ? req.user.id : 'SYSTEM';
    const userEmail = (req && req.user) ? req.user.email : 'system@local';
    const userName = (req && req.user) ? req.user.name : 'Sistem';

    await db.run(
      `INSERT INTO audit_logs (id, user_id, user_email, user_name, action_type, details, ip_address) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, userEmail, userName, actionType, details, ip]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

module.exports = {
  logAction
};
