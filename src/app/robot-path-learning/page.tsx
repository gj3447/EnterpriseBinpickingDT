"use client";

import { MultiRobotViewer } from './components/MultiRobotViewer';
import { useMemo } from 'react';

export default function RobotPathLearningPage() {
  const robotPositions = useMemo(() => {
    const positions: [number, number, number][] = [];
    const gridSize = 10;
    const spacing = 2; // 2m 간격
    const offset = (gridSize - 1) * spacing / 2;

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const x = i * spacing - offset;
        const z = j * spacing - offset;
        positions.push([x, 0, z]);
      }
    }
    return positions;
  }, []);

  return (
    <div className="w-screen h-screen">
      <MultiRobotViewer robotPositions={robotPositions} />
    </div>
  );
}

