import React, { useState } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Copy, Check } from "lucide-react";

const Controls = ({ roomId, isMicMuted, isVideoOff, onToggleMic, onToggleVideo, onLeave }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    // AB YE ROOM ID KI JAGAH PURA LINK COPY KAREGA
    const fullLink = `${window.location.origin}/chat/${roomId}`;
    navigator.clipboard.writeText(fullLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-4 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl z-50">
      <div className="hidden md:flex items-center gap-3 pr-4 border-r border-white/10">
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-tighter">Invite Link</span>
        <button onClick={copyToClipboard} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-3 py-1 rounded-full transition-all">
          <span className="text-[10px] font-mono text-blue-400">Copy Link</span>
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-zinc-400" />}
        </button>
      </div>
      <div className="flex gap-4">
        <button onClick={onToggleMic} className={`p-3 rounded-2xl transition-all ${isMicMuted ? "bg-red-500/20 text-red-500" : "bg-zinc-800 hover:bg-zinc-700"}`}>
          {isMicMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        <button onClick={onToggleVideo} className={`p-3 rounded-2xl transition-all ${isVideoOff ? "bg-red-500/20 text-red-500" : "bg-zinc-800 hover:bg-zinc-700"}`}>
          {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
        </button>
        <button onClick={onLeave} className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl transition-all px-6 font-bold flex items-center gap-2">
          <PhoneOff size={18} />
          <span className="hidden sm:inline text-sm">End Call</span>
        </button>
      </div>
    </div>
  );
};

export default Controls;