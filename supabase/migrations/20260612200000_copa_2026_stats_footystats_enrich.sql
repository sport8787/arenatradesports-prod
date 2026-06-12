-- copa_2026_stats: enriquecimento com dados reais FootyStats
-- Fonte: tabelas pasted pelo usuário (Last 15 matches, Copa 2026)
-- avg_xg = GF/15, avg_xga = GA/15 (goals per game como proxy de xG)
-- over*/ht_*: percentuais observados reais (não estimativas Poisson)
-- avg_corners: Total Corners Per Game table (ambos os times)

ALTER TABLE public.copa_2026_stats
  ADD COLUMN IF NOT EXISTS form_ppg       DECIMAL(4,2),
  ADD COLUMN IF NOT EXISTS over15_pct     DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS over35_pct     DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS ht_goals_avg   DECIMAL(4,2),
  ADD COLUMN IF NOT EXISTS ht_over05_pct  DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS ht_over15_pct  DECIMAL(5,2);

-- England
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('England',15,'WDLWW',2.47,2.40,0.33,2.40,0.33,80.0,13.0,9.8,40.0,80.0,20.0,1.2,80.0,30.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Argentina
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Argentina',15,'WWWWW',2.47,2.20,0.40,2.20,0.40,67.0,27.0,7.3,50.0,80.0,20.0,1.2,100.0,30.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Norway
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Norway',15,'WLDWD',2.40,3.27,0.67,3.27,0.67,47.0,53.0,8.2,60.0,80.0,50.0,1.3,80.0,40.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Algeria
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Algeria',15,'LWDWW',2.40,2.20,0.40,2.20,0.40,67.0,27.0,9.34,40.0,60.0,30.0,0.9,50.0,20.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Senegal
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Senegal',15,'WWWLD',2.33,2.47,0.53,2.47,0.53,67.0,27.0,10.2,40.0,60.0,30.0,0.7,60.0,20.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- France
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('France',15,'WWWLW',2.27,2.40,1.13,2.40,1.13,33.0,60.0,8.5,90.0,100.0,50.0,1.1,90.0,30.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Turkey
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Turkey',15,'DWWWW',2.27,2.27,1.27,2.27,1.27,33.0,53.0,11.5,70.0,80.0,60.0,1.1,80.0,70.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Morocco
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Morocco',15,'DWWWD',2.27,1.93,0.47,1.93,0.47,60.0,33.0,8.77,40.0,70.0,20.0,0.6,40.0,20.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Austria
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Austria',15,'WDWWW',2.20,2.20,0.60,2.20,0.60,47.0,40.0,7.7,40.0,60.0,30.0,1.2,50.0,20.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Spain
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Spain',15,'DWDDW',2.20,2.87,1.13,2.87,1.13,47.0,53.0,9.4,70.0,90.0,50.0,1.7,90.0,70.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Japan
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Japan',15,'WWWWW',2.20,1.87,0.53,1.87,0.53,67.0,20.0,7.6,30.0,50.0,20.0,0.5,70.0,20.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Ivory Coast
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Ivory Coast',15,'WLWWW',2.20,2.00,0.53,2.00,0.53,67.0,27.0,9.2,50.0,70.0,30.0,0.9,80.0,50.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

UPDATE public.copa_2026_stats SET
  last_matches=15,form_last5='WLWWW',form_ppg=2.20,avg_xg=2.00,avg_xga=0.53,
  avg_goals_scored=2.00,avg_goals_conceded=0.53,clean_sheet_pct=67.0,btts_pct=27.0,
  avg_corners=9.2,over_25_pct=50.0,over15_pct=70.0,over35_pct=30.0,
  ht_goals_avg=0.9,ht_over05_pct=80.0,ht_over15_pct=50.0,
  source='footystats',last_updated=now()
WHERE team_name ILIKE '%ivoire%' OR team_name ILIKE '%cote%';

-- Germany
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Germany',15,'WWWWW',2.13,2.33,1.13,2.33,1.13,33.0,53.0,10.4,70.0,90.0,50.0,1.3,90.0,50.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Croatia
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Croatia',15,'WWLLW',2.13,2.27,0.93,2.27,0.93,40.0,47.0,10.9,70.0,80.0,40.0,0.7,80.0,30.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Portugal
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Portugal',15,'WDWWW',2.07,2.40,1.07,2.40,1.07,27.0,60.0,8.4,60.0,80.0,40.0,1.3,70.0,60.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Belgium
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Belgium',15,'WWDWW',2.07,3.07,0.93,3.07,0.93,47.0,47.0,11.8,60.0,90.0,60.0,1.1,90.0,40.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- South Korea
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('South Korea',15,'LLWWW',2.07,1.73,0.93,1.73,0.93,60.0,13.0,8.4,50.0,70.0,40.0,0.3,50.0,30.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

UPDATE public.copa_2026_stats SET
  last_matches=15,form_last5='LLWWW',form_ppg=2.07,avg_xg=1.73,avg_xga=0.93,
  avg_goals_scored=1.73,avg_goals_conceded=0.93,clean_sheet_pct=60.0,btts_pct=13.0,
  avg_corners=8.4,over_25_pct=50.0,over15_pct=70.0,over35_pct=40.0,
  ht_goals_avg=0.3,ht_over05_pct=50.0,ht_over15_pct=30.0,
  source='footystats',last_updated=now()
WHERE team_name ILIKE '%korea%' AND team_name NOT ILIKE '%north%'
  AND team_name != 'South Korea';

-- Netherlands
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Netherlands',15,'WWDLW',2.00,2.53,0.93,2.53,0.93,33.0,60.0,8.9,60.0,90.0,40.0,1.1,90.0,40.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- DR Congo
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('DR Congo',15,'WLWWD',2.00,1.40,0.67,1.40,0.67,60.0,33.0,7.75,10.0,50.0,0.0,0.6,50.0,20.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

UPDATE public.copa_2026_stats SET
  last_matches=15,form_last5='WLWWD',form_ppg=2.00,avg_xg=1.40,avg_xga=0.67,
  avg_goals_scored=1.40,avg_goals_conceded=0.67,clean_sheet_pct=60.0,btts_pct=33.0,
  avg_corners=7.75,over_25_pct=10.0,over15_pct=50.0,over35_pct=0.0,
  ht_goals_avg=0.6,ht_over05_pct=50.0,ht_over15_pct=20.0,
  source='footystats',last_updated=now()
WHERE team_name ILIKE '%congo%' AND team_name != 'DR Congo';

-- Cape Verde
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Cape Verde',15,'DLDWW',2.00,1.80,0.80,1.80,0.80,53.0,47.0,8.89,50.0,80.0,20.0,0.7,70.0,20.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

UPDATE public.copa_2026_stats SET
  last_matches=15,form_last5='DLDWW',form_ppg=2.00,avg_xg=1.80,avg_xga=0.80,
  avg_goals_scored=1.80,avg_goals_conceded=0.80,clean_sheet_pct=53.0,btts_pct=47.0,
  avg_corners=8.89,over_25_pct=50.0,over15_pct=80.0,over35_pct=20.0,
  ht_goals_avg=0.7,ht_over05_pct=70.0,ht_over15_pct=20.0,
  source='footystats',last_updated=now()
WHERE team_name ILIKE '%cape verde islands%';

-- Switzerland
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Switzerland',15,'DLDWD',1.93,2.40,1.00,2.40,1.00,40.0,60.0,8.0,50.0,80.0,40.0,1.4,60.0,50.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Australia
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Australia',15,'LWWLD',1.93,1.67,0.93,1.67,0.93,33.0,47.0,6.5,40.0,50.0,20.0,0.3,60.0,10.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Czech Republic
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Czech Republic',15,'DDWWL',1.87,2.00,1.13,2.00,1.13,40.0,60.0,8.89,70.0,80.0,40.0,1.2,70.0,40.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

UPDATE public.copa_2026_stats SET
  last_matches=15,form_last5='DDWWL',form_ppg=1.87,avg_xg=2.00,avg_xga=1.13,
  avg_goals_scored=2.00,avg_goals_conceded=1.13,clean_sheet_pct=40.0,btts_pct=60.0,
  avg_corners=8.89,over_25_pct=70.0,over15_pct=80.0,over35_pct=40.0,
  ht_goals_avg=1.2,ht_over05_pct=70.0,ht_over15_pct=40.0,
  source='footystats',last_updated=now()
WHERE team_name ILIKE '%czechia%';

-- Scotland
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Scotland',15,'WLLWW',1.87,1.93,1.13,1.93,1.13,33.0,47.0,10.9,60.0,70.0,50.0,0.8,70.0,20.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Canada
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Canada',15,'WDDWD',1.87,1.40,0.33,1.40,0.33,73.0,20.0,9.3,10.0,40.0,10.0,0.3,40.0,10.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Ecuador
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Ecuador',15,'WDDWW',1.80,1.00,0.40,1.00,0.40,60.0,40.0,8.1,20.0,70.0,0.0,0.6,60.0,20.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Brazil
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Brazil',15,'DLWWW',1.80,2.00,1.13,2.00,1.13,33.0,60.0,7.3,70.0,90.0,40.0,1.2,100.0,60.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Mexico
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Mexico',15,'DWWWW',1.80,1.40,0.73,1.40,0.73,60.0,33.0,7.4,30.0,60.0,20.0,0.8,60.0,20.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Uzbekistan
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Uzbekistan',15,'DWDLL',1.73,1.47,0.73,1.47,0.73,53.0,40.0,8.6,40.0,70.0,20.0,0.56,44.0,22.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- United States (USA / USMNT)
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('United States',15,'WLLWL',1.73,1.73,1.53,1.73,1.53,13.0,73.0,10.5,60.0,100.0,30.0,1.1,100.0,70.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

UPDATE public.copa_2026_stats SET
  last_matches=15,form_last5='WLLWL',form_ppg=1.73,avg_xg=1.73,avg_xga=1.53,
  avg_goals_scored=1.73,avg_goals_conceded=1.53,clean_sheet_pct=13.0,btts_pct=73.0,
  avg_corners=10.5,over_25_pct=60.0,over15_pct=100.0,over35_pct=30.0,
  ht_goals_avg=1.1,ht_over05_pct=100.0,ht_over15_pct=70.0,
  source='footystats',last_updated=now()
WHERE team_name IN ('USA','USMNT') OR team_name ILIKE '%united states%';

-- Egypt
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Egypt',15,'DWDWL',1.73,1.27,0.87,1.27,0.87,40.0,47.0,8.5,40.0,40.0,30.0,0.7,40.0,30.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Bosnia and Herzegovina
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Bosnia and Herzegovina',15,'DDDDD',1.67,1.73,0.93,1.73,0.93,27.0,73.0,8.6,50.0,90.0,40.0,0.6,70.0,20.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

UPDATE public.copa_2026_stats SET
  last_matches=15,form_last5='DDDDD',form_ppg=1.67,avg_xg=1.73,avg_xga=0.93,
  avg_goals_scored=1.73,avg_goals_conceded=0.93,clean_sheet_pct=27.0,btts_pct=73.0,
  avg_corners=8.6,over_25_pct=50.0,over15_pct=90.0,over35_pct=40.0,
  ht_goals_avg=0.6,ht_over05_pct=70.0,ht_over15_pct=20.0,
  source='footystats',last_updated=now()
WHERE team_name ILIKE '%bosnia%' AND team_name != 'Bosnia and Herzegovina';

-- Iran
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Iran',15,'DDLWW',1.67,1.80,0.80,1.80,0.80,47.0,40.0,7.88,60.0,70.0,30.0,0.7,60.0,20.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Colombia
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Colombia',15,'WLLWW',1.67,1.93,1.07,1.93,1.07,40.0,53.0,7.4,80.0,90.0,40.0,0.9,80.0,40.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Paraguay
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Paraguay',15,'LWWLW',1.67,1.40,1.00,1.40,1.00,40.0,47.0,8.9,50.0,60.0,20.0,0.4,50.0,30.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Panama
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Panama',15,'DWLWD',1.67,1.67,1.27,1.67,1.27,20.0,73.0,8.6,50.0,90.0,30.0,1.0,80.0,50.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Iraq
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Iraq',15,'LWWDL',1.60,0.93,0.93,0.93,0.93,33.0,40.0,9.3,30.0,80.0,0.0,0.6,80.0,40.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Curaçao
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Curaçao',15,'DLLLW',1.53,2.00,1.20,2.00,1.20,47.0,47.0,7.89,50.0,80.0,50.0,0.78,67.0,33.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

UPDATE public.copa_2026_stats SET
  last_matches=15,form_last5='DLLLW',form_ppg=1.53,avg_xg=2.00,avg_xga=1.20,
  avg_goals_scored=2.00,avg_goals_conceded=1.20,clean_sheet_pct=47.0,btts_pct=47.0,
  avg_corners=7.89,over_25_pct=50.0,over15_pct=80.0,over35_pct=50.0,
  ht_goals_avg=0.78,ht_over05_pct=67.0,ht_over15_pct=33.0,
  source='footystats',last_updated=now()
WHERE team_name ILIKE '%curacao%';

-- Uruguay
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Uruguay',15,'WDLDD',1.47,0.93,0.87,0.93,0.87,53.0,33.0,9.33,30.0,60.0,10.0,0.3,40.0,10.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Sweden
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Sweden',15,'DWWLD',1.40,2.00,1.67,2.00,1.67,13.0,60.0,9.1,60.0,90.0,60.0,0.5,80.0,40.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Jordan
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Jordan',15,'LDDLL',1.40,1.60,1.53,1.60,1.53,33.0,53.0,9.9,70.0,80.0,50.0,0.6,80.0,30.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Saudi Arabia
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Saudi Arabia',15,'LLLWD',1.40,1.07,1.13,1.07,1.13,33.0,40.0,7.4,60.0,60.0,20.0,0.3,60.0,10.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Ghana
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Ghana',15,'LLLLD',1.40,1.67,1.13,1.67,1.13,40.0,40.0,8.7,30.0,70.0,20.0,0.2,60.0,0.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- South Africa
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('South Africa',15,'DLDDL',1.40,1.47,1.13,1.47,1.13,27.0,60.0,7.0,50.0,80.0,20.0,0.33,78.0,22.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Tunisia
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Tunisia',15,'DWDLL',1.40,1.40,1.27,1.40,1.27,27.0,53.0,10.1,50.0,70.0,40.0,0.6,70.0,10.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Haiti
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Haiti',15,'WLDWL',1.27,1.53,1.27,1.53,1.27,40.0,40.0,9.5,50.0,70.0,20.0,0.7,80.0,40.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- New Zealand
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('New Zealand',15,'LLWLL',0.73,0.87,1.60,0.87,1.60,13.0,40.0,9.6,40.0,70.0,30.0,0.3,70.0,10.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;

-- Qatar
INSERT INTO public.copa_2026_stats
  (team_name,last_matches,form_last5,form_ppg,avg_xg,avg_xga,avg_goals_scored,avg_goals_conceded,
   clean_sheet_pct,btts_pct,avg_corners,over_25_pct,over15_pct,over35_pct,
   ht_goals_avg,ht_over05_pct,ht_over15_pct,source,last_updated)
VALUES ('Qatar',15,'LDLLD',0.67,0.60,1.53,0.60,1.53,20.0,40.0,8.7,50.0,60.0,20.0,0.2,50.0,20.0,'footystats',now())
ON CONFLICT (team_name) DO UPDATE SET
  last_matches=15,form_last5=EXCLUDED.form_last5,form_ppg=EXCLUDED.form_ppg,
  avg_xg=EXCLUDED.avg_xg,avg_xga=EXCLUDED.avg_xga,
  avg_goals_scored=EXCLUDED.avg_goals_scored,avg_goals_conceded=EXCLUDED.avg_goals_conceded,
  clean_sheet_pct=EXCLUDED.clean_sheet_pct,btts_pct=EXCLUDED.btts_pct,
  avg_corners=EXCLUDED.avg_corners,over_25_pct=EXCLUDED.over_25_pct,
  over15_pct=EXCLUDED.over15_pct,over35_pct=EXCLUDED.over35_pct,
  ht_goals_avg=EXCLUDED.ht_goals_avg,ht_over05_pct=EXCLUDED.ht_over05_pct,ht_over15_pct=EXCLUDED.ht_over15_pct,
  source=EXCLUDED.source,last_updated=EXCLUDED.last_updated;
