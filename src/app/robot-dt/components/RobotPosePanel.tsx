'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRobotControlStore } from '@/stores/robotControlStore';
import { useRobotPoseStore, type RobotPose } from '@/stores/robotPoseStore';

const formatDegrees = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}°`;

export function RobotPosePanel() {
  const jointAnglesDeg = useRobotControlStore((state) => state.jointAnglesDeg);
  const setJointAnglesDeg = useRobotControlStore((state) => state.setJointAnglesDeg);
  const setManualEnabled = useRobotControlStore((state) => state.setManualEnabled);

  const poses = useRobotPoseStore((state) => state.poses);
  const addPose = useRobotPoseStore((state) => state.addPose);
  const removePose = useRobotPoseStore((state) => state.removePose);
  const clearPoses = useRobotPoseStore((state) => state.clearPoses);

  const [poseName, setPoseName] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const [detailPoseId, setDetailPoseId] = useState<string | null>(null);

  const currentSummary = useMemo(
    () =>
      jointAnglesDeg
        .map((angle, index) => `J${index + 1}:${formatDegrees(angle ?? 0)}`)
        .join('  '),
    [jointAnglesDeg]
  );

  const handleSavePose = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!jointAnglesDeg || jointAnglesDeg.length === 0) {
      setFeedback('저장할 로봇 자세 데이터를 찾을 수 없습니다.');
      return;
    }

    const newPose = addPose({
      name: poseName.trim(),
      jointAnglesDeg,
    });
    setPoseName('');
    setFeedback(`'${newPose.name || '새 자세'}' 저장됨`);
  };

  const handleApplyPose = (pose: RobotPose) => {
    setManualEnabled(true);
    setJointAnglesDeg(pose.jointAnglesDeg);
    setFeedback(`'${pose.name}' 적용됨`);
  };

  const toggleDetail = (poseId: string) => {
    setDetailPoseId((prev) => (prev === poseId ? null : poseId));
  };

  return (
    <div className="flex h-full flex-col gap-3 bg-transparent text-neutral-100">
      <form onSubmit={handleSavePose} className="flex gap-2">
        <input
          type="text"
          value={poseName}
          onChange={(event) => setPoseName(event.target.value)}
          placeholder="자세 이름"
          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-950/60 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
        />
        <button
          type="submit"
          className="rounded-full border border-emerald-500 bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-neutral-900 transition hover:bg-emerald-400 hover:border-emerald-400"
        >
          저장
        </button>
      </form>

      <div className="flex items-center gap-2 text-[11px] text-neutral-400">
        <button
          type="button"
          onClick={() => setListOpen((prev) => !prev)}
          className="rounded-full border border-neutral-700 bg-neutral-900/80 px-3 py-1 uppercase tracking-widest text-neutral-100 transition hover:bg-neutral-800 hover:text-emerald-300"
        >
          리스트 {listOpen ? '닫기' : '열기'}
        </button>
        <span className="truncate text-neutral-500">현재: {currentSummary || '—'}</span>
        {poses.length > 0 && (
          <button
            type="button"
            onClick={() => {
              clearPoses();
              setFeedback('모든 자세 삭제됨');
              setDetailPoseId(null);
            }}
            className="ml-auto rounded-full border border-rose-500 bg-rose-500/90 px-3 py-1 uppercase tracking-widest text-neutral-900 transition hover:bg-rose-400"
          >
            전체 삭제
          </button>
        )}
      </div>

      {feedback && <p className="text-xs text-neutral-400">{feedback}</p>}

      {listOpen && (
        <div className="flex-1 overflow-y-auto pr-1">
          {poses.length === 0 ? (
            <p className="text-xs text-neutral-500">저장된 자세가 없습니다.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {poses.map((pose) => {
                const detailOpen = detailPoseId === pose.id;
                return (
                  <div
                    key={pose.id}
                    className="rounded-2xl border border-neutral-800/70 bg-neutral-950/40 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-neutral-100">
                        {pose.name}
                      </span>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => handleApplyPose(pose)}
                          className="rounded-full border border-emerald-500 bg-emerald-500/80 px-3 py-1 text-[11px] uppercase tracking-widest text-neutral-900 hover:bg-emerald-400"
                        >
                          적용
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleDetail(pose.id)}
                          className="rounded-full border border-neutral-700 bg-neutral-900/80 px-3 py-1 text-[11px] uppercase tracking-widest text-neutral-100 hover:bg-neutral-800"
                        >
                          {detailOpen ? '닫기' : '자세히'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            removePose(pose.id);
                            setFeedback(`'${pose.name}' 삭제됨`);
                            if (detailPoseId === pose.id) {
                              setDetailPoseId(null);
                            }
                          }}
                          className="rounded-full border border-rose-500 bg-rose-500/80 px-3 py-1 text-[11px] uppercase tracking-widest text-neutral-900 hover:bg-rose-400"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                    {detailOpen && (
                      <div className="mt-2 text-[11px] leading-relaxed text-neutral-400">
                        {pose.jointAnglesDeg
                          .map((angle, index) => `J${index + 1}: ${formatDegrees(angle ?? 0)}`)
                          .join(' • ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


