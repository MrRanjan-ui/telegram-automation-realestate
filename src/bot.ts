import { Telegraf, Markup } from 'telegraf';
import { prisma } from './db';
import { extractQueryEntities, getRealEstateAdvice, ParsedQuery } from './ai';
import { generatePropertyBrochure } from './brochure';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

// User Session State Structure
export interface UserSession {
  userId: string;
  step:
    | 'IDLE'
    | 'WIZARD_BUY_RENT'
    | 'WIZARD_CITY'
    | 'WIZARD_BUDGET'
    | 'WIZARD_TYPE'
    | 'WIZARD_TIMELINE'
    | 'WIZARD_NAME'
    | 'WIZARD_PHONE'
    | 'BOOK_VISIT_DATE'
    | 'AI_MODE';
  intent?: 'BUY' | 'RENT' | 'SELL';
  city?: string;
  propertyType?: 'Flat' | 'Villa' | 'Plot' | 'Commercial';
  budgetMin?: number;
  budgetMax?: number;
  timeline?: 'IMMEDIATE' | 'ONE_MONTH' | 'THREE_MONTHS' | 'RESEARCHING';
  name?: string;
  phone?: string;
  selectedPropertyId?: string;
}

// In-Memory Session Store
export const sessions = new Map<string, UserSession>();

export function getSession(userId: string): UserSession {
  if (!sessions.has(userId)) {
    sessions.set(userId, { userId, step: 'IDLE' });
  }
  return sessions.get(userId)!;
}

export function resetSession(userId: string): UserSession {
  const newSession: UserSession = { userId, step: 'IDLE' };
  sessions.set(userId, newSession);
  return newSession;
}

/**
 * Lead Scoring Function
 * Computes a qualification score out of 100
 */
export function calculateLeadScore(session: UserSession): number {
  let score = 0;

  // 1. Timeline (Max 40 pts)
  if (session.timeline === 'IMMEDIATE') score += 40;
  else if (session.timeline === 'ONE_MONTH') score += 30;
  else if (session.timeline === 'THREE_MONTHS') score += 15;
  else if (session.timeline === 'RESEARCHING') score += 5;

  // 2. Budget Defined (Max 30 pts)
  if (session.budgetMax) {
    if (session.budgetMax >= 100) score += 30; // 1 Cr+
    else if (session.budgetMax >= 50) score += 25; // 50L - 1Cr
    else score += 15;
  }

  // 3. Complete Contact (Max 30 pts)
  if (session.name) score += 10;
  if (session.phone) score += 20;

  return score;
}

/**
 * Format Currency in Indian Numbering System
 */
export function formatPrice(lakhs: number): string {
  if (lakhs >= 100) {
    const cr = lakhs / 100;
    return `₹${cr.toFixed(1)} Cr`;
  }
  return `₹${lakhs} L`;
}

/**
 * Searches the DB based on search parameters
 */
export async function findMatchingProperties(criteria: {
  city?: string;
  propertyType?: string;
  budgetMax?: number;
  bhk?: number;
}) {
  const whereClause: any = {};

  if (criteria.city) {
    whereClause.city = { contains: criteria.city };
  }
  if (criteria.propertyType) {
    whereClause.type = criteria.propertyType;
  }
  if (criteria.budgetMax) {
    whereClause.price = { lte: criteria.budgetMax };
  }
  if (criteria.bhk) {
    whereClause.bhk = criteria.bhk;
  }

  return await prisma.property.findMany({
    where: whereClause,
    take: 3, // Recommend top 3 matching
  });
}

/**
 * Notify Real Estate Agents when a Hot Lead is captured
 */
