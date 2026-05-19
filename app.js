
import 'dotenv/config';
import { Telegraf } from 'telegraf';
import express from 'express';
import cron from 'node-cron';
import fs from 'fs';
import { initMemory, saveMemory, loadMemory, listMemoryKeys } from './lib/memory.js';
import { queryOllama, getOllamaStatus } from './lib/ollama.js';
import { webSearch, fetchContent } from './lib/search.js';
import { loadSkill, runSkill } from './lib/skills.js';
import { generateQuestions, generateTidbits } from './lib/generation.js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OPENCLAW_CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH || '/app/config/openclaw.json';
const OPENCLAW_MEMORY_PATH = process.env.OPENCLAW_MEMORY_PATH || '/data/memory';
const OPENCLAW_SKILLS_PATH = process.env.OPENCLAW_SKILLS_PATH || './skills';

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
console.log(`🤖 Ollama Host: ${OLLAMA_HOST}`);
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
      const response = await queryOllama(
        `Keep your response short and direct. ${text}`
      );
      if (response && response.trim()) {
        ctx.reply(response);
      } else {
        ctx.reply('Sorry, I got an empty response. Try again.');
      }
    } catch (error) {
      console.error('Error querying Ollama:', error.message);
      
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
      await sendDailyBrief(userId, userProfile);
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
    const status = await getOllamaStatus();
    ctx.reply(
      '📊 System Status:\n' +
      `✅ Bot: Online\n` +
      `🤖 Ollama: ${status.models.length > 0 ? 'Ready' : 'No models'}\n` +
      `💾 Memory: OK\n` +
      `Models available: ${status.models.map(m => m.name).join(', ') || 'None'}`
    );
  } catch (error) {
    ctx.reply('⚠️ Ollama connection error: ' + error.message);
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
      userProfile.timezone = text.toUpperCase();
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
      // const briefTime = formatBriefTime();
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

async function sendDailyBrief(userId, userProfile) {
  const interests = userProfile.interests || ['JavaScript', 'Node.js'];
  
  // Search for recent content on each interest
  const allArticles = [];
  for (const interest of interests) {
    try {
      const results = await webSearch(`${interest} latest news 2025`);
      allArticles.push(...results);
    } catch (err) {
      console.warn(`Search failed for ${interest}:`, err.message);
    }
  }

  // Generate tidbits
  const tidbits = await generateTidbits(allArticles, userProfile);
  
  // Generate questions
  const questions = await generateQuestions(userProfile, tidbits);

  // Format message
  const message =
    `📚 Daily Tech Brief — ${new Date().toLocaleDateString()}\n\n` +
    `🔥 Today's Tidbits:\n${tidbits.map((t, i) => `${i + 1}. ${t}`).join('\n\n')}\n\n` +
    `❓ Interview Questions:\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n\n')}`;

  await bot.telegram.sendMessage(userId, message);
}

// ─────────────────────────────────────────────────────────────────
// Cron Scheduling
// ─────────────────────────────────────────────────────────────────

// Format brief time for display
function formatBriefTime() {
  const defaultTime = config?.scheduling?.defaultDailyBriefTime || '21:00';
  const timeStr = process.env.DAILY_BRIEF_TIME || defaultTime;
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  if (isNaN(hours) || isNaN(minutes)) {
    return '9 PM'; // Fallback
  }
  
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes > 0 ? `:${minutes.toString().padStart(2, '0')}` : '';
  return `${displayHours}${displayMinutes} ${ampm}`;
}

// Parse the daily brief time
function getCronSchedule() {
  const defaultTime = config?.scheduling?.defaultDailyBriefTime || '21:00';
  const timeStr = process.env.DAILY_BRIEF_TIME || defaultTime;
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    console.warn(`⚠️  Invalid DAILY_BRIEF_TIME: ${timeStr}. Using configured default (${defaultTime})`);
    const [defHours, defMinutes] = defaultTime.split(':').map(Number);
    return `${defMinutes} ${defHours} * * *`;
  }
  
  const cronTime = `${minutes} ${hours} * * *`;
  console.log(`📅 Daily brief scheduled for: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} (${cronTime})`);
  return cronTime;
}

const cronSchedule = getCronSchedule();

// Every day at the scheduled time
cron.schedule(cronSchedule, async () => {
  console.log('⏰ Running scheduled ...');
  
  const userKeys = await listMemoryKeys();
  for (const key of userKeys) {
    if (key.startsWith('user:')) {
      const userId = parseInt(key.replace('user:', ''));
      const userProfile = await loadMemory(key);
      
      if (userProfile.onboarded) {
        try {
          await sendDailyBrief(userId, userProfile);
          console.log(`✅ Brief sent to ${userId}`);
        } catch (error) {
          console.error(`❌ Failed to send brief to ${userId}:`, error.message);
        }
      }
    }
  }
});

// ─────────────────────────────────────────────────────────────────
// Express API
// ─────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

app.get('/api/status', async (req, res) => {
  try {
    const status = await getOllamaStatus();
    res.json({
      bot: 'online',
      ollama: status.models.length > 0 ? 'ready' : 'no-models',
      models: status.models.map(m => m.name)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// Startup
// ─────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

// Start Express server
app.listen(PORT, () => {
  console.log(`🌐 API server listening on port ${PORT}`);
});

// Start Telegram bot
bot.launch({
  polling: {
    interval: 300,
    timeout: 30,
  }
}).then(() => {
  console.log('✅ Telegram bot polling started');
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
