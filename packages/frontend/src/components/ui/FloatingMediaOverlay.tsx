import React, { useEffect, useRef, useState } from 'react';

interface FloatingMediaOverlayProps {
  stream?: MediaStream | null;
  visible: boolean;
  onClose?: () => void;
  position?: 'center' | 'side';
  initialSize?: { width: number; height: number };
  className?: string;
}

// Simple draggable + resizable floating overlay for video "blobs"
export const FloatingMediaOverlay: React.FC<FloatingMediaOverlayProps> = ({
  stream,
  visible,
  onClose,
  position = 'center',
  initialSize = { width: 960, height: 540 },
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [size, setSize] = useState(initialSize);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      (videoRef.current as any).srcObject = stream;
      const v = videoRef.current;
      const onLoaded = async () => {
        try { await v!.play(); } catch (_) {}
      };
      v!.onloadedmetadata = onLoaded;
      return () => { if (v) v.onloadedmetadata = null; };
    }
  }, [stream]);

  useEffect(() => {
    if (!visible) return;
    // Center by default
    if (containerRef.current && position === 'center') {
      const el = containerRef.current;
      el.style.left = `calc(50% - ${size.width / 2}px)`;
      el.style.top = `calc(50% - ${size.height / 2}px)`;
    } else if (containerRef.current && position === 'side') {
      const el = containerRef.current;
      el.style.right = '24px';
      el.style.top = '24px';
    }
  }, [visible, position, size]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setDragging(true);
    const rect = containerRef.current.getBoundingClientRect();
    setOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  const onMouseMove = (e: MouseEvent) => {
    if (!dragging || !containerRef.current || !offset) return;
    const el = containerRef.current;
    el.style.left = `${Math.max(8, e.clientX - offset.x)}px`;
    el.style.top = `${Math.max(8, e.clientY - offset.y)}px`;
  };
  const onMouseUp = () => setDragging(false);

  useEffect(() => {
    if (!visible) return;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [visible, dragging, offset]);

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      className={`fixed z-[1000] shadow-2xl rounded-xl overflow-hidden bg-black/90 border border-white/10 ${className}`}
      style={{ width: size.width, height: size.height }}
    >
      <div
        className="cursor-move text-white/80 text-xs px-3 py-2 bg-black/40 flex items-center justify-between select-none"
        onMouseDown={onMouseDown}
      >
        <span>Live Preview</span>
        <div className="space-x-2">
          <button
            onClick={() => setSize(s => ({ width: Math.max(320, s.width * 0.9), height: Math.max(180, s.height * 0.9) }))}
            className="px-2 py-0.5 bg-white/10 rounded hover:bg-white/20"
          >
            −
          </button>
          <button
            onClick={() => setSize(s => ({ width: Math.min(window.innerWidth - 32, s.width * 1.1), height: Math.min(window.innerHeight - 32, s.height * 1.1) }))}
            className="px-2 py-0.5 bg-white/10 rounded hover:bg-white/20"
          >
            +
          </button>
          {onClose && (
            <button onClick={onClose} className="px-2 py-0.5 bg-red-500/70 rounded hover:bg-red-500 text-white">×</button>
          )}
        </div>
      </div>
      <video ref={videoRef} autoPlay muted playsInline className="w-full h-[calc(100%-32px)] object-cover" />
    </div>
  );
};

export default FloatingMediaOverlay;
