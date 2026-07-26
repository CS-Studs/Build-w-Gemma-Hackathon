import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import './DuckChat.css';
import {
  type UserProfile,
  USER_PROFILE_CHANGED_EVENT,
  USER_PROFILE_STORAGE_KEY,
  buildDuckChatSystemInstruction,
  loadUserProfile,
} from './userProfileStore';

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

  // Safety check so React Strict Mode doesn't send two greetings
  const hasInitialized = useRef(false);

  // Initialize the Gemma chat session on component mount
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const startChat = async () => {
      // 1. Create the chat session
      chatRef.current = ai.chats.create({
        model: 'gemma-4-31b-it',
        config: {
          temperature: 0.5,
          systemInstruction: `You are an adaptive, psychologically-aware anti-procrastination tutor. Your core directive is to build, utilize, and continuously update a 'Psychological Profile' of the user to tailor their learning experience.

          ### THE LIVING PROFILE (Continuous Monitoring)
          You must actively listen to both the user's explicit statements and implicit cues (frustration, sudden task-switching, negative self-talk, tone). Use these to constantly refine your internal profile of their psychology (e.g., ADHD, perfectionism, executive dysfunction, burnout). If they show signs of frustration or distraction, immediately adapt your strategy.

          ### PHASE 1: INTAKE & PROFILING
          When the conversation starts, your goal is to understand both the *what* and the *why*.
          1. Identify the specific task they are avoiding.
          2. Gently probe the psychological or neurological root of their procrastination. (e.g., "Are you feeling overwhelmed by the size of it, is your ADHD making it hard to start, or are you worried it won't be perfect?")
          *Rule: Do not start tutoring until you have a baseline psychological profile.*

          ### PHASE 2: TAILORED TUTORING
          Directly apply psychological frameworks to your teaching based on the user's profile:
          - ADHD / EXECUTIVE DYSFUNCTION: Provide high-dopamine, gamified interactions. Use extreme structure, issue only one micro-step at a time, and give frequent positive reinforcement.
          - PERFECTIONISM / ANXIETY: Focus on "drafting" rather than "finishing." Validate their feelings, lower the stakes, and celebrate messy, imperfect progress.
          - BURNOUT / OVERWHELM: Use ridiculously small micro-steps. Offer extreme empathy and require minimal cognitive load per interaction.

          ### ONGOING RULES
          - Never give the direct answer. Break problems down and use guiding questions so they find the solution themselves.
          - Keep responses concise and highly conversational.
          - If your current strategy isn't working, acknowledge it, update your profile, and pivot your approach.`,
        },
      });

      // 2. Secretly ask the AI to start the conversation
      setIsLoading(true);
      try {
        const response = await chatRef.current.sendMessage({
          message:
            'SYSTEM PROMPT: The user just opened the app. Introduce yourself warmly in one brief sentence, and ask your first profiling question to find out what they are avoiding today.',
        });

        // 3. Put the AI's greeting on the screen
        setMessages([
          {
            id: Date.now(),
            text: response.text,
            sender: 'bot',
          },
        ]);
      } catch (error) {
        console.error('Error starting chat:', error);
      } finally {
        setIsLoading(false);
      }
    };

    startChat();
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
    loadingRef.current = true;

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
      loadingRef.current = false;
      if (pendingProfileRef.current) {
        replaceChatProfile(pendingProfileRef.current);
        pendingProfileRef.current = null;
      }
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
              {msg.text && <ReactMarkdown>{msg.text}</ReactMarkdown>}
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
