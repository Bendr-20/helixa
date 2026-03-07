import React, { useRef, useEffect } from 'react';

export function DnaBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;
    let offset = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth * (window.devicePixelRatio > 1 ? 2 : 1);
      canvas.height = canvas.offsetHeight * (window.devicePixelRatio > 1 ? 2 : 1);
      ctx.scale(window.devicePixelRatio > 1 ? 2 : 1, window.devicePixelRatio > 1 ? 2 : 1);
    };
    resize();
    window.addEventListener('resize', resize);

    const dnaColors = [
      [110, 236, 216],  // mint
      [128, 208, 255],  // sky blue
      [180, 144, 255],  // lavender
      [245, 160, 208],  // pink
      [110, 236, 216],  // mint
      [128, 208, 255],  // sky blue
      [180, 144, 255],  // lavender
    ];

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const amplitude = w * 0.3;
      const twists = 5;
      const stepsPerPixel = 0.5;
      const totalSteps = Math.ceil(h * stepsPerPixel) + 100;
      const strandRadius = Math.max(4, w * 0.022);
      const rungWidth = Math.max(2.5, w * 0.014);

      // Collect all drawable elements with z-depth for proper sorting
      const elements: { z: number; draw: () => void }[] = [];

      for (let i = 0; i < totalSteps; i++) {
        const y = (i / stepsPerPixel) - 30;
        const t = (i + offset) * 0.025;
        const phase = t * Math.PI * 2 / (totalSteps * 0.025 / twists);
        const sinP = Math.sin(phase);
        const cosP = Math.cos(phase);

        const x1 = cx + amplitude * sinP;
        const x2 = cx - amplitude * sinP;
        // z-depth: cosP determines which strand is in front
        const z1 = cosP;
        const z2 = -cosP;

        const colorIdx = (i * 0.15) % dnaColors.length;
        const ci = Math.floor(colorIdx);
        const cf = colorIdx - ci;
        const c1 = dnaColors[ci % dnaColors.length];
        const c2 = dnaColors[(ci + 1) % dnaColors.length];
        const r = Math.round(c1[0] + (c2[0] - c1[0]) * cf);
        const g = Math.round(c1[1] + (c2[1] - c1[1]) * cf);
        const b = Math.round(c1[2] + (c2[2] - c1[2]) * cf);

        // Rungs every ~8 steps
        if (i % 8 === 0 && Math.abs(sinP) > 0.15) {
          const rungZ = (z1 + z2) / 2;
          const brightness = 0.4 + 0.3 * ((rungZ + 1) / 2);
          elements.push({
            z: rungZ,
            draw: () => {
              const grad = ctx.createLinearGradient(Math.min(x1, x2), y, Math.max(x1, x2), y);
              const rc1 = dnaColors[ci % dnaColors.length];
              const rc2 = dnaColors[(ci + 4) % dnaColors.length];
              grad.addColorStop(0, `rgba(${rc1[0]},${rc1[1]},${rc1[2]},${brightness})`);
              grad.addColorStop(0.5, `rgba(255,255,255,${brightness * 0.3})`);
              grad.addColorStop(1, `rgba(${rc2[0]},${rc2[1]},${rc2[2]},${brightness})`);
              ctx.beginPath();
              ctx.moveTo(Math.min(x1, x2) + strandRadius, y);
              ctx.lineTo(Math.max(x1, x2) - strandRadius, y);
              ctx.strokeStyle = grad;
              ctx.lineWidth = rungWidth;
              ctx.lineCap = 'round';
              ctx.stroke();
            }
          });
        }

        // Strand 1 segment
        if (i > 0) {
          const prevY = ((i - 1) / stepsPerPixel) - 30;
          const prevT = ((i - 1) + offset) * 0.025;
          const prevPhase = prevT * Math.PI * 2 / (totalSteps * 0.025 / twists);
          const prevX1 = cx + amplitude * Math.sin(prevPhase);

          const brightness1 = 0.5 + 0.5 * ((z1 + 1) / 2);
          const radius1 = strandRadius * (0.6 + 0.4 * ((z1 + 1) / 2));

          elements.push({
            z: z1,
            draw: () => {
              // Main strand
              ctx.beginPath();
              ctx.moveTo(prevX1, prevY);
              ctx.lineTo(x1, y);
              ctx.strokeStyle = `rgba(${r},${g},${b},${brightness1})`;
              ctx.lineWidth = radius1 * 2;
              ctx.lineCap = 'round';
              ctx.stroke();

              // Highlight (3D tube effect)
              ctx.beginPath();
              ctx.moveTo(prevX1 - radius1 * 0.3, prevY);
              ctx.lineTo(x1 - radius1 * 0.3, y);
              ctx.strokeStyle = `rgba(255,255,255,${brightness1 * 0.25})`;
              ctx.lineWidth = radius1 * 0.6;
              ctx.stroke();
            }
          });

          // Strand 2 segment
          const prevX2 = cx - amplitude * Math.sin(prevPhase);
          const brightness2 = 0.5 + 0.5 * ((z2 + 1) / 2);
          const radius2 = strandRadius * (0.6 + 0.4 * ((z2 + 1) / 2));

          const r2i = (ci + 3) % dnaColors.length;
          const c2a = dnaColors[r2i];
          const c2b = dnaColors[(r2i + 1) % dnaColors.length];
          const rr = Math.round(c2a[0] + (c2b[0] - c2a[0]) * cf);
          const gg = Math.round(c2a[1] + (c2b[1] - c2a[1]) * cf);
          const bb = Math.round(c2a[2] + (c2b[2] - c2a[2]) * cf);

          elements.push({
            z: z2,
            draw: () => {
              ctx.beginPath();
              ctx.moveTo(prevX2, prevY);
              ctx.lineTo(x2, y);
              ctx.strokeStyle = `rgba(${rr},${gg},${bb},${brightness2})`;
              ctx.lineWidth = radius2 * 2;
              ctx.lineCap = 'round';
              ctx.stroke();

              ctx.beginPath();
              ctx.moveTo(prevX2 - radius2 * 0.3, prevY);
              ctx.lineTo(x2 - radius2 * 0.3, y);
              ctx.strokeStyle = `rgba(255,255,255,${brightness2 * 0.25})`;
              ctx.lineWidth = radius2 * 0.6;
              ctx.stroke();
            }
          });
        }
      }

      // Sort by z-depth (back to front) and draw
      elements.sort((a, b) => a.z - b.z);
      for (const el of elements) {
        el.draw();
      }

      offset += 0.15;
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
      className="dna-canvas-bg"
      aria-hidden="true"
    />
  );
}
