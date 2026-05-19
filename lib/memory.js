/**
 * Memory abstraction layer
 * File-based persistent storage for user profiles, etc.
 */

import fs from 'fs/promises';
import path from 'path';

let MEMORY_PATH = '/data/memory';

export async function initMemory(memoryPath) {
  MEMORY_PATH = memoryPath;
  try {
    await fs.mkdir(MEMORY_PATH, { recursive: true });
    console.log(`✅ Memory initialized at ${MEMORY_PATH}`);
  } catch (error) {
    console.error(`❌ Failed to initialize memory:`, error.message);
    throw error;
  }
}

export async function saveMemory(key, value) {
  const filePath = path.join(MEMORY_PATH, `${key}.json`);
  
  // Ensure directory exists
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  
  try {
    await fs.writeFile(filePath, JSON.stringify(value, null, 2));
    console.log(`💾 Saved memory: ${key}`);
  } catch (error) {
    console.error(`❌ Failed to save memory ${key}:`, error.message);
    throw error;
  }
}

export async function loadMemory(key) {
  const filePath = path.join(MEMORY_PATH, `${key}.json`);
  
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    console.error(`❌ Failed to load memory ${key}:`, error.message);
    throw error;
  }
}

export async function deleteMemory(key) {
  const filePath = path.join(MEMORY_PATH, `${key}.json`);
  
  try {
    await fs.unlink(filePath);
    console.log(`🗑️  Deleted memory: ${key}`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`❌ Failed to delete memory ${key}:`, error.message);
      throw error;
    }
  }
}

export async function listMemoryKeys() {
  try {
    const files = await fs.readdir(MEMORY_PATH);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    console.error(`❌ Failed to list memory:`, error.message);
    throw error;
  }
}
