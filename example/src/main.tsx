import { useState } from "react";
import { createRoot } from "react-dom/client";
import { OrbitGlobe, type OrbitPoint } from "../../src/index";

const stations: OrbitPoint[] = [
  { label: "Kenya", name: "Nairobi FM", location: { lat: -1.29, lng: 36.82 } },
  { label: "UK", name: "London Radio", location: { lat: 51.51, lng: -0.13 } },
  { label: "USA", name: "NYC Beats", location: { lat: 40.71, lng: -74.0 } },
  { label: "Spain", name: "Barcelona FM", location: { lat: 41.39, lng: 2.17 } },
  { label: "Japan", name: "Tokyo Waves", location: { lat: 35.68, lng: 139.69 } },
  { label: "Brazil", name: "Rio Sound", location: { lat: -22.91, lng: -43.17 } },
];

const skills: OrbitPoint[] = [
  { label: "Frontend", name: "React" },
  { label: "Backend", name: "Node.js" },
  { label: "AI / LLM", name: "Claude" },
  { label: "Cloud", name: "AWS" },
  { label: "Database", name: "Postgres" },
  { label: "Mobile", name: "React Native" },
];

const PALETTES = {
  Cool: ["#2563eb", "#7c3aed", "#0891b2", "#4f46e5", "#0d9488", "#0ea5e9"],
  Warm: ["#dc2626", "#d97706", "#f59e0b", "#ea580c", "#db2777", "#e11d48"],
  Vibrant: ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#8b5cf6"],
  Mono: ["#22c55e"],
} as const;

type PaletteName = keyof typeof PALETTES;

function Demo() {
  const [mode, setMode] = useState<"sphere" | "globe">("globe");
  const [paletteName, setPaletteName] = useState<PaletteName>("Vibrant");
  const [light, setLight] = useState(false);

  const points = mode === "globe" ? stations : skills;
  const palette = [...PALETTES[paletteName]];

  const pageBg = light ? "#f4f4f5" : "#000";
  const pageFg = light ? "#18181b" : "#e4e4e7";
  const cardBg = light ? "#ffffff" : "#18181b";
  const cardBorder = light ? "#e4e4e7" : "#27272a";

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: pageBg,
        color: pageFg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
        padding: "32px 16px",
        fontFamily: "system-ui, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <h1 style={{ margin: 0, fontSize: 20 }}>OrbitOS</h1>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
        <ControlGroup label="Mode" cardBg={cardBg} cardBorder={cardBorder}>
          {(["sphere", "globe"] as const).map((m) => (
            <ToggleButton key={m} active={mode === m} onClick={() => setMode(m)} light={light}>
              {m === "sphere" ? "Sphere" : "Globe"}
            </ToggleButton>
          ))}
        </ControlGroup>

        <ControlGroup label="Colors" cardBg={cardBg} cardBorder={cardBorder}>
          {(Object.keys(PALETTES) as PaletteName[]).map((name) => (
            <ToggleButton
              key={name}
              active={paletteName === name}
              onClick={() => setPaletteName(name)}
              light={light}
            >
              {name}
            </ToggleButton>
          ))}
        </ControlGroup>

        <ControlGroup label="Background" cardBg={cardBg} cardBorder={cardBorder}>
          <ToggleButton active={!light} onClick={() => setLight(false)} light={light}>
            Dark
          </ToggleButton>
          <ToggleButton active={light} onClick={() => setLight(true)} light={light}>
            Light
          </ToggleButton>
        </ControlGroup>
      </div>

      <div style={{ width: "min(90vw, 520px)", aspectRatio: "1 / 1" }}>
        <OrbitGlobe
          points={points}
          mode={mode}
          palette={palette}
          ambientColors={
            light ? ["#18181b", "#3f3f46", "#52525b", "#71717a", "#a1a1aa"] : undefined
          }
          globeFillColor={light ? "#e4e4e7" : "#0a0a0f"}
          globeLineColor={light ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.35)"}
        />
      </div>
    </div>
  );
}

function ControlGroup({
  label,
  cardBg,
  cardBorder,
  children,
}: {
  label: string;
  cardBg: string;
  cardBorder: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        borderRadius: 12,
        padding: "8px 10px",
      }}
    >
      <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, opacity: 0.6 }}>
        {label}
      </span>
      <div style={{ display: "flex", gap: 6 }}>{children}</div>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  light,
  children,
}: {
  active: boolean;
  onClick: () => void;
  light: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        border: "none",
        fontSize: 13,
        cursor: "pointer",
        background: active ? (light ? "#18181b" : "#fff") : "transparent",
        color: active ? (light ? "#fff" : "#000") : "inherit",
      }}
    >
      {children}
    </button>
  );
}

createRoot(document.getElementById("root")!).render(<Demo />);
