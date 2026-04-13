'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Participant {
  id: string;
  nickname: string;
  role: string;
  score: number;
}

interface LobbyProps {
  roomCode: string;
  roomId: string;
  role: string;
  onStartGame: () => void;
}

export default function Lobby({ roomCode, roomId, role, onStartGame }: LobbyProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    // 参加者リストの初回フェッチ
    const fetchParticipants = async () => {
      const { data } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });
      if (data) setParticipants(data);
    };

    fetchParticipants();

    // 参加者の増減を検知
    const channel = supabase
      .channel(`participants-${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `room_id=eq.${roomId}` },
        () => {
          fetchParticipants(); // 変更があったら再取得（簡単のため）
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="text-center shadow-lg border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">部屋コード</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-5xl font-black tracking-widest text-primary">{roomCode}</div>
            <div className="flex justify-center p-4">
              <QRCodeSVG 
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/rooms/${roomCode}`} 
                size={200}
                bgColor={"#ffffff"}
                fgColor={"#0f172a"}
                level={"L"}
                includeMargin={false}
              />
            </div>
            <p className="text-sm text-slate-500">
              スマホのカメラでスキャンするか、<br/>トップページからコードを入力して参加！
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">参加者リスト ({participants.length}人)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {participants.map((p) => (
                <li key={p.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-800">{p.nickname}</span>
                    <span className="text-xs px-2 py-1 bg-slate-200 text-slate-600 rounded uppercase font-bold tracking-wider">
                      {p.role}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-slate-500 mr-1">スコア:</span>
                    <span className="text-xl font-black text-primary">{p.score}</span>
                  </div>
                </li>
              ))}
            </ul>

            {role === 'host' ? (
              <Button 
                className="w-full mt-6 text-lg py-6 font-bold animate-pulse hover:animate-none"
                onClick={onStartGame}
              >
                ゲームを開始する！
              </Button>
            ) : (
              <div className="mt-6 text-center text-slate-500 font-semibold py-4 bg-slate-50 rounded text-sm">
                ホストが開始するのを待っています...
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
