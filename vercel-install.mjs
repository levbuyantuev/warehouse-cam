import { readFileSync, writeFileSync } from 'fs';

// Patch 1: warehouse-cam – replace workspace:* with file: path for npm compatibility
const CAM = 'artifacts/warehouse-cam/package.json';
const cam = JSON.parse(readFileSync(CAM, 'utf8'));
if (cam.devDependencies?.['@workspace/api-client-react'] === 'workspace:*') {
  cam.devDependencies['@workspace/api-client-react'] = 'file:../../lib/api-client-react';
  writeFileSync(CAM, JSON.stringify(cam, null, 2) + '\n');
  console.log('✓ warehouse-cam: @workspace/api-client-react → file:../../lib/api-client-react');
}

// Patch 2: root package.json – add npm workspaces (only what Vercel needs to build)
const ROOT = 'package.json';
const root = JSON.parse(readFileSync(ROOT, 'utf8'));
root.workspaces = ['lib/api-client-react', 'artifacts/warehouse-cam'];
writeFileSync(ROOT, JSON.stringify(root, null, 2) + '\n');
console.log('✓ root package.json: workspaces added for npm');
