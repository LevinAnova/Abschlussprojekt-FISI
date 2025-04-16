const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const cors = require('cors');
const formidable = require('formidable');
const os = require('os');
const fs = require('fs');                 // Für synchrone Funktionen wie existsSync
const fsPromises = fs.promises;           // Für asynchrone Operationen mit Promises
const bcrypt = require('bcrypt');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);


// Express App initialisieren
const app = express();
const PORT = process.env.PORT || 4848;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Debug-Modus aktivieren (auf false setzen in Produktion)
const DEBUG = true;

// Verbesserte Fehlerbehandlung
function handleError(res, error, message = 'Ein Fehler ist aufgetreten', statusCode = 500) {
  if (DEBUG) {
    console.error(`[ERROR] ${message}:`, error);
  }
  res.status(statusCode).json({ 
    error: message, 
    details: DEBUG ? error.message : undefined 
  });
}

// MariaDB/MySQL Connection Pool erstellen
const pool = mysql.createPool({
  host: '127.0.0.1',
  user: 'vwapp',
  password: 'fisi',
  database: 'vw_ausbildung',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Debug-Optionen
  debug: false
});

// Datenbank-Verbindung testen
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Datenbankverbindung erfolgreich hergestellt');
    connection.release();
  } catch (err) {
    console.error('❌ Fehler beim Verbinden zur Datenbank:', err.message);
    console.error('Bitte stelle sicher, dass MySQL/MariaDB läuft und die Zugangsdaten korrekt sind');
  }
})();

// Upload-Verzeichnisse definieren
const uploadDir = '/var/www/html/vw-ausbildung/uploads';
const galleryDir = path.join(uploadDir, 'gallery');
const qrCodesDir = path.join(uploadDir, 'qr_codes');

// Stelle sicher, dass die Upload-Verzeichnisse existieren
(async () => {
  try {
    // Prüfe und erstelle die Verzeichnisse - mit Fehlerbehandlung
    if (!fs.existsSync(uploadDir)) {
      await fsPromises.mkdir(uploadDir, { recursive: true });
    }
    
    if (!fs.existsSync(galleryDir)) {
      await fsPromises.mkdir(galleryDir, { recursive: true });
    }
    
    if (!fs.existsSync(qrCodesDir)) {
      await fsPromises.mkdir(qrCodesDir, { recursive: true });
    }
    
    console.log('✅ Upload-Verzeichnisse erfolgreich erstellt');
    
    // Setze Berechtigungen, falls möglich
    try {
      await fsPromises.chmod(uploadDir, 0o755);
      await fsPromises.chmod(galleryDir, 0o755);
      await fsPromises.chmod(qrCodesDir, 0o755);
    } catch (permErr) {
      console.warn('ℹ️ Konnte Berechtigungen für Verzeichnisse nicht setzen:', permErr.message);
    }
  } catch (err) {
    console.error('❌ Fehler beim Erstellen der Upload-Verzeichnisse:', err);
  }
})();

// Logging-Middleware
app.use((req, res, next) => {
  if (DEBUG) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Fehlerbehandlungs-Middleware
app.use((err, req, res, next) => {
  console.error('Unbehandelte Ausnahme:', err);
  res.status(500).json({ error: 'Interner Serverfehler', details: DEBUG ? err.message : undefined });
});


// Middleware für Sitzungsverwaltung
const sessionStore = new MySQLStore({
  host: '127.0.0.1',
  user: 'vwapp',
  password: 'fisi',
  database: 'vw_ausbildung'
});

app.use(session({
  key: 'vw_ausbildung_sid',
  secret: 'vw_ausbildung_secret',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 Tag
      httpOnly: true,
      secure: false // Bei Produktion auf true setzen
  }
}));

// Authentifizierungsmiddleware
function isAuthenticated(req, res, next) {
  if (req.session.user) {
      return next();
  }
  res.status(401).json({ error: 'Nicht autorisiert. Bitte melden Sie sich an.' });
}

// Statische Dateien für login.html vor der Auth-Middleware servieren
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Middleware zum Schutz der admin.html
app.use('/admin.html', (req, res, next) => {
  if (!req.session.user) {
      return res.redirect('/login.html');
  }
  next();
});

// ===== API-Routen =====

// Root-Endpoint für API-Tests
app.get('/api', (req, res) => {
  res.json({ 
    message: 'VW Ausbildungsberufe API funktioniert!',
    version: '1.0.0',
    endpoints: ['/api/categories', '/api/professions']
  });
});

// Login Routen
app.post('/api/auth/login', async (req, res) => {
  try {
      const { username, password } = req.body;
      
      if (!username || !password) {
          return res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
      }
      
      const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
      
      if (users.length === 0) {
          return res.status(401).json({ error: 'Ungültiger Benutzername oder Passwort' });
      }
      
      const user = users[0];
      const passwordValid = await bcrypt.compare(password, user.password);
      
      if (!passwordValid) {
          return res.status(401).json({ error: 'Ungültiger Benutzername oder Passwort' });
      }
      
      // Benutzer in der Sitzung speichern (ohne Passwort)
      req.session.user = {
          id: user.id,
          username: user.username,
          role: user.role
      };
      
      res.json({ success: true, message: 'Anmeldung erfolgreich' });
  } catch (err) {
      handleError(res, err, 'Fehler bei der Anmeldung');
  }
});

app.get('/api/auth/status', (req, res) => {
  if (req.session.user) {
      res.json({
          authenticated: true,
          user: req.session.user
      });
  } else {
      res.json({
          authenticated: false
      });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
      if (err) {
          return res.status(500).json({ error: 'Fehler beim Abmelden' });
      }
      res.json({ message: 'Abmeldung erfolgreich' });
  });
});

