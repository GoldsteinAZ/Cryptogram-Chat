import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { decryptText, encryptText, getNormalizedKeyPair } from "../lib/encryption";
import { useAuthStore } from "./useAuthStore";

const getDeviceSecretKey = () => {
  const storedPair = getNormalizedKeyPair();
  return storedPair?.secretKey || null;
};

const decryptMessageForConversation = (message, otherUserPublicKey, secretKey) => {
  const formattedMessage = { ...message };

  const canDecrypt = Boolean(otherUserPublicKey && secretKey);

  if (message?.ciphertext && message?.nonce) {
    if (!otherUserPublicKey) {
      formattedMessage.text = "Encrypted message (recipient key unavailable)";
      formattedMessage.isDecryptionFailed = true;
    } else if (!secretKey) {
      formattedMessage.text = "Encrypted message (device key missing)";
      formattedMessage.isDecryptionFailed = true;
    } else {
      const decrypted = decryptText(message.ciphertext, message.nonce, otherUserPublicKey, secretKey);
      if (!decrypted) {
        formattedMessage.text = "Unable to decrypt this message";
        formattedMessage.isDecryptionFailed = true;
      } else {
        formattedMessage.text = decrypted;
        formattedMessage.isDecryptionFailed = false;
      }
    }
  }

  if (message?.imageCiphertext && message?.imageNonce) {
    if (!canDecrypt) {
      formattedMessage.image = null;
      formattedMessage.imageDecryptionFailed = true;
    } else {
      const decryptedImage = decryptText(
        message.imageCiphertext,
        message.imageNonce,
        otherUserPublicKey,
        secretKey
      );

      if (!decryptedImage) {
        formattedMessage.image = null;
        formattedMessage.imageDecryptionFailed = true;
      } else {
        formattedMessage.image = decryptedImage;
        formattedMessage.imageDecryptionFailed = false;
      }
    }
  } else if (message?.image && !formattedMessage.image) {
    formattedMessage.image = message.image;
    formattedMessage.imageDecryptionFailed = false;
  }

  return formattedMessage;
};

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load users");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    if (!userId) return;
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      const { selectedUser } = get();
      if (!selectedUser || selectedUser._id !== userId) return;

      const secretKey = getDeviceSecretKey();
      const decryptedMessages = res.data.map((message) =>
        decryptMessageForConversation(message, selectedUser.encryptionPublicKey, secretKey)
      );

      set({ messages: decryptedMessages });
      get().resetUnreadCount(userId);
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error("First, add this user to your contacts");
        set({ selectedUser: null, messages: [] });
      } else {
        toast.error(error.response?.data?.message || "Failed to load messages");
      }
    } finally {
      set({ isMessagesLoading: false });
    }
  },
  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    if (!selectedUser) return;

    const secretKey = getDeviceSecretKey();
    const requiresEncryption = Boolean(messageData.text || messageData.image);

    if (requiresEncryption && !secretKey) {
      toast.error("Missing local encryption key. Please log in again.");
      return;
    }

    if (requiresEncryption && !selectedUser.encryptionPublicKey) {
      toast.error("Selected user has no encryption key yet");
      return;
    }

    const payload = {};
    if (messageData.text && secretKey) {
      try {
        const encrypted = encryptText(messageData.text, selectedUser.encryptionPublicKey, secretKey);
        if (!encrypted) {
          toast.error("Failed to encrypt message");
          return;
        }
        payload.ciphertext = encrypted.ciphertext;
        payload.nonce = encrypted.nonce;
      } catch (error) {
        console.error("Failed to encrypt chat message", error);
        toast.error("Failed to encrypt message");
        return;
      }
    }

    if (messageData.image && secretKey) {
      try {
        const encryptedImage = encryptText(
          messageData.image,
          selectedUser.encryptionPublicKey,
          secretKey
        );
        if (!encryptedImage) {
          toast.error("Failed to encrypt attachment");
          return;
        }
        payload.imageCiphertext = encryptedImage.ciphertext;
        payload.imageNonce = encryptedImage.nonce;
      } catch (error) {
        console.error("Failed to encrypt attachment", error);
        toast.error("Failed to encrypt attachment");
        return;
      }
    }

    if (!payload.ciphertext && !payload.imageCiphertext) {
      toast.error("Nothing to send");
      return;
    }

    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, payload);
      const formattedMessage = decryptMessageForConversation(
        res.data,
        selectedUser.encryptionPublicKey,
        secretKey
      );
      set({ messages: [...messages, formattedMessage] });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send message");
      if (error.response?.status === 403) {
        set({ selectedUser: null });
      }
    }
  },

  deleteMessage: async (messageId) => {
    if (!messageId) return;
    const { messages } = get();
    try {
      await axiosInstance.delete(`/messages/message/${messageId}`);
      set({ messages: messages.filter((message) => message._id !== messageId) });
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to delete message");
    }
  },

  resetUnreadCount: (userId) => {
    if (!userId) return;
    set((state) => ({
      users: state.users.map((user) =>
        user._id === userId ? { ...user, unreadCount: 0 } : user
      ),
    }));
  },

  handleIncomingMessage: (newMessage) => {
    const currentUserId = useAuthStore.getState().authUser?._id;
    if (!currentUserId || newMessage.receiverId !== currentUserId) return;

    const { selectedUser } = get();
    const secretKey = getDeviceSecretKey();

    if (selectedUser && newMessage.senderId === selectedUser._id) {
      const formattedMessage = decryptMessageForConversation(
        newMessage,
        selectedUser.encryptionPublicKey,
        secretKey
      );
      set({ messages: [...get().messages, formattedMessage] });
      get().resetUnreadCount(selectedUser._id);
      return;
    }

    const users = get().users;
    const senderExists = users.some((user) => user._id === newMessage.senderId);
    if (!senderExists) {
      get().getUsers();
      return;
    }

    set((state) => ({
      users: state.users.map((user) =>
        user._id === newMessage.senderId
          ? { ...user, unreadCount: (user.unreadCount || 0) + 1 }
          : user
      ),
    }));
  },

  handleMessageDeleted: ({ messageId }) => {
    if (!messageId) return;
    set((state) => ({ messages: state.messages.filter((message) => message._id !== messageId) }));
  },

  handleConversationPurged: ({ fromUserId, targetUserId }) => {
    const authUserId = useAuthStore.getState().authUser?._id;
    if (!authUserId) return;

    if (authUserId === fromUserId) {
      set((state) => ({
        users: state.users.filter((user) => user._id !== targetUserId),
        messages: state.selectedUser?._id === targetUserId ? [] : state.messages,
        selectedUser: state.selectedUser?._id === targetUserId ? null : state.selectedUser,
      }));
    } else if (authUserId === targetUserId) {
      set((state) => {
        const isActiveConversation = state.selectedUser?._id === fromUserId;
        return {
          messages: isActiveConversation
            ? state.messages.filter((message) => message.senderId !== fromUserId)
            : state.messages,
          users: state.users.map((user) =>
            user._id === fromUserId ? { ...user, unreadCount: 0 } : user
          ),
        };
      });
    }
  },

  addContact: async (email) => {
    try {
      const res = await axiosInstance.post("/contacts", { email });
      const newContact = res.data.contact;
      set((state) => ({ users: [...state.users, newContact] }));
      toast.success(`${newContact.fullName} added to contacts`);
      return newContact;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add contact");
      throw error;
    }
  },

  removeContact: async (userId) => {
    try {
      await axiosInstance.delete(`/contacts/${userId}`);
      set((state) => ({
        users: state.users.filter((user) => user._id !== userId),
        messages: state.selectedUser?._id === userId ? [] : state.messages,
        selectedUser: state.selectedUser?._id === userId ? null : state.selectedUser,
      }));
      toast.success("Contact removed");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove contact");
      throw error;
    }
  },

  setSelectedUser: (selectedUser) => {
    if (!selectedUser) {
      set({ selectedUser: null, messages: [] });
      return;
    }
    get().resetUnreadCount(selectedUser._id);
    set({ selectedUser });
  },
}));
