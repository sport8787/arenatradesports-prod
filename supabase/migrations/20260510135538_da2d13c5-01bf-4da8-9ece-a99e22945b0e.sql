UPDATE public.user_subscriptions
SET plan='premium',
    is_active=true,
    subscription_started_at=COALESCE(subscription_started_at, now()),
    subscription_ends_at=now() + interval '30 days',
    allowed_arenas=ARRAY['arena_live','arena_punter','multiplas','banca_virtual','banca_real'],
    notes=COALESCE(notes,'') || ' | Upgrade manual para liberar chat Mycroft (regiverissimo@gmail.com)',
    updated_at=now()
WHERE user_id='e36f6940-b6db-4a63-9d54-b05e892b05e4';