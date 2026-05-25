import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardPaste, Copy, Check, FileText, Save, History, Loader2 } from 'lucide-react';
import PunterBreadcrumb from '@/components/punter/PunterBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// ============================================================
// Tipos
// ============================================================
type ParsedData = Record<string, number | undefined>;
type Factor = { t: string; c: 'p' | 'n' | 'w'; v: string };
type ScoreResult = { score: number; factors: Factor[] };

// ============================================================
// Parser do texto colado do Sherlock
// ============================================================
function parseSherlock(raw: string): ParsedData {
  const t = raw.replace(/[\n\r\t]+/g, ' ').replace(/\s{2,}/g, ' ');
  const d: ParsedData = {};
  let m: RegExpMatchArray | null;

  m = t.match(/(\d+\.?\d*)\s+M[eé]dia Custo do Gol \(1\.0\)\s+(\d+\.?\d*)/i);
  if (m) { d.cdg1h = +m[1]; d.cdg1a = +m[2]; }

  m = t.match(/(\d+\.?\d*)\s+CV Custo do Gol \(1\.0\)\s+(\d+\.?\d*)/i);
  if (m) { d.cv1h = +m[1]; d.cv1a = +m[2]; }

  m = t.match(/(\d+\.?\d*)\s+M[eé]dia Custo do Gol \(2\.0\)\s+(\d+\.?\d*)/i);
  if (m) { d.cdg2h = +m[1]; d.cdg2a = +m[2]; }

  m = t.match(/(\d+\.?\d*)\s+CV Custo do Gol \(2\.0\)\s+(\d+\.?\d*)/i);
  if (m) { d.cv2h = +m[1]; d.cv2a = +m[2]; }

  m = t.match(/(\d+)\s+Gols marcados no FT\s+(\d+)\s+(\d+\.?\d*)\s+M[eé]dia\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+CV\s+(\d+\.?\d*)/i);
  if (m) { d.gm_h = +m[3]; d.gm_a = +m[4]; d.gm_cv_h = +m[5]; d.gm_cv_a = +m[6]; }

  m = t.match(/(\d+)\s+Gols sofridos no FT\s+(\d+)\s+(\d+\.?\d*)\s+M[eé]dia\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+CV\s+(\d+\.?\d*)/i);
  if (m) { d.gs_h = +m[3]; d.gs_a = +m[4]; d.gs_cv_h = +m[5]; d.gs_cv_a = +m[6]; }

  const overDefs: [string, string][] = [
    ['o05ht', '0\\.5 no HT'],
    ['o15ht', '1\\.5 no HT'],
    ['o052t', '0\\.5 no 2T'],
    ['o152t', '1\\.5 no 2T'],
    ['o05ft', '0\\.5 no FT'],
    ['o15ft', '1\\.5 no FT'],
    ['o25ft', '2\\.5 no FT'],
    ['o35ft', '3\\.5 no FT'],
  ];
  overDefs.forEach(([key, lbl]) => {
    const r = new RegExp('(\\d+)\\s+\\((\\d+)%\\)\\s+Jogos Over ' + lbl + '\\s+(\\d+)\\s+\\((\\d+)%\\)', 'i');
    const mx = t.match(r);
    if (mx) { d[key + '_h'] = +mx[2]; d[key + '_a'] = +mx[4]; }
  });

  function raceRow(lbl: string) {
    const esc = lbl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const r = new RegExp('([A-Z]+(?:\\s+[A-Z]+){4})\\s+Race\\s+' + esc + '\\s+([A-Z]+(?:\\s+[A-Z]+){4})', 'i');
    const mx = t.match(r);
    if (!mx) return null;
    return { h: mx[1].trim().split(/\s+/), a: mx[2].trim().split(/\s+/) };
  }
  const cnt = (arr: string[] | undefined, val: string) => (arr ? arr.filter(v => v === val).length : 0);

  const bttsft = raceRow('BTTS no FT');
  if (bttsft) { d.btts_h = Math.round(cnt(bttsft.h, 'Y') / 5 * 100); d.btts_a = Math.round(cnt(bttsft.a, 'Y') / 5 * 100); }

  const bttsht = raceRow('BTTS no HT');
  if (bttsht) { d.btts_ht_h = Math.round(cnt(bttsht.h, 'Y') / 5 * 100); d.btts_ht_a = Math.round(cnt(bttsht.a, 'Y') / 5 * 100); }

  const fght = raceRow('primeiro gol no HT');
  if (fght) {
    d.r_marc1_h = Math.round(cnt(fght.h, 'F') / 5 * 100);
    d.r_marc1_a = Math.round(cnt(fght.a, 'F') / 5 * 100);
    d.r_sof1_h  = Math.round(cnt(fght.h, 'A') / 5 * 100);
    d.r_sof1_a  = Math.round(cnt(fght.a, 'A') / 5 * 100);
  }

  const fgft = raceRow('primeiro gol no FT');
  if (fgft) {
    d.r_marc1ft_h = Math.round(cnt(fgft.h, 'F') / 5 * 100);
    d.r_marc1ft_a = Math.round(cnt(fgft.a, 'F') / 5 * 100);
  }

  m = t.match(/(\d+\.?\d*)\s+Escanteios HT\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+M[eé]dia\s+(\d+\.?\d*)/i);
  if (m) { d.esc_ht_h = +m[1]; d.esc_ht_a = +m[2]; d.esc_ht_avg_h = +m[3]; d.esc_ht_avg_a = +m[4]; }

  m = t.match(/(\d+\.?\d*)\s+Escanteios FT\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+M[eé]dia\s+(\d+\.?\d*)/i);
  if (m) { d.esc_ft_h = +m[1]; d.esc_ft_a = +m[2]; d.esc_ft_avg_h = +m[3]; d.esc_ft_avg_a = +m[4]; }

  return d;
}

