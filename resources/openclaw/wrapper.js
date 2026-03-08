console.log("WRAPPER ENV:", process.env.OPENCLAW_PROCESS_NAME);
// Wrapper to set process title and launch OpenClaw
process.title = process.env.OPENCLAW_PROCESS_NAME || 'clawstation-engine';

// Forward to the actual entry point
try {
  await import('./dist/entry.js');
} catch (err) {
  console.error('Failed to launch OpenClaw:', err);
  process.exit(1);
}
