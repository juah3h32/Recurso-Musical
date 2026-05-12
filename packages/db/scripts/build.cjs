const { execSync } = require('child_process');
execSync('npx tsc', { stdio: 'inherit' });
