export interface ChatMessage {
  message: string;
  userId: string;
  author: string;
  authorEmoji?: string;
  timestamp?: string;
  type: "message" | "connect" | "disconnect";
}

export interface MessageGroup {
  author: string;
  authorEmoji?: string;
  userId: string;
  messages: {
    message: string;
    timestamp?: string;
  }[];
} 