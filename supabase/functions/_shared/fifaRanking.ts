// FIFA ranking seed — atualizar manualmente após cada janela FIFA.
// Fonte: ranking oficial FIFA. Valores aproximados pós-Eliminatórias 2026.
// Estrutura: nome canônico (lowercase, sem acento) → { rank, pts }

export interface FifaEntry { rank: number; pts: number; }

const RAW: Record<string, FifaEntry> = {
  "argentina":            { rank: 1,  pts: 1886 },
  "france":               { rank: 2,  pts: 1859 },
  "spain":                { rank: 3,  pts: 1854 },
  "england":              { rank: 4,  pts: 1812 },
  "brazil":               { rank: 5,  pts: 1776 },
  "portugal":             { rank: 6,  pts: 1772 },
  "netherlands":          { rank: 7,  pts: 1754 },
  "belgium":              { rank: 8,  pts: 1733 },
  "italy":                { rank: 9,  pts: 1718 },
  "germany":              { rank: 10, pts: 1716 },
  "croatia":              { rank: 11, pts: 1698 },
  "morocco":              { rank: 12, pts: 1694 },
  "colombia":             { rank: 13, pts: 1679 },
  "uruguay":              { rank: 14, pts: 1670 },
  "usa":                  { rank: 15, pts: 1660 },
  "mexico":               { rank: 16, pts: 1647 },
  "switzerland":          { rank: 17, pts: 1635 },
  "senegal":              { rank: 18, pts: 1631 },
  "japan":                { rank: 19, pts: 1626 },
  "denmark":              { rank: 20, pts: 1620 },
  "iran":                 { rank: 21, pts: 1601 },
  "korea republic":       { rank: 22, pts: 1592 },
  "south korea":          { rank: 22, pts: 1592 },
  "austria":              { rank: 23, pts: 1583 },
  "australia":            { rank: 24, pts: 1554 },
  "ukraine":              { rank: 25, pts: 1549 },
  "ecuador":              { rank: 26, pts: 1547 },
  "sweden":               { rank: 27, pts: 1540 },
  "turkey":               { rank: 28, pts: 1535 },
  "wales":                { rank: 29, pts: 1531 },
  "poland":               { rank: 30, pts: 1525 },
  "serbia":               { rank: 31, pts: 1518 },
  "egypt":                { rank: 32, pts: 1512 },
  "algeria":              { rank: 33, pts: 1507 },
  "norway":               { rank: 34, pts: 1500 },
  "canada":               { rank: 35, pts: 1494 },
  "chile":                { rank: 36, pts: 1490 },
  "nigeria":              { rank: 37, pts: 1485 },
  "scotland":             { rank: 38, pts: 1480 },
  "greece":               { rank: 39, pts: 1475 },
  "russia":               { rank: 40, pts: 1470 },
  "panama":               { rank: 41, pts: 1462 },
  "tunisia":              { rank: 42, pts: 1458 },
  "peru":                 { rank: 43, pts: 1454 },
  "paraguay":             { rank: 44, pts: 1450 },
  "cote d'ivoire":        { rank: 45, pts: 1445 },
  "ivory coast":          { rank: 45, pts: 1445 },
  "romania":              { rank: 46, pts: 1440 },
  "czech republic":       { rank: 47, pts: 1438 },
  "venezuela":            { rank: 48, pts: 1432 },
  "slovakia":             { rank: 49, pts: 1428 },
  "hungary":              { rank: 50, pts: 1425 },
  "qatar":                { rank: 53, pts: 1412 },
  "iraq":                 { rank: 58, pts: 1390 },
  "saudi arabia":         { rank: 59, pts: 1385 },
  "costa rica":           { rank: 54, pts: 1410 },
  "jamaica":              { rank: 56, pts: 1400 },
  "uzbekistan":           { rank: 57, pts: 1395 },
  "jordan":               { rank: 64, pts: 1370 },
  "south africa":         { rank: 60, pts: 1383 },
  "cape verde":           { rank: 70, pts: 1340 },
  "new zealand":          { rank: 86, pts: 1280 },
  "haiti":                { rank: 83, pts: 1290 },
  "curacao":              { rank: 82, pts: 1295 },
};

function norm(name: string): string {
  return (name || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getFifa(team: string): FifaEntry | null {
  const k = norm(team);
  if (RAW[k]) return RAW[k];
  // tenta sem palavras supérfluas
  const k2 = k.replace(/^(seleção|selecao)\s+/i, "");
  return RAW[k2] || null;
}
