'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  X, 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Music, 
  File,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Trash2,
  Eye,
  Download
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-hot-toast';

// Types
interface FileUploadZoneProps {
  messageId: string;
  onFilesAttached: (files: FileMetadata[]) => void;
  maxFileSize?: number; // in bytes
  maxFiles?: number;
  acceptedFileTypes?: string[];
  disabled?: boolean;
}

export interface FileMetadata {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  hash: string;
  url: string;
  sessionId: string;
  messageId: string;
  uploadedAt: string;
  scanStatus: 'pending' | 'clean' | 'infected' | 'error';
  scanResult?: string;
}

interface UploadingFile {
  file: File;
  id: string;
  progress: number;
  status: 'uploading' | 'scanning' | 'completed' | 'error';
  error?: string;
  abortController?: AbortController;
  metadata?: FileMetadata;
}

// Utility functions
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (contentType: string, filename: string) => {
  if (contentType.startsWith('image/')) return <ImageIcon className="w-5 h-5" />;
  if (contentType.startsWith('video/')) return <Video className="w-5 h-5" />;
  if (contentType.startsWith('audio/')) return <Music className="w-5 h-5" />;
  if (contentType.includes('pdf') || contentType.includes('document') || contentType.includes('text/')) {
    return <FileText className="w-5 h-5" />;
  }
  return <File className="w-5 h-5" />;
};

