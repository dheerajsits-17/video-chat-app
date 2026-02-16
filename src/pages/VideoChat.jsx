import React, { useRef, useState, useEffect } from "react";
import { db } from "../firebase/config";
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  updateDoc,
  addDoc,
  deleteDoc,
  getDoc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import Controls from "../components/Controls";
import {
  Video as VideoIcon,
  Users,
  ShieldCheck,
  Zap,
  MicOff,
  VideoOff,
  AlertCircle,
  Info,
  Send,
  MessageSquare,
  Smile,
} from "lucide-react";

const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

const VideoChat = () => {
  const [roomId, setRoomId] = useState("");
  const [inputRoomId, setInputRoomId] = useState("");
  const [isCalling, setIsCalling] = useState(false);
  const [stream, setStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [participantsInfo, setParticipantsInfo] = useState({});
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isHost, setIsHost] = useState(false);

  // New Permission States added as requested
  const [isWaiting, setIsWaiting] = useState(false);
  const [joinRequests, setJoinRequests] = useState([]);
  const [isDenied, setIsDenied] = useState(false);

  // Chat States
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef(null);

  const [toast, setToast] = useState({ show: false, msg: "", type: "" });

  const pcs = useRef({});
  const localRef = useRef(null);
  const myUserId = useRef("user_" + Math.random().toString(36).substring(7));

  const showNotification = (msg, type = "info") => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: "", type: "" }), 4000);
  };

  useEffect(() => {
    if (stream && localRef.current) localRef.current.srcObject = stream;
  }, [stream]);

  // Auto scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const updateMediaStatus = async (mic, cam) => {
    if (!roomId) return;
    const userDoc = doc(db, "calls", roomId, "participants", myUserId.current);
    await updateDoc(userDoc, { isMicMuted: mic, isVideoOff: cam });
  };

  const toggleMic = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      const newState = !audioTrack.enabled;
      audioTrack.enabled = newState;
      setIsMicMuted(!newState);
      updateMediaStatus(!newState, isVideoOff);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      const newState = !videoTrack.enabled;
      videoTrack.enabled = newState;
      setIsVideoOff(!newState);
      updateMediaStatus(isMicMuted, !newState);
    }
  };

  // Chat/Emoji Send
  const sendMessage = async (e, emoji = null) => {
    if (e) e.preventDefault();
    const text = emoji || newMessage;
    if (!text.trim() || !roomId) return;

    const chatCol = collection(db, "calls", roomId, "messages");
    await addDoc(chatCol, {
      text: text,
      senderId: myUserId.current,
      senderType: isHost ? "Host" : "Participant",
      timestamp: serverTimestamp(),
    });
    setNewMessage("");
  };

  const createPeer = (peerId, callDoc, localStream) => {
    const pc = new RTCPeerConnection(servers);
    pcs.current[peerId] = pc;
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    pc.ontrack = (e) => {
      setRemoteStreams((prev) => ({ ...prev, [peerId]: e.streams[0] }));
    };

    const iceCol = collection(
      callDoc,
      "participants",
      myUserId.current,
      "peers",
      peerId,
      "ice",
    );
    pc.onicecandidate = (e) => {
      if (e.candidate) addDoc(iceCol, e.candidate.toJSON());
    };

    onSnapshot(
      collection(
        callDoc,
        "participants",
        peerId,
        "peers",
        myUserId.current,
        "ice",
      ),
      (snap) => {
        snap.docChanges().forEach(async (change) => {
          if (change.type === "added") {
            const candidateData = change.doc.data();
            if (pc.remoteDescription && pc.remoteDescription.type) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidateData));
              } catch (e) {
                console.error("Error adding ice candidate", e);
              }
            }
          }
        });
      },
    );
    return pc;
  };

  const handleSignaling = (peerId, callDoc, localStream, isOfferer) => {
    const pc = createPeer(peerId, callDoc, localStream);
    const peerDoc = doc(
      callDoc,
      "participants",
      isOfferer ? myUserId.current : peerId,
      "peers",
      isOfferer ? peerId : myUserId.current,
    );

    if (isOfferer) {
      pc.onnegotiationneeded = async () => {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await setDoc(
          peerDoc,
          { offer: { sdp: offer.sdp, type: offer.type } },
          { merge: true },
        );
      };
    }

    onSnapshot(peerDoc, async (snap) => {
      const data = snap.data();
      if (!data) return;
      if (!isOfferer && data.offer && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await updateDoc(peerDoc, {
          answer: { sdp: answer.sdp, type: answer.type },
        });
      } else if (isOfferer && data.answer && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });
  };

  // Split logic into proceed to handle permissions
  const proceed = async (rId, hostStatus) => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setStream(s);
      setIsCalling(true);
      setIsHost(hostStatus);
      setRoomId(rId);

      const callDoc = doc(db, "calls", rId);
      if (hostStatus) {
        await setDoc(
          callDoc,
          {
            active: true,
            hostId: myUserId.current,
            createdAt: new Date(),
          },
          { merge: true },
        );

        // Host listens for join requests
        onSnapshot(collection(db, "calls", rId, "requests"), (s) => {
          setJoinRequests(
            s.docs.map((d) => d.data()).filter((r) => r.status === "waiting"),
          );
        });
      }

      await setDoc(doc(callDoc, "participants", myUserId.current), {
        joined: true,
        isMicMuted: false,
        isVideoOff: false,
        isHost: hostStatus,
      });

      const q = query(
        collection(callDoc, "messages"),
        orderBy("timestamp", "asc"),
      );
      onSnapshot(q, (snapshot) => {
        setMessages(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      });

      onSnapshot(callDoc, (snap) => {
        if (snap.exists() && snap.data().active === false && !hostStatus) {
          showNotification("Meeting ended by Host. Redirecting...", "error");
          setTimeout(() => window.location.reload(), 3000);
        }
      });

      onSnapshot(collection(callDoc, "participants"), (snap) => {
        snap.docChanges().forEach((change) => {
          const pId = change.doc.id;
          const pData = change.doc.data();
          if (change.type === "removed") {
            if (pcs.current[pId]) {
              pcs.current[pId].close();
              delete pcs.current[pId];
            }
            setRemoteStreams((prev) => {
              const next = { ...prev };
              delete next[pId];
              return next;
            });
            setParticipantsInfo((prev) => {
              const next = { ...prev };
              delete next[pId];
              return next;
            });
          }
          if (pId !== myUserId.current) {
            setParticipantsInfo((prev) => ({ ...prev, [pId]: pData }));
            if (change.type === "added" && !pcs.current[pId]) {
              const isOfferer = myUserId.current > pId;
              handleSignaling(pId, callDoc, s, isOfferer);
            }
          }
        });
      });
    } catch (err) {
      showNotification("Camera/Mic access denied", "error");
    }
  };

  const startCall = async (rId, hostStatus) => {
    if (!rId || rId.trim() === "") {
      showNotification("Please enter a valid Access ID to join", "error");
      return;
    }

    if (!hostStatus) {
      const callRef = doc(db, "calls", rId);
      const callSnap = await getDoc(callRef);
      if (!callSnap.exists() || callSnap.data().active === false) {
        showNotification("Invalid ID ! OR Meeting has ended", "error");
        return;
      }

      // PARTICIPANT PERMISSION LOGIC
      setIsWaiting(true);
      const reqRef = doc(db, "calls", rId, "requests", myUserId.current);
      await setDoc(reqRef, { id: myUserId.current, status: "waiting" });

      onSnapshot(reqRef, (snap) => {
        const status = snap.data()?.status;
        if (status === "accepted") {
          setIsWaiting(false);
          proceed(rId, false);
        }
        if (status === "rejected") {
          setIsWaiting(false);
          setIsDenied(true);
        }
      });
      return; // Stop and wait for host
    } else {
      // HOST START
      proceed(rId, true);
    }
  };

  const leaveCall = async () => {
    const callDoc = doc(db, "calls", roomId);
    if (isHost) {
      await updateDoc(callDoc, { active: false });
    }
    await deleteDoc(doc(callDoc, "participants", myUserId.current));
    window.location.reload();
  };

  return (
    <div className="h-screen bg-[#09090b] text-white flex flex-col font-sans overflow-hidden">
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />

      {/* Permission Box for Host */}
      {isHost && joinRequests.length > 0 && (
        <div className="fixed top-10 right-10 z-[100] bg-zinc-900 border border-blue-500 p-4 rounded-2xl shadow-2xl">
          <p className="text-l mb-2">Join Request:</p>
          {joinRequests.map((r) => (
            <div key={r.id} className="flex gap-2 mb-2">
              <span className="text-[13px] self-center">
                User want to join....{r.id.slice(-4)}
              </span>
              <button
                onClick={() =>
                  updateDoc(doc(db, "calls", roomId, "requests", r.id), {
                    status: "accepted",
                  })
                }
                className="bg-green-600 px-2 py-1 rounded text-xs"
              >
                Allow
              </button>
              <button
                onClick={() =>
                  updateDoc(doc(db, "calls", roomId, "requests", r.id), {
                    status: "rejected",
                  })
                }
                className="bg-red-600 px-2 py-1 rounded text-xs"
              >
                Deny
              </button>
            </div>
          ))}
        </div>
      )}

      {toast.show && (
        <div
          className={`fixed top-10 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-3 rounded-2xl border backdrop-blur-xl transition-all animate-bounce ${toast.type === "error" ? "bg-red-500/20 border-red-500/50 text-red-200" : "bg-zinc-900/80 border-white/10 text-blue-200"}`}
        >
          {toast.type === "error" ? (
            <AlertCircle size={20} />
          ) : (
            <Info size={20} />
          )}
          <span className="font-medium text-sm">{toast.msg}</span>
        </div>
      )}

      {/* Special Screens */}
      {isWaiting && (
        <div className="h-screen flex items-center justify-center z-50 bg-[#09090b]">
          <h2 className="font-bold text-amber-400">"Please wait ! ,Host will join you soon...!"</h2>
        </div>
      )}
      {isDenied && (
        <div className="h-screen flex items-center justify-center text-red-500 z-50 bg-[#09090b]">
          <h2 className="font-bold text-red-400">"Host did not allow you to join...!" (Entry Denied)</h2>
        </div>
      )}

      {!isCalling && !isWaiting && !isDenied ? (
        <div className="flex-1 flex items-center justify-center p-6 z-10">
          <div className="w-full max-w-md bg-zinc-900/40 p-10 rounded-[3rem] border border-white/10 backdrop-blur-3xl shadow-2xl text-center relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-700 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <VideoIcon size={40} className="text-white" />
            </div>
            <h2 className="text-4xl font-extrabold mb-2 tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500">
              Meet-Live{" "}
              <span className="text-blue-500 text-lg font-mono px-2 py-1 bg-blue-500/10 rounded-lg ml-1">
                On
              </span>
            </h2>
            <button
              onClick={() => startCall(doc(collection(db, "calls")).id, true)}
              className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-bold mb-6 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3"
            >
              <Zap size={20} fill="currentColor" /> Host New Meeting
            </button>
            <input
              value={inputRoomId}
              onChange={(e) => setInputRoomId(e.target.value)}
              placeholder="Enter Access Key"
              className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl mb-4 text-center text-blue-400 outline-none font-mono focus:border-blue-500/50 transition-all"
            />
            <button
              onClick={() => startCall(inputRoomId, false)}
              className="w-full bg-zinc-800/50 hover:bg-zinc-700 py-4 rounded-2xl font-bold transition-all active:scale-95 border border-white/5"
            >
              Join Session
            </button>
          </div>
        </div>
      ) : (
        isCalling && (
          <div className="relative flex-1 p-6 flex z-10 gap-4 overflow-hidden">
            <div
              className={`flex-1 flex flex-col transition-all duration-500 ${showChat ? "md:mr-80" : ""}`}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full h-full max-w-7xl mx-auto overflow-y-auto pb-32 pt-4 scrollbar-hide">
                <div className="relative aspect-video bg-zinc-900/40 rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl backdrop-blur-md">
                  <video
                    ref={localRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  <div className="absolute bottom-4 left-4 flex gap-2">
                    <div className="bg-black/60 backdrop-blur-xl px-4 py-1.5 rounded-full border border-white/10 text-[10px] font-bold">
                      You {isHost && " (Host)"}
                    </div>
                    {isMicMuted && (
                      <div className="bg-red-500/80 p-1.5 rounded-full">
                        <MicOff size={12} />
                      </div>
                    )}
                  </div>
                </div>
                {Object.entries(remoteStreams).map(([id, rs]) => (
                  <div
                    key={id}
                    className="relative aspect-video bg-zinc-900/40 rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl backdrop-blur-md"
                  >
                    <video
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                      ref={(el) => {
                        if (el) el.srcObject = rs;
                      }}
                    />
                    <div className="absolute bottom-4 left-4 flex gap-2">
                      <div className="bg-black/60 backdrop-blur-xl px-4 py-1.5 rounded-full border border-white/10 text-[10px] font-bold">
                        Participant
                      </div>
                      {participantsInfo[id]?.isMicMuted && (
                        <div className="bg-red-500/80 p-1.5 rounded-full">
                          <MicOff size={12} />
                        </div>
                      )}
                      {participantsInfo[id]?.isVideoOff && (
                        <div className="bg-orange-500/80 p-1.5 rounded-full">
                          <VideoOff size={12} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {showChat && (
              <div className="fixed right-6 top-6 bottom-32 w-80 h-98 bg-zinc-900/90 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 flex flex-col shadow-2xl z-50 animate-in slide-in-from-right">
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                  <h3 className="font-bold flex items-center gap-2">
                    <MessageSquare size={18} /> Live Chat
                  </h3>
                  <button
                    onClick={() => setShowChat(false)}
                    className="text-zinc-500 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col ${m.senderId === myUserId.current ? "items-end" : "items-start"}`}
                    >
                      <span className="text-[10px] text-zinc-500 mb-1">
                        {m.senderType}
                      </span>
                      <div
                        className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${m.senderId === myUserId.current ? "bg-blue-600 text-white rounded-tr-none" : "bg-zinc-800 text-zinc-200 rounded-tl-none"}`}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="px-4 py-2 flex justify-between border-t border-white/5 ">
                  {["✋", "👍", "👎", "😅", "😂", "❤️"].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => sendMessage(null, emoji)}
                      className="hover:scale-125 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <form onSubmit={sendMessage} className="p-4 flex gap-2">
                  <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 p-2 rounded-xl hover:bg-blue-500"
                  >
                    <Send size={18} />
                  </button>
                </form>
              </div>
            )}
            <button
              onClick={() => setShowChat(!showChat)}
              className={`fixed bottom-10 right-10 z-[60] p-4 rounded-full shadow-2xl transition-all active:scale-90 ${showChat ? "bg-zinc-800 text-blue-400" : "bg-blue-600 text-white"}`}
            >
              <MessageSquare size={24} />
            </button>
            <Controls
              roomId={roomId}
              isMicMuted={isMicMuted}
              isVideoOff={isVideoOff}
              onToggleMic={toggleMic}
              onToggleVideo={toggleVideo}
              onLeave={leaveCall}
            />
          </div>
        )
      )}
    </div>
  );
};

export default VideoChat;
