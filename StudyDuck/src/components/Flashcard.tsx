import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import './Flashcard.css';

// Initialize the SDK
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

interface Card {
  front: string;
  back: string;
}

export function Flashcard() {
  const [isOpen, setIsOpen] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  // States for generation and deck management
  const [prompt, setPrompt] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError(null);
    setCards([]);
    setCurrentIndex(0);
    setIsFlipped(false);

    try {
      const response = await ai.models.generateContent({
        model: 'gemma-4-31b-it',
        contents: `Generate 10 educational flashcards about: ${prompt}`,
        config: {
          temperature: 0.2, // Low temperature for consistent JSON formatting
          systemInstruction: `You are an expert tutor. Your ONLY job is to output a valid JSON array of objects based on the user's topic. 
          
          Strict Rules:
          1. Each object must have exactly two keys: "front" and "back".
          2. The "front" MUST be phrased as a clear, specific question (e.g., "What is the capital of France?").
          3. The "back" MUST be the concise answer to that question.
          4. DO NOT include any conversational text or markdown blocks like \`\`\`json. 
          5. Only output the raw JSON array starting with [ and ending with ].`,
        },
      });

      // Clean the AI response in case it stubbornly includes markdown backticks
      let cleanJson = response.text || '[]';
      cleanJson = cleanJson
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      const parsedCards = JSON.parse(cleanJson);

      if (Array.isArray(parsedCards) && parsedCards.length > 0) {
        setCards(parsedCards);
      } else {
        throw new Error('AI returned invalid flashcard data.');
      }
    } catch (err) {
      console.error('Failed to generate flashcards:', err);
      setError(
        'Failed to generate flashcards. Please check your topic or API key.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Navigation handlers
  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setIsFlipped(false);
      // Brief delay to allow the flip animation to reset before changing text
      setTimeout(() => setCurrentIndex((prev) => prev + 1), 150);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex((prev) => prev - 1), 150);
    }
  };

  const currentCard = cards[currentIndex];

  return (
    <>
      {/* Grid Pane Trigger */}
      <div
        className="workspace__pane tool-trigger flashcard-trigger"
        onClick={() => setIsOpen(true)}
      >
        <div className="tool-icon">📇</div>
        <h3>Flashcards</h3>
        <p>Review key concepts</p>
      </div>

      {/* Fullscreen Modal */}
      {isOpen && (
        <div className="modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Flashcard Review</h2>
              <button className="close-btn" onClick={() => setIsOpen(false)}>
                ✕
              </button>
            </div>

            {/* Input Area */}
            <div className="flashcard-input-section">
              <input
                type="text"
                className="text-input"
                placeholder="Topic (e.g., French verbs, Javascript arrays...)"
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
                {isLoading ? '✨ Generating...' : '✨ Generate'}
              </button>
            </div>

            {/* Error State */}
            {error && (
              <div className="flashcard-placeholder">
                <p style={{ color: '#c64d5c' }}>{error}</p>
              </div>
            )}

            {/* Empty / Loading State */}
            {!error && cards.length === 0 && (
              <div className="flashcard-placeholder">
                <span className="placeholder-icon">📇</span>
                <p>
                  {isLoading
                    ? 'Writing your cards...'
                    : 'Enter a topic above to generate a deck.'}
                </p>
              </div>
            )}

            {/* The 3D Flipping Card (Only renders when cards exist) */}
            {cards.length > 0 && (
              <>
                <div className="deck-counter">
                  Card {currentIndex + 1} of {cards.length}
                </div>

                <div
                  className={`flashcard-container ${isFlipped ? 'flipped' : ''}`}
                  onClick={() => setIsFlipped(!isFlipped)}
                >
                  <div className="flashcard-inner">
                    <div className="flashcard-face flashcard-front">
                      <span className="card-label">Front</span>
                      <p className="card-text">{currentCard.front}</p>
                    </div>
                    <div className="flashcard-face flashcard-back">
                      <span className="card-label">Back</span>
                      <p className="card-text">{currentCard.back}</p>
                    </div>
                  </div>
                </div>

                <div className="modal-controls">
                  <button
                    className="action-btn secondary"
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                    style={{
                      opacity: currentIndex === 0 ? 0.5 : 1,
                      cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Previous
                  </button>
                  <button
                    className="action-btn primary"
                    onClick={() => setIsFlipped(!isFlipped)}
                  >
                    Flip Card
                  </button>
                  <button
                    className="action-btn secondary"
                    onClick={handleNext}
                    disabled={currentIndex === cards.length - 1}
                    style={{
                      opacity: currentIndex === cards.length - 1 ? 0.5 : 1,
                      cursor:
                        currentIndex === cards.length - 1
                          ? 'not-allowed'
                          : 'pointer',
                    }}
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
