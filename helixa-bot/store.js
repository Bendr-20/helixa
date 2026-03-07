const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadJSON(filename, defaultVal = {}) {
  ensureDataDir();
  const fp = path.join(DATA_DIR, filename);
  try {
    if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) { console.error(`Failed to load ${filename}:`, e.message); }
  return defaultVal;
}

function saveJSON(filename, data) {
  ensureDataDir();
  const fp = path.join(DATA_DIR, filename);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
}

// Subscribers (alerts)
function getSubscribers() { return loadJSON('subscribers.json', []); }
function saveSubscribers(subs) { saveJSON('subscribers.json', subs); }

// Gates
function getGates() { return loadJSON('gates.json', {}); }
function saveGates(gates) { saveJSON('gates.json', gates); }

// Verified
function getVerified() { return loadJSON('verified.json', {}); }
function saveVerified(v) { saveJSON('verified.json', v); }

// Jobs
function getJobs() { return loadJSON('jobs.json', []); }
function saveJobs(jobs) { saveJSON('jobs.json', jobs); }

module.exports = { getSubscribers, saveSubscribers, getGates, saveGates, getVerified, saveVerified, getJobs, saveJobs };
