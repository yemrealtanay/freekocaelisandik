require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Initialize Database on startup
getDb().then(() => {
  console.log('Database initialized successfully.');
}).catch((error) => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/members', require('./routes/members'));
app.use('/api/uploads', require('./routes/uploads'));

// Serve client static files in production
const clientBuildPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientBuildPath));

// Catch-all route to serve the Single Page Application index.html
app.get('*', (req, res) => {
  // If it's an API route that wasn't matched, send a 404
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: 'API endpoint bulunamadı.' });
  }
  
  // Serve the SPA
  const indexPath = path.join(clientBuildPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      // In development, dist might not exist yet, send a simple message
      res.status(200).send('Sunucu çalışıyor. İstemci kodlarını geliştirmek için client geliştirme sunucusunu başlatın veya üretimi (production) derleyin.');
    }
  });
});

// Start listening
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
