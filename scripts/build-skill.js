const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const skillDir = path.join(root, 'skill');
const outFile = path.join(root, 'public', 'mindx-docs.zip');

// Remove old zip if exists
if (fs.existsSync(outFile)) fs.unlinkSync(outFile);

// Ensure public/ directory exists
const publicDir = path.dirname(outFile);
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

// Use system zip command (available on macOS/Linux and Render)
execSync(`cd "${skillDir}" && zip -r "${outFile}" .`, { stdio: 'inherit' });

console.log(`Skill packed → ${path.relative(root, outFile)}`);
