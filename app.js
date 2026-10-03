
import 'dotenv/config';
import { Telegraf } from 'telegraf';
import express from 'express';
import cron from 'node-cron';
import fs from 'fs';
import { timingSafeEqual } from 'crypto';
import { initMemory, saveMemory, loadMemory, listMemoryKeys } from './lib/memory.js';
import { queryGemini, getGeminiStatus } from './lib/ollama.js';
import { sendDailyBrief } from './lib/brief.js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENCLAW_CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH || '/app/config/openclaw.json';
const OPENCLAW_MEMORY_PATH = process.env.OPENCLAW_MEMORY_PATH || '/data/memory';
const OPENCLAW_SKILLS_PATH = process.env.OPENCLAW_SKILLS_PATH || './skills';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const CRON_SECRET = process.env.CRON_SECRET || '';

// Load configuration
let config = {};
try {
  const configContent = fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8');
  config = JSON.parse(configContent);
} catch (error) {
  console.warn(`⚠️  Could not load config from ${OPENCLAW_CONFIG_PATH}: ${error.message}`);
  config = { scheduling: { defaultDailyBriefTime: '21:00' } };
}

if (!TELEGRAM_BOT_TOKEN) {
  console.error('ERROR: TELEGRAM_BOT_TOKEN is not set in .env');
  process.exit(1);
}

await initMemory(OPENCLAW_MEMORY_PATH);
const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
const app = express();
app.use(express.json());

console.log(`🚀 OpenClaw Learning Assistant v1.0.0`);
console.log(`📱 Telegram Bot Token: ${TELEGRAM_BOT_TOKEN.slice(0, 10)}...`);
console.log(`🤖 Gemini Model: ${process.env.GEMINI_MODEL || 'gemini-3.8-flash'}`);
console.log(`💾 Memory Path: ${OPENCLAW_MEMORY_PATH}`);
console.log(`📚 Skills Path: ${OPENCLAW_SKILLS_PATH}`);

// ─────────────────────────────────────────────────────────────────
// Telegram Bot Handlers
// ─────────────────────────────────────────────────────────────────

bot.start(async (ctx) => {
  try {
    const userId = ctx.from.id;
    const userProfile = await loadMemory(`user:${userId}`) || {};

    if (!userProfile.onboarded) {
      ctx.reply(
        '👋 Welcome to OpenClaw Learning Assistant!\n\n' +
        'I\'ll help you stay sharp with daily tech briefs and interview questions.\n\n' +
        'Let\'s start with a quick onboarding...\n\n' +
        'What\'s your name?'
      );
      userProfile.onboarding_step = 1;
      await saveMemory(`user:${userId}`, userProfile);
    } else {
      // Existing user - show profile options
      const briefTime = formatBriefTime();
      const profileInfo = 
        `📋 Your Profile:\n` +
        `👤 Name: ${userProfile.name}\n` +
        `🎯 Level: ${userProfile.level}\n` +
        `📚 Interests: ${userProfile.interests?.join(', ') || 'None set'}\n` +
        `🕐 Timezone: ${userProfile.timezone}\n` +
        `⏰ Brief Time: ${briefTime}\n\n` +
        `What would you like to do?`;
      
      await ctx.reply(profileInfo, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✏️ Edit Profile', callback_data: 'edit_profile' }],
            [{ text: '🔄 Start Fresh Onboarding', callback_data: 'restart_onboarding' }],
            [{ text: '✅ Keep Current Settings', callback_data: 'keep_settings' }]
          ]
        }
      });
    }
  } catch (error) {
    console.error('Error in start command:', error);
    ctx.reply('Sorry, an error occurred. Please try again later.').catch(e => {
      console.error('Failed to send error message:', e);
    });
  }
});