export async function notifyAgents(bot: Telegraf<any> | null, lead: any, session: UserSession) {
  const groupChatId = process.env.AGENT_GROUP_CHAT_ID;
  
  const alertText = `🔥 **HOT LEAD GENERATED** 🔥\n\n` +
    `👤 **Name**: ${lead.name || 'Not provided'}\n` +
    `📞 **Phone**: ${lead.phone || 'Not provided'}\n` +
    `🎯 **Intent**: ${session.intent || 'BUY'}\n` +
    `📍 **Target City**: ${lead.city || 'Not provided'}\n` +
    `🏡 **Type**: ${lead.propertyType || 'Any'}\n` +
    `💰 **Budget**: Up to ${lead.budgetMax ? formatPrice(lead.budgetMax) : 'Not specified'}\n` +
    `⏱️ **Timeline**: ${lead.timeline || 'Researching'}\n` +
    `📈 **Lead Score**: ${lead.score}/100\n\n` +
    `⚡ *Agent should contact immediately!*`;

  console.log(`[Agent Alert System]: \n${alertText}`);

  if (bot && groupChatId && groupChatId !== 'YOUR_AGENT_GROUP_CHAT_ID') {
    try {
      await bot.telegram.sendMessage(groupChatId, alertText, { parse_mode: 'Markdown' });
      console.log(`[Agent Alert System] Sent notification alert to group chat ID: ${groupChatId}`);
    } catch (err) {
      console.error('[Agent Alert System Error] Failed to send telegram message to group:', err);
    }
  }
}

/**
 * Initialize Telegraf Bot listeners and setup flows
 */
