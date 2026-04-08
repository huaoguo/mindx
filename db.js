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
  console.log('Database initialized');
}

function generateKey() {
  return 'mx_' + crypto.randomBytes(24).toString('hex');
}

module.exports = { pool, hasDB, initDB, generateKey };
