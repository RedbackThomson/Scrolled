import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { proxy } from 'comlink';
import {
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  Database,
  FileWarning,
  Loader2,
  Save,
} from 'lucide-react';
import { FilePicker } from '@/components/FilePicker';
import { Button } from '@/components/ui/button';
import { ExtractAllPanel } from '@/components/ExtractAllPanel';
import { ProgressBar } from '@/components/ProgressBar';
import { getParserClient, type WzNodeInfo, type WzMapleVersionName } from '@/parser';
import { getDbClient } from '@/db';
import { cn } from '@/lib/utils';
import { buildReport } from '@/lib/diagnosticsReport';
import type { ProgressUpdate } from '@/lib/progress';

// MapleRoyals' v83-era client uses the "old GMS" encryption — listed first.
const VERSIONS: WzMapleVersionName[] = ['GMS', 'BMS', 'EMS', 'CLASSIC'];

interface LoadState {
  loaded: { name: string; rootDirectories: string[] }[];
  errors: { name: string; message: string }[];
}

export default function Debug() {
  const [version, setVersion] = useState<WzMapleVersionName>('GMS');
  const [busy, setBusy] = useState(false);
  const [loadState, setLoadState] = useState<LoadState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState<ProgressUpdate | null>(null);

  const [lookupPath, setLookupPath] = useState('');
  const [lookupResult, setLookupResult] = useState<WzNodeInfo | null | 'pending'>(null);

  const client = useMemo(() => getParserClient(), []);

  useEffect(() => {
    client.init(version).catch((e: unknown) => setError(String(e)));
  }, [client, version]);

  const handleFiles = useCallback(
    async (files: File[]) => {
      setBusy(true);
      setError(null);
      setLoadState(null);
      setLoadProgress({ phase: 'Initializing', current: 0 });
      try {
        await client.init(version);
        const onProgress = proxy((p: ProgressUpdate) => setLoadProgress(p));
        const result = await client.load(
          files.map((file) => ({ name: file.name, source: file })),
          onProgress,
        );
        setLoadState(result);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
        setLoadProgress(null);
      }
    },
    [client, version],
  );

  const runLookup = useCallback(async () => {
    if (!lookupPath.trim()) return;
    setLookupResult('pending');
    try {
      const node = await client.getNode(lookupPath.trim());
      setLookupResult(node);
    } catch (e) {
      setError((e as Error).message);
      setLookupResult(null);
    }
  }, [client, lookupPath]);

  return (
    <div className="max-w-4xl space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Parser debug</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Phase 1 spike. Load your own WZ files, inspect the parsed tree, and look up a node by
          path. Files never leave your browser.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium" htmlFor="wz-version">
            Encryption version
          </label>
          <select
            id="wz-version"
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            value={version}
            onChange={(e) => setVersion(e.target.value as WzMapleVersionName)}
            disabled={busy}
          >
            {VERSIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <FilePicker onFiles={handleFiles} disabled={busy} />
          {busy && !loadProgress && (
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          )}
        </div>
        {loadProgress && (
          <div className="border-border bg-card text-card-foreground rounded-md border p-3">
            <ProgressBar progress={loadProgress} />
          </div>
        )}
        {error && (
          <div className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border p-3 text-sm">
            <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </section>

      {loadState && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Loaded files</h2>
          <ul className="space-y-2">
            {loadState.loaded.map((f) => (
              <li
                key={f.name}
                className="border-border bg-card text-card-foreground rounded-md border p-3 text-sm"
              >
                <div className="font-mono text-xs font-medium">{f.name}</div>
                <div className="text-muted-foreground mt-1 text-xs">
                  {f.rootDirectories.length} top-level entries:{' '}
                  {f.rootDirectories.slice(0, 8).join(', ')}
                  {f.rootDirectories.length > 8 && ' …'}
                </div>
                <TreeRoot path={f.name} />
              </li>
            ))}
            {loadState.errors.map((e) => (
              <li
                key={e.name}
                className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-3 text-sm"
              >
                <div className="font-mono text-xs font-medium">{e.name}</div>
                <div className="mt-1 text-xs">{e.message}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {loadState && loadState.loaded.length > 0 && <ExtractAllPanel />}

      <DiagnosticsPanel />

      {loadState && loadState.loaded.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Lookup by path</h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={lookupPath}
              onChange={(e) => setLookupPath(e.target.value)}
              placeholder="e.g. String.wz/Eqp.img/Eqp/Cap/1002000/name"
              className="border-input bg-background h-9 flex-1 rounded-md border px-3 font-mono text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') runLookup();
              }}
            />
            <Button onClick={runLookup} disabled={!lookupPath.trim()}>
              Look up
            </Button>
          </div>
          {lookupResult === 'pending' && (
            <p className="text-muted-foreground text-sm">Resolving…</p>
          )}
          {lookupResult === null && <p className="text-muted-foreground text-sm">No result yet.</p>}
          {lookupResult && typeof lookupResult === 'object' && (
            <>
              <pre className="border-border bg-muted/40 overflow-x-auto rounded-md border p-3 text-xs">
                {JSON.stringify(lookupResult, null, 2)}
              </pre>
              <SaveItemPanel node={lookupResult} />
            </>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * Phase 2 round-trip demo: take a String.wz item node, fetch its localized
 * name + description, and write it to the local database. The Items route
 * shows what's in the DB across reloads.
 */
function SaveItemPanel({ node }: { node: WzNodeInfo }) {
  const parser = useMemo(() => getParserClient(), []);
  const db = useMemo(() => getDbClient(), []);
  const queryClient = useQueryClient();

  // The "item" is the deepest path segment that looks like a numeric ID. If
  // the user looked up the item directly (e.g. `String.wz/Consume.img/2000000`,
  // whose WZ node is a SubProperty container) or one of its leaf properties
  // (e.g. `…/2000000/name`), both forms target the same row in the items
  // table.
  const target = resolveItemTarget(node.fullPath);

  const saveM = useMutation({
    mutationFn: async () => {
      if (!target) {
        throw new Error('No numeric item ID found in this path');
      }
      // Manual saves go through Item.wz to find the icon, not String.wz —
      // String.wz only carries names/descriptions.
      const itemWzPath = target.itemPath.replace(/^String\.wz\/(\w+)\.img/, (_m, cat) => {
        const dir = { Consume: 'Consume', Etc: 'Etc', Ins: 'Install', Cash: 'Cash' }[cat as string];
        return dir ? `Item.wz/${dir}` : `String.wz/${cat}.img`;
      });
      const iconPath = `${itemWzPath}/info/icon`;
      const [nameNode, descNode, iconData] = await Promise.all([
        parser.getNode(`${target.itemPath}/name`),
        parser.getNode(`${target.itemPath}/desc`),
        parser.getIconPng(iconPath),
      ]);
      const name =
        typeof nameNode?.scalar === 'string' && nameNode.scalar
          ? nameNode.scalar
          : `Item ${target.id}`;
      const description = typeof descNode?.scalar === 'string' ? descNode.scalar : null;
      const category = inferCategory(target.itemPath);
      await db.upsertItem({
        id: target.id,
        name,
        description,
        category,
        subcategory: null,
        iconPath: iconData ? iconPath : null,
        iconData,
        price: null,
        stackSize: null,
        requiredLevel: null,
        sourcePath: target.itemPath,
      });
      return { id: target.id, name };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['db'] }),
  });

  if (!target) {
    return (
      <div className="border-border bg-muted/40 rounded-md border p-3 text-xs">
        <span className="font-medium">No item ID in this path.</span>{' '}
        <span className="text-muted-foreground">
          Look up something like <code className="font-mono">String.wz/Consume.img/2000000</code>{' '}
          (or one of its children) to save it to the database.
        </span>
      </div>
    );
  }

  return (
    <div className="border-border bg-card text-card-foreground flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          <span className="font-medium">Save to local database</span>
        </div>
        <div className="text-muted-foreground mt-1 truncate text-xs">
          ID {target.id} · <code className="font-mono">{target.itemPath}</code>
        </div>
        {saveM.isSuccess && (
          <div className="mt-1 text-xs text-green-600 dark:text-green-400">
            Saved “{saveM.data.name}”. Visit <code className="font-mono">/items</code> to see it.
          </div>
        )}
        {saveM.isError && (
          <div className="text-destructive mt-1 text-xs">{(saveM.error as Error).message}</div>
        )}
      </div>
      <Button size="sm" onClick={() => saveM.mutate()} disabled={saveM.isPending}>
        {saveM.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Save
      </Button>
    </div>
  );
}

/**
 * Locate the deepest numeric segment in a WZ path — that's the item ID. Works
 * whether the user looks up the item container itself or any descendant
 * property under it.
 */
function resolveItemTarget(fullPath: string): { itemPath: string; id: number } | null {
  const segments = fullPath.split('/').filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    if (/^\d+$/.test(segments[i])) {
      return {
        itemPath: segments.slice(0, i + 1).join('/'),
        id: Number(segments[i]),
      };
    }
  }
  return null;
}

/**
 * Best-effort category inference from a String.wz path. Replaced by proper
 * extractors in Phase 3.
 */
function inferCategory(path: string): string | null {
  const match = path.match(/String\.wz\/([^/]+)\.img/i);
  if (!match) return null;
  const img = match[1].toLowerCase();
  if (img === 'consume') return 'use';
  if (img === 'eqp') return 'equip';
  if (img === 'etc') return 'etc';
  if (img === 'cash') return 'cash';
  if (img === 'ins') return 'setup';
  return img;
}

function TreeRoot({ path }: { path: string }) {
  return (
    <div className="mt-3 border-l pl-3">
      <TreeChildren path={path} depth={0} />
    </div>
  );
}

const MAX_DEPTH = 6;

function TreeChildren({ path, depth }: { path: string; depth: number }) {
  const client = useMemo(() => getParserClient(), []);
  const [children, setChildren] = useState<WzNodeInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    client
      .listChildren(path)
      .then((c) => {
        if (!cancelled) setChildren(c);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, path]);

  if (loading) return <div className="text-muted-foreground text-xs">loading…</div>;
  if (error) return <div className="text-destructive text-xs">{error}</div>;
  if (!children || children.length === 0) {
    return <div className="text-muted-foreground text-xs">(empty)</div>;
  }

  return (
    <ul className="space-y-0.5">
      {children.slice(0, 50).map((c) => (
        <TreeNode key={c.fullPath} node={c} depth={depth} />
      ))}
      {children.length > 50 && (
        <li className="text-muted-foreground text-xs">…and {children.length - 50} more</li>
      )}
    </ul>
  );
}

function TreeNode({ node, depth }: { node: WzNodeInfo; depth: number }) {
  const [open, setOpen] = useState(false);
  const canExpand = node.hasChildren && depth < MAX_DEPTH;

  return (
    <li>
      <div className="flex items-center gap-1 font-mono text-xs">
        {canExpand ? (
          <button
            type="button"
            aria-label={open ? 'Collapse' : 'Expand'}
            onClick={() => setOpen((v) => !v)}
            className="text-muted-foreground hover:text-foreground"
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-3" />
        )}
        <span
          className={cn(
            node.kind === 'directory' && 'font-medium',
            node.kind === 'image' && 'text-primary',
            node.kind === 'property' && 'text-muted-foreground',
          )}
        >
          {node.name}
        </span>
        {node.propertyKind && (
          <span className="text-muted-foreground/60">: {node.propertyKind}</span>
        )}
        {node.scalar !== undefined && node.scalar !== null && (
          <span className="text-foreground/80 ml-2 truncate">
            = {String(node.scalar).slice(0, 80)}
          </span>
        )}
      </div>
      {open && (
        <div className="ml-3 border-l pl-3">
          <TreeChildren path={node.fullPath} depth={depth + 1} />
        </div>
      )}
    </li>
  );
}

function DiagnosticsPanel() {
  const client = useMemo(() => getParserClient(), []);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const buildAndCopy = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    try {
      const diag = await client.diagnose();
      const report = buildReport(diag);
      setPreview(report);
      try {
        await navigator.clipboard.writeText(report);
        setStatus('Copied to clipboard.');
      } catch {
        setStatus('Clipboard write failed — copy the text below manually.');
      }
    } catch (e) {
      setStatus(`Failed to build report: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [client]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Diagnostics</h2>
        <Button variant="outline" size="sm" onClick={buildAndCopy} disabled={busy}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ClipboardCopy className="h-4 w-4" />
          )}
          Copy log
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">
        Captures the parser log buffer, AES smoke-test result, and environment. Paste into a GitHub
        issue if something's not working.
      </p>
      {status && <p className="text-muted-foreground text-xs">{status}</p>}
      {preview && (
        <details className="border-border bg-muted/40 rounded-md border p-3">
          <summary className="cursor-pointer text-xs font-medium">Preview</summary>
          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap text-xs">{preview}</pre>
        </details>
      )}
    </section>
  );
}
