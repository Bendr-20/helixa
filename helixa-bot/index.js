require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { renderReportCard, renderCompareCard, renderFlexCard } = require('./renderer');
const { fetchAgent, fetchAgentByName, fetchLeaderboard, fetchAgentByWallet, fetchAllAgents } = require('./api');
const { scanWallet, formatScanResult } = require('./scanner');
const { getSubscribers, saveSubscribers, getGates, saveGates, getVerified, saveVerified } = require('./store');
const { registerJobCommands } = require('./jobs');
const { getCredBalance, getCredPrice, checkCredHolding, formatUsd, formatCredBalance, CRED_ADDRESS, UNISWAP_BUY_LINK } = require('./cred-token');
const { chat: llmChat } = require('./llm');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) { console.error('TELEGRAM_BOT_TOKEN not set'); process.exit(1); }

const bot = new TelegramBot(TOKEN, { polling: true });
registerJobCommands(bot);
const app = express();
const PORT = process.env.PORT || 3847;

// Rate limiter for image generation
const renderQueue = new Map();
const RENDER_COOLDOWN = 5000;

function canRender(chatId) {
  const last = renderQueue.get(chatId);
  if (last && Date.now() - last < RENDER_COOLDOWN) return false;
  renderQueue.set(chatId, Date.now());
  return true;
}

function getTier(score) {
  if (score >= 80) return '✦ Preferred';
  if (score >= 60) return '✦ Prime';
  if (score >= 40) return '✦ Moderate';
  if (score >= 20) return '✦ Speculative';
  return '✦ Junk';
}

