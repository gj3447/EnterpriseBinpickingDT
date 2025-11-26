'use client';

import { useState } from 'react';
import type { YcbObjectData } from '@/lib/ycb';
import { YcbObjectViewer } from '@/app/ycb-browser/components/YcbObjectViewer';
import { RobotControlPanel } from './RobotControlPanel';
import { RobotSettingsPanel } from './RobotSettingsPanel';
import { RobotIkPanel } from './RobotIkPanel';
import { RobotMarkerPanel } from './RobotMarkerPanel';
import { RobotSequencePanel } from './RobotSequencePanel';

type PanelTab = 'inference' | 'control' | 'markers' | 'ik' | 'settings' | 'sequence';

const TABS: { id: PanelTab; label: string; icon: string }[] = [
  { id: 'inference', label: '추론 패널', icon: '🧠' },
  { id: 'control', label: '로봇 조종', icon: '🤖' },
  { id: 'markers', label: '마커 선택', icon: '📍' },
  { id: 'ik', label: 'IK 제어', icon: '🎯' },
  { id: 'settings', label: '로봇 설정', icon: '⚙️' },
  { id: 'sequence', label: '시퀀스 제작', icon: '🧾' },
];

interface RobotSidePanelProps {
  objects: YcbObjectData[];
}

export function RobotSidePanel({ objects }: RobotSidePanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('inference');

  return (
    <div className="h-full flex flex-col bg-neutral-900 text-neutral-100">
      <nav className="px-6 pt-6 pb-4 border-b border-neutral-800 flex gap-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-lg rounded-full border transition-colors duration-150 ${
                isActive
                  ? 'bg-neutral-100 text-neutral-900 border-neutral-100 shadow-inner'
                  : 'border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:border-neutral-500'
              }`}
              title={tab.label}
            >
              <span aria-hidden>{tab.icon}</span>
              <span className="sr-only">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'inference' && <YcbObjectViewer objects={objects} variant="panel" />}
        {activeTab === 'control' && <RobotControlPanel />}
        {activeTab === 'markers' && <RobotMarkerPanel />}
        {activeTab === 'ik' && <RobotIkPanel />}
        {activeTab === 'settings' && <RobotSettingsPanel />}
        {activeTab === 'sequence' && <RobotSequencePanel />}
      </div>
    </div>
  );
}


