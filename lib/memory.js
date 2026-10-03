/**
 * Memory abstraction layer.
 * Uses Upstash Redis when configured; otherwise uses local files.
 */

import fs from 'fs/promises';
import path from 'path';
import { Redis } from '@upstash/redis';

let MEMORY_PATH = '/data/memory';
let redis = null;
let useRedis = false;
const KEY_SET = 'openclaw:memory:keys';

export async function initMemory(memoryPath) {
  MEMORY_PATH = memoryPath;
  const hasRedisUrl = Boolean(process.env.UPSTASH_REDIS_REST_URL);
  const hasRedisToken = Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

  if (hasRedisUrl !== hasRedisToken) {
    throw new Error('Both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be configured together');
  }

  useRedis = hasRedisUrl && hasRedisToken;

  if (useRedis) {
    redis = Redis.fromEnv();
    await redis.ping();
    console.log('✅ Memory initialized with Upstash Redis');
    return;
  }

  await fs.mkdir(MEMORY_PATH, { recursive: true });
  console.log('✅ Memory initialized at ' + MEMORY_PATH);
}

function redisKey(key) {
  return 'openclaw:memory:' + key;
}

export async function saveMemory(key, value) {
  if (useRedis) {
    await redis.set(redisKey(key), JSON.stringify(value));
    await redis.sadd(KEY_SET, key);
    console.log('💾 Saved Redis memory: ' + key);
    return;
  }

  const filePath = path.join(MEMORY_PATH, key + '.json');
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2));
  console.log('💾 Saved memory: ' + key);
}

export async function loadMemory(key) {
  if (useRedis) {
    const data = await redis.get(redisKey(key));
    if (data === null || data === undefined) return null;
    return typeof data === 'string' ? JSON.parse(data) : data;
  }

  const filePath = path.join(MEMORY_PATH, key + '.json');
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    console.error('❌ Failed to load memory ' + key + ':', error.message);
    throw error;
  }
}

export async function deleteMemory(key) {
  if (useRedis) {
    await redis.del(redisKey(key));
    await redis.srem(KEY_SET, key);
    console.log('🗑️ Deleted Redis memory: ' + key);
    return;
  }

  const filePath = path.join(MEMORY_PATH, key + '.json');
  try {
    await fs.unlink(filePath);
    console.log('🗑️ Deleted memory: ' + key);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export async function listMemoryKeys() {
  if (useRedis) {
    return await redis.smembers(KEY_SET);
  }

  try {
    const files = await fs.readdir(MEMORY_PATH);
    return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}