function escHtml(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Token gate: returns null if OK, or error message string if gated
// DISABLED — all features free until we have users
const CRED_GATING_ENABLED = false;
async function credGate(msg, minAmount) {
  if (!CRED_GATING_ENABLED) return null; // bypass all gates
  const userId = msg.from.id.toString();
  const verified = getVerified();
  const v = verified[userId];
  if (!v) return `🔒 You need to \`/verify <agent_id>\` first to use this command.`;
  try {
    const agent = await fetchAgent(v.agentId);
    if (!agent?.owner) return `❌ Could not find wallet for your agent.`;
    const hasEnough = await checkCredHolding(agent.owner, minAmount);
    if (!hasEnough) return `🔒 This feature requires holding ${minAmount.toLocaleString()} $CRED.\n\n[Buy on Uniswap](${UNISWAP_BUY_LINK})`;
  } catch (e) {
    console.error('credGate error:', e.message);
  }
  return null;
}

function buildCaption(agent) {
  const tier = getTier(agent.credScore);
  const lines = [];
  lines.push(`📋 <b>${escHtml(agent.name)}</b> — Agent #${agent.tokenId}`);
  lines.push(`⚡ Cred <b>${agent.credScore}</b> · ${tier}`);

  // Show verified Telegram user if linked
  const verified = getVerified();
  const linkedUser = Object.entries(verified).find(([, v]) => v.agentId === agent.tokenId);
  if (linkedUser) {
    lines.push(`🔗 Claimed by @${escHtml(linkedUser[1].username)}`);
  }

  if (agent.narrative?.mission) {
    lines.push(`\n💡 <i>${escHtml(agent.narrative.mission)}</i>`);
  }
  const links = [];
  if (agent.explorer) links.push(`<a href="${agent.explorer}">BaseScan</a>`);
  links.push(`<a href="https://helixa.xyz/agent/${agent.tokenId}">Helixa Profile</a>`);
  const traits = agent.traits || [];
  for (const t of traits) {
    if (t.category === 'social-twitter' && t.name) {
      const handle = t.name.startsWith('@') ? t.name : `@${t.name}`;
      links.push(`<a href="https://x.com/${handle.replace('@', '')}">𝕏 ${escHtml(handle)}</a>`);
    }
    if (t.category === 'social-telegram' && t.name) links.push(`<a href="https://t.me/${t.name.replace('@', '')}">Telegram</a>`);
    if (t.category === 'social-github' && t.name) links.push(`<a href="https://github.com/${t.name}">GitHub</a>`);
    if (t.category === 'social-website' && t.name) links.push(`<a href="${t.name}">Website</a>`);
    if (t.category === 'social-email' && t.name) links.push(`📧 ${escHtml(t.name)}`);
  }
  if (links.length) lines.push(`\n🔗 ${links.join(' · ')}`);
  if (agent.linkedToken) {
    const t = agent.linkedToken;
    lines.push(`\n💰 <a href="https://dexscreener.com/base/${t.contractAddress}">$${escHtml(t.symbol)}</a> (${escHtml(t.name)})`);
  }
  const roleTags = traits.filter(t => ['role', 'title', 'framework', 'chain', 'standard'].includes(t.category)).map(t => t.name).slice(0, 5);
  if (roleTags.length) lines.push(`\n🏷 ${roleTags.join(' · ')}`);
  if (agent.owner) lines.push(`\n👤 Owner: <code>${agent.owner}</code>`);

  // $CRED info (injected async — use buildCaptionAsync instead for full data)
  if (agent._credBalance !== undefined) {
    const credLine = [`\n💎 $CRED: <b>${formatCredBalance(agent._credBalance)}</b>`];
    if (agent._credStaked > 0) credLine.push(`(${formatCredBalance(agent._credStaked)} staked)`);
    if (agent._credPrice) credLine.push(`@ ${formatUsd(agent._credPrice)}`);
    lines.push(credLine.join(' '));
  }

  return lines.join('\n');
}

async function enrichAgentWithCred(agent) {
  if (!agent?.owner) return agent;
  try {
    const [cred, price] = await Promise.all([getCredBalance(agent.owner), getCredPrice()]);
    agent._credBalance = cred.balance;
    agent._credStaked = cred.staked;
    agent._credPrice = price?.price || 0;
  } catch (e) { /* skip */ }
  return agent;
}

// ==================== EXISTING COMMANDS ====================

// /report <id or name>
bot.onText(/\/report(?:@\w+)?\s+(.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const query = match[1].trim();
  if (!canRender(chatId)) return bot.sendMessage(chatId, '⏳ Please wait a few seconds between reports.');
  await bot.sendChatAction(chatId, 'upload_photo');
  try {
    let agent;
    if (/^\d+$/.test(query)) agent = await fetchAgent(parseInt(query));
    else agent = await fetchAgentByName(query);
    if (!agent) return bot.sendMessage(chatId, `❌ Agent "${query}" not found.`);
    await enrichAgentWithCred(agent);
    const png = await renderReportCard(agent);
    await bot.sendPhoto(chatId, png, { caption: buildCaption(agent), parse_mode: 'HTML' });
  } catch (err) {
    console.error('Report error:', err);
    bot.sendMessage(chatId, '❌ Failed to generate report. Try again later.');
  }
});

// /top or /leaderboard
bot.onText(/\/(top|leaderboard)(?:@\w+)?$/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const [agents, price] = await Promise.all([fetchLeaderboard(), getCredPrice()]);
    const priceHeader = price ? `💎 $CRED: ${formatUsd(price.price)} (${price.change24h >= 0 ? '+' : ''}${price.change24h.toFixed(1)}% 24h)\n\n` : '';
    const lines = agents.map((a, i) => {
      const medal = i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}.`;
      return `${medal} **${a.name}** (#${a.tokenId}) — Cred ${a.credScore}`;
    });
    await bot.sendMessage(chatId, `🏆 *Top Agents by Cred*\n\n${priceHeader}${lines.join('\n')}`, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Leaderboard error:', err);
    bot.sendMessage(chatId, '❌ Failed to fetch leaderboard.');
  }
});