// ============================================================
// Helpers de scoring
// ============================================================
const clamp = (s: number) => Math.max(0, Math.min(100, Math.round(s)));
const avg2 = (D: ParsedData, k1: string, k2: string): number | undefined => {
  const a = D[k1], b = D[k2];
  if (a === undefined && b === undefined) return undefined;
  if (a === undefined) return b;
  if (b === undefined) return a;
  return (a + b) / 2;
};

// ============================================================
// 9 Mercados
// ============================================================
function scoreOver05HT(D: ParsedData): ScoreResult {
  let s = 35; const f: Factor[] = [];
  const o = avg2(D, 'o05ht_h', 'o05ht_a');
  if (o !== undefined) {
    if (o > 75) { s += 25; f.push({ t: `Over 0.5 HT muito frequente (${o.toFixed(0)}%)`, c: 'p', v: '+25' }); }
    else if (o > 60) { s += 15; f.push({ t: `Over 0.5 HT frequente (${o.toFixed(0)}%)`, c: 'p', v: '+15' }); }
    else if (o < 40) { s -= 15; f.push({ t: `Over 0.5 HT raro (${o.toFixed(0)}%)`, c: 'n', v: '-15' }); }
    else { f.push({ t: `Over 0.5 HT neutro (${o.toFixed(0)}%)`, c: 'w', v: '0' }); }
  }
  const cdgm = avg2(D, 'cdg1h', 'cdg1a');
  if (cdgm !== undefined) {
    if (cdgm < 2.0) { s += 12; f.push({ t: `CDG baixo (${cdgm.toFixed(2)}) — gol barato no HT`, c: 'p', v: '+12' }); }
    else if (cdgm > 4.0) { s -= 10; f.push({ t: 'CDG alto — gol difícil no HT', c: 'n', v: '-10' }); }
  }
  const gt = (D.gm_h || 0) + (D.gm_a || 0);
  if (gt > 2.2) { s += 8; f.push({ t: `Volume ofensivo alto (${gt.toFixed(1)} gols/jogo)`, c: 'p', v: '+8' }); }
  const rM = avg2(D, 'r_marc1_h', 'r_marc1_a');
  if (rM !== undefined && rM > 50) { s += 6; f.push({ t: `Race: marca 1º frequentemente (${rM.toFixed(0)}%)`, c: 'p', v: '+6' }); }
  return { score: clamp(s), factors: f };
}

function scoreOver15HT(D: ParsedData): ScoreResult {
  let s = 30; const f: Factor[] = [];
  const o = avg2(D, 'o15ht_h', 'o15ht_a');
  if (o !== undefined) {
    if (o > 55) { s += 25; f.push({ t: `Over 1.5 HT frequente (${o.toFixed(0)}%)`, c: 'p', v: '+25' }); }
    else if (o > 40) { s += 12; f.push({ t: `Over 1.5 HT moderado (${o.toFixed(0)}%)`, c: 'p', v: '+12' }); }
    else if (o < 20) { s -= 15; f.push({ t: `Over 1.5 HT raro (${o.toFixed(0)}%)`, c: 'n', v: '-15' }); }
  }
  const cdgm = avg2(D, 'cdg1h', 'cdg1a');
  if (cdgm !== undefined) {
    if (cdgm < 1.8) { s += 15; f.push({ t: 'CDG baixo — 2 gols no HT viável', c: 'p', v: '+15' }); }
    else if (cdgm > 3.5) { s -= 10; f.push({ t: 'CDG alto — 2 gols no HT improvável', c: 'n', v: '-10' }); }
  }
  const gt = (D.gm_h || 0) + (D.gm_a || 0);
  if (gt > 3.0) { s += 10; f.push({ t: `Gols totais muito altos (${gt.toFixed(1)})`, c: 'p', v: '+10' }); }
  const btts = avg2(D, 'btts_ht_h', 'btts_ht_a');
  if (btts !== undefined && btts > 40) { s += 6; f.push({ t: `BTTS HT frequente (${btts.toFixed(0)}%)`, c: 'p', v: '+6' }); }
  return { score: clamp(s), factors: f };
}

function scoreOver25FT(D: ParsedData): ScoreResult {
  let s = 35; const f: Factor[] = [];
  const o = avg2(D, 'o25ft_h', 'o25ft_a');
  if (o !== undefined) {
    if (o > 65) { s += 22; f.push({ t: `Over 2.5 muito frequente (${o.toFixed(0)}%)`, c: 'p', v: '+22' }); }
    else if (o > 50) { s += 12; f.push({ t: `Over 2.5 frequente (${o.toFixed(0)}%)`, c: 'p', v: '+12' }); }
    else if (o < 35) { s -= 18; f.push({ t: `Over 2.5 raro (${o.toFixed(0)}%)`, c: 'n', v: '-18' }); }
  }
  const gt = (D.gm_h || 0) + (D.gm_a || 0);
  if (gt > 0) {
    if (gt > 2.5) { s += 14; f.push({ t: `Gols totais altos (${gt.toFixed(1)}/jogo)`, c: 'p', v: '+14' }); }
    else if (gt < 1.8) { s -= 12; f.push({ t: `Gols totais baixos (${gt.toFixed(1)}/jogo)`, c: 'n', v: '-12' }); }
  }
  const cdgm = avg2(D, 'cdg1h', 'cdg1a');
  if (cdgm !== undefined) {
    if (cdgm < 2.0) { s += 10; f.push({ t: `CDG médio baixo (${cdgm.toFixed(2)})`, c: 'p', v: '+10' }); }
    else if (cdgm > 4.0) { s -= 8; f.push({ t: `CDG médio alto (${cdgm.toFixed(2)})`, c: 'n', v: '-8' }); }
  }
  const btm = avg2(D, 'btts_h', 'btts_a');
  if (btm !== undefined && btm > 55) { s += 8; f.push({ t: `BTTS frequente (${btm.toFixed(0)}%)`, c: 'p', v: '+8' }); }
  const o15m = avg2(D, 'o15ht_h', 'o15ht_a');
  if (o15m !== undefined && o15m > 45) { s += 5; f.push({ t: `Over 1.5 HT frequente (${o15m.toFixed(0)}%)`, c: 'p', v: '+5' }); }
  return { score: clamp(s), factors: f };
}

