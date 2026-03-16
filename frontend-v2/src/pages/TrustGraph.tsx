import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../lib/constants';

interface GNode {
  id: number;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  edges: number;
}

interface GEdge {
  from: number;
  to: number;
  reciprocated: boolean;
  createdAt: string;
}

export default function TrustGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string; edges: number } | null>(null);
  const nodesRef = useRef<GNode[]>([]);
  const edgesRef = useRef<GEdge[]>([]);
  const animRef = useRef<number>(0);
  const panRef = useRef({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef<{ dragging: boolean; lastX: number; lastY: number }>({ dragging: false, lastX: 0, lastY: 0 });

  useEffect(() => {
    fetch(`${API_URL}/trust-graph`)
      .then(r => r.json())
      .then(data => {
        if (!data.nodes?.length) { setEmpty(true); setLoading(false); return; }

        const edgeCounts = new Map<number, number>();
        for (const e of data.edges) {
          edgeCounts.set(e.from, (edgeCounts.get(e.from) || 0) + 1);
          edgeCounts.set(e.to, (edgeCounts.get(e.to) || 0) + 1);
        }

        nodesRef.current = data.nodes.map((n: any, i: number) => ({
          ...n,
          x: Math.cos(i * 2.4) * 150 + (Math.random() - 0.5) * 50,
          y: Math.sin(i * 2.4) * 150 + (Math.random() - 0.5) * 50,
          vx: 0, vy: 0,
          edges: edgeCounts.get(n.id) || 0,
        }));
        edgesRef.current = data.edges;
        setLoading(false);
      })
      .catch(() => { setEmpty(true); setLoading(false); });
  }, []);

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const canvas = canvasRef.current!;
    const p = panRef.current;
    return {
      x: (sx - canvas.width / 2 - p.x) / p.scale,
      y: (sy - canvas.height / 2 - p.y) / p.scale,
    };
  }, []);

  const getRadius = useCallback((n: GNode) => 28 + n.edges * 8, []);

  const findNode = useCallback((wx: number, wy: number): GNode | null => {
    for (const n of nodesRef.current) {
      const r = 28 + n.edges * 8;
      if ((n.x - wx) ** 2 + (n.y - wy) ** 2 < (r + 10) ** 2) return n;
    }
    return null;
  }, []);

  // Animation loop
  useEffect(() => {
    if (loading || empty) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    const resize = () => { canvas.width = canvas.parentElement!.clientWidth; canvas.height = canvas.parentElement!.clientHeight; };
    resize();
    window.addEventListener('resize', resize);

    const nodeMap = new Map(nodesRef.current.map(n => [n.id, n]));

    let iteration = 0;
    let time = 0;
    const tick = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const damping = Math.max(0.85, 0.99 - iteration * 0.0005);
      iteration++;
      time += 0.02;

      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          let dx = nodes[j].x - nodes[i].x;
          let dy = nodes[j].y - nodes[i].y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const force = 8000 / (dist * dist);
          dx /= dist; dy /= dist;
          nodes[i].vx -= dx * force;
          nodes[i].vy -= dy * force;
          nodes[j].vx += dx * force;
          nodes[j].vy += dy * force;
        }
      }

      // Attraction along edges
      for (const e of edges) {
        const a = nodeMap.get(e.from);
        const b = nodeMap.get(e.to);
        if (!a || !b) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = (dist - 180) * 0.008;
        dx /= dist; dy /= dist;
        a.vx += dx * force;
        a.vy += dy * force;
        b.vx -= dx * force;
        b.vy -= dy * force;
      }

      // Center gravity
      for (const n of nodes) {
        n.vx -= n.x * 0.001;
        n.vy -= n.y * 0.001;
        n.vx *= damping;
        n.vy *= damping;
        n.x += n.vx;
        n.y += n.vy;
      }

      // Draw
      const p = panRef.current;
      ctx.fillStyle = '#08060e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2 + p.x, canvas.height / 2 + p.y);
      ctx.scale(p.scale, p.scale);

      // Edges — glowing lines
      for (const e of edges) {
        const a = nodeMap.get(e.from);
        const b = nodeMap.get(e.to);
        if (!a || !b) continue;

        // Pulsing glow for reciprocated
        const pulse = e.reciprocated ? 0.5 + 0.3 * Math.sin(time * 2) : 0;

        // Outer glow
        if (e.reciprocated) {
          ctx.strokeStyle = `rgba(0, 229, 255, ${0.1 + pulse * 0.1})`;
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }

        // Main line
        ctx.strokeStyle = e.reciprocated ? `rgba(0, 229, 255, ${0.5 + pulse * 0.2})` : 'rgba(179,136,255,0.25)';
        ctx.lineWidth = e.reciprocated ? 3 : 1.5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        // Flowing particles along reciprocated edges
        if (e.reciprocated) {
          const numParticles = 3;
          for (let pi = 0; pi < numParticles; pi++) {
            const t = ((time * 0.5 + pi / numParticles) % 1);
            const px = a.x + (b.x - a.x) * t;
            const py = a.y + (b.y - a.y) * t;
            const pg = ctx.createRadialGradient(px, py, 0, px, py, 4);
            pg.addColorStop(0, 'rgba(0, 229, 255, 0.8)');
            pg.addColorStop(1, 'rgba(0, 229, 255, 0)');
            ctx.fillStyle = pg;
            ctx.beginPath();
            ctx.arc(px, py, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Nodes — glowing bubbles
      for (const n of nodes) {
        const r = 28 + n.edges * 8;
        const breathe = 1 + 0.03 * Math.sin(time * 1.5 + n.id);
        const br = r * breathe;

        // Outer halo (large soft glow)
        const halo = ctx.createRadialGradient(n.x, n.y, br * 0.5, n.x, n.y, br * 2.5);
        halo.addColorStop(0, 'rgba(179, 136, 255, 0.12)');
        halo.addColorStop(0.5, 'rgba(124, 77, 255, 0.05)');
        halo.addColorStop(1, 'rgba(124, 77, 255, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(n.x, n.y, br * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Middle glow ring
        const ring = ctx.createRadialGradient(n.x, n.y, br * 0.7, n.x, n.y, br * 1.3);
        ring.addColorStop(0, 'rgba(179, 136, 255, 0.0)');
        ring.addColorStop(0.5, 'rgba(179, 136, 255, 0.15)');
        ring.addColorStop(1, 'rgba(179, 136, 255, 0.0)');
        ctx.fillStyle = ring;
        ctx.beginPath();
        ctx.arc(n.x, n.y, br * 1.3, 0, Math.PI * 2);
        ctx.fill();

        // Main bubble — gradient sphere look
        const grad = ctx.createRadialGradient(n.x - br * 0.25, n.y - br * 0.25, br * 0.1, n.x, n.y, br);
        grad.addColorStop(0, 'rgba(220, 200, 255, 0.95)');
        grad.addColorStop(0.3, 'rgba(179, 136, 255, 0.85)');
        grad.addColorStop(0.7, 'rgba(124, 77, 255, 0.75)');
        grad.addColorStop(1, 'rgba(80, 40, 200, 0.6)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(n.x, n.y, br, 0, Math.PI * 2);
        ctx.fill();

        // Specular highlight (glass effect)
        const spec = ctx.createRadialGradient(n.x - br * 0.3, n.y - br * 0.35, 0, n.x - br * 0.15, n.y - br * 0.2, br * 0.5);
        spec.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        spec.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
        spec.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = spec;
        ctx.beginPath();
        ctx.arc(n.x, n.y, br, 0, Math.PI * 2);
        ctx.fill();

        // Border
        ctx.strokeStyle = 'rgba(179, 136, 255, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(n.x, n.y, br, 0, Math.PI * 2);
        ctx.stroke();

        // Label
        ctx.fillStyle = '#eae6f2';
        ctx.font = `bold ${Math.max(13, 14 + n.edges * 2)}px 'Inter', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Text shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 6;
        ctx.fillText(n.name, n.x, n.y);
        ctx.shadowBlur = 0;
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);

    // Mouse events
    const onMouseMove = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;

      if (dragRef.current.dragging) {
        panRef.current.x += ev.clientX - dragRef.current.lastX;
        panRef.current.y += ev.clientY - dragRef.current.lastY;
        dragRef.current.lastX = ev.clientX;
        dragRef.current.lastY = ev.clientY;
        return;
      }

      const { x, y } = screenToWorld(sx, sy);
      const node = findNode(x, y);
      canvas.style.cursor = node ? 'pointer' : 'grab';
      setTooltip(node ? { x: ev.clientX, y: ev.clientY, name: node.name, edges: node.edges } : null);
    };

    const onMouseDown = (ev: MouseEvent) => {
      dragRef.current = { dragging: true, lastX: ev.clientX, lastY: ev.clientY };
      canvas.style.cursor = 'grabbing';
    };

    const onMouseUp = () => { dragRef.current.dragging = false; canvas.style.cursor = 'grab'; };

    const onClick = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const { x, y } = screenToWorld(ev.clientX - rect.left, ev.clientY - rect.top);
      const node = findNode(x, y);
      if (node) navigate(`/agent/${node.id}`);
    };

    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      panRef.current.scale *= ev.deltaY > 0 ? 0.9 : 1.1;
      panRef.current.scale = Math.max(0.1, Math.min(5, panRef.current.scale));
    };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [loading, empty, navigate, screenToWorld, findNode, getRadius]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#b388ff', fontSize: 18 }}>
        <div style={{ textAlign: 'center' }}>
          Loading trust graph...
        </div>
      </div>
    );
  }

  if (empty) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#eae6f2', fontSize: 18 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 8 }}>No handshakes yet -- be the first to connect</div>
          <a href="/soul-handshake" style={{ color: '#80d8ff' }}>Start a Soul Handshake</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 'calc(100vh - 64px)' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x + 12, top: tooltip.y - 30,
          background: 'rgba(21, 18, 32, 0.95)', border: '1px solid rgba(179,136,255,0.4)', borderRadius: 10,
          padding: '8px 14px', color: '#eae6f2', fontSize: 13, pointerEvents: 'none',
          zIndex: 100, whiteSpace: 'nowrap', backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 20px rgba(124,77,255,0.2)',
        }}>
          <strong>{tooltip.name}</strong> &middot; {tooltip.edges} handshake{tooltip.edges !== 1 ? 's' : ''}
        </div>
      )}
      <div style={{
        position: 'absolute', top: 16, left: 16, color: '#eae6f2', fontSize: 22, fontWeight: 700,
        textShadow: '0 2px 8px rgba(0,0,0,0.5)',
      }}>
        Trust Graph
        <div style={{ fontSize: 12, fontWeight: 400, color: '#888', marginTop: 4 }}>
          Click a bubble to view agent &middot; Scroll to zoom &middot; Drag to pan
        </div>
      </div>
    </div>
  );
}
