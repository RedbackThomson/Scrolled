import { z } from 'zod';
import { NotFoundError } from '../errors';
import type { ToolDefinition } from '../types';
import { READ } from './annotations';
import { idSchema, listOptsBaseSchema } from './schemas';

export const skillsList: ToolDefinition<typeof listOptsBaseSchema, unknown> = {
  name: 'skills.list',
  category: 'Skills',
  description: 'Paged listing of skills.',
  inputSchema: listOptsBaseSchema,
  annotations: READ,
  execute: (input, ctx) => ctx.db.listSkills(input),
};

const skillsGetSchema = z.object({ id: idSchema });
export const skillsGet: ToolDefinition<typeof skillsGetSchema, unknown> = {
  name: 'skills.get',
  category: 'Skills',
  description: 'Fetch one skill by id.',
  inputSchema: skillsGetSchema,
  annotations: READ,
  execute: async (input, ctx) => {
    const row = await ctx.db.getSkill(input.id);
    if (!row) throw new NotFoundError(`Skill ${input.id} not found`);
    return row;
  },
};

const skillsLevelsSchema = z.object({ id: idSchema });
export const skillsLevels: ToolDefinition<typeof skillsLevelsSchema, unknown> = {
  name: 'skills.listLevels',
  category: 'Skills',
  description: 'Level-table rows for a skill, ordered by level ascending.',
  inputSchema: skillsLevelsSchema,
  annotations: READ,
  execute: (input, ctx) => ctx.db.getSkillLevels(input.id),
};

const skillsPrereqSchema = z.object({ id: idSchema });
export const skillsPrereqs: ToolDefinition<typeof skillsPrereqSchema, unknown> = {
  name: 'skills.listPrerequisites',
  category: 'Skills',
  description: 'Direct prerequisites of a skill.',
  inputSchema: skillsPrereqSchema,
  annotations: READ,
  execute: (input, ctx) => ctx.db.getSkillPrerequisites(input.id),
};

const skillsRequiringSchema = z.object({ id: idSchema });
export const skillsRequiring: ToolDefinition<typeof skillsRequiringSchema, unknown> = {
  name: 'skills.listRequiring',
  category: 'Skills',
  description: 'Skills that list this skill as a prerequisite.',
  inputSchema: skillsRequiringSchema,
  annotations: READ,
  execute: (input, ctx) => ctx.db.getSkillsRequiring(input.id),
};

const skillsQuestsSchema = z.object({ id: idSchema });
export const skillsQuests: ToolDefinition<typeof skillsQuestsSchema, unknown> = {
  name: 'skills.listQuests',
  category: 'Skills',
  description: 'Quests that grant this skill as a reward.',
  inputSchema: skillsQuestsSchema,
  annotations: READ,
  execute: (input, ctx) => ctx.db.getSkillQuests(input.id),
};

export const skillTools = [
  skillsList,
  skillsGet,
  skillsLevels,
  skillsPrereqs,
  skillsRequiring,
  skillsQuests,
];