export function setupBot(bot: Telegraf<any>) {
  // Command: Start / Welcome
  bot.start(async (ctx) => {
    const userId = String(ctx.from?.id);
    resetSession(userId);

    const welcomeMsg = `🏢 **Welcome to Aarna Estates AI Assistant!** 🏢\n\n` +
      `Aapki dream property dhoondhne me hum aapki help karenge. ` +
      `Aap niche diye buttons se search kar sakte hain, ya direct likh sakte hain, jaise:\n` +
      `*"Mujhe Patna me 3 BHK flat chahiye budget 80L"* 🤖✨\n\n` +
      `Aap kya dhoondh rahe hain?`;

    await ctx.replyWithMarkdown(
      welcomeMsg,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('Buy Property 🔑', 'action_buy'),
          Markup.button.callback('Rent Property 🏠', 'action_rent'),
        ],
        [
          Markup.button.callback('Sell Property 🏷️', 'action_sell'),
          Markup.button.callback('Ask AI Advisor 🤖', 'action_ai_advisor'),
        ],
      ])
    );
  });

  // Action: Main Menu buttons
  bot.action('action_buy', async (ctx) => {
    const userId = String(ctx.from?.id);
    const session = getSession(userId);
    session.intent = 'BUY';
    session.step = 'WIZARD_CITY';

    await ctx.answerCbQuery();
    await ctx.reply('👉 *Selected: Buy Property 🔑*', { parse_mode: 'Markdown' });
    await ctx.reply(
      'Great! Kis City me aap property search kar rahe hain?',
      Markup.inlineKeyboard([
        [Markup.button.callback('Patna 📍', 'city_Patna'), Markup.button.callback('Delhi 📍', 'city_Delhi')],
        [Markup.button.callback('Mumbai 📍', 'city_Mumbai'), Markup.button.callback('Bangalore 📍', 'city_Bangalore')],
      ])
    );
  });

  bot.action('action_rent', async (ctx) => {
    const userId = String(ctx.from?.id);
    const session = getSession(userId);
    session.intent = 'RENT';
    session.step = 'WIZARD_CITY';

    await ctx.answerCbQuery();
    await ctx.reply('👉 *Selected: Rent Property 🏠*', { parse_mode: 'Markdown' });
    await ctx.reply(
      'Aap kis City me property Rent par lena chahte hain?',
      Markup.inlineKeyboard([
        [Markup.button.callback('Patna 📍', 'city_Patna'), Markup.button.callback('Delhi 📍', 'city_Delhi')],
        [Markup.button.callback('Mumbai 📍', 'city_Mumbai'), Markup.button.callback('Bangalore 📍', 'city_Bangalore')],
      ])
    );
  });

  bot.action('action_sell', async (ctx) => {
    const userId = String(ctx.from?.id);
    const session = getSession(userId);
    session.intent = 'SELL';
    session.step = 'WIZARD_NAME';

    await ctx.answerCbQuery();
    await ctx.reply('👉 *Selected: Sell Property 🏷️*', { parse_mode: 'Markdown' });
    await ctx.reply('Zaroor! Aapki property sell karne me hum help karenge. Please apna Full Name batayein:');
  });

  bot.action('action_ai_advisor', async (ctx) => {
    const userId = String(ctx.from?.id);
    const session = getSession(userId);
    session.step = 'AI_MODE';

    await ctx.answerCbQuery();
    await ctx.reply('👉 *Selected: Ask AI Advisor 🤖*', { parse_mode: 'Markdown' });
    await ctx.reply(
      '🤖 **AI Real Estate Advisor Active** 🤖\n\n' +
        'Aap real estate investment ke baare me koi bhi sawaal puch sakte hain, jaise:\n' +
        '- *"Patna me investment ke liye best areas kaun se hain?"*\n' +
        '- *"Bihta me future growth potential kya hai?"*\n' +
        '- *"What is the average ROI in Danapur?"*\n\n' +
        'Puchhiye apna sawaal:'
    );
  });

  // Action: City Selection
  bot.action(/^city_(.+)$/, async (ctx) => {
    const city = ctx.match[1];
    const userId = String(ctx.from?.id);
    const session = getSession(userId);
    session.city = city;
    session.step = 'WIZARD_BUDGET';

    await ctx.answerCbQuery();
    await ctx.reply(`👉 *Selected City: ${city} 📍*`, { parse_mode: 'Markdown' });
    await ctx.reply(
      `Aapka Price Budget kya hai?`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('20 Lakhs - 50 Lakhs', 'budget_20_50'),
          Markup.button.callback('50 Lakhs - 1 Crore', 'budget_50_100'),
        ],
        [
          Markup.button.callback('1 Crore - 2 Crore', 'budget_100_200'),
          Markup.button.callback('2 Crore+', 'budget_200_9999'),
        ],
      ])
    );
  });

  // Action: Budget Selection
  bot.action(/^budget_(\d+)_(\d+)$/, async (ctx) => {
    const min = parseInt(ctx.match[1], 10);
    const max = parseInt(ctx.match[2], 10);
    const userId = String(ctx.from?.id);
    const session = getSession(userId);
    session.budgetMin = min;
    session.budgetMax = max;
    session.step = 'WIZARD_TYPE';

    let budgetText = '';
    if (max === 9999) budgetText = '2 Crore+';
    else if (max === 100) budgetText = '50 Lakhs - 1 Crore';
    else if (max === 200) budgetText = '1 Crore - 2 Crore';
    else budgetText = '20 Lakhs - 50 Lakhs';

    await ctx.answerCbQuery();
    await ctx.reply(`👉 *Selected Budget: ${budgetText} 💰*`, { parse_mode: 'Markdown' });
    await ctx.reply(
      'Aapko kis type ki property chahiye?',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('Flat 🏢', 'type_Flat'),
          Markup.button.callback('Villa 🏡', 'type_Villa'),
        ],
        [
          Markup.button.callback('Plot 🗺️', 'type_Plot'),
          Markup.button.callback('Commercial 💼', 'type_Commercial'),
        ],
      ])
    );
  });

  // Action: Property Type Selection
  bot.action(/^type_(.+)$/, async (ctx) => {
    const type = ctx.match[1] as any;
    const userId = String(ctx.from?.id);
    const session = getSession(userId);
    session.propertyType = type;
    session.step = 'WIZARD_TIMELINE';

    await ctx.answerCbQuery();
    await ctx.reply(`👉 *Selected Property Type: ${type} 🏡*`, { parse_mode: 'Markdown' });
    await ctx.reply(
      'Aap kab tak property kharidna/rent karna chahte hain (Timeline)?',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('Immediate (Under 1 Month) 🔥', 'time_IMMEDIATE'),
          Markup.button.callback('1 to 3 Months ⏱️', 'time_ONE_MONTH'),
        ],
        [
          Markup.button.callback('Just Researching 🔍', 'time_RESEARCHING'),
        ],
      ])
    );
  });

  // Action: Timeline Selection
  bot.action(/^time_(.+)$/, async (ctx) => {
    const timeline = ctx.match[1] as any;
    const userId = String(ctx.from?.id);
    const session = getSession(userId);
    session.timeline = timeline;
    session.step = 'WIZARD_NAME';

    let timeText = '';
    if (timeline === 'IMMEDIATE') timeText = 'Immediate (Under 1 Month) 🔥';
    else if (timeline === 'ONE_MONTH') timeText = '1 to 3 Months ⏱️';
    else timeText = 'Just Researching 🔍';

    await ctx.answerCbQuery();
    await ctx.reply(`👉 *Selected Timeline: ${timeText}*`, { parse_mode: 'Markdown' });
    await ctx.reply('Thank you! Please apna Full Name batayein:');
  });

  // Action: Book Visit Clicked
  bot.action(/^book_visit_(.+)$/, async (ctx) => {
    const propertyId = ctx.match[1];
    const userId = String(ctx.from?.id);
    const session = getSession(userId);
    session.selectedPropertyId = propertyId;
    session.step = 'BOOK_VISIT_DATE';

    await ctx.answerCbQuery();
    await ctx.reply(
      '📅 **Schedule Site Visit** 📅\n\nAap kis din visit karna chahenge?',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('Tomorrow', 'visit_day_tomorrow'),
          Markup.button.callback('This Saturday', 'visit_day_saturday'),
        ],
        [
          Markup.button.callback('This Sunday', 'visit_day_sunday'),
          Markup.button.callback('Custom Date (Type YYYY-MM-DD)', 'visit_day_custom'),
        ],
      ])
    );
  });

  // Action: Visit Day Selection
  bot.action(/^visit_day_(.+)$/, async (ctx) => {
    const choice = ctx.match[1];
    const userId = String(ctx.from?.id);
    const session = getSession(userId);
    await ctx.answerCbQuery();

    let visitText = '';
    if (choice === 'tomorrow') visitText = 'Tomorrow';
    else if (choice === 'saturday') visitText = 'This Saturday';
    else if (choice === 'sunday') visitText = 'This Sunday';
    else visitText = 'Custom Date';

    await ctx.reply(`👉 *Selected Visit Day: ${visitText} 📅*`, { parse_mode: 'Markdown' });

    if (choice === 'custom') {
      await ctx.reply('Please input date in YYYY-MM-DD format (example: 2026-06-05):');
      return;
    }

    let visitDate = new Date();
    if (choice === 'tomorrow') {
      visitDate.setDate(visitDate.getDate() + 1);
    } else if (choice === 'saturday') {
      const today = new Date().getDay();
      const diff = (6 - today + 7) % 7 || 7;
      visitDate.setDate(visitDate.getDate() + diff);
    } else if (choice === 'sunday') {
      const today = new Date().getDay();
      const diff = (7 - today + 7) % 7 || 7;
      visitDate.setDate(visitDate.getDate() + diff);
    }

    await saveVisitAndConfirm(ctx, session, visitDate);
  });

  // Action: General Callbacks (Brochure)
  bot.action(/^brochure_(.+)$/, async (ctx) => {
    const propertyId = ctx.match[1];
    await ctx.answerCbQuery();

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    }) as any;

    if (property) {
      await ctx.reply('📄 *Generating your personalized luxury 3-page brochure PDF... Please wait.*', { parse_mode: 'Markdown' });
      
      const brochureDir = './brochures';
      if (!fs.existsSync(brochureDir)) {
        fs.mkdirSync(brochureDir);
      }

      const brochurePath = `${brochureDir}/Brochure_${property.id}.pdf`;
      try {
        await generatePropertyBrochure(property, brochurePath);
        await ctx.replyWithDocument({ source: brochurePath }, {
          caption: `✨ **Aarna Estates Dynamic Portfolio Brochure** ✨\n\n🏢 **Property**: ${property.title}\n📍 **Location**: ${property.location}, ${property.city}\n\n*Aapka personalized 3-page digital brochure tayyar hai!*`,
          parse_mode: 'Markdown'
        });
      } catch (err) {
        console.error('[Brochure Generation Error]', err);
        await ctx.reply('Sorry, brochure generation failed. Please try again.');
      }
    } else {
      await ctx.reply('Sorry, property details not found.');
    }
  });

  // Handle all incoming Text Messages
  bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();
    const userId = String(ctx.from?.id);
    const session = getSession(userId);

    // 1. Wizard Flow - Name capture
    if (session.step === 'WIZARD_NAME') {
      session.name = text;
      session.step = 'WIZARD_PHONE';
      await ctx.reply(
        `Got it, ${text}. Please share your phone number. You can type it directly or share your contact info:`,
        Markup.keyboard([
          [Markup.button.contactRequest('Share Contact Card 📱')],
        ]).oneTime().resize()
      );
      return;
    }

    // 2. Wizard Flow - Phone capture
    if (session.step === 'WIZARD_PHONE') {
      session.phone = text;
      await finalizeLead(ctx, session, bot);
      return;
    }

    // 3. Custom Date Booking capture
    if (session.step === 'BOOK_VISIT_DATE') {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(text)) {
        await ctx.reply('Invalid date format. Please send in YYYY-MM-DD format (e.g. 2026-06-05):');
        return;
      }
      const visitDate = new Date(text);
      if (isNaN(visitDate.getTime())) {
        await ctx.reply('Invalid date. Please send a valid calendar date:');
        return;
      }
      await saveVisitAndConfirm(ctx, session, visitDate);
      return;
    }

    // 4. AI Advisory/Interactive Query Parsing (Default / Idle mode)
    // If user is in AI Advisory mode OR if it's natural chat query
    if (session.step === 'AI_MODE' || session.step === 'IDLE') {
      const isQuestion = text.includes('?') || 
        text.toLowerCase().includes('how') || 
        text.toLowerCase().includes('why') || 
        text.toLowerCase().includes('best area') || 
        text.toLowerCase().includes('growth') || 
        text.toLowerCase().includes('investment') || 
        text.toLowerCase().includes('roi') ||
        text.toLowerCase().includes('yield');

      if (isQuestion) {
        await ctx.reply('🤖 *Thinking... Analysis compile kar raha hoon...*', { parse_mode: 'Markdown' });
        const advice = await getRealEstateAdvice(text);
        await ctx.replyWithMarkdown(advice);
      } else {
        // Assume search query (e.g. "Patna 3 BHK flat under 80 Lakhs")
        await ctx.reply('🤖 *Analyzing query for property matching...*', { parse_mode: 'Markdown' });
        const parsed = await extractQueryEntities(text);
        
        console.log(`[AI Query Parse Result for "${text}"]:`, parsed);

        if (parsed.city || parsed.propertyType || parsed.budgetMax || parsed.bhk) {
          // Confirm what AI understood
          let matchText = `🤖 Mujhe aapki query se ye search parameters mile:\n`;
          if (parsed.city) matchText += `- 📍 **City**: ${parsed.city}\n`;
          if (parsed.propertyType) matchText += `- 🏡 **Property Type**: ${parsed.propertyType}\n`;
          if (parsed.bhk) matchText += `- 🛏️ **BHK**: ${parsed.bhk} BHK\n`;
          if (parsed.budgetMax) matchText += `- 💰 **Max Budget**: ${formatPrice(parsed.budgetMax)}\n`;

          await ctx.replyWithMarkdown(matchText);

          // Find matches
          const matches = await findMatchingProperties({
            city: parsed.city || undefined,
            propertyType: parsed.propertyType || undefined,
            budgetMax: parsed.budgetMax || undefined,
            bhk: parsed.bhk || undefined,
          });

          if (matches.length > 0) {
            await ctx.reply('🔍 **Matching Properties Found:**');
            for (const prop of matches) {
              await sendPropertyCard(ctx, prop);
            }
          } else {
            await ctx.reply(
              `Sorry, matching search conditions ke properties hamare database me abhi nahi hain.\n\n` +
              `Aap search criteria change kar sakte hain, ya humein apna number de sakte hain taaki hamari sales team direct consult kare!`,
              Markup.inlineKeyboard([
                [Markup.button.callback('Lead Guided Flow Start 🚀', 'action_buy')]
              ])
            );
          }
        } else {
          // AI couldn't parse structured entities and it wasn't a standard investment question
          await ctx.reply(
            `Hum aapka message samajh nahi paaye. ` +
            `Aap humse property options ke baare me puch sakte hain ya Guided search start kar sakte hain!`,
            Markup.inlineKeyboard([
              [Markup.button.callback('Guided Property Search 🔑', 'action_buy')],
              [Markup.button.callback('Ask AI Advisor 🤖', 'action_ai_advisor')]
            ])
          );
        }
      }
    }
  });

  // Handle Shared Contacts (Standard phone numbers sharing button)
  bot.on('contact', async (ctx) => {
    const userId = String(ctx.from?.id);
    const session = getSession(userId);

    if (session.step === 'WIZARD_PHONE') {
      session.phone = ctx.message.contact.phone_number;
      if (!session.name && ctx.message.contact.first_name) {
        session.name = `${ctx.message.contact.first_name} ${ctx.message.contact.last_name || ''}`.trim();
      }
      await finalizeLead(ctx, session, bot);
    }
  });
}