// /whois <0x address>
bot.onText(/\/whois(?:@\w+)?\s+(0x[a-fA-F0-9]+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const address = match[1];
  try {
    const agent = await fetchAgentByWallet(address);
    if (!agent) return bot.sendMessage(chatId, `❌ No agent found for wallet ${address.slice(0, 10)}...`);
    await bot.sendMessage(chatId,
      `🔍 *${agent.name}* (Agent #${agent.tokenId})\nCred: ${agent.credScore}\nOwner: \`${agent.owner}\``,
      { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Whois error:', err);
    bot.sendMessage(chatId, '❌ Failed to look up wallet.');
  }
});

// /cred <id>
bot.onText(/\/cred(?:@\w+)?\s+(\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const id = parseInt(match[1]);
  try {
    const agent = await fetchAgent(id);
    if (!agent) return bot.sendMessage(chatId, `❌ Agent #${id} not found.`);
    const tier = getTier(agent.credScore);
    await bot.sendMessage(chatId, `⚡ *${agent.name}* (#${agent.tokenId})\nCred Score: *${agent.credScore}*\nTier: ${tier}`, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Cred error:', err);
    bot.sendMessage(chatId, '❌ Failed to fetch cred score.');
  }
});

// ==================== NEW COMMANDS ====================

// /scan 0x... (requires 100 $CRED)
bot.onText(/\/scan(?:@\w+)?\s+(0x[a-fA-F0-9]{40})/, async (msg, match) => {
  const chatId = msg.chat.id;
  const gateMsg = await credGate(msg, 100);
  if (gateMsg) return bot.sendMessage(chatId, gateMsg, { parse_mode: 'Markdown' });
  const address = match[1];
  await bot.sendChatAction(chatId, 'typing');
  try {
    const [scanResult, helixaAgent] = await Promise.all([
      scanWallet(address),
      fetchAgentByWallet(address).catch(() => null),
    ]);
    const text = formatScanResult(scanResult, helixaAgent);
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Scan error:', err);
    bot.sendMessage(chatId, '❌ Failed to scan wallet. Try again later.');
  }
});

// /compare <id1> <id2> (requires 100 $CRED)
bot.onText(/\/compare(?:@\w+)?\s+(\d+)\s+(\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const gateMsg = await credGate(msg, 100);
  if (gateMsg) return bot.sendMessage(chatId, gateMsg, { parse_mode: 'Markdown' });
  if (!canRender(chatId)) return bot.sendMessage(chatId, '⏳ Please wait a few seconds between renders.');
  await bot.sendChatAction(chatId, 'upload_photo');
  try {
    const [a1, a2] = await Promise.all([fetchAgent(parseInt(match[1])), fetchAgent(parseInt(match[2]))]);
    if (!a1) return bot.sendMessage(chatId, `❌ Agent #${match[1]} not found.`);
    if (!a2) return bot.sendMessage(chatId, `❌ Agent #${match[2]} not found.`);
    const png = await renderCompareCard(a1, a2);
    await bot.sendPhoto(chatId, png, { caption: `⚔️ ${a1.name} vs ${a2.name}`, parse_mode: 'HTML' });
  } catch (err) {
    console.error('Compare error:', err);
    bot.sendMessage(chatId, '❌ Failed to generate comparison.');
  }
});

// /alert <id> — toggle subscription
bot.onText(/\/alert(?:@\w+)?\s+(\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const agentId = parseInt(match[1]);
  try {
    const subs = getSubscribers();
    const idx = subs.findIndex(s => s.chatId === chatId && s.agentId === agentId);
    if (idx >= 0) {
      subs.splice(idx, 1);
      saveSubscribers(subs);
      await bot.sendMessage(chatId, `🔕 Unsubscribed from Agent #${agentId} alerts.`);
    } else {
      const agent = await fetchAgent(agentId);
      if (!agent) return bot.sendMessage(chatId, `❌ Agent #${agentId} not found.`);
      subs.push({ chatId, agentId, subscribedAt: new Date().toISOString() });
      saveSubscribers(subs);
      lastKnownScores.set(agentId, agent.credScore);
      await bot.sendMessage(chatId, `🔔 Subscribed to alerts for *${agent.name}* (#${agentId}). You'll be notified of cred changes.`, { parse_mode: 'Markdown' });
    }
  } catch (err) {
    console.error('Alert error:', err);
    bot.sendMessage(chatId, '❌ Failed to manage alert.');
  }
});

// /alerts — list subscriptions
bot.onText(/\/alerts(?:@\w+)?$/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const subs = getSubscribers().filter(s => s.chatId === chatId);
    if (!subs.length) return bot.sendMessage(chatId, '📭 No active subscriptions. Use `/alert <id>` to subscribe.', { parse_mode: 'Markdown' });
    const lines = subs.map(s => `• Agent #${s.agentId} (since ${s.subscribedAt.split('T')[0]})`);
    await bot.sendMessage(chatId, `🔔 *Your Subscriptions:*\n${lines.join('\n')}`, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Alerts error:', err);
    bot.sendMessage(chatId, '❌ Failed to list alerts.');
  }
});

// Alert polling — tracks cred, vouches, staking, points, verification changes
const lastKnown = new Map(); // agentId -> { credScore, points, verified, vouchCount, stakedAmount, traits }
let lastTotalAgents = null;

async function checkAlerts() {
  try {
    const subs = getSubscribers();
    const uniqueAgentIds = [...new Set(subs.map(s => s.agentId))];

    // Check for new mints (global)
    try {
      const allAgents = await fetchAllAgents();
      if (allAgents && allAgents.length) {
        const currentTotal = allAgents.length;
        if (lastTotalAgents !== null && currentTotal > lastTotalAgents) {
          const newCount = currentTotal - lastTotalAgents;
          const newest = allAgents
            .sort((a, b) => b.tokenId - a.tokenId)
            .slice(0, newCount);
          const names = newest.map(a => `${a.name || 'Unnamed'} (#${a.tokenId})`).join(', ');
          const mintMsg = `🆕 *${newCount} new agent${newCount > 1 ? 's' : ''} minted!*\n${names}`;
          // Notify all subscribers
          const allChatIds = [...new Set(subs.map(s => s.chatId))];
          for (const cid of allChatIds) {
            bot.sendMessage(cid, mintMsg, { parse_mode: 'Markdown' }).catch(() => {});
          }
        }
        lastTotalAgents = currentTotal;
      }
    } catch (e) { /* skip mint check */ }

    // Per-agent checks
    for (const agentId of uniqueAgentIds) {
      try {
        const agent = await fetchAgent(agentId);
        if (!agent) continue;

        const prev = lastKnown.get(agentId);
        const vouchCount = (agent.traits || []).filter(t => t.category === 'vouch').length;
        const current = {
          credScore: agent.credScore,
          points: agent.points || 0,
          verified: agent.verified,
          vouchCount,
          soulbound: agent.soulbound,
          traitCount: (agent.traits || []).length,
        };
        lastKnown.set(agentId, current);

        if (!prev) continue;

        const chatIds = subs.filter(s => s.agentId === agentId).map(s => s.chatId);
        const alerts = [];

        // Cred score change
        if (prev.credScore !== current.credScore) {
          const diff = current.credScore - prev.credScore;
          const arrow = diff > 0 ? '📈' : '📉';
          alerts.push(`${arrow} Cred: ${prev.credScore} → ${current.credScore} (${diff > 0 ? '+' : ''}${diff})`);
        }

        // New vouches
        if (current.vouchCount > prev.vouchCount) {
          const newVouches = current.vouchCount - prev.vouchCount;
          alerts.push(`🤝 ${newVouches} new vouch${newVouches > 1 ? 'es' : ''} received (total: ${current.vouchCount})`);
        }

        // Points change
        if (current.points !== prev.points && current.points > prev.points) {
          alerts.push(`⭐ Points: ${prev.points} → ${current.points}`);
        }

        // Verification status change
        if (!prev.verified && current.verified) {
          alerts.push(`✅ Agent is now verified!`);
        }

        // New traits added
        if (current.traitCount > prev.traitCount) {
          const newTraits = current.traitCount - prev.traitCount;
          alerts.push(`🏷 ${newTraits} new trait${newTraits > 1 ? 's' : ''} added`);
        }

        if (alerts.length) {
          const header = `🔔 *${agent.name}* (#${agentId}) update:`;
          const msg = `${header}\n${alerts.join('\n')}`;
          for (const cid of chatIds) {
            bot.sendMessage(cid, msg, { parse_mode: 'Markdown' }).catch(() => {});
          }
        }
      } catch (e) { /* skip agent */ }
    }
  } catch (e) { console.error('Alert check error:', e); }
}

setInterval(checkAlerts, 5 * 60 * 1000);

// /mint — interactive minting guide
bot.onText(/\/mint(?:@\w+)?$/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    await bot.sendMessage(chatId, '🧬 *Ready to mint your Helixa agent?*\n\nMinting creates your onchain AI identity on Base.', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Yes, let\'s go!', callback_data: 'mint_yes' }, { text: '📖 Learn More', callback_data: 'mint_learn' }]
        ]
      }
    });
  } catch (err) {
    console.error('Mint error:', err);
    bot.sendMessage(chatId, '❌ Failed to start minting guide.');
  }
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  try {
    if (query.data === 'mint_yes') {
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId, '💰 *Mint Price:* 0.0025 ETH on Base\n\n🔗 [Mint your agent on Helixa](https://helixa.xyz/mint)\n\nOnce minted, come back and use `/report <your_agent_id>` to see your card!', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🌐 Open Helixa Mint', url: 'https://helixa.xyz/mint' }]]
        }
      });
    } else if (query.data === 'mint_learn') {
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId, '🧬 *What is a Helixa Agent?*\n\nA Helixa agent is an onchain AI identity minted as an NFT on Base. It tracks your cred score, traits, and reputation across the ecosystem.\n\n• Soulbound to your wallet\n• Earns cred through activity\n• Verifiable onchain identity\n\nReady?', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '✅ Mint Now', callback_data: 'mint_yes' }]]
        }
      });
    }
  } catch (err) {
    console.error('Callback error:', err);
  }
});

