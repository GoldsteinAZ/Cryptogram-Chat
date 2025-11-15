import User from "../models/user.model.js";
import Message from "../models/message.model.js";

import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io, refreshContactsPresence } from "../lib/socket.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const userRecord = await User.findById(loggedInUserId).select("contacts").lean();
    const contactIds = userRecord?.contacts || [];

    if (!contactIds.length) {
      return res.status(200).json([]);
    }

    const contacts = await User.find({ _id: { $in: contactIds } })
      .select("-password")
      .lean();

    const usersWithCounts = await Promise.all(
      contacts.map(async (user) => {
        const unreadCount = await Message.countDocuments({
          senderId: user._id,
          receiverId: loggedInUserId,
          readAt: null,
        });
        return { ...user, unreadCount };
      })
    );

    res.status(200).json(usersWithCounts);
  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const isContact = req.user.contacts?.some(
      (contactId) => contactId.toString() === userToChatId
    );

    if (!isContact) {
      return res.status(403).json({ error: "Add this user to your contacts before chatting" });
    }

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    }).sort({ createdAt: 1 });

    await Message.updateMany(
      { senderId: userToChatId, receiverId: myId, readAt: null },
      { $set: { readAt: new Date() } }
    );

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { ciphertext, nonce, image, imageCiphertext, imageNonce } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    const isContact = req.user.contacts?.some(
      (contactId) => contactId.toString() === receiverId
    );

    if (!isContact) {
      return res.status(403).json({ error: "Add this user to your contacts before messaging" });
    }

    if (!ciphertext && !image && !imageCiphertext) {
      return res.status(400).json({ error: "Message must include content" });
    }

    if (ciphertext && !nonce) {
      return res.status(400).json({ error: "Encrypted messages require a nonce" });
    }

    if (imageCiphertext && !imageNonce) {
      return res.status(400).json({ error: "Encrypted images require a nonce" });
    }

    let imageUrl;
    if (image) {
      // Upload base64 image to cloudinary
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      ciphertext,
      nonce,
      imageCiphertext,
      imageNonce,
      image: imageUrl,
    });

    await newMessage.save();

    const contactUpdate = await User.findByIdAndUpdate(receiverId, {
      $addToSet: { contacts: senderId },
    });
    if (contactUpdate) {
      refreshContactsPresence(receiverId);
    }

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (message.senderId.toString() !== userId.toString()) {
      return res.status(403).json({ error: "You can only delete your own messages" });
    }

    await Message.deleteOne({ _id: messageId });

    const payload = { messageId };

    const receiverSocketId = getReceiverSocketId(message.receiverId.toString());
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageDeleted", payload);
    }

    const senderSocketId = getReceiverSocketId(userId.toString());
    if (senderSocketId) {
      io.to(senderSocketId).emit("messageDeleted", payload);
    }

    res.status(200).json(payload);
  } catch (error) {
    console.log("Error in deleteMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