// Routen für Benutzerverwaltung
app.get('/api/users', isAuthenticated, async (req, res) => {
  try {
      const [users] = await pool.query('SELECT id, username, role, created_at FROM users');
      res.json(users);
  } catch (err) {
      handleError(res, err, 'Fehler beim Abrufen der Benutzer');
  }
});

app.post('/api/users', isAuthenticated, async (req, res) => {
  try {
      const { username, password, role } = req.body;
      
      if (!username || !password) {
          return res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
      }
      
      // Prüfen, ob der Benutzername bereits existiert
      const [existingUsers] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
      if (existingUsers.length > 0) {
          return res.status(409).json({ error: 'Benutzername existiert bereits' });
      }
      
      // Passwort hashen
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      // Benutzer speichern
      const [result] = await pool.query(
          'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
          [username, hashedPassword, role || 'admin']
      );
      
      res.status(201).json({ 
          id: result.insertId,
          username,
          role: role || 'admin'
      });
  } catch (err) {
      handleError(res, err, 'Fehler beim Erstellen des Benutzers');
  }
});

app.delete('/api/users/:id', isAuthenticated, async (req, res) => {
  try {
      const { id } = req.params;
      
      // Verhindere das Löschen des eigenen Kontos
      if (req.session.user.id == id) {
          return res.status(400).json({ error: 'Sie können Ihr eigenes Konto nicht löschen' });
      }
      
      // Benutzer löschen
      const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
      
      if (result.affectedRows === 0) {
          return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      }
      
      res.json({ message: 'Benutzer erfolgreich gelöscht' });
  } catch (err) {
      handleError(res, err, 'Fehler beim Löschen des Benutzers');
  }
});

// ===== Kategorien API =====

// Alle Kategorien abrufen
app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM categories ORDER BY name');
    if (DEBUG) {
      console.log(`Kategorien geladen: ${rows.length}`);
    }
    res.json(rows);
  } catch (err) {
    handleError(res, err, 'Fehler beim Abrufen der Kategorien');
  }
});

// Einzelne Kategorie abrufen
app.get('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM categories WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Kategorie nicht gefunden' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    handleError(res, err, 'Fehler beim Abrufen der Kategorie');
  }
});

// Kategorie erstellen
app.post('/api/categories', async (req, res) => {
  try {
    const { id, name } = req.body;
    
    if (!id || !name) {
      return res.status(400).json({ error: 'ID und Name sind erforderlich' });
    }
    
    // Prüfen, ob die ID bereits existiert
    const [existing] = await pool.query('SELECT id FROM categories WHERE id = ?', [id]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Diese Kategorie-ID existiert bereits' });
    }
    
    await pool.query('INSERT INTO categories (id, name) VALUES (?, ?)', [id, name]);
    
    if (DEBUG) {
      console.log(`Neue Kategorie erstellt: ${id} - ${name}`);
    }
    
    res.status(201).json({ id, name });
  } catch (err) {
    handleError(res, err, 'Fehler beim Erstellen der Kategorie');
  }
});

// Kategorie aktualisieren
app.put('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name ist erforderlich' });
    }
    
    const [result] = await pool.query('UPDATE categories SET name = ? WHERE id = ?', [name, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Kategorie nicht gefunden' });
    }
    
    res.json({ id, name });
  } catch (err) {
    handleError(res, err, 'Fehler beim Aktualisieren der Kategorie');
  }
});

