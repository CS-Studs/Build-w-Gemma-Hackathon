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
  const loadingRef = useRef(false);
  const pendingProfileRef = useRef<UserProfile | null>(null);

  // Safety check so React Strict Mode doesn't send two greetings
  const hasInitialized = useRef(false);

  const replaceChatProfile = (profile: UserProfile) => {
    const history = chatRef.current?.getHistory(true) ?? [];
    chatRef.current = ai.chats.create({
      model: 'gemma-4-31b-it',
      config: {
        temperature: 0.5,
        systemInstruction: buildDuckChatSystemInstruction(profile),
      },
      history,
    });
  };

  const applyPendingProfile = () => {
    const pending = pendingProfileRef.current;
    pendingProfileRef.current = null;
    if (!pending) return;
    try {
      replaceChatProfile(pending);
    } catch (error) {
      console.error('Error applying DuckChat personalization:', error);
    }
  };

  // Initialize Gemma, keep the one-time welcome, and respond to profile updates.
  useEffect(() => {
    const applyProfile = (profile: UserProfile) => {
      if (loadingRef.current) pendingProfileRef.current = profile;
      else {
        try {
          replaceChatProfile(profile);
        } catch (error) {
          console.error('Error applying DuckChat personalization:', error);
        }
      }
    };
    const handleProfileChange = (event: Event) => {
      applyProfile((event as CustomEvent<UserProfile>).detail);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === USER_PROFILE_STORAGE_KEY) {
        applyProfile(loadUserProfile());
      }
    };

    window.addEventListener(USER_PROFILE_CHANGED_EVENT, handleProfileChange);
    window.addEventListener('storage', handleStorage);

    const startChat = async () => {
      setIsLoading(true);
      loadingRef.current = true;
      try {
        replaceChatProfile(loadUserProfile());
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
        setMessages([
          {
            id: Date.now(),
            text: "I'm having trouble connecting right now. Please check your network or API key.",
            sender: 'bot',
          },
        ]);
      } finally {
        loadingRef.current = false;
        setIsLoading(false);
        applyPendingProfile();
      }
    };

    if (!hasInitialized.current) {
      hasInitialized.current = true;
      void startChat();
    }

    return () => {
      window.removeEventListener(USER_PROFILE_CHANGED_EVENT, handleProfileChange);
      window.removeEventListener('storage', handleStorage);
    };
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
      loadingRef.current = true;
      if (!chatRef.current) {
        throw new Error('DuckChat has not finished initializing.');
      }
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
      setIsLoading(false);
      applyPendingProfile();
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
