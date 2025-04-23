import { serve } from "bun";
import index from "./index.html";

const randomNameGenerator = () => {
  const words = ["Apple", "Banana", "Cherry", "Dog", "Elephant", "Frog", "Guitar", "House", "Igloo", "Jungle", "Kangaroo", "Lemon", "Mango", "Noodle", "Octopus", "Penguin", "Quilt", "Rabbit", "Snake", "Tiger", "Umbrella", "Violin", "Watermelon", "Xylophone", "Yacht", "Zebra"];
  const emojis = ["🍎", "🍌", "🍒", "🐶", "🐘", "🐸", "🎸", "🏠", "🏠", "🌴", "🐘", "🍋", "🥭", "🍜", "🐙", "🐧", "🏘️", "🐰", "🐍", "🐯", "🌂", "🎻", "🍉", "🎹", "🛥️", "🦄"];
  const descripitor = ["Awesome", "Cool", "Great", "Amazing", "Fantastic", "Wonderful", "Super", "Cool", "Great", "Amazing", "Fantastic", "Wonderful", "Super", "Cool", "Great", "Amazing", "Fantastic", "Wonderful", "Super", "Cool", "Great", "Amazing", "Fantastic", "Wonderful", "Super"];
  const randomIndex = Math.floor(Math.random() * words.length);
  return {
    name: `${descripitor[Math.floor(Math.random() * descripitor.length)]} ${words[randomIndex]}`,
    authorEmoji: emojis[randomIndex],
  };
}

interface ChatMessage {
  userId: string;
  author: string;
  authorEmoji: string;
  message: string;
  type: "message" | "connect" | "disconnect" | "typing";
  timestamp: string;
  isTyping?: boolean;
}

const server = serve<{
  id: string;
  name: string;
  authorEmoji: string;
  isTyping?: boolean;
}, any>({
  routes: {
    // Serve index.html for all unmatched routes.
    "/": index,
  },

  development: process.env.NODE_ENV !== "production",

  fetch(req, server) {
    const u = new URL(req.url);
    if (u.pathname === "/ws") {
      // upgrade the request to a WebSocket
      if (server.upgrade(req, { data: { id: crypto.randomUUID(), ...randomNameGenerator() } })) {
        return; // do not return a Response
      }
      return new Response("Upgrade failed", { status: 500 });
    }
    return new Response("Not found", { status: 404 });
  },

  websocket: {
    message(ws, message) {
      try {
        // Check if message is a typing indicator
        const data = JSON.parse(message.toString());
        if (data.type === 'typing') {
          ws.data.isTyping = data.isTyping;
          server.publish("chat", JSON.stringify({
            userId: ws.data.id,
            author: ws.data.name,
            authorEmoji: ws.data.authorEmoji,
            type: "typing",
            isTyping: data.isTyping,
            timestamp: new Date().toISOString(),
          }));
          return;
        }
      } catch (e) {
        // If not JSON, treat as regular message
      }

      // Regular message handling
      server.publish("chat", JSON.stringify({
        userId: ws.data.id,
        author: ws.data.name,
        authorEmoji: ws.data.authorEmoji,
        message,
        type: "message",
        timestamp: new Date().toISOString(),
      }));
    },

    open(ws) {
      ws.subscribe("chat");

      server.publish("chat", JSON.stringify({
        userId: ws.data.id,
        author: ws.data.name,
        authorEmoji: ws.data.authorEmoji,
        message: `Client ${ws.data.id} connected`,
        type: "connect",
        timestamp: new Date().toISOString(),
      }));
    },

    close(ws) {
      server.publish("chat", JSON.stringify({
        userId: ws.data.id,
        author: ws.data.name,
        authorEmoji: ws.data.authorEmoji,
        message: `Client ${ws.data.id} disconnected`,
        type: "disconnect",
        timestamp: new Date().toISOString(),
      }));
      ws.unsubscribe("chat");
    },

    drain(ws) { },
    publishToSelf: true,
  },

});

console.log(`🚀 Server running at ${server.url}`);


// setInterval(() => {
//   server.publish("chat", JSON.stringify({
//     message: `${Math.floor(Math.random() * 100)}% of the time it works every time.`,
//     type: "message",
//     author: "Server",
//     authorEmoji: "👻",
//     timestamp: new Date().toISOString(),
//   }));
// }, 100);