// Kategorie löschen
app.delete('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prüfen, ob die Kategorie in Verwendung ist
    const [professions] = await pool.query('SELECT COUNT(*) as count FROM professions WHERE category_id = ?', [id]);
    
    if (professions[0].count > 0) {
      return res.status(400).json({ error: 'Kategorie wird von Berufen verwendet und kann nicht gelöscht werden' });
    }
    
    const [result] = await pool.query('DELETE FROM categories WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Kategorie nicht gefunden' });
    }
    
    res.json({ message: 'Kategorie erfolgreich gelöscht' });
  } catch (err) {
    handleError(res, err, 'Fehler beim Löschen der Kategorie');
  }
});

// ===== Berufe API =====

// Alle Berufe mit Details abrufen
app.get('/api/professions', async (req, res) => {
  try {
    // Hauptdaten der Berufe abrufen
    const [professions] = await pool.query(`
      SELECT p.*, c.name as category_name
      FROM professions p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.title
    `);
    
    // Für jeden Beruf die Details abrufen
    const result = await Promise.all(professions.map(async (profession) => {
      try {
        // Anforderungen
        const [requirements] = await pool.query(
          'SELECT text FROM requirements WHERE profession_id = ? ORDER BY sort_order',
          [profession.id]
        );
        
        // Karrieremöglichkeiten
        const [careerOptions] = await pool.query(
          'SELECT text FROM career_options WHERE profession_id = ? ORDER BY sort_order',
          [profession.id]
        );
        
        // Standorte
        const [locations] = await pool.query(
          'SELECT text FROM locations WHERE profession_id = ? ORDER BY sort_order',
          [profession.id]
        );
        
        // Bilder
        const [images] = await pool.query(
          'SELECT id, filename, alt_text FROM gallery_images WHERE profession_id = ? ORDER BY sort_order',
          [profession.id]
        );
        
        // QR-Code
        const [qrCodes] = await pool.query(
          'SELECT filename FROM qr_codes WHERE profession_id = ?',
          [profession.id]
        );
        
        return {
          ...profession,
          requirements: requirements.map(r => r.text),
          career_options: careerOptions.map(c => c.text),
          locations: locations.map(l => l.text),
          gallery_images: images.map(img => ({
            id: img.id,
            url: `/uploads/gallery/${profession.id}/${img.filename}`,
            alt_text: img.alt_text || profession.title
          })),
          qr_code: qrCodes.length > 0 ? `/uploads/qr_codes/${profession.id}/${qrCodes[0].filename}` : null
        };
      } catch (err) {
        console.error(`Fehler beim Laden der Details für Beruf ${profession.id}:`, err);
        // Rückgabe des Berufs ohne Details bei Fehlern
        return {
          ...profession,
          requirements: [],
          career_options: [],
          locations: [],
          gallery_images: [],
          qr_code: null,
          error: 'Details konnten nicht geladen werden'
        };
      }
    }));
    
    if (DEBUG) {
      console.log(`Berufe geladen: ${result.length}`);
    }
    
    res.json(result);
  } catch (err) {
    handleError(res, err, 'Fehler beim Abrufen der Berufe');
  }
});


// QR-Code löschen
app.delete('/api/professions/:id/qr-code', async (req, res) => {
  try {
    const { id } = req.params;
    
    // QR-Code-Datei finden
    const [qrCodes] = await pool.query('SELECT filename FROM qr_codes WHERE profession_id = ?', [id]);
    
    if (qrCodes.length === 0) {
      return res.status(404).json({ error: 'QR-Code nicht gefunden' });
    }
    
    const filename = qrCodes[0].filename;
    
    // Aus der Datenbank löschen
    await pool.query('DELETE FROM qr_codes WHERE profession_id = ?', [id]);
    
    // Von der Festplatte löschen
    try {
      const qrCodePath = path.join(qrCodesDir, id, filename);
      if (fs.existsSync(qrCodePath)) {
        await fsPromises.unlink(qrCodePath);
      } else {
        console.warn(`QR-Code-Datei existiert nicht: ${qrCodePath}`);
      }
    } catch (e) {
      console.warn(`Konnte QR-Code nicht löschen: ${filename}`, e);
    }
    
    if (DEBUG) {
      console.log(`QR-Code gelöscht für Beruf: ${id}`);
    }
    
    res.json({ message: 'QR-Code erfolgreich gelöscht' });
  } catch (err) {
    handleError(res, err, 'Fehler beim Löschen des QR-Codes');
  }
});

