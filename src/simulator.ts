import * as readline from 'readline';
import { prisma } from './db';
import {
  getSession,
  resetSession,
  setupBot,
  UserSession,
  formatPrice,
  sessions,
} from './bot';
import { extractQueryEntities, getRealEstateAdvice } from './ai';

console.log('\n===============================================================');
console.log('🔥 AARNA ESTATES AI TELEGRAM BOT SIMULATOR 🔥');
console.log('===============================================================');
console.log('This tool lets you interact with the bot flows inside your terminal.');
console.log('Guided flow, lead scoring, database queries, and AI parser are all live!');
console.log('Type "/start" to initialize, "/exit" to close the simulator.');
console.log('===============================================================\n');

const MOCK_USER_ID = '999912345';
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Hold the callbacks that are active in the current menu
let activeInlineButtons: Array<{ text: string; callback_data: string }> = [];
let hasActiveKeyboard = false;
let keyboardButtonText = '';

// Helper to print inline keyboards or keyboards in a beautiful styled console format
function printMarkup(markup: any) {
  activeInlineButtons = [];
  hasActiveKeyboard = false;

  if (!markup) return;

  // Check Inline Keyboard
  if (markup.reply_markup && markup.reply_markup.inline_keyboard) {
    console.log('\nButtons available:');
    const rows = markup.reply_markup.inline_keyboard;
    let index = 1;
    for (const row of rows) {
      for (const btn of row) {
        activeInlineButtons.push({ text: btn.text, callback_data: btn.callback_data });
        console.log(`  [${index}] ${btn.text}`);
        index++;
      }
    }
    console.log(`* (Type the number to click a button, or type normal text to chat)`);
  }

  // Check Reply Keyboard
  if (markup.reply_markup && markup.reply_markup.keyboard) {
    hasActiveKeyboard = true;
    const rows = markup.reply_markup.keyboard;
    keyboardButtonText = rows[0][0].text; // E.g. "Share Contact Card 📱"
    console.log(`\n[Active Keyboard Button]: [C] ${keyboardButtonText}`);
    console.log(`* (Type "C" to simulate clicking the contact card button, or type text)`);
  }

  if (markup.reply_markup && markup.reply_markup.remove_keyboard) {
    // Removed keyboard
  }
}

// Build the mock Context representing Telegraf API
function createMockCtx() {
  const session = getSession(MOCK_USER_ID);
  
  return {
    from: { id: Number(MOCK_USER_ID), first_name: 'SimulatedUser', last_name: 'Alpha' },
    session,
    reply: async (text: string, markup?: any) => {
      console.log(`\n💬 \x1b[36m[Bot]:\x1b[0m ${text}`);
      printMarkup(markup);
    },
    replyWithMarkdown: async (text: string, markup?: any) => {
      console.log(`\n💬 \x1b[36m[Bot - Markdown]:\x1b[0m\n${text}`);
      printMarkup(markup);
    },
    replyWithPhoto: async (photoUrl: string, options?: any) => {
      console.log(`\n🖼️  \x1b[35m[Property Card Photo]:\x1b[0m ${photoUrl}`);
      console.log(`💬 \x1b[36m[Property Details]:\x1b[0m\n${options.caption}`);
      printMarkup(options);
    },
    answerCbQuery: async () => {
      // simulated
    },
  };
}

// Emulate Telegraf event handlers
const registeredHandlers = {
  start: null as any,
  actions: [] as Array<{ pattern: RegExp | string; handler: any }>,
  text: null as any,
  contact: null as any,
};

// Mock Telegraf Client to collect handlers
const mockBot = {
  telegram: {
    sendMessage: async (chatId: string, text: string) => {
      console.log(`\n📢 \x1b[33m[AGENT GROUP ALERT (${chatId})]:\x1b[0m\n${text}`);
    },
  },
  start: (fn: any) => {
    registeredHandlers.start = fn;
  },
  action: (pattern: any, fn: any) => {
    registeredHandlers.actions.push({ pattern, handler: fn });
  },
  on: (event: string, fn: any) => {
    if (event === 'text') registeredHandlers.text = fn;
    if (event === 'contact') registeredHandlers.contact = fn;
  },
  catch: () => {},
  launch: async () => {},
} as any;

// Set up the bot logic with our simulated telegraf
setupBot(mockBot);

