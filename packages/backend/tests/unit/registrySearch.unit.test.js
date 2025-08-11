import CompositeRegistry from '../../src/agi/orchestration/CompositeRegistry.js';
import registerSystemTools from '../../src/agi/orchestration/registries/systemRegistry.js';

describe('Keyword scoring (unit)',()=>{test('system tool present',async()=>{const reg=new CompositeRegistry();reg.addMiniRegistry('system',0,registerSystemTools);await reg.initialize();expect(reg.listTools()).toContain('getCurrentDateTime');});});