function scoreOver35FT(D: ParsedData): ScoreResult {
  let s = 25; const f: Factor[] = [];
  const o = avg2(D, 'o35ft_h', 'o35ft_a');
  if (o !== undefined) {
    if (o > 50) { s += 30; f.push({ t: `Over 3.5 muito frequente (${o.toFixed(0)}%)`, c: 'p', v: '+30' }); }
    else if (o > 35) { s += 18; f.push({ t: `Over 3.5 frequente (${o.toFixed(0)}%)`, c: 'p', v: '+18' }); }
    else if (o < 15) { s -= 15; f.push({ t: `Over 3.5 raro (${o.toFixed(0)}%)`, c: 'n', v: '-15' }); }
  }
  const gt = (D.gm_h || 0) + (D.gm_a || 0);
  if (gt > 3.0) { s += 14; f.push({ t: `Volume de gols muito alto (${gt.toFixed(1)})`, c: 'p', v: '+14' }); }
  const cdgm = avg2(D, 'cdg1h', 'cdg1a');
  if (cdgm !== undefined && cdgm < 1.5) { s += 15; f.push({ t: `CDG muito baixo (${cdgm.toFixed(2)}) — jogo aberto`, c: 'p', v: '+15' }); }
  return { score: clamp(s), factors: f };
}

function scoreUnder25FT(D: ParsedData): ScoreResult {
  let s = 35; const f: Factor[] = [];
  const o25h = D.o25ft_h, o25a = D.o25ft_a;
  const u = (o25h !== undefined && o25a !== undefined) ? (200 - o25h - o25a) / 2 : undefined;
  if (u !== undefined) {
    if (u > 65) { s += 22; f.push({ t: `Under 2.5 frequente (${u.toFixed(0)}%)`, c: 'p', v: '+22' }); }
    else if (u > 50) { s += 12; f.push({ t: `Under 2.5 moderado (${u.toFixed(0)}%)`, c: 'p', v: '+12' }); }
    else if (u < 30) { s -= 20; f.push({ t: `Under 2.5 raro (${u.toFixed(0)}%)`, c: 'n', v: '-20' }); }
  }
  const cdgm = avg2(D, 'cdg1h', 'cdg1a');
  if (cdgm !== undefined) {
    if (cdgm > 3.5) { s += 15; f.push({ t: `CDG alto (${cdgm.toFixed(2)}) — gol difícil`, c: 'p', v: '+15' }); }
    else if (cdgm < 1.5) { s -= 12; f.push({ t: 'CDG baixo — Under arriscado', c: 'n', v: '-12' }); }
  }
  const gt = (D.gm_h || 0) + (D.gm_a || 0);
  if (gt > 0) {
    if (gt < 2.0) { s += 12; f.push({ t: `Gols totais baixos (${gt.toFixed(1)})`, c: 'p', v: '+12' }); }
    else if (gt > 3.0) { s -= 12; f.push({ t: `Gols totais altos (${gt.toFixed(1)})`, c: 'n', v: '-12' }); }
  }
  return { score: clamp(s), factors: f };
}

function scoreBTTSFT(D: ParsedData): ScoreResult {
  let s = 35; const f: Factor[] = [];
  const btm = avg2(D, 'btts_h', 'btts_a');
  if (btm !== undefined) {
    if (btm > 65) { s += 22; f.push({ t: `BTTS muito frequente (${btm.toFixed(0)}%)`, c: 'p', v: '+22' }); }
    else if (btm > 50) { s += 12; f.push({ t: `BTTS frequente (${btm.toFixed(0)}%)`, c: 'p', v: '+12' }); }
    else if (btm < 30) { s -= 18; f.push({ t: `BTTS raro (${btm.toFixed(0)}%)`, c: 'n', v: '-18' }); }
  }
  const { gm_h: gmH, gm_a: gmA, gs_h: gsH, gs_a: gsA } = D;
  if (gmH && gmA) {
    if (gmH > 1.2 && gmA > 1.2) { s += 12; f.push({ t: `Ambos atacam bem (${gmH.toFixed(1)} / ${gmA.toFixed(1)})`, c: 'p', v: '+12' }); }
    else if (gmH < 0.8 || gmA < 0.8) { s -= 12; f.push({ t: 'Um time com ataque fraco', c: 'n', v: '-12' }); }
  }
  if (gsH && gsA) {
    if (gsH > 1.0 && gsA > 1.0) { s += 10; f.push({ t: `Ambas defesas vulneráveis (${gsH.toFixed(1)} / ${gsA.toFixed(1)})`, c: 'p', v: '+10' }); }
    else if (gsH < 0.5 || gsA < 0.5) { s -= 8; f.push({ t: 'Defesa sólida de um dos times', c: 'n', v: '-8' }); }
  }
  return { score: clamp(s), factors: f };
}

