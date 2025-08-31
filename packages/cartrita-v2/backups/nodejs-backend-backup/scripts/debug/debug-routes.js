import express from 'express';

const app = express();

// Attempt to load routes manually
async function loadRoutes() {
  try {
    const { default: authRoutes } = await import('../../src/routes/auth.js');
    app.use('/api/auth', authRoutes);
    console.log('✅ Auth routes loaded');
  } catch (error) {
    console.error('❌ Auth routes failed:', error.message);
  }

  try {
    const { default: chatRoutes } = await import(
      '../../src/routes/chatHistory.js'
    );
    app.use('/api/chat', chatRoutes);
    console.log('✅ Chat routes loaded');
  } catch (error) {
    console.error('❌ Chat routes failed:', error.message);
  }
}

// List all registered routes
function listRoutes(app) {
  const routes = [];

  app._router.stack.forEach(middleware => {
    if (middleware.route) {
      routes.push({
        method: Object.keys(middleware.route.methods)[0].toUpperCase(),
        path: middleware.route.path,
      });
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach(handler => {
        if (handler.route) {
          routes.push({
            method: Object.keys(handler.route.methods)[0].toUpperCase(),
            path:
              middleware.regexp.source.replace('\\/?(?=\\/|$)', '') +
              handler.route.path,
          });
        }
      });
    }
  });

  return routes;
}

const registered = listRoutes(app);
console.log('\n📋 Registered Routes:');
registered.forEach(route => {
  console.log(`${route.method} ${route.path}`);
});

console.log(`\n🔍 Total registered routes: ${registered.length}`);
console.log(
  `🧠 Route paths:`,
  registered.map(r => r.path)
);

export default app;
