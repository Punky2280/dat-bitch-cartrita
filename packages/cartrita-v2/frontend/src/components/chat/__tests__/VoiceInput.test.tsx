/**
 * Tests for VoiceInput component
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VoiceInput } from '../chat/VoiceInput';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock Web APIs
const mockMediaRecorder = {
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  ondataavailable: null,
  onstart: null,
  onstop: null,
  state: 'inactive'
};

const mockStream = {
  getTracks: vi.fn(() => [
    { stop: vi.fn() }
  ])
};

// Mock getUserMedia
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn(() => Promise.resolve(mockStream))
  }
});

// Mock WebSocket
class MockWebSocket {
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  readyState: number = WebSocket.OPEN;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => this.onopen?.(new Event('open')), 0);
  }

  send = vi.fn();
  close = vi.fn();

  // Helper method to simulate receiving messages
  simulateMessage(data: any) {
    const event = new MessageEvent('message', {
      data: JSON.stringify(data)
    });
    this.onmessage?.(event);
  }

  simulateClose(code = 1000) {
    const event = new CloseEvent('close', { code });
    this.onclose?.(event);
  }
}

global.WebSocket = MockWebSocket as any;
global.MediaRecorder = vi.fn(() => mockMediaRecorder) as any;

describe('VoiceInput Component', () => {
  const defaultProps = {
    messageId: 'test-message-id',
    sessionId: 'test-session-id',
    onTranscriptionUpdate: vi.fn(),
    onError: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMediaRecorder.state = 'inactive';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders voice input interface', () => {
    render(<VoiceInput {...defaultProps} />);
    
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('starts recording when mic button is clicked', async () => {
    render(<VoiceInput {...defaultProps} />);
    
    const micButton = screen.getByRole('button');
    fireEvent.click(micButton);

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        }
      });
    });
  });

  it('establishes WebSocket connection when recording starts', async () => {
    render(<VoiceInput {...defaultProps} />);
    
    const micButton = screen.getByRole('button');
    fireEvent.click(micButton);

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  it('displays interim transcription text', async () => {
    render(<VoiceInput {...defaultProps} />);
    
    // Start recording
    const micButton = screen.getByRole('button');
    fireEvent.click(micButton);

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    // Simulate receiving interim transcription
    const ws = new MockWebSocket('ws://test');
    ws.simulateMessage({
      type: 'interim',
      text: 'Hello world',
      seq: 1,
      is_final: false,
      latency_ms: 100
    });

    await waitFor(() => {
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    expect(defaultProps.onTranscriptionUpdate).toHaveBeenCalledWith('Hello world', false);
  });

  it('displays final transcription text', async () => {
    render(<VoiceInput {...defaultProps} />);
    
    // Start recording
    const micButton = screen.getByRole('button');
    fireEvent.click(micButton);

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    // Simulate receiving final transcription
    const ws = new MockWebSocket('ws://test');
    ws.simulateMessage({
      type: 'final',
      text: 'Final transcript',
      seq: 2,
      is_final: true,
      latency_ms: 120
    });

    await waitFor(() => {
      expect(screen.getByText('Final transcript')).toBeInTheDocument();
    });

    expect(defaultProps.onTranscriptionUpdate).toHaveBeenCalledWith('Final transcript', true);
  });

  it('handles pause and resume functionality', async () => {
    render(<VoiceInput {...defaultProps} />);
    
    // Start recording
    const micButton = screen.getByRole('button');
    fireEvent.click(micButton);

    mockMediaRecorder.state = 'recording';

    await waitFor(() => {
      expect(screen.getByText('Recording...')).toBeInTheDocument();
    });

    // Check pause button appears
    const pauseButton = screen.getAllByRole('button')[1];
    expect(pauseButton).toBeInTheDocument();

    // Click pause
    fireEvent.click(pauseButton);
    expect(mockMediaRecorder.pause).toHaveBeenCalled();
  });

  it('stops recording when stop button is clicked', async () => {
    render(<VoiceInput {...defaultProps} />);
    
    // Start recording
    const micButton = screen.getByRole('button');
    fireEvent.click(micButton);

    mockMediaRecorder.state = 'recording';

    await waitFor(() => {
      expect(screen.getByText('Recording...')).toBeInTheDocument();
    });

    // Click stop (same button)
    fireEvent.click(micButton);
    expect(mockMediaRecorder.stop).toHaveBeenCalled();
  });

  it('handles WebSocket connection errors', async () => {
    render(<VoiceInput {...defaultProps} />);
    
    // Start recording
    const micButton = screen.getByRole('button');
    fireEvent.click(micButton);

    // Simulate WebSocket error
    const ws = new MockWebSocket('ws://test');
    ws.onerror?.(new Event('error'));

    await waitFor(() => {
      expect(defaultProps.onError).toHaveBeenCalledWith('WebSocket connection error');
    });
  });

  it('handles microphone permission errors', async () => {
    // Mock getUserMedia to reject
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(
      new Error('Permission denied')
    );

    render(<VoiceInput {...defaultProps} />);
    
    const micButton = screen.getByRole('button');
    fireEvent.click(micButton);

    await waitFor(() => {
      expect(defaultProps.onError).toHaveBeenCalledWith(
        'Failed to start recording. Please check microphone permissions.'
      );
    });
  });

  it('cleans up resources on unmount', async () => {
    const { unmount } = render(<VoiceInput {...defaultProps} />);
    
    // Start recording
    const micButton = screen.getByRole('button');
    fireEvent.click(micButton);

    mockMediaRecorder.state = 'recording';

    // Unmount component
    unmount();

    expect(mockMediaRecorder.stop).toHaveBeenCalled();
  });

  it('handles WebSocket timeout closure', async () => {
    render(<VoiceInput {...defaultProps} />);
    
    const micButton = screen.getByRole('button');
    fireEvent.click(micButton);

    const ws = new MockWebSocket('ws://test');
    ws.simulateClose(4000); // Timeout code

    await waitFor(() => {
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });
  });

  it('accumulates multiple transcript segments', async () => {
    render(<VoiceInput {...defaultProps} />);
    
    const micButton = screen.getByRole('button');
    fireEvent.click(micButton);

    const ws = new MockWebSocket('ws://test');

    // Send first final segment
    ws.simulateMessage({
      type: 'final',
      text: 'Hello',
      seq: 1,
      is_final: true,
      latency_ms: 100
    });

    // Send second final segment
    ws.simulateMessage({
      type: 'final',
      text: 'world',
      seq: 2,
      is_final: true,
      latency_ms: 110
    });

    await waitFor(() => {
      expect(screen.getByText(/Hello.*world/)).toBeInTheDocument();
    });
  });
});