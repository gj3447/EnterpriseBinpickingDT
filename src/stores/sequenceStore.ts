"use client";

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface SequenceFile {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

interface SequenceStoreState {
  sequences: SequenceFile[];
  activeId: string | null;
  createSequence: (name?: string) => SequenceFile;
  updateSequence: (id: string, updates: Partial<Pick<SequenceFile, 'name' | 'content'>>) => void;
  deleteSequence: (id: string) => void;
  setActiveSequence: (id: string | null) => void;
}

const normalizeName = (value?: string) => value?.trim().toLowerCase() ?? '';
const sanitizeName = (value?: string) => value?.trim() ?? '';
const MAX_SEQUENCE_COUNT = 100;

const createSequenceFile = (name: string): SequenceFile => ({
  id: name,
  name,
  content: '',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const getDefaultName = (existing: SequenceFile[]) => {
  let index = existing.length + 1;
  let candidate = `시퀀스 ${index}`;
  while (existing.some((seq) => normalizeName(seq.name) === normalizeName(candidate))) {
    index += 1;
    candidate = `시퀀스 ${index}`;
  }
  return candidate;
};

export const useSequenceStore = create<SequenceStoreState>()(
  persist(
    (set, get) => ({
      sequences: [],
      activeId: null,
      createSequence: (name) => {
        const existing = get().sequences;
        const rawName = sanitizeName(name);
        const nextName = rawName || getDefaultName(existing);
        const normalized = normalizeName(nextName);
        const withoutDuplicate = existing.filter(
          (seq) => normalizeName(seq.name) !== normalized
        );
        const newSequence = createSequenceFile(nextName);
        const nextSequences = [newSequence, ...withoutDuplicate].slice(0, MAX_SEQUENCE_COUNT);
        set({ sequences: nextSequences, activeId: newSequence.id });
        return newSequence;
      },
      updateSequence: (id, updates) =>
        set((state) => {
          const nextSequences = state.sequences.map((seq) => {
            if (seq.id !== id) {
              return seq;
            }
            const nextName = updates.name ? sanitizeName(updates.name) : seq.name;
            const updated: SequenceFile = {
              ...seq,
              name: nextName,
              id: nextName,
              content: updates.content ?? seq.content,
              updatedAt: Date.now(),
            };
            return updated;
          });
          const deduped = nextSequences.reduce<SequenceFile[]>((acc, seq) => {
            const normalized = normalizeName(seq.name);
            const existingIndex = acc.findIndex(
              (candidate) => normalizeName(candidate.name) === normalized
            );
            if (existingIndex >= 0) {
              acc.splice(existingIndex, 1, seq);
            } else {
              acc.push(seq);
            }
            return acc;
          }, []);
          return {
            sequences: deduped,
            activeId: deduped.some((seq) => seq.id === state.activeId) ? state.activeId : deduped[0]?.id ?? null,
          };
        }),
      deleteSequence: (id) =>
        set((state) => {
          const nextSequences = state.sequences.filter((seq) => seq.id !== id);
          const nextActive = state.activeId === id ? nextSequences[0]?.id ?? null : state.activeId;
          return { sequences: nextSequences, activeId: nextActive };
        }),
      setActiveSequence: (id) =>
        set((state) => ({
          activeId: id ?? state.sequences[0]?.id ?? null,
        })),
    }),
    {
      name: 'robot-sequence-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sequences: state.sequences,
        activeId: state.activeId,
      }),
      version: 1,
    }
  )
);