// /flex <id> (requires 100 $CRED)
bot.onText(/\/flex(?:@\w+)?\s+(\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const gateMsg = await credGate(msg, 100);
  if (gateMsg) return bot.sendMessage(chatId, gateMsg, { parse_mode: 'Markdown' });
  if (!canRender(chatId)) return bot.sendMessage(chatId, '⏳ Please wait a few seconds between renders.');
  await bot.sendChatAction(chatId, 'upload_photo');
  try {
    const agent = await fetchAgent(parseInt(match[1]));
    if (!agent) return bot.sendMessage(chatId, `❌ Agent #${match[1]} not found.`);
    const png = await renderFlexCard(agent);
    await bot.sendPhoto(chatId, png, { caption: `💎 ${agent.name} — Cred ${agent.credScore} | helixa.xyz/agent/${agent.tokenId}` });
  } catch (err) {
    console.error('Flex error:', err);
    bot.sendMessage(chatId, '❌ Failed to generate flex card.');
  }
});

// /rank <id>
bot.onText(/\/rank(?:@\w+)?\s+(\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  await bot.sendChatAction(chatId, 'typing');
  try {
    const id = parseInt(match[1]);
    const allAgents = await fetchAllAgents();
    const sorted = allAgents.sort((a, b) => (b.credScore || 0) - (a.credScore || 0));
    const pos = sorted.findIndex(a => a.tokenId === id);
    if (pos === -1) return bot.sendMessage(chatId, `❌ Agent #${id} not found.`);
    const agent = sorted[pos];
    const rank = pos + 1;
    const total = sorted.length;
    const pct = ((rank / total) * 100).toFixed(1);
    await bot.sendMessage(chatId, `🏅 *${agent.name}* is ranked *#${rank}* out of ${total.toLocaleString()} agents — Top ${pct}%`, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Rank error:', err);
    bot.sendMessage(chatId, '❌ Failed to fetch ranking.');
  }
});

// /gate — group cred gating (admin only)
bot.onText(/\/gate(?:@\w+)?(?:\s+(.*))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (msg.chat.type === 'private') return bot.sendMessage(chatId, '❌ /gate only works in groups.');
  try {
    // Check if user is admin
    const member = await bot.getChatMember(chatId, msg.from.id);
    if (!['creator', 'administrator'].includes(member.status)) {
      return bot.sendMessage(chatId, '❌ Only admins can configure gate.');
    }
    const gates = getGates();
    const arg = match[1]?.trim();
    if (!arg) {
      const current = gates[chatId];
      if (current) {
        await bot.sendMessage(chatId, `🔒 Gate is active. Minimum cred: *${current.minCred}*`, { parse_mode: 'Markdown' });
      } else {
        await bot.sendMessage(chatId, '🔓 Gate is not active. Use `/gate <min_cred>` to enable.', { parse_mode: 'Markdown' });
      }
    } else if (arg === 'off') {
      delete gates[chatId];
      saveGates(gates);
      await bot.sendMessage(chatId, '🔓 Gate disabled.');
    } else {
      const minCred = parseInt(arg);
      if (isNaN(minCred) || minCred < 1) return bot.sendMessage(chatId, '❌ Provide a valid minimum cred score.');
      gates[chatId] = { minCred, setBy: msg.from.id, setAt: new Date().toISOString() };
      saveGates(gates);
      await bot.sendMessage(chatId, `🔒 Gate enabled. Minimum cred: *${minCred}*`, { parse_mode: 'Markdown' });
    }
  } catch (err) {
    console.error('Gate error:', err);
    bot.sendMessage(chatId, '❌ Failed to configure gate.');
  }
});