bot.on('text', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    
    // Skip if it's a command (starts with /)
    if (text.startsWith('/')) {
      return; // Let command handlers take over
    }
    
    let userProfile = await loadMemory(`user:${userId}`) || {};
    console.log(`Saved memory: user:${userId}`);

    // Handle profile editing
    if (userProfile.editing_field) {
      return handleProfileEdit(ctx, userId, text, userProfile);
    }

    // Handle onboarding flow
    if (!userProfile.onboarded) {
      return handleOnboarding(ctx, userId, text, userProfile);
    }

    // Regular chat
    ctx.reply('🤔 ...');
    try {
      const response = await queryGemini(
        `Keep your response short and direct. ${text}`
      );
      if (response && response.trim()) {
        ctx.reply(response);
      } else {
        ctx.reply('Sorry, I got an empty response. Try again.');
      }
    } catch (error) {
      console.error('Error querying Gemini:', error.message);
      
      if (error.message.includes('not yet downloaded')) {
        ctx.reply('⏳ Model still downloading. Check back in a few minutes.');
      } else if (error.message.includes('Cannot reach')) {
        ctx.reply('❌ AI engine not responding.');
      } else {
        ctx.reply('❌ Error: ' + error.message);
      }
    }
  } catch (error) {
    console.error('Error processing text message:', error);
    try {
      ctx.reply('❌ Sorry, an error occurred. Please try again.');
    } catch (replyError) {
      console.error('Failed to send error message:', replyError);
    }
  }
});

bot.command('brief', async (ctx) => {
  try {
    ctx.reply('📚 Generating your tech brief...');
    const userId = ctx.from.id;
    const userProfile = await loadMemory(`user:${userId}`) || {};
    
    if (!userProfile.onboarded) {
      return ctx.reply('Please complete onboarding first with /start');
    }

    try {
      await sendDailyBrief({ sendMessage: bot.telegram.sendMessage.bind(bot.telegram), userId, userProfile });
      ctx.reply('✅ Brief sent!');
    } catch (error) {
      console.error('Error generating brief:', error.message);
      ctx.reply('❌ Error generating brief: ' + error.message);
    }
  } catch (error) {
    console.error('Error in brief command:', error);
    ctx.reply('❌ Sorry, an error occurred. Please try again.').catch(e => {
      console.error('Failed to send error message:', e);
    });
  }
});

bot.command('status', async (ctx) => {
  try {
    const status = await getGeminiStatus();
    ctx.reply(
      '📊 System Status:\n' +
      `✅ Bot: Online\n` +
      `🤖 Gemini: ${status.ready ? 'Ready' : 'Unavailable'}\n` +
      `💾 Memory: OK\n` +
      `Model: ${status.model}`
    );
  } catch (error) {
    ctx.reply('⚠️ Gemini connection error: ' + error.message);
  }
});

// ─────────────────────────────────────────────────────────────────
// Profile Editing Callbacks
// ─────────────────────────────────────────────────────────────────

bot.action('edit_profile', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const userProfile = await loadMemory(`user:${userId}`) || {};
    
    await ctx.reply(
      '✏️ Edit Your Profile\n\n' +
      'Which field would you like to update?',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '👤 Name', callback_data: 'edit_name' }],
            [{ text: '🎯 Experience Level', callback_data: 'edit_level' }],
            [{ text: '📚 Interests', callback_data: 'edit_interests' }],
            [{ text: '🕐 Timezone', callback_data: 'edit_timezone' }],
            [{ text: '❌ Cancel', callback_data: 'cancel_edit' }]
          ]
        }
      }
    );
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in edit_profile:', error);
    ctx.answerCbQuery('An error occurred. Please try again.');
  }
});

bot.action('edit_name', async (ctx) => {
  try {
    const userId = ctx.from.id;
    let userProfile = await loadMemory(`user:${userId}`) || {};
    userProfile.editing_field = 'name';
    await saveMemory(`user:${userId}`, userProfile);
    
    await ctx.reply('What\'s your new name?');
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in edit_name:', error);
    ctx.answerCbQuery('An error occurred. Please try again.');
  }
});

bot.action('edit_level', async (ctx) => {
  try {
    const userId = ctx.from.id;
    let userProfile = await loadMemory(`user:${userId}`) || {};
    userProfile.editing_field = 'level';
    await saveMemory(`user:${userId}`, userProfile);
    
    await ctx.reply(
      'What\'s your experience level?\n1. Beginner\n2. Intermediate\n3. Advanced'
    );
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in edit_level:', error);
    ctx.answerCbQuery('An error occurred. Please try again.');
  }
});

