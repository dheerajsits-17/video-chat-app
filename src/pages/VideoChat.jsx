import React, { useRef, useState, useEffect } from "react";
import { db } from "../firebase/config";
import { collection, doc, onSnapshot, query, orderBy, serverTimestamp, addDoc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import Controls from "../components/Controls";
import JoinScreen from "../components/JoinScreen";
import ChatSection from "../components/ChatSection";
import { useWebRTC } from "../hooks/useWebRTC";
import { ShieldCheck, Smile, AlertCircle, Info, MessageSquare, Maximize2, Minimize2, MicOff } from "lucide-react";

const VideoChat = () => {
  const myUserId = useRef("user_" + Math.random().toString(36).substring(7)).current;
  const [toast, setToast] = useState({ show: false, msg: "", type: "" });
  const [inputRoomId, setInputRoomId] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [isHostExpanded, setIsHostExpanded] = useState(true);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef(null);
  const localRef = useRef(null);

  const showNotification = (msg, type = "info") => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: "", type: "" }), 4000);
  };

  const webrtc = useWebRTC(myUserId, showNotification);

  useEffect(() => {
    if (webrtc.stream && localRef.current) localRef.current.srcObject = webrtc.stream;
  }, [webrtc.stream]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleMic = () => {
    if (webrtc.stream) {
      const audioTrack = webrtc.stream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      webrtc.setIsMicMuted(!audioTrack.enabled);
      webrtc.updateMediaStatus(!audioTrack.enabled, webrtc.isVideoOff, webrtc.roomId);
    }
  };

  const toggleVideo = () => {
    if (webrtc.stream) {
      const videoTrack = webrtc.stream.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
      webrtc.setIsVideoOff(!videoTrack.enabled);
      webrtc.updateMediaStatus(webrtc.isMicMuted, !videoTrack.enabled, webrtc.roomId);
    }
  };

  const startCall = async (rId, hostStatus) => {
    const finalId = hostStatus ? doc(collection(db, "calls")).id : rId;
    if (!finalId || finalId.trim() === "") return;

    if (!hostStatus) {
      const callSnap = await getDoc(doc(db, "calls", finalId));
      if (!callSnap.exists() || !callSnap.data().active) { showNotification("Invalid ID!", "error"); return; }
      if (callSnap.data().isPrivate) {
        webrtc.setIsWaiting(true);
        const reqRef = doc(db, "calls", finalId, "requests", myUserId);
        await setDoc(reqRef, { id: myUserId, status: "waiting" });
        onSnapshot(reqRef, (snap) => {
          if (snap.data()?.status === "accepted") { webrtc.setIsWaiting(false); webrtc.proceed(finalId, false, isPrivate); }
          if (snap.data()?.status === "rejected") { webrtc.setIsWaiting(false); webrtc.setIsDenied(true); }
        });
      } else { webrtc.proceed(finalId, false, isPrivate); }
    } else { webrtc.proceed(finalId, true, isPrivate); }

    // Listen for messages
    onSnapshot(query(collection(db, "calls", finalId, "messages"), orderBy("timestamp", "asc")), (snapshot) => {
      setMessages(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  };

  const sendMessage = async (e, emoji = null) => {
    if (e) e.preventDefault();
    const text = emoji || newMessage;
    if (!text.trim() || !webrtc.roomId) return;
    await addDoc(collection(db, "calls", webrtc.roomId, "messages"), {
      text, senderId: myUserId, senderType: webrtc.isHost ? "Host" : "Participant", timestamp: serverTimestamp(),
    });
    setNewMessage("");
  };

  const leaveCall = async () => {
    if (webrtc.isHost) await updateDoc(doc(db, "calls", webrtc.roomId), { active: false });
    await deleteDoc(doc(db, "calls", webrtc.roomId, "participants", myUserId));
    window.location.reload();
  };

  return (
    <div className="h-screen bg-[#09090b] text-white flex flex-col font-sans overflow-hidden relative">
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />

      {webrtc.isCalling && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-100 bg-zinc-900/90 border border-white/10 px-4 py-2 rounded-full flex items-center gap-3 shadow-2xl backdrop-blur-md">
           <ShieldCheck size={14} className="text-blue-500" />
           <span className="text-[10px] md:text-xs font-mono text-blue-400 select-all">{webrtc.roomId}</span>
           <button onClick={() => { navigator.clipboard.writeText(webrtc.roomId); showNotification("Copied!"); }} className="text-zinc-500 hover:text-white"><Smile size={12}/></button>
        </div>
      )}

      {webrtc.isHost && webrtc.joinRequests.length > 0 && (
        <div className="fixed top-20 right-6 z-130 bg-zinc-900/90 border border-blue-500 p-4 rounded-2xl shadow-2xl backdrop-blur-xl animate-in slide-in-from-right">
          <p className="text-xs font-bold text-blue-400 mb-3 uppercase tracking-widest">Join Requests</p>
          {webrtc.joinRequests.map((r) => (
            <div key={r.id} className="flex gap-3 items-center bg-white/5 p-2 rounded-xl mb-2">
              <span className="text-[10px]">User...{r.id.slice(-4)}</span>
              <button onClick={() => updateDoc(doc(db, "calls", webrtc.roomId, "requests", r.id), { status: "accepted" })} className="bg-green-600 px-2 py-1 rounded text-[10px] font-bold">Allow</button>
              <button onClick={() => updateDoc(doc(db, "calls", webrtc.roomId, "requests", r.id), { status: "rejected" })} className="bg-red-600 px-2 py-1 rounded text-[10px] font-bold">Deny</button>
            </div>
          ))}
        </div>
      )}

      {!webrtc.isCalling && !webrtc.isWaiting && !webrtc.isDenied ? (
        <JoinScreen isPrivate={isPrivate} setIsPrivate={setIsPrivate} startCall={startCall} inputRoomId={inputRoomId} setInputRoomId={setInputRoomId} db={db} collection={collection} />
      ) : webrtc.isCalling && (
        <div className="relative flex-1 p-4 md:p-6 flex z-10 gap-4 overflow-hidden">
          <div className={`flex-1 flex flex-col transition-all duration-500 ${showChat ? "md:mr-80" : ""}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 w-full h-full max-w-7xl mx-auto overflow-y-auto pb-32 pt-16 scrollbar-hide">
              <div onClick={() => webrtc.isHost && setIsHostExpanded(!isHostExpanded)} className={`relative aspect-video bg-zinc-900/40 rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl backdrop-blur-md transition-all duration-500 cursor-pointer group ${webrtc.isHost && isHostExpanded ? 'md:col-span-2 md:row-span-2' : 'col-span-1'}`}>
                <video ref={localRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                <div className="absolute bottom-4 left-4 bg-black/60 px-4 py-1.5 rounded-full border border-white/10 text-[10px] font-bold">You {webrtc.isHost && " (Host)"}</div>
                <div className="absolute top-4 right-4 flex gap-2">
                    {webrtc.isMicMuted && <div className="bg-red-500/80 p-2 rounded-full"><MicOff size={12} /></div>}
                    {webrtc.isHost && (isHostExpanded ? <Minimize2 size={16} className="text-white/50 group-hover:text-white" /> : <Maximize2 size={16} className="text-white/50 group-hover:text-white" />)}
                </div>
              </div>

              {Object.entries(webrtc.remoteStreams).map(([id, rs]) => {
                const isRemoteHost = webrtc.participantsInfo[id]?.isHost;
                return (
                  <div key={id} onClick={() => isRemoteHost && setIsHostExpanded(!isHostExpanded)} className={`relative aspect-video bg-zinc-900/40 rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl backdrop-blur-md transition-all duration-500 cursor-pointer group ${isRemoteHost && isHostExpanded ? 'md:col-span-2 md:row-span-2' : 'col-span-1'}`}>
                    <video autoPlay playsInline className="w-full h-full object-cover" ref={(el) => { if (el) el.srcObject = rs; }} />
                    <div className="absolute bottom-4 left-4 bg-black/60 px-4 py-1.5 rounded-full border border-white/10 text-[10px] font-bold">Participant {isRemoteHost && "(Host)"}</div>
                    <div className="absolute top-4 right-4 flex gap-2">
                        {webrtc.participantsInfo[id]?.isMicMuted && <div className="bg-red-500/80 p-2 rounded-full"><MicOff size={12} /></div>}
                        {isRemoteHost && (isHostExpanded ? <Minimize2 size={16} className="text-white/50 group-hover:text-white" /> : <Maximize2 size={16} className="text-white/50 group-hover:text-white" />)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {showChat && <ChatSection messages={messages} newMessage={newMessage} setNewMessage={setNewMessage} sendMessage={sendMessage} chatEndRef={chatEndRef} myUserId={myUserId} setShowChat={setShowChat} />}

          <button onClick={() => setShowChat(!showChat)} className={`fixed bottom-24 right-6 md:bottom-10 md:right-10 z-60 p-4 rounded-full shadow-2xl transition-all active:scale-90 ${showChat ? "bg-zinc-800 text-blue-400" : "bg-blue-600 text-white shadow-blue-500/40"}`}>
            <MessageSquare size={24} />
          </button>

          <Controls roomId={webrtc.roomId} isMicMuted={webrtc.isMicMuted} isVideoOff={webrtc.isVideoOff} onToggleMic={toggleMic} onToggleVideo={toggleVideo} onLeave={leaveCall} />
        </div>
      )}

      {webrtc.isWaiting && <div className="h-screen flex items-center justify-center z-200 bg-[#09090b] text-center p-6"><h2 className="font-bold text-amber-400 text-2xl animate-pulse">"Please wait! Host will join you soon..."</h2></div>}
      {webrtc.isDenied && <div className="h-screen flex items-center justify-center z-200 bg-[#09090b] text-center p-6"><h2 className="font-bold text-red-400 text-2xl uppercase">"Entry Denied"</h2></div>}

      {toast.show && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-300 flex items-center gap-3 px-6 py-3 rounded-2xl border border-white/10 bg-zinc-900/80 backdrop-blur-xl text-blue-200 animate-bounce">
          {toast.type === "error" ? <AlertCircle size={20} className="text-red-400" /> : <Info size={20} />}
          <span className="font-medium text-sm">{toast.msg}</span>
        </div>
      )}
    </div>
  );
};

export default VideoChat;