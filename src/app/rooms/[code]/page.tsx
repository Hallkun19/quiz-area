'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import Lobby from '@/components/Lobby';
import GameScreen from '@/components/GameScreen';
import RevealScreen from '@/components/RevealScreen';

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;

  const { role, participantId, nickname, roomId } = useStore();
  const [roomStatus, setRoomStatus] = useState<'lobby' | 'playing' | 'revealed' | 'finished'>('lobby');
  const [loading, setLoading] = useState(true);
  // ラウンドキー: playing に入るたびインクリメントして GameScreen をフルリマウントさせる
  const [roundKey, setRoundKey] = useState(0);

  useEffect(() => {
    if (!role || !participantId || !roomId) {
      router.push('/');
      return;
    }

    const initRoom = async () => {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code)
        .single();

      if (error || !data) {
        alert('部屋が見つかりません');
        router.push('/');
        return;
      }
      setRoomStatus(data.status);
      setLoading(false);
    };

    initRoom();

    const roomSubscription = supabase
      .channel(`room-${code}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${code}` },
        (payload) => {
          const newStatus = payload.new.status;
          if (newStatus) {
            setRoomStatus((prev) => {
              // revealed → playing に切り替わったらラウンドキーを更新
              if (prev === 'revealed' && newStatus === 'playing') {
                setRoundKey((k) => k + 1);
              }
              return newStatus as any;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomSubscription);
    };
  }, [code, role, participantId, roomId, router]);

  const updateStatus = useCallback(async (newStatus: 'lobby' | 'playing' | 'revealed' | 'finished') => {
    // ホスト側のローカル状態も即座に更新（オプティミスティック）
    setRoomStatus((prev) => {
      if (prev === 'revealed' && newStatus === 'playing') {
        setRoundKey((k) => k + 1);
      }
      return newStatus;
    });
    await supabase.from('rooms').update({ status: newStatus }).eq('code', code);
  }, [code]);

  if (loading || !roomId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-xl font-bold animate-pulse text-slate-400">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-6 pb-16">
      {roomStatus === 'lobby' && (
        <Lobby roomCode={code} roomId={roomId as string} role={role as string} onStartGame={() => updateStatus('playing')} />
      )}

      {roomStatus === 'playing' && (
        <GameScreen
          key={roundKey}
          roomId={roomId as string}
          roomCode={code}
          role={role as string}
          participantId={participantId as string}
          onReveal={() => updateStatus('revealed')}
        />
      )}

      {roomStatus === 'revealed' && (
        <RevealScreen
          roomId={roomId as string}
          role={role as string}
          onNextQuestion={() => updateStatus('playing')}
          onBackToLobby={() => updateStatus('lobby')}
        />
      )}
    </div>
  );
}
