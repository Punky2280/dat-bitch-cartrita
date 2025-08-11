/**
 * Voice Activity Detection (VAD) utilities
 * Detects when someone is speaking vs silence/noise
 */

export interface VADOptions {
  silenceThreshold?: number; // Volume threshold for silence (0-1)
  speechThreshold?: number; // Volume threshold for speech (0-1)
  minSpeechDuration?: number; // Min ms of speech to trigger
  minSilenceDuration?: number; // Min ms of silence to trigger
  bufferSize?: number; // Audio buffer size for analysis
  smoothingFactor?: number; // Smoothing for volume calculations (0-1)
}

export interface VADResult {
  isSpeaking: boolean;
  volume: number;
  averageVolume: number;
  confidence: number; // 0-1 confidence in the detection
  timestamp: number;
}

export type VADCallback = (result: VADResult) => void;

export class VoiceActivityDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;
  private animationFrame: number | null = null;

  private options: Required<VADOptions>;
  private callback: VADCallback;

  // State tracking
  private volumeHistory: number[] = [];
  private speechStartTime: number | null = null;
  private silenceStartTime: number | null = null;
  private lastState: boolean = false; // false = silence, true = speech
  private runningAverage: number = 0;
  private isRunning: boolean = false;

  constructor(callback: VADCallback, options: VADOptions = {}) {
    this.callback = callback;
    this.options = {
      silenceThreshold: options.silenceThreshold ?? 0.01,
      speechThreshold: options.speechThreshold ?? 0.02,
      minSpeechDuration: options.minSpeechDuration ?? 200,
      minSilenceDuration: options.minSilenceDuration ?? 500,
      bufferSize: options.bufferSize ?? 256,
      smoothingFactor: options.smoothingFactor ?? 0.8,
    };
  }

  async start(stream: MediaStream): Promise<boolean> {
    try {
      console.log("[VAD] Starting voice activity detection...");

      // Create audio context and analyzer
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.source = this.audioContext.createMediaStreamSource(stream);

      // Configure analyzer
      this.analyser.fftSize = this.options.bufferSize * 2;
      this.analyser.smoothingTimeConstant = 0.3;
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -10;

      // Connect source to analyzer
      this.source.connect(this.analyser);

      // Initialize data array
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      // Reset state
      this.volumeHistory = [];
      this.speechStartTime = null;
      this.silenceStartTime = null;
      this.lastState = false;
      this.runningAverage = 0;
      this.isRunning = true;

      // Start analysis loop
      this.analyze();

      console.log("[VAD] Voice activity detection started");
      return true;
    } catch (error) {
      console.error("[VAD] Failed to start voice activity detection:", error);
      this.cleanup();
      return false;
    }
  }

  stop(): void {
    console.log("[VAD] Stopping voice activity detection...");
    this.isRunning = false;
    this.cleanup();
  }

  private cleanup(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.dataArray = null;
  }

  private analyze = (): void => {
    if (!this.isRunning || !this.analyser || !this.dataArray) {
      return;
    }

    // Get frequency data
  // TypeScript sometimes narrows underlying buffer to ArrayBufferLike (e.g., SharedArrayBuffer in some envs)
  // Cast to any for Web Audio API compatibility
  this.analyser.getByteFrequencyData(this.dataArray as any);

    // Calculate current volume (RMS of frequency data)
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i] * this.dataArray[i];
    }
    const rms = Math.sqrt(sum / this.dataArray.length) / 255; // Normalize to 0-1

    // Update running average with smoothing
    this.runningAverage =
      this.runningAverage * this.options.smoothingFactor +
      rms * (1 - this.options.smoothingFactor);

    // Store volume history for trend analysis
    this.volumeHistory.push(rms);
    if (this.volumeHistory.length > 10) {
      this.volumeHistory.shift();
    }

    // Determine current speech state
    const now = Date.now();
    const currentlySpeaking = this.detectSpeech(rms, this.runningAverage);

    // Check for state transitions with duration requirements
    let finalState = this.lastState;
    let confidence = 0.5;

    if (currentlySpeaking && !this.lastState) {
      // Potential start of speech
      if (this.speechStartTime === null) {
        this.speechStartTime = now;
      } else if (now - this.speechStartTime >= this.options.minSpeechDuration) {
        finalState = true;
        confidence = this.calculateConfidence(rms, true);
        this.silenceStartTime = null;
      }
    } else if (!currentlySpeaking && this.lastState) {
      // Potential start of silence
      if (this.silenceStartTime === null) {
        this.silenceStartTime = now;
      } else if (
        now - this.silenceStartTime >=
        this.options.minSilenceDuration
      ) {
        finalState = false;
        confidence = this.calculateConfidence(rms, false);
        this.speechStartTime = null;
      }
    } else if (currentlySpeaking && this.lastState) {
      // Continuing speech
      confidence = this.calculateConfidence(rms, true);
      this.silenceStartTime = null;
    } else if (!currentlySpeaking && !this.lastState) {
      // Continuing silence
      confidence = this.calculateConfidence(rms, false);
      this.speechStartTime = null;
    }

    // Update last state
    this.lastState = finalState;

    // Create result
    const result: VADResult = {
      isSpeaking: finalState,
      volume: rms,
      averageVolume: this.runningAverage,
      confidence,
      timestamp: now,
    };

    // Call callback
    this.callback(result);

    // Schedule next analysis
    this.animationFrame = requestAnimationFrame(this.analyze);
  };

  private detectSpeech(currentVolume: number, avgVolume: number): boolean {
    // Use dynamic thresholds based on average volume
    const dynamicSilenceThreshold = Math.max(
      this.options.silenceThreshold,
      avgVolume * 0.5,
    );

    const dynamicSpeechThreshold = Math.max(
      this.options.speechThreshold,
      avgVolume * 1.5,
    );

    // Check if current volume indicates speech
    return (
      currentVolume > dynamicSpeechThreshold &&
      currentVolume > dynamicSilenceThreshold
    );
  }

  private calculateConfidence(
    currentVolume: number,
    isSpeaking: boolean,
  ): number {
    const avgVolume = this.runningAverage;

    if (isSpeaking) {
      // Confidence based on how much above the threshold we are
      const ratio =
        currentVolume / Math.max(this.options.speechThreshold, avgVolume * 1.5);
      return Math.min(1, Math.max(0.5, ratio - 0.5));
    } else {
      // Confidence based on how much below the threshold we are
      const ratio =
        this.options.silenceThreshold / Math.max(0.001, currentVolume);
      return Math.min(1, Math.max(0.5, ratio - 0.5));
    }
  }

  // Public getters for current state
  get isActive(): boolean {
    return this.isRunning;
  }

  get currentVolume(): number {
    return this.volumeHistory[this.volumeHistory.length - 1] || 0;
  }

  get averageVolume(): number {
    return this.runningAverage;
  }

  // Update options dynamically
  updateOptions(newOptions: Partial<VADOptions>): void {
    this.options = { ...this.options, ...newOptions };
    console.log("[VAD] Options updated:", this.options);
  }
}

/**
 * Simple VAD function for one-time analysis
 */
export async function analyzeAudioForSpeech(
  audioBlob: Blob,
  options: VADOptions = {},
): Promise<{ hasSpeech: boolean; confidence: number; volume: number }> {
  try {
    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const channelData = audioBuffer.getChannelData(0);

    // Calculate RMS volume
    let sum = 0;
    for (let i = 0; i < channelData.length; i++) {
      sum += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sum / channelData.length);

    // Calculate peak volume
    let peak = 0;
    for (let i = 0; i < channelData.length; i++) {
      peak = Math.max(peak, Math.abs(channelData[i]));
    }

    const speechThreshold = options.speechThreshold || 0.02;
    const hasSpeech = rms > speechThreshold || peak > speechThreshold * 2;

    const confidence = hasSpeech
      ? Math.min(1, rms / speechThreshold)
      : Math.max(0, 1 - rms / speechThreshold);

    await audioContext.close();

    return {
      hasSpeech,
      confidence,
      volume: rms,
    };
  } catch (error) {
    console.error("[VAD] Audio analysis failed:", error);
    return {
      hasSpeech: false,
      confidence: 0,
      volume: 0,
    };
  }
}
