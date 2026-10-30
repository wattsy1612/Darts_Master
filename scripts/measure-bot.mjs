import { createServer } from 'vite';

// Load the same TypeScript domain used by the app; do not duplicate its rules.
const server = await createServer({
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
  logLevel: 'silent',
});
try {
  const { measureBot } = await server.ssrLoadModule(
    '/src/domain/botCalibration.ts',
  );
  const report = ['rookie', 'regular', 'sharp'].map((bot) => ({
    bot,
    ...measureBot(
      { players: ['A', 'Bot'], start: 501, legsToWin: 1, bot },
      1000,
    ),
  }));
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} finally {
  await server.close();
}
