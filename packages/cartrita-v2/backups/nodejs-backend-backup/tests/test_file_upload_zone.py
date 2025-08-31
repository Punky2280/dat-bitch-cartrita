import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { toast } from 'react-hot-toast';
import { FileUploadZone, type FileMetadata } from '../FileUploadZone';

// Mock toast
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock File constructor
class MockFile {
  constructor(public bits: any[], public name: string, public options: any = {}) {
    this.size = bits.reduce((total, bit) => total + (bit.length || 0), 0);
    this.type = options.type || 'text/plain';
  }
  
  name: string;
  size: number;
  type: string;
  lastModified = Date.now();
  arrayBuffer = vi.fn();
  slice = vi.fn();
  stream = vi.fn();
  text = vi.fn();
}

// @ts-ignore
global.File = MockFile;

describe('FileUploadZone', () => {
  const mockOnFilesAttached = vi.fn();
  const mockMessageId = 'test-message-id';

  const mockFileMetadata: FileMetadata = {
    id: 'file-1',
    filename: 'test.txt',
    contentType: 'text/plain',
    size: 1024,
    hash: 'abc123',
    url: 'https://example.com/test.txt',
    sessionId: 'session-1',
    messageId: mockMessageId,
    uploadedAt: new Date().toISOString(),
    scanStatus: 'clean'
  };

  const defaultProps = {
    messageId: mockMessageId,
    onFilesAttached: mockOnFilesAttached
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders upload zone with correct text', () => {
    render(<FileUploadZone {...defaultProps} />);
    
    expect(screen.getByText('Upload files')).toBeInTheDocument();
    expect(screen.getByText('Drag and drop files or click to browse')).toBeInTheDocument();
    expect(screen.getByText(/Max file size:/)).toBeInTheDocument();
    expect(screen.getByText(/Max files:/)).toBeInTheDocument();
  });

  it('shows disabled state when disabled prop is true', () => {
    render(<FileUploadZone {...defaultProps} disabled />);
    
    const dropzone = screen.getByText('Upload files').closest('div');
    expect(dropzone).toHaveClass('cursor-not-allowed', 'opacity-50');
  });

  it('handles file selection via input', async () => {
    const user = userEvent.setup();
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue([mockFileMetadata])
    });

    render(<FileUploadZone {...defaultProps} />);
    
    const fileInput = screen.getByRole('textbox', { hidden: true });
    const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    
    await act(async () => {
      await user.upload(fileInput, testFile);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/chat/upload', expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData)
      }));
    });

    await waitFor(() => {
      expect(mockOnFilesAttached).toHaveBeenCalledWith([mockFileMetadata]);
      expect(toast.success).toHaveBeenCalledWith('Successfully uploaded 1 file(s)');
    });
  });

  it('handles drag and drop', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue([mockFileMetadata])
    });

    render(<FileUploadZone {...defaultProps} />);
    
    const dropzone = screen.getByText('Upload files').closest('div')!;
    const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });

    // Simulate drag enter
    fireEvent.dragEnter(dropzone, {
      dataTransfer: {
        files: [testFile],
        types: ['Files']
      }
    });

    expect(screen.getByText('Drop files here')).toBeInTheDocument();

    // Simulate drop
    await act(async () => {
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [testFile],
          types: ['Files']
        }
      });
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  it('validates file size limits', async () => {
    const maxFileSize = 1024; // 1KB
    render(<FileUploadZone {...defaultProps} maxFileSize={maxFileSize} />);
    
    const fileInput = screen.getByRole('textbox', { hidden: true });
    const largeFile = new File(['x'.repeat(2048)], 'large.txt', { type: 'text/plain' });
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [largeFile] } });
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('is too large')
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('validates maximum file count', async () => {
    const maxFiles = 1;
    render(<FileUploadZone {...defaultProps} maxFiles={maxFiles} />);
    
    // First, add a completed file
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue([mockFileMetadata])
    });

    const fileInput = screen.getByRole('textbox', { hidden: true });
    const file1 = new File(['content1'], 'file1.txt', { type: 'text/plain' });
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file1] } });
    });

    await waitFor(() => {
      expect(screen.getByText('Attached Files (1)')).toBeInTheDocument();
    });

    // Try to add another file
    const file2 = new File(['content2'], 'file2.txt', { type: 'text/plain' });
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file2] } });
    });

    expect(toast.error).toHaveBeenCalledWith('Maximum 1 files allowed');
  });

  it('handles upload errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<FileUploadZone {...defaultProps} />);
    
    const fileInput = screen.getByRole('textbox', { hidden: true });
    const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [testFile] } });
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Network error')
      );
    });

    // Error state should be shown
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('shows upload progress', async () => {
    let progressCallback: Function;
    
    mockFetch.mockImplementationOnce(() => {
      return new Promise((resolve) => {
        // Simulate progress updates
        setTimeout(() => {
          if (progressCallback) {
            progressCallback({ lengthComputable: true, loaded: 50, total: 100 });
          }
        }, 100);
        
        setTimeout(() => {
          resolve({
            ok: true,
            json: vi.fn().mockResolvedValue([mockFileMetadata])
          });
        }, 200);
      });
    });

    render(<FileUploadZone {...defaultProps} />);
    
    const fileInput = screen.getByRole('textbox', { hidden: true });
    const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [testFile] } });
    });

    // Should show uploading state
    await waitFor(() => {
      expect(screen.getByText('Uploading (1)')).toBeInTheDocument();
    });

    // Wait for completion
    await waitFor(() => {
      expect(screen.getByText('Attached Files (1)')).toBeInTheDocument();
    });
  });

  it('allows cancelling uploads', async () => {
    const abortSpy = vi.fn();
    global.AbortController = vi.fn(() => ({
      abort: abortSpy,
      signal: {}
    })) as any;

    // Mock a slow upload
    mockFetch.mockImplementationOnce(() => new Promise(resolve => {
      setTimeout(() => resolve({
        ok: true,
        json: vi.fn().mockResolvedValue([mockFileMetadata])
      }), 1000);
    }));

    render(<FileUploadZone {...defaultProps} />);
    
    const fileInput = screen.getByRole('textbox', { hidden: true });
    const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [testFile] } });
    });

    // Wait for upload to start
    await waitFor(() => {
      expect(screen.getByText('Uploading (1)')).toBeInTheDocument();
    });

    // Cancel the upload
    const cancelButton = screen.getByRole('button', { name: /cancel|remove/i });
    fireEvent.click(cancelButton);

    // Should call abort and remove from uploading list
    await waitFor(() => {
      expect(abortSpy).toHaveBeenCalled();
      expect(screen.queryByText('Uploading (1)')).not.toBeInTheDocument();
    });
  });

  it('shows different file type icons', () => {
    const files: FileMetadata[] = [
      { ...mockFileMetadata, id: '1', filename: 'image.jpg', contentType: 'image/jpeg' },
      { ...mockFileMetadata, id: '2', filename: 'video.mp4', contentType: 'video/mp4' },
      { ...mockFileMetadata, id: '3', filename: 'audio.mp3', contentType: 'audio/mpeg' },
      { ...mockFileMetadata, id: '4', filename: 'document.pdf', contentType: 'application/pdf' },
    ];

    const { rerender } = render(<FileUploadZone {...defaultProps} />);

    files.forEach(file => {
      mockOnFilesAttached([file]);
      rerender(<FileUploadZone {...defaultProps} />);
      
      // Should render with the file attached
      expect(screen.getByText(file.filename)).toBeInTheDocument();
    });
  });

  it('allows removing completed files', async () => {
    const user = userEvent.setup();
    
    // Start with a completed file
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue([mockFileMetadata])
    });

    render(<FileUploadZone {...defaultProps} />);
    
    const fileInput = screen.getByRole('textbox', { hidden: true });
    const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    
    await act(async () => {
      await user.upload(fileInput, testFile);
    });

    await waitFor(() => {
      expect(screen.getByText('Attached Files (1)')).toBeInTheDocument();
    });

    // Remove the file
    const removeButton = screen.getByTitle('Remove');
    await user.click(removeButton);

    await waitFor(() => {
      expect(screen.queryByText('Attached Files (1)')).not.toBeInTheDocument();
      expect(mockOnFilesAttached).toHaveBeenLastCalledWith([]);
    });
  });

  it('shows security scan status', async () => {
    const infectedFile: FileMetadata = {
      ...mockFileMetadata,
      scanStatus: 'infected',
      scanResult: 'Virus detected'
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue([infectedFile])
    });

    render(<FileUploadZone {...defaultProps} />);
    
    const fileInput = screen.getByRole('textbox', { hidden: true });
    const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [testFile] } });
    });

    await waitFor(() => {
      expect(screen.getByText('Infected')).toBeInTheDocument();
    });
  });

  it('provides preview and download functionality', async () => {
    const user = userEvent.setup();
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue([mockFileMetadata])
    });

    render(<FileUploadZone {...defaultProps} />);
    
    const fileInput = screen.getByRole('textbox', { hidden: true });
    const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    
    await act(async () => {
      await user.upload(fileInput, testFile);
    });

    await waitFor(() => {
      expect(screen.getByTitle('Preview')).toBeInTheDocument();
      expect(screen.getByTitle('Download')).toBeInTheDocument();
    });

    // Test preview
    const previewButton = screen.getByTitle('Preview');
    await user.click(previewButton);
    
    expect(windowOpenSpy).toHaveBeenCalledWith(mockFileMetadata.url, '_blank');

    // Test download
    const downloadButton = screen.getByTitle('Download');
    
    // Mock createElement and click for download
    const mockLink = {
      href: '',
      download: '',
      click: vi.fn()
    };
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);

    await user.click(downloadButton);

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(mockLink.href).toBe(mockFileMetadata.url);
    expect(mockLink.download).toBe(mockFileMetadata.filename);
    expect(mockLink.click).toHaveBeenCalled();
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();

    // Cleanup
    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
    windowOpenSpy.mockRestore();
  });

  it('handles multiple files upload', async () => {
    const files = [
      new File(['content1'], 'file1.txt', { type: 'text/plain' }),
      new File(['content2'], 'file2.txt', { type: 'text/plain' })
    ];

    const fileMetadataArray = files.map((_, index) => ({
      ...mockFileMetadata,
      id: `file-${index + 1}`,
      filename: `file${index + 1}.txt`
    }));

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([fileMetadataArray[0]])
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([fileMetadataArray[1]])
      });

    render(<FileUploadZone {...defaultProps} />);
    
    const fileInput = screen.getByRole('textbox', { hidden: true });
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files } });
    });

    // Should show uploading for both files
    await waitFor(() => {
      expect(screen.getByText('Uploading (2)')).toBeInTheDocument();
    });

    // Wait for both to complete
    await waitFor(() => {
      expect(screen.getByText('Attached Files (2)')).toBeInTheDocument();
    });

    expect(mockOnFilesAttached).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ filename: 'file1.txt' }),
      expect.objectContaining({ filename: 'file2.txt' })
    ]));
  });
});