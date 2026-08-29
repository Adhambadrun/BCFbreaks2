import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  const server = http.createServer(app);

  // Lazy Gemini client helper
  const getAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in server environment');
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });
  };

  // 1. Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 2. Google Search Grounding Endpoint (gemini-3.5-flash with googleSearch tool)
  app.post('/api/search', async (req, res) => {
    try {
      const { query } = req.body;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query is required' });
      }

      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `You are a real-time sales floor intelligence assistant for BCF Breaks (Business Class Flights floor). Answer the following query accurately with current real-world data: "${query}"`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const candidate = response.candidates?.[0];
      const text = response.text || 'No response generated.';
      const groundingMetadata = candidate?.groundingMetadata || null;

      // Extract search queries and source links
      const searchQueries = groundingMetadata?.webSearchQueries || [];
      const sources = (groundingMetadata?.groundingChunks || [])
        .map((chunk: any) => chunk.web)
        .filter(Boolean);

      return res.json({
        text,
        searchQueries,
        sources,
        groundingMetadata,
      });
    } catch (err: any) {
      console.error('Google Search Grounding Error:', err);
      return res.status(500).json({
        error: err.message || 'Failed to perform grounded search',
      });
    }
  });

  // 3. AI Floor Assistant & Break Intelligence
  app.post('/api/ai-chat', async (req, res) => {
    try {
      const { prompt, context } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: `You are the BCF Breaks Virtual Shift Supervisor and Sales Floor Coach for Business Class Flights.
Current Context: ${JSON.stringify(context || {})}
User Query: ${prompt}

Give concise, encouraging, and actionable response suitable for high-performing flight sales agents.`,
      });

      return res.json({ text: response.text });
    } catch (err: any) {
      console.error('AI Chat Error:', err);
      return res.status(500).json({ error: err.message || 'AI generation failed' });
    }
  });

  // 4. Gemini Live API WebSocket Server (/live) using gemini-3.1-flash-live-preview
  const wss = new WebSocketServer({ server, path: '/live' });

  wss.on('connection', async (clientWs: WebSocket) => {
    console.log('Client connected to Live Voice WebSocket');

    let session: any = null;

    try {
      const ai = getAI();

      session = await ai.live.connect({
        model: 'gemini-3.1-flash-live-preview',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: 'You are the BCF Breaks Voice Floor Assistant and Shift Dispatcher. You provide real-time voice assistance for flight sales agents, shift supervisors, and management during their shift. Keep your verbal responses natural, crisp, encouraging, and concise (under 2-3 sentences).',
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;

            // Audio output chunk (24kHz PCM)
            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              clientWs.send(JSON.stringify({ audio: audioData }));
            }

            // Interrupted by user speaking
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }

            // Output transcription
            const outTranscript = (message.serverContent as any)?.outputAudioTranscription?.text;
            if (outTranscript) {
              clientWs.send(JSON.stringify({ text: outTranscript, isModel: true }));
            }

            // Input transcription
            const inTranscript = (message.serverContent as any)?.inputAudioTranscription?.text;
            if (inTranscript) {
              clientWs.send(JSON.stringify({ text: inTranscript, isUser: true }));
            }
          },
          onclose: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ status: 'session_closed' }));
            }
          },
          onerror: (err: any) => {
            console.error('Gemini Live API Callback Error:', err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ error: err.message || 'Live session error' }));
            }
          },
        },
      });

      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ status: 'connected', model: 'gemini-3.1-flash-live-preview' }));
      }

      clientWs.on('message', (raw) => {
        try {
          const payload = JSON.parse(raw.toString());
          if (payload.audio && session) {
            // Realtime 16kHz PCM audio stream
            session.sendRealtimeInput({
              audio: {
                data: payload.audio,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          } else if (payload.text && session) {
            session.sendRealtimeInput({
              text: payload.text,
            });
          }
        } catch (e: any) {
          console.error('Error handling client WS message:', e);
        }
      });

      clientWs.on('close', () => {
        console.log('Client disconnected from Live Voice');
        if (session) {
          try {
            session.close();
          } catch (e) {}
        }
      });

    } catch (err: any) {
      console.error('Failed to initiate Gemini Live API connection:', err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          error: err.message || 'Unable to establish Gemini Live API connection. Please ensure GEMINI_API_KEY is configured.',
        }));
        clientWs.close();
      }
    }
  });

  // 5. Vite Middleware or Static Production Serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`BCFBreaks Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
