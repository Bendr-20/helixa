# Helixa Telegram Bot

Agent report card bot for Helixa protocol.

## Setup

1. Message @BotFather on Telegram:
   - `/newbot` → Name: `Helixa` → Username: `HelixaReportBot`
   - Copy the token

2. Create `.env`:
   ```
   TELEGRAM_BOT_TOKEN=your_token_here
   ```

3. Start with PM2:
   ```bash
   cd /home/ubuntu/.openclaw/workspace/agentdna/helixa-bot
   pm2 start ecosystem.config.js
   pm2 save
   ```

## Commands

- `/report <id or name>` — visual report card
- `/top` or `/leaderboard` — top 10 agents
- `/whois <0x address>` — wallet lookup
- `/cred <id>` — quick cred score
- Natural language: `@HelixaReportBot who is agent 81?`

## Design Notes

- `docs/contractor-proof-pack-template.md` — clean contractor proof pack templates
- `docs/contractor-proof-pack-feature-spec.md` — proposed Telegram flow for generating those docs inside the bot
