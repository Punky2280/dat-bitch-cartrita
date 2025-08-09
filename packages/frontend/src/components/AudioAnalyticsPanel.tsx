/**
 * Audio Analytics Panel
 * Advanced audio processing interface with speaker diarization,
 * voice activity detection, and overlapped speech detection
 */

import React, { useState, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import {
  Upload,
  Mic,
  Users,
  Activity,
  Overlap,
  Play,
  Pause,
  Download,
  Settings,
  Info,
} from "lucide-react";

interface AudioAnalysisResult {
  diarization?: Array<{
    start: number;
    end: number;
    speaker: string;
    duration: number;
  }>;
  vad?: Array<{
    start: number;
    end: number;
    duration: number;
  }>;
  osd?: Array<{
    start: number;
    end: number;
    duration: number;
  }>;
  speakerStats?: {
    totalSpeakers: number;
    totalSpeechTime: number;
    speakers: Record<string, any>;
  };
  speechStats?: {
    totalSpeechTime: number;
    speechRatio: number;
    silenceRatio: number;
  };
  overlapStats?: {
    totalOverlapTime: number;
    overlapRatio: number;
  };
}

const AudioAnalyticsPanel: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] =
    useState<AudioAnalysisResult | null>(null);
  const [analysisType, setAnalysisType] = useState<string>("full");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string>("");
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [selectedFile]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const supportedTypes = [
        "audio/wav",
        "audio/mp3",
        "audio/m4a",
        "audio/flac",
        "audio/ogg",
      ];
      if (!supportedTypes.includes(file.type)) {
        setError(
          "Unsupported file type. Please upload WAV, MP3, M4A, FLAC, or OGG files.",
        );
        return;
      }

      // Validate file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        setError("File too large. Maximum size is 50MB.");
        return;
      }

      setSelectedFile(file);
      setError("");
      setAnalysisResult(null);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setError("");
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("audio", selectedFile);
      formData.append("analysisType", analysisType);

      const response = await fetch("/api/audio-analytics/analyze", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Analysis failed");
      }

      const data = await response.json();
      setAnalysisResult(data.analysis);
      setUploadProgress(100);
    } catch (err: any) {
      setError(err.message || "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const renderSpeakerTimeline = () => {
    if (!analysisResult?.diarization || !duration) return null;

    return (
      <div className="space-y-2">
        <h4 className="font-medium">Speaker Timeline</h4>
        <div className="relative bg-gray-100 h-12 rounded overflow-hidden">
          {analysisResult.diarization.map((segment, index) => {
            const left = (segment.start / duration) * 100;
            const width = (segment.duration / duration) * 100;
            const colors = [
              "bg-blue-500",
              "bg-green-500",
              "bg-red-500",
              "bg-yellow-500",
              "bg-purple-500",
            ];
            const speakerIndex =
              parseInt(segment.speaker.replace(/\D/g, "")) % colors.length;

            return (
              <div
                key={index}
                className={`absolute h-full ${colors[speakerIndex]} opacity-70`}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                }}
                title={`${segment.speaker}: ${formatTime(segment.start)} - ${formatTime(segment.end)}`}
              />
            );
          })}
          {/* Current time indicator */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-black z-10"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{formatTime(0)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    );
  };

  const renderSpeakerStats = () => {
    if (!analysisResult?.speakerStats) return null;

    const { speakerStats } = analysisResult;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              Speaker Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Speakers:</span>
                <Badge variant="secondary">{speakerStats.totalSpeakers}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Total Speech Time:</span>
                <span>{formatTime(speakerStats.totalSpeechTime)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Speaker Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(speakerStats.speakers).map(
                ([speaker, stats]: [string, any]) => (
                  <div key={speaker} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{speaker}</span>
                      <span className="text-sm text-gray-600">
                        {stats.speakingTimePercentage?.toFixed(1)}%
                      </span>
                    </div>
                    <Progress
                      value={stats.speakingTimePercentage}
                      className="h-2"
                    />
                    <div className="text-xs text-gray-600">
                      {formatTime(stats.totalTime)} • {stats.segmentCount}{" "}
                      segments
                    </div>
                  </div>
                ),
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderVoiceActivityStats = () => {
    if (!analysisResult?.speechStats) return null;

    const { speechStats } = analysisResult;

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Voice Activity Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Speech Time:</span>
                <span>{formatTime(speechStats.totalSpeechTime)}</span>
              </div>
              <div className="flex justify-between">
                <span>Speech Ratio:</span>
                <Badge
                  variant={
                    speechStats.speechRatio > 70 ? "default" : "secondary"
                  }
                >
                  {speechStats.speechRatio.toFixed(1)}%
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Silence Time:</span>
                <span>{formatTime(speechStats.silenceTime)}</span>
              </div>
              <div className="flex justify-between">
                <span>Silence Ratio:</span>
                <Badge variant="outline">
                  {speechStats.silenceRatio.toFixed(1)}%
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderOverlapStats = () => {
    if (!analysisResult?.overlapStats) return null;

    const { overlapStats } = analysisResult;

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Overlap className="w-5 h-5" />
            Overlapped Speech Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Overlap Time:</span>
              <span>{formatTime(overlapStats.totalOverlapTime)}</span>
            </div>
            <div className="flex justify-between">
              <span>Overlap Ratio:</span>
              <Badge
                variant={
                  overlapStats.overlapRatio > 10 ? "destructive" : "secondary"
                }
              >
                {overlapStats.overlapRatio.toFixed(1)}%
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Overlap Segments:</span>
              <span>{overlapStats.overlapSegments}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-3">
            <Mic className="w-8 h-8" />
            Advanced Audio Analytics
          </CardTitle>
          <CardDescription>
            Powered by pyannote.audio - Speaker diarization, voice activity
            detection, and overlapped speech analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Select Audio File
              </Button>

              <select
                value={analysisType}
                onChange={(e) => setAnalysisType(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="full">Full Analysis</option>
                <option value="diarization">Speaker Diarization</option>
                <option value="vad">Voice Activity Detection</option>
                <option value="osd">Overlapped Speech Detection</option>
                <option value="segmentation">Raw Segmentation</option>
              </select>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".wav,.mp3,.m4a,.flac,.ogg"
              onChange={handleFileSelect}
              className="hidden"
            />

            {selectedFile && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{selectedFile.name}</h4>
                    <p className="text-sm text-gray-600">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="flex items-center gap-2"
                  >
                    {isAnalyzing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      "Analyze Audio"
                    )}
                  </Button>
                </div>

                {isAnalyzing && (
                  <div className="mt-3">
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Audio Player */}
          {audioUrl && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Audio Player</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={() => setIsPlaying(false)}
                    className="hidden"
                  />

                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePlayPause}
                      className="flex items-center gap-2"
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      {isPlaying ? "Pause" : "Play"}
                    </Button>

                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                      </div>
                      <Progress
                        value={(currentTime / duration) * 100}
                        className="h-2 cursor-pointer"
                        onClick={(e) => {
                          if (audioRef.current) {
                            const rect =
                              e.currentTarget.getBoundingClientRect();
                            const percent =
                              (e.clientX - rect.left) / rect.width;
                            audioRef.current.currentTime = percent * duration;
                          }
                        }}
                      />
                    </div>
                  </div>

                  {renderSpeakerTimeline()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Analysis Results */}
          {analysisResult && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="speakers">Speakers</TabsTrigger>
                <TabsTrigger value="activity">Voice Activity</TabsTrigger>
                <TabsTrigger value="overlaps">Overlaps</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {analysisResult.speakerStats && (
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold text-blue-600">
                          {analysisResult.speakerStats.totalSpeakers}
                        </div>
                        <div className="text-sm text-gray-600">
                          Speakers Detected
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {analysisResult.speechStats && (
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold text-green-600">
                          {analysisResult.speechStats.speechRatio.toFixed(1)}%
                        </div>
                        <div className="text-sm text-gray-600">
                          Speech Activity
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {analysisResult.overlapStats && (
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold text-orange-600">
                          {analysisResult.overlapStats.overlapRatio.toFixed(1)}%
                        </div>
                        <div className="text-sm text-gray-600">
                          Speech Overlap
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="speakers">{renderSpeakerStats()}</TabsContent>

              <TabsContent value="activity">
                {renderVoiceActivityStats()}
              </TabsContent>

              <TabsContent value="overlaps">{renderOverlapStats()}</TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Capabilities Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="w-5 h-5" />
            Audio Analytics Capabilities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Speaker Diarization</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Identify up to 3 speakers per 10-second chunk</li>
                <li>• Temporal speaker segmentation</li>
                <li>• Speaker activity statistics</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Voice Activity Detection</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Speech vs. silence detection</li>
                <li>• Frame-level precision</li>
                <li>• Activity ratio analysis</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Overlapped Speech Detection</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Multiple speakers talking simultaneously</li>
                <li>• Conversation quality metrics</li>
                <li>• Meeting analysis insights</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Supported Formats</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• WAV, MP3, M4A, FLAC, OGG</li>
                <li>• Maximum file size: 50MB</li>
                <li>• Powered by pyannote.audio 3.0</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AudioAnalyticsPanel;
