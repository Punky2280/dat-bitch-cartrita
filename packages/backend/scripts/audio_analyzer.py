
import sys
import json
import torch
import torchaudio
import numpy as np
from pyannote.audio import Model, Inference
from pyannote.audio.pipelines import VoiceActivityDetection, OverlappedSpeechDetection
from pyannote.audio.utils.powerset import Powerset
from pyannote.core import Segment
import warnings
warnings.filterwarnings("ignore")

class AudioAnalyzer:
    def __init__(self, hf_token):
        self.hf_token = hf_token
        self.models = {}
        self.pipelines = {}
        self.load_models()
    
    def load_models(self):
        try:
            # Load segmentation model
            self.models['segmentation'] = Model.from_pretrained(
                "pyannote/segmentation-3.0",
                use_auth_token=self.hf_token
            )
            
            # Load speaker diarization pipeline
            from pyannote.audio import Pipeline
            self.pipelines['diarization'] = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.0",
                use_auth_token=self.hf_token
            )
            
            # Setup VAD pipeline
            self.pipelines['vad'] = VoiceActivityDetection(
                segmentation=self.models['segmentation']
            )
            self.pipelines['vad'].instantiate({
                "min_duration_on": 0.0,
                "min_duration_off": 0.0
            })
            
            # Setup overlapped speech detection
            self.pipelines['osd'] = OverlappedSpeechDetection(
                segmentation=self.models['segmentation']
            )
            self.pipelines['osd'].instantiate({
                "min_duration_on": 0.0,
                "min_duration_off": 0.0
            })
            
            # Setup inference
            self.inference = Inference(self.models['segmentation'])
            
            # Setup powerset converter
            self.to_multilabel = Powerset(3, 2).to_multilabel
            
            print("Models loaded successfully", file=sys.stderr)
            
        except Exception as e:
            print(f"Error loading models: {str(e)}", file=sys.stderr)
            raise
    
    def analyze_audio(self, audio_path, analysis_type="full"):
        try:
            results = {}
            
            if analysis_type in ["full", "diarization"]:
                # Speaker diarization
                diarization = self.pipelines['diarization'](audio_path)
                results['diarization'] = self.format_diarization(diarization)
            
            if analysis_type in ["full", "vad"]:
                # Voice activity detection
                vad = self.pipelines['vad'](audio_path)
                results['vad'] = self.format_annotation(vad)
            
            if analysis_type in ["full", "osd"]:
                # Overlapped speech detection
                osd = self.pipelines['osd'](audio_path)
                results['osd'] = self.format_annotation(osd)
            
            if analysis_type in ["full", "segmentation"]:
                # Raw segmentation inference
                segmentation = self.inference(audio_path)
                results['segmentation'] = self.format_segmentation(segmentation)
            
            return results
            
        except Exception as e:
            print(f"Error analyzing audio: {str(e)}", file=sys.stderr)
            return {"error": str(e)}
    
    def analyze_segment(self, audio_path, start_time, end_time, analysis_type="full"):
        try:
            segment = Segment(start=start_time, end=end_time)
            results = {}
            
            if analysis_type in ["full", "segmentation"]:
                segmentation = self.inference.crop(audio_path, segment)
                results['segmentation'] = self.format_segmentation(segmentation)
            
            return results
            
        except Exception as e:
            print(f"Error analyzing segment: {str(e)}", file=sys.stderr)
            return {"error": str(e)}
    
    def format_diarization(self, diarization):
        speakers = []
        for segment, _, speaker in diarization.itertracks(yield_label=True):
            speakers.append({
                "start": float(segment.start),
                "end": float(segment.end),
                "speaker": speaker,
                "duration": float(segment.end - segment.start)
            })
        return speakers
    
    def format_annotation(self, annotation):
        segments = []
        for segment in annotation.get_timeline():
            segments.append({
                "start": float(segment.start),
                "end": float(segment.end),
                "duration": float(segment.end - segment.start)
            })
        return segments
    
    def format_segmentation(self, segmentation):
        return {
            "shape": segmentation.shape,
            "data": segmentation.tolist() if hasattr(segmentation, 'tolist') else str(segmentation)
        }

def main():
    if len(sys.argv) < 4:
        print("Usage: python script.py <hf_token> <audio_path> <analysis_type> [start_time] [end_time]")
        sys.exit(1)
    
    hf_token = sys.argv[1]
    audio_path = sys.argv[2]
    analysis_type = sys.argv[3]
    
    analyzer = AudioAnalyzer(hf_token)
    
    if len(sys.argv) >= 6:
        start_time = float(sys.argv[4])
        end_time = float(sys.argv[5])
        results = analyzer.analyze_segment(audio_path, start_time, end_time, analysis_type)
    else:
        results = analyzer.analyze_audio(audio_path, analysis_type)
    
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
