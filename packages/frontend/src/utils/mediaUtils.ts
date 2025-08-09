// Utility functions for media device handling

export const checkMediaSupport = () => {
  const issues: string[] = [];

  // Check if running on HTTPS or localhost
  const isSecureContext =
    window.isSecureContext ||
    window.location.protocol === "https:" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (!isSecureContext) {
    issues.push("getUserMedia requires HTTPS or localhost");
  }

  // Check API availability
  if (!navigator.mediaDevices) {
    issues.push("navigator.mediaDevices not available");
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    issues.push("getUserMedia not available");
  }

  return {
    isSupported: issues.length === 0,
    issues,
    isSecureContext,
  };
};

export const getOptimalAudioConstraints = (): MediaTrackConstraints => {
  return {
    echoCancellation: true,
    noiseSuppression: false, // Less aggressive for better voice capture
    autoGainControl: true,
    sampleRate: { ideal: 44100, min: 16000 },
    channelCount: { ideal: 1 }, // Mono for better performance
  };
};

export const getOptimalVideoConstraints = (): MediaTrackConstraints => {
  return {
    width: { ideal: 1280, min: 640 },
    height: { ideal: 720, min: 480 },
    frameRate: { ideal: 15, min: 10 },
    facingMode: "user", // Front-facing camera
  };
};

export const getSupportedMimeType = (): string => {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/wav",
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return ""; // Use default
};

export const logMediaDeviceInfo = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    console.log("[MediaUtils] Available devices:");
    devices.forEach((device, index) => {
      console.log(
        `  ${index}: ${device.kind} - ${device.label || "Unnamed device"}`,
      );
    });
    return devices;
  } catch (error) {
    console.error("[MediaUtils] Could not enumerate devices:", error);
    return [];
  }
};
