const express = require('express');
const path = require('path');
const { execSync } = require('child_process');
const multer = require('multer');
const { pool, hasDB, initDB, generateKey } = require('./db');
const insightsRouter = require('./routes/insights');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Build skill zip on every server start (ensures zip is always up-to-date)
try {
  execSync('node scripts/build-skill.js', { cwd: __dirname, stdio: 'inherit' });
} catch (e) {
  console.warn('Warning: failed to build skill zip:', e.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/openapi.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'openapi.json'));
});

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from MindX backend!', time: new Date().toISOString() });
});

// Skill install endpoint — sets agent status to installing, then redirects to zip
app.get('/api/agents/:id/install', async (req, res) => {
  if (!hasDB) return res.status(503).json({ error: 'database not configured' });
  const key = req.query.key;
  if (!key) return res.status(400).json({ error: 'missing key query parameter' });

  const { rows } = await pool.query('SELECT id FROM agents WHERE id = $1 AND key = $2', [req.params.id, key]);
  if (rows.length === 0) return res.status(401).json({ error: 'invalid agent id or key' });

  await pool.query('UPDATE agents SET status = $1 WHERE id = $2', ['installing', req.params.id]);
  res.redirect('/mindx-docs.zip');
});

// --- Routes that require database ---

const dbRouter = express.Router();

dbRouter.use((req, res, next) => {
  if (!hasDB) return res.status(503).json({ error: 'database not configured' });
  next();
});

// Auth middleware — resolves Bearer token to user + actor
async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing Authorization: Bearer <key>' });
  }
  const key = header.slice(7);

  // Try user key first
  const userResult = await pool.query('SELECT id, name FROM users WHERE key = $1', [key]);
  if (userResult.rows.length > 0) {
    const u = userResult.rows[0];
    req.user = { id: u.id, name: u.name };
    req.actor = { type: 'user', name: u.name };
    return next();
  }

  // Try agent key
  const agentResult = await pool.query(
    `SELECT a.id AS agent_id, a.name AS agent_name, a.user_id,
            u.name AS user_name
     FROM agents a JOIN users u ON a.user_id = u.id
     WHERE a.key = $1`,
    [key]
  );
  if (agentResult.rows.length > 0) {
    const a = agentResult.rows[0];
    req.user = { id: a.user_id, name: a.user_name };
    req.actor = { type: 'agent', name: a.agent_name, agentId: a.agent_id };
    return next();
  }

  return res.status(401).json({ error: 'invalid API key' });
}

// --- Login ---

dbRouter.post('/login', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  const trimmed = name.trim();

  const existing = await pool.query('SELECT id, key, name FROM users WHERE name = $1', [trimmed]);
  if (existing.rows.length > 0) {
    return res.json(existing.rows[0]);
  }

  const key = generateKey();
  const { rows } = await pool.query(
    'INSERT INTO users (key, name) VALUES ($1, $2) RETURNING id, key, name',
    [key, trimmed]
  );
  res.status(201).json(rows[0]);
});

// --- Agent management (requires user auth, not agent) ---

dbRouter.get('/agents', auth, async (req, res) => {
  if (req.actor.type !== 'user') {
    return res.status(403).json({ error: 'only users can manage agents' });
  }
  const { rows } = await pool.query(
    'SELECT id, name, key, status, created_at FROM agents WHERE user_id = $1 ORDER BY created_at',
    [req.user.id]
  );
  res.json(rows);
});

dbRouter.post('/agents', auth, async (req, res) => {
  if (req.actor.type !== 'user') {
    return res.status(403).json({ error: 'only users can manage agents' });
  }
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  const key = generateKey();
  const { rows } = await pool.query(
    'INSERT INTO agents (user_id, name, key) VALUES ($1, $2, $3) RETURNING id, name, key, created_at',
    [req.user.id, name.trim(), key]
  );
  res.status(201).json(rows[0]);
});

dbRouter.delete('/agents/:id', auth, async (req, res) => {
  if (req.actor.type !== 'user') {
    return res.status(403).json({ error: 'only users can manage agents' });
  }
  const { rowCount } = await pool.query(
    'DELETE FROM agents WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  if (rowCount === 0) return res.status(404).json({ error: 'agent not found' });
  res.json({ deleted: true });
});

// Agent self-info (for agents to discover their own id)
dbRouter.get('/agents/me', auth, async (req, res) => {
  if (req.actor.type !== 'agent') {
    return res.status(403).json({ error: 'only agents can call this' });
  }
  const { rows } = await pool.query(
    'SELECT id, name, status, created_at FROM agents WHERE id = $1',
    [req.actor.agentId]
  );
  res.json(rows[0]);
});

// Agent status update (agent updates its own status)
const VALID_STATUSES = ['idle', 'installing', 'connected'];

dbRouter.put('/agents/:id/status', auth, async (req, res) => {
  if (req.actor.type !== 'agent') {
    return res.status(403).json({ error: 'only agents can update status' });
  }
  if (req.actor.agentId !== parseInt(req.params.id)) {
    return res.status(403).json({ error: 'agents can only update their own status' });
  }
  const { status } = req.body;
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  const { rows } = await pool.query(
    'UPDATE agents SET status = $1 WHERE id = $2 RETURNING id, name, status',
    [status, req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'agent not found' });
  res.json(rows[0]);
});

// --- Notes CRUD ---

dbRouter.get('/notes', auth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, title, content, created_by, updated_by, created_at, updated_at FROM notes WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json(rows);
});

