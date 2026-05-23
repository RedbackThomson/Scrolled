import { Link } from 'react-router-dom';
import { Database, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ProgressBar';
import { useExtractAll } from '@/lib/useExtractAll';

/**
 * Ad-hoc bulk extraction trigger for the parser-debug page. Lifts the entire
 * pipeline out of this component — the heavy lifting lives in
 * `useExtractAll`. The first-run wizard reuses the same hook with its own
 * `skipWz` set.
 */
export function ExtractAllPanel() {
  const { run, isRunning, error, progress, stats } = useExtractAll();

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Bulk extract to database</h2>
      <p className="text-muted-foreground text-sm">
        Walks every loaded WZ file: items + equips + mobs + NPCs + maps (with their NPC, mob, and
        portal placements). Records are saved to the local SQLite database. Map.wz extraction is
        memory-intensive — load it only if you want full map data.
      </p>
      <div className="flex items-center gap-3">
        <Button onClick={run} disabled={isRunning}>
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isRunning ? 'Extracting…' : 'Extract everything'}
        </Button>
        {stats && !isRunning && (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Database className="h-4 w-4" />
            <span>
              {stats.items} items, {stats.equips} equips, {stats.mobs} mobs, {stats.npcs} NPCs,{' '}
              {stats.maps} maps
              {stats.skipped > 0 ? `, ${stats.skipped} skipped` : ''} in {stats.ms} ms
            </span>
            <Link to="/items" className="text-primary text-xs hover:underline">
              Browse →
            </Link>
          </div>
        )}
      </div>
      {progress && (
        <div className="border-border bg-card text-card-foreground rounded-md border p-3">
          <ProgressBar progress={progress} />
        </div>
      )}
      {error && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
          {error.message}
        </div>
      )}
    </section>
  );
}
