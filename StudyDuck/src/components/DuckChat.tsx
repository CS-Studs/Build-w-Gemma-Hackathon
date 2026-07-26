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
import {
  type TodoCreationProposal,
  applyTodoProposal,
  getTodoStructure,
  validateTodoProposal,
} from './todoBoardStore';

// Initialize the SDK using the Vite environment variable
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
const TODO_TOOLS = [{
  functionDeclarations: [
    { name: 'get_todo_structure', description: 'Read the current project and list names and IDs before targeting an existing destination.', parametersJsonSchema: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'propose_todo_creations', description: 'Propose an atomic set of projects, lists, and tasks for user confirmation. Tasks always require a list destination.', parametersJsonSchema: {
      type: 'object', additionalProperties: false, required: ['projects', 'lists', 'tasks'], properties: {
        projects: { type: 'array', items: { type: 'object', required: ['ref', 'title'], properties: { ref: { type: 'string' }, title: { type: 'string' } } } },
        lists: { type: 'array', items: { type: 'object', required: ['ref', 'title', 'destination'], properties: { ref: { type: 'string' }, title: { type: 'string' }, destination: { type: 'string', enum: ['ungrouped', 'existing_project', 'new_project'] }, projectId: { type: 'string' }, projectRef: { type: 'string' } } } },
        tasks: { type: 'array', items: { type: 'object', required: ['text', 'destination'], properties: { text: { type: 'string' }, destination: { type: 'string', enum: ['existing_list', 'new_list'] }, listId: { type: 'string' }, listRef: { type: 'string' } } } },
      },
    } },
  ],
}];

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
  const [pendingTodo, setPendingTodo] = useState<{ call: any; proposal: TodoCreationProposal } | null>(null);

  // References
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<any>(null);
  const proposalRef = useRef<HTMLElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const pendingProfileRef = useRef<UserProfile | null>(null);
  const resolvingTodoRef = useRef(false);

  // Safety check so React Strict Mode doesn't send two greetings
  const hasInitialized = useRef(false);

  const replaceChatProfile = (profile: UserProfile) => {
    const history = chatRef.current?.getHistory(true) ?? [];
    chatRef.current = ai.chats.create({
      model: 'gemma-4-31b-it',
      config: {
        temperature: 0.5,
        systemInstruction: buildDuckChatSystemInstruction(profile),
        tools: TODO_TOOLS,
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

  const appendBotMessage = (text: string) => {
    if (!text) return;
    setMessages((previous) => [...previous, { id: Date.now() + Math.random(), text, sender: 'bot' }]);
  };

  const processModelResponse = async (response: any, depth = 0): Promise<void> => {
    if (depth >= 4) { appendBotMessage("I couldn't complete that board request safely. Please try rephrasing it."); return; }
    const calls = response.functionCalls ?? [];
    if (!calls.length) { appendBotMessage(response.text ?? 'Done.'); return; }
    const call = calls[0];
    if (call.name === 'get_todo_structure') {
      const next = await chatRef.current.sendMessage({ message: [{ functionResponse: { id: call.id, name: call.name, response: { output: getTodoStructure() } } }] });
      await processModelResponse(next, depth + 1);
      return;
    }
    if (call.name === 'propose_todo_creations') {
      const checked = validateTodoProposal(call.args);
      if (checked.ok) { setPendingTodo({ call, proposal: checked.proposal }); return; }
      const next = await chatRef.current.sendMessage({ message: [{ functionResponse: { id: call.id, name: call.name, response: { error: checked.error } } }] });
      await processModelResponse(next, depth + 1);
      return;
    }
    const next = await chatRef.current.sendMessage({ message: [{ functionResponse: { id: call.id, name: call.name, response: { error: 'Unknown tool.' } } }] });
    await processModelResponse(next, depth + 1);
  };

  useEffect(() => {
    if (!pendingTodo) return;
    const frame = window.requestAnimationFrame(() => {
      proposalRef.current?.scrollIntoView({
        block: 'end',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pendingTodo]);

  useEffect(() => {
    if (pendingTodo) return;
    const frame = window.requestAnimationFrame(() => {
      chatBottomRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, isLoading, pendingTodo]);

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

      await processModelResponse(response);
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

  const resolveTodoProposal = async (confirmed: boolean) => {
    if (!pendingTodo || resolvingTodoRef.current) return;
    resolvingTodoRef.current = true;
    const pending = pendingTodo;
    setPendingTodo(null);
    setIsLoading(true);
    loadingRef.current = true;
    try {
      const result = confirmed ? applyTodoProposal(pending.proposal) : { ok: false as const, error: 'The user cancelled the proposal.' };
      const response = await chatRef.current.sendMessage({ message: [{ functionResponse: { id: pending.call.id, name: pending.call.name, response: result.ok ? { output: result.created } : { error: result.error, cancelled: !confirmed } } }] });
      await processModelResponse(response);
    } catch (error) {
      console.error('Error resolving to-do proposal:', error);
      appendBotMessage("I couldn't update the board. Nothing was intentionally changed; please try again.");
    } finally {
      resolvingTodoRef.current = false;
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
        {pendingTodo && (
          <article ref={proposalRef} className="duckchat-proposal" aria-label="Proposed to-do changes">
            <div className="duckchat-proposal__header"><strong>Review board changes</strong><span>{pendingTodo.proposal.projects.length + pendingTodo.proposal.lists.length + pendingTodo.proposal.tasks.length} items</span></div>
            <div className="duckchat-proposal__body">
              {!!pendingTodo.proposal.projects.length && <p><b>Projects</b>{pendingTodo.proposal.projects.map((item) => item.title).join(', ')}</p>}
              {!!pendingTodo.proposal.lists.length && <p><b>Lists</b>{pendingTodo.proposal.lists.map((item) => item.title).join(', ')}</p>}
              {!!pendingTodo.proposal.tasks.length && <p><b>Tasks</b>{pendingTodo.proposal.tasks.map((item) => item.text).join(', ')}</p>}
            </div>
            <div className="duckchat-proposal__actions"><button type="button" className="duckchat-proposal__cancel" onClick={() => void resolveTodoProposal(false)}>Cancel</button><button type="button" className="duckchat-proposal__confirm" onClick={() => void resolveTodoProposal(true)}>Create</button></div>
          </article>
        )}
        <div ref={chatBottomRef} className="duckchat-scroll-anchor" aria-hidden="true" />
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
            disabled={isLoading || !!pendingTodo}
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
              e.key === 'Enter' && !isLoading && !pendingTodo && handleSendMessage()
            }
            disabled={isLoading || !!pendingTodo}
          />

          <button
            className="send-btn"
            onClick={handleSendMessage}
            disabled={isLoading || !!pendingTodo || (!inputText.trim() && !selectedImage)}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
