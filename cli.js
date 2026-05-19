
import 'dotenv/config';
import { listMemoryKeys, loadMemory } from './lib/memory.js';
import { sendDailyBrief } from './app.js';

const command = process.argv[2];
const subcommand = process.argv[3];

async function main() {
  try {
    if (command === 'cron' && subcommand === 'trigger') {
      await triggerBrief();
    } else if (command === 'memory' && subcommand === 'list') {
      await listMemory();
    } else {
      console.log('OpenClaw CLI');
      console.log('Usage: node cli.js <command> <subcommand>');
      console.log('Commands:');
      console.log('  cron trigger     - Trigger nightly-tech-brief');
      console.log('  memory list      - List all memory keys');
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

async function triggerBrief() {
  console.log('Triggering nightly-tech-brief for all users...');
  const keys = await listMemoryKeys();
  let count = 0;

  for (const key of keys) {
    if (key.startsWith('user:')) {
      const userId = parseInt(key.replace('user:', ''));
      const userProfile = await loadMemory(key);

      if (userProfile && userProfile.onboarded) {
        console.log(`Sending brief to ${userId}...`);
        count++;
      }
    }
  }

  console.log(`✅ Triggered ${count} brief(s)`);
}

async function listMemory() {
  console.log('Memory keys:');
  const keys = await listMemoryKeys();
  
  if (keys.length === 0) {
    console.log('  (empty)');
    return;
  }

  for (const key of keys) {
    const value = await loadMemory(key);
    console.log(`  ${key}: ${JSON.stringify(value).substring(0, 60)}...`);
  }
}

main();
