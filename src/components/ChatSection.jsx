import React from "react";
import { MessageSquare, Send } from "lucide-react";

const ChatSection = ({ messages, newMessage, setNewMessage, sendMessage, chatEndRef, myUserId, setShowChat }) => {
  return (
    <div className="fixed right-0 md:right-6 top-0 md:top-6 bottom-0 md:bottom-32 w-full md:w-80 bg-zinc-900/90 backdrop-blur-2xl md:rounded-[2.5rem] border-l md:border border-white/10 flex flex-col shadow-2xl z-50 animate-in slide-in-from-right">
      <div className="p-6 border-b border-white/10 flex justify-between items-center">
        <h3 className="font-bold flex items-center gap-2"><MessageSquare size={18} /> Live Chat</h3>
        <button onClick={() => setShowChat(false)} className="text-zinc-500 hover:text-white">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.senderId === myUserId ? "items-end" : "items-start"}`}>
            <span className="text-[10px] text-zinc-500 mb-1">{m.senderType}</span>
            <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${m.senderId === myUserId ? "bg-blue-600 text-white rounded-tr-none shadow-lg shadow-blue-500/20" : "bg-zinc-800 text-zinc-200 rounded-tl-none"}`}>{m.text}</div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <div className="px-4 py-2 flex justify-between border-t border-white/5 bg-black/20">
        {["✋", "👍", "👎", "😅", "😂", "❤️"].map((emoji) => (
          <button key={emoji} onClick={() => sendMessage(null, emoji)} className="hover:scale-125 transition-transform text-lg">{emoji}</button>
        ))}
      </div>
      <form onSubmit={sendMessage} className="p-4 flex gap-2">
        <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 shadow-inner" />
        <button type="submit" className="bg-blue-600 p-2 rounded-xl hover:bg-blue-500 shadow-lg shadow-blue-500/20"><Send size={18} /></button>
      </form>
    </div>
  );
};

export default ChatSection;