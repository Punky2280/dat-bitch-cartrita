import db from '../../db.js';

/**
 * PersonaMapperService
 * Validates and normalizes a persona_config object and derives model generation parameters.
 * Traits (0-10 unless boolean): tone, creativity, empathy, analytical_depth, brevity, humor, proactivity
 * Optional: domain_focus (array of strings), style_notes (string)
 */
class PersonaMapperService {
  static TRAIT_BOUNDS = {
    tone: [0, 10],
    creativity: [0, 10],
    empathy: [0, 10],
    analytical_depth: [0, 10],
    brevity: [0, 10],
    humor: [0, 10],
    proactivity: [0, 10],
  };

  /** Validate & clamp persona config */
  static normalize(persona) {
    if (!persona || typeof persona !== 'object') return this.defaultPersona();
    const out = { ...this.defaultPersona(), ...persona };
    for (const [k, [min, max]] of Object.entries(this.TRAIT_BOUNDS)) {
      let v = Number(out[k]);
      if (Number.isNaN(v)) v = out[k];
      if (typeof v !== 'number') v = (min + max) / 2;
      if (v < min) v = min;
      if (v > max) v = max;
      out[k] = Math.round(v * 10) / 10; // one decimal
    }
    if (Array.isArray(out.domain_focus)) {
      out.domain_focus = out.domain_focus
        .map(s => String(s).slice(0, 40))
        .slice(0, 5);
    } else {
      out.domain_focus = [];
    }
    if (out.style_notes)
      out.style_notes = String(out.style_notes).slice(0, 400);

    // --- Interaction Modes Normalization ---
    // Ensure object shape { empathetic, witty, direct, analytical } booleans.
    const defaultModes = this.defaultInteractionModes();
    const modesIn =
      out.interaction_modes && typeof out.interaction_modes === 'object'
        ? out.interaction_modes
        : {};
    const modes = {};
    for (const k of Object.keys(defaultModes)) {
      modes[k] = Boolean(modesIn[k]);
    }
    // If none true, default to witty true as a safe engaging baseline
    if (!Object.values(modes).some(Boolean)) {
      modes.witty = true;
    }
    out.interaction_modes = modes;
    return out;
  }

  /** Map traits to LLM parameter suggestions */
  static deriveLLMParams(persona) {
    const p = this.normalize(persona);
    const scale = (v, min, max) => min + (max - min) * (v / 10);
    const temperature = Number(
      scale((p.creativity + p.humor) / 2, 0.3, 1.2).toFixed(2)
    );
    const top_p = Number(scale(p.creativity, 0.7, 1.0).toFixed(2));
    const max_output_tokens = Math.round(
      scale(10 - p.brevity + p.analytical_depth, 256, 2048)
    );
    const reasoning_depth = Math.round(scale(p.analytical_depth, 1, 8));
    const suggestion_interval = Math.max(
      2,
      12 - Math.round(scale(p.proactivity, 2, 10))
    ); // lower is more frequent
    const humor_probability = Number(scale(p.humor, 0, 0.45).toFixed(3));
    const empathy_tone =
      p.empathy >= 7 ? 'high' : p.empathy >= 4 ? 'balanced' : 'minimal';
    const style_directness =
      p.brevity >= 7 ? 'concise' : p.brevity <= 3 ? 'elaborate' : 'balanced';
    return {
      temperature,
      top_p,
      max_output_tokens,
      reasoning_depth,
      humor_probability,
      suggestion_interval,
      style: {
        empathy: empathy_tone,
        directness: style_directness,
        tone_level: p.tone,
      },
      persona: p,
    };
  }

  /** Build a concise system prompt section expressing persona traits & interaction modes */
  static buildPrompt(personaInput) {
    const { persona, temperature, top_p, max_output_tokens, reasoning_depth } =
      this.deriveLLMParams(personaInput);
    const modes = Object.entries(persona.interaction_modes)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(', ');
    const domains = persona.domain_focus.length
      ? persona.domain_focus.join(', ')
      : 'general knowledge';
    return `Persona Guidance:\n- Active interaction modes: ${modes || 'witty'}\n- Tone level: ${persona.tone}/10 | Empathy: ${persona.empathy}/10 | Brevity: ${persona.brevity}/10 | Humor: ${persona.humor}/10 | Proactivity: ${persona.proactivity}/10 | Analytical Depth: ${persona.analytical_depth}/10\n- Domain focus: ${domains}\n- Style notes: ${persona.style_notes || 'n/a'}\nModel Hints: temperature=${temperature}, top_p=${top_p}, max_tokens≈${max_output_tokens}, reasoning_depth=${reasoning_depth}.\nHonor brevity & empathy levels while preserving factual accuracy. Adjust humor to humor score (0–10 scaled).`;
  }

  static defaultPersona() {
    return {
      tone: 5,
      creativity: 5,
      empathy: 5,
      analytical_depth: 5,
      brevity: 5,
      humor: 4,
      proactivity: 5,
      domain_focus: [],
      style_notes: '',
      interaction_modes: this.defaultInteractionModes(),
    };
  }

  static defaultInteractionModes() {
    return {
      empathetic: true, // start with both empathetic & witty to balance tone
      witty: true,
      direct: false,
      analytical: false,
    };
  }

  /** Persist persona_config for user */
  static async saveUserPersona(userId, personaConfig) {
    const normalized = this.normalize(personaConfig);
    await db.query(
      `UPDATE user_preferences SET persona_config = $2, updated_at = NOW() WHERE user_id = $1`,
      [userId, JSON.stringify(normalized)]
    );
    return normalized;
  }

  static async getUserPersona(userId) {
    const res = await db.query(
      'SELECT persona_config FROM user_preferences WHERE user_id = $1',
      [userId]
    );
    if (res.rows.length === 0 || !res.rows[0].persona_config)
      return this.defaultPersona();
    return this.normalize(res.rows[0].persona_config);
  }

  static async listPresets(userId) {
    const res = await db.query(
      'SELECT id, name, persona_config, created_at FROM persona_presets WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return res.rows.map(r => ({
      ...r,
      persona_config: this.normalize(r.persona_config),
    }));
  }

  static async createPreset(userId, name, personaConfig) {
    const normalized = this.normalize(personaConfig);
    const res = await db.query(
      `INSERT INTO persona_presets (user_id, name, persona_config) VALUES ($1,$2,$3) RETURNING id, name, persona_config, created_at`,
      [userId, name, JSON.stringify(normalized)]
    );
    return { ...res.rows[0], persona_config: normalized };
  }

  static async deletePreset(userId, id) {
    await db.query(
      'DELETE FROM persona_presets WHERE user_id = $1 AND id = $2',
      [userId, id]
    );
  }
}

export default PersonaMapperService;
