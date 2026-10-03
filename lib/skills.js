/**
 * Skills loader for Markdown skill definitions.
 */

import fs from 'fs/promises';
import path from 'path';

export async function loadSkill(skillName, skillsPath) {
  const skillFile = path.join(skillsPath, skillName, 'SKILL.md');

  try {
    const content = await fs.readFile(skillFile, 'utf-8');
    return { name: skillName, content };
  } catch (error) {
    console.error('❌ Failed to load skill ' + skillName + ':', error.message);
    throw error;
  }
}

export async function runSkill(skillName, context, skillsPath) {
  const skill = await loadSkill(skillName, skillsPath);
  return {
    name: skill.name,
    instructions: skill.content,
    context,
  };
}

export async function listSkills(skillsPath) {
  try {
    const entries = await fs.readdir(skillsPath, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  } catch (error) {
    console.error('❌ Failed to list skills:', error.message);
    return [];
  }
}
