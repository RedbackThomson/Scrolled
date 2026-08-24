import type { ReactNode } from 'react';
import { Badge } from './shared';
import type { FieldMode, TooltipField } from './types';

const MUTED_BADGE = 'bg-muted text-muted-foreground';

/**
 * A boolean-state field. "When present" shows the badge only in its notable
 * (true) state; "Always" shows the current state either way, so a `tradeBlock`
 * field reads "Untradeable" when set and "Tradeable" when not. The affirmative
 * state can carry a colour and an icon; the negative is always muted.
 */
export function flagField<TRecord>(
  key: keyof TRecord & string,
  opts: {
    label: string;
    whenTrue: string;
    whenFalse: string;
    defaultMode?: FieldMode;
    trueClassName?: string;
    trueIcon?: ReactNode;
  },
): TooltipField<TRecord, Record<string, never>> {
  const { label, whenTrue, whenFalse, defaultMode = 'never', trueClassName, trueIcon } = opts;
  return {
    key,
    label,
    zone: 'meta',
    metaVariant: 'inline',
    defaultMode,
    isPresent: ({ record }) => record[key] === true,
    render: ({ record }) => {
      const on = record[key] === true;
      return (
        <Badge className={on ? (trueClassName ?? MUTED_BADGE) : MUTED_BADGE}>
          {on && trueIcon}
          {on ? whenTrue : whenFalse}
        </Badge>
      );
    },
  };
}
