import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import { getReceiverSocketId, io, refreshContactsPresence } from "../lib/socket.js";

export const addContact = async (req, res) => {
  try {
    const { email } = req.body;
    const userId = req.user._id;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const targetUser = await User.findOne({ email }).select("-password");

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (targetUser._id.toString() === userId.toString()) {
      return res.status(400).json({ message: "You cannot add yourself" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { contacts: targetUser._id } },
      { new: true }
    ).select("contacts");

    if (!updatedUser) {
      return res.status(404).json({ message: "Current user not found" });
    }

    const unreadCount = await Message.countDocuments({
      senderId: targetUser._id,
      receiverId: userId,
      readAt: null,
    });

    await refreshContactsPresence(userId);

    res.status(200).json({
      contact: {
        ...targetUser.toObject(),
        unreadCount,
      },
    });
  } catch (error) {
    console.log("Error in addContact controller", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const removeContact = async (req, res) => {
  try {
    const { id: contactId } = req.params;
    const userId = req.user._id;

    const contactExists = await User.findById(contactId).select("_id");
    if (!contactExists) {
      return res.status(404).json({ message: "Contact not found" });
    }

    await User.findByIdAndUpdate(userId, { $pull: { contacts: contactId } });

    await Message.deleteMany({ senderId: userId, receiverId: contactId });

    await refreshContactsPresence(userId);

    const payload = { fromUserId: userId.toString(), targetUserId: contactId.toString() };

    const contactSocketId = getReceiverSocketId(contactId.toString());
    if (contactSocketId) {
      io.to(contactSocketId).emit("conversationPurged", payload);
    }

    const initiatorSocketId = getReceiverSocketId(userId.toString());
    if (initiatorSocketId) {
      io.to(initiatorSocketId).emit("conversationPurged", payload);
    }

    res.status(200).json({ message: "Contact removed" });
  } catch (error) {
    console.log("Error in removeContact controller", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
