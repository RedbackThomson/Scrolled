import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plug, PlugZap, ListTree } from 'lucide-react';
import { CommandGroup, CommandItem as CommandItemPrimitive } from '@scrolled/ui';
import { useCommandPalette } from '@/stores/useCommandPalette';
import {
  DEFAULT_BRIDGE_SETTINGS,
  readBridgeSettings,
  writeBridgeSettings,
  type BridgeSettings,
} from '../bridge/settings';
import { getToolRegistry } from '../registry';

function fuzzy(q: string, hay: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return hay.toLowerCase().includes(t);
}

export function McpPaletteProvider() {
  const setOpen = useCommandPalette((s) => s.setOpen);
  const query = useCommandPalette((s) => s.query);
  const navigate = useNavigate();
  const [settings, setSettings] = useState<BridgeSettings>(DEFAULT_BRIDGE_SETTINGS);

  useEffect(() => {
    void readBridgeSettings().then(setSettings);
  }, []);

  const toggleLabel = settings.enabled
    ? 'MCP: Disable external bridge'
    : 'MCP: Enable external bridge';
  const toggleIcon = settings.enabled ? PlugZap : Plug;

  const toolCount = getToolRegistry().list().length;
  const viewLabel = `MCP: View registered tools (${toolCount})`;

  const items: Array<{
    id: string;
    label: string;
    icon: typeof Plug;
    keywords: string[];
    onSelect: () => void;
  }> = [];

  if (fuzzy(query, `${toggleLabel} mcp bridge external`)) {
    items.push({
      id: 'mcp-toggle',
      label: toggleLabel,
      icon: toggleIcon,
      keywords: ['mcp', 'bridge', 'external', 'agent', 'cli', 'connect'],
      onSelect: () => {
        const next = { ...settings, enabled: !settings.enabled };
        void writeBridgeSettings(next).then(() => setSettings(next));
      },
    });
  }
  if (fuzzy(query, `${viewLabel} mcp tools registry`)) {
    items.push({
      id: 'mcp-view',
      label: viewLabel,
      icon: ListTree,
      keywords: ['mcp', 'tools', 'registry', 'list', 'agent'],
      onSelect: () => navigate('/settings#mcp'),
    });
  }

  if (items.length === 0) return null;

  return (
    <CommandGroup heading="MCP">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <CommandItemPrimitive
            key={it.id}
            value={it.id}
            keywords={it.keywords}
            onSelect={() => {
              it.onSelect();
              setOpen(false);
            }}
          >
            <Icon className="text-muted-foreground h-4 w-4" />
            <span className="min-w-0 flex-1 truncate">{it.label}</span>
          </CommandItemPrimitive>
        );
      })}
    </CommandGroup>
  );
}
