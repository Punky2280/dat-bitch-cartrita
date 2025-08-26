'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { 
  Headphones, 
  Eye, 
  Hand, 
  Gamepad2,
  Zap,
  Settings,
  Play,
  Square,
  RotateCcw,
  Volume2,
  Vibrate
} from 'lucide-react';
import { useCognitiveStore } from '@/stores/cognitiveStore';

interface VRControls {
  headsetConnected: boolean;
  controllersConnected: number;
  trackingAccuracy: number;
  roomScale: boolean;
  handTracking: boolean;
  eyeTracking: boolean;
  hapticFeedback: boolean;
}

interface SpatialMapping {
  roomBoundaries: { x: number; y: number; z: number }[];
  obstacles: { position: [number, number, number]; size: [number, number, number] }[];
  safeZone: { center: [number, number, number]; radius: number };
  trackingLost: boolean;
}

export default function VRInterface() {
  const {
    metaverseSession,
    updateSpatialData,
    processRealTimeUpdate,
    cognitiveState
  } = useCognitiveStore();

  const [vrControls, setVRControls] = useState<VRControls>({
    headsetConnected: false,
    controllersConnected: 0,
    trackingAccuracy: 0,
    roomScale: false,
    handTracking: false,
    eyeTracking: false,
    hapticFeedback: true
  });

  const [spatialMapping, setSpatialMapping] = useState<SpatialMapping>({
    roomBoundaries: [],
    obstacles: [],
    safeZone: { center: [0, 0, 0], radius: 2 },
    trackingLost: false
  });

  const [vrSettings, setVRSettings] = useState({
    fieldOfView: 110,
    ipd: 63, // Interpupillary distance
    refreshRate: 90,
    brightness: 80,
    comfort: 5,
    motionSickness: 2
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  // Simulate VR environment rendering
  useEffect(() => {
    if (vrControls.headsetConnected && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        const renderVRScene = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Create gradient background (simulating VR environment)
          const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
          gradient.addColorStop(0, '#1e40af');
          gradient.addColorStop(0.5, '#3730a3');
          gradient.addColorStop(1, '#1e1b4b');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Draw spatial boundaries
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          
          // Safe zone circle
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          const radius = spatialMapping.safeZone.radius * 50;
          
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
          ctx.stroke();
          
          // Draw obstacles
          ctx.fillStyle = '#ef4444';
          spatialMapping.obstacles.forEach(obstacle => {
            const x = centerX + obstacle.position[0] * 30;
            const y = centerY + obstacle.position[1] * 30;
            const width = obstacle.size[0] * 20;
            const height = obstacle.size[1] * 20;
            
            ctx.fillRect(x - width/2, y - height/2, width, height);
          });
          
          // Hand tracking visualization
          if (vrControls.handTracking) {
            ctx.fillStyle = '#22c55e';
            // Left hand
            ctx.beginPath();
            ctx.arc(centerX - 60, centerY + 20, 8, 0, 2 * Math.PI);
            ctx.fill();
            
            // Right hand
            ctx.beginPath();
            ctx.arc(centerX + 60, centerY + 20, 8, 0, 2 * Math.PI);
            ctx.fill();
          }
          
          // Eye tracking indicators
          if (vrControls.eyeTracking) {
            ctx.fillStyle = '#3b82f6';
            ctx.beginPath();
            ctx.arc(centerX - 20, centerY - 40, 5, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(centerX + 20, centerY - 40, 5, 0, 2 * Math.PI);
            ctx.fill();
          }
          
          // Tracking accuracy indicator
          if (vrControls.trackingAccuracy < 0.5) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.fillStyle = '#ef4444';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Tracking Lost', centerX, centerY);
          }
          
          animationRef.current = requestAnimationFrame(renderVRScene);
        };
        
        renderVRScene();
      }
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [vrControls, spatialMapping]);

  const connectVRHeadset = () => {
    setVRControls(prev => ({
      ...prev,
      headsetConnected: true,
      controllersConnected: 2,
      trackingAccuracy: 0.95,
      roomScale: true,
      handTracking: true,
      eyeTracking: true
    }));
    
    // Simulate room mapping
    setSpatialMapping({
      roomBoundaries: [
        { x: -3, y: 0, z: -2 },
        { x: 3, y: 0, z: -2 },
        { x: 3, y: 0, z: 2 },
        { x: -3, y: 0, z: 2 }
      ],
      obstacles: [
        { position: [1.5, 0, -1], size: [0.5, 1.8, 0.5] },
        { position: [-1, 0, 1], size: [1, 0.8, 0.6] }
      ],
      safeZone: { center: [0, 0, 0], radius: 2 },
      trackingLost: false
    });

    processRealTimeUpdate('spatial_update', {
      spatialData: { position: { x: 0, y: 1.7, z: 0 } }
    });
  };

  const disconnectVRHeadset = () => {
    setVRControls(prev => ({
      ...prev,
      headsetConnected: false,
      controllersConnected: 0,
      trackingAccuracy: 0,
      roomScale: false,
      handTracking: false,
      eyeTracking: false
    }));
  };

  const calibrateTracking = () => {
    setVRControls(prev => ({
      ...prev,
      trackingAccuracy: Math.min(prev.trackingAccuracy + 0.1, 1.0)
    }));
    
    setSpatialMapping(prev => ({
      ...prev,
      trackingLost: false
    }));
  };

  const triggerHapticFeedback = (intensity: number) => {
    if (vrControls.hapticFeedback) {
      // Simulate haptic feedback through visual indication
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = `rgba(255, 255, 255, ${intensity})`;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          setTimeout(() => {
            // Will be cleared in next animation frame
          }, 100);
        }
      }
    }
  };

  const getTrackingQualityColor = (accuracy: number) => {
    if (accuracy > 0.9) return 'bg-green-500';
    if (accuracy > 0.7) return 'bg-yellow-500';
    if (accuracy > 0.5) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Headphones className="w-6 h-6 text-purple-600" />
            <CardTitle>VR/AR Interface Controller</CardTitle>
          </div>
          <CardDescription>
            Immersive 3D environment with spatial tracking and interaction
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">VR Headset Status</h4>
              <p className="text-sm text-gray-600">
                {vrControls.headsetConnected ? 'Connected and Active' : 'Disconnected'}
              </p>
            </div>
            <div className="flex space-x-2">
              {!vrControls.headsetConnected ? (
                <Button onClick={connectVRHeadset} className="flex items-center space-x-2">
                  <Play className="w-4 h-4" />
                  <span>Connect VR</span>
                </Button>
              ) : (
                <Button onClick={disconnectVRHeadset} variant="destructive" className="flex items-center space-x-2">
                  <Square className="w-4 h-4" />
                  <span>Disconnect</span>
                </Button>
              )}
            </div>
          </div>

          {vrControls.headsetConnected && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <Badge className={`${getTrackingQualityColor(vrControls.trackingAccuracy)} text-white`}>
                  Tracking
                </Badge>
                <p className="text-sm mt-1">{Math.round(vrControls.trackingAccuracy * 100)}%</p>
              </div>
              <div className="text-center">
                <Badge variant={vrControls.controllersConnected > 0 ? "default" : "secondary"}>
                  Controllers
                </Badge>
                <p className="text-sm mt-1">{vrControls.controllersConnected}/2</p>
              </div>
              <div className="text-center">
                <Badge variant={vrControls.handTracking ? "default" : "secondary"}>
                  Hands
                </Badge>
                <p className="text-sm mt-1">{vrControls.handTracking ? "Active" : "Inactive"}</p>
              </div>
              <div className="text-center">
                <Badge variant={vrControls.eyeTracking ? "default" : "secondary"}>
                  Eyes
                </Badge>
                <p className="text-sm mt-1">{vrControls.eyeTracking ? "Active" : "Inactive"}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {vrControls.headsetConnected && (
        <Tabs defaultValue="spatial" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="spatial">Spatial</TabsTrigger>
            <TabsTrigger value="controls">Controls</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="haptics">Haptics</TabsTrigger>
          </TabsList>

          <TabsContent value="spatial" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <Eye className="w-5 h-5 text-blue-600" />
                    <CardTitle className="text-lg">VR Environment</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={300}
                    className="border rounded-lg w-full"
                    style={{ background: '#0f172a' }}
                  />
                  <div className="mt-4 flex space-x-2">
                    <Button size="sm" onClick={calibrateTracking} variant="outline">
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Recalibrate
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => triggerHapticFeedback(0.5)}
                      variant="outline"
                      disabled={!vrControls.hapticFeedback}
                    >
                      <Vibrate className="w-4 h-4 mr-1" />
                      Test Haptics
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Spatial Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm mb-2">Room Scale Tracking</h4>
                    <Badge variant={vrControls.roomScale ? "default" : "secondary"}>
                      {vrControls.roomScale ? "Room Scale Active" : "Seated Experience"}
                    </Badge>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-sm mb-2">Safe Zone</h4>
                    <div className="text-sm text-gray-600">
                      <p>Radius: {spatialMapping.safeZone.radius}m</p>
                      <p>Center: ({spatialMapping.safeZone.center.join(', ')})</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-sm mb-2">Detected Obstacles</h4>
                    <p className="text-sm text-gray-600">
                      {spatialMapping.obstacles.length} objects mapped
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-sm mb-2">Tracking Accuracy</h4>
                    <Progress value={vrControls.trackingAccuracy * 100} className="w-full" />
                    <p className="text-xs text-gray-500 mt-1">
                      {Math.round(vrControls.trackingAccuracy * 100)}% accurate
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="controls" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <Gamepad2 className="w-5 h-5 text-green-600" />
                    <CardTitle className="text-lg">Controller Input</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <Hand className="w-6 h-6 text-blue-600" />
                      </div>
                      <p className="text-sm font-medium">Left Controller</p>
                      <Badge variant={vrControls.controllersConnected >= 1 ? "default" : "secondary"}>
                        {vrControls.controllersConnected >= 1 ? "Connected" : "Disconnected"}
                      </Badge>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <Hand className="w-6 h-6 text-green-600 scale-x-[-1]" />
                      </div>
                      <p className="text-sm font-medium">Right Controller</p>
                      <Badge variant={vrControls.controllersConnected >= 2 ? "default" : "secondary"}>
                        {vrControls.controllersConnected >= 2 ? "Connected" : "Disconnected"}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Hand Tracking</span>
                      <Badge variant={vrControls.handTracking ? "default" : "secondary"}>
                        {vrControls.handTracking ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Eye Tracking</span>
                      <Badge variant={vrControls.eyeTracking ? "default" : "secondary"}>
                        {vrControls.eyeTracking ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <Zap className="w-5 h-5 text-yellow-600" />
                    <CardTitle className="text-lg">Interaction Modes</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {[
                      { name: 'Point & Click', active: true },
                      { name: 'Grab & Manipulate', active: vrControls.handTracking },
                      { name: 'Gesture Control', active: vrControls.handTracking },
                      { name: 'Voice Commands', active: true },
                      { name: 'Eye Selection', active: vrControls.eyeTracking },
                      { name: 'Teleportation', active: vrControls.roomScale }
                    ].map((mode, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm">{mode.name}</span>
                        <Badge variant={mode.active ? "default" : "secondary"}>
                          {mode.active ? "Available" : "Unavailable"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Settings className="w-5 h-5 text-gray-600" />
                  <CardTitle className="text-lg">VR Configuration</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Field of View</label>
                      <div className="mt-2">
                        <Slider
                          value={[vrSettings.fieldOfView]}
                          onValueChange={([value]) => setVRSettings(prev => ({ ...prev, fieldOfView: value }))}
                          min={90}
                          max={120}
                          step={1}
                          className="w-full"
                        />
                        <p className="text-xs text-gray-500 mt-1">{vrSettings.fieldOfView}°</p>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">IPD (mm)</label>
                      <div className="mt-2">
                        <Slider
                          value={[vrSettings.ipd]}
                          onValueChange={([value]) => setVRSettings(prev => ({ ...prev, ipd: value }))}
                          min={55}
                          max={75}
                          step={0.5}
                          className="w-full"
                        />
                        <p className="text-xs text-gray-500 mt-1">{vrSettings.ipd}mm</p>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Refresh Rate</label>
                      <div className="mt-2">
                        <Slider
                          value={[vrSettings.refreshRate]}
                          onValueChange={([value]) => setVRSettings(prev => ({ ...prev, refreshRate: value }))}
                          min={60}
                          max={120}
                          step={30}
                          className="w-full"
                        />
                        <p className="text-xs text-gray-500 mt-1">{vrSettings.refreshRate}Hz</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Brightness</label>
                      <div className="mt-2">
                        <Slider
                          value={[vrSettings.brightness]}
                          onValueChange={([value]) => setVRSettings(prev => ({ ...prev, brightness: value }))}
                          min={20}
                          max={100}
                          step={5}
                          className="w-full"
                        />
                        <p className="text-xs text-gray-500 mt-1">{vrSettings.brightness}%</p>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Comfort Level</label>
                      <div className="mt-2">
                        <Slider
                          value={[vrSettings.comfort]}
                          onValueChange={([value]) => setVRSettings(prev => ({ ...prev, comfort: value }))}
                          min={1}
                          max={10}
                          step={1}
                          className="w-full"
                        />
                        <p className="text-xs text-gray-500 mt-1">Level {vrSettings.comfort}/10</p>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Motion Sickness Reduction</label>
                      <div className="mt-2">
                        <Slider
                          value={[vrSettings.motionSickness]}
                          onValueChange={([value]) => setVRSettings(prev => ({ ...prev, motionSickness: value }))}
                          min={0}
                          max={5}
                          step={1}
                          className="w-full"
                        />
                        <p className="text-xs text-gray-500 mt-1">Level {vrSettings.motionSickness}/5</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="haptics" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Vibrate className="w-5 h-5 text-purple-600" />
                  <CardTitle className="text-lg">Haptic Feedback System</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button 
                    onClick={() => triggerHapticFeedback(0.3)}
                    variant="outline"
                    disabled={!vrControls.hapticFeedback}
                  >
                    Light Touch
                  </Button>
                  <Button 
                    onClick={() => triggerHapticFeedback(0.6)}
                    variant="outline"
                    disabled={!vrControls.hapticFeedback}
                  >
                    Medium Pulse
                  </Button>
                  <Button 
                    onClick={() => triggerHapticFeedback(0.9)}
                    variant="outline"
                    disabled={!vrControls.hapticFeedback}
                  >
                    Strong Impact
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Haptic Feedback</span>
                    <Badge variant={vrControls.hapticFeedback ? "default" : "secondary"}>
                      {vrControls.hapticFeedback ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    <p>• Touch interactions: Object collision feedback</p>
                    <p>• UI elements: Button press confirmation</p>
                    <p>• Spatial audio: Direction-based vibration</p>
                    <p>• Cognitive feedback: Emotional state haptics</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}