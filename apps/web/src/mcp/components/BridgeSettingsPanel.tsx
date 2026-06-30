import { useEffect, useState } from 'react';
import { Plug } from 'lucide-react';
import { useSettingsSection } from '@/components/settings/SettingsScrollSpy';
import { cn } from '@scrolled/ui';
import {
  DEFAULT_BRIDGE_SETTINGS,
  readBridgeSettings,
  writeBridgeSettings,
  type BridgeSettings,
} from '../bridge/settings';
import { useBridgeStatus } from '../bridge/status';

const URL_PATTERN = /^wss?:\/\/[^\s]+$/;

export function BridgeSettingsPanel() {
  const sectionProps = useSettingsSection('mcp');
  const { status, reason } = useBridgeStatus();
  const [settings, setSettings] = useState<BridgeSettings>(DEFAULT_BRIDGE_SETTINGS);
  const [urlDraft, setUrlDraft] = useState(DEFAULT_BRIDGE_SETTINGS.url);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void readBridgeSettings().then((s) => {
      setSettings(s);
      setUrlDraft(s.url);
    });
  }, []);

  const urlValid = URL_PATTERN.test(urlDraft.trim());

  const onToggle = async (next: boolean) => {
    setSaving(true);
    try {
      const updated: BridgeSettings = { ...settings, enabled: next };
      await writeBridgeSettings(updated);
      setSettings(updated);
    } finally {
      setSaving(false);
    }
  };

  const onCommitUrl = async () => {
    if (!urlValid) return;
    if (urlDraft.trim() === settings.url) return;
    setSaving(true);
    try {
      const updated: BridgeSettings = { ...settings, url: urlDraft.trim() };
      await writeBridgeSettings(updated);
      setSettings(updated);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section {...sectionProps} className="scroll-mt-20 space-y-3">
      <div className="flex items-center gap-2">
        <Plug className="h-4 w-4" />
        <h2 className="text-lg font-semibold">External Tools (MCP)</h2>
      </div>
      <div className="border-border bg-card text-card-foreground space-y-4 rounded-md border p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Allow external connections</div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Off by default. When on, this tab dials out to a local MCP server you run yourself and
              exposes the app's tool registry to it — for AI agents, the bundled CLI, or any
              automation that speaks MCP. Nothing leaves your machine.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.enabled}
            disabled={saving}
            onClick={() => void onToggle(!settings.enabled)}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors',
              settings.enabled ? 'bg-primary' : 'bg-muted',
              saving && 'opacity-50',
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                settings.enabled ? 'translate-x-4' : 'translate-x-0.5',
              )}
            />
          </button>
        </div>

        <div>
          <label className="block">
            <span className="text-sm font-medium">Bridge URL</span>
            <input
              type="text"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onBlur={() => void onCommitUrl()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void onCommitUrl();
                }
              }}
              placeholder="ws://localhost:8765"
              className={cn(
                'border-border bg-background mt-1 block w-full rounded-md border px-3 py-1.5 font-mono text-sm',
                !urlValid && 'border-destructive',
              )}
            />
          </label>
          <p className="text-muted-foreground mt-1 text-xs">
            The bundled <code>@scrolled/mcp-server</code> hosts a WebSocket on
            <code> localhost:8765</code> by default.
          </p>
        </div>

        <div className="text-muted-foreground text-xs">
          Status: <BridgeStatusLabel status={status} reason={reason} />
        </div>
      </div>
    </section>
  );
}

function BridgeStatusLabel({ status, reason }: { status: string; reason: string | undefined }) {
  const label =
    (
      {
        idle: 'Disabled',
        connecting: 'Connecting…',
        open: 'Connected',
        closing: 'Closing…',
        closed: 'Disconnected',
        error: 'Error',
      } as Record<string, string>
    )[status] ?? status;
  return (
    <span>
      {label}
      {reason ? <span className="ml-1">— {reason}</span> : null}
    </span>
  );
}
