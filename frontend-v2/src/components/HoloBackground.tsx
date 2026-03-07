import React, { useRef, useEffect } from 'react';

export function HoloBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;
    let time = 0;

    const dpr = window.devicePixelRatio > 1 ? 2 : 1;

    const resize = () => {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // Holographic color blobs
    const blobs = [
      { x: 0.2, y: 0.3, r: 0.4, color: [110, 236, 216], speed: 0.00015, phaseX: 0, phaseY: 0.5 },
      { x: 0.7, y: 0.2, r: 0.35, color: [180, 144, 255], speed: 0.0002, phaseX: 1.2, phaseY: 0 },
      { x: 0.5, y: 0.6, r: 0.45, color: [128, 208, 255], speed: 0.000155, phaseX: 2.4, phaseY: 1.8 },
      { x: 0.3, y: 0.8, r: 0.3, color: [245, 160, 208], speed: 0.00025, phaseX: 3.6, phaseY: 0.9 },
      { x: 0.8, y: 0.7, r: 0.35, color: [110, 236, 216], speed: 0.00015, phaseX: 0.8, phaseY: 2.5 },
      { x: 0.1, y: 0.5, r: 0.3, color: [180, 144, 255], speed: 0.00025, phaseX: 4.0, phaseY: 1.2 },
    ];

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      
      // Clear with base color
      ctx.fillStyle = '#0a0a14';
      ctx.fillRect(0, 0, w, h);

      // Draw each blob as a radial gradient
      for (const blob of blobs) {
        const cx = (blob.x + Math.sin(time * blob.speed * 2000 + blob.phaseX) * 0.15) * w;
        const cy = (blob.y + Math.cos(time * blob.speed * 2000 + blob.phaseY) * 0.1) * h;
        const radius = blob.r * Math.max(w, h);

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        const [r, g, b] = blob.color;
        grad.addColorStop(0, `rgba(${r},${g},${b},0.035)`);
        grad.addColorStop(0.4, `rgba(${r},${g},${b},0.015)`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      // Subtle swirl streaks — very faint
      ctx.globalAlpha = 0.012;
      for (let i = 0; i < 3; i++) {
        const startAngle = time * 0.0002 + i * 2.1;
        const scx = w * 0.5 + Math.cos(startAngle * 0.5) * w * 0.25;
        const scy = h * 0.5 + Math.sin(startAngle * 0.3) * h * 0.15;
        
        ctx.beginPath();
        for (let t = 0; t < Math.PI * 2; t += 0.05) {
          const sr = 120 + Math.sin(t * 2 + time * 0.0004) * 60;
          const px = scx + Math.cos(t + startAngle) * sr;
          const py = scy + Math.sin(t + startAngle) * sr * 0.6;
          if (t === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        const ci = i % blobs.length;
        const [sr, sg, sb] = blobs[ci].color;
        ctx.strokeStyle = `rgb(${sr},${sg},${sb})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      time++;
      animFrame = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        pointerEvents: 'none',
      }}
    />
  );
}
