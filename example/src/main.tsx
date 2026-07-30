import { createRoot } from "react-dom/client";
import { OrbitGlobe } from "../../src/index";

const stations = [
  { label: "Kenya", name: "Nairobi FM", color: "#22c55e", location: { lat: -1.29, lng: 36.82 } },
  { label: "UK", name: "London Radio", color: "#22c55e", location: { lat: 51.51, lng: -0.13 } },
  { label: "USA", name: "NYC Beats", color: "#22c55e", location: { lat: 40.71, lng: -74.0 } },
  { label: "Spain", name: "Barcelona FM", color: "#22c55e", location: { lat: 41.39, lng: 2.17 } },
  { label: "Japan", name: "Tokyo Waves", color: "#22c55e", location: { lat: 35.68, lng: 139.69 } },
  { label: "Brazil", name: "Rio Sound", color: "#22c55e", location: { lat: -22.91, lng: -43.17 } },
];

const skills = [
  { label: "Frontend", name: "React", color: "#2563eb" },
  { label: "Backend", name: "Node.js", color: "#059669" },
  { label: "AI / LLM", name: "Claude", color: "#7c3aed" },
  { label: "Cloud", name: "AWS", color: "#d97706" },
  { label: "Database", name: "Postgres", color: "#dc2626" },
  { label: "Mobile", name: "React Native", color: "#0891b2" },
];

createRoot(document.getElementById("root")!).render(
  <div style={{ display: "flex", gap: 40, flexWrap: "wrap", justifyContent: "center" }}>
    <div style={{ width: "min(90vw, 480px)", aspectRatio: "1 / 1" }}>
      <OrbitGlobe points={stations} mode="globe" />
    </div>
    <div style={{ width: "min(90vw, 480px)", aspectRatio: "1 / 1" }}>
      <OrbitGlobe points={skills} mode="sphere" />
    </div>
  </div>
);
