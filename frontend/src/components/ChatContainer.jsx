import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";

const ChatContainer = () => {
  const { messages, getMessages, isMessagesLoading, selectedUser, deleteMessage } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);
  const [messagePendingDeletion, setMessagePendingDeletion] = useState(null);

  useEffect(() => {
    getMessages(selectedUser._id);
  }, [selectedUser._id, getMessages]);

  useEffect(() => {
    if (messageEndRef.current && messages) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  const handleDeleteMessage = (message) => {
    if (!message) return;
    setMessagePendingDeletion(message);
  };

  const confirmDelete = () => {
    if (!messagePendingDeletion) return;
    deleteMessage(messagePendingDeletion._id);
    setMessagePendingDeletion(null);
  };

  const cancelDelete = () => setMessagePendingDeletion(null);

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message._id}
            className={`chat ${message.senderId === authUser._id ? "chat-end" : "chat-start"}`}
            ref={messageEndRef}
          >
            <div className=" chat-image avatar">
              <div className="size-10 rounded-full border">
                <img
                  src={
                    message.senderId === authUser._id
                      ? authUser.profilePic || "/avatar.png"
                      : selectedUser.profilePic || "/avatar.png"
                  }
                  alt="profile pic"
                />
              </div>
            </div>
            <div className="chat-header mb-1">
              <time className="text-xs opacity-50 ml-1">
                {formatMessageTime(message.createdAt)}
              </time>
            </div>
            <div
              className={`chat-bubble flex flex-col relative group border transition-colors ${
                message.senderId === authUser._id
                  ? "bg-primary text-primary-content border-primary/70"
                  : "bg-base-200 text-base-content border-base-200"
              }`}
            >
              {message.senderId === authUser._id && (
                <button
                  type="button"
                  className="absolute -bottom-2 -right-1 opacity-0 group-hover:opacity-100 transition rounded-full border border-base-200 bg-base-100/80 hover:bg-error/20 text-base-content/70 hover:text-error p-1 shadow-sm"
                  onClick={() => handleDeleteMessage(message)}
                  title="Delete message"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
              {message.image && (
                <img
                  src={message.image}
                  alt="Attachment"
                  className="sm:max-w-[200px] rounded-md mb-2"
                />
              )}
              {!message.image && message.imageDecryptionFailed && (
                <p className="text-sm italic text-warning mb-2">
                  Unable to decrypt this attachment
                </p>
              )}
              {message.text && <p>{message.text}</p>}
              {!message.text && message.isDecryptionFailed && (
                <p className="text-sm italic text-warning">
                  Unable to decrypt this message
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <MessageInput />

      {messagePendingDeletion && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-base-200 rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Delete message?</h3>
              <p className="text-sm text-base-content/70 mt-1">
                This operation is irreversible and will delete the message for all participants.
              </p>
            </div>
            {messagePendingDeletion.text && (
              <div className="p-3 rounded-lg bg-base-100 border text-sm text-base-content/80">
                {messagePendingDeletion.text}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <button className="btn btn-ghost flex-1 rounded-full" onClick={cancelDelete}>
                Cancel
              </button>
              <button
                className="btn flex-1 rounded-full bg-error/80 border-error/80 text-base-100 hover:bg-error"
                onClick={confirmDelete}
              >
                Delete message
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ChatContainer;
