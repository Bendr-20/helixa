const { getJobs, saveJobs, getVerified } = require('./store');
const { fetchAgent } = require('./api');
const { checkCredHolding, getCredBalance, formatCredBalance, UNISWAP_BUY_LINK } = require('./cred-token');

// In-memory state for multi-step job posting
const postingState = new Map();

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function nextJobId() {
  const jobs = getJobs();
  return jobs.length ? Math.max(...jobs.map(j => j.id)) + 1 : 1;
}

function escHtml(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function registerJobCommands(bot) {

  // ========== /post-job ==========
  bot.onText(/\/post[-_]?job(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userIdStr = userId.toString();
    const verified = getVerified();
    const v = verified[userIdStr];
    if (!v) return bot.sendMessage(chatId, '❌ You must `/verify <agent_id>` first.', { parse_mode: 'Markdown' });
    try {
      const agent = await fetchAgent(v.agentId);
      if (agent?.owner) {
        const hasEnough = await checkCredHolding(agent.owner, 250);
        if (!hasEnough) {
          const cred = await getCredBalance(agent.owner);
          return bot.sendMessage(chatId, `🔒 Job posting requires holding 250 $CRED (you have ${formatCredBalance(cred.balance)}).\n\n[Buy on Uniswap](${UNISWAP_BUY_LINK})`, { parse_mode: 'Markdown', disable_web_page_preview: true });
        }
      }
    } catch (e) { /* fail open */ }
    postingState.set(userId, { step: 'title', chatId });
    await bot.sendMessage(chatId, '📝 *Create a Job Listing*\n\n💎 Job posting fee: 500 $CRED (hold-to-post)\n\nStep 1/6: What\'s the job title?', { parse_mode: 'Markdown' });
  });

  // ========== /jobs ==========
  bot.onText(/\/jobs(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      await sendJobsList(bot, chatId, { page: 0 });
    } catch (err) {
      console.error('Jobs error:', err);
      bot.sendMessage(chatId, '❌ Failed to list jobs.');
    }
  });

  // ========== /apply <id> ==========
  bot.onText(/\/apply(?:@\w+)?\s+(\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const jobId = parseInt(match[1]);
    try {
      const verified = getVerified();
      if (!verified[userId]) {
        return bot.sendMessage(chatId, '❌ You must `/verify <agent_id>` first before applying.', { parse_mode: 'Markdown' });
      }
      // $CRED gate: 50 required
      try {
        const gateAgent = await fetchAgent(verified[userId].agentId);
        if (gateAgent?.owner) {
          const hasEnough = await checkCredHolding(gateAgent.owner, 50);
          if (!hasEnough) return bot.sendMessage(chatId, `🔒 Applying requires holding 50 $CRED.\n\n[Buy on Uniswap](${UNISWAP_BUY_LINK})`, { parse_mode: 'Markdown', disable_web_page_preview: true });
        }
      } catch (e) { /* fail open */ }
      const jobs = getJobs();
      const job = jobs.find(j => j.id === jobId);
      if (!job) return bot.sendMessage(chatId, `❌ Job #${jobId} not found.`);
      if (job.status !== 'open') return bot.sendMessage(chatId, '❌ This job is no longer open.');

      const agentId = verified[userId].agentId;
      const agent = await fetchAgent(agentId);
      if (!agent) return bot.sendMessage(chatId, '❌ Could not fetch your agent data.');

      if (job.minCred && (agent.credScore || 0) < job.minCred) {
        return bot.sendMessage(chatId, `❌ Your cred (${agent.credScore || 0}) is below the minimum requirement (${job.minCred}).`);
      }

      if (job.applicants.some(a => a.oduserId === userId)) {
        return bot.sendMessage(chatId, '❌ You already applied to this job.');
      }

      job.applicants.push({
        oduserId: userId,
        agentId,
        agentName: agent.name,
        credScore: agent.credScore || 0,
        appliedAt: new Date().toISOString()
      });
      saveJobs(jobs);

      await bot.sendMessage(chatId, `✅ Applied to *${escHtml(job.title)}*! The poster has been notified.`, { parse_mode: 'Markdown' });

      // Notify job poster via DM
      try {
        const username = verified[userId].username || 'Unknown';
        await bot.sendMessage(job.postedBy.chatId,
          `📩 *New Application!*\n\nAgent #${agentId} (${escHtml(agent.name)}, Cred ${agent.credScore || 0}) applied to your job: *${escHtml(job.title)}*\n\nApplicant: @${escHtml(username)}`,
          { parse_mode: 'Markdown' });
      } catch (e) { /* can't DM poster */ }
    } catch (err) {
      console.error('Apply error:', err);
      bot.sendMessage(chatId, '❌ Failed to apply.');
    }
  });

  // ========== /my-jobs ==========
  bot.onText(/\/my[-_]?jobs(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    try {
      const jobs = getJobs().filter(j => j.postedBy.userId === userId);
      if (!jobs.length) return bot.sendMessage(chatId, '📭 You haven\'t posted any jobs yet. Use /postjob to create one.');

      const lines = jobs.map(j => {
        const status = j.status === 'open' ? '🟢' : '🔴';
        return `${status} #${j.id} *${escHtml(j.title)}* — ${j.applicants.length} applicant(s)`;
      });

      const buttons = jobs.map(j => [{
        text: `${j.status === 'open' ? '🔴 Close' : '🟢 Reopen'} #${j.id}`,
        callback_data: `job_toggle:${j.id}`
      }]);

      await bot.sendMessage(chatId, `📋 *Your Jobs*\n\n${lines.join('\n')}`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
      });
    } catch (err) {
      console.error('My-jobs error:', err);
      bot.sendMessage(chatId, '❌ Failed to list your jobs.');
    }
  });

  // ========== /job <id> ==========
  bot.onText(/\/job(?:@\w+)?\s+(\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const jobId = parseInt(match[1]);
    try {
      const job = getJobs().find(j => j.id === jobId);
      if (!job) return bot.sendMessage(chatId, `❌ Job #${jobId} not found.`);
      await bot.sendMessage(chatId, formatJobDetail(job), {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: `📩 Apply`, callback_data: `job_apply:${job.id}` }]]
        }
      });
    } catch (err) {
      console.error('Job detail error:', err);
      bot.sendMessage(chatId, '❌ Failed to fetch job details.');
    }
  });

  // ========== Callback queries ==========
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;

    try {
      // Job posting: role selection
      if (data.startsWith('job_role:')) {
        const role = data.split(':')[1];
        const state = postingState.get(userId);
        if (!state || state.step !== 'role') return bot.answerCallbackQuery(query.id);
        state.role = role;
        state.step = 'chain';
        await bot.answerCallbackQuery(query.id);
        await bot.sendMessage(chatId, 'Step 3/6: Select chain:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Base', callback_data: 'job_chain:Base' }, { text: 'Ethereum', callback_data: 'job_chain:Ethereum' }],
              [{ text: 'Solana', callback_data: 'job_chain:Solana' }, { text: 'Any', callback_data: 'job_chain:Any' }]
            ]
          }
        });
        return;
      }

      // Job posting: chain selection
      if (data.startsWith('job_chain:')) {
        const chain = data.split(':')[1];
        const state = postingState.get(userId);
        if (!state || state.step !== 'chain') return bot.answerCallbackQuery(query.id);
        state.chain = chain;
        state.step = 'minCred';
        await bot.answerCallbackQuery(query.id);
        await bot.sendMessage(chatId, 'Step 4/6: Minimum cred requirement? (0-100, type a number or "0" for none)');
        return;
      }

      // Job posting: confirm
      if (data === 'job_confirm') {
        const state = postingState.get(userId);
        if (!state || state.step !== 'confirm') return bot.answerCallbackQuery(query.id);
        const jobs = getJobs();
        const job = {
          id: nextJobId(),
          title: state.title,
          role: state.role,
          chain: state.chain,
          minCred: state.minCred,
          budget: state.budget,
          description: state.description,
          postedBy: { chatId: state.chatId, userId, username: query.from.username || query.from.first_name },
          postedAt: new Date().toISOString(),
          status: 'open',
          applicants: []
        };
        jobs.push(job);
        saveJobs(jobs);
        postingState.delete(userId);
        await bot.answerCallbackQuery(query.id, { text: 'Job posted!' });
        await bot.sendMessage(chatId, `✅ Job #${job.id} posted!\n\nUse /my-jobs to manage it.`);
        return;
      }

      if (data === 'job_cancel') {
        postingState.delete(userId);
        await bot.answerCallbackQuery(query.id, { text: 'Cancelled' });
        await bot.sendMessage(chatId, '❌ Job posting cancelled.');
        return;
      }

      // Toggle job open/closed
      if (data.startsWith('job_toggle:')) {
        const jobId = parseInt(data.split(':')[1]);
        const jobs = getJobs();
        const job = jobs.find(j => j.id === jobId);
        if (!job || job.postedBy.userId !== userId) {
          return bot.answerCallbackQuery(query.id, { text: 'Not your job' });
        }
        job.status = job.status === 'open' ? 'closed' : 'open';
        saveJobs(jobs);
        await bot.answerCallbackQuery(query.id, { text: `Job ${job.status}` });
        await bot.sendMessage(chatId, `${job.status === 'open' ? '🟢' : '🔴'} Job #${job.id} is now *${job.status}*.`, { parse_mode: 'Markdown' });
        return;
      }

      // Apply via button
      if (data.startsWith('job_apply:')) {
        const jobId = parseInt(data.split(':')[1]);
        await bot.answerCallbackQuery(query.id);
        await bot.sendMessage(chatId, `Use \`/apply ${jobId}\` to apply.`, { parse_mode: 'Markdown' });
        return;
      }

      // View job detail from list
      if (data.startsWith('job_view:')) {
        const jobId = parseInt(data.split(':')[1]);
        const job = getJobs().find(j => j.id === jobId);
        if (!job) return bot.answerCallbackQuery(query.id, { text: 'Job not found' });
        await bot.answerCallbackQuery(query.id);
        await bot.sendMessage(chatId, formatJobDetail(job), {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: `📩 Apply`, callback_data: `job_apply:${job.id}` }]]
          }
        });
        return;
      }

      // Pagination
      if (data.startsWith('jobs_page:')) {
        const page = parseInt(data.split(':')[1]);
        await bot.answerCallbackQuery(query.id);
        await sendJobsList(bot, chatId, { page });
        return;
      }

      // Filter by role
      if (data.startsWith('jobs_filter_role:')) {
        const role = data.split(':')[1];
        await bot.answerCallbackQuery(query.id);
        await sendJobsList(bot, chatId, { page: 0, role: role === 'all' ? null : role });
        return;
      }

      // Filter by chain
      if (data.startsWith('jobs_filter_chain:')) {
        const chain = data.split(':')[1];
        await bot.answerCallbackQuery(query.id);
        await sendJobsList(bot, chatId, { page: 0, chain: chain === 'all' ? null : chain });
        return;
      }

      // Show filter options
      if (data === 'jobs_filters') {
        await bot.answerCallbackQuery(query.id);
        await bot.sendMessage(chatId, '🔍 *Filter Jobs*', {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📋 By Role', callback_data: 'jobs_show_roles' }, { text: '⛓ By Chain', callback_data: 'jobs_show_chains' }],
              [{ text: '🔄 Clear Filters', callback_data: 'jobs_filter_role:all' }]
            ]
          }
        });
        return;
      }

      if (data === 'jobs_show_roles') {
        await bot.answerCallbackQuery(query.id);
        const roles = ['Builder', 'DeFi', 'Trading', 'Analytics', 'Social', 'Infrastructure', 'Security', 'Other'];
        const buttons = [];
        for (let i = 0; i < roles.length; i += 2) {
          const row = [{ text: roles[i], callback_data: `jobs_filter_role:${roles[i]}` }];
          if (roles[i + 1]) row.push({ text: roles[i + 1], callback_data: `jobs_filter_role:${roles[i + 1]}` });
          buttons.push(row);
        }
        await bot.sendMessage(chatId, 'Filter by role:', { reply_markup: { inline_keyboard: buttons } });
        return;
      }

      if (data === 'jobs_show_chains') {
        await bot.answerCallbackQuery(query.id);
        await bot.sendMessage(chatId, 'Filter by chain:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Base', callback_data: 'jobs_filter_chain:Base' }, { text: 'Ethereum', callback_data: 'jobs_filter_chain:Ethereum' }],
              [{ text: 'Solana', callback_data: 'jobs_filter_chain:Solana' }, { text: 'Any', callback_data: 'jobs_filter_chain:Any' }]
            ]
          }
        });
        return;
      }

    } catch (err) {
      console.error('Job callback error:', err);
      bot.answerCallbackQuery(query.id, { text: 'Error' }).catch(() => {});
    }
  });

  // ========== Message handler for posting flow ==========
  bot.on('message', (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const userId = msg.from.id;
    const state = postingState.get(userId);
    if (!state) return;
    const chatId = msg.chat.id;

    if (state.step === 'title') {
      state.title = msg.text.trim();
      state.step = 'role';
      const roles = ['Builder', 'DeFi', 'Trading', 'Analytics', 'Social', 'Infrastructure', 'Security', 'Other'];
      const buttons = [];
      for (let i = 0; i < roles.length; i += 2) {
        const row = [{ text: roles[i], callback_data: `job_role:${roles[i]}` }];
        if (roles[i + 1]) row.push({ text: roles[i + 1], callback_data: `job_role:${roles[i + 1]}` });
        buttons.push(row);
      }
      bot.sendMessage(chatId, 'Step 2/6: Select role tag:', { reply_markup: { inline_keyboard: buttons } });
      return;
    }

    if (state.step === 'minCred') {
      const val = parseInt(msg.text.trim());
      state.minCred = isNaN(val) ? 0 : Math.max(0, Math.min(100, val));
      state.step = 'budget';
      bot.sendMessage(chatId, 'Step 5/6: Budget/compensation? (type it or "skip")');
      return;
    }

    if (state.step === 'budget') {
      state.budget = msg.text.trim().toLowerCase() === 'skip' ? '' : msg.text.trim();
      state.step = 'description';
      bot.sendMessage(chatId, 'Step 6/6: Job description:');
      return;
    }

    if (state.step === 'description') {
      state.description = msg.text.trim();
      state.step = 'confirm';
      const preview = [
        `📝 *Job Preview*`,
        ``,
        `*Title:* ${escHtml(state.title)}`,
        `*Role:* ${state.role}`,
        `*Chain:* ${state.chain}`,
        `*Min Cred:* ${state.minCred}`,
        `*Budget:* ${state.budget || 'Not specified'}`,
        `*Description:* ${escHtml(state.description)}`
      ].join('\n');
      bot.sendMessage(chatId, preview, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Post Job', callback_data: 'job_confirm' }, { text: '❌ Cancel', callback_data: 'job_cancel' }]
          ]
        }
      });
      return;
    }
  });
}