bot.action('edit_interests', async (ctx) => {
  try {
    const userId = ctx.from.id;
    let userProfile = await loadMemory(`user:${userId}`) || {};
    userProfile.editing_field = 'interests';
    await saveMemory(`user:${userId}`, userProfile);
    
    await ctx.reply(
      'What are your main technical interests? (comma-separated)\nExample: JavaScript, React, AWS, Kubernetes'
    );
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in edit_interests:', error);
    ctx.answerCbQuery('An error occurred. Please try again.');
  }
});

bot.action('edit_timezone', async (ctx) => {
  try {
    const userId = ctx.from.id;
    let userProfile = await loadMemory(`user:${userId}`) || {};
    userProfile.editing_field = 'timezone';
    await saveMemory(`user:${userId}`, userProfile);
    
    await ctx.reply('What timezone are you in? (e.g., UTC, EST, PST, IST)');
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in edit_timezone:', error);
    ctx.answerCbQuery('An error occurred. Please try again.');
  }
});

bot.action('restart_onboarding', async (ctx) => {
  try {
    const userId = ctx.from.id;
    let userProfile = await loadMemory(`user:${userId}`) || {};
    
    userProfile.onboarded = false;
    userProfile.onboarding_step = 1;
    await saveMemory(`user:${userId}`, userProfile);
    
    await ctx.reply(
      '🔄 Starting fresh onboarding...\n\n' +
      'What\'s your name?'
    );
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in restart_onboarding:', error);
    ctx.answerCbQuery('An error occurred. Please try again.');
  }
});

bot.action('keep_settings', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const userProfile = await loadMemory(`user:${userId}`) || {};
    const briefTime = formatBriefTime();
    
    await ctx.reply(
      `✅ All set!\n\n` +
      `Your daily tech brief will arrive at ${briefTime} ${userProfile.timezone} time.\n\n` +
      `Commands:\n` +
      `/brief - Get your brief now\n` +
      `/status - Check system status\n` +
      `/start - Edit profile`
    );
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in keep_settings:', error);
    ctx.answerCbQuery('An error occurred. Please try again.');
  }
});

bot.action('cancel_edit', async (ctx) => {
  try {
    const userId = ctx.from.id;
    let userProfile = await loadMemory(`user:${userId}`) || {};
    userProfile.editing_field = null;
    await saveMemory(`user:${userId}`, userProfile);
    
    const briefTime = formatBriefTime();
    await ctx.reply(
      `✅ Profile edit cancelled.\n\n` +
      `Your current settings remain unchanged. Your daily brief arrives at ${briefTime}.`
    );
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in cancel_edit:', error);
    ctx.answerCbQuery('An error occurred. Please try again.');
  }
});

// ─────────────────────────────────────────────────────────────────
// Profile Editing Flow
// ─────────────────────────────────────────────────────────────────

async function handleProfileEdit(ctx, userId, text, userProfile) {
  const field = userProfile.editing_field;

  switch (field) {
    case 'name':
      userProfile.name = text;
      userProfile.editing_field = null;
      await saveMemory(`user:${userId}`, userProfile);
      ctx.reply(`✅ Name updated to: ${text}`);
      showEditMenu(ctx);
      break;

    case 'level':
      const levels = { '1': 'beginner', '2': 'intermediate', '3': 'advanced' };
      const trimmedLevel = text.trim().toLowerCase();
      
      if (!levels[trimmedLevel]) {
        ctx.reply('❌ Please select 1 (Beginner), 2 (Intermediate), or 3 (Advanced)');
        return;
      }
      
      userProfile.level = levels[trimmedLevel];
      userProfile.editing_field = null;
      await saveMemory(`user:${userId}`, userProfile);
      ctx.reply(`✅ Experience level updated to: ${userProfile.level}`);
      showEditMenu(ctx);
      break;

    case 'interests':
      userProfile.interests = text.split(',').map(i => i.trim());
      userProfile.editing_field = null;
      await saveMemory(`user:${userId}`, userProfile);
      ctx.reply(`✅ Interests updated to: ${userProfile.interests.join(', ')}`);
      showEditMenu(ctx);
      break;

    case 'timezone':
      userProfile.timezone = normalizeTimezone(text);
      userProfile.editing_field = null;
      await saveMemory(`user:${userId}`, userProfile);
      ctx.reply(`✅ Timezone updated to: ${userProfile.timezone}`);
      showEditMenu(ctx);
      break;

    default:
      ctx.reply('❌ Unknown edit field');
  }
}

