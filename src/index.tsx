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

const server = serve<{
  id: string;
  name: string;
  authorEmoji: string;
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
      // Broadcast the message to all connected clients
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
      // Subscribe the client to the chat channel
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
    close(ws, code, message) {
      // Unsubscribe the client from the chat channel
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