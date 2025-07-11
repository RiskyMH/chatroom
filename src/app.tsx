import { useEffect, useState, useRef, memo, useMemo, useCallback } from "react";
import "./index.css";


interface ChatMessage {
  message: string;
  userId: string;
  author: string;
  authorEmoji?: string;
  timestamp?: string;
  type: "message" | "connect" | "disconnect" | "typing";
  isTyping?: boolean;
  currentUsers?: number;
}

interface MessageGroup {
  author: string;
  authorEmoji?: string;
  userId: string;
  messages: {
    message: string;
    timestamp?: string;
  }[];
}

// Add new interface for typing state
interface TypingState {
  userId: string;
  author: string;
  authorEmoji?: string;
  timestamp: number;
}

// New custom hook for WebSocket connection
function useWebSocket() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Don't recreate if connection exists
    }

    let url = `ws://${window.location.host}/ws`;
    if (window.location.protocol === "https:") {
      url = `wss://${window.location.host}/ws`;
    }
    const websocket = new WebSocket(url);

    websocket.onmessage = (event) => {
      if (event.data === 'pong') {
        return;
      }
      const data = JSON.parse(event.data);
      if (data.type === "connect" && userId === null) {
        setUserId(id => id ?? data.userId);
      }
    };

    websocket.onopen = () => {
      console.log("Connected to websocket");
    };

    websocket.onclose = () => {
      // wait 500ms and try to reconnect
      setTimeout(() => {
        connect();
        setUserId(null);
      }, 500);
    };

    websocket.onerror = (event) => {
      console.error("Websocket error", event);
      websocket.close();
    };

    const pingInterval = setInterval(() => {
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send('ping');
        }
      }
    }, 25_000);

    wsRef.current = websocket;
    setWs(websocket);

    if (!import.meta.hot) {
      return () => {
        websocket.close();
        wsRef.current = null;
        clearInterval(pingInterval);
      };
    }
  }, []);

  useEffect(connect, [connect]);

  return { ws, userId };
}

// Memoize the AuthorBubble component
const AuthorBubble = memo(({ author, emoji }: { author: string; emoji?: string }) => {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-full bg-slate-200/75 dark:bg-gray-700/75 backdrop-blur-sm flex items-center justify-center overflow-hidden shadow-lg border border-slate-300/50 dark:border-gray-600/50">
        {emoji ? (
          <span className="text-lg leading-none">{emoji}</span>
        ) : (
          <span className="text-sm font-medium leading-none text-gray-700 dark:text-gray-300">
            {author.charAt(0)}
          </span>
        )}
      </div>
      <span className="text-gray-700/90 dark:text-gray-300/90 text-sm font-medium">
        {author}
      </span>
    </div>
  );
});

