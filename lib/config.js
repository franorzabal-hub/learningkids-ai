import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

async function loadPackageJson() {
  const packagePath = path.join(ROOT_DIR, 'package.json');
  const raw = await fs.readFile(packagePath, 'utf-8');
  return JSON.parse(raw);
}

let packageJson = {};
try {
  packageJson = await loadPackageJson();
} catch (error) {
  console.warn('[LearnKids] Failed to load package.json for version info:', error);
}

export const APP_VERSION = process.env.APP_VERSION || packageJson.version || '0.0.0';
export const APP_NAME = process.env.APP_NAME || packageJson.name || 'learningkids-ai';
