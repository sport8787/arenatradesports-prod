import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from "remotion";
import { loadFont } from "@remotion/google-fonts/Archivo";

const { fontFamily } = loadFont("normal", { weights: ["400", "700", "900"], subsets: ["latin"] });

type Props = { format: "square" | "vertical" | "horizontal" };

const Bg: React.FC = () => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, 450], [0, 1]);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(${135 + t * 30}deg, #ff5500, #d61f3a 50%, #4a0050)` }}>
      <AbsoluteFill style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        transform: `translate(${-frame * 0.3}px, ${-frame * 0.3}px)`,
      }} />
    </AbsoluteFill>
  );
};

const BigStat: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 10, stiffness: 220 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{
        fontFamily, fontWeight: 700, color: "#ffe600", fontSize: "4vw",
        letterSpacing: "0.3em", marginBottom: "2vw",
        opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" }),
      }}>{label}</div>
      <div style={{
        fontFamily, fontWeight: 900, color: "#fff", fontSize: "26vw",
        lineHeight: 0.85, letterSpacing: "-0.07em", textAlign: "center",
        transform: `scale(${s})`,
        textShadow: "8px 8px 0 #000",
      }}>{value}</div>
    </AbsoluteFill>
  );
};

const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 11, stiffness: 200 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "5%" }}>
      <div style={{
        fontFamily, fontWeight: 700, color: "#fff", fontSize: "5vw",
        marginBottom: "2vw", opacity: s, letterSpacing: "0.05em",
      }}>
        VOCÊ AINDA
      </div>
      <div style={{
        fontFamily, fontWeight: 900, fontSize: "16vw",
        color: "#fff", textAlign: "center", lineHeight: 0.9,
        letterSpacing: "-0.06em", transform: `scale(${s})`,
      }}>
        APOSTA<br />NO ACHISMO?
      </div>
    </AbsoluteFill>
  );
};

const Scene2: React.FC = () => <BigStat value="+12.4%" label="ROI MENSAL" />;
const Scene3: React.FC = () => <BigStat value="68%" label="ACERTO MYCROFT IA" />;

const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 10 } });
  const pulse = 1 + Math.sin(frame * 0.3) * 0.04;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "5%" }}>
      <div style={{
        fontFamily, fontWeight: 900, fontSize: "10vw", color: "#fff",
        textAlign: "center", lineHeight: 0.9, letterSpacing: "-0.05em",
        opacity: s, marginBottom: "4vw",
      }}>
        ARENA<br />PUNTER
      </div>
      <div style={{
        fontFamily, fontWeight: 900, color: "#000",
        background: "#ffe600", padding: "3vw 5vw", fontSize: "8vw",
        letterSpacing: "-0.04em", transform: `scale(${s * pulse})`,
        boxShadow: "10px 10px 0 #000",
      }}>
        TESTAR GRÁTIS →
      </div>
    </AbsoluteFill>
  );
};

export const VersionB: React.FC<Props> = () => (
  <AbsoluteFill style={{ fontFamily }}>
    <Bg />
    <Sequence from={0} durationInFrames={90}><Scene1 /></Sequence>
    <Sequence from={90} durationInFrames={90}><Scene2 /></Sequence>
    <Sequence from={180} durationInFrames={90}><Scene3 /></Sequence>
    <Sequence from={270} durationInFrames={180}><Scene4 /></Sequence>
  </AbsoluteFill>
);