const getFileColor = (contentType: string) => {
  if (contentType.startsWith('image/')) return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20';
  if (contentType.startsWith('video/')) return 'text-purple-500 bg-purple-50 dark:bg-purple-900/20';
  if (contentType.startsWith('audio/')) return 'text-green-500 bg-green-50 dark:bg-green-900/20';
  if (contentType.includes('pdf') || contentType.includes('document')) {
    return 'text-red-500 bg-red-50 dark:bg-red-900/20';
  }
  return 'text-gray-500 bg-gray-50 dark:bg-gray-900/20';
};

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  messageId,
  onFilesAttached,
  maxFileSize = 100 * 1024 * 1024, // 100MB default
  maxFiles = 10,
  acceptedFileTypes = ['*/*'],
  disabled = false
}) => {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [completedFiles, setCompletedFiles] = useState<FileMetadata[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File upload function
  const uploadFile = useCallback(async (file: File, uploadingFileId: string): Promise<FileMetadata> => {
    const formData = new FormData();
    formData.append('files', file);
    formData.append('session_id', 'temp-session'); // TODO: Get actual session ID
    formData.append('message_id', messageId);

    const abortController = new AbortController();
    
    // Update uploading file with abort controller
    setUploadingFiles(prev => prev.map(uf => 
      uf.id === uploadingFileId 
        ? { ...uf, abortController }
        : uf
    ));

    try {
      const response = await fetch('/api/chat/upload', {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
        // Add upload progress tracking
        onUploadProgress: (progressEvent) => {
          if (progressEvent.lengthComputable) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadingFiles(prev => prev.map(uf => 
              uf.id === uploadingFileId 
                ? { ...uf, progress: percentCompleted }
                : uf
            ));
          }
        }
      } as any);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload failed: ${response.statusText}`);
      }

      const result: FileMetadata[] = await response.json();
      return result[0]; // Assuming single file upload
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Upload cancelled');
      }
      throw error;
    }
  }, [messageId]);

  // Handle file drop/selection
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (disabled) return;
    
    const currentFileCount = uploadingFiles.length + completedFiles.length;
    const availableSlots = maxFiles - currentFileCount;
    
    if (availableSlots <= 0) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const filesToProcess = acceptedFiles.slice(0, availableSlots);
    
    // Validate files
    const validFiles = filesToProcess.filter(file => {
      if (file.size > maxFileSize) {
        toast.error(`File "${file.name}" is too large. Maximum size: ${formatFileSize(maxFileSize)}`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    // Create uploading file entries
    const newUploadingFiles: UploadingFile[] = validFiles.map(file => ({
      file,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      progress: 0,
      status: 'uploading'
    }));

    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);

    // Upload files concurrently with chunked approach
    const uploadPromises = newUploadingFiles.map(async (uploadingFile) => {
      try {
        // Update status to scanning
        setUploadingFiles(prev => prev.map(uf => 
          uf.id === uploadingFile.id 
            ? { ...uf, status: 'scanning', progress: 100 }
            : uf
        ));

        const metadata = await uploadFile(uploadingFile.file, uploadingFile.id);
        
        // Update status to completed
        setUploadingFiles(prev => prev.map(uf => 
          uf.id === uploadingFile.id 
            ? { ...uf, status: 'completed', metadata }
            : uf
        ));

        // Move to completed files
        setCompletedFiles(prev => [...prev, metadata]);
        
        return metadata;
      } catch (error: any) {
        console.error('Upload error:', error);
        
        setUploadingFiles(prev => prev.map(uf => 
          uf.id === uploadingFile.id 
            ? { ...uf, status: 'error', error: error.message }
            : uf
        ));
        
        toast.error(`Failed to upload ${uploadingFile.file.name}: ${error.message}`);
        throw error;
      }
    });

    try {
      const results = await Promise.allSettled(uploadPromises);
      const successfulUploads = results
        .filter((result): result is PromiseFulfilledResult<FileMetadata> => result.status === 'fulfilled')
        .map(result => result.value);

      if (successfulUploads.length > 0) {
        onFilesAttached(successfulUploads);
        toast.success(`Successfully uploaded ${successfulUploads.length} file(s)`);
      }

      // Remove completed uploads from uploading list
      setTimeout(() => {
        setUploadingFiles(prev => prev.filter(uf => uf.status !== 'completed'));
      }, 2000);

    } catch (error) {
      console.error('Upload batch error:', error);
    }
  }, [disabled, maxFiles, maxFileSize, uploadFile, onFilesAttached, uploadingFiles.length, completedFiles.length]);

  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } = useDropzone({
    onDrop,
    accept: acceptedFileTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    maxSize: maxFileSize,
    multiple: true,
    disabled,
    noClick: false
  });

  // Cancel upload
  const cancelUpload = useCallback((uploadingFileId: string) => {
    const uploadingFile = uploadingFiles.find(uf => uf.id === uploadingFileId);
    if (uploadingFile?.abortController) {
      uploadingFile.abortController.abort();
    }
    setUploadingFiles(prev => prev.filter(uf => uf.id !== uploadingFileId));
  }, [uploadingFiles]);

  // Remove completed file
  const removeFile = useCallback((fileId: string) => {
    setCompletedFiles(prev => {
      const newFiles = prev.filter(file => file.id !== fileId);
      onFilesAttached(newFiles);
      return newFiles;
    });
  }, [onFilesAttached]);

  // Get drag zone styling
  const getDragZoneClass = () => {
    let baseClass = "border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer ";
    
    if (disabled) {
      return baseClass + "border-gray-200 bg-gray-50 dark:bg-gray-800 cursor-not-allowed opacity-50";
    }
    
    if (isDragReject) {
      return baseClass + "border-red-300 bg-red-50 dark:bg-red-900/20";
    }
    
    if (isDragActive || isDragAccept) {
      return baseClass + "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 scale-102";
    }
    
    return baseClass + "border-gray-300 dark:border-gray-600 hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10";
  };

  return (
    <div className="w-full">
      {/* Upload Zone */}
      <div {...getRootProps()} className={getDragZoneClass()}>
        <input {...getInputProps()} ref={fileInputRef} />
        
        <motion.div
          initial={{ scale: 1 }}
          animate={{ 
            scale: isDragActive ? 1.05 : 1,
            rotate: isDragActive ? 1 : 0
          }}
          className="flex flex-col items-center justify-center space-y-4"
        >
          <div className="p-4 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/30 dark:to-emerald-800/30">
            <Upload className={`w-8 h-8 ${
              isDragActive 
                ? 'text-emerald-600' 
                : 'text-emerald-500 dark:text-emerald-400'
            }`} />
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {isDragActive ? 'Drop files here' : 'Upload files'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Drag and drop files or click to browse
            </p>
            <div className="text-xs text-gray-400 dark:text-gray-500 space-y-1">
              <p>Max file size: {formatFileSize(maxFileSize)}</p>
              <p>Max files: {maxFiles}</p>
              <p>Supported: Images, Documents, Audio, Video, and more</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Uploading Files */}
      <AnimatePresence>
        {uploadingFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-2"
          >
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Uploading ({uploadingFiles.length})
            </h4>
            {uploadingFiles.map((uploadingFile) => (
              <motion.div
                key={uploadingFile.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg ${getFileColor(uploadingFile.file.type)}`}>
                      {getFileIcon(uploadingFile.file.type, uploadingFile.file.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {uploadingFile.file.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatFileSize(uploadingFile.file.size)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {uploadingFile.status === 'uploading' && (
                      <>
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                          {uploadingFile.progress}%
                        </span>
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                      </>
                    )}
                    
                    {uploadingFile.status === 'scanning' && (
                      <>
                        <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                          Scanning...
                        </span>
                        <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />
                      </>
                    )}
                    
                    {uploadingFile.status === 'completed' && (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    )}
                    
                    {uploadingFile.status === 'error' && (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                    
                    {uploadingFile.status !== 'completed' && (
                      <button
                        onClick={() => cancelUpload(uploadingFile.id)}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Progress bar for uploading */}
                {uploadingFile.status === 'uploading' && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${uploadingFile.progress}%` }}
                      />
                    </div>
                  </div>
                )}
                
                {/* Error message */}
                {uploadingFile.status === 'error' && uploadingFile.error && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-400">
                    {uploadingFile.error}
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Completed Files */}
      <AnimatePresence>
        {completedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-2"
          >
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Attached Files ({completedFiles.length})
            </h4>
            {completedFiles.map((file) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg ${getFileColor(file.contentType)}`}>
                      {getFileIcon(file.contentType, file.filename)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {file.filename}
                      </p>
                      <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>{formatFileSize(file.size)}</span>
                        <span>•</span>
                        <span className={`flex items-center space-x-1 ${
                          file.scanStatus === 'clean' ? 'text-green-600 dark:text-green-400' :
                          file.scanStatus === 'infected' ? 'text-red-600 dark:text-red-400' :
                          file.scanStatus === 'error' ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-blue-600 dark:text-blue-400'
                        }`}>
                          {file.scanStatus === 'clean' && <CheckCircle2 className="w-3 h-3" />}
                          {file.scanStatus === 'infected' && <AlertCircle className="w-3 h-3" />}
                          {file.scanStatus === 'error' && <AlertCircle className="w-3 h-3" />}
                          {file.scanStatus === 'pending' && <Loader2 className="w-3 h-3 animate-spin" />}
                          <span className="capitalize">{file.scanStatus}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    {file.url && (
                      <>
                        <button
                          onClick={() => window.open(file.url, '_blank')}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            const a = document.createElement('a');
                            a.href = file.url;
                            a.download = file.filename;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                          }}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => removeFile(file.id)}
                      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FileUploadZone;