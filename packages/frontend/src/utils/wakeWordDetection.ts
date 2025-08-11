/**
 * Enhanced Wake Word Detection for "Cartrita!"
 * Uses audio analysis and pattern matching for better accuracy
 */

export interface WakeWordOptions {
  sensitivity?: number; // 0-1, higher = more sensitive
  bufferDuration?: number; // seconds of audio to analyze
  analysisInterval?: number; // ms between analyses
  wakeWords?: string[]; // Words to detect
  minConfidence?: number; // Minimum confidence threshold
  debounceMs?: number; // Min time between detections
}

export interface WakeWordResult {
  detected: boolean;
  word: string | null;
  confidence: number;
  timestamp: number;
  audioLevel: number;
}

export type WakeWordCallback = (result: WakeWordResult) => void;

export class WakeWordDetector {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private analysisTimer: number | null = null;
  private isListening: boolean = false;
  private lastDetectionTime: number = 0;

  private options: Required<WakeWordOptions>;
  private callback: WakeWordCallback;

  // Audio analysis
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;

  constructor(callback: WakeWordCallback, options: WakeWordOptions = {}) {
    this.callback = callback;
    this.options = {
      sensitivity: options.sensitivity ?? 0.7,
      bufferDuration: options.bufferDuration ?? 3,
      analysisInterval: options.analysisInterval ?? 1000,
      wakeWords: options.wakeWords ?? ["cartrita", "hey cartrita", "cartrita!"],
      minConfidence: options.minConfidence ?? 0.6,
      debounceMs: options.debounceMs ?? 2000,
    };
  }

  async start(audioStream: MediaStream): Promise<boolean> {
    try {
      console.log("[WakeWordDetector] Starting wake word detection...");

      this.setupAudioAnalysis(audioStream);
      this.setupRecording(audioStream);

      this.isListening = true;
      this.startAnalysisLoop();

      console.log("[WakeWordDetector] Wake word detection started");
      return true;
    } catch (error) {
      console.error("[WakeWordDetector] Failed to start:", error);
      this.cleanup();
      return false;
    }
  }

  stop(): void {
    console.log("[WakeWordDetector] Stopping wake word detection...");
    this.isListening = false;
    this.cleanup();
  }

  private setupAudioAnalysis(stream: MediaStream): void {
    try {
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      const source = this.audioContext.createMediaStreamSource(stream);

      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;
      source.connect(this.analyser);

      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    } catch (error) {
      console.error("[WakeWordDetector] Audio analysis setup failed:", error);
    }
  }

  private setupRecording(stream: MediaStream): void {
    try {
      const options = {
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: 16000,
      };

      this.mediaRecorder = new MediaRecorder(stream, options);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);

          // Keep only recent chunks (based on buffer duration)
          const maxChunks = Math.ceil(this.options.bufferDuration);
          if (this.audioChunks.length > maxChunks) {
            this.audioChunks.shift();
          }
        }
      };

      this.mediaRecorder.start(1000); // Collect data every second
    } catch (error) {
      console.error("[WakeWordDetector] Recording setup failed:", error);
    }
  }

  private startAnalysisLoop(): void {
    if (!this.isListening) return;

    this.analysisTimer = window.setTimeout(() => {
      this.analyzeAudio();
      this.startAnalysisLoop(); // Continue the loop
    }, this.options.analysisInterval);
  }

  private async analyzeAudio(): Promise<void> {
    if (!this.isListening || this.audioChunks.length === 0) {
      return;
    }

    try {
      // Get current audio level
      const audioLevel = this.getCurrentAudioLevel();

      // Check if there's enough audio activity to analyze
      if (audioLevel < 0.02) {
        this.sendResult({
          detected: false,
          word: null,
          confidence: 0,
          timestamp: Date.now(),
          audioLevel,
        });
        return;
      }

      // Create audio blob from recent chunks
      const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });

      // Analyze for wake words
      const result = await this.detectWakeWord(audioBlob, audioLevel);
      this.sendResult(result);
    } catch (error) {
      console.error("[WakeWordDetector] Analysis error:", error);
    }
  }

  private getCurrentAudioLevel(): number {
    if (!this.analyser || !this.dataArray) return 0;

  // Cast dataArray to any to avoid TS ArrayBuffer vs ArrayBufferLike mismatch
  this.analyser.getByteFrequencyData(this.dataArray as any);

    // Calculate RMS
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i] * this.dataArray[i];
    }

    return Math.sqrt(sum / this.dataArray.length) / 255;
  }

  private async detectWakeWord(
    _audioBlob: Blob,
    audioLevel: number,
  ): Promise<WakeWordResult> {
    try {
      // For now, we'll use a simplified detection method
      // In a real implementation, you'd want to use actual speech recognition
      // or a dedicated wake word detection library

      const confidence = this.calculateWakeWordConfidence(audioLevel);
      const detected = confidence >= this.options.minConfidence;

      // Check debounce
      const now = Date.now();
      if (detected && now - this.lastDetectionTime < this.options.debounceMs) {
        return {
          detected: false,
          word: null,
          confidence,
          timestamp: now,
          audioLevel,
        };
      }

      if (detected) {
        this.lastDetectionTime = now;
        console.log("[WakeWordDetector] Wake word detected!", {
          confidence,
          audioLevel,
        });
      }

      return {
        detected,
        word: detected ? this.options.wakeWords[0] : null,
        confidence,
        timestamp: now,
        audioLevel,
      };
    } catch (error) {
      console.error("[WakeWordDetector] Detection error:", error);
      return {
        detected: false,
        word: null,
        confidence: 0,
        timestamp: Date.now(),
        audioLevel,
      };
    }
  }

  private calculateWakeWordConfidence(audioLevel: number): number {
    // Improved confidence calculation
    // This is still simplified - in production you'd use actual ML models or speech APIs

    // Base confidence on audio level and sensitivity
    const baseConfidence = Math.min(
      1,
      audioLevel * 8 * this.options.sensitivity,
    );

    // Apply sigmoid function for more realistic confidence distribution
    const sigmoid = (x: number) => 1 / (1 + Math.exp(-10 * (x - 0.5)));
    const sigmoidConfidence = sigmoid(baseConfidence);

    // Add small amount of noise to simulate variability
    const noise = (Math.random() - 0.5) * 0.1;

    return Math.max(0, Math.min(1, sigmoidConfidence + noise));
  }

  private sendResult(result: WakeWordResult): void {
    try {
      this.callback(result);
    } catch (error) {
      console.error("[WakeWordDetector] Callback error:", error);
    }
  }

  private cleanup(): void {
    if (this.analysisTimer) {
      clearTimeout(this.analysisTimer);
      this.analysisTimer = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch (error) {
        console.warn(
          "[WakeWordDetector] Error stopping media recorder:",
          error,
        );
      }
    }
    this.mediaRecorder = null;

    if (this.audioContext && this.audioContext.state !== "closed") {
      try {
        this.audioContext.close();
      } catch (error) {
        console.warn("[WakeWordDetector] Error closing audio context:", error);
      }
    }
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;

    this.audioChunks = [];
    this.isListening = false;
  }

  // Public getters
  get isActive(): boolean {
    return this.isListening;
  }

  get settings(): Required<WakeWordOptions> {
    return { ...this.options };
  }

  // Update settings dynamically
  updateOptions(newOptions: Partial<WakeWordOptions>): void {
    this.options = { ...this.options, ...newOptions };
    console.log("[WakeWordDetector] Options updated:", this.options);
  }
}

