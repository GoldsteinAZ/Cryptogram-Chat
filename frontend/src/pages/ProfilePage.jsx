import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { Camera, Mail, User, Copy, Download, Upload, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

const ProfilePage = () => {
  const {
    authUser,
    isUpdatingProfile,
    updateProfile,
    exportEncryptionKey,
    importEncryptionKey,
    deleteAccount,
    updatePresencePreference,
  } = useAuthStore();
  const [selectedImg, setSelectedImg] = useState(null);
  const [backupValue, setBackupValue] = useState("");
  const [importValue, setImportValue] = useState("");
  const [isImportingKey, setIsImportingKey] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isPresenceUpdating, setIsPresenceUpdating] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.readAsDataURL(file);

    reader.onload = async () => {
      const base64Image = reader.result;
      setSelectedImg(base64Image);
      await updateProfile({ profilePic: base64Image });
    };
  };

  const handleGenerateBackup = () => {
    try {
      const backup = exportEncryptionKey();
      setBackupValue(backup);
      toast.success("Save this string in a safe place");
    } catch (error) {
      toast.error(error.message || "No key to export");
    }
  };

  const handleCopyBackup = async () => {
    if (!backupValue) {
      toast.error("First, generate a backup");
      return;
    }
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(backupValue);
      toast.success("Copied to clipboard");
    } catch (error) {
      console.error("Clipboard copy failed", error);
      toast.error("Failed to copy backup");
    }
  };

  const handleDownloadBackup = () => {
    if (!backupValue) {
      toast.error("First, generate a backup");
      return;
    }

    const blob = new Blob([backupValue], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "chat-key-backup.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportKey = async (e) => {
    e.preventDefault();
    if (!importValue.trim()) {
      toast.error("First, paste the saved backup");
      return;
    }

    setIsImportingKey(true);
    try {
      await importEncryptionKey(importValue.trim());
      toast.success("Key restored. Refresh chats to decrypt history.");
      setImportValue("");
    } catch (error) {
      toast.error(error.message || "Failed to import key");
    } finally {
      setIsImportingKey(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setIsDeletingAccount(true);
      await deleteAccount();
      toast.success("Account has been deleted");
      // opcjonalnie redirect? router? brak - user traci auth, route guard przerzuci
    } catch (error) {
      console.error("delete account failed", error);
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteModal(false);
    }
  };

  const handlePresenceToggle = async () => {
    const nextValue = !authUser?.sharePresence;
    setIsPresenceUpdating(true);
    try {
      await updatePresencePreference(nextValue);
    } finally {
      setIsPresenceUpdating(false);
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-10 bg-base-200">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-base-300 rounded-xl p-6 space-y-8">
          <div className="text-center">
            <h1 className="text-2xl font-semibold ">Profile</h1>
            <p className="mt-2">Your profile information</p>
          </div>

          {/* avatar upload section */}

          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <img
                src={selectedImg || authUser.profilePic || "/avatar.png"}
                alt="Profile"
                className="size-32 rounded-full object-cover border-4 "
              />
              <label
                htmlFor="avatar-upload"
                className={`
                  absolute bottom-0 right-0 
                  bg-base-content hover:scale-105
                  p-2 rounded-full cursor-pointer 
                  transition-all duration-200
                  ${isUpdatingProfile ? "animate-pulse pointer-events-none" : ""}
                `}
              >
                <Camera className="w-5 h-5 text-base-200" />
                <input
                  type="file"
                  id="avatar-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isUpdatingProfile}
                />
              </label>
            </div>
            <p className="text-sm text-zinc-400">
              {isUpdatingProfile ? "Uploading..." : "Click the camera icon to update your photo"}
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-1.5">
              <div className="text-sm text-zinc-400 flex items-center gap-2">
                <User className="w-4 h-4" />
                Full Name
              </div>
              <p className="px-4 py-2.5 bg-base-200 rounded-lg border">{authUser?.fullName}</p>
            </div>

            <div className="space-y-1.5">
              <div className="text-sm text-zinc-400 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </div>
              <p className="px-4 py-2.5 bg-base-200 rounded-lg border">{authUser?.email}</p>
            </div>
          </div>

          <div className="mt-6 bg-base-300 rounded-xl p-6">
            <h2 className="text-lg font-medium  mb-4">Account Information</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-zinc-700">
                <span>Member Since</span>
                <span>{authUser.createdAt?.split("T")[0]}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span>Account Status</span>
                <span className="text-green-500">Active</span>
              </div>
            </div>
          </div>

          <div className="bg-base-200 rounded-xl p-4 space-y-3 border border-base-300">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Share Status</h3>
                <p className="text-sm text-base-content/70">
                  Decide if other users can see that you are online.
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-base-content/60">
                  {authUser?.sharePresence ? "ON" : "OFF"}
                </span>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={Boolean(authUser?.sharePresence)}
                  onChange={handlePresenceToggle}
                  disabled={isPresenceUpdating}
                />
              </label>
            </div>
            {!authUser?.sharePresence && (
              <p className="text-xs text-warning mt-1">
                Your account will not be shown in the online list, but you will still receive messages in the background.
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-base-200 rounded-xl p-4 space-y-3 border border-base-300">
              <div>
                <h3 className="text-lg font-semibold">Encryption Key Backup</h3>
                <p className="text-sm text-base-content/70">
                  The private key exists only on this device. Save it in a password manager or offline to recover your history on another device.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="btn btn-sm btn-primary" onClick={handleGenerateBackup}>
                  Generate Backup
                </button>
                <button className="btn btn-sm" onClick={handleCopyBackup} disabled={!backupValue}>
                  <Copy size={16} /> Copy
                </button>
                <button className="btn btn-sm" onClick={handleDownloadBackup} disabled={!backupValue}>
                  <Download size={16} /> Save File
                </button>
              </div>

              <textarea
                className="textarea textarea-bordered w-full text-xs font-mono"
                rows={4}
                readOnly
                value={backupValue}
                placeholder="Click 'Generate Backup' to see the encrypted string"
              />
            </div>

            <div className="bg-base-200 rounded-xl p-4 space-y-3 border border-base-300">
              <div>
                <h3 className="text-lg font-semibold">Restore Key</h3>
                <p className="text-sm text-base-content/70">
                  Paste the string starting with <code>CHATKEY1:</code>. After import, the public key will be synchronized with the server.
                </p>
              </div>

              <form className="space-y-2" onSubmit={handleImportKey}>
                <textarea
                  className="textarea textarea-bordered w-full text-xs font-mono"
                  rows={4}
                  value={importValue}
                  onChange={(e) => setImportValue(e.target.value)}
                  placeholder="CHATKEY1:..."
                />
                <button className="btn btn-sm btn-secondary w-full" type="submit" disabled={isImportingKey}>
                  {isImportingKey ? "Importing..." : (
                    <span className="flex items-center justify-center gap-2">
                      <Upload size={16} /> Restore Key
                    </span>
                  )}
                </button>
              </form>
            </div>

          </div>

          <div className="bg-base-200 rounded-xl p-4 border border-base-300">
            <h3 className="text-lg font-semibold text-error flex items-center gap-2">
              <Trash2 className="size-5" /> Delete Account
            </h3>
            <p className="text-sm text-base-content/70 mt-2">
              This operation will delete your profile, message history, and encryption key. It cannot be undone.
            </p>
            <button className="btn btn-error mt-4" onClick={() => setShowDeleteModal(true)}>
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-base-200 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div>
              <h3 className="text-xl font-semibold text-error">Confirm Account Deletion</h3>
              <p className="text-sm text-base-content/70 mt-1">
                The account will be deleted along with all messages. There will be no way to restore the data.
              </p>
            </div>
            <div className="space-y-1 text-sm text-base-content/80">
              <p>Make sure you have saved your encryption key if you need access later.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button className="btn btn-ghost flex-1 rounded-full" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button
                className="btn flex-1 rounded-full bg-error/80 border-error/80 text-base-100 hover:bg-error"
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount}
              >
                {isDeletingAccount ? "Deleting..." : "Yes, delete account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ProfilePage;
