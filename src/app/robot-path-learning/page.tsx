"use client";

import { StreamConnectionBadge } from '@/components/dt/StreamConnectionBadge';
import { MultiRobotViewer } from './components/MultiRobotViewer';

export default function RobotPathLearningPage() {
  return (
    <div className="relative w-screen h-screen">
      <MultiRobotViewer />
      <div className="pointer-events-none absolute right-4 top-4">
        <StreamConnectionBadge className="pointer-events-auto" />
      </div>
    </div>
  );
}

