import BaseProvider, { ProviderError } from './BaseProvider.js';
import keyVaultService from '../../../services/security/keyVaultService.js';

export default class DeepgramSTTProvider extends BaseProvider {
  constructor() {
    super('deepgram', ['stt']);
  }

  async execute(payload, options = {}) {
    const { audioBuffer } = payload;
    if (!audioBuffer)
      throw new ProviderError('Missing audioBuffer', 'INVALID_INPUT');

    try {
      const keyRecord = await keyVaultService.get('deepgram_api_key');
      if (!keyRecord || !keyRecord.decryptedKey) {
        return { success: false, error: 'Deepgram key unavailable' };
      }
      // TODO: Integrate real Deepgram API call using keyRecord.decryptedKey
      return {
        success: true,
        data: {
          transcript: '[stub transcript]',
          confidence: 0.0,
          provider: 'deepgram',
        },
        meta: { model: options.model || 'nova-2' },
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}