dbRouter.post('/notes', auth, async (req, res) => {
  const { title, content } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const { rows } = await pool.query(
    'INSERT INTO notes (user_id, title, content, created_by) VALUES ($1, $2, $3, $4) RETURNING id, title, content, created_by, updated_by, created_at, updated_at',
    [req.user.id, title, content || '', req.actor.name]
  );
  res.status(201).json(rows[0]);
});

dbRouter.get('/notes/:id', auth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, title, content, created_by, updated_by, created_at, updated_at FROM notes WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'note not found' });
  res.json(rows[0]);
});

dbRouter.put('/notes/:id', auth, async (req, res) => {
  const { title, content } = req.body;
  const { rows } = await pool.query(
    'UPDATE notes SET title = COALESCE($1, title), content = COALESCE($2, content), updated_by = $3, updated_at = NOW() WHERE id = $4 AND user_id = $5 RETURNING id, title, content, created_by, updated_by, created_at, updated_at',
    [title, content, req.actor.name, req.params.id, req.user.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'note not found' });
  res.json(rows[0]);
});

dbRouter.delete('/notes/:id', auth, async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM notes WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  if (rowCount === 0) return res.status(404).json({ error: 'note not found' });
  res.json({ deleted: true });
});

// --- Documents (markdown files, uploaded by agents) ---

const VALID_DOC_TYPES = ['user', 'soul', 'memory', 'log', 'chat'];

dbRouter.get('/documents', auth, async (req, res) => {
  const { type, agent_id } = req.query;
  let sql = 'SELECT d.id, d.type, d.filename, d.content, d.file_created_at, d.uploaded_at, a.name AS agent_name FROM documents d JOIN agents a ON d.agent_id = a.id WHERE d.user_id = $1';
  const params = [req.user.id];
  if (type) {
    params.push(type);
    sql += ` AND d.type = $${params.length}`;
  }
  if (agent_id) {
    params.push(agent_id);
    sql += ` AND d.agent_id = $${params.length}`;
  }
  sql += ' ORDER BY d.uploaded_at DESC';
  const { rows } = await pool.query(sql, params);
  res.json(rows);
});

dbRouter.get('/documents/:id', auth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT d.id, d.type, d.filename, d.content, d.file_created_at, d.uploaded_at, a.name AS agent_name FROM documents d JOIN agents a ON d.agent_id = a.id WHERE d.id = $1 AND d.user_id = $2',
    [req.params.id, req.user.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'document not found' });
  res.json(rows[0]);
});

dbRouter.post('/documents', auth, async (req, res) => {
  if (req.actor.type !== 'agent') {
    return res.status(403).json({ error: 'only agents can upload documents' });
  }
  const { type, filename, content, file_created_at } = req.body;
  if (!type || !VALID_DOC_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${VALID_DOC_TYPES.join(', ')}` });
  }
  if (!filename) return res.status(400).json({ error: 'filename is required' });
  if (!content) return res.status(400).json({ error: 'content is required' });
  if (!file_created_at) return res.status(400).json({ error: 'file_created_at is required' });

  const { rows } = await pool.query(
    'INSERT INTO documents (user_id, agent_id, type, filename, content, file_created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, type, filename, content, file_created_at, uploaded_at',
    [req.user.id, req.actor.agentId, type, filename, content, file_created_at]
  );
  const row = rows[0];
  row.agent_name = req.actor.name;
  res.status(201).json(row);
});

// Upload document via file (multipart/form-data)
dbRouter.post('/documents/upload', auth, upload.single('file'), async (req, res) => {
  if (req.actor.type !== 'agent') {
    return res.status(403).json({ error: 'only agents can upload documents' });
  }
  const { type, file_created_at } = req.body;
  if (!type || !VALID_DOC_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${VALID_DOC_TYPES.join(', ')}` });
  }
  if (!req.file) return res.status(400).json({ error: 'file is required' });
  if (!file_created_at) return res.status(400).json({ error: 'file_created_at is required' });

  const filename = req.body.filename || req.file.originalname;
  const content = req.file.buffer.toString('utf-8');

  const { rows } = await pool.query(
    'INSERT INTO documents (user_id, agent_id, type, filename, content, file_created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, type, filename, content, file_created_at, uploaded_at',
    [req.user.id, req.actor.agentId, type, filename, content, file_created_at]
  );
  const row = rows[0];
  row.agent_name = req.actor.name;
  res.status(201).json(row);
});

dbRouter.delete('/documents/:id', auth, async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM documents WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  if (rowCount === 0) return res.status(404).json({ error: 'document not found' });
  res.json({ deleted: true });
});

// --- Insights (extraction + CRUD) ---
dbRouter.use(auth, insightsRouter);

app.use('/api', dbRouter);

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
