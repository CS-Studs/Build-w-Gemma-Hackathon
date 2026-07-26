import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import './DuckChat.css';

// Initialize the SDK using the Vite environment variable
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

// 1. We define what a "Message" looks like
interface Message {
  id: number;
  text: string;
  imageUrl?: string; // The '?' means the image is optional
  sender: 'user' | 'bot';
}

export function DuckChat() {
  // --- TYPESCRIPT LOGIC ---

  // State to keep track of our conversation history
  const [messages, setMessages] = useState<Message[]>([]);

  // State for the current text input and selected image
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Track when Gemma is generating a response
  const [isLoading, setIsLoading] = useState(false);

  // References
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<any>(null);

  // Initialize the Gemma chat session on component mount
  useEffect(() => {
    chatRef.current = ai.chats.create({
      model: 'gemma-4-31b-it',
      config: {
        systemInstruction:
          'You are a warm but firm anti-procrastination tutor. Your goal is to help the user learn and break through mental blocks. Never just give the direct answer. Break problems down, ask guiding questions, and encourage them to find the solution themselves.',
      },
    });
  }, []);

  // Handle attaching an image
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Create a temporary local URL so we can preview the image
      const imageUrl = URL.createObjectURL(file);
      setSelectedImage(imageUrl);
    }
  };

  // Handle sending a message
  const handleSendMessage = async () => {
    // Prevent sending if both text and image are empty
    if (!inputText.trim() && !selectedImage) return;

    // 1. Add user message to UI immediately
    const userMessage: Message = {
      id: Date.now(),
      text: inputText,
      imageUrl: selectedImage || undefined,
      sender: 'user',
    };

    setMessages((prev) => [...prev, userMessage]);

    // Capture current text to send to API, then clear inputs
    const textToSend = inputText;
    setInputText('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      // 2. Send text to Gemma
      // Note: We are currently only sending the text prompt.
      // Sending actual image data to the API requires converting the file to base64 first.
      const response = await chatRef.current.sendMessage({
        message: textToSend,
      });

      // 3. Add bot response to UI
      const botMessage: Message = {
        id: Date.now() + 1,
        text: response.text,
        sender: 'bot',
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error('Error connecting to Gemma:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: "I'm having trouble connecting right now. Please check your network or API key.",
          sender: 'bot',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- HTML (JSX) LAYOUT ---
  return (
    <div className="duckchat-container">
      {/* Header */}
      <div className="duckchat-header">
        <h2>DuckChat</h2>
        <p>Your anti-procrastination partner</p>
      </div>

      {/* Chat History Area */}
      <div className="duckchat-history">
        {messages.length === 0 ? (
          <div className="empty-state">
            No messages yet. What are we avoiding today?
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`message-bubble ${msg.sender}`}>
              {msg.imageUrl && (
                <img
                  src={msg.imageUrl}
                  alt="Attached"
                  className="message-image"
                />
              )}
              {msg.text && <p>{msg.text}</p>}
            </div>
          ))
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="message-bubble bot">
            <p>
              <i>Thinking...</i>
            </p>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="duckchat-input-area">
        {/* Image Preview */}
        {selectedImage && (
          <div className="image-preview">
            <img src={selectedImage} alt="Preview" />
            <button onClick={() => setSelectedImage(null)} disabled={isLoading}>
              X
            </button>
          </div>
        )}

        <div className="input-controls">
          {/* Hidden file input */}
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageChange}
            style={{ display: 'none' }}
          />

          <button
            className="attach-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach an image"
            disabled={isLoading}
          >
            📎
          </button>

          <input
            type="text"
            className="text-input"
            placeholder="Type a message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' && !isLoading && handleSendMessage()
            }
            disabled={isLoading}
          />

          <button
            className="send-btn"
            onClick={handleSendMessage}
            disabled={isLoading || (!inputText.trim() && !selectedImage)}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