// Gate enforcement on new members
bot.on('new_chat_members', async (msg) => {
  const chatId = msg.chat.id;
  try {
    const gates = getGates();
    const gate = gates[chatId];
    if (!gate) return;
    const verified = getVerified();
    for (const member of msg.new_chat_members) {
      if (member.is_bot) continue;
      const userId = member.id.toString();
      const userVerified = verified[userId];
      if (!userVerified) {
        await bot.sendMessage(chatId, `⚠️ Welcome ${member.first_name}! This group requires a verified Helixa agent with cred ≥ ${gate.minCred}. Use /verify <agent_id> to link your agent.`);
        continue;
      }
      const agent = await fetchAgent(userVerified.agentId);
      if (!agent || (agent.credScore || 0) < gate.minCred) {
        await bot.sendMessage(chatId, `⚠️ ${member.first_name}, your agent's cred (${agent?.credScore || 0}) is below the required ${gate.minCred}. Boost your cred at helixa.xyz!`);
      }
    }
  } catch (err) {
    console.error('Gate check error:', err);
  }
});

// /verify <id>
bot.onText(/\/verify(?:@\w+)?\s+(\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const agentId = parseInt(match[1]);
  try {
    const agent = await fetchAgent(agentId);
    if (!agent) return bot.sendMessage(chatId, `❌ Agent #${agentId} not found.`);
    const verified = getVerified();
    const userId = msg.from.id.toString();
    // Check if already claimed by someone else
    const existingClaim = Object.entries(verified).find(([uid, v]) => v.agentId === agentId && uid !== userId);
    if (existingClaim) {
      return bot.sendMessage(chatId, `❌ Agent #${agentId} is already claimed by another user.`);
    }
    verified[userId] = {
      agentId,
      username: msg.from.username || msg.from.first_name,
      verifiedAt: new Date().toISOString(),
    };
    saveVerified(verified);
    await bot.sendMessage(chatId, `✅ *${agent.name}* (#${agentId}) is now linked to your Telegram account!`, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Verify error:', err);
    bot.sendMessage(chatId, '❌ Failed to verify.');
  }
});

// /wallet — check $CRED balance and staking
bot.onText(/\/wallet(?:@\w+)?$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const verified = getVerified();
  const v = verified[userId];
  if (!v) return bot.sendMessage(chatId, '❌ You must `/verify <agent_id>` first.', { parse_mode: 'Markdown' });
  await bot.sendChatAction(chatId, 'typing');
  try {
    const agent = await fetchAgent(v.agentId);
    if (!agent?.owner) return bot.sendMessage(chatId, '❌ Could not find wallet for your agent.');
    const [cred, price] = await Promise.all([getCredBalance(agent.owner), getCredPrice()]);
    const lines = [
      `💎 *$CRED Wallet — ${agent.name}*`,
      ``,
      `💰 Balance: *${formatCredBalance(cred.balance)} $CRED*`,
    ];
    if (cred.staked > 0) lines.push(`🔒 Staked: *${formatCredBalance(cred.staked)} $CRED*`);
    if (price) {
      const usdVal = cred.balance * price.price;
      lines.push(`💵 Value: ~${formatUsd(usdVal)}`);
      lines.push(`📊 Price: ${formatUsd(price.price)} (${price.change24h >= 0 ? '+' : ''}${price.change24h.toFixed(1)}% 24h)`);
    }
    lines.push(`\n👤 Wallet: \`${agent.owner}\``);
    lines.push(`\n[Buy $CRED](${UNISWAP_BUY_LINK})`);
    await bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown', disable_web_page_preview: true });
  } catch (err) {
    console.error('Wallet error:', err);
    bot.sendMessage(chatId, '❌ Failed to fetch wallet info.');
  }
});

