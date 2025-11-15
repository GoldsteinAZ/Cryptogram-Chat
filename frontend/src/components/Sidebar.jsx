import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Users, Plus, X, UserMinus } from "lucide-react";

const Sidebar = () => {
  const {
    getUsers,
    users,
    selectedUser,
    setSelectedUser,
    isUsersLoading,
    handleIncomingMessage,
    handleMessageDeleted,
    addContact,
    removeContact,
    handleConversationPurged,
  } = useChatStore();

  const { onlineUsers, socket } = useAuthStore();
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [contactToRemove, setContactToRemove] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  useEffect(() => {
    if (!socket) return;
    socket.on("newMessage", handleIncomingMessage);
    socket.on("messageDeleted", handleMessageDeleted);
    socket.on("conversationPurged", handleConversationPurged);
    return () => {
      socket.off("newMessage", handleIncomingMessage);
      socket.off("messageDeleted", handleMessageDeleted);
      socket.off("conversationPurged", handleConversationPurged);
    };
  }, [socket, handleIncomingMessage, handleMessageDeleted, handleConversationPurged]);

  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!contactEmail.trim()) return;
    setIsAdding(true);
    try {
      await addContact(contactEmail.trim());
      setContactEmail("");
      setIsModalOpen(false);
    } finally {
      setIsAdding(false);
    }
  };

  const filteredUsers = showOnlineOnly
    ? users.filter((user) => onlineUsers.includes(user._id))
    : users;

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <aside className="h-full w-20 lg:w-72 border-r border-base-300 flex flex-col transition-all duration-200">
      <div className="border-b border-base-300 w-full p-5">
        <div className="flex items-center gap-2">
          <Users className="size-6" />
          <span className="font-medium hidden lg:block">Contacts</span>
        </div>
        {/* TODO: Online filter toggle */}
        <div className="mt-3 hidden lg:flex items-center gap-2">
          <label className="cursor-pointer flex items-center gap-2">
            <input
              type="checkbox"
              checked={showOnlineOnly}
              onChange={(e) => setShowOnlineOnly(e.target.checked)}
              className="checkbox checkbox-sm"
            />
            <span className="text-sm">Show online only</span>
          </label>
          <span className="text-xs text-zinc-500">({onlineUsers.length} online)</span>
        </div>
        <button className="btn btn-primary btn-sm w-full mt-3 hidden lg:flex" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} /> Add Contact
        </button>
        <button
          className="btn btn-circle btn-sm mt-3 lg:hidden"
          onClick={() => setIsModalOpen(true)}
          title="Add Contact"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="overflow-y-auto w-full py-3">
        {filteredUsers.map((user) => (
          <div
            key={user._id}
            className={`
              w-full p-3 flex items-center gap-3 group
              hover:bg-base-300 transition-colors
              ${selectedUser?._id === user._id ? "bg-base-300 ring-1 ring-base-300" : ""}
            `}
          >
            <button className="flex items-center gap-3 flex-1" onClick={() => setSelectedUser(user)}>
            <div className="relative mx-auto lg:mx-0">
              <img
                src={user.profilePic || "/avatar.png"}
                alt={user.name}
                className="size-12 object-cover rounded-full"
              />
              {onlineUsers.includes(user._id) && (
                <span
                  className="absolute bottom-0 right-0 size-3 bg-green-500 
                  rounded-full ring-2 ring-zinc-900"
                />
              )}
              {user.unreadCount > 0 && (
                <span
                  className="absolute -top-1 -left-1 min-w-5 h-5 px-1 text-[10px] rounded-full bg-error text-base-100 flex items-center justify-center font-semibold shadow-lg"
                >
                  {user.unreadCount > 99 ? "99+" : user.unreadCount}
                </span>
              )}
            </div>

            {/* User info - only visible on larger screens */}
            <div className="hidden lg:block text-left min-w-0">
              <div className="font-medium truncate">{user.fullName}</div>
              <div className="text-sm text-zinc-400">
                {onlineUsers.includes(user._id) ? "Online" : "Offline"}
              </div>
            </div>
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100"
              title="Remove Contact"
              onClick={() => setContactToRemove(user)}
            >
              <UserMinus size={16} />
            </button>
          </div>
        ))}

        {filteredUsers.length === 0 && (
          <div className="text-center text-zinc-500 py-4">No contacts</div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-base-200 rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add Contact</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-base-content/70">
              Enter the e-mail address of the person you want to talk to. The other party does not have to accept anything.
            </p>
            <form onSubmit={handleAddContact} className="space-y-3">
              <input
                type="email"
                className="input input-bordered w-full"
                placeholder="you@example.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-ghost flex-1 rounded-full"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1 rounded-full"
                  disabled={isAdding}
                >
                  {isAdding ? "Adding..." : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {contactToRemove && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-base-200 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Remove {contactToRemove.fullName}?</h3>
              <p className="text-sm text-base-content/70">
                Your messages to this person will be deleted immediately. The other party will only keep their own entries.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                className="btn btn-ghost flex-1 rounded-full"
                onClick={() => setContactToRemove(null)}
                disabled={isRemoving}
              >
                Cancel
              </button>
              <button
                className="btn btn-error flex-1 rounded-full"
                onClick={async () => {
                  if (!contactToRemove) return;
                  setIsRemoving(true);
                  try {
                    await removeContact(contactToRemove._id);
                  } finally {
                    setIsRemoving(false);
                    setContactToRemove(null);
                  }
                }}
                disabled={isRemoving}
              >
                {isRemoving ? "Removing..." : "Remove Contact"}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
export default Sidebar;
