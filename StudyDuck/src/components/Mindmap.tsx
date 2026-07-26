import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import mermaid from 'mermaid';
import './Mindmap.css';

// Initialize the SDK using the Vite environment variable
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

export function Mindmap() {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [mermaidCode, setMermaidCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError(null);
    setMermaidCode(null);

    try {
      // 1. Ask Gemma to generate the Mermaid syntax
      const response = await ai.models.generateContent({
        model: 'gemma-4-31b-it',
        contents: `Create a comprehensive mindmap about: ${prompt}`,
        config: {
          temperature: 0.2, // Keep it low so the AI focuses on strict syntax formatting
          systemInstruction: `You are an expert data visualizer. 
          Your ONLY job is to output valid Mermaid.js 'mindmap' syntax based on the user's prompt. 
          
          Strict Rules:
          1. Use the 'mindmap' graph type.
          2. Keep node text concise (1-3 words).
          3. Do not include any explanations, markdown blocks, or greetings.
          4. Only return the raw Mermaid syntax starting with the word 'mindmap'.
          
          Example format:
          mindmap
            root((Procrastination))
              Psychological
                Anxiety
                Perfectionism
              Neurological
                ADHD
                Dopamine
              Solutions
                Micro-steps
                Pomodoro`,
        },
      });

      // 2. Clean up the response (AI sometimes stubbornly adds markdown backticks anyway)
      let cleanCode = response.text || '';
      cleanCode = cleanCode
        .replace(/```mermaid/gi, '')
        .replace(/```/g, '')
        .trim();

      // 3. Set the state to trigger the Mermaid render
      setMermaidCode(cleanCode);
    } catch (err) {
      console.error('Failed to generate mindmap:', err);
      setError(
        'Failed to generate mindmap. Please try a different topic or check your API key.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Grid Pane Trigger */}
      <div
        className="workspace__pane tool-trigger mindmap-trigger"
        onClick={() => setIsOpen(true)}
      >
        <div className="tool-icon">🧠</div>
        <h3>Mindmap</h3>
        <p>Visualize your thoughts</p>
      </div>

      {/* Fullscreen Modal */}
      {isOpen && (
        <div className="modal-overlay" onClick={() => setIsOpen(false)}>
          <div
            className="modal-content large-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Knowledge Map</h2>
              <button className="close-btn" onClick={() => setIsOpen(false)}>
                ✕
              </button>
            </div>

            {/* The Input Area */}
            <div className="mindmap-input-section">
              <input
                type="text"
                className="text-input"
                placeholder="What do you want to map out? (e.g., Photosynthesis, World War 2...)"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) =>
                  e.key === 'Enter' && !isLoading && handleGenerate()
                }
              />
              <button
                className="action-btn primary"
                onClick={handleGenerate}
                disabled={isLoading || !prompt.trim()}
              >
                {isLoading ? '✨ Mapping...' : '✨ Generate'}
              </button>
            </div>

            {/* The Canvas Area */}
            <div className="mindmap-canvas">
              {isLoading && (
                <div className="mindmap-placeholder">
                  <span className="placeholder-icon">🧠</span>
                  <p>Thinking and mapping...</p>
                </div>
              )}

              {error && (
                <div className="mindmap-placeholder">
                  <span className="placeholder-icon">⚠️</span>
                  <p style={{ color: '#c64d5c' }}>{error}</p>
                </div>
              )}

              {!isLoading && !error && !mermaidCode && (
                <div className="mindmap-placeholder">
                  <span className="placeholder-icon">🗺️</span>
                  <p>Type a topic above to generate a map.</p>
                </div>
              )}

              {/* Only render if we have clean code and aren't loading */}
              {!isLoading && mermaidCode && (
                <MermaidRenderer chart={mermaidCode} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// --- HELPER COMPONENT ---
// This isolates the Mermaid rendering logic so it doesn't crash React
function MermaidRenderer({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize mermaid with dark theme
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
      fontFamily: 'inherit',
    });

    // 1. Flag to track if the component unmounts or re-renders mid-generation
    let isCancelled = false;

    const renderChart = async () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = ''; // Clear old chart

        try {
          // 2. Generate a unique, random ID for every single render
          // This prevents React Strict Mode from crashing Mermaid with duplicate IDs
          const uniqueId = `mermaid-${Math.random().toString(36).substr(2, 9)}`;

          // Render new chart
          const { svg } = await mermaid.render(uniqueId, chart);

          // 3. Only inject the SVG if React hasn't already cancelled this render cycle
          if (!isCancelled && containerRef.current) {
            containerRef.current.innerHTML = svg;
          }
        } catch (error) {
          if (!isCancelled && containerRef.current) {
            console.error('Mermaid syntax error:', error);
            containerRef.current.innerHTML = `<p style="color: #c64d5c; padding: 20px;">Error rendering map. The AI generated invalid syntax.</p>`;
          }
        }
      }
    };

    renderChart();

    // 4. React Cleanup Function
    // If React fires a second time (Strict Mode), this tells the first one to abort injecting the DOM
    return () => {
      isCancelled = true;
    };
  }, [chart]);

  return <div ref={containerRef} className="mermaid-container" />;
}
