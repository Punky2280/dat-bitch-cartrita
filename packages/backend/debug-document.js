// Simple test without full tracing
import { CollaborativeDocument } from './src/services/CollaborativeDocumentEngine.js';

console.log('Testing CollaborativeDocument directly...');

const document = new CollaborativeDocument('test-doc-1', 'Hello, world!');

console.log('Document created:', document);
console.log('Document content:', document.content);
console.log('Document revision:', document.revision);
