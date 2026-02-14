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
} from "firebase/firestore";
import Controls from "../components/Controls";
import {
  Video as VideoIcon,
  Users,
  ShieldCheck,
  Zap,
  MicOff,
  VideoOff,
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

  const pcs = useRef({});
  const localRef = useRef(null);
  const myUserId = useRef("user_" + Math.random().toString(36).substring(7));

  useEffect(() => {
    if (stream && localRef.current) localRef.current.srcObject = stream;
  }, [stream]);

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

  const startCall = async (rId, hostStatus) => {
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
      await setDoc(callDoc, {
        active: true,
        hostId: myUserId.current,
        createdAt: new Date(),
      });
    }

    await setDoc(doc(callDoc, "participants", myUserId.current), {
      joined: true,
      isMicMuted: false,
      isVideoOff: false,
      isHost: hostStatus,
    });

    onSnapshot(callDoc, (snap) => {
      if (snap.exists() && snap.data().active === false && !hostStatus) {
        alert("Meeting ended by Host");
        window.location.reload();
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

      {!isCalling ? (
        <div className="flex-1 flex items-center justify-center p-6 z-10">
          <div className="w-full max-w-md bg-zinc-900/40 p-10 rounded-[3rem] border border-white/10 backdrop-blur-3xl shadow-2xl text-center relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-700 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <VideoIcon size={40} className="text-white" />
            </div>
            <h2 className="text-4xl font-extrabold mb-2 tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500">
              Meet-Live{" "}
              <span className="text-blue-500 text-lg font-mono px-2 py-1 bg-blue-500/10 rounded-lg ml-1">
                Pro
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
              className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl mb-4 text-center text-blue-400 outline-none font-mono"
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
        <div className="relative flex-1 p-6 bg-transparent flex flex-col z-10">
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
                <div className="bg-black/60 backdrop-blur-xl px-4 py-1.5 rounded-full border border-white/10 text-[10px] font-bold flex items-center gap-2 uppercase">
                  You{" "}
                  {isHost && (
                    <span className="text-blue-400 text-[8px] ml-1 px-1 border border-blue-400 rounded">
                      Host
                    </span>
                  )}
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

          <Controls
            roomId={roomId}
            isMicMuted={isMicMuted}
            isVideoOff={isVideoOff}
            onToggleMic={toggleMic}
            onToggleVideo={toggleVideo}
            onLeave={leaveCall}
          />
        </div>
      )}
    </div>
  );
};

export default VideoChat;
