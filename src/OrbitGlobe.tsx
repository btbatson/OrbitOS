"use client";

import { useEffect, useRef } from "react";
import { WORLD_OUTLINE } from "./worldOutline";

export type OrbitPoint = {
  /** Small eyebrow label above the name, e.g. a category. */
  label: string;
  /** The main text shown in the callout card. */
  name: string;
  /** Optional dot/accent color for this point. Cycles through a default palette if omitted. */
  color?: string;
  /** Optional fixed position on the unit sphere (used in "sphere" mode). Auto-distributed evenly if omitted. */
  position?: { x: number; y: number; z: number };
  /** Real-world coordinates (used in "globe" mode) — e.g. a radio station, office, or project location. */
  location?: { lat: number; lng: number };
};

export type OrbitGlobeProps = {
  /** The labeled points shown as callouts orbiting the sphere. */
  points: OrbitPoint[];
  /**
   * "sphere" (default) renders an abstract particle-cloud sphere; "globe"
   * renders an actual world map with continent outlines, positioning points
   * by their real `location` (lat/lng) instead of auto-distributing them.
   */
  mode?: "sphere" | "globe";
  /** Optional image (e.g. a profile photo or logo) shown glowing at the center. */
  centerImage?: string;
  /** Max size in pixels; the globe stays square and shrinks to fit its parent below this. Default 700. */
  maxSize?: number;
  /** Number of ambient background particles that make up the sphere's surface (sphere mode only). Default 1800. */
  ambientDotCount?: number;
  /** Palette for the ambient sphere dots (sphere mode only). Default is a neutral grayscale set. */
  ambientColors?: string[];
  /** Fallback palette for point dots/cards when a point has no explicit color. */
  palette?: string[];
  /** Radians per millisecond of auto-rotation. Default 0.00011. */
  rotationSpeed?: number;
  /** Fill color for the planet base in globe mode. Default "#0a0a0f". */
  globeFillColor?: string;
  /** Stroke color for continent outlines and the lat/lng grid in globe mode. Default "rgba(255,255,255,0.35)". */
  globeLineColor?: string;
  /** Whether to draw a faint latitude/longitude grid in globe mode. Default true. */
  showGraticule?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

const DEFAULT_AMBIENT_COLORS = ["#ffffff", "#d4d4d8", "#a1a1aa", "#71717a", "#3f3f46"];
const DEFAULT_PALETTE = [
  "#2563eb",
  "#7c3aed",
  "#0891b2",
  "#d97706",
  "#dc2626",
  "#059669",
  "#4f46e5",
  "#0d9488",
  "#db2777",
];

let injectedStyles = false;

function injectBaseStyles() {
  if (injectedStyles || typeof document === "undefined") return;
  injectedStyles = true;
  const style = document.createElement("style");
  style.setAttribute("data-orbitos", "");
  style.textContent = `
.orbitos-shell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1 / 1;
  margin: 0 auto;
}
.orbitos-shell::before {
  content: "";
  position: absolute;
  inset: 10%;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.9) 0%,
    rgba(255, 255, 255, 0.18) 45%,
    rgba(255, 255, 255, 0) 72%
  );
  filter: blur(6px);
}
.orbitos-canvas {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 28px 60px rgba(0, 0, 0, 0.45)) saturate(1.08);
}
`;
  document.head.appendChild(style);
}

// Golden-angle spiral: evenly distributes n points across a unit sphere so
// callouts don't cluster on one side.
function sphereSpread(n: number) {
  const pts: { ox: number; oy: number; oz: number }[] = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5) / n) * 2;
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    const t = phi * i;
    pts.push({ ox: Math.cos(t) * rad, oy: y, oz: Math.sin(t) * rad });
  }
  return pts;
}

// Converts real-world coordinates to a point on the unit sphere. Longitude 0
// faces the viewer (+z), matching how rotY spins the x/z plane below.
function geoToXYZ(lat: number, lng: number) {
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  return {
    ox: Math.cos(latRad) * Math.sin(lngRad),
    oy: Math.sin(latRad),
    oz: Math.cos(latRad) * Math.cos(lngRad),
  };
}

