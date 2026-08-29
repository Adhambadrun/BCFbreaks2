import React, { useState, useEffect, useRef } from 'react';
import { GlassPanel } from '../shared/GlassPanel';
import { Mic, MicOff, Volume2, VolumeX, Sparkles, X, Radio, MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';
import { playSound } from '../../lib/sound';

interface VoiceFloorAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VoiceFloorAssistant: React.FC<VoiceFloorAssistantProps> = ({ isOpen, onClose }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Array<{ text: string; isModel?: boolean; isUser?: boolean }>>([]);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [userAudioLevel, setUserAudioLevel] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isMutedRef = useRef(false);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Convert float32 [-1, 1] to 16-bit PCM little endian base64
  const floatTo16BitPCMBase64 = (float32Array: Float32Array): string => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  // Convert base64 24kHz PCM to AudioBuffer and play gapless
  const playPCMChunk = (base64Data: string) => {
    try {
      if (!outputAudioCtxRef.current) {
        outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000,
        });
      }
      const ctx = outputAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const binary = window.atob(base64Data);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const currentTime = ctx.currentTime;
      if (nextStartTimeRef.current < currentTime) {
        nextStartTimeRef.current = currentTime;
      }

      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += audioBuffer.duration;

      activeSourcesRef.current.push(source);
      setIsAiSpeaking(true);

      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
        if (activeSourcesRef.current.length === 0) {
          setIsAiSpeaking(false);
        }
      };
    } catch (err) {
      console.error('Error playing PCM audio chunk:', err);
    }
  };

  const stopAudioPlayback = () => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch (e) {}
    });
    activeSourcesRef.current = [];
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    }
    setIsAiSpeaking(false);
  };

  const connectVoice = async () => {
    try {
      setIsConnecting(true);
      setErrorMessage(null);
      playSound('click');

      // Setup microphone audio stream at 16kHz
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      inputAudioCtxRef.current = inputCtx;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        playSound('notification');
        setTranscript((prev) => [
          ...prev,
          {
            text: 'Connected to Gemini Live Voice Assistant (gemini-3.1-flash-live-preview). How can I assist you on the floor today?',
            isModel: true,
          },
        ]);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.audio) {
            playPCMChunk(data.audio);
          }
          if (data.interrupted) {
            stopAudioPlayback();
          }
          if (data.text) {
            setTranscript((prev) => {
              const last = prev[prev.length - 1];
              if (last && ((data.isModel && last.isModel) || (data.isUser && last.isUser))) {
                return [...prev.slice(0, -1), { ...last, text: last.text + ' ' + data.text }];
              }
              return [...prev, { text: data.text, isModel: data.isModel, isUser: data.isUser }];
            });
          }
          if (data.error) {
            setErrorMessage(data.error);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket Error:', err);
        setErrorMessage('WebSocket connection error. Please check GEMINI_API_KEY setup.');
        setIsConnecting(false);
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        stopMicrophone();
      };

      // Connect microphone processing pipeline
      const micSource = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (isMutedRef.current || ws.readyState !== WebSocket.OPEN) return;
        const channelData = e.inputBuffer.getChannelData(0);

        // Simple volume meter
        let sum = 0;
        for (let i = 0; i < channelData.length; i++) {
          sum += Math.abs(channelData[i]);
        }
        setUserAudioLevel(Math.min(100, Math.round((sum / channelData.length) * 500)));

        const base64Audio = floatTo16BitPCMBase64(channelData);
        ws.send(JSON.stringify({ audio: base64Audio }));
      };

      micSource.connect(processor);
      processor.connect(inputCtx.destination);
    } catch (err: any) {
      console.error('Failed to start Live Voice:', err);
      setErrorMessage(err.message || 'Microphone access denied or connection failed.');
      setIsConnecting(false);
      setIsConnected(false);
    }
  };

  const stopMicrophone = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
    }
    setUserAudioLevel(0);
  };

  const disconnectVoice = () => {
    stopMicrophone();
    stopAudioPlayback();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    playSound('click');
  };

  const sendTextPrompt = (prompt: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ text: prompt }));
      setTranscript((prev) => [...prev, { text: prompt, isUser: true }]);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      disconnectVoice();
    }
    return () => {
      disconnectVoice();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl">
      <GlassPanel
        material="thick"
        concentricRadius="xl"
        className="w-full max-w-xl p-6 border-2 border-crimson/50 shadow-[0_0_90px_rgba(255,0,60,0.35)] space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-crimson/20 border border-crimson/60 flex items-center justify-center text-crimson">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              {isConnected && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-black animate-ping" />
              )}
            </div>
            <div>
              <div className="font-orbitron font-black text-lg text-white flex items-center gap-2">
                Live Voice Dispatcher
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-crimson/20 border border-crimson/40 text-red-300">
                  gemini-3.1-flash-live-preview
                </span>
              </div>
              <div className="text-xs text-zinc-400 font-inter">
                Real-time, bidirectional voice conversations with the BCF Floor Assistant
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Live Audio Visualizer Stage */}
        <div className="relative h-40 rounded-2xl bg-black/60 border border-white/15 overflow-hidden flex flex-col items-center justify-center p-4">
          {/* Visual Waveform bars */}
          <div className="flex items-center justify-center gap-1.5 h-20 w-full">
            {Array.from({ length: 24 }).map((_, i) => {
              let height = 8;
              if (isAiSpeaking) {
                height = 12 + Math.sin(Date.now() / 150 + i) * 35 + Math.random() * 25;
              } else if (isConnected && !isMuted) {
                height = 6 + (userAudioLevel / 100) * 55 * Math.sin((i / 24) * Math.PI);
              }
              return (
                <div
                  key={i}
                  style={{ height: `${Math.max(6, Math.min(70, height))}px` }}
                  className={`w-1.5 rounded-full transition-all duration-75 ${
                    isAiSpeaking
                      ? 'bg-gradient-to-t from-crimson to-yellow-400 shadow-[0_0_10px_rgba(255,0,60,0.8)]'
                      : isConnected && !isMuted
                      ? 'bg-cyan-400 shadow-[0_0_8px_rgba(0,229,255,0.6)]'
                      : 'bg-zinc-700'
                  }`}
                />
              );
            })}
          </div>

          {/* Status Badge */}
          <div className="mt-2 text-xs font-orbitron flex items-center gap-2">
            {isAiSpeaking ? (
              <span className="text-yellow-400 flex items-center gap-1.5 animate-pulse">
                <Volume2 className="w-4 h-4" /> AI Speaking...
              </span>
            ) : isConnected ? (
              <span className="text-emerald-400 flex items-center gap-1.5">
                <Radio className="w-4 h-4 animate-spin" /> Live Session Active · Listening to your mic
              </span>
            ) : isConnecting ? (
              <span className="text-cyan-400 flex items-center gap-1.5 animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin" /> Initializing Live API session...
              </span>
            ) : (
              <span className="text-zinc-500 flex items-center gap-1.5">
                <MicOff className="w-4 h-4" /> Disconnected · Press Start Conversation to talk
              </span>
            )}
          </div>
        </div>

        {/* Live Conversation Transcript */}
        <div className="h-36 overflow-y-auto p-3 rounded-xl bg-black/40 border border-white/10 space-y-2 text-xs font-inter">
          {transcript.length === 0 ? (
            <div className="text-center text-zinc-500 py-6">
              Live transcription will appear here as you speak with the AI assistant.
            </div>
          ) : (
            transcript.map((item, idx) => (
              <div
                key={idx}
                className={`p-2 rounded-lg ${
                  item.isModel
                    ? 'bg-crimson/10 border border-crimson/30 text-red-200 ml-4'
                    : 'bg-cyan-950/30 border border-cyan-800/40 text-cyan-200 mr-4'
                }`}
              >
                <div className="text-[10px] font-orbitron font-bold uppercase tracking-wider text-zinc-400 mb-0.5">
                  {item.isModel ? 'AI Floor Dispatcher' : 'You'}
                </div>
                <div>{item.text}</div>
              </div>
            ))
          )}
        </div>

        {/* Quick Voice Chips */}
        {isConnected && (
          <div className="flex flex-wrap gap-2">
            {[
              'What is our current floor break policy?',
              'How can I qualify for the 10-minute bonus break?',
              'Give me a 10-second motivational booster for closing business class deals!',
            ].map((chip, idx) => (
              <button
                key={idx}
                onClick={() => sendTextPrompt(chip)}
                className="text-[11px] font-inter px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 transition-all text-left"
              >
                💬 {chip}
              </button>
            ))}
          </div>
        )}

        {/* Controls Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <div className="flex items-center gap-2">
            {isConnected && (
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-orbitron transition-all ${
                  isMuted
                    ? 'bg-yellow-400/20 border-yellow-400/50 text-yellow-300'
                    : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                }`}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                <span>{isMuted ? 'Unmute' : 'Mute Mic'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!isConnected ? (
              <button
                onClick={connectVoice}
                disabled={isConnecting}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-crimson to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-orbitron font-bold text-xs shadow-[0_0_25px_rgba(255,0,60,0.4)] flex items-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Mic className="w-4 h-4" />
                <span>{isConnecting ? 'Connecting...' : 'Start Live Voice'}</span>
              </button>
            ) : (
              <button
                onClick={disconnectVoice}
                className="px-5 py-2.5 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-700 text-red-200 font-orbitron text-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <MicOff className="w-4 h-4" />
                <span>Disconnect</span>
              </button>
            )}
          </div>
        </div>
      </GlassPanel>
    </div>
  );
};