/**
 * Send Property listings as rich card (supporting single or carousel photo style)
 */
async function sendPropertyCard(ctx: any, prop: any) {
  const photos = prop.photos || [];
  const cardText = `🏢 **${prop.title}**\n` +
    `📍 **Location**: ${prop.location}, ${prop.city}\n` +
    `💰 **Price**: ${formatPrice(prop.price)}\n` +
    `🛏️ **Specs**: ${prop.bhk ? `${prop.bhk} BHK | ` : ''}${prop.areaSqFt} Sq.Ft.\n\n` +
    `📝 **Description**: ${prop.description}`;

  const inlineKeyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('Schedule Site Visit 📅', `book_visit_${prop.id}`),
      Markup.button.callback('Brochure PDF 📄', `brochure_${prop.id}`),
    ]
  ]);

  if (photos.length > 0) {
    try {
      await ctx.replyWithPhoto(photos[0], {
        caption: cardText,
        parse_mode: 'Markdown',
        ...inlineKeyboard,
      });
    } catch (err) {
      // Photo loading fails (fallback to normal text)
      await ctx.replyWithMarkdown(cardText, inlineKeyboard);
    }
  } else {
    await ctx.replyWithMarkdown(cardText, inlineKeyboard);
  }
}

/**
 * Handle lead collection completion
 */