// /price — quick $CRED price check
bot.onText(/\/price(?:@\w+)?$/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendChatAction(chatId, 'typing');
  try {
    const price = await getCredPrice();
    if (!price) return bot.sendMessage(chatId, '❌ Could not fetch $CRED price.');
    const lines = [
      `💎 *$CRED Price*`,
      ``,
      `💵 Price: *${formatUsd(price.price)}*`,
      `📈 24h Change: ${price.change24h >= 0 ? '+' : ''}${price.change24h.toFixed(2)}%`,
      `📊 Market Cap: ${formatUsd(price.marketCap)}`,
      `💧 Liquidity: ${formatUsd(price.liquidity)}`,
      `📦 24h Volume: ${formatUsd(price.volume24h)}`,
      ``,
      `[Chart](https://dexscreener.com/base/${CRED_ADDRESS}) · [Buy](${UNISWAP_BUY_LINK})`,
    ];
    await bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown', disable_web_page_preview: true });
  } catch (err) {
    console.error('Price error:', err);
    bot.sendMessage(chatId, '❌ Failed to fetch price.');
  }
});

// /tip <agent_id> <amount> — informational tip intent
bot.onText(/\/tip(?:@\w+)?\s+(\d+)\s+([\d.]+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const agentId = parseInt(match[1]);
  const amount = parseFloat(match[2]);
  if (isNaN(amount) || amount <= 0) return bot.sendMessage(chatId, '❌ Invalid amount.');
  try {
    const agent = await fetchAgent(agentId);
    if (!agent) return bot.sendMessage(chatId, `❌ Agent #${agentId} not found.`);
    if (!agent.owner) return bot.sendMessage(chatId, '❌ Agent has no wallet linked.');
    const transferLink = `https://app.uniswap.org/send?chain=base&token=${CRED_ADDRESS}&to=${agent.owner}`;
    const lines = [
      `💸 *Tip ${amount} $CRED to ${agent.name}*`,
      ``,
      `📤 Send to: \`${agent.owner}\``,
      `💎 Amount: ${amount} $CRED`,
      ``,
      `[Send via Uniswap](${transferLink})`,
    ];
    await bot.sendMessage(chatId, lines.join('\n'), {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [[{ text: `💸 Send ${amount} $CRED`, url: transferLink }]]
      }
    });
  } catch (err) {
    console.error('Tip error:', err);
    bot.sendMessage(chatId, '❌ Failed to generate tip link.');
  }
});

