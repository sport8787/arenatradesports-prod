import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from "remotion";
import { loadFont } from "@remotion/google-fonts/Archivo";

const { fontFamily } = loadFont("normal", { weights: ["400", "700", "900"], subsets: ["latin"] });

type Props = { format: "square" | "vertical" | "horizontal" };

const Bg: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#0a0a0a" }}>
      <AbsoluteFill style={{
        background: `radial-gradient(circle at ${50 + Math.sin(frame * 0.02) * 20}% 50%, rgba(255,59,0,0.5), transparent 60%)`,
      }} />
      <AbsoluteFill style={{
        backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,0.04) 3px,rgba(255,255,255,0.04) 4px)",
      }} />
    </AbsoluteFill>
  );
};

const Word: React.FC<{ text: string; color?: string; size?: string; bg?: string }> = ({ text, color = "#fff", size = "14vw", bg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 9, stiffness: 220 } });
  return (
    <div style={{
      fontFamily, fontWeight: 900, color, fontSize: size,
      lineHeight: 0.9, letterSpacing: "-0.06em", textAlign: "center",
      transform: `scale(${s})`,
      background: bg, padding: bg ? "1vw 3vw" : 0,
    }}>{text}</div>
  );
};

const Scene1: React.FC = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "5%" }}>
    <Word text="O CASSINO" color="#888" size="6vw" />
    <Word text="SEMPRE" color="#fff" size="14vw" />
    <Word text="GANHA." color="#ff3b00" size="18vw" />
  </AbsoluteFill>
);

const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "5%" }}>
      <div style={{
        fontFamily, fontWeight: 700, color: "#fff", fontSize: "5vw",
        opacity: s, marginBottom: "2vw", letterSpacing: "0.1em",
      }}>MAS E SE VOCÊ TIVESSE</div>
      <Word text="A MESMA" color="#fff" size="11vw" />
      <Word text="MATEMÁTICA?" color="#ffe600" size="13vw" />
    </AbsoluteFill>
  );
};

const Scene3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 10 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "5%" }}>
      <div style={{
        fontFamily, fontWeight: 900, color: "#fff", fontSize: "10vw",
        textAlign: "center", lineHeight: 0.9, letterSpacing: "-0.05em",
        transform: `scale(${s})`,
      }}>
        MYCROFT IA<br />
        <span style={{ color: "#ff3b00" }}>CALCULA O EDGE.</span>
      </div>
      <div style={{
        fontFamily, fontWeight: 700, color: "#ccc", fontSize: "3.5vw",
        marginTop: "3vw", textAlign: "center", maxWidth: "80%",
        opacity: interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" }),
      }}>
        Sinais com valor matemático.<br />Sem achismo. Sem emoção.
      </div>
    </AbsoluteFill>
  );
};

const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 10 } });
  const pulse = 1 + Math.sin(frame * 0.3) * 0.04;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "5%" }}>
      <div style={{
        fontFamily, fontWeight: 900, fontSize: "11vw", color: "#fff",
        lineHeight: 0.85, textAlign: "center", letterSpacing: "-0.05em", opacity: s,
      }}>
        VIRE A<br /><span style={{ color: "#ff3b00" }}>BANCA.</span>
      </div>
      <div style={{
        fontFamily, fontWeight: 900, color: "#000",
        background: "#ffe600", padding: "3vw 5vw",
        fontSize: "7vw", letterSpacing: "-0.03em",
        transform: `scale(${s * pulse})`, marginTop: "4vw",
        boxShadow: "10px 10px 0 #ff3b00",
      }}>
        ARENA PUNTER →
      </div>
    </AbsoluteFill>
  );
};

export const VersionC: React.FC<Props> = () => (
  <AbsoluteFill style={{ fontFamily }}>
    <Bg />
    <Sequence from={0} durationInFrames={100}><Scene1 /></Sequence>
    <Sequence from={100} durationInFrames={100}><Scene2 /></Sequence>
    <Sequence from={200} durationInFrames={110}><Scene3 /></Sequence>
    <Sequence from={310} durationInFrames={140}><Scene4 /></Sequence>
  </AbsoluteFill>
);