// Einzelnen Beruf abrufen
app.get('/api/professions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Hauptdaten des Berufs abrufen
    const [professions] = await pool.query(`
      SELECT p.*, c.name as category_name
      FROM professions p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `, [id]);
    
    if (professions.length === 0) {
      return res.status(404).json({ error: 'Beruf nicht gefunden' });
    }
    
    const profession = professions[0];
    
    // Anforderungen
    const [requirements] = await pool.query(
      'SELECT text FROM requirements WHERE profession_id = ? ORDER BY sort_order',
      [id]
    );
    
    // Karrieremöglichkeiten
    const [careerOptions] = await pool.query(
      'SELECT text FROM career_options WHERE profession_id = ? ORDER BY sort_order',
      [id]
    );
    
    // Standorte
    const [locations] = await pool.query(
      'SELECT text FROM locations WHERE profession_id = ? ORDER BY sort_order',
      [id]
    );
    
    // Bilder
    const [images] = await pool.query(
      'SELECT id, filename, alt_text FROM gallery_images WHERE profession_id = ? ORDER BY sort_order',
      [id]
    );
    
    // QR-Code
    const [qrCodes] = await pool.query(
      'SELECT filename FROM qr_codes WHERE profession_id = ?',
      [id]
    );
    
    const result = {
      ...profession,
      requirements: requirements.map(r => r.text),
      career_options: careerOptions.map(c => c.text),
      locations: locations.map(l => l.text),
      gallery_images: images.map(img => ({
        id: img.id,
        url: `/uploads/gallery/${profession.id}/${img.filename}`,
        alt_text: img.alt_text || profession.title
      })),
      qr_code: qrCodes.length > 0 ? `/uploads/qr_codes/${profession.id}/${qrCodes[0].filename}` : null
    };
    
    res.json(result);
  } catch (err) {
    handleError(res, err, 'Fehler beim Abrufen des Berufs');
  }
});

