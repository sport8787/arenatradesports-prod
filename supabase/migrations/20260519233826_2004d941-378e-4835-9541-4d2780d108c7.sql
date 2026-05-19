UPDATE public.mycroft_planos
SET ativo = false
WHERE id = '7c836688-d202-4ef9-8b03-458f96433d27'
   OR LOWER(nome) LIKE '%bunker%'
   OR mercado ILIKE '%under 2.5%'
   OR mercado ILIKE '%under 1.5%';