async function finalizeLead(ctx: any, session: UserSession, bot: Telegraf<any>) {
  // Remove share contact keyboard
  await ctx.reply('Processing your profile...', Markup.removeKeyboard());

  const score = calculateLeadScore(session);

  // Save to DB
  let lead;
  try {
    lead = await prisma.lead.upsert({
      where: { telegramId: session.userId },
      update: {
        name: session.name,
        phone: session.phone,
        city: session.city,
        budgetMin: session.budgetMin,
        budgetMax: session.budgetMax,
        propertyType: session.propertyType,
        timeline: session.timeline,
        score: score,
        status: 'NEW',
      },
      create: {
        telegramId: session.userId,
        name: session.name,
        phone: session.phone,
        city: session.city,
        budgetMin: session.budgetMin,
        budgetMax: session.budgetMax,
        propertyType: session.propertyType,
        timeline: session.timeline || 'RESEARCHING',
        score: score,
        status: 'NEW',
      },
    });
  } catch (err) {
    console.error('[DB Error] Failed to save lead:', err);
    // Create mock lead object for testing compatibility
    lead = {
      name: session.name,
      phone: session.phone,
      city: session.city,
      budgetMax: session.budgetMax,
      propertyType: session.propertyType,
      timeline: session.timeline,
      score: score,
    };
  }

  const userAlert = `🎉 **Profile Registration Successful!** 🎉\n\n` +
    `Aapki real estate preferences register ho gayi hain:\n` +
    `- **Name**: ${session.name}\n` +
    `- **Phone**: ${session.phone}\n\n` +
    `Hum matching listings fetch kar rahe hain...`;

  await ctx.replyWithMarkdown(userAlert);

  // Trigger agent alert if it's a HOT lead
  if (score >= 70) {
    await notifyAgents(bot, lead, session);
  }

  // Fetch Recommended matching properties
  const matches = await findMatchingProperties({
    city: session.city,
    propertyType: session.propertyType,
    budgetMax: session.budgetMax,
  });

  if (matches.length > 0) {
    await ctx.reply('🔍 **Hamari AI Recommended Properties:**');
    for (const prop of matches) {
      await sendPropertyCard(ctx, prop);
    }
  } else {
    // If no exact match, show a general greeting
    await ctx.reply(
      `Shukriya! Humne aapke preferences save kar liye hain. ` +
      `Hamara sales agent aapse jaldi contact karega aur best matches share karega.`
    );
  }

  session.step = 'IDLE'; // Return to idle
}

