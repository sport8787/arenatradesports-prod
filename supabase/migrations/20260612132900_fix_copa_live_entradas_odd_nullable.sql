-- copa_live_entradas.odd pode ser null (sinais sem odd registrada, ex: APROVADO_SITUACIONAL ao vivo)
ALTER TABLE public.copa_live_entradas
  ALTER COLUMN odd DROP NOT NULL;
