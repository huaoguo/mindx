/**
 * Insights API Routes
 *
 * POST   /insights/extract   — trigger extraction from a document or note
 * GET    /insights            — list user's insights (with filters)
 * GET    /insights/:id        — get single insight
 * PUT    /insights/:id        — update (pinned, status)
 * DELETE /insights/:id        — delete insight
 */

const express = require('express');
const { pool } = require('../db');
const { extractInsights } = require('../lib/extraction');

const router = express.Router();

// --- Extract insights from a source ---

router.post('/insights/extract', async (req, res) => {
  const { source_type, source_id } = req.body;
  if (!source_type || !source_id) {
    return res.status(400).json({ error: 'source_type and source_id are required' });
  }
  if (!['document', 'note'].includes(source_type)) {
    return res.status(400).json({ error: 'source_type must be "document" or "note"' });
  }

  try {
    const result = await extractInsights(req.user.id, source_type, parseInt(source_id));
    res.json(result);
  } catch (err) {
    console.error('Extraction error:', err);
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('LLM_API_KEY')) {
      return res.status(503).json({ error: 'LLM service not configured' });
    }
    res.status(500).json({ error: 'Extraction failed: ' + err.message });
  }
});

// --- List insights ---

router.get('/insights', async (req, res) => {
  const { status, category, pinned, source_type, source_id } = req.query;

  let sql = `SELECT id, content, value_summary, category, confidence, status,
             source_type, source_id, source_name, source_quote, source_position, source_timestamp,
             superseded_by, change_reason, pinned, created_at, updated_at
             FROM insights WHERE user_id = $1`;
  const params = [req.user.id];

  if (status) {
    params.push(status);
    sql += ` AND status = $${params.length}`;
  }
  if (category) {
    params.push(category);
    sql += ` AND category = $${params.length}`;
  }
  if (pinned === 'true') {
    sql += ' AND pinned = TRUE';
  }
  if (source_type) {
    params.push(source_type);
    sql += ` AND source_type = $${params.length}`;
  }
  if (source_id) {
    params.push(parseInt(source_id));
    sql += ` AND source_id = $${params.length}`;
  }

  // Default: don't show deprecated unless explicitly requested
  if (!status) {
    sql += ` AND status != 'deprecated'`;
  }

  sql += ' ORDER BY pinned DESC, confidence DESC, created_at DESC';

  const { rows } = await pool.query(sql, params);
  res.json(rows);
});

// --- Get single insight ---

router.get('/insights/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, content, value_summary, category, confidence, status,
     source_type, source_id, source_name, source_quote, source_position, source_timestamp,
     superseded_by, change_reason, pinned, created_at, updated_at
     FROM insights WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'insight not found' });
  res.json(rows[0]);
});

// --- Update insight (pin / confirm) ---

router.put('/insights/:id', async (req, res) => {
  const { pinned, status } = req.body;

  const updates = [];
  const params = [];
  let idx = 1;

  if (pinned !== undefined) {
    params.push(pinned);
    updates.push(`pinned = $${idx++}`);
  }
  if (status) {
    if (!['confirmed', 'pending', 'deprecated'].includes(status)) {
      return res.status(400).json({ error: 'invalid status' });
    }
    params.push(status);
    updates.push(`status = $${idx++}`);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'nothing to update' });
  }

  updates.push(`updated_at = NOW()`);

  params.push(req.params.id, req.user.id);
  const sql = `UPDATE insights SET ${updates.join(', ')} WHERE id = $${idx++} AND user_id = $${idx}
               RETURNING id, content, value_summary, category, confidence, status, pinned, updated_at`;

  const { rows } = await pool.query(sql, params);
  if (rows.length === 0) return res.status(404).json({ error: 'insight not found' });
  res.json(rows[0]);
});

// --- Delete insight ---

router.delete('/insights/:id', async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM insights WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  if (rowCount === 0) return res.status(404).json({ error: 'insight not found' });
  res.json({ deleted: true });
});

module.exports = router;
