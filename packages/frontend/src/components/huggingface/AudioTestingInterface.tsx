import React, { useState, useRef, useCallback } from 'react';
import {
  SpeakerWaveIcon,
  MicrophoneIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';
import { AudioVisualizer } from '../AudioVisualizer';

interface AudioTestResult {
  test_type: 'stt' | 'tts' | 'voice_swap' | 'audio_classification';
  success: boolean;
  result?: any;
  error?: string;
  latency_ms: number;
  quality_score: number;
  model_used: string;
  provider: string;
}

interface AudioTestingInterfaceProps {
  token: string;
  className?: string;
}

interface TestSettings {
  stt_model: string;
  tts_model: string;
  voice_swap_model: string;
  test_phrases: string[];
  quality_threshold: number;
  latency_threshold: number; // milliseconds
  enable_noise_test: boolean;
  enable_quality_analysis: boolean;
}

const DEFAULT_TEST_PHRASES = [
  "Hello, this is a test of the speech-to-text system.",
  "The quick brown fox jumps over the lazy dog.",
  "Testing multilingual capabilities: Hola, ¿cómo estás?",
  "Technical terms: API, neural network, machine learning.",
  "Numbers and dates: Today is January 15th, 2024, at 3:45 PM."
];

const AVAILABLE_MODELS = {
  stt: [
    { id: 'openai/whisper-large-v3', name: 'Whisper Large v3', quality: 'High' },
    { id: 'openai/whisper-medium', name: 'Whisper Medium', quality: 'Medium' },
    { id: 'facebook/wav2vec2-large-960h', name: 'Wav2Vec2 Large', quality: 'Medium' }
  ],
  tts: [
    { id: 'microsoft/speecht5_tts', name: 'SpeechT5 TTS', quality: 'High' },
    { id: 'facebook/fastspeech2-en-ljspeech', name: 'FastSpeech2', quality: 'Medium' }
  ]
};

export const AudioTestingInterface: React.FC<AudioTestingInterfaceProps> = ({
  token,
  className = ''
}) => {
  const [testResults, setTestResults] = useState<AudioTestResult[]>([]);
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string>('');

  // Test settings
  const [settings, setSettings] = useState<TestSettings>({
    stt_model: 'openai/whisper-large-v3',
    tts_model: 'microsoft/speecht5_tts',
    voice_swap_model: 'microsoft/speecht5_tts',
    test_phrases: DEFAULT_TEST_PHRASES,
    quality_threshold: 0.8,
    latency_threshold: 5000,
    enable_noise_test: true,
    enable_quality_analysis: true
  });

  // Audio recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Record audio for testing
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      streamRef.current = stream;
      audioChunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedAudio(audioBlob);
        
        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setError('Failed to start recording: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // Play audio
  const playAudio = useCallback((audioBlob: Blob, testId: string) => {
    if (playingAudio === testId) {
      audioRef.current?.pause();
      setPlayingAudio(null);
      return;
    }

    const url = URL.createObjectURL(audioBlob);
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.onended = () => {
        setPlayingAudio(null);
        URL.revokeObjectURL(url);
      };
      audioRef.current.play();
      setPlayingAudio(testId);
    }
  }, [playingAudio]);

  // Test Speech-to-Text
  const testSTT = useCallback(async (): Promise<AudioTestResult> => {
    if (!recordedAudio) throw new Error('No recorded audio available');

    const startTime = Date.now();
    const formData = new FormData();
    formData.append('audio', recordedAudio, 'test-audio.webm');
    formData.append('taskType', 'automatic-speech-recognition');
    formData.append('options', JSON.stringify({
      model: settings.stt_model,
      language: 'auto'
    }));

    const response = await fetch('/api/huggingface/audio', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`STT test failed: ${response.statusText}`);
    }

    const result = await response.json();
    const latency = Date.now() - startTime;

    return {
      test_type: 'stt',
      success: result.success,
      result: result.result,
      latency_ms: latency,
      quality_score: result.result?.confidence || 0,
      model_used: settings.stt_model,
      provider: 'huggingface'
    };
  }, [recordedAudio, settings.stt_model, token]);

  // Test Text-to-Speech
  const testTTS = useCallback(async (text: string): Promise<AudioTestResult> => {
    const startTime = Date.now();
    
    const response = await fetch('/api/huggingface/text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        taskType: 'text-to-speech',
        text,
        options: {
          model: settings.tts_model,
          voice_settings: {
            speed: 1.0,
            pitch: 1.0
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`TTS test failed: ${response.statusText}`);
    }

    const result = await response.json();
    const latency = Date.now() - startTime;

    // Calculate quality score based on latency and success
    const qualityScore = result.success ? 
      Math.max(0.5, 1.0 - (latency / 10000)) : 0; // Penalize high latency

    return {
      test_type: 'tts',
      success: result.success,
      result: result.result,
      latency_ms: latency,
      quality_score: qualityScore,
      model_used: settings.tts_model,
      provider: 'huggingface'
    };
  }, [settings.tts_model, token]);

  // Test Voice Swap (STT + TTS pipeline)
  const testVoiceSwap = useCallback(async (): Promise<AudioTestResult> => {
    if (!recordedAudio) throw new Error('No recorded audio available');

    const startTime = Date.now();
    const formData = new FormData();
    formData.append('audio', recordedAudio, 'test-audio.webm');
    formData.append('taskType', 'voice-swap');
    formData.append('options', JSON.stringify({
      stt_model: settings.stt_model,
      tts_model: settings.voice_swap_model,
      target_voice: 'default'
    }));

    const response = await fetch('/api/huggingface/audio', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Voice swap test failed: ${response.statusText}`);
    }

    const result = await response.json();
    const latency = Date.now() - startTime;

    return {
      test_type: 'voice_swap',
      success: result.success,
      result: result.result,
      latency_ms: latency,
      quality_score: result.result?.confidence || 0,
      model_used: `${settings.stt_model} + ${settings.voice_swap_model}`,
      provider: 'huggingface'
    };
  }, [recordedAudio, settings, token]);

  // Run comprehensive audio test suite
  const runFullTestSuite = useCallback(async () => {
    if (!recordedAudio) {
      setError('Please record audio first');
      return;
    }

    setIsRunningTest(true);
    setError('');
    const results: AudioTestResult[] = [];

    try {
      // Test 1: Speech-to-Text
      setCurrentTest('Testing Speech-to-Text...');
      const sttResult = await testSTT();
      results.push(sttResult);

      // Test 2: Text-to-Speech (using a test phrase)
      setCurrentTest('Testing Text-to-Speech...');
      const ttsResult = await testTTS(settings.test_phrases[0]);
      results.push(ttsResult);

      // Test 3: Voice Swap
      setCurrentTest('Testing Voice Conversion...');
      const voiceSwapResult = await testVoiceSwap();
      results.push(voiceSwapResult);

      // Test 4: Multiple TTS phrases for quality assessment
      if (settings.enable_quality_analysis) {
        for (let i = 1; i < Math.min(3, settings.test_phrases.length); i++) {
          setCurrentTest(`Testing TTS phrase ${i + 1}...`);
          const ttsTestResult = await testTTS(settings.test_phrases[i]);
          results.push({
            ...ttsTestResult,
            test_type: 'tts',
          });
        }
      }

      setTestResults(results);
      setCurrentTest('');

    } catch (error) {
      console.error('Test suite error:', error);
      setError(error instanceof Error ? error.message : 'Test suite failed');
    } finally {
      setIsRunningTest(false);
      setCurrentTest('');
    }
  }, [recordedAudio, settings, testSTT, testTTS, testVoiceSwap]);

  // Get overall test status
  const getOverallStatus = useCallback(() => {
    if (testResults.length === 0) return { status: 'pending', message: 'No tests run' };
    
    const passedTests = testResults.filter(r => 
      r.success && 
      r.quality_score >= settings.quality_threshold &&
      r.latency_ms <= settings.latency_threshold
    );
    
    const passRate = passedTests.length / testResults.length;
    
    if (passRate >= 0.8) return { status: 'excellent', message: 'All systems performing well' };
    if (passRate >= 0.6) return { status: 'good', message: 'Most systems working correctly' };
    if (passRate >= 0.4) return { status: 'fair', message: 'Some issues detected' };
    return { status: 'poor', message: 'Multiple systems need attention' };
  }, [testResults, settings]);

  const overallStatus = getOverallStatus();

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <SpeakerWaveIcon className="h-6 w-6 text-purple-600" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Audio System Testing
          </h2>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <AdjustmentsHorizontalIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center space-x-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* Overall Status */}
      {testResults.length > 0 && (
        <div className={`mb-6 p-4 rounded-lg border ${
          overallStatus.status === 'excellent' ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' :
          overallStatus.status === 'good' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' :
          overallStatus.status === 'fair' ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800' :
          'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircleIcon className={`h-6 w-6 ${
                overallStatus.status === 'excellent' ? 'text-green-600' :
                overallStatus.status === 'good' ? 'text-blue-600' :
                overallStatus.status === 'fair' ? 'text-yellow-600' :
                'text-red-600'
              }`} />
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">
                  System Status: {overallStatus.status.charAt(0).toUpperCase() + overallStatus.status.slice(1)}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {overallStatus.message}
                </p>
              </div>
            </div>
            <div className="text-right text-sm text-gray-600 dark:text-gray-400">
              <p>{testResults.filter(r => r.success).length}/{testResults.length} tests passed</p>
              <p>Avg latency: {Math.round(testResults.reduce((acc, r) => acc + r.latency_ms, 0) / testResults.length)}ms</p>
            </div>
          </div>
        </div>
      )}

      {/* Recording Section */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Audio Recording
        </h3>
        
        <div className="flex items-center space-x-4 mb-4">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isRunningTest}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              isRecording 
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400'
            }`}
          >
            {isRecording ? <StopIcon className="h-5 w-5" /> : <MicrophoneIcon className="h-5 w-5" />}
            <span>{isRecording ? 'Stop Recording' : 'Start Recording'}</span>
          </button>

          {recordedAudio && (
            <button
              onClick={() => playAudio(recordedAudio, 'recorded')}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              {playingAudio === 'recorded' ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
              <span>Play Recording</span>
            </button>
          )}
        </div>

        {/* Audio Visualizer */}
        {isRecording && streamRef.current && (
          <div className="mb-4">
            <AudioVisualizer
              isRecording={isRecording}
              audioStream={streamRef.current}
              width={400}
              height={60}
              barColor="#3b82f6"
              backgroundColor="rgba(0, 0, 0, 0.1)"
            />
          </div>
        )}

        {recordedAudio && (
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              ✅ Audio recorded ({(recordedAudio.size / 1024).toFixed(1)} KB)
            </p>
          </div>
        )}
      </div>

      {/* Test Actions */}
      <div className="mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={runFullTestSuite}
            disabled={!recordedAudio || isRunningTest}
            className="flex items-center space-x-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {isRunningTest ? (
              <>
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                <span>Running Tests...</span>
              </>
            ) : (
              <>
                <ArrowPathIcon className="h-5 w-5" />
                <span>Run Full Test Suite</span>
              </>
            )}
          </button>

          {isRunningTest && currentTest && (
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="animate-spin h-4 w-4 border-2 border-purple-600 border-t-transparent rounded-full" />
              <span>{currentTest}</span>
            </div>
          )}
        </div>

        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Record audio first, then run the test suite to validate STT, TTS, and voice conversion capabilities.
        </p>
      </div>

      {/* Test Results */}
      {testResults.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Test Results
          </h3>
          
          <div className="space-y-4">
            {testResults.map((result, index) => (
              <div
                key={index}
                className={`p-4 border rounded-lg ${
                  result.success && result.quality_score >= settings.quality_threshold && result.latency_ms <= settings.latency_threshold
                    ? 'border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800'
                    : 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    {result.success ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                    ) : (
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                    )}
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {result.test_type.toUpperCase().replace('_', ' ')} Test
                    </h4>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                    <span>Quality: {(result.quality_score * 100).toFixed(0)}%</span>
                    <span>Latency: {result.latency_ms}ms</span>
                  </div>
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <p>Model: {result.model_used}</p>
                  <p>Provider: {result.provider}</p>
                  {result.error && (
                    <p className="text-red-600 dark:text-red-400">Error: {result.error}</p>
                  )}
                  {result.result && result.test_type === 'stt' && (
                    <p>Transcript: "{result.result.transcript || result.result.text}"</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h3 className="font-medium text-gray-900 dark:text-white mb-4">Test Settings</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                STT Model
              </label>
              <select
                value={settings.stt_model}
                onChange={(e) => setSettings(prev => ({ ...prev, stt_model: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {AVAILABLE_MODELS.stt.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name} ({model.quality})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                TTS Model
              </label>
              <select
                value={settings.tts_model}
                onChange={(e) => setSettings(prev => ({ ...prev, tts_model: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {AVAILABLE_MODELS.tts.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name} ({model.quality})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Quality Threshold
              </label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={settings.quality_threshold}
                onChange={(e) => setSettings(prev => ({ ...prev, quality_threshold: parseFloat(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Latency Threshold (ms)
              </label>
              <input
                type="number"
                min="1000"
                max="30000"
                step="500"
                value={settings.latency_threshold}
                onChange={(e) => setSettings(prev => ({ ...prev, latency_threshold: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={settings.enable_quality_analysis}
                onChange={(e) => setSettings(prev => ({ ...prev, enable_quality_analysis: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Enable comprehensive quality analysis</span>
            </label>
          </div>
        </div>
      )}

      {/* Hidden audio element for playback */}
      <audio ref={audioRef} className="hidden" />
    </div>
  );
};