const express = require('express');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Für statische Dateien

// MariaDB Connection Pool erstellen
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'deinpasswort',
  database: 'vw_ausbildung',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Upload-Konfiguration
const uploadDir = path.join(__dirname, 'public', 'uploads');
// Stelle sicher, dass das Upload-Verzeichnis existiert
(async () => {
  try {
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.mkdir(path.join(uploadDir, 'qr_codes'), { recursive: true });
    await fs.mkdir(path.join(uploadDir, 'gallery'), { recursive: true });
  } catch (err) {
    console.error('Fehler beim Erstellen der Upload-Verzeichnisse:', err);
  }
})();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const type = req.params.type || 'gallery';
    const dest = path.join(uploadDir, type === 'qr' ? 'qr_codes' : 'gallery');
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${req.params.professionId}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ storage: storage });

// API-Routen

// Alle Kategorien abrufen
app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error('Fehler beim Abrufen der Kategorien:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// Kategorie erstellen
app.post('/api/categories', async (req, res) => {
  const { id, name } = req.body;
  
  if (!id || !name) {
    return res.status(400).json({ error: 'ID und Name sind erforderlich' });
  }
  
  try {
    await pool.query('INSERT INTO categories (id, name) VALUES (?, ?)', [id, name]);
    res.status(201).json({ id, name });
  } catch (err) {
    console.error('Fehler beim Erstellen der Kategorie:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// Kategorie aktualisieren
app.put('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name ist erforderlich' });
  }
  
  try {
    const [result] = await pool.query('UPDATE categories SET name = ? WHERE id = ?', [name, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Kategorie nicht gefunden' });
    }
    
    res.json({ id, name });
  } catch (err) {
    console.error('Fehler beim Aktualisieren der Kategorie:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// Kategorie löschen
app.delete('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
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
    console.error('Fehler beim Löschen der Kategorie:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// Alle Berufe mit Details abrufen
app.get('/api/professions', async (req, res) => {
  try {
    // Hauptdaten der Berufe abrufen
    const [professions] = await pool.query(`
      SELECT p.*, c.name as category_name
      FROM professions p
      JOIN categories c ON p.category_id = c.id
      ORDER BY p.title
    `);
    
    // Für jeden Beruf die Details abrufen
    const result = await Promise.all(professions.map(async (profession) => {
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
          url: `/uploads/gallery/${img.filename}`,
          alt_text: img.alt_text || profession.title
        })),
        qr_code: qrCodes.length > 0 ? `/uploads/qr_codes/${qrCodes[0].filename}` : null
      };
    }));
    
    res.json(result);
  } catch (err) {
    console.error('Fehler beim Abrufen der Berufe:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// Einzelnen Beruf abrufen
app.get('/api/professions/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Hauptdaten des Berufs abrufen
    const [professions] = await pool.query(`
      SELECT p.*, c.name as category_name
      FROM professions p
      JOIN categories c ON p.category_id = c.id
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
        url: `/uploads/gallery/${img.filename}`,
        alt_text: img.alt_text || profession.title
      })),
      qr_code: qrCodes.length > 0 ? `/uploads/qr_codes/${qrCodes[0].filename}` : null
    };
    
    res.json(result);
  } catch (err) {
    console.error('Fehler beim Abrufen des Berufs:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// Beruf erstellen/aktualisieren (mit Transaktion)
app.post('/api/professions', async (req, res) => {
  const {
    id,
    title,
    description,
    duration,
    category_id,
    has_knowledge_test,
    requirements,
    career_options,
    locations
  } = req.body;
  
  if (!id || !title || !description || !duration || !category_id) {
    return res.status(400).json({ error: 'Unvollständige Daten' });
  }
  
  let connection;
  try {
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
    } else {
      // Insert
      await connection.query(
        'INSERT INTO professions (id, title, description, duration, category_id, has_knowledge_test) VALUES (?, ?, ?, ?, ?, ?)',
        [id, title, description, duration, category_id, has_knowledge_test || false]
      );
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
    if (connection) await connection.rollback();
    console.error('Fehler beim Speichern des Berufs:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  } finally {
    if (connection) connection.release();
  }
});

// Beruf löschen (mit Transaktion)
app.delete('/api/professions/:id', async (req, res) => {
  const { id } = req.params;
  
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    // Bilder und QR-Codes finden, um sie später von der Festplatte zu löschen
    const [images] = await connection.query('SELECT filename FROM gallery_images WHERE profession_id = ?', [id]);
    const [qrCodes] = await connection.query('SELECT filename FROM qr_codes WHERE profession_id = ?', [id]);
    
    // Verknüpfte Daten löschen (durch Foreign Keys mit CASCADE werden diese automatisch gelöscht)
    await connection.query('DELETE FROM professions WHERE id = ?', [id]);
    
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
    
    res.json({ message: 'Beruf erfolgreich gelöscht' });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('Fehler beim Löschen des Berufs:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  } finally {
    if (connection) connection.release();
  }
});

// Bild hochladen
app.post('/api/professions/:professionId/images/:type?', upload.single('file'), async (req, res) => {
  const { professionId, type } = req.params;
  const file = req.file;
  const altText = req.body.alt_text || '';
  
  if (!file) {
    return res.status(400).json({ error: 'Keine Datei hochgeladen' });
  }
  
  try {
    if (type === 'qr') {
      // QR-Code hochladen (ersetze vorhandenen)
      await pool.query('DELETE FROM qr_codes WHERE profession_id = ?', [professionId]);
      await pool.query(
        'INSERT INTO qr_codes (profession_id, filename) VALUES (?, ?)',
        [professionId, file.filename]
      );
    } else {
      // Galeriebild hochladen
      const [result] = await pool.query(
        'INSERT INTO gallery_images (profession_id, filename, alt_text, sort_order) VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order) + 1, 0) FROM gallery_images g WHERE g.profession_id = ?))',
        [professionId, file.filename, altText, professionId]
      );
      
      const imageId = result.insertId;
      res.status(201).json({
        id: imageId,
        url: `/uploads/${type === 'qr' ? 'qr_codes' : 'gallery'}/${file.filename}`,
        alt_text: altText
      });
      return;
    }
    
    res.status(201).json({
      url: `/uploads/${type === 'qr' ? 'qr_codes' : 'gallery'}/${file.filename}`
    });
  } catch (err) {
    console.error('Fehler beim Hochladen des Bildes:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// Bild löschen
app.delete('/api/gallery-images/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Bilddatei finden
    const [images] = await pool.query('SELECT filename FROM gallery_images WHERE id = ?', [id]);
    
    if (images.length === 0) {
      return res.status(404).json({ error: 'Bild nicht gefunden' });
    }
    
    const filename = images[0].filename;
    
    // Aus der Datenbank löschen
    await pool.query('DELETE FROM gallery_images WHERE id = ?', [id]);
    
    // Von der Festplatte löschen
    try {
      await fs.unlink(path.join(uploadDir, 'gallery', filename));
    } catch (e) {
      console.warn(`Konnte Bild nicht löschen: ${filename}`, e);
    }
    
    res.json({ message: 'Bild erfolgreich gelöscht' });
  } catch (err) {
    console.error('Fehler beim Löschen des Bildes:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// Server starten
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});