// Memoize the SystemMessage component
const SystemMessage = memo(({ message, currentUserId }: { message: ChatMessage, currentUserId: string | null }) => {
  const formatMessageTime = useCallback((timestamp?: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  return (
    <div className="text-center my-4 group flex gap-2 items-center justify-center">
      <span className="text-xs text-right text-gray-500 dark:text-gray-400/75 opacity-0 sm:group-hover:opacity-100 transition-all duration-300 w-full self-center max-sm:hidden">
        {formatMessageTime(message.timestamp)}
      </span>
      <span className="sm:text-nowrap text-sm text-gray-500 dark:text-gray-400/75 bg-slate-100/50 dark:bg-gray-800/50 px-4 py-2 rounded-full backdrop-blur-sm border border-slate-200/25 dark:border-gray-700/25 shadow-lg flex items-center justify-center gap-2">
        <div className="w-5 h-5 rounded-full bg-slate-200/75 dark:bg-gray-700/75 flex items-center justify-center">
          {message.authorEmoji && (
            <span className="text-base leading-none">{message.authorEmoji}</span>
          )}
        </div>
        {message.userId === currentUserId ? `You (${message.author}) have ` : `${message.author} has `} {message.type === "connect" ? "joined" : "left"}
      </span>
      <span className="text-xs text-left text-gray-500 dark:text-gray-400/75 opacity-0 sm:group-hover:opacity-100 transition-all duration-300 w-full self-center max-sm:hidden">
        {message.currentUsers && message.currentUsers > 0 && (
          `${message.currentUsers} users online`
        )}
      </span>
    </div>
  );
});

// Update MessageInput component with Discord-like timing
const MessageInput = memo(({ onSend, onTyping, disabled }: {
  onSend: (message: string) => void;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
}) => {
  const inputMessage = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<number>(0);
  const lastTypingRef = useRef<number>(0);
  const TYPING_INTERVAL = 3500; // Send typing every 5 seconds

  const [hasContent, setHasContent] = useState(false);

  const handleTyping = useCallback(() => {
    const now = Date.now();

    // Send typing indicator if it's been more than 5 seconds or first time
    if (now - lastTypingRef.current > TYPING_INTERVAL || lastTypingRef.current === 0) {
      onTyping(true);
      lastTypingRef.current = now;
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to clear typing status
    typingTimeoutRef.current = window.setTimeout(() => {
      onTyping(false);
      lastTypingRef.current = 0;
    }, TYPING_INTERVAL);
  }, [onTyping]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.current?.value.trim()) return;

    onSend(inputMessage.current.value);
    inputMessage.current.value = "";

    // Clear typing state on send
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    onTyping(false);
    setHasContent(false);
    lastTypingRef.current = 0;
  }, [onSend, onTyping]);

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 relative">
      <textarea
        ref={inputMessage}
        rows={1}
        // disabled={disabled}
        className="flex-1 bg-neutral-800/50 backdrop-blur-sm text-neutral-100 border border-neutral-700/50 rounded-xl px-6 py-3 focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 shadow-lg transition-all placeholder:text-neutral-400/50 resize-none max-h-56 field-sizing-content disabled:opacity-50 disabled:cursor-not-allowed"
        // placeholder={disabled ? "Connecting to server..." : "Type a message..."}
        placeholder={"Type a message..."}
        onInput={(e) => {
          handleTyping();
          // Auto-grow the textarea
          const target = e.target as HTMLTextAreaElement;
          target.style.height = 'auto';
          target.style.height = `${target.scrollHeight + 2}px`;

          setHasContent(target.value.trim().length > 0);
        }}
        onKeyDown={(e) => {
          const target = e.target as HTMLTextAreaElement;
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);

            target.style.height = 'auto';
            target.style.height = `${target.scrollHeight + 2}px`;
          }
        }}
        onBlur={() => {
          // onTyping(false);
          lastTypingRef.current = 0;
        }}
      />
      <button
        type="submit"
        disabled={!hasContent || disabled}
        className="bg-orange-600 hover:bg-orange-500 text-white px-4 sm:px-8 py-3 rounded-xl shadow-lg hover:shadow-orange-500/25 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        title={disabled ? "Connecting to server..." : (hasContent ? "Send message" : "Type a message first")}
      >
        Send
      </button>
    </form>
  );
});

