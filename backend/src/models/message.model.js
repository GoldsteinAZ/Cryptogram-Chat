import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
    },
    ciphertext: {
      type: String,
    },
    nonce: {
      type: String,
    },
    encryptionVersion: {
      type: Number,
      default: 1,
    },
    readAt: {
      type: Date,
      default: null,
    },
    imageCiphertext: {
      type: String,
    },
    imageNonce: {
      type: String,
    },
    image: {
      type: String,
    },
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
