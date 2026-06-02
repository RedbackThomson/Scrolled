import { z } from 'zod';
import type { ToolDefinition } from '../types';
import { READ } from './annotations';

const emptySchema = z.object({}).optional();

export const libraryStatus: ToolDefinition<typeof emptySchema, unknown> = {
  name: 'library.status',
  category: 'Library',
  description: 'Library state — same shape as db.gameStatus, surfaced under the Library category.',
  inputSchema: emptySchema,
  annotations: READ,
  execute: (_input, ctx) => ctx.db.status(),
};

export const libraryListDatasets: ToolDefinition<typeof emptySchema, unknown> = {
  name: 'library.listDatasets',
  category: 'Library',
  description: 'Every recorded extraction run with per-extractor outcomes.',
  inputSchema: emptySchema,
  annotations: READ,
  execute: (_input, ctx) => ctx.db.listDatasets(),
};

export const libraryListLoadedFileNames: ToolDefinition<typeof emptySchema, unknown> = {
  name: 'library.listLoadedFileNames',
  category: 'Library',
  description: 'Distinct file names ever loaded, across every dataset.',
  inputSchema: emptySchema,
  annotations: READ,
  execute: (_input, ctx) => ctx.db.listLoadedFileNames(),
};

export const libraryTools = [
  libraryStatus,
  libraryListDatasets,
  libraryListLoadedFileNames,
];
