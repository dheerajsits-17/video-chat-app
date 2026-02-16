import { useState, useRef, useEffect } from "react";
import { db } from "../firebase/config";
import {
  collection, doc, setDoc, onSnapshot, updateDoc,
  addDoc, deleteDoc, getDoc, query, orderBy
} from "firebase/firestore";

const servers = {
  iceServers: [{ urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] }],
  iceCandidatePoolSize: 10,
};

export const useWebRTC = (myUserId, showNotification) => {
  const [roomId, setRoomId] = useState("");
  const [isCalling, setIsCalling] = useState(false);
  const [stream, setStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [participantsInfo, setParticipantsInfo] = useState({});
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [joinRequests, setJoinRequests] = useState([]);
  const [isDenied, setIsDenied] = useState(false);
  const pcs = useRef({});

  const updateMediaStatus = async (mic, cam, rId) => {
    if (!rId) return;
    const userDoc = doc(db, "calls", rId, "participants", myUserId);
    await updateDoc(userDoc, { isMicMuted: mic, isVideoOff: cam });
  };

  const createPeer = (peerId, callDoc, localStream) => {
    const pc = new RTCPeerConnection(servers);
    pcs.current[peerId] = pc;
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    pc.ontrack = (e) => setRemoteStreams((prev) => ({ ...prev, [peerId]: e.streams[0] }));
    const iceCol = collection(callDoc, "participants", myUserId, "peers", peerId, "ice");
    pc.onicecandidate = (e) => { if (e.candidate) addDoc(iceCol, e.candidate.toJSON()); };
    onSnapshot(collection(callDoc, "participants", peerId, "peers", myUserId, "ice"), (snap) => {
      snap.docChanges().forEach(async (change) => {
        if (change.type === "added" && pc.remoteDescription) {
          try { await pc.addIceCandidate(new RTCIceCandidate(change.doc.data())); } catch (e) { console.error(e); }
        }
      });
    });
    return pc;
  };

  const handleSignaling = (peerId, callDoc, localStream, isOfferer) => {
    const pc = createPeer(peerId, callDoc, localStream);
    const peerDoc = doc(callDoc, "participants", isOfferer ? myUserId : peerId, "peers", isOfferer ? peerId : myUserId);
    if (isOfferer) {
      pc.onnegotiationneeded = async () => {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await setDoc(peerDoc, { offer: { sdp: offer.sdp, type: offer.type } }, { merge: true });
      };
    }
    onSnapshot(peerDoc, async (snap) => {
      const data = snap.data();
      if (!data) return;
      if (!isOfferer && data.offer && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await updateDoc(peerDoc, { answer: { sdp: answer.sdp, type: answer.type } });
      } else if (isOfferer && data.answer && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });
  };

  const proceed = async (rId, hostStatus, isPrivate) => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(s);
      setIsCalling(true);
      setIsHost(hostStatus);
      setRoomId(rId);
      const callDoc = doc(db, "calls", rId);
      
      if (hostStatus) {
        await setDoc(callDoc, { active: true, hostId: myUserId, createdAt: new Date(), isPrivate: isPrivate }, { merge: true });
        onSnapshot(collection(db, "calls", rId, "requests"), (s) => {
          setJoinRequests(s.docs.map((d) => d.data()).filter((r) => r.status === "waiting"));
        });
      }

      await setDoc(doc(callDoc, "participants", myUserId), { joined: true, isMicMuted: false, isVideoOff: false, isHost: hostStatus });

      onSnapshot(callDoc, (snap) => {
        if (snap.exists() && snap.data().active === false && !hostStatus) {
          showNotification("Meeting ended by Host.", "error");
          setTimeout(() => window.location.reload(), 2000);
        }
      });

      onSnapshot(collection(callDoc, "participants"), (snap) => {
        snap.docChanges().forEach((change) => {
          const pId = change.doc.id;
          if (change.type === "removed") {
            if (pcs.current[pId]) { pcs.current[pId].close(); delete pcs.current[pId]; }
            setRemoteStreams((prev) => { const n = { ...prev }; delete n[pId]; return n; });
            setParticipantsInfo((prev) => { const n = { ...prev }; delete n[pId]; return n; });
          } else if (pId !== myUserId) {
            setParticipantsInfo((prev) => ({ ...prev, [pId]: change.doc.data() }));
            if (change.type === "added" && !pcs.current[pId]) handleSignaling(pId, callDoc, s, myUserId > pId);
          }
        });
      });
    } catch (err) { showNotification("Camera/Mic access denied", "error"); }
  };

  return {
    roomId, setRoomId, isCalling, stream, remoteStreams, participantsInfo,
    isMicMuted, setIsMicMuted, isVideoOff, setIsVideoOff, isHost, setIsHost,
    isWaiting, setIsWaiting, joinRequests, isDenied, setIsDenied, proceed, updateMediaStatus
  };
};