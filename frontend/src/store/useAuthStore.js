import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import {
  generateKeyPair,
  getNormalizedKeyPair,
  storeKeyPair,
  exportKeyBackupString,
  importKeyBackupString,
} from "../lib/encryption";

const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:5001" : "/";

const createAndPersistKeyPair = () => {
  const pair = generateKeyPair();
  storeKeyPair(pair);
  return pair;
};

export const useAuthStore = create((set, get) => {
  const syncDeviceKeys = async (serverPublicKey) => {
    try {
      let storedPair = getNormalizedKeyPair();

      if (!storedPair) {
        storedPair = createAndPersistKeyPair();
        await axiosInstance.put("/auth/public-key", { publicKey: storedPair.publicKey });
        toast.success("Generated a new encryption key pair for this device");
        return storedPair;
      }

      if (!serverPublicKey) {
        await axiosInstance.put("/auth/public-key", { publicKey: storedPair.publicKey });
        return storedPair;
      }

      if (serverPublicKey !== storedPair.publicKey) {
        await axiosInstance.put("/auth/public-key", { publicKey: storedPair.publicKey });
        toast("Encryption keys resynced for this device", { icon: "🔐" });
      }

      return storedPair;
    } catch (error) {
      console.error("Failed to synchronize encryption keys", error);
      toast.error("Failed to sync encryption keys. Messages may not decrypt correctly.");
      return null;
    }
  };

  return {
    authUser: null,
    isSigningUp: false,
    isLoggingIn: false,
    isUpdatingProfile: false,
    isCheckingAuth: true,
    onlineUsers: [],
    socket: null,

    checkAuth: async () => {
      try {
        const res = await axiosInstance.get("/auth/check");

        await syncDeviceKeys(res.data.encryptionPublicKey);
        set({ authUser: res.data });
        get().connectSocket();
      } catch (error) {
        console.log("Error in checkAuth:", error);
        set({ authUser: null });
      } finally {
        set({ isCheckingAuth: false });
      }
    },

    signup: async (data) => {
      set({ isSigningUp: true });
      try {
        const keyPair = createAndPersistKeyPair();
        const res = await axiosInstance.post("/auth/signup", {
          ...data,
          publicKey: keyPair.publicKey,
        });
        set({ authUser: res.data });
        toast.success("Account created successfully");
        get().connectSocket();
      } catch (error) {
        toast.error(error.response?.data?.message || "Failed to sign up");
      } finally {
        set({ isSigningUp: false });
      }
    },

    login: async (data) => {
      set({ isLoggingIn: true });
      try {
        const res = await axiosInstance.post("/auth/login", data);
        await syncDeviceKeys(res.data.encryptionPublicKey);
        set({ authUser: res.data });
        toast.success("Logged in successfully");

        get().connectSocket();
      } catch (error) {
        toast.error(error.response?.data?.message || "Failed to login");
      } finally {
        set({ isLoggingIn: false });
      }
    },

    logout: async () => {
      try {
        await axiosInstance.post("/auth/logout");
        set({ authUser: null });
        toast.success("Logged out successfully");
        get().disconnectSocket();
      } catch (error) {
        toast.error(error.response?.data?.message || "Failed to logout");
      }
    },

    updateProfile: async (data) => {
      set({ isUpdatingProfile: true });
      try {
        const res = await axiosInstance.put("/auth/update-profile", data);
        set({ authUser: res.data });
        toast.success("Profile updated successfully");
      } catch (error) {
        console.log("error in update profile:", error);
        toast.error(error.response?.data?.message || "Failed to update profile");
      } finally {
        set({ isUpdatingProfile: false });
      }
    },

    updatePresencePreference: async (sharePresence) => {
      try {
        const res = await axiosInstance.put("/auth/preferences", { sharePresence });
        set({ authUser: res.data });
        toast.success(
          sharePresence
            ? "Other users can see your status again"
            : "You have hidden your online status"
        );
        const socket = get().socket;
        if (socket?.connected) {
          socket.emit("presencePreferenceUpdated");
        }
      } catch (error) {
        console.error("Failed to update presence preference", error);
        toast.error(error.response?.data?.message || "Failed to save setting");
        throw error;
      }
    },

    connectSocket: () => {
      const { authUser } = get();
      if (!authUser || get().socket?.connected) return;

      const socket = io(BASE_URL, {
        query: {
          userId: authUser._id,
        },
      });
      socket.connect();

      set({ socket: socket });

      socket.on("getOnlineUsers", (userIds) => {
        set({ onlineUsers: userIds });
      });
    },
    disconnectSocket: () => {
      if (get().socket?.connected) get().socket.disconnect();
    },

    exportEncryptionKey: () => {
      const backup = exportKeyBackupString();
      if (!backup) {
        throw new Error("No private key on this device");
      }
      return backup;
    },

    importEncryptionKey: async (backupString) => {
      try {
        const keyPair = importKeyBackupString(backupString);
        await axiosInstance.put("/auth/public-key", { publicKey: keyPair.publicKey });
        toast.success("Encryption key restored");
        return keyPair;
      } catch (error) {
        console.error("Failed to import encryption key", error);
        throw error;
      }
    },

    deleteAccount: async () => {
      try {
        await axiosInstance.delete("/auth/delete");
        set({ authUser: null });
        toast.success("Account has been deleted");
        get().disconnectSocket();
      } catch (error) {
        toast.error(error.response?.data?.message || "Failed to delete account");
        throw error;
      }
    },
  };
});
