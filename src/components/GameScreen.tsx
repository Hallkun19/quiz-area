'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FabricCanvas, { FabricCanvasRef } from './FabricCanvas';
import { supabase } from '@/lib/supabase';

interface GameScreenProps {
  roomId: string;
  roomCode: string;
  role: string;
  participantId: string;
  onReveal: () => void;
}

export default function GameScreen({ roomId, roomCode, role, participantId, onReveal }: GameScreenProps) {
  const canvasRef = useRef<FabricCanvasRef>(null);
  const [questionText, setQuestionText] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState<{ id: string; question_text: string } | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [waitingForQuestion, setWaitingForQuestion] = useState(true);

  useEffect(() => {
    // マウント時に「新しい問題を待つ」状態にする。
    // ただしホストが出題した直後に playing に切り替わるケースに備え、
    // 最新の問題について「自分がまだ提出していない」ならそれを表示する。
    const fetchLatestQuestion = async () => {
      const { data: q } = await supabase
        .from('questions')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (q) {
        // 自分がこの問題に既に提出済みか確認
        const { data: mySubmission } = await supabase
          .from('submissions')
          .select('id')
          .eq('question_id', q.id)
          .eq('participant_id', participantId)
          .maybeSingle();

        if (mySubmission) {
          // 前のラウンドの問題 → 無視して待機
          setCurrentQuestion(null);
          setWaitingForQuestion(true);
        } else {
          // まだ未回答の問題がある → 表示
          setCurrentQuestion(q);
          setWaitingForQuestion(false);
        }
      } else {
        setWaitingForQuestion(true);
      }
    };

    fetchLatestQuestion();

    // 新しい問題の追加を監視
    const qChannel = supabase.channel(`questions-${roomId}-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'questions', filter: `room_id=eq.${roomId}` }, (payload) => {
        setCurrentQuestion(payload.new as any);
        setIsSubmitted(false);
        setWaitingForQuestion(false);
        canvasRef.current?.clearCanvas();
        setSubmissionCount(0);
      })
      .subscribe();

    // 提出状況を監視（ホスト向け）
    const sChannel = supabase.channel(`submissions-${roomId}-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'submissions', filter: `question_id=eq.${currentQuestion?.id || '00000000-0000-0000-0000-000000000000'}` }, () => {
        setSubmissionCount((prev) => prev + 1);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(qChannel);
      supabase.removeChannel(sChannel);
    };
  }, [roomId, participantId]);

  const handleAskQuestion = async () => {
    if (!questionText.trim()) return;
    await supabase.from('questions').insert([{
      room_id: roomId,
      question_text: questionText.trim(),
    }]);
    setQuestionText('');
  };

  const handleSubmitAnswer = async () => {
    if (!currentQuestion || !canvasRef.current || isSubmitted) return;
    const canvasData = canvasRef.current.exportCanvasJSON();
    const { error } = await supabase.from('submissions').insert([{
      question_id: currentQuestion.id,
      participant_id: participantId,
      canvas_data: canvasData
    }]);
    if (!error) {
      setIsSubmitted(true);
    } else {
      alert('提出に失敗しました');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
      {/* ホスト用コントロールパネル */}
      {role === 'host' && (
        <div className="rounded-xl border-2 border-indigo-100 shadow-lg overflow-hidden">
          <div className="bg-indigo-50 border-b border-indigo-100 py-3 px-4">
            <h3 className="text-indigo-900 text-base font-semibold">ホストコントロール</h3>
          </div>
          <div className="bg-white pt-4 pb-4 px-4 space-y-3">
            <div className="flex gap-3">
              <Input
                placeholder="新しい問題を入力してください"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
                className="text-base py-5 shadow-sm"
              />
              <Button size="lg" className="px-6 font-bold" onClick={handleAskQuestion}>出題する</Button>
            </div>
            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
              <div className="text-slate-600 font-semibold text-sm">提出数: <span className="text-xl text-primary">{submissionCount}</span></div>
              <Button variant="secondary" size="default" className="font-bold border-2 border-slate-200" onClick={onReveal}>
                回答を一斉公開する！
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 問題文表示エリア */}
      {currentQuestion ? (
        <div className="bg-white rounded-xl shadow-lg p-4 text-center border-l-8 border-l-primary">
          <h2 className="text-xs font-bold tracking-widest text-primary uppercase mb-1">現在の問題</h2>
          <p className="text-2xl font-extrabold text-slate-800 break-words">{currentQuestion.question_text}</p>
        </div>
      ) : (
        <div className="bg-slate-100 rounded-xl shadow-sm p-8 text-center text-slate-400 font-bold text-xl">
          {waitingForQuestion ? 'ホストの出題を待っています...' : '読み込み中...'}
        </div>
      )}

      {/* プレイヤーの回答エリア */}
      {role !== 'viewer' && currentQuestion && (
        <div className="space-y-4">
          <div className="relative">
            <FabricCanvas ref={canvasRef} />
            {isSubmitted && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-xl border-4 border-slate-200">
                <div className="text-4xl font-black text-green-500 mb-4 animate-bounce">提出完了！</div>
                <p className="font-bold text-slate-600">他の人の提出と正解発表を待っています...</p>
              </div>
            )}
          </div>
          <div className="flex justify-center">
            {role !== 'host' && !isSubmitted && (
              <Button
                size="lg"
                className="w-full max-w-md py-8 text-2xl font-black tracking-widest shadow-lg hover:scale-105 transition-transform"
                onClick={handleSubmitAnswer}
              >
                回答を提出する
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