function scoreLayGoleada(D: ParsedData): ScoreResult {
  let s = 40; const f: Factor[] = [];
  const { cdg1h: cdgH, cdg1a: cdgA, cv1h: cvH, cv1a: cvA, gm_h: gmH, gm_a: gmA, odd_h: oh, odd_a: oa } = D;
  if (cdgH) {
    if (cdgH > 3.5) { s += 10; f.push({ t: `CDG casa alto (${cdgH.toFixed(2)}) — gol difícil`, c: 'p', v: '+10' }); }
    else if (cdgH > 2.0) { s += 5; f.push({ t: `CDG casa moderado (${cdgH.toFixed(2)})`, c: 'p', v: '+5' }); }
    else if (cdgH <= 1.5) { s -= 10; f.push({ t: `CDG casa baixo (${cdgH.toFixed(2)}) — gol fácil`, c: 'n', v: '-10' }); }
  }
  if (cdgA) {
    if (cdgA > 3.5) { s += 10; f.push({ t: `CDG visitante alto (${cdgA.toFixed(2)})`, c: 'p', v: '+10' }); }
    else if (cdgA > 2.0) { s += 5; f.push({ t: `CDG visitante moderado (${cdgA.toFixed(2)})`, c: 'p', v: '+5' }); }
    else if (cdgA <= 1.5) { s -= 10; f.push({ t: `CDG visitante baixo (${cdgA.toFixed(2)})`, c: 'n', v: '-10' }); }
  }
  if (cvH && cvH < 0.5) { s += 4; f.push({ t: `CDG casa consistente (CV ${cvH.toFixed(2)})`, c: 'p', v: '+4' }); }
  if (cvA && cvA < 0.5) { s += 4; f.push({ t: `CDG visitante consistente (CV ${cvA.toFixed(2)})`, c: 'p', v: '+4' }); }
  if (gmH) {
    if (gmH < 1.3) { s += 6; f.push({ t: `Ataque casa fraco (${gmH.toFixed(2)} gols/jogo)`, c: 'p', v: '+6' }); }
    else if (gmH > 2.5) { s -= 12; f.push({ t: `Ataque casa forte (${gmH.toFixed(2)})`, c: 'n', v: '-12' }); }
  }
  if (gmA) {
    if (gmA < 1.3) { s += 6; f.push({ t: `Ataque visitante fraco (${gmA.toFixed(2)})`, c: 'p', v: '+6' }); }
    else if (gmA > 2.5) { s -= 12; f.push({ t: `Ataque visitante forte (${gmA.toFixed(2)})`, c: 'n', v: '-12' }); }
  }
  const o35m = avg2(D, 'o35ft_h', 'o35ft_a');
  if (o35m !== undefined) {
    if (o35m < 20) { s += 10; f.push({ t: `Over 3.5 raro (${o35m.toFixed(0)}% méd)`, c: 'p', v: '+10' }); }
    else if (o35m > 40) { s -= 14; f.push({ t: `Over 3.5 frequente (${o35m.toFixed(0)}%)`, c: 'n', v: '-14' }); }
  }
  if (oh && oa) {
    if (oh < 1.4) { s -= 25; f.push({ t: `VETO: Super favorito casa (odd ${oh})`, c: 'n', v: '-25' }); }
    if (oa < 1.4) { s -= 25; f.push({ t: `VETO: Super favorito visitante (odd ${oa})`, c: 'n', v: '-25' }); }
  }
  return { score: clamp(s), factors: f };
}

function scoreLay2x2(D: ParsedData): ScoreResult {
  let s = 35; const f: Factor[] = [];
  const o25m = avg2(D, 'o25ft_h', 'o25ft_a');
  const btm = avg2(D, 'btts_h', 'btts_a');
  const gt = (D.gm_h || 0) + (D.gm_a || 0);
  if (o25m !== undefined) {
    if (o25m > 60) { s += 15; f.push({ t: `Over 2.5 frequente (${o25m.toFixed(0)}% méd)`, c: 'p', v: '+15' }); }
    else if (o25m < 30) { s -= 10; f.push({ t: 'Over 2.5 raro — poucos gols', c: 'n', v: '-10' }); }
  }
  if (btm !== undefined) {
    if (btm > 60) { s += 12; f.push({ t: `BTTS frequente (${btm.toFixed(0)}% méd)`, c: 'p', v: '+12' }); }
    else if (btm < 30) { s -= 10; f.push({ t: `BTTS raro (${btm.toFixed(0)}%)`, c: 'n', v: '-10' }); }
  }
  if (gt > 0) {
    if (gt > 3.0) { s += 8; f.push({ t: `Gols totais altos (${gt.toFixed(1)}/jogo)`, c: 'p', v: '+8' }); }
    else if (gt < 1.8) { s -= 5; f.push({ t: `Gols totais baixos (${gt.toFixed(1)}/jogo)`, c: 'n', v: '-5' }); }
  }
  f.push({ t: 'Frequência 2x2 H2H — verificar no Zeus (não disponível no Sherlock)', c: 'w', v: '⚠' });
  return { score: clamp(s), factors: f };
}

