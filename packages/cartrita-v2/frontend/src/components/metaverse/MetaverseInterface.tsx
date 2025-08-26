'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Globe, 
  Users, 
  Headphones, 
  Gamepad2, 
  Eye, 
  Hand, 
  Wifi, 
  Settings,
  Play,
  Square,
  Volume2
} from 'lucide-react';

interface MetaverseSession {
  sessionId: string;
  metaverseType: string;
  spatialData: {
    position: { x: number; y: number; z: number };
    orientation: { yaw: number; pitch: number; roll: number };
    scale: number;
    boundingBox: { width: number; height: number; depth: number };
  };
  avatarConfiguration: {
    appearance: string;
    capabilities: string[];
    interactionModes: string[];
  };
  immersiveFeatures: {
    vrSupport: boolean;
    arSupport: boolean;
    hapticFeedback: boolean;
    spatialAudio: boolean;
    gestureRecognition: boolean;
  };
  networkStatus: {
    latency: number;
    bandwidth: string;
    connectionQuality: string;
  };
  collaborationData: {
    activeUsers: number;
    sharedSpaces: string[];
    realTimeSync: boolean;
  };
}

export default function MetaverseInterface() {
  const [metaverseType, setMetaverseType] = useState('');
  const [spatialCoordinates, setSpatialCoordinates] = useState('');
  const [avatarConfig, setAvatarConfig] = useState('');
  const [immersiveSettings, setImmersiveSettings] = useState('');
  const [session, setSession] = useState<MetaverseSession | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId] = useState(`metaverse_${Date.now()}`);
  const [audioLevel, setAudioLevel] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const metaverseTypes = [
    { value: 'virtual_world', label: 'Virtual World' },
    { value: 'augmented_reality', label: 'Augmented Reality' },
    { value: 'mixed_reality', label: 'Mixed Reality' },
    { value: 'spatial_computing', label: 'Spatial Computing' },
    { value: 'collaborative_space', label: 'Collaborative Space' },
    { value: 'gaming_environment', label: 'Gaming Environment' }
  ];

  useEffect(() => {
    // Simulate spatial audio visualization
    if (isConnected && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const animate = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Draw 3D space representation
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 1;
          
          // Grid
          for (let i = 0; i <= canvas.width; i += 20) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, canvas.height);
            ctx.stroke();
          }
          for (let i = 0; i <= canvas.height; i += 20) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(canvas.width, i);
            ctx.stroke();
          }
          
          // Avatar position
          if (session?.spatialData?.position) {
            const x = (session.spatialData.position.x + 10) * 10;
            const y = (session.spatialData.position.y + 10) * 10;
            
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, 2 * Math.PI);
            ctx.fill();
          }
          
          // Audio visualization
          if (audioLevel > 0) {
            ctx.fillStyle = `rgba(34, 197, 94, ${audioLevel})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          
          requestAnimationFrame(animate);
        };
        animate();
      }
    }
  }, [isConnected, session, audioLevel]);

  const connectToMetaverse = async () => {
    if (!metaverseType) return;

    setIsConnecting(true);
    try {
      const response = await fetch('/api/v2/metaverse/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metaverseType,
          spatialCoordinates: spatialCoordinates ? JSON.parse(spatialCoordinates) : null,
          avatarConfiguration: avatarConfig ? JSON.parse(avatarConfig) : null,
          immersiveSettings: immersiveSettings ? JSON.parse(immersiveSettings) : null,
          sessionId
        })
      });

      const result = await response.json();
      if (result.success) {
        setSession(result.data);
        setIsConnected(true);
        
        // Simulate periodic updates
        const interval = setInterval(() => {
          setAudioLevel(Math.random() * 0.3);
        }, 100);
        
        return () => clearInterval(interval);
      }
    } catch (error) {
      console.error('Metaverse connection error:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectFromMetaverse = () => {
    setIsConnected(false);
    setSession(null);
    setAudioLevel(0);
  };

  const getConnectionQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-yellow-500';
      case 'poor': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Globe className="w-6 h-6 text-purple-600" />
            <CardTitle>Metaverse Integration Interface</CardTitle>
          </div>
          <CardDescription>
            Connect to virtual worlds, AR/VR environments, and collaborative spaces
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isConnected ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Metaverse Environment Type</label>
                <Select value={metaverseType} onValueChange={setMetaverseType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select metaverse type" />
                  </SelectTrigger>
                  <SelectContent>
                    {metaverseTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Spatial Coordinates (JSON)</label>
                  <Textarea
                    value={spatialCoordinates}
                    onChange={(e) => setSpatialCoordinates(e.target.value)}
                    placeholder='{"x": 0, "y": 0, "z": 0, "orientation": {"yaw": 0, "pitch": 0, "roll": 0}}'
                    className="font-mono text-xs"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Avatar Configuration (JSON)</label>
                  <Textarea
                    value={avatarConfig}
                    onChange={(e) => setAvatarConfig(e.target.value)}
                    placeholder='{"appearance": "humanoid", "capabilities": ["voice", "gesture"], "interactionModes": ["touch", "voice"]}'
                    className="font-mono text-xs"
                    rows={3}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Immersive Settings (JSON)</label>
                <Textarea
                  value={immersiveSettings}
                  onChange={(e) => setImmersiveSettings(e.target.value)}
                  placeholder='{"vrEnabled": true, "arEnabled": false, "hapticFeedback": true, "spatialAudio": true, "gestureRecognition": true}'
                  className="font-mono text-xs"
                  rows={2}
                />
              </div>

              <Button 
                onClick={connectToMetaverse}
                disabled={!metaverseType || isConnecting}
                className="w-full"
              >
                {isConnecting ? 'Connecting...' : 'Connect to Metaverse'}
              </Button>
            </>
          ) : (
            <div className="text-center space-y-4">
              <Badge className="bg-green-500 text-white">Connected to {session?.metaverseType}</Badge>
              <Button onClick={disconnectFromMetaverse} variant="destructive">
                Disconnect
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {session && isConnected && (
        <Tabs defaultValue="spatial" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="spatial">Spatial</TabsTrigger>
            <TabsTrigger value="avatar">Avatar</TabsTrigger>
            <TabsTrigger value="immersive">Immersive</TabsTrigger>
            <TabsTrigger value="network">Network</TabsTrigger>
            <TabsTrigger value="collaboration">Collaboration</TabsTrigger>
          </TabsList>

          <TabsContent value="spatial" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <Eye className="w-5 h-5 text-blue-600" />
                    <CardTitle className="text-lg">Spatial Visualization</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <canvas
                    ref={canvasRef}
                    width={300}
                    height={200}
                    className="border rounded-lg w-full"
                    style={{ background: '#f8fafc' }}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Position Data</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <label className="text-gray-600">X Position</label>
                      <p className="font-mono">{session?.spatialData?.position?.x?.toFixed(2) ?? '0.00'}</p>
                    </div>
                    <div>
                      <label className="text-gray-600">Y Position</label>
                      <p className="font-mono">{session?.spatialData?.position?.y?.toFixed(2) ?? '0.00'}</p>
                    </div>
                    <div>
                      <label className="text-gray-600">Z Position</label>
                      <p className="font-mono">{session?.spatialData?.position?.z?.toFixed(2) ?? '0.00'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <label className="text-gray-600">Yaw</label>
                      <p className="font-mono">{session?.spatialData?.orientation?.yaw?.toFixed(1) ?? '0.0'}°</p>
                    </div>
                    <div>
                      <label className="text-gray-600">Pitch</label>
                      <p className="font-mono">{session?.spatialData?.orientation?.pitch?.toFixed(1) ?? '0.0'}°</p>
                    </div>
                    <div>
                      <label className="text-gray-600">Roll</label>
                      <p className="font-mono">{session?.spatialData?.orientation?.roll?.toFixed(1) ?? '0.0'}°</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-600">Scale Factor</label>
                    <Progress value={(session?.spatialData?.scale ?? 1) * 100} className="w-full mt-1" />
                    <p className="text-xs text-gray-500 mt-1">{session?.spatialData?.scale?.toFixed(2) ?? '1.00'}x</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="avatar" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-green-600" />
                  <CardTitle className="text-lg">Avatar Configuration</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm mb-2">Avatar Appearance</h4>
                  <Badge variant="secondary">{session.avatarConfiguration.appearance}</Badge>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-2">Capabilities</h4>
                  <div className="flex flex-wrap gap-2">
                    {session.avatarConfiguration.capabilities.map((capability, index) => (
                      <Badge key={index} variant="outline">
                        {capability}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-2">Interaction Modes</h4>
                  <div className="flex flex-wrap gap-2">
                    {session.avatarConfiguration.interactionModes.map((mode, index) => (
                      <Badge key={index} className="bg-purple-100 text-purple-800">
                        {mode}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="immersive" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <Headphones className="w-5 h-5 text-blue-600" />
                    <CardTitle className="text-lg">Immersive Features</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">VR Support</span>
                    <Badge variant={session.immersiveFeatures.vrSupport ? "default" : "secondary"}>
                      {session.immersiveFeatures.vrSupport ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">AR Support</span>
                    <Badge variant={session.immersiveFeatures.arSupport ? "default" : "secondary"}>
                      {session.immersiveFeatures.arSupport ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Haptic Feedback</span>
                    <Badge variant={session.immersiveFeatures.hapticFeedback ? "default" : "secondary"}>
                      {session.immersiveFeatures.hapticFeedback ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Spatial Audio</span>
                    <Badge variant={session.immersiveFeatures.spatialAudio ? "default" : "secondary"}>
                      {session.immersiveFeatures.spatialAudio ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Gesture Recognition</span>
                    <Badge variant={session.immersiveFeatures.gestureRecognition ? "default" : "secondary"}>
                      {session.immersiveFeatures.gestureRecognition ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <Volume2 className="w-5 h-5 text-green-600" />
                    <CardTitle className="text-lg">Audio Visualization</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-600">Spatial Audio Level</label>
                    <Progress value={audioLevel * 100} className="w-full mt-1" />
                    <p className="text-xs text-gray-500 mt-1">{Math.round(audioLevel * 100)}%</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline">
                      <Play className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline">
                      <Square className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="network" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Wifi className="w-5 h-5 text-blue-600" />
                  <CardTitle className="text-lg">Network Status</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">Latency</label>
                    <p className="text-lg font-semibold">{session.networkStatus.latency}ms</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Bandwidth</label>
                    <p className="text-lg font-semibold">{session.networkStatus.bandwidth}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Connection Quality</label>
                    <Badge className={`${getConnectionQualityColor(session.networkStatus.connectionQuality)} text-white`}>
                      {session.networkStatus.connectionQuality}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Connection Stability</label>
                  <Progress value={85} className="w-full mt-1" />
                  <p className="text-xs text-gray-500 mt-1">85% stable</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="collaboration" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  <CardTitle className="text-lg">Collaboration Status</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">Active Users</label>
                    <p className="text-2xl font-semibold text-green-600">{session.collaborationData.activeUsers}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Real-time Sync</label>
                    <Badge variant={session.collaborationData.realTimeSync ? "default" : "secondary"}>
                      {session.collaborationData.realTimeSync ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-2">Shared Spaces</h4>
                  <div className="flex flex-wrap gap-2">
                    {session.collaborationData.sharedSpaces.map((space, index) => (
                      <Badge key={index} variant="outline">
                        {space}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button className="w-full" variant="outline">
                  <Hand className="w-4 h-4 mr-2" />
                  Invite Collaborators
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}