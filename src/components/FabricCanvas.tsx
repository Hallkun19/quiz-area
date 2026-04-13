'use client';

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as fabric from 'fabric';
import { Button } from '@/components/ui/button';
import { Eraser, Pen, Trash2, Undo } from 'lucide-react';

export interface FabricCanvasRef {
  exportCanvasJSON: () => string;
  clearCanvas: () => void;
}

/** キャンバスの縦横比（height / width）。公開カードと完全に一致させる */
export const CANVAS_RATIO = 0.6; // 5:3

const COLORS = ['#0f172a', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];

const FabricCanvas = forwardRef<FabricCanvasRef, {}>((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [currentColor, setCurrentColor] = useState(COLORS[0]);
  const [brushWidth, setBrushWidth] = useState(5);
  const [isEraser, setIsEraser] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    if (!canvasRef.current || !wrapperRef.current) return;

    const wrapper = wrapperRef.current;
    const width = wrapper.clientWidth;
    const height = Math.round(width * CANVAS_RATIO);

    const initCanvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: true,
      width,
      height,
      backgroundColor: '#ffffff',
    });

    const brush = new fabric.PencilBrush(initCanvas);
    brush.color = currentColor;
    brush.width = brushWidth;
    initCanvas.freeDrawingBrush = brush;

    initCanvas.on('path:created', () => {
      setHistory(prev => [...prev, JSON.stringify(initCanvas.toJSON())]);
    });

    setCanvas(initCanvas);

    const handleResize = () => {
      if (!wrapper) return;
      const newWidth = wrapper.clientWidth;
      const newHeight = Math.round(newWidth * CANVAS_RATIO);
      initCanvas.width = newWidth;
      initCanvas.height = newHeight;
      initCanvas.renderAll();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      initCanvas.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!canvas) return;
    if (isEraser) {
      const eraserBrush = new fabric.PencilBrush(canvas);
      eraserBrush.color = '#ffffff';
      eraserBrush.width = 30;
      canvas.freeDrawingBrush = eraserBrush;
    } else {
      const brush = new fabric.PencilBrush(canvas);
      brush.color = currentColor;
      brush.width = brushWidth;
      canvas.freeDrawingBrush = brush;
    }
  }, [canvas, currentColor, brushWidth, isEraser]);

  useImperativeHandle(ref, () => ({
    exportCanvasJSON() {
      if (!canvas) return '';
      return JSON.stringify(canvas.toJSON());
    },
    clearCanvas() {
      if (!canvas) return;
      canvas.clear();
      canvas.backgroundColor = '#ffffff';
      setHistory([]);
    }
  }));

  const handleUndo = () => {
    if (!canvas || history.length === 0) return;
    const newHistory = [...history];
    newHistory.pop();
    setHistory(newHistory);
    canvas.clear();
    canvas.backgroundColor = '#ffffff';
    if (newHistory.length > 0) {
      const lastState = newHistory[newHistory.length - 1];
      canvas.loadFromJSON(lastState).then(() => {
        canvas.renderAll();
      });
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* ツールバー */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-3 rounded-lg justify-between border border-slate-200">
        <div className="flex gap-2 items-center">
          <Button variant={!isEraser ? 'default' : 'outline'} size="icon" onClick={() => setIsEraser(false)} title="ペン">
            <Pen size={18} />
          </Button>
          <Button variant={isEraser ? 'default' : 'outline'} size="icon" onClick={() => setIsEraser(true)} title="消しゴム">
            <Eraser size={18} />
          </Button>
          <div className="h-6 w-px bg-slate-300 mx-1" />
          {!isEraser && COLORS.map(color => (
            <button
              key={color}
              className={`w-8 h-8 rounded-full border-2 focus:outline-none transition-transform ${currentColor === color ? 'border-primary scale-110 shadow-md' : 'border-transparent'}`}
              style={{ backgroundColor: color }}
              onClick={() => setCurrentColor(color)}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="icon" onClick={handleUndo} disabled={history.length === 0} title="元に戻す">
            <Undo size={18} />
          </Button>
          <Button variant="destructive" size="icon" onClick={() => ref && (ref as any).current?.clearCanvas()} title="すべて消去">
            <Trash2 size={18} />
          </Button>
        </div>
      </div>

      {/* キャンバス */}
      <div ref={wrapperRef} className="border-4 border-slate-200 rounded-xl overflow-hidden shadow-inner touch-none w-full bg-white">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
});

FabricCanvas.displayName = 'FabricCanvas';
export default FabricCanvas;
