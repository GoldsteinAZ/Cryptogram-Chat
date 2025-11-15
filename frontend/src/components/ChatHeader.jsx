import { useState } from "react";
import { X, UserMinus } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser, removeContact } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const [showRemoveModal, setShowRemoveModal] = useState(false);

  const handleRemoveContact = async () => {
    try {
      await removeContact(selectedUser._id);
    } finally {
      setShowRemoveModal(false);
    }
  };

  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="avatar">
            <div className="size-10 rounded-full relative">
              <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
            </div>
          </div>

          {/* User info */}
          <div>
            <h3 className="font-medium">{selectedUser.fullName}</h3>
            <p className="text-sm text-base-content/70">
              {onlineUsers.includes(selectedUser._id) ? "Online" : "Offline"}
            </p>
          </div>
        </div>

        {/* Close button */}
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowRemoveModal(true)} title="Remove Contact">
            <UserMinus size={16} />
          </button>
          <button onClick={() => setSelectedUser(null)} className="btn btn-ghost btn-sm">
            <X />
          </button>
        </div>
      </div>

      {showRemoveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-base-200 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Remove contact?</h3>
              <p className="text-sm text-base-content/70">
                Your messages sent to {selectedUser.fullName} will be deleted. The other person will only keep their sent messages.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button className="btn btn-ghost flex-1 rounded-full" onClick={() => setShowRemoveModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-error flex-1 rounded-full"
                onClick={handleRemoveContact}
              >
                Remove Contact
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ChatHeader;
