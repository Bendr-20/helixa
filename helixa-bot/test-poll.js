require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
bot.on('message', (msg) => {
  console.log('GOT:', msg.chat.id, msg.text);
  bot.sendMessage(msg.chat.id, 'pong');
});
bot.on('polling_error', (err) => console.error('POLL ERR:', err.message));
console.log('test bot listening...');
