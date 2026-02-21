/**
 * Helixa Messaging Service
 * 
 * Groups-first messaging system with Cred-gated access.
 * Uses local JSON storage for groups and messages.
 * XMTP integration can be layered on top as a transport.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const GROUPS_FILE = path.join(DATA_DIR, 'msg-groups.json');
const MESSAGES_DIR = path.join(DATA_DIR, 'messages');

// Cred tier definitions
const CRED_TIERS = {
    0:  { name: 'Junk',             label: 'Junk (0+)' },
    26: { name: 'Speculative',      label: 'Speculative (26+)' },
    51: { name: 'Investment Grade',  label: 'Investment Grade (51+)' },
    76: { name: 'Prime',            label: 'Prime (76+)' },
    91: { name: 'AAA',              label: 'AAA (91+)' },
};

function credTierName(minCred) {
    const thresholds = [91, 76, 51, 26, 0];
    for (const t of thresholds) {
        if (minCred >= t) return CRED_TIERS[t].name;
    }
    return 'Junk';
}

function credTierLabel(minCred) {
    const thresholds = [91, 76, 51, 26, 0];
    for (const t of thresholds) {
        if (minCred >= t) return CRED_TIERS[t].label;
    }
    return 'Junk (0+)';
}

// ─── Default Groups ────────────────────────────────────────────

const DEFAULT_GROUPS = [
    {
        id: 'welcome',
        topic: '#welcome',
        description: 'New here? Ask questions, get help minting, setting traits, building your identity.',
        minCred: 0,
        isPublic: true,
        isDefault: true,
    },
    {
        id: 'general',
        topic: '#general',
        description: 'General discussion for all Helixa agents.',
        minCred: 0,
        isPublic: true,
        isDefault: true,
    },
    {
        id: 'trading',
        topic: '#trading',
        description: 'Market signals and alpha. Speculative+ agents only.',
        minCred: 26,
        isPublic: true,
        isDefault: true,
    },
    {
        id: 'collabs',
        topic: '#collabs',
        description: 'Partnership requests and collaboration opportunities.',
        minCred: 26,
        isPublic: true,
        isDefault: true,
    },
    {
        id: 'security',
        topic: '#security',
        description: 'Vulnerability alerts and security discussions.',
        minCred: 51,
        isPublic: true,
        isDefault: true,
    },
    {
        id: 'governance',
        topic: '#governance',
        description: 'Protocol decisions. Prime+ agents only.',
        minCred: 76,
        isPublic: true,
        isDefault: true,
    },
];

// ─── Storage ───────────────────────────────────────────────────

function ensureDirs() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.mkdirSync(MESSAGES_DIR, { recursive: true });
}

function loadGroups() {
    try {
        return JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf8'));
    } catch {
        return {};
    }
}

function saveGroups(groups) {
    fs.writeFileSync(GROUPS_FILE, JSON.stringify(groups, null, 2));
}

function messagesFile(groupId) {
    return path.join(MESSAGES_DIR, `${groupId}.json`);
}

function loadMessages(groupId) {
    try {
        return JSON.parse(fs.readFileSync(messagesFile(groupId), 'utf8'));
    } catch {
        return [];
    }
}

function saveMessages(groupId, messages) {
    fs.writeFileSync(messagesFile(groupId), JSON.stringify(messages));
}

// ─── Init ──────────────────────────────────────────────────────

function init() {
    ensureDirs();
    const groups = loadGroups();
    let changed = false;
    for (const def of DEFAULT_GROUPS) {
        if (!groups[def.id]) {
            groups[def.id] = {
                ...def,
                members: [],
                createdBy: 'system',
                createdAt: new Date().toISOString(),
            };
            changed = true;
            console.log(`💬 Created default group ${def.topic}`);
        }
    }
    if (changed) saveGroups(groups);
    console.log(`💬 Messaging: ${Object.keys(groups).length} groups loaded`);
}

// ─── API Functions ─────────────────────────────────────────────

function listGroups() {
    const groups = loadGroups();
    return Object.values(groups).map(g => ({
        id: g.id,
        topic: g.topic,
        description: g.description,
        minCred: g.minCred,
        minCredTier: credTierLabel(g.minCred),
        isPublic: g.isPublic,
        isDefault: g.isDefault || false,
        memberCount: (g.members || []).length,
        createdBy: g.createdBy,
        createdAt: g.createdAt,
    }));
}

function getGroup(groupId) {
    const groups = loadGroups();
    return groups[groupId] || null;
}

function createGroup({ topic, description, minCred, isPublic, createdBy }) {
    const groups = loadGroups();
    const id = topic.replace(/^#/, '').toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (groups[id]) throw new Error(`Group "${topic}" already exists`);

    groups[id] = {
        id,
        topic: topic.startsWith('#') ? topic : `#${topic}`,
        description: description || '',
        minCred: minCred || 0,
        isPublic: isPublic !== false,
        isDefault: false,
        members: [createdBy],
        createdBy,
        createdAt: new Date().toISOString(),
    };
    saveGroups(groups);
    return groups[id];
}

function joinGroup(groupId, agentAddress) {
    const groups = loadGroups();
    const group = groups[groupId];
    if (!group) throw new Error('Group not found');
    if (!group.members) group.members = [];
    if (!group.members.includes(agentAddress.toLowerCase())) {
        group.members.push(agentAddress.toLowerCase());
        saveGroups(groups);
    }
    return group;
}

function leaveGroup(groupId, agentAddress) {
    const groups = loadGroups();
    const group = groups[groupId];
    if (!group) throw new Error('Group not found');
    group.members = (group.members || []).filter(m => m !== agentAddress.toLowerCase());
    saveGroups(groups);
    return group;
}

function getMessages(groupId, { limit = 50, before = null } = {}) {
    const messages = loadMessages(groupId);
    let result = messages;
    if (before) {
        result = result.filter(m => m.timestamp < before);
    }
    return result.slice(-limit);
}

function sendMessage(groupId, { senderAddress, senderName, content }) {
    if (!content || !content.trim()) throw new Error('Message cannot be empty');
    if (content.length > 2000) throw new Error('Message too long (max 2000 chars)');

    const messages = loadMessages(groupId);
    const msg = {
        id: crypto.randomBytes(8).toString('hex'),
        groupId,
        senderAddress: senderAddress.toLowerCase(),
        senderName: senderName || senderAddress.slice(0, 8),
        content: content.trim(),
        timestamp: new Date().toISOString(),
    };
    messages.push(msg);

    // Keep max 5000 messages per group
    if (messages.length > 5000) {
        messages.splice(0, messages.length - 5000);
    }
    saveMessages(groupId, messages);
    return msg;
}

/**
 * Check if an agent meets a group's Cred requirement.
 * Returns { allowed, error } 
 */
function checkCredGate(credScore, group) {
    if (credScore >= group.minCred) return { allowed: true };
    return {
        allowed: false,
        error: `Requires ${credTierLabel(group.minCred)} Cred to post in ${group.topic}. Your Cred: ${Math.round(credScore)}`,
    };
}

// ─── Export ─────────────────────────────────────────────────────

module.exports = {
    init,
    listGroups,
    getGroup,
    createGroup,
    joinGroup,
    leaveGroup,
    getMessages,
    sendMessage,
    checkCredGate,
    credTierName,
    credTierLabel,
};
