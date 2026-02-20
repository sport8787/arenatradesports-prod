
ALTER TABLE public.voice_recordings
ADD COLUMN baseline_id UUID REFERENCES public.biometric_baselines(id);

CREATE INDEX idx_voice_recordings_baseline_id ON public.voice_recordings(baseline_id);
