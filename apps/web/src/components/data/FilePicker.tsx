import { useRef, type ChangeEvent } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@scrolled/ui';

interface Props {
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  label?: string;
}

export function FilePicker({
  accept = '.wz',
  multiple = true,
  onFiles,
  disabled,
  label = 'Choose WZ files',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handle(e: ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    onFiles([...list]);
    // Reset so the same file selection re-fires onChange.
    e.target.value = '';
  }

  return (
    <div className="flex items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handle}
        className="hidden"
      />
      <Button
        type="button"
        variant="default"
        size="md"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-4 w-4" />
        {label}
      </Button>
    </div>
  );
}
