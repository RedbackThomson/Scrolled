// Long-running operation tools. v1 returns synchronously; the bridge already
// supports `ProgressEnvelope`, so future progress reporting can be added
// without changing the tool's request/response shape.

import { z } from 'zod';
import { UnsupportedError } from '../errors';
import type { ToolDefinition } from '../types';
import { idSchema } from './schemas';

const collectionsExportOneSchema = z.object({ id: idSchema });
export const collectionsExportOne: ToolDefinition<typeof collectionsExportOneSchema, unknown> = {
  name: 'collections.export',
  category: 'ImportExport',
  description: 'Export a single collection as JSON.',
  inputSchema: collectionsExportOneSchema,
  execute: (input, ctx) => ctx.userDb.exportCollectionJson(input.id),
};

const collectionsExportAllSchema = z.object({}).optional();
export const collectionsExportAll: ToolDefinition<
  typeof collectionsExportAllSchema,
  unknown
> = {
  name: 'collections.exportAll',
  category: 'ImportExport',
  description: 'Export every collection as a single JSON bundle.',
  inputSchema: collectionsExportAllSchema,
  execute: (_input, ctx) => ctx.userDb.exportAllJson(),
};

const collectionsImportSchema = z.object({
  payload: z.unknown(),
  conflict: z.enum(['merge', 'rename', 'skip']),
});
export const collectionsImport: ToolDefinition<typeof collectionsImportSchema, unknown> = {
  name: 'collections.import',
  category: 'ImportExport',
  description:
    'Import a JSON bundle previously produced by `collections.export` / `collections.exportAll`.',
  inputSchema: collectionsImportSchema,
  execute: (input, ctx) => ctx.userDb.importJson(input.payload, input.conflict),
};

const libraryExportSchema = z.object({}).optional();
export const libraryExport: ToolDefinition<typeof libraryExportSchema, unknown> = {
  name: 'library.export',
  category: 'ImportExport',
  description:
    'Export the game-data SQLite file as a base64 string. Large — prefer the in-app Backup UI for >100MB libraries.',
  inputSchema: libraryExportSchema,
  execute: async (_input, ctx) => {
    const bytes = await ctx.db.exportBytes();
    return { base64: bytesToBase64(bytes), byteLength: bytes.byteLength };
  },
};

const libraryImportSchema = z.object({
  base64: z.string().min(1),
});
export const libraryImport: ToolDefinition<typeof libraryImportSchema, unknown> = {
  name: 'library.import',
  category: 'ImportExport',
  description:
    'Replace the game-data SQLite file with a previously exported base64 blob. Use the Backup UI for restores you can step through visually.',
  inputSchema: libraryImportSchema,
  execute: async (input, ctx) => {
    try {
      const bytes = base64ToBytes(input.base64);
      return await ctx.db.importBytes(bytes);
    } catch (e) {
      throw new UnsupportedError(
        e instanceof Error ? e.message : 'Failed to decode library import payload',
      );
    }
  },
};

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const importExportTools = [
  collectionsExportOne,
  collectionsExportAll,
  collectionsImport,
  libraryExport,
  libraryImport,
];
