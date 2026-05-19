/**
 * Skills loader
 * Dynamically load and execute skill modules
 */

import fs from 'fs/promises';
import path from 'path';

export async function loadSkill(skillName, skillsPath) {
  const skillDir = path.join(skillsPath, skillName);
  const skillFile = path.join(skillDir, 'skill.js');

  try {
    const module = await import(skillFile);
    return module;
  } catch (error) {
    console.error(`❌ Failed to load skill ${skillName}:`, error.message);
    throw error;
  }
}

export async function runSkill(skillName, context, skillsPath) {
  try {
    const skill = await loadSkill(skillName, skillsPath);
    
    if (typeof skill.run !== 'function') {
      throw new Error('Skill does not export a run function');
    }

    return await skill.run(context);
  } catch (error) {
    console.error(`❌ Skill execution failed:`, error.message);
    throw error;
  }
}

export async function listSkills(skillsPath) {
  try {
    const entries = await fs.readdir(skillsPath, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory())
      .map(e => e.name);
  } catch (error) {
    console.error(`❌ Failed to list skills:`, error.message);
    return [];
  }
}
