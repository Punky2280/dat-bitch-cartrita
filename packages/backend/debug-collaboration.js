import { CollaborativeDocumentEngine } from './src/services/CollaborativeDocumentEngine.js';

console.log('Testing CollaborativeDocumentEngine...');

const engine = new CollaborativeDocumentEngine();
console.log('Engine created:', engine);

const documentId = 'test-doc-1';
const initialContent = 'Hello, world!';

console.log('About to create document...');
const document = engine.createDocument(documentId, initialContent, 'user-1');

console.log('Document created:', document);
console.log('Document content:', document?.content);
console.log('Document revision:', document?.revision);
