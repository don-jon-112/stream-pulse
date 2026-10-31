const { spawn } = require('child_process');
const electron = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

console.log('[StreamPulse HUD] Starting In-Game Overlay...');

const child = spawn(electron, ['.'], {
  stdio: 'inherit',
  env,
  windowsHide: false
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