// A handful of meridians/parallels for a faint lat/lng reference grid.
function graticuleLines() {
  const lines: { lat: number; lng: number }[][] = [];
  for (let lng = -150; lng <= 180; lng += 30) {
    const line: { lat: number; lng: number }[] = [];
    for (let lat = -90; lat <= 90; lat += 5) line.push({ lat, lng });
    lines.push(line);
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const line: { lat: number; lng: number }[] = [];
    for (let lng = -180; lng <= 180; lng += 5) line.push({ lat, lng });
    lines.push(line);
  }
  return lines;
}

export default function OrbitGlobe({
  points,
  mode = "sphere",
  centerImage,
  maxSize = 700,
  ambientDotCount = 1800,
  ambientColors = DEFAULT_AMBIENT_COLORS,
  palette = DEFAULT_PALETTE,
  rotationSpeed = 0.00011,
  globeFillColor = "#0a0a0f",
  globeLineColor = "rgba(255,255,255,0.35)",
  showGraticule = true,
  className,
  style,
}: OrbitGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    injectBaseStyles();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const autoPositions = sphereSpread(points.length);

    type Pt = { ox: number; oy: number; oz: number; ci: number; r: number; phase: number };
    type Node = OrbitPoint & {
      ox: number;
      oy: number;
      oz: number;
      phase: number;
      resolvedColor: string;
      labelAlpha: number;
      labelTarget: number;
      nextToggle: number;
      _sx?: number;
      _sy?: number;
      _front?: boolean;
      _dotR?: number;
    };

    const NODES: Node[] = points.map((p, i) => {
      const auto = autoPositions[i];
      const geo = p.location ? geoToXYZ(p.location.lat, p.location.lng) : null;
      const ox = geo?.ox ?? p.position?.x ?? auto.ox;
      const oy = geo?.oy ?? p.position?.y ?? auto.oy;
      const oz = geo?.oz ?? p.position?.z ?? auto.oz;
      return {
        ...p,
        ox,
        oy,
        oz,
        phase: Math.random() * Math.PI * 2,
        resolvedColor: p.color ?? palette[i % palette.length],
        labelAlpha: 0,
        labelTarget: 0,
        nextToggle: Date.now() + i * 600 + Math.random() * 2000,
      };
    });

    let W = 0, H = 0, cx = 0, cy = 0, R = 0;
    let pts: Pt[] = [];
    const rotX = 0.24;
    let rotY = 0;
    const centerImg = new Image();
    if (centerImage) centerImg.src = centerImage;
    let raf = 0;
    let globeVisible = true;

    function resize() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      const s = Math.min(parent.offsetWidth, parent.offsetHeight, maxSize);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = s * dpr;
      canvas!.height = s * dpr;
      canvas!.style.width = s + "px";
      canvas!.style.height = s + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      W = s;
      H = s;
      cx = W / 2;
      cy = H / 2;
      R = s * 0.4;
    }

    function gen() {
      pts = [];
      if (mode === "globe") return;
      const phi = Math.PI * (3 - Math.sqrt(5));
      const N = ambientDotCount;
      for (let i = 0; i < N; i++) {
        const y = 1 - (i / (N - 1)) * 2;
        const rad = Math.sqrt(1 - y * y);
        const t = phi * i;
        const jitter = 1 + (Math.random() - 0.5) * 0.07;
        pts.push({
          ox: Math.cos(t) * rad * jitter,
          oy: y * jitter,
          oz: Math.sin(t) * rad * jitter,
          ci: Math.floor(Math.random() * ambientColors.length),
          r: Math.random() * 1.7 + 0.5,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    function proj(x: number, y: number, z: number) {
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      let rx = x * cosY + z * sinY, rz = -x * sinY + z * cosY;
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      const ry = y * cosX - rz * sinX;
      rz = y * sinX + rz * cosX;
      const f = 2.55, sc = f / (f + rz + 0.01);
      return { sx: cx + rx * R * sc, sy: cy + ry * R * sc, sz: rz, scale: sc };
    }

    function rrect(x: number, y: number, w: number, h: number, r: number) {
      ctx!.beginPath();
      ctx!.moveTo(x + r, y);
      ctx!.lineTo(x + w - r, y);
      ctx!.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx!.lineTo(x + w, y + h - r);
      ctx!.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx!.lineTo(x + r, y + h);
      ctx!.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx!.lineTo(x, y + r);
      ctx!.quadraticCurveTo(x, y, x + r, y);
      ctx!.closePath();
    }

    function drawConnections(projected: (Pt & { sx: number; sy: number; sz: number })[], t: number) {
      const front = projected.filter((p) => p.sz > -0.08).slice(-150);
      for (let i = 0; i < front.length; i++) {
        for (let j = i + 1; j < front.length; j++) {
          const a = front[i], b = front[j];
          const dist = Math.hypot(a.sx - b.sx, a.sy - b.sy);
          if (dist > R * 0.22) continue;
          const alpha =
            (1 - dist / (R * 0.22)) *
            (0.05 + ((Math.sin(t * 0.0013 + a.phase + b.phase) + 1) / 2) * 0.08);
          ctx!.beginPath();
          ctx!.moveTo(a.sx, a.sy);
          ctx!.lineTo(b.sx, b.sy);
          ctx!.strokeStyle = ambientColors[(a.ci + b.ci) % ambientColors.length];
          ctx!.globalAlpha = alpha;
          ctx!.lineWidth = 0.8;
          ctx!.stroke();
        }
      }
    }

    function drawGlobeBase() {
      ctx!.beginPath();
      ctx!.arc(cx, cy, R * 1.05, 0, Math.PI * 2);
      ctx!.fillStyle = globeFillColor;
      ctx!.globalAlpha = 1;
      ctx!.fill();
    }

    function projectGeoLine(line: { lat: number; lng: number }[]) {
      return line.map(({ lat, lng }) => {
        const { ox, oy, oz } = geoToXYZ(lat, lng);
        return proj(ox, oy, oz);
      });
    }

    function drawGeoLine(line: { lat: number; lng: number }[], color: string, width: number, alphaScale: number) {
      const projectedLine = projectGeoLine(line);
      ctx!.beginPath();
      let started = false;
      for (const p of projectedLine) {
        if (p.sz < -0.05) {
          started = false;
          continue;
        }
        if (!started) {
          ctx!.moveTo(p.sx, p.sy);
          started = true;
        } else {
          ctx!.lineTo(p.sx, p.sy);
        }
      }
      ctx!.strokeStyle = color;
      ctx!.lineWidth = width;
      ctx!.globalAlpha = alphaScale;
      ctx!.stroke();
    }

    function drawWorldOutline() {
      for (const line of WORLD_OUTLINE) {
        drawGeoLine(
          line.map(([lat, lng]) => ({ lat, lng })),
          globeLineColor,
          1,
          0.9
        );
      }
    }

    function drawGraticule() {
      if (!showGraticule) return;
      for (const line of graticuleLines()) {
        drawGeoLine(line, globeLineColor, 0.5, 0.18);
      }
    }

    function drawCenter(t: number) {
      if (mode === "globe" && !centerImage) return;
      const pulse = 0.96 + Math.sin(t * 0.0016) * 0.035;
      const haloR = R * 0.34 * pulse;
      const halo = ctx!.createRadialGradient(cx, cy, 0, cx, cy, haloR);
      halo.addColorStop(0, "rgba(255,255,255,.9)");
      halo.addColorStop(0.4, "rgba(255,255,255,.38)");
      halo.addColorStop(1, "rgba(255,255,255,0)");
      ctx!.fillStyle = halo;
      ctx!.globalAlpha = 1;
      ctx!.beginPath();
      ctx!.arc(cx, cy, haloR, 0, Math.PI * 2);
      ctx!.fill();

      if (centerImage && centerImg.complete && centerImg.naturalWidth) {
        const photoR = R * 0.42 * pulse;
        ctx!.save();
        ctx!.beginPath();
        ctx!.arc(cx, cy, photoR, 0, Math.PI * 2);
        ctx!.clip();
        ctx!.globalAlpha = 1;
        ctx!.drawImage(centerImg, cx - photoR, cy - photoR, photoR * 2, photoR * 2);
        const feather = ctx!.createRadialGradient(cx, cy, photoR * 0.82, cx, cy, photoR);
        feather.addColorStop(0, "rgba(0,0,0,0)");
        feather.addColorStop(0.7, "rgba(0,0,0,.08)");
        feather.addColorStop(1, "rgba(0,0,0,.22)");
        ctx!.fillStyle = feather;
        ctx!.fillRect(cx - photoR, cy - photoR, photoR * 2, photoR * 2);
        ctx!.restore();

        ctx!.save();
        ctx!.filter = "blur(5px)";
        ctx!.beginPath();
        ctx!.strokeStyle = "rgba(0,0,0,.12)";
        ctx!.lineWidth = 3;
        ctx!.arc(cx, cy, photoR, 0, Math.PI * 2);
        ctx!.stroke();
        ctx!.restore();
      }
    }

    function drawPoint(p: Pt & { sx: number; sy: number; sz: number }, front: boolean) {
      const depth = (p.sz + 1.2) / 2.4;
      const radius = p.r * (front ? 0.65 + depth * 0.95 : 0.4 + depth * 0.55);
      ctx!.beginPath();
      ctx!.arc(p.sx, p.sy, radius * 2.8, 0, Math.PI * 2);
      ctx!.fillStyle = ambientColors[p.ci];
      ctx!.globalAlpha = front ? 0.06 : 0.035;
      ctx!.fill();
      ctx!.beginPath();
      ctx!.arc(p.sx, p.sy, radius, 0, Math.PI * 2);
      ctx!.fillStyle = ambientColors[p.ci];
      ctx!.globalAlpha = (front ? 0.32 : 0.14) + depth * (front ? 0.58 : 0.26);
      ctx!.fill();
    }

    function getLabelRect(node: Node) {
      ctx!.font = '700 9px system-ui, sans-serif';
      const catW = ctx!.measureText(node.label.toUpperCase()).width;
      ctx!.font = '600 11.5px system-ui, sans-serif';
      const nameW = ctx!.measureText(node.name).width;
      const padX = 10, padY = 6, gap = 3;
      const cardW = Math.max(catW, nameW) + padX * 2 + 3;
      const cardH = padY + 13 + gap + 15 + padY;
      const stemH = 12, dotOffset = node._dotR || 7;
      let cardX = (node._sx ?? 0) - cardW / 2;
      let cardY = (node._sy ?? 0) - dotOffset - stemH - cardH;
      cardX = Math.max(8, Math.min(cardX, W - cardW - 8));
      cardY = Math.max(8, cardY);
      return { x: cardX, y: cardY, w: cardW, h: cardH };
    }

    function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: typeof a) {
      const m = 12;
      return !(
        a.x + a.w + m < b.x ||
        b.x + b.w + m < a.x ||
        a.y + a.h + m < b.y ||
        b.y + b.h + m < a.y
      );
    }

    function drawNodeLabel(node: Node, alpha: number, rect: { x: number; y: number; w: number; h: number }) {
      if (alpha < 0.01) return;
      const { x: cardX, y: cardY, w: cardW, h: cardH } = rect;
      const sx = node._sx ?? 0, sy = node._sy ?? 0, padX = 10, padY = 6, gap = 3, dotOffset = node._dotR || 7;
      ctx!.save();
      ctx!.globalAlpha = alpha * 0.45;
      ctx!.beginPath();
      ctx!.moveTo(sx, sy - dotOffset);
      ctx!.lineTo(sx, cardY + cardH);
      ctx!.strokeStyle = "#71717a";
      ctx!.lineWidth = 1.5;
      ctx!.setLineDash([3, 4]);
      ctx!.stroke();
      ctx!.setLineDash([]);
      ctx!.globalAlpha = alpha * 0.96;
      rrect(cardX, cardY, cardW, cardH, 8);
      ctx!.fillStyle = "#fff";
      ctx!.fill();
      ctx!.globalAlpha = alpha;
      ctx!.fillStyle = node.resolvedColor;
      rrect(cardX, cardY, 3, cardH, 4);
      ctx!.fill();
      ctx!.globalAlpha = alpha * 0.18;
      rrect(cardX, cardY, cardW, cardH, 8);
      ctx!.strokeStyle = "#18181b";
      ctx!.lineWidth = 1;
      ctx!.stroke();
      ctx!.globalAlpha = alpha * 0.65;
      ctx!.fillStyle = "#52525b";
      ctx!.font = '700 9px system-ui, sans-serif';
      ctx!.textBaseline = "top";
      ctx!.fillText(node.label.toUpperCase(), cardX + padX + 3, cardY + padY);
      ctx!.globalAlpha = alpha;
      ctx!.fillStyle = "#0a0a0a";
      ctx!.font = '600 11.5px system-ui, sans-serif';
      ctx!.fillText(node.name, cardX + padX + 3, cardY + padY + 13 + gap);
      ctx!.restore();
    }

    function drawNodes() {
      const now = Date.now();
      NODES.forEach((node) => {
        const p = proj(node.ox, node.oy, node.oz);
        const isFront = p.sz > -0.05;
        const depth = (p.sz + 1.2) / 2.4;
        const pulse = 0.68 + 0.32 * Math.sin(Date.now() * 0.0022 + node.phase);
        if (p.sz < -0.2) {
          node._front = false;
          return;
        }
        node._sx = p.sx;
        node._sy = p.sy;
        node._front = isFront;
        const baseAlpha = isFront ? 0.6 + depth * 0.4 : 0.22 + depth * 0.18;
        const dotR = isFront ? 7 : 4.5;
        node._dotR = dotR;
        if (isFront) {
          if (now > node.nextToggle) {
            node.labelTarget = node.labelTarget === 0 ? 1 : 0;
            node.nextToggle =
              now + (node.labelTarget === 1 ? 4000 + Math.random() * 3000 : 600 + Math.random() * 1200);
          }
        } else {
          node.labelTarget = 0;
        }
        node.labelAlpha += (node.labelTarget - node.labelAlpha) * 0.035;
        ctx!.beginPath();
        ctx!.arc(p.sx, p.sy, dotR * 2.8 * pulse, 0, Math.PI * 2);
        ctx!.fillStyle = "#ffffff";
        ctx!.globalAlpha = baseAlpha * 0.16 * pulse;
        ctx!.fill();
        ctx!.beginPath();
        ctx!.arc(p.sx, p.sy, dotR * 1.7, 0, Math.PI * 2);
        ctx!.fillStyle = "#ffffff";
        ctx!.globalAlpha = baseAlpha * 0.35;
        ctx!.fill();
        ctx!.beginPath();
        ctx!.arc(p.sx, p.sy, dotR, 0, Math.PI * 2);
        ctx!.fillStyle = mode === "globe" ? node.resolvedColor : "#18181b";
        ctx!.globalAlpha = baseAlpha;
        ctx!.fill();
      });

      const queue = NODES.filter((n) => n._front && n.labelAlpha > 0.02).sort(
        (a, b) => b.labelAlpha - a.labelAlpha
      );
      const placed: { x: number; y: number; w: number; h: number }[] = [];
      queue.forEach((node) => {
        const rect = getLabelRect(node);
        const blocked = placed.some((r) => rectsOverlap(r, rect));
        if (!blocked) {
          placed.push(rect);
          drawNodeLabel(node, node.labelAlpha, rect);
        } else {
          node.labelTarget = 0;
          node.nextToggle = now + 500 + Math.random() * 800;
        }
      });
    }

    function draw(t: number) {
      if (!globeVisible) {
        raf = requestAnimationFrame(draw);
        return;
      }
      ctx!.clearRect(0, 0, W, H);
      rotY = t * rotationSpeed;

      if (mode === "globe") {
        drawGlobeBase();
        drawGraticule();
        drawWorldOutline();
        drawCenter(t);
        drawNodes();
        ctx!.globalAlpha = 1;
        raf = requestAnimationFrame(draw);
        return;
      }

      const projected = pts
        .map((p) => ({ ...p, ...proj(p.ox, p.oy, p.oz) }))
        .sort((a, b) => a.sz - b.sz);
      const split = projected.findIndex((p) => p.sz > 0);
      const back = split === -1 ? projected : projected.slice(0, split);
      const front = split === -1 ? [] : projected.slice(split);
      back.forEach((p) => drawPoint(p, false));
      drawCenter(t);
      drawConnections(projected, t);
      front.forEach((p) => drawPoint(p, true));
      drawNodes();
      ctx!.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    }

    function handleResize() {
      resize();
      gen();
    }

    const observer = new IntersectionObserver(
      (entries) => {
        globeVisible = entries[0].isIntersecting;
      },
      { threshold: 0.05 }
    );
    observer.observe(canvas);

    window.addEventListener("resize", handleResize);

    resize();
    gen();
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    points,
    mode,
    centerImage,
    maxSize,
    ambientDotCount,
    ambientColors,
    palette,
    rotationSpeed,
    globeFillColor,
    globeLineColor,
    showGraticule,
  ]);

  return (
    <div
      className={["orbitos-shell", className].filter(Boolean).join(" ")}
      style={{ maxWidth: maxSize, ...style }}
    >
      <canvas ref={canvasRef} className="orbitos-canvas" />
    </div>
  );
}