// Start conversation loop
async function promptUser() {
  const session = getSession(MOCK_USER_ID);
  
  const stepColors: Record<string, string> = {
    IDLE: '\x1b[32mIDLE\x1b[0m',
    WIZARD_CITY: '\x1b[33mCITY_SELECTION\x1b[0m',
    WIZARD_BUDGET: '\x1b[33mBUDGET_SELECTION\x1b[0m',
    WIZARD_TYPE: '\x1b[33mTYPE_SELECTION\x1b[0m',
    WIZARD_TIMELINE: '\x1b[33mTIMELINE_SELECTION\x1b[0m',
    WIZARD_NAME: '\x1b[33mNAME_CAPTURE\x1b[0m',
    WIZARD_PHONE: '\x1b[33mPHONE_CAPTURE\x1b[0m',
    BOOK_VISIT_DATE: '\x1b[33mVISIT_DATE_CAPTURE\x1b[0m',
    AI_MODE: '\x1b[35mAI_ADVISOR_CHAT\x1b[0m',
  };

  const currentStep = stepColors[session.step] || session.step;

  rl.question(`\n[Status: ${currentStep}] You: `, async (input) => {
    const cleanInput = input.trim();

    if (cleanInput.toLowerCase() === '/exit') {
      console.log('\nSimulator closing. Disconnecting DB...');
      await prisma.$disconnect();
      console.log('Goodbye!\n');
      rl.close();
      process.exit(0);
    }

    const ctx = createMockCtx() as any;

    // 1. Check for command /start
    if (cleanInput === '/start') {
      if (registeredHandlers.start) {
        await registeredHandlers.start(ctx);
      }
      promptUser();
      return;
    }

    // 2. Check if clicking an active inline button index (e.g. 1, 2, 3)
    const buttonNum = parseInt(cleanInput, 10);
    if (!isNaN(buttonNum) && buttonNum >= 1 && buttonNum <= activeInlineButtons.length) {
      const btn = activeInlineButtons[buttonNum - 1];
      console.log(`\n* [Simulated Click]: "${btn.text}" (${btn.callback_data})`);
      
      // Clear buttons for next screen
      activeInlineButtons = [];

      // Find matching action handler
      let matched = false;
      for (const act of registeredHandlers.actions) {
        if (typeof act.pattern === 'string' && act.pattern === btn.callback_data) {
          ctx.match = [btn.callback_data];
          await act.handler(ctx);
          matched = true;
          break;
        } else if (act.pattern instanceof RegExp) {
          const match = btn.callback_data.match(act.pattern);
          if (match) {
            ctx.match = match;
            await act.handler(ctx);
            matched = true;
            break;
          }
        }
      }

      if (!matched) {
        console.log(`[Simulator Warning] No action handler registered for callback_data: "${btn.callback_data}"`);
      }
      
      promptUser();
      return;
    }

    // 3. Check if clicking contact sharing button shortcut 'C' or 'c'
    if (hasActiveKeyboard && cleanInput.toUpperCase() === 'C') {
      console.log(`\n* [Simulated Click]: "${keyboardButtonText}"`);
      
      if (registeredHandlers.contact) {
        const contactCtx = {
          ...ctx,
          message: {
            contact: {
              phone_number: '+919999000099',
              first_name: 'SimulatedUser',
              last_name: 'Alpha',
            },
          },
        };
        await registeredHandlers.contact(contactCtx);
      }
      promptUser();
      return;
    }

    // 4. Fallback to normal text handler
    if (registeredHandlers.text) {
      const textCtx = {
        ...ctx,
        message: { text: cleanInput },
      };
      await registeredHandlers.text(textCtx);
    }

    promptUser();
  });
}

// Run startup database status check before opening the loop
async function runSimulator() {
  try {
    const propertyCount = await prisma.property.count();
    console.log(`Database connected successfully. Pre-loaded properties: ${propertyCount}`);
    if (propertyCount === 0) {
      console.log('WARNING: Properties table is empty! Please run "npm run seed" first.');
    }
  } catch (err) {
    console.error('Error connecting to database. Please make sure Prisma is migrated.', err);
  }

  // Auto trigger /start to begin nicely
  const ctx = createMockCtx() as any;
  console.log('\n* Auto-starting conversation...');
  if (registeredHandlers.start) {
    await registeredHandlers.start(ctx);
  }
  promptUser();
}

runSimulator();
