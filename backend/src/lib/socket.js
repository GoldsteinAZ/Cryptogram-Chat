import { Server } from "socket.io";
import http from "http";
import express from "express";
import User from "../models/user.model.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"],
  },
});

const userSocketMap = {}; // {userId: socketId}
const sharePresenceSet = new Set();
const userContactsMap = {}; // {userId: [contactIds]}

async function loadContacts(userId) {
  try {
    const user = await User.findById(userId).select("contacts");
    userContactsMap[userId] = user?.contacts?.map((contactId) => contactId.toString()) || [];
  } catch (error) {
    console.error("Failed to load contacts", error.message);
    userContactsMap[userId] = [];
  }
}

async function emitPresenceForUser(userId) {
  const socketId = userSocketMap[userId];
  if (!socketId) return;

  if (!userContactsMap[userId]) {
    await loadContacts(userId);
  }

  const contacts = userContactsMap[userId] || [];
  const visible = contacts.filter((contactId) => sharePresenceSet.has(contactId));
  io.to(socketId).emit("getOnlineUsers", visible);
}

async function broadcastPresence() {
  const userIds = Object.keys(userSocketMap);
  await Promise.all(userIds.map((id) => emitPresenceForUser(id)));
}

async function syncPresenceFlag(userId) {
  if (!userId) return;
  try {
    const user = await User.findById(userId).select("sharePresence");
    if (user?.sharePresence) {
      sharePresenceSet.add(userId);
    } else {
      sharePresenceSet.delete(userId);
    }
  } catch (error) {
    console.error("Failed to sync presence flag", error.message);
  }
}

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

export async function refreshContactsPresence(userId) {
  await loadContacts(userId);
  await emitPresenceForUser(userId);
}

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId) {
    userSocketMap[userId] = socket.id;
    loadContacts(userId).then(() => emitPresenceForUser(userId));
    syncPresenceFlag(userId).then(() => {
      broadcastPresence();
    });
  }

  socket.on("presencePreferenceUpdated", async () => {
    if (!userId) return;
    await syncPresenceFlag(userId);
    broadcastPresence();
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);
    if (userId) {
      delete userSocketMap[userId];
      delete userContactsMap[userId];
      sharePresenceSet.delete(userId);
      broadcastPresence();
    }
  });
});

export { io, app, server };
