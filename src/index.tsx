import { serve } from "bun";
import index from "./index.html";


const server = serve({
  routes: {
    "/": index,
    "/ws": {
      GET: (req, server) => {
        const randomName = randomNameGenerator();
        const data = { id: crypto.randomUUID(), name: randomName.name, authorEmoji: randomName.emoji }

        // upgrade the request to a WebSocket
        if (server.upgrade(req, { data })) return
        return new Response("Upgrade failed", { status: 500 });
      },
    },
  },

  development: process.env.NODE_ENV !== "production",

  fetch(req, server) {
    return new Response("Not found", { status: 404 });
  },

  websocket: {
    message(ws: Bun.ServerWebSocket<{
      id: string;
      name: string;
      authorEmoji: string;
      isTyping?: boolean;
    }>, message) {
      if (message.toString() === 'ping') {
        ws.send('pong');
        return;
      }

      try {
        const data = JSON.parse(message.toString());

        if (data.type === 'typing') {
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

        else if (data.type === 'message') {
          server.publish("chat", JSON.stringify({
            userId: ws.data.id,
            author: ws.data.name,
            authorEmoji: ws.data.authorEmoji,
            message: data.message,
            type: "message",
            timestamp: new Date().toISOString(),
          }));
          return;
        }
      } catch (e) { }

      ws.send(JSON.stringify({
        message: "Invalid message",
        type: "error",
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
        currentUsers: server.subscriberCount("chat"),
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
        currentUsers: server.subscriberCount("chat"),
      }));
      ws.unsubscribe("chat");
    },

    drain(ws) { },

    maxPayloadLength: 1024 * 1024 * 0.5, // 512kb
    publishToSelf: true,
  },

});

console.log(`🚀 Server running at ${server.url}`);


const wordEmojis = {
  "Apple": "🍎",
  "Banana": "🍌",
  "Cherry": "🍒",
  "Dog": "🐶",
  "Elephant": "🐘",
  "Frog": "🐸",
  "Guitar": "🎸",
  "House": "🏠",
  "Igloo": "🧊",
  "Jungle": "🌴",
  "Kangaroo": "🦘",
  "Lemon": "🍋",
  "Mango": "🥭",
  "Noodle": "🍜",
  "Octopus": "🐙",
  "Penguin": "🐧",
  "Quilt": "🏘️",
  "Rabbit": "🐰",
  "Snake": "🐍",
  "Tiger": "🐯",
  "Umbrella": "🌂",
  "Violin": "🎻",
  "Watermelon": "🍉",
  "Xylophone": "🎹",
  "Yacht": "🛥️",
  "Zebra": "🦄",
  "Bear": "🐻",
  "Cat": "🐱",
  "Dolphin": "🐬",
  "Eagle": "🦅",
  "Fish": "🐟",
  "Giraffe": "🦒",
  "Hippo": "🦛",
  "Ice cream": "🍦",
  "Jellyfish": "🪼",
  "Koala": "🐨",
  "Lion": "🦁",
  "Monkey": "🐒",
  "Narwhal": "🐋",
  "Owl": "🦉",
  "Panda": "🐼",
  "Bee": "🐝",
  "Raccoon": "🦝",
  "Shark": "🦈",
  "Turtle": "🐢",
  "Unicorn": "🦄",
  "Vulture": "🦅",
  "Whale": "🐋",
  "Fox": "🦊",
  "Cow": "🐮",
  // "Zucchini": "🥒"
};

const descriptors = [
  "Awesome",
  "Cool",
  "Great",
  "Amazing",
  "Fantastic",
  "Wonderful",
  "Super",
  "Fabulous",
  "Brilliant",
  "Clever",
  "Dazzling",
  "Elegant",
  "Fearless",
  "Graceful",
  "Heroic",
  "Incredible",
  "Jolly",
  "Kind",
  "Lovely",
  "Magical",
  "Noble",
  "Outstanding",
  "Perfect",
  "Quick",
  "Radiant",
  "Splendid",
  "Terrific",
  "Unique",
  "Vibrant"
];

const words = Object.keys(wordEmojis);

const randomNameGenerator = () => {
  const randomWord = words[Math.floor(Math.random() * words.length)];

  return {
    name: `${descriptors[Math.floor(Math.random() * descriptors.length)]} ${randomWord}`,
    emoji: wordEmojis[randomWord as keyof typeof wordEmojis],
  };
}
