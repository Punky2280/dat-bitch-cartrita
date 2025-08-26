/* Minimal functional audio pipeline orchestrator */
import EventEmitter from 'events';
import pool from '../../db.js';
import DeepgramSTTProvider from './providers/DeepgramSTTProvider.js';
import HuggingFaceSTTProvider from './providers/HuggingFaceSTTProvider.js';
import HuggingFaceVoiceSwapProvider from './providers/HuggingFaceVoiceSwapProvider.js';
import HuggingFaceTTSProvider from './providers/HuggingFaceTTSProvider.js';
import OpenTelemetryTracing from '../../system/OpenTelemetryTracing.js';
import RedisService from '../../services/RedisService.js';
import crypto from 'crypto';

class AudioPipelineOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.mockEnabled = process.env.AUDIO_PIPELINE_MOCK === '1';
    if (this.mockEnabled) {
      this._mockAssets = new Map();
      this._nextId = 1;
    }
    this.providers = {
      stt: [new DeepgramSTTProvider(), new HuggingFaceSTTProvider()],
      'voice-swap': [new HuggingFaceVoiceSwapProvider()],
      tts: [new HuggingFaceTTSProvider()],
    };
  }

  async ingest(userId, { buffer, filename, mime }) {
    if (this.mockEnabled) {
      const id = this._nextId++;
      this._mockAssets.set(id, {
        id,
        user_id: userId || null,
        original_filename: filename,
        mime_type: mime,
        size_bytes: buffer.length,
        status: 'ingested',
        stages: { ingest: { at: new Date().toISOString() } },
      });
      return { success: true, asset_id: id, mock: true };
    }
    return OpenTelemetryTracing.traceOperation(
      'audio.ingest',
      { attributes: { 'audio.stage': 'ingest' } },
      async () => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const res = await client.query(
            `INSERT INTO audio_assets (user_id, original_filename, storage_path, mime_type, size_bytes, status, stages) 
           VALUES ($1,$2,$3,$4,$5,'ingested', $6) RETURNING id`,
            [
              userId || null,
              filename || 'upload',
              `uploaded://${Date.now()}-${Math.random()}`,
              mime || 'application/octet-stream',
              buffer.length,
              JSON.stringify({ ingest: { at: new Date().toISOString() } }),
            ]
          );
          const id = res.rows[0].id;
          await this._logEvent('audio.ingest', userId, {
            asset_id: id,
            filename,
            size: buffer.length,
          });
          await client.query('COMMIT');
          return { success: true, asset_id: id };
        } catch (e) {
          await client.query('ROLLBACK');
          return { success: false, error: e.message };
        } finally {
          client.release();
        }
      }
    );
  }

  async transcribe(userId, assetId, options = {}) {
    if (this.mockEnabled) {
      const asset = this._mockAssets.get(Number(assetId));
      if (!asset) return { success: false, error: 'Asset not found' };
      const transcript = 'mock transcript';
      asset.transcript = transcript;
      asset.status = 'transcribed';
      asset.stages.stt = {
        at: new Date().toISOString(),
        provider: 'mock',
        confidence: 0.99,
      };
      return {
        success: true,
        asset_id: assetId,
        transcript,
        confidence: 0.99,
        provider: 'mock',
        mock: true,
      };
    }
    return OpenTelemetryTracing.traceOperation(
      'audio.stt',
      { attributes: { 'audio.stage': 'stt' } },
      async () => {
        const audioRow = await this._getAsset(assetId);
        if (!audioRow) return { success: false, error: 'Asset not found' };
        // Check cache first
        const cacheKey = `audio:transcript:${assetId}`;
        if (RedisService.connected) {
          const cached = await RedisService.getCache(cacheKey);
          if (cached && cached.transcript) {
            await this._logEvent('audio.stt.cache_hit', userId, {
              asset_id: assetId,
            });
            return {
              success: true,
              asset_id: assetId,
              transcript: cached.transcript,
              confidence: cached.confidence,
              provider: cached.provider,
              cache: true,
            };
          }
        }
        await this._logEvent('audio.stt.start', userId, { asset_id: assetId });
        const providerResult = await this._runProviders(
          'stt',
          { audioBuffer: Buffer.from('stub') },
          options
        );
        if (!providerResult.success) {
          await this._updateStage(assetId, 'stt', {
            error: providerResult.error,
          });
          await this._setStatus(assetId, 'error');
          await this._logEvent('audio.stt.error', userId, {
            asset_id: assetId,
            error: providerResult.error,
          });
          return providerResult;
        }
        const { transcript, confidence, provider } = providerResult.data;
        await pool.query(
          `UPDATE audio_assets SET transcript=$1, transcript_confidence=$2, transcript_provider=$3, status='transcribed', stages = jsonb_set(coalesce(stages,'{}'::jsonb), '{stt}', $4::jsonb, true), updated_at=NOW() WHERE id=$5`,
          [
            transcript,
            confidence,
            provider,
            JSON.stringify({
              at: new Date().toISOString(),
              provider,
              confidence,
            }),
            assetId,
          ]
        );
        if (RedisService.connected) {
          await RedisService.setCache(
            cacheKey,
            { transcript, confidence, provider },
            options.transcriptTtlSeconds || 21600
          ); // 6h default
        }
        await this._logEvent('audio.stt.success', userId, {
          asset_id: assetId,
          provider,
          confidence,
        });
        return {
          success: true,
          asset_id: assetId,
          transcript,
          confidence,
          provider,
        };
      }
    );
  }

  async preprocess(userId, assetId, options = {}) {
    if (this.mockEnabled) {
      const asset = this._mockAssets.get(Number(assetId));
      if (!asset) return { success: false, error: 'Asset not found' };
      asset.status = 'preprocessed';
      asset.stages.preprocess = {
        at: new Date().toISOString(),
        features: { duration_ms: options.duration_ms || null },
      };
      return { success: true, asset_id: assetId, mock: true };
    }
    return OpenTelemetryTracing.traceOperation(
      'audio.preprocess',
      { attributes: { 'audio.stage': 'preprocess' } },
      async () => {
        const audioRow = await this._getAsset(assetId);
        if (!audioRow) return { success: false, error: 'Asset not found' };
        await this._logEvent('audio.preprocess.start', userId, {
          asset_id: assetId,
        });
        try {
          const features = { duration_ms: options.duration_ms || null };
          await this._updateStage(assetId, 'preprocess', {
            at: new Date().toISOString(),
            features,
          });
          await this._setStatus(assetId, 'preprocessed');
          await this._logEvent('audio.preprocess.success', userId, {
            asset_id: assetId,
          });
          return { success: true, asset_id: assetId };
        } catch (e) {
          await this._updateStage(assetId, 'preprocess', { error: e.message });
          await this._logEvent('audio.preprocess.error', userId, {
            asset_id: assetId,
            error: e.message,
          });
          return { success: false, error: e.message };
        }
      }
    );
  }

  async voiceSwap(userId, assetId, targetVoice, options = {}) {
    if (this.mockEnabled) {
      const asset = this._mockAssets.get(Number(assetId));
      if (!asset) return { success: false, error: 'Asset not found' };
      asset.status = 'voice_swapped';
      asset.stages.voice_swap = {
        at: new Date().toISOString(),
        provider: 'mock',
        targetVoice,
      };
      return { success: true, asset_id: assetId, provider: 'mock', mock: true };
    }
    return OpenTelemetryTracing.traceOperation(
      'audio.voice_swap',
      { attributes: { 'audio.stage': 'voice_swap' } },
      async () => {
        await this._logEvent('audio.voice_swap.start', userId, {
          asset_id: assetId,
          targetVoice,
        });
        const res = await this._runProviders(
          'voice-swap',
          { audioBuffer: Buffer.from('stub'), targetVoice },
          options
        );
        if (!res.success) {
          await this._updateStage(assetId, 'voice_swap', { error: res.error });
          await this._logEvent('audio.voice_swap.error', userId, {
            asset_id: assetId,
            error: res.error,
          });
          return res;
        }
        await this._updateStage(assetId, 'voice_swap', {
          at: new Date().toISOString(),
          provider: res.data.provider,
          targetVoice,
        });
        await this._setStatus(assetId, 'voice_swapped');
        await this._logEvent('audio.voice_swap.success', userId, {
          asset_id: assetId,
          provider: res.data.provider,
          targetVoice,
        });
        return {
          success: true,
          asset_id: assetId,
          provider: res.data.provider,
        };
      }
    );
  }

  async tts(userId, assetId, text, options = {}) {
    if (this.mockEnabled) {
      const asset = this._mockAssets.get(Number(assetId));
      if (!asset) return { success: false, error: 'Asset not found' };
      asset.status = 'tts_generated';
      asset.stages.tts = { at: new Date().toISOString(), provider: 'mock' };
      asset.tts_text = text;
      asset.tts_model = options.model || 'default';
      return { success: true, asset_id: assetId, provider: 'mock', mock: true };
    }
    return OpenTelemetryTracing.traceOperation(
      'audio.tts',
      { attributes: { 'audio.stage': 'tts' } },
      async () => {
        const ttsModel = options.model || 'default';
        const hash = crypto
          .createHash('sha256')
          .update(`${text}|${ttsModel}`)
          .digest('hex');
        const cacheKey = `audio:tts:${hash}`;
        if (RedisService.connected) {
          const cached = await RedisService.getCache(cacheKey);
          if (cached && cached.asset_id) {
            await this._logEvent('audio.tts.cache_hit', userId, {
              asset_id: cached.asset_id,
              hash,
            });
            return {
              success: true,
              asset_id: cached.asset_id,
              provider: cached.provider,
              cache: true,
            };
          }
        }
        await this._logEvent('audio.tts.start', userId, {
          asset_id: assetId,
          hash,
        });
        const res = await this._runProviders(
          'tts',
          { text, model: ttsModel },
          options
        );
        if (!res.success) {
          await this._updateStage(assetId, 'tts', { error: res.error });
          await this._logEvent('audio.tts.error', userId, {
            asset_id: assetId,
            error: res.error,
          });
          return res;
        }
        await pool.query(
          `UPDATE audio_assets SET tts_text=$1, tts_model=$2, status='tts_generated', stages = jsonb_set(coalesce(stages,'{}'::jsonb), '{tts}', $3::jsonb, true), updated_at=NOW() WHERE id=$4`,
          [
            text,
            res.meta?.model || ttsModel || null,
            JSON.stringify({
              at: new Date().toISOString(),
              provider: res.data.provider,
            }),
            assetId,
          ]
        );
        if (RedisService.connected) {
          await RedisService.setCache(
            cacheKey,
            { asset_id: assetId, provider: res.data.provider },
            options.ttsTtlSeconds || 86400
          ); // 24h default
        }
        await this._logEvent('audio.tts.success', userId, {
          asset_id: assetId,
          provider: res.data.provider,
        });
        return {
          success: true,
          asset_id: assetId,
          provider: res.data.provider,
        };
      }
    );
  }

  // Internal helpers
  async _runProviders(task, payload, options) {
    const list = this.providers[task] || [];
    for (const p of list) {
      try {
        const res = await p.execute(payload, options);
        if (res.success) return res;
      } catch (e) {
        // continue to next provider
      }
    }
    return { success: false, error: `All providers failed for task ${task}` };
  }

  async _getAsset(id) {
    if (this.mockEnabled) return this._mockAssets.get(Number(id));
    const r = await pool.query('SELECT * FROM audio_assets WHERE id=$1', [id]);
    return r.rows[0];
  }

  async _updateStage(id, stage, obj) {
    if (this.mockEnabled) {
      const asset = this._mockAssets.get(Number(id));
      if (asset) asset.stages[stage] = obj;
      return;
    }
    await pool.query(
      `UPDATE audio_assets SET stages = jsonb_set(coalesce(stages,'{}'::jsonb), $1, $2::jsonb, true), updated_at=NOW() WHERE id=$3`,
      [`{${stage}}`, JSON.stringify(obj), id]
    );
  }

  async _setStatus(id, status) {
    if (this.mockEnabled) {
      const asset = this._mockAssets.get(Number(id));
      if (asset) asset.status = status;
      return;
    }
    await pool.query(
      'UPDATE audio_assets SET status=$1, updated_at=NOW() WHERE id=$2',
      [status, id]
    );
  }

  async _logEvent(event_type, actor_user_id, metadata) {
    if (this.mockEnabled) {
      // Silent no-op in mock mode
      return;
    }
    try {
      await pool.query(
        'INSERT INTO event_log (event_type, actor_user_id, metadata) VALUES ($1,$2,$3)',
        [
          event_type,
          actor_user_id || null,
          metadata ? JSON.stringify(metadata) : null,
        ]
      );
    } catch (e) {
      // swallow logging errors
    }
  }
}

export default new AudioPipelineOrchestrator();