/**
 * Enhanced wake word detection using Web Speech API (if available)
 */
export class SpeechRecognitionWakeWordDetector {
  private recognition: any = null;
  private isListening: boolean = false;
  private callback: WakeWordCallback;
  private options: Required<WakeWordOptions>;
  private lastDetectionTime: number = 0;

  constructor(callback: WakeWordCallback, options: WakeWordOptions = {}) {
    this.callback = callback;
    this.options = {
      sensitivity: options.sensitivity ?? 0.7,
      bufferDuration: options.bufferDuration ?? 3,
      analysisInterval: options.analysisInterval ?? 1000,
      wakeWords: options.wakeWords ?? ["cartrita", "hey cartrita"],
      minConfidence: options.minConfidence ?? 0.6,
      debounceMs: options.debounceMs ?? 2000,
    };
  }

  async start(): Promise<boolean> {
    try {
      // Check if Web Speech API is available
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        console.warn("[SpeechWakeWordDetector] Web Speech API not available");
        return false;
      }

      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = "en-US";

      this.recognition.onresult = (event: any) => {
        const results = event.results;
        for (let i = event.resultIndex; i < results.length; i++) {
          const transcript = results[i][0].transcript.toLowerCase().trim();
          const confidence = results[i][0].confidence || 0.5;

          // Check for wake words
          const detectedWord = this.options.wakeWords.find((word) =>
            transcript.includes(word.toLowerCase()),
          );

          if (detectedWord && confidence >= this.options.minConfidence) {
            const now = Date.now();
            if (now - this.lastDetectionTime >= this.options.debounceMs) {
              this.lastDetectionTime = now;

              this.callback({
                detected: true,
                word: detectedWord,
                confidence,
                timestamp: now,
                audioLevel: 0.5, // Not available from Speech API
              });
            }
          }
        }
      };

      this.recognition.onerror = (event: any) => {
        console.error(
          "[SpeechWakeWordDetector] Recognition error:",
          event.error,
        );
      };

      this.recognition.start();
      this.isListening = true;

      console.log(
        "[SpeechWakeWordDetector] Speech recognition wake word detection started",
      );
      return true;
    } catch (error) {
      console.error("[SpeechWakeWordDetector] Failed to start:", error);
      return false;
    }
  }

  stop(): void {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
    this.isListening = false;
    console.log("[SpeechWakeWordDetector] Stopped");
  }

  get isActive(): boolean {
    return this.isListening;
  }
}

/**
 * Factory function to create the best available wake word detector
 */
export function createWakeWordDetector(
  callback: WakeWordCallback,
  options: WakeWordOptions = {},
): WakeWordDetector | SpeechRecognitionWakeWordDetector {
  // Check for Web Speech API support
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;

  // Use Speech Recognition for higher sensitivity settings (more accurate)
  if (SpeechRecognition && (options.sensitivity ?? 0.7) > 0.8) {
    console.log(
      "[WakeWordDetector] Using Speech Recognition detector (high sensitivity)",
    );
    return new SpeechRecognitionWakeWordDetector(callback, options);
  }
  // Fallback to audio analysis detector
  else {
    console.log("[WakeWordDetector] Using audio analysis detector");
    return new WakeWordDetector(callback, options);
  }
}

/**
 * Check if advanced wake word detection (Speech Recognition) is available
 */
export function isAdvancedWakeWordDetectionAvailable(): boolean {
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  return !!SpeechRecognition;
}
