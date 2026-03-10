
ALTER TABLE public.mycroft_memory ADD COLUMN IF NOT EXISTS context text[] NOT NULL DEFAULT '{sports,analyst}';
ALTER TABLE public.mycroft_memory ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0;
ALTER TABLE public.mycroft_memory RENAME COLUMN instruction TO rule_text;
CREATE INDEX IF NOT EXISTS idx_mycroft_memory_context ON public.mycroft_memory USING GIN (context);
CREATE INDEX IF NOT EXISTS idx_mycroft_memory_priority ON public.mycroft_memory (priority DESC);
