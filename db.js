const { Pool } = require('pg');
const crypto = require('crypto');

const hasDB = !!process.env.DATABASE_URL;

const pool = hasDB
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('render.com')
        ? { rejectUnauthorized: false }
        : false,
    })
  : null;

async function initDB() {
  if (!hasDB) {
    console.log('No DATABASE_URL set — skipping database initialization');
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      key VARCHAR(64) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agents (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      key VARCHAR(64) UNIQUE NOT NULL,
      status VARCHAR(20) DEFAULT 'idle',
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, name)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      content TEXT DEFAULT '',
      created_by VARCHAR(255) NOT NULL,
      updated_by VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      type VARCHAR(20) NOT NULL CHECK (type IN ('user', 'soul', 'memory', 'log', 'chat')),
      filename VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      file_created_at TIMESTAMP NOT NULL,
      uploaded_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS insights (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      value_summary TEXT NOT NULL,
      category VARCHAR(20) NOT NULL CHECK (category IN (
        'preference','fact','constraint','decision','goal','insight','relationship','event'
      )),
      confidence INTEGER NOT NULL CHECK (confidence BETWEEN 0 AND 100),
      status VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK (status IN (
        'confirmed','pending','deprecated'
      )),
      source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('document','note')),
      source_id INTEGER NOT NULL,
      source_quote VARCHAR(200),
      source_position VARCHAR(100),
      source_name VARCHAR(255),
      source_timestamp TIMESTAMP,
      superseded_by INTEGER REFERENCES insights(id),
      change_reason TEXT,
      pinned BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Migrations — add columns that may not exist on older databases
  await pool.query(`ALTER TABLE insights ADD COLUMN IF NOT EXISTS source_name VARCHAR(255)`).catch(() => {});

  // Backfill source_name for existing insights
  await pool.query(`
    UPDATE insights SET source_name = d.filename
    FROM documents d
    WHERE insights.source_type = 'document' AND insights.source_id = d.id AND insights.source_name IS NULL
  `).catch(() => {});
  await pool.query(`
    UPDATE insights SET source_name = n.title
    FROM notes n
    WHERE insights.source_type = 'note' AND insights.source_id = n.id AND insights.source_name IS NULL
  `).catch(() => {});

  console.log('Database initialized');
}

function generateKey() {
  return 'mx_' + crypto.randomBytes(24).toString('hex');
}

module.exports = { pool, hasDB, initDB, generateKey };
