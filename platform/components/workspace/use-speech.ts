"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Browser speech-to-text through the Web Speech API. Nothing leaves the device through us.
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getRecognition(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeech(onText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const ref = useRef<Recognition | null>(null);

  useEffect(() => {
    setSupported(getRecognition() !== null);
  }, []);

  const toggle = useCallback(() => {
    if (listening) {
      ref.current?.stop();
      return;
    }
    const Ctor = getRecognition();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "en-GB";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, i) => event.results[i][0]?.transcript ?? "").join(" ");
      if (transcript.trim()) onText(transcript.trim());
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    ref.current = recognition;
    setListening(true);
    recognition.start();
  }, [listening, onText]);

  return { supported, listening, toggle };
}
