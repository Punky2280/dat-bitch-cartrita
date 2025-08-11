process.env.LIGHTWEIGHT_TEST='1';
console.log('[jest.setup] environment variables prepared');
// Debug: show test globals to confirm Jest runtime started
if (typeof global.expect === 'function') {
	console.log('[jest.setup] expect global present');
} else {
	console.log('[jest.setup] expect global MISSING');
}
process.env.LIGHTWEIGHT_TEST='1';
