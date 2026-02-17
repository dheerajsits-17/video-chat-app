import React from "react";
import { Video as VideoIcon, Globe, Lock, Zap } from "lucide-react";

const JoinScreen = ({ isPrivate, setIsPrivate, startCall, inputRoomId, setInputRoomId, db, collection }) => {
  return (
    <div className="flex-1 flex items-center justify-center p-6 z-10">
      <div className="w-full max-w-md bg-zinc-900/40 p-10 rounded-[3rem] border border-white/10 backdrop-blur-3xl shadow-2xl text-center relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-blue-500 to-transparent" />
        <div className="w-20 h-20 bg-linear-to-br from-blue-500 to-blue-700 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
          <VideoIcon size={40} className="text-white" />
        </div>
        <h2 className="text-4xl font-extrabold mb-8 tracking-tight bg-clip-text text-transparent bg-linear-to-b from-white to-zinc-500">Meet-Live</h2>
        <div className="flex bg-black/40 p-1 rounded-2xl mb-8 border border-white/5 shadow-inner">
            <button onClick={() => setIsPrivate(false)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${!isPrivate ? 'bg-blue-600 shadow-lg text-white' : 'text-zinc-500'}`}><Globe size={14}/> Public</button>
            <button onClick={() => setIsPrivate(true)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${isPrivate ? 'bg-blue-600 shadow-lg text-white' : 'text-zinc-500'}`}><Lock size={14}/> Private</button>
        </div>
        <button onClick={() => {
          import("firebase/firestore").then(({doc, collection}) => {
             
             startCall(null, true); 
          })
        }} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-bold mb-6 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3"><Zap size={20} fill="currentColor" /> Host New Meeting</button>
        <input value={inputRoomId} onChange={(e) => setInputRoomId(e.target.value)} placeholder="Enter Access Key" className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl mb-4 text-center text-blue-400 outline-none font-mono focus:border-blue-500/50 shadow-inner" />
        <button onClick={() => startCall(inputRoomId, false)} className="w-full bg-zinc-800/50 hover:bg-zinc-700 py-4 rounded-2xl font-bold transition-all border border-white/5">Join Session</button>
      </div>
    </div>
  );
};

export default JoinScreen;