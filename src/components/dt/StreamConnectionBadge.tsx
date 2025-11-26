"use client";

import { cn } from '@/lib/utils';
import { useTransformStore, type TransformConnectionState } from '@/stores/transformStore';

const STATE_META: Record<
  TransformConnectionState,
  { text: string; container: string; dot: string }
> = {
  connecting: {
    text: '연결 중',
    container: 'border-amber-400/50 bg-amber-500/10 text-amber-100',
    dot: 'bg-amber-400 animate-pulse',
  },
  open: {
    text: 'Live',
    container: 'border-emerald-400/50 bg-emerald-500/10 text-emerald-100',
    dot: 'bg-emerald-400',
  },
  closed: {
    text: '재연결 대기',
    container: 'border-rose-400/50 bg-rose-500/10 text-rose-100',
    dot: 'bg-rose-400 animate-pulse',
  },
};

interface StreamConnectionBadgeProps {
  label?: string;
  className?: string;
}

export function StreamConnectionBadge({ label = 'Transforms Stream', className }: StreamConnectionBadgeProps) {
  const connectionState = useTransformStore((state) => state.connectionState);
  const meta = STATE_META[connectionState];

  return (
    <div className={cn('flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur', meta.container, className)}>
      <span className={cn('inline-flex h-2.5 w-2.5 rounded-full', meta.dot)} aria-hidden />
      <span className="whitespace-nowrap">
        {label} · {meta.text}
      </span>
    </div>
  );
}