async function showEditMenu(ctx) {
  await ctx.reply('What else would you like to edit?', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '👤 Name', callback_data: 'edit_name' }],
        [{ text: '🎯 Experience Level', callback_data: 'edit_level' }],
        [{ text: '📚 Interests', callback_data: 'edit_interests' }],
        [{ text: '🕐 Timezone', callback_data: 'edit_timezone' }],
        [{ text: '✅ Done', callback_data: 'keep_settings' }]
      ]
    }
  });
}

// ─────────────────────────────────────────────────────────────────
// Onboarding Flow
// ─────────────────────────────────────────────────────────────────

async function handleOnboarding(ctx, userId, text, userProfile) {
  const step = userProfile.onboarding_step || 1;

  switch (step) {
    case 1:
      // Get name
      userProfile.name = text;
      userProfile.onboarding_step = 2;
      await saveMemory(`user:${userId}`, userProfile);
      ctx.reply(`Nice to meet you, ${text}! 😊\n\nWhat's your experience level?\n1. Beginner\n2. Intermediate\n3. Advanced`);
      break;

    case 2:
      // Get level
      const levels = { '1': 'beginner', '2': 'intermediate', '3': 'advanced' };
      const trimmedLevel = text.trim().toLowerCase();
      
      if (!levels[trimmedLevel]) {
        ctx.reply('❌ Please select 1 (Beginner), 2 (Intermediate), or 3 (Advanced)');
        return;
      }
      
      userProfile.level = levels[trimmedLevel];
      userProfile.onboarding_step = 3;
      await saveMemory(`user:${userId}`, userProfile);
      ctx.reply(
        `${userProfile.level.toUpperCase()} level, got it! 🎯\n\n` +
        `What are your main technical interests? (comma-separated)\n` +
        `Example: JavaScript, React, AWS, Kubernetes`
      );
      break;

    case 3:
      // Get interests
      userProfile.interests = text.split(',').map(i => i.trim());
      userProfile.onboarding_step = 4;
      await saveMemory(`user:${userId}`, userProfile);
      const briefTime = formatBriefTime();
      ctx.reply(
        `Great! Your interests: ${userProfile.interests.join(', ')} 🚀\n\n` +
        `What timezone are you in? (e.g., UTC, EST, PST, IST)\n` +
        `(I'll send your daily brief at ${briefTime} your time)`
      );
      break;

    case 4:
      // Get timezone
      userProfile.timezone = text.toUpperCase();
      userProfile.onboarded = true;
      userProfile.created_at = new Date().toISOString();
      await saveMemory(`user:${userId}`, userProfile);
      const briefTime = formatBriefTime();
      ctx.reply(
        `🎉 Onboarding complete, ${userProfile.name}!\n\n` +
        `You're all set! Your daily tech brief will arrive at ${briefTime} ${userProfile.timezone} time.\n\n` +
        `Commands:\n` +
        `/brief - Get your brief now\n` +
        `/status - Check system status\n` +
        `/start - Edit profile`
      );
      break;
  }
}

// ─────────────────────────────────────────────────────────────────
// Daily Brief Generation
// ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────
// Cron Scheduling
// ─────────────────────────────────────────────────────────────────

function normalizeTimezone(value) {
  const input = value.trim();
  const aliases = {
    IST: 'Asia/Kolkata', UTC: 'UTC', GMT: 'UTC',
    EST: 'America/New_York', EDT: 'America/New_York',
    CST: 'America/Chicago', CDT: 'America/Chicago',
    MST: 'America/Denver', MDT: 'America/Denver',
    PST: 'America/Los_Angeles', PDT: 'America/Los_Angeles',
  };
  const timezone = aliases[input.toUpperCase()] || input;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    return timezone;
  } catch {
    return 'UTC';
  }
}

function getLocalTime(timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const result = {};
  for (const part of parts) if (part.type !== 'literal') result[part.type] = part.value;
  return {
    date: result.year + '-' + result.month + '-' + result.day,
    minutes: Number(result.hour) * 60 + Number(result.minute),
  };
}