function scoreLay1x3(D: ParsedData): ScoreResult {
  let s = 35; const f: Factor[] = [];
  const { odd_h: oh, odd_a: oa, gm_h: gmH, gm_a: gmA } = D;
  if (oh && oa) {
    const dd = Math.abs(oh - oa);
    if (dd > 2.5) { s += 18; f.push({ t: `Desequilíbrio alto (diff odd ${dd.toFixed(2)})`, c: 'p', v: '+18' }); }
    else if (dd > 1.5) { s += 10; f.push({ t: `Desequilíbrio moderado (diff ${dd.toFixed(2)})`, c: 'p', v: '+10' }); }
    else if (dd < 0.8) { s -= 10; f.push({ t: 'Times equilibrados — Lay 1x3 arriscado', c: 'n', v: '-10' }); }
  }
  const o35m = avg2(D, 'o35ft_h', 'o35ft_a');
  if (o35m !== undefined && o35m > 20) { s -= 12; f.push({ t: 'Goleadas frequentes — risco do Lay 1x3 aumentado', c: 'n', v: '-12' }); }
  if (gmH && gmA) {
    const maior = Math.max(gmH, gmA), menor = Math.min(gmH, gmA);
    if (menor > 0 && maior / menor > 2) { s += 10; f.push({ t: `Desequilíbrio ofensivo confirmado (${maior.toFixed(1)} vs ${menor.toFixed(1)})`, c: 'p', v: '+10' }); }
  }
  f.push({ t: 'Freq. 1x3/3x1 H2H — verificar no Zeus (não disponível no Sherlock)', c: 'w', v: '⚠' });
  return { score: clamp(s), factors: f };
}

// Handicap Asiático — recomenda lado favorito (-0.5 / -1) ou underdog (+0.5/+1)
// baseado em diferença de odds, força ofensiva e defensiva
function scoreHandicapAsiatico(D: ParsedData): ScoreResult {
  let s = 30; const f: Factor[] = [];
  const { odd_h: oh, odd_a: oa, gm_h: gmH, gm_a: gmA, gs_h: gsH, gs_a: gsA } = D;
  if (!oh || !oa) {
    f.push({ t: 'Sem odds 1X2 — não é possível calcular AH', c: 'w', v: '⚠' });
    return { score: 0, factors: f };
  }
  const diff = Math.abs(oh - oa);
  const fav = oh < oa ? 'Casa' : 'Visitante';
  const linha = diff > 2.5 ? '-1.0' : diff > 1.2 ? '-0.5' : '+0.25';
  if (diff > 2.5) { s += 25; f.push({ t: `Favoritismo forte para ${fav} (Δodd ${diff.toFixed(2)}) → AH ${linha}`, c: 'p', v: '+25' }); }
  else if (diff > 1.5) { s += 15; f.push({ t: `Favoritismo moderado para ${fav} (Δodd ${diff.toFixed(2)}) → AH ${linha}`, c: 'p', v: '+15' }); }
  else if (diff > 0.7) { s += 8; f.push({ t: `Leve favoritismo ${fav} (Δodd ${diff.toFixed(2)}) → AH ${linha}`, c: 'p', v: '+8' }); }
  else { s -= 12; f.push({ t: `Times equilibrados (Δodd ${diff.toFixed(2)}) — AH arriscado`, c: 'n', v: '-12' }); }
  // Força ofensiva do favorito vs defesa do underdog
  if (gmH && gmA && gsH && gsA) {
    const ataqueFav = fav === 'Casa' ? gmH : gmA;
    const defesaUnd = fav === 'Casa' ? gsA : gsH;
    if (ataqueFav > 1.5 && defesaUnd > 1.2) { s += 12; f.push({ t: `Favorito ataca bem (${ataqueFav.toFixed(1)}) vs defesa frágil (${defesaUnd.toFixed(1)})`, c: 'p', v: '+12' }); }
    else if (ataqueFav < 1.0) { s -= 10; f.push({ t: `Favorito ataque fraco (${ataqueFav.toFixed(1)}) — risco AH`, c: 'n', v: '-10' }); }
  }
  // Conferir CDG (consistência) do favorito
  const cdgFav = fav === 'Casa' ? D.cdg1h : D.cdg1a;
  if (cdgFav !== undefined) {
    if (cdgFav < 2.0) { s += 8; f.push({ t: `Favorito consistente (CDG ${cdgFav.toFixed(2)})`, c: 'p', v: '+8' }); }
    else if (cdgFav > 4.0) { s -= 10; f.push({ t: `Favorito inconsistente (CDG ${cdgFav.toFixed(2)})`, c: 'n', v: '-10' }); }
  }
  f.push({ t: `Linha sugerida: ${fav} ${linha}`, c: 'w', v: 'ℹ' });
  return { score: clamp(s), factors: f };
}
// ============================================================
function statusFor(s: number) {
  if (s >= 65) return { label: 'APROVADO', tone: 'success' as const };
  if (s >= 45) return { label: 'CUIDADO', tone: 'warning' as const };
  return { label: 'DESCARTADO', tone: 'destructive' as const };
}

const toneClasses = {
  success: 'bg-success/15 text-success border-success/30',
  warning: 'bg-warning/15 text-warning border-warning/30',
  destructive: 'bg-destructive/15 text-destructive border-destructive/30',
};
const fillClasses = {
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
};

