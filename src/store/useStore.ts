import { create } from 'zustand';

interface UserState {
  nickname: string;
  role: 'host' | 'player' | 'viewer' | null;
  participantId: string | null;
  roomId: string | null;
  roomCode: string | null;
  setNickname: (name: string) => void;
  setRole: (role: 'host' | 'player' | 'viewer') => void;
  setParticipantId: (id: string) => void;
  setRoom: (id: string, code: string) => void;
  clearRoom: () => void;
}

export const useStore = create<UserState>((set) => ({
  nickname: '',
  role: null,
  participantId: null,
  roomId: null,
  roomCode: null,
  setNickname: (name) => set({ nickname: name }),
  setRole: (role) => set({ role }),
  setParticipantId: (id) => set({ participantId: id }),
  setRoom: (id, code) => set({ roomId: id, roomCode: code }),
  clearRoom: () => set({ roomId: null, roomCode: null, role: null, participantId: null }),
}));
