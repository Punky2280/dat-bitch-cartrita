import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';
import PersonaMapperService from '../services/persona/PersonaMapperService.js';
import db from '../db.js';
import { isLightweight } from '../util/env.js';

const router = express.Router();

// GET current persona_config + derived params
router.get('/', authenticateToken, async (req, res) => {
  try {
    let persona;
    try {
      persona = await PersonaMapperService.getUserPersona(req.user.id);
    } catch (inner) {
      if (isLightweight()) {
        persona = PersonaMapperService.defaultPersona();
      } else throw inner;
    }
    const derived = PersonaMapperService.deriveLLMParams(persona);
    res.json({ success: true, persona, derived });
  } catch (e) {
    console.error('[Persona] get error', e);
    res.status(500).json({ success: false, error: 'Failed to fetch persona' });
  }
});

// PUT update persona_config
router.put('/', authenticateToken, async (req, res) => {
  try {
    let saved;
    try {
      saved = await PersonaMapperService.saveUserPersona(
        req.user.id,
        req.body || {}
      );
    } catch (inner) {
      if (isLightweight()) {
        // Persist skipped; just normalize input
        saved = PersonaMapperService.normalize(req.body || {});
      } else throw inner;
    }
    const derived = PersonaMapperService.deriveLLMParams(saved);
    if (!isLightweight()) {
      try {
        await db.query(
          `INSERT INTO event_log (event_type, actor_user_id, metadata) VALUES ($1,$2,$3)`,
          ['persona.updated', req.user.id, JSON.stringify({ persona: saved })]
        );
      } catch (evErr) {
        console.warn('[Persona] event log insert skipped:', evErr.message);
      }
    }
    res.json({ success: true, persona: saved, derived });
  } catch (e) {
    console.error('[Persona] update error', e);
    res.status(500).json({ success: false, error: 'Failed to update persona' });
  }
});

// GET presets list
router.get('/presets', authenticateToken, async (req, res) => {
  try {
    const presets = await PersonaMapperService.listPresets(req.user.id);
    res.json({ success: true, presets });
  } catch (e) {
    console.error('[Persona] list presets error', e);
    res.status(500).json({ success: false, error: 'Failed to list presets' });
  }
});

// POST create preset
router.post('/presets', authenticateToken, async (req, res) => {
  try {
    const { name, persona_config } = req.body || {};
    if (!name)
      return res.status(400).json({ success: false, error: 'name required' });
    const preset = await PersonaMapperService.createPreset(
      req.user.id,
      name.slice(0, 60),
      persona_config || {}
    );
    await db.query(
      `INSERT INTO event_log (event_type, actor_user_id, metadata) VALUES ($1,$2,$3)`,
      [
        'persona.preset.created',
        req.user.id,
        JSON.stringify({ id: preset.id, name }),
      ]
    );
    res.status(201).json({ success: true, preset });
  } catch (e) {
    console.error('[Persona] create preset error', e);
    res.status(500).json({ success: false, error: 'Failed to create preset' });
  }
});

// DELETE preset
router.delete('/presets/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (Number.isNaN(id))
      return res.status(400).json({ success: false, error: 'invalid id' });
    await PersonaMapperService.deletePreset(req.user.id, id);
    await db.query(
      `INSERT INTO event_log (event_type, actor_user_id, metadata) VALUES ($1,$2,$3)`,
      ['persona.preset.deleted', req.user.id, JSON.stringify({ id })]
    );
    res.json({ success: true, deleted: id });
  } catch (e) {
    console.error('[Persona] delete preset error', e);
    res.status(500).json({ success: false, error: 'Failed to delete preset' });
  }
});

export default router;