// Natural language handler
bot.on('message', async (msg) => {
  if (!msg.text) return;
  const text = msg.text.toLowerCase();
  const botUsername = (await bot.getMe()).username.toLowerCase();
  if (!text.includes(`@${botUsername}`)) return;

  // Strip bot mention for cleaner processing
  const cleanText = msg.text.replace(new RegExp(`@${botUsername}`, 'gi'), '').trim();

  // Try structured report first (visual card)
  const agentMatch = text.match(/(?:who is|look up|find|report)\s+(?:agent\s+)?#?(\d+)/i);
  if (agentMatch) {
    const id = parseInt(agentMatch[1]);
    if (!canRender(msg.chat.id)) return bot.sendMessage(msg.chat.id, '⏳ Please wait a few seconds between reports.');
    await bot.sendChatAction(msg.chat.id, 'upload_photo');
    try {
      const agent = await fetchAgent(id);
      if (!agent) return bot.sendMessage(msg.chat.id, `❌ Agent #${id} not found.`);
      await enrichAgentWithCred(agent);
      const png = await renderReportCard(agent);
      await bot.sendPhoto(msg.chat.id, png, { caption: buildCaption(agent), parse_mode: 'HTML' });
    } catch (err) {
      console.error('NL report error:', err);
      bot.sendMessage(msg.chat.id, '❌ Failed to generate report.');
    }
    return;
  }

  // LLM fallback — conversational AI for everything else
  if (cleanText.length < 2) return;
  await bot.sendChatAction(msg.chat.id, 'typing');
  try {
    const response = await llmChat(msg.chat.id, cleanText, msg.from.username || msg.from.first_name);
    if (response) {
      await bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });
    }
  } catch (err) {
    console.error('LLM chat error:', err);
  }
});

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', uptime: process.uptime() }));
app.listen(PORT, () => console.log(`Health check on :${PORT}`));

console.log('Helixa bot started');