/**
 * Save Site Visit booking and display confirmation
 */
async function saveVisitAndConfirm(ctx: any, session: UserSession, visitDate: Date) {
  if (!session.selectedPropertyId) {
    await ctx.reply('Session mismatch error. Please start again with /start.');
    session.step = 'IDLE';
    return;
  }

  const propId = session.selectedPropertyId;
  
  // 1. Get/Upsert Lead in DB
  let lead = await prisma.lead.findUnique({
    where: { telegramId: session.userId }
  });

  if (!lead) {
    // Create simple lead if they haven't run guided flow but clicked book visit
    lead = await prisma.lead.create({
      data: {
        telegramId: session.userId,
        name: ctx.from?.first_name || 'User',
        status: 'NEW',
        score: 30,
      }
    });
  }

  // 2. Create Visit
  let visit;
  try {
    visit = await prisma.visit.create({
      data: {
        leadId: lead.id,
        propertyId: propId,
        visitDate: visitDate,
        status: 'SCHEDULED'
      },
      include: {
        property: true
      }
    });
  } catch (err) {
    console.error('[DB Error] Failed to create visit:', err);
    // Mock for demo
    const prop = await prisma.property.findUnique({ where: { id: propId } });
    visit = {
      property: prop,
      visitDate: visitDate
    };
  }

  const formattedDate = visitDate.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  await ctx.replyWithMarkdown(
    `✅ **Site Visit Scheduled!** ✅\n\n` +
    `🏢 **Property**: ${visit.property?.title}\n` +
    `📅 **Date**: ${formattedDate}\n\n` +
    `Humne aapki site visit book kar li hai. Hamara property consultant aapko directions aur guidelines ke liye call karega. Thank you!`
  );

  // Notify Agents about the scheduled visit
  const groupChatId = process.env.AGENT_GROUP_CHAT_ID;
  const agentAlertText = `📅 **NEW SITE VISIT BOOKED** 📅\n\n` +
    `👤 **Lead Name**: ${lead.name || 'User'}\n` +
    `📞 **Lead Phone**: ${lead.phone || 'Not provided'}\n` +
    `🏢 **Property**: ${visit.property?.title}\n` +
    `📍 **Location**: ${visit.property?.location}, ${visit.property?.city}\n` +
    `📅 **Date**: ${formattedDate}\n`;

  console.log(`[Agent Site Visit Alert]: \n${agentAlertText}`);

  if (groupChatId && groupChatId !== 'YOUR_AGENT_GROUP_CHAT_ID') {
    try {
      await ctx.telegram.sendMessage(groupChatId, agentAlertText);
    } catch (err) {
      console.error('[Agent Visit Alert Error] Failed to notify agent:', err);
    }
  }

  session.step = 'IDLE';
}
