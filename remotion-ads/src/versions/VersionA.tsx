import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from "remotion";
import { loadFont } from "@remotion/google-fonts/Archivo";

const { fontFamily } = loadFont("normal", { weights: ["400", "700", "900"], subsets: ["latin"] });

type Props = { format: "square" | "vertical" | "horizontal" };

const Bg: React.FC = () => {
  const frame = useCurrentFrame();
  const shift = interpolate(frame, [0, 450], [0, 60]);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(${135 + shift}deg, #1a0000 0%, #7a0019 45%, #ff3b00 100%)` }}>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 30% 20%, rgba(255,200,80,0.25), transparent 50%)" }} />
      <AbsoluteFill style={{
        backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.15) 3px,rgba(0,0,0,0.15) 4px)",
        mixBlendMode: "overlay" as any,
      }} />
    </AbsoluteFill>
  );
};

const Stamp: React.FC<{ text: string; x: string; y: string; rot: number; size: number }> = ({ text, x, y, rot, size }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 8, stiffness: 220 } });
  return (
    <div style={{
      position: "absolute", left: x, top: y,
      transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${s})`,
      background: "#000", color: "#fff", fontFamily, fontWeight: 900,
      fontSize: size, padding: "12px 24px", letterSpacing: "-0.04em",
      whiteSpace: "nowrap" as const,
    }}>{text}</div>
  );
};

const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shake = Math.sin(frame * 0.8) * (frame < 20 ? 8 : 2);
  const s1 = spring({ frame: frame - 5, fps, config: { damping: 10, stiffness: 180 } });
  const s2 = spring({ frame: frame - 25, fps, config: { damping: 10, stiffness: 180 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{
        fontFamily, fontWeight: 900, color: "#fff", fontSize: "18vw",
        lineHeight: 0.85, textAlign: "center", letterSpacing: "-0.06em",
        transform: `translateX(${shake}px) scale(${s1})`,
      }}>
        APOSTAR
      </div>
      <div style={{
        fontFamily, fontWeight: 900, fontSize: "22vw", lineHeight: 0.85,
        color: "#000", letterSpacing: "-0.07em",
        transform: `scale(${s2})`,
        WebkitTextStroke: "3px #fff",
      }}>
        É BURRO.
      </div>
    </AbsoluteFill>
  );
};

const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12, stiffness: 200 } });
  const lineW = interpolate(frame, [0, 25], [0, 100], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "5%" }}>
      <div style={{
        fontFamily, fontWeight: 700, color: "#fff", fontSize: "8vw",
        textAlign: "center", lineHeight: 1, opacity: s, transform: `translateY(${(1 - s) * 30}px)`,
      }}>
        OPERAR
      </div>
      <div style={{ width: `${lineW}%`, height: 6, background: "#fff", margin: "20px 0", maxWidth: 400 }} />
      <div style={{
        fontFamily, fontWeight: 900, color: "#ffe600", fontSize: "16vw",
        textAlign: "center", lineHeight: 0.9, letterSpacing: "-0.06em",
        transform: `scale(${s})`,
      }}>
        É CIÊNCIA.
      </div>
    </AbsoluteFill>
  );
};

const Scene3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Stamp text="EDGE +12.4%" x="50%" y="28%" rot={-6} size={64} />
      <div style={{ position: "absolute", top: "45%", left: "50%", transform: "translate(-50%,-50%)" }}>
        <div style={{
          fontFamily, fontWeight: 900, color: "#fff", fontSize: "20vw",
          lineHeight: 0.85, letterSpacing: "-0.06em", textAlign: "center",
          transform: `scale(${spring({ frame: frame - 10, fps, config: { damping: 9 } })})`,
        }}>
          ROI<br />REAL.
        </div>
      </div>
      <Stamp text="MYCROFT IA" x="50%" y="72%" rot={4} size={56} />
    </AbsoluteFill>
  );
};

const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 10, stiffness: 180 } });
  const pulse = 1 + Math.sin(frame * 0.3) * 0.03;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "5%" }}>
      <div style={{
        fontFamily, fontWeight: 700, color: "#fff", fontSize: "5vw",
        opacity: interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" }),
        marginBottom: "3vw", letterSpacing: "0.1em",
      }}>
        ARENA PUNTER
      </div>
      <div style={{
        fontFamily, fontWeight: 900, color: "#000",
        background: "#ffe600", padding: "3vw 5vw",
        fontSize: "9vw", letterSpacing: "-0.04em",
        transform: `scale(${s * pulse})`,
        boxShadow: "12px 12px 0 #000",
      }}>
        COMECE AGORA →
      </div>
      <div style={{
        fontFamily, fontWeight: 700, color: "#fff", fontSize: "3vw",
        marginTop: "3vw", opacity: interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" }),
      }}>
        blefadormilionario.com.br
      </div>
    </AbsoluteFill>
  );
};

export const VersionA: React.FC<Props> = () => {
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Bg />
      <Sequence from={0} durationInFrames={90}><Scene1 /></Sequence>
      <Sequence from={90} durationInFrames={100}><Scene2 /></Sequence>
      <Sequence from={190} durationInFrames={110}><Scene3 /></Sequence>
      <Sequence from={300} durationInFrames={150}><Scene4 /></Sequence>
    </AbsoluteFill>
  );
};