async function runDueBriefs() {
  const timeStr = process.env.DAILY_BRIEF_TIME || config?.scheduling?.defaultDailyBriefTime || '21:00';
  const [targetHour, targetMinute] = timeStr.split(':').map(Number);
  const targetMinutes = targetHour * 60 + targetMinute;
  const keys = await listMemoryKeys();

  for (const key of keys) {
    if (!key.startsWith('user:')) continue;
    const userId = Number(key.slice(5));
    const userProfile = await loadMemory(key);
    if (!userProfile?.onboarded) continue;

    const timezone = normalizeTimezone(userProfile.timezone || 'UTC');
    const local = getLocalTime(timezone);
    let elapsed = local.minutes - targetMinutes;
    let briefDate = local.date;

    if (elapsed < 0) {
      elapsed += 1440;
      const previous = new Date(local.date + 'T00:00:00Z');
      previous.setUTCDate(previous.getUTCDate() - 1);
      briefDate = previous.toISOString().slice(0, 10);
    }

    if (elapsed > 5 || userProfile.last_brief_date === briefDate) continue;

    try {
      await sendDailyBrief({ sendMessage: bot.telegram.sendMessage.bind(bot.telegram), userId, userProfile });
      userProfile.last_brief_date = briefDate;
      await saveMemory(key, userProfile);
      console.log('✅ Scheduled brief sent to ' + userId + ' (' + timezone + ')');
    } catch (error) {
      console.error('❌ Failed scheduled brief for ' + userId + ':', error.message);
    }
  }
}

cron.schedule('*/5 * * * *', runDueBriefs);
const WEBHOOK_PATH = '/telegram/webhook';

app.use(WEBHOOK_PATH, (req, res, next) => {
  if (TELEGRAM_WEBHOOK_SECRET) {
    const received = req.get('X-Telegram-Bot-Api-Secret-Token') || '';
    if (received.length !== TELEGRAM_WEBHOOK_SECRET.length ||
        !timingSafeEqual(Buffer.from(received), Buffer.from(TELEGRAM_WEBHOOK_SECRET))) {
      return res.status(401).send('Unauthorized');
    }
  }
  return bot.webhookCallback(WEBHOOK_PATH)(req, res, next);
});
// ─────────────────────────────────────────────────────────────────
// Express API
// ─────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

app.get('/api/status', async (req, res) => {
  try {
    const status = await getGeminiStatus();
    res.json({
      bot: 'online',
      gemini: status.ready ? 'ready' : 'unavailable',
      model: status.model
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// Startup
// ─────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT) || 3000;
const IS_RENDER = process.env.RENDER === 'true' || Boolean(process.env.RENDER_EXTERNAL_URL);

app.listen(PORT, '0.0.0.0', async () => {
  console.log('🌐 API server listening on port ' + PORT);

  if (IS_RENDER && process.env.RENDER_EXTERNAL_URL) {
    const webhookUrl = process.env.RENDER_EXTERNAL_URL + WEBHOOK_PATH;
    const webhookOptions = TELEGRAM_WEBHOOK_SECRET ? { secret_token: TELEGRAM_WEBHOOK_SECRET } : {};
    try {
      await bot.telegram.setWebhook(webhookUrl, webhookOptions);
      console.log('✅ Telegram webhook configured');
    } catch (error) {
      console.error('❌ Failed to configure Telegram webhook:', error.message);
    }
  } else {
    bot.launch({ polling: { interval: 300, timeout: 30 } }).then(() => {
      console.log('✅ Telegram bot polling started');
    });
  }
});
// ─────────────────────────────────────────────────────────────────
// Global Error Handlers
// ─────────────────────────────────────────────────────────────────

// Handle bot errors
bot.catch((err, ctx) => {
  console.error('❌ Bot Error:', err);
  if (ctx && ctx.chat) {
    ctx.reply('Sorry, something went wrong. Please try again later.').catch(e => {
      console.error('Failed to send error message:', e);
    });
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('🛑 Shutting down...');
  bot.stop('SIGINT');
  process.exit(0);
});

process.once('SIGTERM', () => {
  console.log('🛑 Shutting down...');
  bot.stop('SIGTERM');
  process.exit(0);
});

export { bot, app };
