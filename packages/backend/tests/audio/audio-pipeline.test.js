import request from 'supertest';
import http from 'http';
// Enable mock mode before importing server to avoid external dependencies (DB/Redis)
process.env.AUDIO_PIPELINE_MOCK = '1';
const { startServer, server: mainServer } = await import('../../index.js');

// Basic integration covering ingest -> preprocess -> transcribe -> tts (stubbed providers)

describe('Audio Pipeline Integration', () => {
  let server;
  beforeAll(async () => {
    // Ensure server initialized in test mode (NODE_ENV=test prevents auto start)
    await startServer();
    server = mainServer; // reuse primary server to avoid duplicate init
  });

  afterAll(async () => {
    if (server && server.listening) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  test('ingest -> preprocess -> transcribe -> tts', async () => {
    const fileBuffer = Buffer.from('RIFFfakeWAVdata');

    // Ingest
    const ingestRes = await request(server)
      .post('/api/audio/upload')
      .attach('file', fileBuffer, { filename: 'test.wav', contentType: 'audio/wav' });
    expect(ingestRes.status).toBe(200);
    expect(ingestRes.body.success).toBe(true);
    const assetId = ingestRes.body.asset_id;

    // Preprocess
    const preprocessRes = await request(server)
      .post(`/api/audio/${assetId}/preprocess`)
      .send({ duration_ms: 1234 });
    expect(preprocessRes.status).toBe(200);
    expect(preprocessRes.body.success).toBe(true);

    // Transcribe
    const transcribeRes = await request(server)
      .post(`/api/audio/${assetId}/transcribe`)
      .send({ language: 'en' });
    expect(transcribeRes.status).toBe(200);
    expect(transcribeRes.body.success).toBe(true);
    expect(transcribeRes.body.transcript).toBeDefined();

    // TTS
    const ttsRes = await request(server)
      .post(`/api/audio/${assetId}/tts`)
      .send({ text: 'Hello world' });
    expect(ttsRes.status).toBe(200);
    expect(ttsRes.body.success).toBe(true);
  });

  test('validation failures', async () => {
    // Missing file
    const noFile = await request(server).post('/api/audio/upload');
    expect(noFile.status).toBe(400);

    // Bad id
    const badId = await request(server).post('/api/audio/notanid/transcribe');
    expect(badId.status).toBe(400);

    // TTS missing text
    const ingestRes = await request(server)
      .post('/api/audio/upload')
      .attach('file', Buffer.from('data'), { filename: 'test.wav', contentType: 'audio/wav' });
    const assetId = ingestRes.body.asset_id;
    const ttsBad = await request(server)
      .post(`/api/audio/${assetId}/tts`)
      .send({});
    expect(ttsBad.status).toBe(400);
  });
});
