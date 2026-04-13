'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function TopPage() {
  const router = useRouter();
  const [nickname, setLocalNickname] = useState('');
  const [roomCode, setLocalRoomCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const setStoreNickname = useStore((state) => state.setNickname);
  const setRole = useStore((state) => state.setRole);
  const setParticipantId = useStore((state) => state.setParticipantId);
  const setRoom = useStore((state) => state.setRoom);

  const handleCreateRoom = async () => {
    if (!nickname.trim()) return alert('ニックネームを入力してください');
    setIsLoading(true);
    
    // 部屋コードの生成 (A-Z, 0-9のランダム6文字)
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // 部屋作成
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .insert([{ code, status: 'lobby' }])
      .select()
      .single();

    if (roomError || !roomData) {
      console.error(roomError);
      alert('部屋の作成に失敗しました');
      setIsLoading(false);
      return;
    }

    // 参加者(ホスト)として登録
    const { data: participantData, error: partError } = await supabase
      .from('participants')
      .insert([{ room_id: roomData.id, nickname: nickname.trim(), role: 'host' }])
      .select()
      .single();

    if (partError || !participantData) {
      console.error(partError);
      alert('参加登録に失敗しました');
      setIsLoading(false);
      return;
    }

    // ストアを更新して遷移
    setStoreNickname(nickname.trim());
    setRole('host');
    setParticipantId(participantData.id);
    setRoom(roomData.id, roomData.code);
    
    router.push(`/rooms/${roomData.code}`);
  };

  const handleJoinRoom = async () => {
    if (!nickname.trim()) return alert('ニックネームを入力してください');
    if (!roomCode.trim()) return alert('部屋コードを入力してください');
    setIsLoading(true);

    const code = roomCode.trim().toUpperCase();

    // 部屋の検索
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .single();

    if (roomError || !roomData) {
      alert('無効な部屋コードです');
      setIsLoading(false);
      return;
    }

    // 参加者(プレイヤー)として登録
    const { data: participantData, error: partError } = await supabase
      .from('participants')
      .insert([{ room_id: roomData.id, nickname: nickname.trim(), role: 'player' }])
      .select()
      .single();

    if (partError || !participantData) {
      alert('参加に失敗しました');
      setIsLoading(false);
      return;
    }

    // ストアを更新して遷移
    setStoreNickname(nickname.trim());
    setRole('player');
    setParticipantId(participantData.id);
    setRoom(roomData.id, roomData.code);

    router.push(`/rooms/${roomData.code}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl font-extrabold text-slate-800 tracking-wider">QuizArea</CardTitle>
          <CardDescription className="text-slate-500 mt-2">手書きマルチプレイクイズプラットフォーム</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">あなたのニックネーム</label>
            <Input 
              placeholder="なまえを入力..." 
              value={nickname}
              onChange={(e) => setLocalNickname(e.target.value)}
              maxLength={20}
              className="text-lg py-6"
            />
          </div>
          
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <Button 
              className="w-full text-lg py-6 font-bold" 
              onClick={handleCreateRoom}
              disabled={isLoading || !nickname.trim()}
            >
              新しく部屋を作る（ホスト）
            </Button>
            
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink-0 mx-4 text-slate-400 text-sm">または</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">部屋コード</label>
              <Input 
                placeholder="例: Q12345" 
                value={roomCode}
                onChange={(e) => setLocalRoomCode(e.target.value)}
                maxLength={10}
                className="uppercase text-lg py-6 text-center tracking-widest"
              />
              <Button 
                variant="secondary"
                className="w-full text-lg py-6 mt-2 font-bold" 
                onClick={handleJoinRoom}
                disabled={isLoading || !nickname.trim() || !roomCode.trim()}
              >
                部屋に入る
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="mt-8 text-center text-slate-400 text-sm">
        <p>※メール認証不要ですぐに遊べます</p>
      </div>
    </div>
  );
}
