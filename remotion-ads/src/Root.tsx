import React from "react";
import { Composition } from "remotion";
import { VersionA } from "./versions/VersionA";
import { VersionB } from "./versions/VersionB";
import { VersionC } from "./versions/VersionC";

const FPS = 30;
const DURATION = 450; // 15s

type Format = { id: string; w: number; h: number };
const formats: Format[] = [
  { id: "square", w: 1080, h: 1080 },
  { id: "vertical", w: 1080, h: 1920 },
  { id: "horizontal", w: 1920, h: 1080 },
];

const versions = [
  { id: "a", name: "ChoqueProvocacao", comp: VersionA },
  { id: "b", name: "DadosPunch", comp: VersionB },
  { id: "c", name: "ManifestoUrgencia", comp: VersionC },
];

export const RemotionRoot: React.FC = () => (
  <>
    {versions.flatMap((v) =>
      formats.map((f) => (
        <Composition
          key={`${v.id}-${f.id}`}
          id={`${v.id}-${f.id}`}
          component={v.comp as any}
          durationInFrames={DURATION}
          fps={FPS}
          width={f.w}
          height={f.h}
          defaultProps={{ format: f.id as "square" | "vertical" | "horizontal" }}
        />
      ))
    )}
  </>
);