// Memoize the MessageGroupComponent
const MessageGroupComponent = memo(({ group, userId }: { group: MessageGroup; userId: string | null }) => {
  const isOwnMessage = group.userId === userId;

  const formatMessageTime = useCallback((timestamp?: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  // Function to check if message contains only emojis and spaces
  const isOnlyEmojis = useCallback((text: string) => {
    // Remove all spaces
    const noSpaces = text.replace(/\s/g, '');
    // Match emoji pattern (including ZWJ sequences and variation selectors)
    const emojiPattern = /^(?:[\u{1F300}-\u{1F9FF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|\u200D|\uFE0F)+$/u;
    // Count emojis
    const emojiCount = Array.from(noSpaces.matchAll(/\p{Extended_Pictographic}/gu)).length;

    return emojiPattern.test(noSpaces) && emojiCount < 7;
  }, []);

  return (
    <div className={`mb-6 flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%] flex flex-col gap-1`}>
        <div className={`flex items-center gap-2 mb-2 ${isOwnMessage ? 'justify-end' : ''}`}>
          <AuthorBubble author={group.author} emoji={group.authorEmoji} />
        </div>
        <div className="flex flex-col gap-1">
          {group.messages.map((msg, i) => {
            const onlyEmojis = isOnlyEmojis(msg.message);
            return (
              <div key={i} className="group relative">
                <div className={[
                  'shadow-lg rounded-sm',
                  onlyEmojis ? 'px-2.5 py-1.5' : 'p-3.5', // Reduced padding for emoji-only messages
                  isOwnMessage
                    ? 'bg-orange-600 text-white'
                    : 'bg-neutral-800 text-neutral-100',
                  i === 0 && isOwnMessage ? 'rounded-tr-2xl rounded-tl-2xl rounded-b-sm' : '',
                  i === 0 && !isOwnMessage ? 'rounded-tr-2xl rounded-tl-2xl rounded-b-sm' : '',
                  i === group.messages.length - 1 && isOwnMessage ? 'rounded-br-2xl rounded-bl-2xl rounded-t-sm' : '',
                  i === group.messages.length - 1 && !isOwnMessage ? 'rounded-br-2xl rounded-bl-2xl rounded-t-sm' : '',
                  i !== 0 && i !== group.messages.length - 1 ? 'rounded-sm' : ''
                ].join(' ')}>
                  <div className={`whitespace-pre-wrap break-words leading-normal ${onlyEmojis ? 'text-3xl' : 'text-base'
                    }`}>
                    {msg.message}
                  </div>
                </div>
                {msg.timestamp && (
                  <div className={[
                    'absolute top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400/75 text-nowrap',
                    'opacity-0 group-hover:opacity-100 transition-all duration-300',
                    isOwnMessage ? 'right-full mr-3' : 'left-full ml-3'
                  ].join(' ')}>
                    {formatMessageTime(msg.timestamp)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

// Update TypingIndicator to filter out current user
const TypingIndicator = memo(({ typingUsers, currentUserId }: {
  typingUsers: TypingState[],
  currentUserId: string | null
}) => {
  // Filter out current user from typing indicators
  const otherTypingUsers = typingUsers.filter(user => user.userId !== currentUserId);

  if (otherTypingUsers.length === 0) return null;

  return (
    <div className="text-sm text-neutral-400 animate-pulse flex items-center gap-2 mb-2">
      <div className="flex -space-x-2">
        {otherTypingUsers.map((user) => (
          <div key={user.userId} className="w-6 h-6 rounded-full bg-neutral-700/75 flex items-center justify-center">
            {user.authorEmoji || user.author.charAt(0)}
          </div>
        ))}
      </div>
      <span>
        {otherTypingUsers.length === 1
          ? `${otherTypingUsers[0].author} is typing...`
          : `${otherTypingUsers.length} people are typing...`}
      </span>
    </div>
  );
});

// Add new attribution component
const Attribution = memo(() => {
  return (
    <div className="hidden lg:block absolute top-4 right-4 text-neutral-500/75 text-sm">
      <a
        href="https://riskymh.dev"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-neutral-400/75 transition-colors"
      >
        by RiskyMH
      </a>
      {" • "}
      <a
        href="https://github.com/RiskyMH/chatroom"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-neutral-400/75 transition-colors"
      >
        GitHub
      </a>
    </div>
  );
});

// Add ConnectionStatus component
const ConnectionStatus = memo(() => {
  return (
    <div className="text-center my-4">
      <span className="text-sm text-gray-500 dark:text-gray-400/75 bg-slate-100/50 dark:bg-gray-800/50 px-4 py-2 rounded-full backdrop-blur-sm border border-slate-200/25 dark:border-gray-700/25 shadow-lg flex items-center justify-center gap-2 inline-flex">
        <div className="w-5 h-5 rounded-full bg-slate-200/75 dark:bg-gray-700/75 flex items-center justify-center">
          <div className="w-3 h-3 border-2 border-neutral-400/75 border-t-transparent rounded-full animate-spin" />
        </div>
        Connecting to server...
      </span>
    </div>
  );
});

// Main App component
export function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingState[]>([]);
  const { ws, userId } = useWebSocket();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrolledUpRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    const isNearBottom = true;
    if (isNearBottom || !scrolledUpRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, []);

  const sendMessage = useCallback((message: string) => {
    if (!ws) return;
    if (ws.readyState !== WebSocket.OPEN) throw new Error("WebSocket is not open");
    ws.send(JSON.stringify({
      type: 'message',
      message
    }));
  }, [ws]);

  const groupMessages = useCallback((messages: ChatMessage[]): (MessageGroup | ChatMessage)[] => {
    const groups: (MessageGroup | ChatMessage)[] = [];
    let currentGroup: MessageGroup | null = null;

    messages.forEach((msg) => {
      // Don't group system messages (connect/disconnect)
      if (msg.type !== 'message') {
        if (currentGroup) {
          groups.push(currentGroup);
          currentGroup = null;
        }
        groups.push(msg);
        return;
      }

      const msgTime = msg.timestamp ? new Date(msg.timestamp) : new Date();
      const prevMsg = currentGroup?.messages[currentGroup.messages.length - 1];
      const prevTime = prevMsg?.timestamp ? new Date(prevMsg.timestamp) : new Date();

      const sameMinute = Math.abs(msgTime.getTime() - prevTime.getTime()) < 60000;

      if (currentGroup &&
        currentGroup.userId === msg.userId &&
        sameMinute) {
        // Add to current group
        currentGroup.messages.push({
          message: msg.message,
          timestamp: msg.timestamp
        });
      } else {
        // Start new group
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentGroup = {
          author: msg.author,
          authorEmoji: msg.authorEmoji,
          userId: msg.userId,
          messages: [{
            message: msg.message,
            timestamp: msg.timestamp
          }]
        };
      }
    });

    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  }, []);

  const groupedMessages = useMemo(() => groupMessages(messages), [messages, groupMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Clean up stale typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      setTypingUsers(users => users.filter(user =>
        Date.now() - user.timestamp < 7000 // Keep typing indicators for 7 seconds
      ));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleTyping = useCallback((isTyping: boolean) => {
    if (!ws || !userId) return;
    // if (ws.readyState !== WebSocket.OPEN) throw new Error("WebSocket is not open");
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      type: 'typing',
      isTyping
    }));
  }, [ws, userId]);

  useEffect(() => {
    if (!ws) return;

    const messageHandler = (event: MessageEvent) => {
      if (event.data === 'pong') {
        return;
      }
      const data = JSON.parse(event.data);
      if (data.type === 'typing') {
        setTypingUsers(prev => {
          const filtered = prev.filter(u => u.userId !== data.userId);
          if (data.isTyping) {
            return [...filtered, {
              userId: data.userId,
              author: data.author,
              authorEmoji: data.authorEmoji,
              timestamp: Date.now()
            }];
          }
          return filtered;
        });
      } else {
        setMessages(prev => [...prev, data]);
      }
    };

    ws.addEventListener('message', messageHandler);
    return () => ws.removeEventListener('message', messageHandler);
  }, [ws]);

  // Add scroll handler to detect when user scrolls up
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      scrolledUpRef.current = !isNearBottom;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="relative min-h-[100dvh] bg-neutral-900">
      <Attribution />
      <div className="container mx-auto p-4 max-w-4xl h-[100dvh] flex flex-col">
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto mb-4 rounded-2xl bg-neutral-800/50 backdrop-blur-sm p-6 shadow-xl border border-neutral-700/50"
        >
          {(ws?.readyState !== WebSocket.OPEN && groupedMessages.length === 0) ? (
            <ConnectionStatus />
          ) : (
            <>
              {groupedMessages.map((item, i) => (
                ('type' in item && ['connect', 'disconnect'].includes(item.type)) ? (
                  <SystemMessage key={i} message={item} currentUserId={userId} />
                ) : 'type' in item ? (
                  <span className="text-red-500/75 block">Unknown message type: {item.type}</span>
                ) : (
                  <MessageGroupComponent key={i} group={item} userId={userId} />
                )
              ))}
              <TypingIndicator typingUsers={typingUsers} currentUserId={userId} />
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
        <MessageInput
          onSend={sendMessage}
          onTyping={handleTyping}
          disabled={!ws}
        />
      </div>
    </div>
  );
}

export default memo(App);