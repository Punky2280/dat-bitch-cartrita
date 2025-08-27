import { create } from 'zustand';

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  file?: File;
  uploadedAt?: Date;
  status: 'pending' | 'uploading' | 'uploaded' | 'failed';
  progress?: number;
}

interface AttachmentStore {
  attachments: Attachment[];
  maxFileSize: number;
  allowedTypes: string[];
  
  addAttachment: (file: File) => void;
  removeAttachment: (id: string) => void;
  updateAttachment: (id: string, updates: Partial<Attachment>) => void;
  clearAttachments: () => void;
  getAttachmentById: (id: string) => Attachment | undefined;
  uploadAttachment: (id: string) => Promise<void>;
  validateFile: (file: File) => { valid: boolean; error?: string };
}

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const useAttachmentStore = create<AttachmentStore>((set, get) => ({
  attachments: [],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain',
    'application/pdf',
    'application/json',
    'text/csv',
  ],
  
  addAttachment: (file: File) => {
    const validation = get().validateFile(file);
    if (!validation.valid) {
      console.error('File validation failed:', validation.error);
      return;
    }
    
    const id = generateId();
    const attachment: Attachment = {
      id,
      name: file.name,
      type: file.type,
      size: file.size,
      url: URL.createObjectURL(file),
      file,
      status: 'pending',
      progress: 0,
    };
    
    set((state) => ({
      attachments: [...state.attachments, attachment],
    }));
  },
  
  removeAttachment: (id: string) => {
    set((state) => {
      const attachment = state.attachments.find(a => a.id === id);
      if (attachment?.url.startsWith('blob:')) {
        URL.revokeObjectURL(attachment.url);
      }
      return {
        attachments: state.attachments.filter(a => a.id !== id),
      };
    });
  },
  
  updateAttachment: (id: string, updates: Partial<Attachment>) => {
    set((state) => ({
      attachments: state.attachments.map(attachment =>
        attachment.id === id ? { ...attachment, ...updates } : attachment
      ),
    }));
  },
  
  clearAttachments: () => {
    const { attachments } = get();
    attachments.forEach(attachment => {
      if (attachment.url.startsWith('blob:')) {
        URL.revokeObjectURL(attachment.url);
      }
    });
    set({ attachments: [] });
  },
  
  getAttachmentById: (id: string) => {
    return get().attachments.find(a => a.id === id);
  },
  
  uploadAttachment: async (id: string) => {
    const attachment = get().getAttachmentById(id);
    if (!attachment || !attachment.file) return;
    
    get().updateAttachment(id, { status: 'uploading', progress: 0 });
    
    try {
      // Simulate upload progress
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        get().updateAttachment(id, { progress });
      }
      
      // Here you would typically upload to your server
      // const formData = new FormData();
      // formData.append('file', attachment.file);
      // const response = await fetch('/api/upload', { method: 'POST', body: formData });
      
      get().updateAttachment(id, {
        status: 'uploaded',
        progress: 100,
        uploadedAt: new Date(),
      });
    } catch (error) {
      console.error('Upload failed:', error);
      get().updateAttachment(id, { status: 'failed', progress: 0 });
    }
  },
  
  validateFile: (file: File) => {
    const { maxFileSize, allowedTypes } = get();
    
    if (file.size > maxFileSize) {
      return {
        valid: false,
        error: `File size exceeds ${maxFileSize / (1024 * 1024)}MB limit`,
      };
    }
    
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} is not allowed`,
      };
    }
    
    return { valid: true };
  },
}));