import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { API_BASE_URL } from "../../api/client";
import { Check, Phone, X } from "../../components/UI/icons";
import { useI18n } from "../../i18n";
import { useAppStore } from "../../store/useAppStore";
import { SosCallContext } from "./SosCallContext";
import styles from "./SosCallPanel.module.css";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function buildSocketUrl(token) {
  const url = new URL(API_BASE_URL, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/sos/calls/ws`;
  url.searchParams.set("token", token);
  return url.toString();
}

function createCallId(incidentId) {
  return `${Date.now()}-${incidentId}-${Math.random().toString(16).slice(2)}`;
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return atob(padded);
}

function isJwtExpired(token) {
  try {
    const [, payload] = token.split(".");
    const data = JSON.parse(decodeBase64Url(payload || ""));
    return Number(data.exp || 0) > 0 && Date.now() >= Number(data.exp) * 1000;
  } catch {
    return false;
  }
}

function getIncidentLabel(incident, t) {
  if (!incident) return t("sosCall.request");

  const ticket = incident.ticket || `SOS-AST-${String(incident.id).padStart(4, "0")}`;
  const place = incident.road || incident.district || "Astana";
  return `${ticket} · ${place}`;
}

function isCallBusy(state) {
  return ["incoming", "ringing", "connecting", "active"].includes(state);
}

function formatCallDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
}

function getInitials(value) {
  const parts = String(value || "SOS")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "SOS";
}

export function SosCallProvider({ children, enabled }) {
  const { t } = useI18n();
  const currentUser = useAppStore((state) => state.currentUser);
  const [socketState, setSocketState] = useState("offline");
  const [callState, setCallState] = useState("idle");
  const [activeCall, setActiveCall] = useState(null);
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);

  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const queuedCandidatesRef = useRef([]);
  const activeCallRef = useRef(activeCall);
  const callStateRef = useRef(callState);
  const handlerRef = useRef(null);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStreamRef.current;
    }
  }, [remoteReady]);

  const sendMessage = useCallback((message) => {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError("Voice signaling is offline. Keep both users on the site.");
      setSocketState("offline");
      return false;
    }

    socket.send(JSON.stringify(message));
    return true;
  }, []);

  const closePeerResources = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.onicecandidate = null;
      peerRef.current.ontrack = null;
      peerRef.current.onconnectionstatechange = null;
      peerRef.current.close();
      peerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    remoteStreamRef.current = null;
    queuedCandidatesRef.current = [];

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  }, []);

  const resetPeer = useCallback(() => {
    closePeerResources();
    setRemoteReady(false);
    setMuted(false);
  }, [closePeerResources]);

  const clearCall = useCallback(
    (nextState = "idle") => {
      resetPeer();
      setActiveCall(null);
      setCallState(nextState);
    },
    [resetPeer],
  );

  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone is not supported by this browser.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    localStreamRef.current = stream;
    return stream;
  }, []);

  const flushQueuedCandidates = useCallback(async () => {
    const peer = peerRef.current;
    if (!peer || !peer.remoteDescription) return;

    const candidates = queuedCandidatesRef.current;
    queuedCandidatesRef.current = [];

    for (const candidate of candidates) {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }, []);

  const preparePeerConnection = useCallback(
    async (callId) => {
      if (peerRef.current) {
        return peerRef.current;
      }

      const stream = await ensureLocalStream();
      const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });

      peer.onicecandidate = (event) => {
        if (!event.candidate) return;

        sendMessage({
          type: "ice-candidate",
          callId,
          candidate: event.candidate.toJSON(),
        });
      };

      peer.ontrack = (event) => {
        const [streamFromPeer] = event.streams;
        remoteStreamRef.current =
          streamFromPeer || new MediaStream([event.track]);
        setRemoteReady(true);
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") {
          setCallState("active");
          setError("");
        }

        if (["failed", "closed"].includes(peer.connectionState)) {
          setError("Voice channel was closed.");
          clearCall("error");
        }
      };

      peerRef.current = peer;
      return peer;
    },
    [clearCall, ensureLocalStream, sendMessage],
  );

  const startDispatcherCall = useCallback(
    (incident) => {
      if (!incident?.id) return false;

      if (socketState !== "online") {
        setError("Voice signaling is not connected yet.");
        return false;
      }

      if (isCallBusy(callStateRef.current)) {
        setError("Finish the current call before starting a new one.");
        return false;
      }

      const callId = createCallId(incident.id);
      const call = {
        callId,
        incidentId: incident.id,
        incident,
        direction: "outgoing",
      };

      setError("");
      setActiveCall(call);
      setCallState("ringing");

      return sendMessage({
        type: "call-driver",
        callId,
        incidentId: incident.id,
      });
    },
    [sendMessage, socketState],
  );

  const acceptCall = useCallback(async () => {
    const call = activeCallRef.current;
    if (!call?.callId) return;

    try {
      setError("");
      setCallState("connecting");
      await preparePeerConnection(call.callId);
      sendMessage({
        type: "call-accepted",
        callId: call.callId,
        incidentId: call.incidentId,
      });
    } catch (requestError) {
      setError(requestError.message || "Microphone access was blocked.");
      setCallState("incoming");
    }
  }, [preparePeerConnection, sendMessage]);

  const declineCall = useCallback(() => {
    const call = activeCallRef.current;

    if (call?.callId) {
      sendMessage({
        type: "call-declined",
        callId: call.callId,
        incidentId: call.incidentId,
      });
    }

    clearCall("idle");
  }, [clearCall, sendMessage]);

  const endCall = useCallback(() => {
    const call = activeCallRef.current;

    if (call?.callId) {
      sendMessage({
        type: "call-ended",
        callId: call.callId,
        incidentId: call.incidentId,
      });
    }

    clearCall("idle");
  }, [clearCall, sendMessage]);

  const closeError = useCallback(() => {
    setError("");
    if (callStateRef.current === "error") {
      clearCall("idle");
    }
  }, [clearCall]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const nextMuted = !muted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setMuted(nextMuted);
  }, [muted]);

  const handleSignalingMessage = useCallback(
    async (message) => {
      const messageType = message.type;
      const callId = message.callId;

      if (messageType === "incoming-call") {
        if (isCallBusy(callStateRef.current)) {
          sendMessage({
            type: "call-declined",
            callId,
            incidentId: message.incidentId,
            reason: "busy",
          });
          return;
        }

        setError("");
        setActiveCall({
          callId,
          incidentId: message.incidentId,
          incident: message.incident,
          from: message.from,
          direction: "incoming",
        });
        setCallState("incoming");
        return;
      }

      if (messageType === "call-ringing") {
        setCallState("ringing");
        return;
      }

      if (messageType === "call-unavailable" || messageType === "call-error") {
        setError(
          messageType === "call-unavailable"
            ? t("sosCall.driverOffline")
            : message.message || t("sosCall.unavailableSubtitle"),
        );
        clearCall("error");
        return;
      }

      if (messageType === "call-declined") {
        setError(t("sosCall.callDeclined"));
        clearCall("error");
        return;
      }

      if (messageType === "call-ended") {
        clearCall("idle");
        return;
      }

      if (!callId) return;

      if (messageType === "call-accepted") {
        try {
          setCallState("connecting");
          const peer = await preparePeerConnection(callId);
          const offer = await peer.createOffer({
            offerToReceiveAudio: true,
          });
          await peer.setLocalDescription(offer);
          sendMessage({
            type: "webrtc-offer",
            callId,
            offer,
          });
        } catch (requestError) {
          setError(requestError.message || t("sosCall.micStartError"));
          clearCall("error");
        }
        return;
      }

      if (messageType === "webrtc-offer") {
        try {
          setCallState("connecting");
          const peer = await preparePeerConnection(callId);
          await peer.setRemoteDescription(
            new RTCSessionDescription(message.offer),
          );
          await flushQueuedCandidates();
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          sendMessage({
            type: "webrtc-answer",
            callId,
            answer,
          });
        } catch (requestError) {
          setError(requestError.message || t("sosCall.callAcceptError"));
          clearCall("error");
        }
        return;
      }

      if (messageType === "webrtc-answer") {
        const peer = peerRef.current;
        if (!peer) return;

        await peer.setRemoteDescription(
          new RTCSessionDescription(message.answer),
        );
        await flushQueuedCandidates();
        setCallState("active");
        return;
      }

      if (messageType === "ice-candidate" && message.candidate) {
        const peer = peerRef.current;

        if (!peer || !peer.remoteDescription) {
          queuedCandidatesRef.current.push(message.candidate);
          return;
        }

        await peer.addIceCandidate(new RTCIceCandidate(message.candidate));
      }
    },
    [
      clearCall,
      flushQueuedCandidates,
      preparePeerConnection,
      sendMessage,
      t,
    ],
  );

  useEffect(() => {
    handlerRef.current = handleSignalingMessage;
  }, [handleSignalingMessage]);

  useEffect(() => {
    return () => {
      closePeerResources();
    };
  }, [closePeerResources]);

  useEffect(() => {
    if (!enabled || !currentUser) {
      return undefined;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      return undefined;
    }

    if (isJwtExpired(token)) {
      window.dispatchEvent(new Event("astanasafe-auth-expired"));
      return undefined;
    }

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;

      setSocketState("connecting");
      const socket = new WebSocket(buildSocketUrl(token));
      socketRef.current = socket;

      socket.onopen = () => {
        setSocketState("online");
        setError("");
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handlerRef.current?.(message);
        } catch {
          setError(t("sosCall.invalidSignal"));
        }
      };

      socket.onclose = () => {
        if (socketRef.current === socket) {
          socketRef.current = null;
        }

        setSocketState("offline");

        if (!cancelled) {
          reconnectTimerRef.current = window.setTimeout(connect, 2500);
        }
      };

      socket.onerror = () => {
        setSocketState("offline");
      };
    };

    connect();

    return () => {
      cancelled = true;

      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }

      closePeerResources();
    };
  }, [closePeerResources, currentUser, enabled, t]);

  const value = useMemo(
    () => ({
      socketState,
      callState,
      activeCall,
      error,
      startDispatcherCall,
      acceptCall,
      declineCall,
      endCall,
      closeError,
      toggleMute,
      muted,
    }),
    [
      acceptCall,
      activeCall,
      callState,
      closeError,
      declineCall,
      endCall,
      error,
      muted,
      socketState,
      startDispatcherCall,
      toggleMute,
    ],
  );

  return (
    <SosCallContext.Provider value={value}>
      {children}

      {enabled ? (
        <SosCallPanel
          key={`${callState}-${activeCall?.callId || "none"}`}
          activeCall={activeCall}
          callState={callState}
          closeError={closeError}
          error={error}
          muted={muted}
          onAccept={acceptCall}
          onDecline={declineCall}
          onEnd={endCall}
          onMute={toggleMute}
          remoteAudioRef={remoteAudioRef}
          remoteReady={remoteReady}
          socketState={socketState}
          userRole={currentUser?.role}
        />
      ) : null}
    </SosCallContext.Provider>
  );
}

function SosCallPanel({
  activeCall,
  callState,
  closeError,
  error,
  muted,
  onAccept,
  onDecline,
  onEnd,
  onMute,
  remoteAudioRef,
  remoteReady,
  socketState,
  userRole,
}) {
  const { t } = useI18n();
  const isIncoming = callState === "incoming";
  const isActive = callState === "active";
  const isConnecting = callState === "connecting";
  const isRinging = callState === "ringing";
  const isError = callState === "error" || !!error;
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isActive]);

  const shouldShow =
    callState !== "idle" || !!error || socketState === "connecting";

  if (!shouldShow) {
    return <audio ref={remoteAudioRef} autoPlay playsInline />;
  }

  const incidentLabel = getIncidentLabel(activeCall?.incident, t);
  const callerName =
    activeCall?.from?.name ||
    (userRole === "dispatcher" || userRole === "admin"
      ? t("sosCall.driver")
      : t("sosCall.dispatcher"));
  const modeLabel =
    userRole === "dispatcher" || userRole === "admin"
      ? t("sosCall.dispatcherVoiceLine")
      : t("sosCall.driverEmergencyLine");

  let title = t("sosCall.channelTitle");
  let subtitle = t("sosCall.channelSubtitle");
  let statusLabel = t("sosCall.standby");

  if (socketState === "connecting") {
    title = t("sosCall.connectingTitle");
    subtitle = t("sosCall.connectingSubtitle");
    statusLabel = t("sosCall.network");
  }

  if (isIncoming) {
    title = callerName;
    subtitle = t("sosCall.incomingSubtitle", { incident: incidentLabel });
    statusLabel = t("sosCall.incomingCall");
  } else if (isRinging) {
    title = t("sosCall.callingDriver");
    subtitle = incidentLabel;
    statusLabel = t("sosCall.ringing");
  } else if (isConnecting) {
    title = t("sosCall.connectingCall");
    subtitle = t("sosCall.allowMicrophone");
    statusLabel = t("sosCall.openingAudio");
  } else if (isActive) {
    title = callerName;
    subtitle = remoteReady
      ? incidentLabel
      : t("sosCall.waitingRemoteAudio", { incident: incidentLabel });
    statusLabel = formatCallDuration(elapsedSeconds);
  } else if (isError) {
    title = t("sosCall.unavailableTitle");
    subtitle = error || t("sosCall.unavailableSubtitle");
    statusLabel = t("sosCall.offline");
  }

  return (
    <div className={styles.overlay} data-state={callState}>
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className={styles.phoneFrame}>
        <div className={styles.statusBar}>
          <span>AstanaSafe</span>
          <span>{modeLabel}</span>
        </div>

        <div className={styles.callScreen}>
          <div className={styles.callMeta}>{statusLabel}</div>

          <div className={styles.avatarWrap}>
            <div className={styles.avatarRing} />
            <div className={styles.avatar}>
              {isActive ? <Phone size={38} /> : getInitials(title)}
            </div>
          </div>

          <div className={styles.title}>{title}</div>
          <div className={styles.subtitle}>{subtitle}</div>

          {isRinging || isConnecting ? (
            <div className={styles.waveRow} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
          ) : null}

          <div className={styles.actions}>
            {isIncoming ? (
              <>
                <button
                  type="button"
                  className={[styles.roundButton, styles.declineButton]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={onDecline}
                  title={t("sosCall.declineCall")}
                >
                  <X size={23} />
                  <span>{t("sosCall.decline")}</span>
                </button>
                <button
                  type="button"
                  className={[styles.roundButton, styles.acceptButton]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={onAccept}
                  title={t("sosCall.acceptCall")}
                >
                  <Check size={25} />
                  <span>{t("sosCall.accept")}</span>
                </button>
              </>
            ) : null}

            {isActive ? (
              <>
                <button
                  type="button"
                  className={[styles.roundButton, styles.secondaryButton]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={onMute}
                  title={muted ? t("sosCall.turnMicOn") : t("sosCall.muteMic")}
                >
                  <span className={styles.buttonGlyph}>{muted ? "M-" : "M"}</span>
                  <span>{muted ? t("sosCall.micOff") : t("sosCall.mute")}</span>
                </button>
                <button
                  type="button"
                  className={[styles.roundButton, styles.declineButton]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={onEnd}
                  title={t("sosCall.endCall")}
                >
                  <X size={23} />
                  <span>{t("sosCall.end")}</span>
                </button>
              </>
            ) : null}

            {isRinging || isConnecting ? (
              <button
                type="button"
                className={[styles.roundButton, styles.declineButton]
                  .filter(Boolean)
                  .join(" ")}
                onClick={onEnd}
                title={t("sosCall.cancelCall")}
              >
                <X size={23} />
                <span>{t("sosCall.cancel")}</span>
              </button>
            ) : null}

            {isError ? (
              <button
                type="button"
                className={[styles.roundButton, styles.secondaryButton]
                  .filter(Boolean)
                  .join(" ")}
                onClick={closeError}
                title={t("common.close")}
              >
                <X size={22} />
                <span>{t("common.close")}</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
