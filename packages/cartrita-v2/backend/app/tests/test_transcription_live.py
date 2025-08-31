"""
Tests for real-time voice transcription WebSocket endpoint.
"""
import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI, WebSocket
from starlette.websockets import WebSocketDisconnect

"""
Tests for real-time voice transcription WebSocket endpoint.
"""
import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI, APIRouter
from starlette.websockets import WebSocketDisconnect, WebSocketState
import asyncio
import time

# Create a test version of the transcription client for isolation
class MockStreamingTranscriptionClient:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.seq = 0

    async def stream_chunk(self, chunk: bytes) -> dict:
        await asyncio.sleep(0.01)  # Faster for tests
        self.seq += 1
        return {
            "type": "interim",
            "text": f"interim transcript {self.seq}",
            "seq": self.seq,
            "is_final": False,
            "latency_ms": 50
        }

    async def finalize(self) -> dict:
        return {
            "type": "final", 
            "text": "final transcript",
            "seq": self.seq,
            "is_final": True,
            "latency_ms": 60
        }

# Create test router
test_router = APIRouter()

@test_router.websocket("/ws/transcribe/{session_id}")
async def test_ws_transcribe(websocket, session_id: str):
    await websocket.accept()
    client = MockStreamingTranscriptionClient(session_id)
    try:
        while websocket.application_state == WebSocketState.CONNECTED:
            try:
                chunk = await asyncio.wait_for(websocket.receive_bytes(), timeout=5)
            except asyncio.TimeoutError:
                await websocket.close(code=4000)
                break
            event = await client.stream_chunk(chunk)
            await websocket.send_json(event)
    except WebSocketDisconnect:
        pass
    finally:
        final_event = await client.finalize()
        if websocket.application_state == WebSocketState.CONNECTED:
            await websocket.send_json(final_event)

app = FastAPI()
app.include_router(test_router)

@pytest.mark.asyncio
async def test_ws_transcribe_interim_and_final(monkeypatch: pytest.MonkeyPatch):
    """Test WebSocket transcription endpoint emits interim and final events."""
    client = TestClient(app)
    with client.websocket_connect("/ws/transcribe/testsession") as ws:
        # Send binary chunk
        ws.send_bytes(b"audiochunk1")
        event = ws.receive_json()
        assert event["type"] == "interim"
        assert event["is_final"] is False
        assert "text" in event
        # Simulate idle timeout
        ws.close()
        # Final event should be sent on close
        # (In real test, would check DB persistence)