// Beruf erstellen/aktualisieren (mit Transaktion)
app.post('/api/professions', async (req, res) => {
  let connection;
  try {
    const {
      id,
      title,
      description,
      duration,
      category_id,
      has_knowledge_test,
      requirements = [],
      career_options = [],
      locations = []
    } = req.body;
    
    if (!id || !title || !description || !duration || !category_id) {
      return res.status(400).json({ error: 'Unvollständige Daten. ID, Titel, Beschreibung, Dauer und Kategorie sind erforderlich' });
    }
    
    // Prüfen, ob die Kategorie existiert
    const [categoryExists] = await pool.query('SELECT id FROM categories WHERE id = ?', [category_id]);
    if (categoryExists.length === 0) {
      return res.status(400).json({ error: `Kategorie mit ID ${category_id} existiert nicht` });
    }
    
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    // Prüfen, ob der Beruf bereits existiert
    const [existing] = await connection.query('SELECT id FROM professions WHERE id = ?', [id]);
    
    if (existing.length > 0) {
      // Update
      await connection.query(
        'UPDATE professions SET title = ?, description = ?, duration = ?, category_id = ?, has_knowledge_test = ? WHERE id = ?',
        [title, description, duration, category_id, has_knowledge_test || false, id]
      );
      
      if (DEBUG) {
        console.log(`Beruf aktualisiert: ${id} - ${title}`);
      }
    } else {
      // Insert
      await connection.query(
        'INSERT INTO professions (id, title, description, duration, category_id, has_knowledge_test) VALUES (?, ?, ?, ?, ?, ?)',
        [id, title, description, duration, category_id, has_knowledge_test || false]
      );
      
      if (DEBUG) {
        console.log(`Neuer Beruf erstellt: ${id} - ${title}`);
      }
    }
    
    // Anforderungen aktualisieren
    await connection.query('DELETE FROM requirements WHERE profession_id = ?', [id]);
    if (requirements && requirements.length > 0) {
      const requirementValues = requirements.map((text, index) => [id, text, index]);
      await connection.query(
        'INSERT INTO requirements (profession_id, text, sort_order) VALUES ?',
        [requirementValues]
      );
    }
    
    // Karrieremöglichkeiten aktualisieren
    await connection.query('DELETE FROM career_options WHERE profession_id = ?', [id]);
    if (career_options && career_options.length > 0) {
      const careerValues = career_options.map((text, index) => [id, text, index]);
      await connection.query(
        'INSERT INTO career_options (profession_id, text, sort_order) VALUES ?',
        [careerValues]
      );
    }
    
    // Standorte aktualisieren
    await connection.query('DELETE FROM locations WHERE profession_id = ?', [id]);
    if (locations && locations.length > 0) {
      const locationValues = locations.map((text, index) => [id, text, index]);
      await connection.query(
        'INSERT INTO locations (profession_id, text, sort_order) VALUES ?',
        [locationValues]
      );
    }
    
    await connection.commit();
    res.status(201).json({ id, message: 'Beruf erfolgreich gespeichert' });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    handleError(res, err, 'Fehler beim Speichern des Berufs');
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Beruf löschen (mit Transaktion)
app.delete('/api/professions/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    // Bilder und QR-Codes finden, um sie später von der Festplatte zu löschen
    const [images] = await connection.query('SELECT filename FROM gallery_images WHERE profession_id = ?', [id]);
    const [qrCodes] = await connection.query('SELECT filename FROM qr_codes WHERE profession_id = ?', [id]);
    const [result] = await connection.query('DELETE FROM professions WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Beruf nicht gefunden' });
    }
    
    await connection.commit();
    
    // Dateien von der Festplatte löschen
    for (const img of images) {
      try {
        const imagePath = path.join(galleryDir, id, img.filename);
        if (fs.existsSync(imagePath)) {
          await fsPromises.unlink(imagePath);
        } else {
          console.warn(`Bilddatei existiert nicht: ${imagePath}`);
        }
      } catch (e) {
        console.warn(`Konnte Bild nicht löschen: ${img.filename}`, e);
      }
    }
    
    for (const qr of qrCodes) {
      try {
        const qrPath = path.join(qrCodesDir, id, qr.filename);
        if (fs.existsSync(qrPath)) {
          await fsPromises.unlink(qrPath);
        } else {
          console.warn(`QR-Code-Datei existiert nicht: ${qrPath}`);
        }
      } catch (e) {
        console.warn(`Konnte QR-Code nicht löschen: ${qr.filename}`, e);
      }
    }
    
    if (DEBUG) {
      console.log(`Beruf gelöscht: ${id}`);
    }
    
    res.json({ message: 'Beruf erfolgreich gelöscht' });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    handleError(res, err, 'Fehler beim Löschen des Berufs');
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// ===== Bild-Upload und -Verwaltung mit formidable =====

app.post('/api/professions/:professionId/images/:type?', async (req, res) => {
  try {
    const { professionId, type } = req.params;
    const isQrCode = type === 'qr';
    
    console.log(`Bild-Upload für Beruf ${professionId}, Typ: ${isQrCode ? 'QR-Code' : 'Gallerie'}`);
    
    // Prüfen, ob der Beruf existiert
    const [professionExists] = await pool.query('SELECT id FROM professions WHERE id = ?', [professionId]);
    if (professionExists.length === 0) {
      return res.status(404).json({ error: `Beruf mit ID ${professionId} existiert nicht` });
    }
    
    // Verzeichnisse erstellen - mit Fehlerbehandlung
    try {
      // Basis-Verzeichnisse prüfen und erstellen
      if (!fs.existsSync(uploadDir)) {
        await fsPromises.mkdir(uploadDir, { recursive: true });
      }
      
      if (!fs.existsSync(galleryDir)) {
        await fsPromises.mkdir(galleryDir, { recursive: true });
      }
      
      if (!fs.existsSync(qrCodesDir)) {
        await fsPromises.mkdir(qrCodesDir, { recursive: true });
      }
      
      // Zielverzeichnis für den spezifischen Beruf erstellen
      const targetDir = isQrCode 
        ? path.join(qrCodesDir, professionId) 
        : path.join(galleryDir, professionId);
      
      if (!fs.existsSync(targetDir)) {
        await fsPromises.mkdir(targetDir, { recursive: true });
      }
      
      // Temporäres Verzeichnis für Uploads
      const tempDir = path.join(os.tmpdir(), 'vw-uploads');
      if (!fs.existsSync(tempDir)) {
        await fsPromises.mkdir(tempDir, { recursive: true });
      }
      
      // Formidable konfigurieren - angepasst für verschiedene Versionen
      const form = new formidable.IncomingForm({
        uploadDir: tempDir,
        keepExtensions: true,
        maxFileSize: 5 * 1024 * 1024, // 5MB
        multiples: false // Nur eine Datei erlauben
      });
      
      // Form parsen mit verbesserter Fehlerbehandlung
      form.parse(req, async (err, fields, files) => {
        if (err) {
          console.error('Formidable Fehler:', err);
          return res.status(500).json({ error: 'Fehler beim Datei-Upload: ' + err.message });
        }
        
        // Debug-Ausgabe der vollständigen Dateienstruktur
        console.log('Formidable Dateien:', JSON.stringify(files, null, 2));
        
        if (!files || Object.keys(files).length === 0) {
          return res.status(400).json({ error: 'Keine Datei gefunden' });
        }
        
        try {
          // Extrahiere die Datei - Unterstützt verschiedene formidable-Versionen
          let file;
          
          // Formidable v1.x
          if (files.file && typeof files.file === 'object' && !Array.isArray(files.file)) {
            file = files.file;
          } 
          // Formidable v2.x
          else if (files.file && Array.isArray(files.file) && files.file.length > 0) {
            file = files.file[0];
          } 
          // Fallback: Nimm die erste Datei, die wir finden können
          else {
            const firstKey = Object.keys(files)[0];
            if (firstKey && files[firstKey]) {
              const firstFile = files[firstKey];
              file = Array.isArray(firstFile) ? firstFile[0] : firstFile;
            } else {
              console.error('Keine gültige Datei gefunden:', files);
              return res.status(400).json({ error: 'Keine gültige Datei gefunden' });
            }
          }
          
          // Prüfe nochmals, ob wir eine gültige Datei haben
          if (!file || typeof file !== 'object') {
            console.error('Keine gültige Datei gefunden:', files);
            return res.status(400).json({ error: 'Keine gültige Datei gefunden' });
          }
          
          // Ausgabe der genauen Dateistruktur für Debugging
          console.log('Verwendete Datei:', {
            path: file.filepath || file.path || 'kein Pfad',
            name: file.originalFilename || file.name || 'kein Name',
            type: file.mimetype || file.type || 'kein Typ',
            size: file.size || 'keine Größe'
          });
          
          // Bestimme Dateiname und Pfad - robust gegen unterschiedliche formidable-Versionen
          const filePath = file.filepath || file.path;
          if (!filePath) {
            return res.status(400).json({ error: 'Dateipfad konnte nicht ermittelt werden' });
          }
          
          const originalFilename = file.originalFilename || file.name || `unnamed-file-${Date.now()}`;
          const safeFilename = `${Date.now()}-${path.basename(originalFilename).replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          const targetFilePath = path.join(targetDir, safeFilename);
          
          console.log(`Verschiebe Datei von ${filePath} nach ${targetFilePath}`);
          
          // Datei verschieben
          try {
            // Prüfe, ob Quelldatei existiert
            if (!fs.existsSync(filePath)) {
              return res.status(400).json({ error: `Quelldatei nicht gefunden: ${filePath}` });
            }
            
            // Datei kopieren und dann löschen (da direktes Verschieben problematisch sein kann)
            const data = await fsPromises.readFile(filePath);
            await fsPromises.writeFile(targetFilePath, data);
            
            try {
              await fsPromises.unlink(filePath); // Temporäre Datei löschen
            } catch (unlinkErr) {
              console.warn(`Konnte temporäre Datei nicht löschen: ${filePath}`, unlinkErr);
            }
          } catch (fileErr) {
            console.error('Fehler beim Verschieben der Datei:', fileErr);
            return res.status(500).json({ error: 'Fehler beim Verschieben der Datei: ' + fileErr.message });
          }
          
          // In die Datenbank eintragen
          if (isQrCode) {
            // QR-Code speichern
            try {
              // Prüfen, ob bereits ein QR-Code existiert
              const [existingQR] = await pool.query('SELECT id, filename FROM qr_codes WHERE profession_id = ?', [professionId]);
              
              // Falls ja, alten QR-Code löschen
              if (existingQR.length > 0) {
                try {
                  const oldQRPath = path.join(qrCodesDir, professionId, existingQR[0].filename);
                  if (fs.existsSync(oldQRPath)) {
                    await fsPromises.unlink(oldQRPath);
                  }
                  
                  // Aus der Datenbank löschen
                  await pool.query('DELETE FROM qr_codes WHERE id = ?', [existingQR[0].id]);
                } catch (delErr) {
                  console.warn(`Fehler beim Löschen des alten QR-Codes:`, delErr);
                }
              }
              
              // Neuen QR-Code eintragen
              await pool.query(
                'INSERT INTO qr_codes (profession_id, filename) VALUES (?, ?)',
                [professionId, safeFilename]
              );
              
              return res.status(201).json({
                url: `/uploads/qr_codes/${professionId}/${safeFilename}`
              });
            } catch (qrErr) {
              console.error('Fehler beim Speichern des QR-Codes in der Datenbank:', qrErr);
              return res.status(500).json({ error: 'Fehler beim Speichern des QR-Codes: ' + qrErr.message });
            }
          } else {
            // Galeriebild speichern
            try {
              const connection = await pool.getConnection();
              try {
                const [result] = await connection.query(
                  'INSERT INTO gallery_images (profession_id, filename, alt_text, sort_order) VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order) + 1, 0) FROM gallery_images g WHERE g.profession_id = ?))',
                  [professionId, safeFilename, fields.alt_text || '', professionId]
                );
                
                return res.status(201).json({
                  id: result.insertId,
                  url: `/uploads/gallery/${professionId}/${safeFilename}`,
                  alt_text: fields.alt_text || ''
                });
              } finally {
                connection.release();
              }
            } catch (dbErr) {
              console.error('Fehler beim Speichern des Bildes in der Datenbank:', dbErr);
              return res.status(500).json({ error: 'Fehler beim Speichern des Bildes: ' + dbErr.message });
            }
          }
        } catch (error) {
          console.error('Fehler bei der Dateiverarbeitung:', error);
          return res.status(500).json({ error: 'Fehler bei der Dateiverarbeitung: ' + error.message });
        }
      });
    } catch (dirError) {
      console.error('Fehler beim Erstellen der Verzeichnisse:', dirError);
      return res.status(500).json({ error: 'Konnte Upload-Verzeichnisse nicht erstellen: ' + dirError.message });
    }
  } catch (err) {
    console.error('Unbehandelte Ausnahme beim Bild-Upload:', err);
    return res.status(500).json({ error: 'Interner Serverfehler: ' + err.message });
  }
});

// Bild löschen
app.delete('/api/gallery-images/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Bilddatei finden
    const [images] = await pool.query('SELECT profession_id, filename FROM gallery_images WHERE id = ?', [id]);
    
    if (images.length === 0) {
      return res.status(404).json({ error: 'Bild nicht gefunden' });
    }
    
    const { profession_id, filename } = images[0];
    
    // Aus der Datenbank löschen
    await pool.query('DELETE FROM gallery_images WHERE id = ?', [id]);
    
    // Von der Festplatte löschen
    try {
      const imagePath = path.join(galleryDir, profession_id, filename);
      if (fs.existsSync(imagePath)) {
        await fsPromises.unlink(imagePath);
      } else {
        console.warn(`Bilddatei existiert nicht: ${imagePath}`);
      }
    } catch (e) {
      console.warn(`Konnte Bild nicht löschen: ${filename}`, e);
    }
    
    if (DEBUG) {
      console.log(`Bild gelöscht: ${id} (${filename})`);
    }
    
    res.json({ message: 'Bild erfolgreich gelöscht' });
  } catch (err) {
    handleError(res, err, 'Fehler beim Löschen des Bildes');
  }
});

// Server starten
app.listen(PORT, () => {
  console.log(`
=========================================
  VW Ausbildungsberufe API Server
=========================================
  Server läuft auf Port ${PORT}
  http://localhost:${PORT}/api
  
  Debug-Modus: ${DEBUG ? 'Aktiviert' : 'Deaktiviert'}
  Upload-Verzeichnis: ${uploadDir}
=========================================
  `);
});

// Bei unerwarteter Beendigung aufräumen
process.on('SIGINT', () => {
  console.log('Server wird beendet...');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('Unbehandelte Ausnahme:', err);
  process.exit(1);
});

app.get('/api/professions/:id/quiz', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prüfen, ob der Beruf existiert und einen Wissenstest hat
    const [professions] = await pool.query(
      'SELECT id, has_knowledge_test FROM professions WHERE id = ?',
      [id]
    );
    
    if (professions.length === 0) {
      return res.status(404).json({ error: 'Beruf nicht gefunden' });
    }
    
    if (!professions[0].has_knowledge_test) {
      return res.status(404).json({ error: 'Dieser Beruf hat keinen Wissenstest' });
    }
    
    // Wissenstest abrufen
    const [knowledgeTests] = await pool.query(
      'SELECT id FROM knowledge_tests WHERE profession_id = ?',
      [id]
    );
    
    if (knowledgeTests.length === 0) {
      return res.json([]); // Leerer Wissenstest
    }
    
    const testId = knowledgeTests[0].id;
    
    // Fragen abrufen
    const [questions] = await pool.query(
      'SELECT id, question, explanation, sort_order FROM test_questions WHERE test_id = ? ORDER BY sort_order',
      [testId]
    );
    
    // Für jede Frage die Antworten abrufen
    const questionsWithAnswers = await Promise.all(questions.map(async (question) => {
      const [answers] = await pool.query(
        'SELECT id, text, is_correct, sort_order FROM answer_options WHERE question_id = ? ORDER BY sort_order',
        [question.id]
      );
      
      return {
        id: question.id,
        text: question.question,
        explanation: question.explanation,
        options: answers.map(answer => ({
          id: answer.id,
          text: answer.text,
          isCorrect: answer.is_correct === 1
        }))
      };
    }));
    
    res.json(questionsWithAnswers);
  } catch (err) {
    handleError(res, err, 'Fehler beim Abrufen des Wissenstests');
  }
});

// Wissenstest für einen Beruf speichern
app.post('/api/professions/:id/quiz', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { questions } = req.body;
    
    if (!Array.isArray(questions)) {
      return res.status(400).json({ error: 'Ungültiges Format für Fragen' });
    }
    
    // Prüfen, ob der Beruf existiert und einen Wissenstest hat
    const [professions] = await pool.query(
      'SELECT id, has_knowledge_test FROM professions WHERE id = ?',
      [id]
    );
    
    if (professions.length === 0) {
      return res.status(404).json({ error: 'Beruf nicht gefunden' });
    }
    
    if (!professions[0].has_knowledge_test) {
      return res.status(400).json({ error: 'Dieser Beruf hat keinen Wissenstest aktiviert' });
    }
    
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    // Prüfen, ob bereits ein Wissenstest existiert
    const [existingTests] = await connection.query(
      'SELECT id FROM knowledge_tests WHERE profession_id = ?',
      [id]
    );
    
    let testId;
    
    if (existingTests.length === 0) {
      // Neuen Wissenstest erstellen
      const [result] = await connection.query(
        'INSERT INTO knowledge_tests (profession_id, title, status) VALUES (?, ?, ?)',
        [id, `Wissenstest: ${id}`, 'published']
      );
      testId = result.insertId;
    } else {
      testId = existingTests[0].id;
      
      // Alte Fragen und Antworten löschen
      const [oldQuestions] = await connection.query(
        'SELECT id FROM test_questions WHERE test_id = ?',
        [testId]
      );
      
      for (const question of oldQuestions) {
        await connection.query(
          'DELETE FROM answer_options WHERE question_id = ?',
          [question.id]
        );
      }
      
      await connection.query(
        'DELETE FROM test_questions WHERE test_id = ?',
        [testId]
      );
    }
    
    // Neue Fragen und Antworten speichern
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      
      // Frage speichern
      const [questionResult] = await connection.query(
        'INSERT INTO test_questions (test_id, question, explanation, sort_order) VALUES (?, ?, ?, ?)',
        [testId, question.text, question.explanation || '', i]
      );
      
      const questionId = questionResult.insertId;
      
      // Antworten speichern
      for (let j = 0; j < question.options.length; j++) {
        const option = question.options[j];
        await connection.query(
          'INSERT INTO answer_options (question_id, text, is_correct, sort_order) VALUES (?, ?, ?, ?)',
          [questionId, option.text, option.isCorrect ? 1 : 0, j]
        );
      }
    }
    
    await connection.commit();
    
    res.status(201).json({ message: 'Wissenstest erfolgreich gespeichert' });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    handleError(res, err, 'Fehler beim Speichern des Wissenstests');
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Öffentliche API-Route für Testzugriff
app.get('/api/quiz/:professionId', async (req, res) => {
  try {
    const { professionId } = req.params;
    
    // Prüfen, ob der Beruf existiert und einen Wissenstest hat
    const [professions] = await pool.query(
      'SELECT id, has_knowledge_test, title FROM professions WHERE id = ?',
      [professionId]
    );
    
    if (professions.length === 0) {
      return res.status(404).json({ error: 'Beruf nicht gefunden' });
    }
    
    if (!professions[0].has_knowledge_test) {
      return res.status(404).json({ error: 'Dieser Beruf hat keinen Wissenstest' });
    }
    
    // Wissenstest abrufen
    const [knowledgeTests] = await pool.query(
      'SELECT id, title FROM knowledge_tests WHERE profession_id = ? AND status = "published"',
      [professionId]
    );
    
    if (knowledgeTests.length === 0) {
      return res.status(404).json({ error: 'Kein veröffentlichter Wissenstest gefunden' });
    }
    
    const testId = knowledgeTests[0].id;
    
    // Fragen abrufen
    const [questions] = await pool.query(
      'SELECT id, question, explanation, sort_order FROM test_questions WHERE test_id = ? ORDER BY sort_order',
      [testId]
    );
    
    // Für jede Frage die Antworten abrufen (ohne is_correct-Angabe, damit die richtige Antwort nicht im Frontend angezeigt wird)
    const questionsWithAnswers = await Promise.all(questions.map(async (question) => {
      const [answers] = await pool.query(
        'SELECT id, text, sort_order FROM answer_options WHERE question_id = ? ORDER BY sort_order',
        [question.id]
      );
      
      // Auch die richtige Antwort abrufen (für die Auswertung)
      const [correctAnswer] = await pool.query(
        'SELECT id FROM answer_options WHERE question_id = ? AND is_correct = 1',
        [question.id]
      );
      
      const correctAnswerId = correctAnswer.length > 0 ? correctAnswer[0].id : null;
      
      return {
        id: question.id,
        text: question.question,
        explanation: question.explanation,
        options: answers.map(answer => ({
          id: answer.id,
          text: answer.text
        })),
        correctAnswerId: correctAnswerId
      };
    }));
    
    res.json({
      professionId: professionId,
      title: `Wissenstest: ${professions[0].title}`,
      questions: questionsWithAnswers
    });
  } catch (err) {
    handleError(res, err, 'Fehler beim Abrufen des Wissenstests');
  }
});