// ============================================================
// Página
// ============================================================
export default function PunterAnaliseManual() {
  const navigate = useNavigate();
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [league, setLeague] = useState('');
  const [oddH, setOddH] = useState('');
  const [oddD, setOddD] = useState('');
  const [oddA, setOddA] = useState('');
  const [shData, setShData] = useState('');
  const [data, setData] = useState<ParsedData | null>(null);
  const [tab, setTab] = useState<'all' | 'ht' | 'er' | 'exp' | 'hist'>('all');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const { user } = useAuth();

  const loadHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    const { data: rows, error } = await supabase
      .from('analises_manuais' as any)
      .select('id, home_team, away_team, league_name, melhor_sinal, melhor_score, sinais_aprovados, sinais_atencao, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setLoadingHistory(false);
    if (error) { toast.error('Erro ao carregar histórico: ' + error.message); return; }
    setHistory(rows || []);
  };

  useEffect(() => { if (tab === 'hist') loadHistory(); /* eslint-disable-next-line */ }, [tab, user?.id]);

  const handleSave = async () => {
    if (!data) { toast.error('Analise os dados antes de salvar.'); return; }
    if (!home.trim() || !away.trim()) { toast.error('Informe os times casa e visitante.'); return; }
    if (!user) { toast.error('Faça login para salvar.'); return; }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        home_team: home.trim(),
        away_team: away.trim(),
        league_name: league.trim() || undefined,
        odd_h: oddH ? parseFloat(oddH) : undefined,
        odd_d: oddD ? parseFloat(oddD) : undefined,
        odd_a: oddA ? parseFloat(oddA) : undefined,
        fonte: 'sherlock',
      };
      // copia todos os campos parseados (ignora undefined)
      Object.entries(data).forEach(([k, v]) => { if (v !== undefined) payload[k] = v; });

      const { data: resp, error } = await supabase.functions.invoke('salvar-analise-manual', { body: payload });
      if (error) throw error;
      if ((resp as any)?.error) throw new Error((resp as any).error);
      toast.success(`Análise salva — Melhor: ${(resp as any).analise.melhor_sinal} (${(resp as any).analise.melhor_score}/100)`);
      if (tab === 'hist') loadHistory();
    } catch (e: any) {
      toast.error('Falha ao salvar: ' + (e.message || String(e)));
    } finally {
      setSaving(false);
    }
  };

  const D: ParsedData = useMemo(() => {
    if (!data) return {};
    const merged = { ...data };
    const oh = parseFloat(oddH); if (!isNaN(oh)) merged.odd_h = oh;
    const od = parseFloat(oddD); if (!isNaN(od)) merged.odd_d = od;
    const oa = parseFloat(oddA); if (!isNaN(oa)) merged.odd_a = oa;
    return merged;
  }, [data, oddH, oddD, oddA]);

  const results = useMemo(() => {
    if (!data) return null;
    return {
      'Over 0.5 HT': scoreOver05HT(D),
      'Over 1.5 HT': scoreOver15HT(D),
      'Over 2.5 FT': scoreOver25FT(D),
      'Over 3.5 FT': scoreOver35FT(D),
      'Under 2.5 FT': scoreUnder25FT(D),
      'BTTS FT': scoreBTTSFT(D),
      'Lay Goleada': scoreLayGoleada(D),
      'Lay 2x2': scoreLay2x2(D),
      'Lay 1x3/3x1': scoreLay1x3(D),
      'Handicap Asiático': scoreHandicapAsiatico(D),
    } as Record<string, ScoreResult>;
  }, [D, data]);

  const handleAnalyze = () => {
    if (!shData.trim()) {
      toast.error('Cole os dados do Sherlock antes de analisar.');
      return;
    }
    const parsed = parseSherlock(shData);
    setData(parsed);
    toast.success('Análise gerada com sucesso.');
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setShData(text);
      toast.success('Texto colado da área de transferência.');
    } catch {
      toast.error('Não foi possível ler a área de transferência.');
    }
  };

  // Itens parseados
  const parsedItems: Array<[string, string | undefined, string | undefined]> = data ? [
    ['CDG Média 1.0', D.cdg1h?.toFixed(2), D.cdg1a?.toFixed(2)],
    ['CDG CV 1.0', D.cv1h?.toFixed(2), D.cv1a?.toFixed(2)],
    ['CDG Média 2.0', D.cdg2h?.toFixed(2), D.cdg2a?.toFixed(2)],
    ['Gols marc./jogo', D.gm_h?.toFixed(2), D.gm_a?.toFixed(2)],
    ['Gols sofr./jogo', D.gs_h?.toFixed(2), D.gs_a?.toFixed(2)],
    ['Over 0.5 HT %', D.o05ht_h !== undefined ? D.o05ht_h + '%' : undefined, D.o05ht_a !== undefined ? D.o05ht_a + '%' : undefined],
    ['Over 1.5 HT %', D.o15ht_h !== undefined ? D.o15ht_h + '%' : undefined, D.o15ht_a !== undefined ? D.o15ht_a + '%' : undefined],
    ['Over 0.5 2T %', D.o052t_h !== undefined ? D.o052t_h + '%' : undefined, D.o052t_a !== undefined ? D.o052t_a + '%' : undefined],
    ['Over 2.5 FT %', D.o25ft_h !== undefined ? D.o25ft_h + '%' : undefined, D.o25ft_a !== undefined ? D.o25ft_a + '%' : undefined],
    ['Over 3.5 FT %', D.o35ft_h !== undefined ? D.o35ft_h + '%' : undefined, D.o35ft_a !== undefined ? D.o35ft_a + '%' : undefined],
    ['BTTS FT %', D.btts_h !== undefined ? D.btts_h + '%' : undefined, D.btts_a !== undefined ? D.btts_a + '%' : undefined],
    ['BTTS HT %', D.btts_ht_h !== undefined ? D.btts_ht_h + '%' : undefined, D.btts_ht_a !== undefined ? D.btts_ht_a + '%' : undefined],
    ['Race 1º HT (marcou)', D.r_marc1_h !== undefined ? D.r_marc1_h + '%' : undefined, D.r_marc1_a !== undefined ? D.r_marc1_a + '%' : undefined],
    ['Race 1º HT (sofreu)', D.r_sof1_h !== undefined ? D.r_sof1_h + '%' : undefined, D.r_sof1_a !== undefined ? D.r_sof1_a + '%' : undefined],
    ['Esc. HT média', D.esc_ht_avg_h?.toFixed(2), D.esc_ht_avg_a?.toFixed(2)],
    ['Esc. FT média', D.esc_ft_avg_h?.toFixed(2), D.esc_ft_avg_a?.toFixed(2)],
  ] : [];
  const missing = parsedItems.filter(i => i[1] === undefined && i[2] === undefined);

  const filteredResults = useMemo(() => {
    if (!results) return null;
    if (tab === 'ht') return { 'Over 0.5 HT': results['Over 0.5 HT'], 'Over 1.5 HT': results['Over 1.5 HT'] };
    if (tab === 'er') return { 'Lay Goleada': results['Lay Goleada'], 'Lay 2x2': results['Lay 2x2'], 'Lay 1x3/3x1': results['Lay 1x3/3x1'] };
    return results;
  }, [results, tab]);

  const exportText = useMemo(() => {
    if (!results) return '';
    const h = home || 'Casa';
    const a = away || 'Visitante';
    const l = league || 'Liga';
    let txt = 'MYCROFT — ANÁLISE MANUAL PRÉ-LIVE\n' + '='.repeat(36) + '\n' + h + ' x ' + a + ' | ' + l;
    if (oddH && oddA) txt += ' | Odds ' + oddH + '/' + oddA;
    txt += '\n\n';
    const entries = Object.entries(results);
    const ap = entries.filter(([, r]) => r.score >= 65);
    const cu = entries.filter(([, r]) => r.score >= 45 && r.score < 65);
    const dc = entries.filter(([, r]) => r.score < 45);
    if (ap.length) { txt += 'APROVADOS (score ≥ 65)\n'; ap.forEach(([n, r]) => { txt += `  [${r.score}/100] ${n}\n`; }); }
    if (cu.length) { txt += '\nATENÇÃO (45-64)\n'; cu.forEach(([n, r]) => { txt += `  [${r.score}/100] ${n}\n`; }); }
    if (dc.length) { txt += '\nDESCARTADOS\n'; dc.forEach(([n, r]) => { txt += `  [${r.score}/100] ${n}\n`; }); }
    txt += '\nGerado via Análise Manual Mycroft | Oráculo Mycroft';
    return txt;
  }, [results, home, away, league, oddH, oddA]);

  const copyExport = async () => {
    await navigator.clipboard.writeText(exportText);
    setCopied(true);
    toast.success('Análise copiada.');
    setTimeout(() => setCopied(false), 2000);
  };

  // Sumário
  const summary = useMemo(() => {
    if (!filteredResults) return null;
    const vals = Object.values(filteredResults);
    const ap = vals.filter(r => r.score >= 65).length;
    const cu = vals.filter(r => r.score >= 45 && r.score < 65).length;
    const best = vals.reduce((a, b) => (b.score > a.score ? b : a), vals[0]);
    const bestNm = Object.keys(filteredResults).find(k => filteredResults[k] === best) || '';
    return { ap, cu, best, bestNm };
  }, [filteredResults]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
          <button onClick={() => navigate('/punter/menu')} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <h1 className="font-mono text-sm font-semibold text-foreground tracking-tight">
              ANÁLISE MANUAL
            </h1>
            <span className="text-[10px] text-muted-foreground font-mono border border-border px-1.5 py-0.5 rounded">
              SHERLOCK BRIDGE
            </span>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-5 space-y-4 max-w-4xl">
        <PunterBreadcrumb items={[{ label: 'Funções', to: '/punter/funcoes' }, { label: 'Análise Manual' }]} />

        <p className="text-xs text-muted-foreground">
          Cole os dados extraídos do Sherlock e receba análise automática dos 9 mercados (Over/Under, BTTS, Lay Goleada, Lay 2x2 e Lay 1x3/3x1).
        </p>

        {/* JOGO */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">Jogo (preencher manualmente)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Time casa</Label>
                <Input value={home} onChange={e => setHome(e.target.value)} placeholder="Ex: KAA Gent" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Time visitante</Label>
                <Input value={away} onChange={e => setAway(e.target.value)} placeholder="Ex: Club Brugge" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Liga</Label>
                <Input value={league} onChange={e => setLeague(e.target.value)} placeholder="Ex: Pro League" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Odd casa</Label>
                <Input value={oddH} onChange={e => setOddH(e.target.value)} type="number" step="0.01" placeholder="5.30" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Odd empate</Label>
                <Input value={oddD} onChange={e => setOddD(e.target.value)} type="number" step="0.01" placeholder="4.50" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Odd visitante</Label>
                <Input value={oddA} onChange={e => setOddA(e.target.value)} type="number" step="0.01" placeholder="1.66" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PASTE */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">Cole aqui os dados do Sherlock</p>
              <Button size="sm" variant="outline" onClick={handlePaste} className="h-7 text-[11px]">
                <ClipboardPaste className="w-3 h-3 mr-1" /> Colar
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Copie o texto de todas as abas: CDG, Race, Escanteios e Over. Quanto mais dados, mais precisa a análise.
            </p>
            <textarea
              value={shData}
              onChange={e => setShData(e.target.value)}
              placeholder={'Exemplo:\n2.62 Média Custo do Gol (1.0) 4.59\n1.1 CV Custo do Gol (1.0) 0.47\n6 Gols marcados no FT 8 1.2 Média 1.6 1.09 CV 0.34\nO O O O U Race Over/Under 0.5 no HT O O O O O\n4 (80%) Jogos Over 0.5 no HT 5 (100%)\n...'}
              className="w-full min-h-[180px] rounded-md border border-input bg-background px-3 py-2 text-xs font-mono leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
            />
            <Button onClick={handleAnalyze} className="w-full">
              Analisar dados do Sherlock →
            </Button>
          </CardContent>
        </Card>

        {/* RESULTS */}
        {results && filteredResults && (
          <>
            {/* Dados extraídos */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">Dados extraídos automaticamente</p>
                {missing.length > 6 && (
                  <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[12px] text-warning">
                    Poucos dados extraídos ({missing.length} campos não encontrados). Certifique-se de copiar todas as abas do Sherlock: CDG, Race, Over e Escanteios.
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  <div className="rounded-md bg-muted/40 px-2.5 py-1.5">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Indicador</div>
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      <span className="text-[10px] font-bold text-muted-foreground">{(home || 'Casa').substring(0, 9)}</span>
                      <span className="text-[10px] font-bold text-muted-foreground">{(away || 'Visit').substring(0, 9)}</span>
                    </div>
                  </div>
                  {parsedItems.map(([label, h, a]) => {
                    const ok = h !== undefined || a !== undefined;
                    return (
                      <div key={label} className="rounded-md bg-muted/40 px-2.5 py-1.5">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
                        <div className="grid grid-cols-2 gap-1 mt-0.5">
                          <span className={cn('text-xs', ok ? 'font-medium text-foreground' : 'text-muted-foreground/40')}>
                            {h !== undefined ? h : '—'}
                          </span>
                          <span className={cn('text-xs', ok ? 'font-medium text-foreground' : 'text-muted-foreground/40')}>
                            {a !== undefined ? a : '—'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground/60">— = campo não encontrado no texto colado</p>
              </CardContent>
            </Card>

            {/* Tabs */}
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-2">Análise Mycroft</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {([
                  ['all', 'Todos os entradas'],
                  ['ht', 'Mercados HT'],
                  ['er', 'Eventos Raros'],
                  ['exp', 'Exportar'],
                  ['hist', 'Histórico'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs border transition-colors',
                      tab === key
                        ? 'bg-foreground text-background border-foreground font-medium'
                        : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === 'exp' ? (
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Button variant="outline" onClick={copyExport}>
                        {copied ? <><Check className="w-4 h-4 mr-1" /> Copiado!</> : <><Copy className="w-4 h-4 mr-1" /> Copiar texto</>}
                      </Button>
                      <Button onClick={handleSave} disabled={saving}>
                        {saving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Salvando…</> : <><Save className="w-4 h-4 mr-1" /> Salvar análise</>}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Os scores são recalculados no servidor para garantir integridade do histórico.
                    </p>
                    <pre className="text-[11px] font-mono whitespace-pre-wrap bg-muted/40 border border-border rounded-md p-3 max-h-[320px] overflow-y-auto text-muted-foreground">
                      {exportText}
                    </pre>
                  </CardContent>
                </Card>
              ) : tab === 'hist' ? (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 flex items-center gap-1.5">
                        <History className="w-3 h-3" /> Suas últimas 20 análises
                      </p>
                      <Button size="sm" variant="ghost" onClick={loadHistory} disabled={loadingHistory} className="h-7 text-[11px]">
                        {loadingHistory ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Atualizar'}
                      </Button>
                    </div>
                    {loadingHistory ? (
                      <div className="text-center text-xs text-muted-foreground py-6">Carregando…</div>
                    ) : history.length === 0 ? (
                      <div className="text-center text-xs text-muted-foreground py-6">Nenhuma análise salva ainda.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {history.map((h) => {
                          const score = Number(h.melhor_score) || 0;
                          const tone = score >= 65 ? 'success' : score >= 45 ? 'warning' : 'muted';
                          return (
                            <div key={h.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 px-3 py-2">
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium truncate">{h.home_team} x {h.away_team}</div>
                                <div className="text-[10px] text-muted-foreground truncate">
                                  {h.league_name || '—'} · {new Date(h.created_at).toLocaleString('pt-BR')}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{h.melhor_sinal || '—'}</div>
                                <div className={cn(
                                  'text-sm font-semibold',
                                  tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-muted-foreground',
                                )}>
                                  {score}/100
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  ✓ {h.sinais_aprovados ?? 0} · ⚠ {h.sinais_atencao ?? 0}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2.5">
                  {summary && (
                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Melhor entrada</div>
                        <div className="text-xs font-medium mt-0.5 truncate">{summary.bestNm}</div>
                        <div className="text-xl font-semibold mt-0.5">{summary.best.score}/100</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Aprovados</div>
                        <div className="text-xl font-semibold text-success mt-0.5">{summary.ap}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Atenção</div>
                        <div className="text-xl font-semibold text-warning mt-0.5">{summary.cu}</div>
                      </div>
                    </div>
                  )}
                  {Object.entries(filteredResults).map(([name, res]) => {
                    const st = statusFor(res.score);
                    return (
                      <Card key={name}>
                        <CardContent className="p-3.5 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium flex items-center gap-2">
                              <span className={cn('w-2 h-2 rounded-full', fillClasses[st.tone])} />
                              {name}
                            </span>
                            <span className={cn('text-[11px] font-semibold px-2.5 py-0.5 rounded-full border', toneClasses[st.tone])}>
                              {st.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className={cn('h-full rounded-full transition-all', fillClasses[st.tone])} style={{ width: `${res.score}%` }} />
                            </div>
                            <span className="text-xl font-medium min-w-[40px] text-right">{res.score}</span>
                          </div>
                          {res.factors.length > 0 && (
                            <div className="border-t border-border pt-2 space-y-1">
                              {res.factors.map((f, i) => (
                                <div key={i} className="flex items-center justify-between py-0.5 text-[11px]">
                                  <span className="text-muted-foreground">{f.t}</span>
                                  <span className={cn(
                                    'font-medium',
                                    f.c === 'p' ? 'text-success' : f.c === 'n' ? 'text-destructive' : 'text-muted-foreground',
                                  )}>
                                    {f.v}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
