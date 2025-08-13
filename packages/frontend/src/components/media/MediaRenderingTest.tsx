/**
 * Media Rendering Test Component
 * Demonstrates URL-based media rendering with various formats
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import VirtualizedChatList from '../chat/VirtualizedChatList';
import { Play, Pause, RefreshCw, TestTube } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    model?: string;
    tokens?: number;
    processingTime?: number;
  };
}

const MediaRenderingTest: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [testInput, setTestInput] = useState('');
  const [enableMedia, setEnableMedia] = useState(true);
  const [allowUntrusted, setAllowUntrusted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // Test URLs for different media types
  const testUrls = {
    images: [
      'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=500',
      'https://via.placeholder.com/400x300.png',
      'https://picsum.photos/400/250',
      'https://httpbin.org/image/jpeg' // This might fail - good for error testing
    ],
    videos: [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://vimeo.com/147365861',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
    ],
    mixed: [
      'Check out this amazing sunset: https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500',
      'Here is a great tutorial video: https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'Multiple media in one message:\nhttps://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400\nhttps://picsum.photos/300/200',
      'Mixed content with text between media:\nThis is some text before the image.\nhttps://images.unsplash.com/photo-1549298916-b41d501d3772?w=500\nAnd here is some text after the image, followed by a video:\nhttps://vimeo.com/147365861\nEnd of message.'
    ]
  };

  // Add a test message
  const addMessage = (content: string, role: 'user' | 'assistant' = 'user') => {
    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      role,
      content,
      timestamp: new Date().toISOString(),
      metadata: role === 'assistant' ? {
        model: 'test-model',
        tokens: content.length,
        processingTime: Math.floor(Math.random() * 1000)
      } : undefined
    };

    setMessages(prev => [...prev, newMessage]);
  };

  // Add custom message from input
  const addCustomMessage = () => {
    if (testInput.trim()) {
      addMessage(testInput);
      setTestInput('');
    }
  };

  // Run automated test sequence
  const runTestSequence = async () => {
    setIsRunning(true);
    setMessages([]);

    const allTests = [
      ...testUrls.images.map(url => ({ content: `Testing image: ${url}`, delay: 1000 })),
      ...testUrls.videos.map(url => ({ content: `Testing video: ${url}`, delay: 1500 })),
      ...testUrls.mixed.map(content => ({ content, delay: 2000 }))
    ];

    for (let i = 0; i < allTests.length; i++) {
      const test = allTests[i];
      addMessage(test.content, i % 2 === 0 ? 'user' : 'assistant');
      
      if (i < allTests.length - 1) {
        await new Promise(resolve => setTimeout(resolve, test.delay));
      }
    }

    setIsRunning(false);
  };

  // Clear all messages
  const clearMessages = () => {
    setMessages([]);
  };

  // Quick test buttons
  const quickTests = [
    {
      name: 'Single Image',
      content: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500'
    },
    {
      name: 'YouTube Video',
      content: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    },
    {
      name: 'Mixed Media',
      content: 'Check this out:\nhttps://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400\nhttps://www.youtube.com/watch?v=dQw4w9WgXcQ'
    },
    {
      name: 'Untrusted Domain',
      content: 'Testing untrusted: http://example.com/image.jpg'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="w-5 h-5" />
            Media Rendering Test Suite
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Test URL-based image and video rendering in chat messages with security controls
          </p>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enable-media"
                checked={enableMedia}
                onChange={(e) => setEnableMedia(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="enable-media" className="text-sm">
                Enable Media Rendering
              </label>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="allow-untrusted"
                checked={allowUntrusted}
                onChange={(e) => setAllowUntrusted(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="allow-untrusted" className="text-sm">
                Allow Untrusted Domains
              </label>
            </div>

            <div className="flex gap-2 ml-auto">
              <Button
                onClick={runTestSequence}
                disabled={isRunning}
                variant="outline"
                size="sm"
              >
                {isRunning ? (
                  <>
                    <Pause className="w-4 h-4 mr-1" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-1" />
                    Auto Test
                  </>
                )}
              </Button>
              
              <Button
                onClick={clearMessages}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Clear
              </Button>
            </div>
          </div>

          {/* Quick Test Buttons */}
          <div className="flex flex-wrap gap-2">
            {quickTests.map((test, index) => (
              <Button
                key={index}
                onClick={() => addMessage(test.content)}
                variant="outline"
                size="sm"
              >
                {test.name}
              </Button>
            ))}
          </div>

          {/* Custom Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Custom Test Message:</label>
            <div className="flex gap-2">
              <Textarea
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Enter a message with URLs to test media rendering..."
                rows={3}
                className="flex-1"
              />
              <Button onClick={addCustomMessage} disabled={!testInput.trim()}>
                Send
              </Button>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-4 text-sm">
            <Badge variant={enableMedia ? "default" : "secondary"}>
              Media: {enableMedia ? "Enabled" : "Disabled"}
            </Badge>
            <Badge variant={allowUntrusted ? "destructive" : "secondary"}>
              Untrusted: {allowUntrusted ? "Allowed" : "Blocked"}
            </Badge>
            <span className="text-gray-600 dark:text-gray-400">
              Messages: {messages.length}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Chat Display */}
      <Card className="h-[600px]">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Media Rendering Preview</CardTitle>
        </CardHeader>
        
        <CardContent className="h-[calc(100%-80px)] p-0">
          <VirtualizedChatList
            messages={messages}
            enableMediaRendering={enableMedia}
            allowUntrustedMedia={allowUntrusted}
            maxMediaWidth={400}
            showTimestamps={true}
            className="h-full"
          />
        </CardContent>
      </Card>

      {/* Test URLs Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Test URLs Reference</CardTitle>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <h4 className="font-medium mb-2">Image URLs:</h4>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400 font-mono">
                {testUrls.images.map((url, i) => (
                  <li key={i} className="break-all">{url}</li>
                ))}
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Video URLs:</h4>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400 font-mono">
                {testUrls.videos.map((url, i) => (
                  <li key={i} className="break-all">{url}</li>
                ))}
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Security Features:</h4>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                <li>• Domain allowlist filtering</li>
                <li>• Untrusted media warnings</li>
                <li>• Error handling & fallbacks</li>
                <li>• Lazy loading & virtualization</li>
                <li>• XSS protection via DOMPurify</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MediaRenderingTest;