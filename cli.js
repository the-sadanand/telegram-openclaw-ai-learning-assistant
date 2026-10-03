#!/usr/bin/env node

import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { initMemory, listMemoryKeys, loadMemory } from './lib/memory.js';
import { sendDailyBrief } from './lib/brief.js';

async function triggerBrief() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is required');
  }

  await initMemory(process.env.OPENCLAW_MEMORY_PATH || '/data/memory');

  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
  const sendMessage = bot.telegram.sendMessage.bind(bot.telegram);
  const keys = await listMemoryKeys();
  let sent = 0;

  for (const key of keys) {
    if (!key.startsWith('user:')) continue;

    const userId = Number(key.slice(5));
    const profile = await loadMemory(key);
    if (!profile?.onboarded) continue;

    await sendDailyBrief({ sendMessage, userId, userProfile: profile });
    sent++;
  }

  console.log('Sent ' + sent + ' daily brief(s).');
}

async function main() {
  const command = process.argv[2];

  if (command === 'trigger-brief') {
    await triggerBrief();
    return;
  }

  console.log('OpenClaw Learning Assistant CLI');
  console.log('');
  console.log('Commands:');
  console.log('  trigger-brief   Send a daily brief to all onboarded users');
}

main().catch(error => {
  console.error('❌', error.message);
  process.exit(1);
});
