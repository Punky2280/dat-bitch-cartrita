import React, { useRef, useEffect, useState } from "react";
import { colors } from "@/theme/tokens";

interface AudioVisualizerProps {
  isRecording: boolean;
  audioStream?: MediaStream | null;
  width?: number;
  height?: number;
  barColor?: string;
  backgroundColor?: string;
  sensitivity?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isRecording,
  audioStream,
  width = 300,
  height = 60,
  barColor = colors.accentMint,
  backgroundColor = "rgba(0, 0, 0, 0.2)",
  sensitivity = 1.0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (isRecording && audioStream) {
      initializeAudioAnalysis();
      setIsActive(true);
    } else {
      cleanup();
      setIsActive(false);
    }

    return () => cleanup();
  }, [isRecording, audioStream]);

  const initializeAudioAnalysis = async () => {
    if (!audioStream || !canvasRef.current) return;

    try {
      // Create audio context and analyzer
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const analyzer = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(audioStream);

      // Configure analyzer
      analyzer.fftSize = 256;
      analyzer.smoothingTimeConstant = 0.8;
      source.connect(analyzer);

      audioContextRef.current = audioContext;
      analyzerRef.current = analyzer;

      // Start visualization
      visualize();
    } catch (error) {
      console.error(
        "[AudioVisualizer] Failed to initialize audio analysis:",
        error,
      );
    }
  };

  const visualize = () => {
    if (!analyzerRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const analyzer = analyzerRef.current;
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isRecording) {
        // Draw inactive state
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return;
      }

      analyzer.getByteFrequencyData(dataArray);

      // Clear canvas
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Calculate bar dimensions
      const barCount = 32; // Number of frequency bars
      const barWidth = canvas.width / barCount;
      const maxBarHeight = canvas.height - 10;

      // Draw frequency bars
      for (let i = 0; i < barCount; i++) {
        // Sample frequency data (we have more data points than bars)
        const dataIndex = Math.floor((i * bufferLength) / barCount);
        const barHeight = Math.max(
          2,
          (dataArray[dataIndex] / 255) * maxBarHeight * sensitivity,
        );

        // Create gradient for each bar
        const gradient = ctx.createLinearGradient(
          0,
          canvas.height,
          0,
          canvas.height - barHeight,
        );
        gradient.addColorStop(0, barColor);
        gradient.addColorStop(1, barColor + "60"); // More transparent at top

        ctx.fillStyle = gradient;
        ctx.fillRect(
          i * barWidth + 1,
          canvas.height - barHeight,
          barWidth - 2,
          barHeight,
        );
      }

      // Add pulse effect for active recording
      if (isRecording) {
        const pulseAlpha = 0.1 + 0.1 * Math.sin(Date.now() * 0.005);
        ctx.fillStyle = `${barColor}${Math.floor(pulseAlpha * 255)
          .toString(16)
          .padStart(2, "0")}`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  const cleanup = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyzerRef.current = null;
  };

  return (
    <div className="audio-visualizer-container">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={`audio-visualizer ${isActive ? "active" : "inactive"}`}
        style={{
          border: `1px solid ${isActive ? barColor : colors.gray600}`,
          borderRadius: "8px",
          background: backgroundColor,
          transition: "border-color 0.3s ease",
          boxShadow: isActive ? `0 0 20px ${barColor}40` : "none",
          opacity: isActive ? 1 : 0.6,
        }}
      />
      {isActive && (
        <div
          className="recording-indicator"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: "8px",
            fontSize: "12px",
            color: barColor,
            fontWeight: "bold",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              backgroundColor: barColor,
              borderRadius: "50%",
              marginRight: "6px",
              animation: "pulse 1.5s infinite",
            }}
          />
          Recording Audio...
        </div>
      )}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
};
