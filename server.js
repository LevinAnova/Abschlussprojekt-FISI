const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');
const formidable = require('formidable');

// Express App initialisieren
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: '*', // In Produktion sollte dies eingeschränkt werden
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
  password: 'fisi', // Ändere dies entsprechend deinem Setup
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
const uploadDir = '/var/www/uploads';
const galleryDir = path.join(uploadDir, 'gallery');
const qrCodesDir = path.join(uploadDir, 'qr_codes');

// Stelle sicher, dass die Upload-Verzeichnisse existieren
(async () => {
  try {
    await fs.mkdir(galleryDir, { recursive: true });
    await fs.mkdir(qrCodesDir, { recursive: true });
    console.log('✅ Upload-Verzeichnisse erfolgreich erstellt');
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

// ===== API-Routen =====

// Root-Endpoint für API-Tests
app.get('/api', (req, res) => {
  res.json({ 
    message: 'VW Ausbildungsberufe API funktioniert!',
    version: '1.0.0',
    endpoints: ['/api/categories', '/api/professions']
  });
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
    
    // Beruf löschen (durch Foreign Keys mit CASCADE werden verknüpfte Daten automatisch gelöscht)
    const [result] = await connection.query('DELETE FROM professions WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Beruf nicht gefunden' });
    }
    
    await connection.commit();
    
    // Dateien von der Festplatte löschen
    for (const img of images) {
      try {
        await fs.unlink(path.join(uploadDir, 'gallery', img.filename));
      } catch (e) {
        console.warn(`Konnte Bild nicht löschen: ${img.filename}`, e);
      }
    }
    
    for (const qr of qrCodes) {
      try {
        await fs.unlink(path.join(uploadDir, 'qr_codes', qr.filename));
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

// Bild hochladen
app.post('/api/professions/:professionId/images/:type?', async (req, res) => {
  try {
    const { professionId, type } = req.params;
    const isQrCode = type === 'qr';
    
    // Prüfen, ob der Beruf existiert
    const [professionExists] = await pool.query('SELECT id FROM professions WHERE id = ?', [professionId]);
    if (professionExists.length === 0) {
      return res.status(404).json({ error: `Beruf mit ID ${professionId} existiert nicht` });
    }
    
// Zielverzeichnis erstellen
let targetDir = isQrCode ? path.join(qrCodesDir, professionId) : path.join(galleryDir, professionId);
try {
  await fs.mkdir(targetDir, { recursive: true });
} catch (mkdirErr) {
  console.error(`Fehler beim Erstellen des Verzeichnisses ${targetDir}:`, mkdirErr);
  // Fallback auf Hauptverzeichnis
  targetDir = isQrCode ? qrCodesDir : galleryDir;
}
    
    // Formidable für Datei-Upload konfigurieren
    const form = new formidable.IncomingForm({
      uploadDir: targetDir,
      keepExtensions: true,
      maxFileSize: 5 * 1024 * 1024 // 5MB
    });
    
    // Verarbeite den Upload
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('Formidable-Fehler:', err);
        return handleError(res, err, 'Fehler beim Hochladen der Datei', 500);
      }
      
      if (!files.file) {
        return res.status(400).json({ error: 'Keine Datei hochgeladen' });
      }
      
      try {
        const file = files.file;
        const filename = path.basename(file.path);
        const altText = fields.alt_text || '';
        
        if (isQrCode) {
          // QR-Code hochladen (ersetze vorhandenen)
          
          // Alten QR-Code finden und löschen
          const [oldQrCodes] = await pool.query('SELECT filename FROM qr_codes WHERE profession_id = ?', [professionId]);
          for (const qr of oldQrCodes) {
            try {
              await fs.unlink(path.join(qrCodesDir, qr.filename));
            } catch (e) {
              console.warn(`Konnte alten QR-Code nicht löschen: ${qr.filename}`, e);
            }
          }
          
          // Aus der Datenbank löschen
          await pool.query('DELETE FROM qr_codes WHERE profession_id = ?', [professionId]);
          
          // Neuen QR-Code einfügen
          await pool.query(
            'INSERT INTO qr_codes (profession_id, filename) VALUES (?, ?)',
            [professionId, filename]
          );
          
          if (DEBUG) {
            console.log(`QR-Code hochgeladen für Beruf ${professionId}: ${filename}`);
          }
          
          return res.status(201).json({
            url: `/uploads/qr_codes/${professionId}/${filename}`
          });
        } else {
          // Galeriebild hochladen
          const [result] = await pool.query(
            'INSERT INTO gallery_images (profession_id, filename, alt_text, sort_order) VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order) + 1, 0) FROM gallery_images g WHERE g.profession_id = ?))',
            [professionId, filename, altText, professionId]
          );
          
          const imageId = result.insertId;
          
          if (DEBUG) {
            console.log(`Bild hochgeladen für Beruf ${professionId}: ${filename}`);
          }
          
          res.status(201).json({
            id: imageId,
            url: `/uploads/gallery/${professionId}/${filename}`,
            alt_text: altText
          });
        }
      } catch (dbErr) {
        console.error('Datenbank-Fehler:', dbErr);
        handleError(res, dbErr, 'Fehler beim Speichern der Datei in der Datenbank', 500);
      }
    });
  } catch (err) {
    handleError(res, err, 'Fehler beim Hochladen des Bildes', 500);
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
      await fs.unlink(path.join(galleryDir, profession_id, filename));
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