async function sendJobsList(bot, chatId, { page = 0, role = null, chain = null } = {}) {
  let jobs = getJobs().filter(j => j.status === 'open');
  if (role) jobs = jobs.filter(j => j.role === role);
  if (chain) jobs = jobs.filter(j => j.chain === chain);
  jobs.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));

  if (!jobs.length) {
    return bot.sendMessage(chatId, '📭 No open jobs found. Use /postjob to create one!');
  }

  const perPage = 10;
  const totalPages = Math.ceil(jobs.length / perPage);
  const pageJobs = jobs.slice(page * perPage, (page + 1) * perPage);

  const lines = pageJobs.map(j => {
    return `🔹 *#${j.id}* ${escHtml(j.title)}\n   ${j.role} · ${j.chain} · Cred ≥${j.minCred} · ${j.budget || 'No budget'} · ${timeAgo(j.postedAt)}`;
  });

  const buttons = pageJobs.map(j => [{ text: `📋 #${j.id} — ${j.title.slice(0, 30)}`, callback_data: `job_view:${j.id}` }]);

  // Pagination row
  const navRow = [];
  if (page > 0) navRow.push({ text: '⬅️ Prev', callback_data: `jobs_page:${page - 1}` });
  navRow.push({ text: `${page + 1}/${totalPages}`, callback_data: 'noop' });
  if (page < totalPages - 1) navRow.push({ text: '➡️ Next', callback_data: `jobs_page:${page + 1}` });
  buttons.push(navRow);
  buttons.push([{ text: '🔍 Filters', callback_data: 'jobs_filters' }]);

  const filterText = role || chain ? `\n_Filtering: ${role || ''} ${chain || ''}_` : '';
  await bot.sendMessage(chatId, `💼 *Open Jobs* (${jobs.length} total)${filterText}\n\n${lines.join('\n\n')}`, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: buttons }
  });
}

function formatJobDetail(job) {
  return [
    `💼 *Job #${job.id}: ${escHtml(job.title)}*`,
    ``,
    `🏷 *Role:* ${job.role}`,
    `⛓ *Chain:* ${job.chain}`,
    `⚡ *Min Cred:* ${job.minCred}`,
    `💰 *Budget:* ${job.budget || 'Not specified'}`,
    `📋 *Status:* ${job.status === 'open' ? '🟢 Open' : '🔴 Closed'}`,
    `👤 *Posted by:* @${escHtml(job.postedBy.username)} · ${timeAgo(job.postedAt)}`,
    `👥 *Applicants:* ${job.applicants.length}`,
    ``,
    `📝 *Description:*`,
    escHtml(job.description)
  ].join('\n');
}

module.exports = { registerJobCommands };
