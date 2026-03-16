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
          x: Math.cos(i * 2.4) * 200 + (Math.random() - 0.5) * 100,
          y: Math.sin(i * 2.4) * 200 + (Math.random() - 0.5) * 100,
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

  const findNode = useCallback((wx: number, wy: number): GNode | null => {
    for (const n of nodesRef.current) {
      const r = 8 + n.edges * 2;
      if ((n.x - wx) ** 2 + (n.y - wy) ** 2 < (r + 5) ** 2) return n;
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
    const tick = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const damping = Math.max(0.85, 0.99 - iteration * 0.0005);
      iteration++;

      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          let dx = nodes[j].x - nodes[i].x;
          let dy = nodes[j].y - nodes[i].y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const force = 3000 / (dist * dist);
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
        const force = (dist - 120) * 0.01;
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

      // Edges
      for (const e of edges) {
        const a = nodeMap.get(e.from);
        const b = nodeMap.get(e.to);
        if (!a || !b) continue;
        ctx.strokeStyle = e.reciprocated ? 'rgba(128,216,255,0.6)' : 'rgba(179,136,255,0.3)';
        ctx.lineWidth = e.reciprocated ? 2.5 : 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Nodes
      for (const n of nodes) {
        const r = 8 + n.edges * 2;
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r);
        grad.addColorStop(0, '#b388ff');
        grad.addColorStop(1, '#7c4dff');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = '#eae6f2';
        ctx.font = `${Math.max(10, 11 + n.edges)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(n.name, n.x, n.y - r - 5);
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
  }, [loading, empty, navigate, screenToWorld, findNode]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#b388ff', fontSize: 18 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🌐</div>
          Loading trust graph…
        </div>
      </div>
    );
  }

  if (empty) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#eae6f2', fontSize: 18 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🤝</div>
          <div style={{ marginBottom: 8 }}>No handshakes yet — be the first to connect</div>
          <a href="/soul-handshake" style={{ color: '#80d8ff' }}>Start a Soul Handshake →</a>
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
          background: '#151220', border: '1px solid #b388ff', borderRadius: 8,
          padding: '6px 12px', color: '#eae6f2', fontSize: 13, pointerEvents: 'none',
          zIndex: 100, whiteSpace: 'nowrap',
        }}>
          <strong>{tooltip.name}</strong> · {tooltip.edges} handshake{tooltip.edges !== 1 ? 's' : ''}
        </div>
      )}
      <div style={{
        position: 'absolute', top: 16, left: 16, color: '#eae6f2', fontSize: 22, fontWeight: 700,
        textShadow: '0 2px 8px rgba(0,0,0,0.5)',
      }}>
        🌐 Trust Graph
        <div style={{ fontSize: 12, fontWeight: 400, color: '#888', marginTop: 4 }}>
          Click a node to view agent · Scroll to zoom · Drag to pan
        </div>
      </div>
    </div>
  );
}
