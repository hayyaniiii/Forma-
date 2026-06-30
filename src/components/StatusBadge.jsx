import { IconCheck, IconLoader2 } from '@tabler/icons-react';

export default function StatusBadge({ status, error, fileBadge }) {
  if (fileBadge === 'encrypted') {
    return (
      <span
        className="rounded-full bg-discord-yellow/15 px-2 py-0.5 text-[11px] font-medium text-discord-yellow"
        title="Remove password protection first"
      >
        🔒 encrypted
      </span>
    );
  }
  if (fileBadge === 'unsupported') {
    return (
      <span
        className="rounded-full bg-discord-yellow/15 px-2 py-0.5 text-[11px] font-medium text-discord-yellow"
        title={error || 'Unsupported for this operation'}
      >
        unsupported
      </span>
    );
  }
  if (fileBadge === 'image-based') {
    return (
      <span
        className="rounded-full bg-discord-yellow/15 px-2 py-0.5 text-[11px] font-medium text-discord-yellow"
        title="This PDF contains no text layer. Output quality will be limited."
      >
        ⚠ image-based
      </span>
    );
  }
  if (fileBadge === 'corrupt') {
    return (
      <span
        className="rounded-full bg-discord-red/15 px-2 py-0.5 text-[11px] font-medium text-discord-red"
        title={error}
      >
        corrupt
      </span>
    );
  }
  if (fileBadge === 'large') {
    return (
      <span
        className="rounded-full bg-discord-yellow/15 px-2 py-0.5 text-[11px] font-medium text-discord-yellow"
        title="Large PDF — conversion may take a while"
      >
        large file
      </span>
    );
  }

  if (status === 'converting') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-discord-accent/20 px-2 py-0.5 text-[11px] font-medium text-discord-accent">
        <IconLoader2 size={12} className="animate-spin" />
        converting
      </span>
    );
  }
  if (status === 'done') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-discord-green/15 px-2 py-0.5 text-[11px] font-medium text-discord-green">
        <IconCheck size={12} />
        done
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span
        className="rounded-full bg-discord-red/15 px-2 py-0.5 text-[11px] font-medium text-discord-red"
        title={error}
      >
        error
      </span>
    );
  }
  if (fileBadge === 'skipped') {
    return (
      <span className="rounded-full bg-discord-yellow/15 px-2 py-0.5 text-[11px] text-discord-yellow">
        skipped
      </span>
    );
  }
  return (
    <span className="rounded-full bg-discord-green/10 px-2 py-0.5 text-[11px] font-medium text-discord-green">
      ready
    </span>
  );
}
