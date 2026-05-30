import { Telegraf } from 'telegraf';
import { setupBot } from './bot';
import { disconnectDb } from './db';
import * as dotenv from 'dotenv';
import * as http from 'http';

dotenv.config();

// Simple HTTP health-check server to satisfy Render's Web Service port binding requirement
const PORT = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Aarna Estates Telegram Bot is live and healthy!');
});
server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`[Health Check] Server is listening on port ${PORT} to satisfy Render port-binding.`);
});

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const isTokenPlaceholder = !TOKEN || TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN' || TOKEN === '';

async function startBot() {
  if (isTokenPlaceholder) {
    console.log('\n===============================================================');
    console.log('🤖 Real Estate AI Telegram Bot Starter 🤖');
    console.log('===============================================================');
    console.log('WARNING: TELEGRAM_BOT_TOKEN is missing or set to placeholder in .env!');
    console.log('\nTo run a real Telegram bot:');
    console.log('1. Message @BotFather on Telegram and send /newbot');
    console.log('2. Copy the API Token received.');
    console.log('3. Paste it in your .env file as: TELEGRAM_BOT_TOKEN="your_token"');
    console.log('\n===============================================================');
    console.log('🔥 LOCAL CONSOLE SIMULATOR AVAILABLE! 🔥');
    console.log('You can test the entire bot guided flow, lead scoring, database queries,');
    console.log('and Gemini AI parser inside your command line terminal!');
    console.log('Run the command: npm run simulate');
    console.log('===============================================================\n');
    process.exit(0);
  }

  console.log('[Bot] Connecting to Telegram...');
  const bot = new Telegraf(TOKEN!);

  setupBot(bot);

  // Error catching
  bot.catch((err: any, ctx) => {
    console.error(`[Telegraf Error] encountered error for ${ctx.updateType}:`, err);
  });

  // Start polling with automatic retries for zero-downtime rolling deploy conflict handling
  async function launchWithRetry(retries = 5, delayMs = 6000) {
    for (let i = 0; i < retries; i++) {
      try {
        await bot.launch({
          allowedUpdates: [],
          dropPendingUpdates: true
        });
        console.log('🚀 Aarna Estates AI Telegram Bot is fully online and polling!');
        return;
      } catch (err: any) {
        console.error(`[Bot Launch Attempt ${i + 1} Failed]:`, err.message || err);
        if (i < retries - 1) {
          console.log(`Retrying bot launch in ${delayMs / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          console.error('[Bot Launch Failed] Max retries reached.');
          process.exit(1);
        }
      }
    }
  }

  launchWithRetry();

  // Enable graceful stop
  const shutdown = async (signal: string) => {
    console.log(`\n[Shutdown] Received ${signal}. Shutting down gracefully...`);
    bot.stop(signal);
    server.close();
    await disconnectDb();
    console.log('[Shutdown] Disconnected database. Goodbye!');
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

startBot();
