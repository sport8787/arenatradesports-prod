import { createRoot } from "react-dom/client";
import { PostHogProvider } from "@posthog/react";
import App from "./App.tsx";
import "./index.css";

const POSTHOG_KEY = 'phc_RnKvfx3XmL6ASJSDNrNf8WiVBUEEOM57pzru1KwhX2f';
const POSTHOG_HOST = 'https://us.i.posthog.com';

const options = {
  api_host: POSTHOG_HOST,
  person_profiles: 'identified_only' as const,
  capture_pageview: true,
  capture_pageleave: true,
  autocapture: true,
  defaults: '2026-01-30',
} as const;

createRoot(document.getElementById("root")!).render(
  <PostHogProvider apiKey={POSTHOG_KEY} options={options}>
    <App />
  </PostHogProvider>
);
