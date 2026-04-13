'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import * as fabric from 'fabric';
import { CANVAS_RATIO } from './FabricCanvas';

interface RevealScreenProps {
  roomId: string;
  role: string;
  onNextQuestion: () => void;
  onBackToLobby: () => void;
}

export default function RevealScreen({ roomId, role, onNextQuestion, onBackToLobby }: RevealScreenProps) {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [question, setQuestion] = useState<{ id: string; question_text: string } | null>(null);
  const [announced, setAnnounced] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    // 1つのチャネルを作成し、送受信両方に使う
    const channel = supabase.channel(`reveal-${roomId}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'results_announced' }, () => {
        setAnnounced(true);
        // 最新の提出データを再取得
        fetchLatestSubmissions();
      })
      .subscribe();

    // 初期データ取得
    const fetchRevealData = async () => {
      const { data: qData } = await supabase
        .from('questions')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (qData) {
        setQuestion(qData);
        const { data: sData } = await supabase
          .from('submissions')
          .select(`
            id, canvas_data, is_correct, participant_id,
            participants(nickname)
          `)
          .eq('question_id', qData.id);
        if (sData) setSubmissions(sData);
      }
    };

    fetchRevealData();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const fetchLatestSubmissions = async () => {
    const { data: qData } = await supabase
      .from('questions')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (qData) {
      const { data: sData } = await supabase
        .from('submissions')
        .select(`
          id, canvas_data, is_correct, participant_id,
          participants(nickname)
        `)
        .eq('question_id', qData.id);
      if (sData) setSubmissions(sData);
    }
  };

  const handleMarkCorrect = async (subId: string, currentCorrect: boolean, participantId: string) => {
    if (role !== 'host' || announced) return;

    const isNowCorrect = !currentCorrect;
    setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, is_correct: isNowCorrect } : s));
    await supabase.from('submissions').update({ is_correct: isNowCorrect }).eq('id', subId);

    const { data: pData } = await supabase.from('participants').select('score').eq('id', participantId).single();
    if (pData) {
      await supabase.from('participants').update({ score: pData.score + (isNowCorrect ? 1 : -1) }).eq('id', participantId);
    }
  };

  const handleAnnounce = async () => {
    if (!channelRef.current) return;
    // 同じチャネルインスタンスから送信
    await channelRef.current.send({
      type: 'broadcast',
      event: 'results_announced',
      payload: {},
    });
    setAnnounced(true);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 space-y-6">
      {question && (
        <div className="bg-white rounded-xl shadow-lg p-4 text-center border-l-8 border-l-primary">
          <h2 className="text-xs font-bold tracking-widest text-primary uppercase mb-1">出題</h2>
          <p className="text-2xl font-extrabold text-slate-800 break-words">{question.question_text}</p>
        </div>
      )}

      {/* ホスト操作バー */}
      {role === 'host' && (
        <div className="bg-slate-800 text-white p-4 rounded-xl shadow-xl space-y-3">
          {!announced ? (
            <>
              <p className="font-bold text-sm">正解だと思うパネルをタップして選んでください</p>
              <Button className="w-full py-6 text-lg font-black bg-green-500 hover:bg-green-600" onClick={handleAnnounce}>
                🎉 結果を発表する！
              </Button>
            </>
          ) : (
            <div className="flex gap-3 items-center justify-between">
              <p className="font-bold text-green-300">✅ 結果発表済み</p>
              <div className="flex gap-2">
                <Button className="font-bold bg-primary hover:bg-primary/90" onClick={onNextQuestion}>
                  次の問題へ
                </Button>
                <Button variant="outline" className="font-bold text-slate-300 border-slate-500 hover:bg-slate-700" onClick={onBackToLobby}>
                  ロビーに戻る
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* プレイヤー用ステータス */}
      {role !== 'host' && !announced && (
        <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-xl text-center">
          <p className="font-bold text-amber-700 animate-pulse">ホストが正解を選んでいます... お待ちください</p>
        </div>
      )}
      {role !== 'host' && announced && (
        <div className="bg-green-50 border-2 border-green-200 p-4 rounded-xl text-center">
          <p className="font-bold text-green-700">🎉 結果が発表されました！</p>
        </div>
      )}

      {/* 回答カードグリッド */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {submissions.map((sub) => (
          <CanvasImageCard
            key={sub.id}
            submission={sub}
            isHost={role === 'host'}
            canMark={role === 'host' && !announced}
            showCorrect={role === 'host' || announced}
            onToggleCorrect={() => handleMarkCorrect(sub.id, sub.is_correct, sub.participant_id)}
          />
        ))}
        {submissions.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 font-bold">
            提出された回答がありません
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Fabric.js JSON → オフスクリーン描画 → PNG → <img> 表示
 */
function CanvasImageCard({
  submission,
  isHost,
  canMark,
  showCorrect,
  onToggleCorrect,
}: {
  submission: any;
  isHost: boolean;
  canMark: boolean;
  showCorrect: boolean;
  onToggleCorrect: () => void;
}) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!submission.canvas_data) return;

    const OFFSCREEN_W = 1000;
    const OFFSCREEN_H = Math.round(OFFSCREEN_W * CANVAS_RATIO);

    const offscreen = document.createElement('canvas');
    offscreen.width = OFFSCREEN_W;
    offscreen.height = OFFSCREEN_H;

    const staticCanvas = new fabric.StaticCanvas(offscreen, {
      width: OFFSCREEN_W,
      height: OFFSCREEN_H,
      backgroundColor: '#ffffff',
    });

    let disposed = false;

    try {
      const jsonData = typeof submission.canvas_data === 'string'
        ? JSON.parse(submission.canvas_data)
        : submission.canvas_data;

      staticCanvas.loadFromJSON(jsonData).then(() => {
        if (disposed) return;
        staticCanvas.renderAll();
        const dataUrl = staticCanvas.toDataURL({ format: 'png', multiplier: 1 });
        setImageSrc(dataUrl);
        staticCanvas.dispose();
      }).catch((err: unknown) => {
        console.error('loadFromJSON failed', err);
        if (!disposed) staticCanvas.dispose();
      });
    } catch (e) {
      console.error('Failed to parse canvas json', e);
      staticCanvas.dispose();
    }

    return () => { disposed = true; };
  }, [submission.canvas_data]);

  const isCorrect = showCorrect && submission.is_correct;

  return (
    <div
      className={`rounded-xl overflow-hidden transition-all transform shadow-md ${canMark ? 'cursor-pointer hover:scale-105' : ''} ${isCorrect ? 'ring-4 ring-green-500 shadow-green-200' : 'hover:shadow-xl'}`}
      onClick={() => { if (canMark) onToggleCorrect(); }}
    >
      {/* ヘッダー */}
      <div className={`px-4 py-3 flex justify-between items-center ${isCorrect ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>
        <span className="font-bold text-base">
          {submission.participants?.nickname || '無名'}
        </span>
        <span>
          {isCorrect && <span className="text-2xl">⭕</span>}
          {!showCorrect && submission.is_correct && isHost && <span className="text-sm text-blue-500 font-bold">✓ 選択中</span>}
        </span>
      </div>
      {/* キャンバス画像 */}
      <div className="bg-white">
        {imageSrc ? (
          <img src={imageSrc} alt="回答" className="w-full h-auto block" draggable={false} />
        ) : (
          <div className="flex items-center justify-center bg-slate-50 text-slate-300 font-bold" style={{ aspectRatio: `1 / ${CANVAS_RATIO}` }}>
            読み込み中...
          </div>
        )}
      </div>
    </div>
  );
}
