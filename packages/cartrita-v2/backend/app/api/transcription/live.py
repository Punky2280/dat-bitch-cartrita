"""
WebSocket endpoint for real-time voice transcription.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from starlette.websockets import WebSocketState
from typing import Any
import asyncio
import time

router = APIRouter()

# Placeholder for actual transcription client (Deepgram/Whisper)
class StreamingTranscriptionClient:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.buffer = b""
        self.seq = 0
        self.closed = False

    async def stream_chunk(self, chunk: bytes) -> dict:
        # Simulate streaming transcription (replace with real client)
        await asyncio.sleep(0.1)
        self.seq += 1
        text = f"interim transcript {self.seq}"
        return {
            "type": "interim",
            "text": text,
            "seq": self.seq,
            "is_final": False,
            "latency_ms": 100
        }

    async def finalize(self) -> dict:
        # Simulate final transcript
        await asyncio.sleep(0.1)
        return {
            "type": "final",
            "text": "final transcript",
            "seq": self.seq,
            "is_final": True,
            "latency_ms": 120
        }

    def close(self):
        self.closed = True

@router.websocket("/ws/transcribe/{session_id}")
async def ws_transcribe(ws: WebSocket, session_id: str):
    await ws.accept()
    client = StreamingTranscriptionClient(session_id)
    final_buffer = []
    last_activity = time.time()
    try:
        while ws.application_state == WebSocketState.CONNECTED:
            try:
                chunk = await asyncio.wait_for(ws.receive_bytes(), timeout=30)
                last_activity = time.time()
            except asyncio.TimeoutError:
                await ws.close(code=4000)
                break
            event = await client.stream_chunk(chunk)
            await ws.send_json(event)
            if event["is_final"]:
                final_buffer.append(event["text"])
            # Idle timeout
            if time.time() - last_activity > 30:
                await ws.close(code=4001)
                break
    except WebSocketDisconnect:
        pass
    finally:
        final_event = await client.finalize()
        await ws.send_json(final_event)
        final_buffer.append(final_event["text"])
        # Persist final transcript (placeholder)
        # TODO: Link to message/session in DB
        client.close()
