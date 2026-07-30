"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";

// Uses the browser's built-in speech recognition (Web Speech API) to
// transcribe live speech into text — no API key, no server cost. Only
// Chrome and Edge implement this reliably today; Safari and Firefox don't,
// so the button disables itself with an explanation there.
export function VoiceNoteButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-GB";

    recognition.onstart = () => {
      setStarting(false);
      setListening(true);
    };
    recognition.onresult = (event: any) => {
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
      }
      if (finalText.trim()) onTranscript(finalText.trim());
    };
    recognition.onerror = () => {
      setListening(false);
      setStarting(false);
    };
    recognition.onend = () => {
      setListening(false);
      setStarting(false);
    };

    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle() {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
    } else {
      setStarting(true);
      try {
        recognitionRef.current.start();
      } catch {
        setStarting(false);
      }
    }
  }

  if (!supported) {
    return (
      <span
        title="Voice notes need Chrome or Edge — this browser doesn't support live speech recognition."
        className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-neutral-500 cursor-not-allowed"
      >
        <MicOff size={13} /> Voice note unavailable
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
        listening ? "bg-red-500/20 text-red-300 animate-pulse" : "border border-white/10 text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800"
      }`}
      title="Dictate a note — transcribed text will be appended below"
    >
      {starting ? <Loader2 size={13} className="animate-spin" /> : <Mic size={13} />}
      {listening ? "Listening… tap to stop" : "Dictate note"}
    </button>
  );
}
