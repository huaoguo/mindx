const express = require('express');
const path = require('path');
const { pool, initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON request bodies
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from MindX backend!', time: new Date().toISOString() });
});

// --- Notes CRUD ---

// List all notes
app.get('/api/notes', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM notes ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a note
app.post('/api/notes', async (req, res) => {
  const { title, content } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING *',
      [title, content || '']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a note
app.put('/api/notes/:id', async (req, res) => {
  const { title, content } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE notes SET title = COALESCE($1, title), content = COALESCE($2, content) WHERE id = $3 RETURNING *',
      [title, content, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'note not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a note
app.delete('/api/notes/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM notes WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'note not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server & init database
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err.message);
    process.exit(1);
  });
