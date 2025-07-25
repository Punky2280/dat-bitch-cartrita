import React, { useEffect, useRef, useState } from 'react';

interface FractalVisualizerProps {
  className?: string;
}

export const FractalVisualizer: React.FC<FractalVisualizerProps> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isAnimating, setIsAnimating] = useState(true);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 400;
    canvas.height = 400;

    let time = 0;

    const drawFractal = () => {
      ctx.fillStyle = '#000011';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Draw animated fractal pattern
      for (let i = 0; i < 100; i++) {
        const angle = (i * 0.1) + (time * 0.01);
        const radius = 50 + Math.sin(time * 0.005 + i * 0.1) * 30;
        
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        // Create gradient effect
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 10);
        gradient.addColorStop(0, `hsl(${(time + i * 3) % 360}, 70%, 60%)`);
        gradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      time++;
      
      if (isAnimating) {
        animationRef.current = requestAnimationFrame(drawFractal);
      }
    };

    if (isAnimating) {
      drawFractal();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAnimating]);

  const toggleAnimation = () => {
    setIsAnimating(!isAnimating);
  };

  return (
    <div className={`fractal-visualizer ${className}`}>
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">Fractal Visualizer</h3>
          <button
            onClick={toggleAnimation}
            className={`px-3 py-1 rounded text-sm ${
              isAnimating 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isAnimating ? 'Pause' : 'Play'}
          </button>
        </div>
        
        <canvas
          ref={canvasRef}
          className="border border-gray-600 rounded"
          style={{ maxWidth: '100%', height: 'auto' }}
        />
        
        <div className="mt-2 text-sm text-gray-400">
          Animated fractal pattern - {isAnimating ? 'Running' : 'Paused'}
        </div>
      </div>
    </div>
  );
};
