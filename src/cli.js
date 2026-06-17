#!/usr/bin/env node
'use strict';

const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createServer } = require('./server');

function parseArgs(argv) {
  const args = [...argv];
  const command = args[0] && !args[0].startsWith('-') ? args.shift() : 'open';
  let port = 0;

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--port') {
      port = Number(args[index + 1]);
      index += 1;
    }
  }

  return { command, port };
}

function slugName(projectDir) {
  return path.basename(projectDir).replace(/[^a-zA-Z0-9._-]/g, '-');
}

function runtimePathForProject(projectDir, homeDir = path.join(os.homedir(), '.aictrl')) {
  const resolved = path.resolve(projectDir);
  const digest = crypto.createHash('sha1').update(resolved).digest('hex').slice(0, 10);

  return path.join(homeDir, 'projects', `${slugName(resolved)}-${digest}`);
}

async function openProject({ projectDir = process.cwd(), port = 0, stdout = process.stdout } = {}) {
  const runtimePath = runtimePathForProject(projectDir);
  const statePath = path.join(runtimePath, 'state.json');
  const app = createServer({ projectDir, statePath, port });

  await app.listen();
  stdout.write(`aictrl running at http://127.0.0.1:${app.port}\n`);
  stdout.write(`project: ${projectDir}\n`);
  stdout.write(`state: ${statePath}\n`);

  return app;
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);

  if (args.command !== 'open') {
    process.stderr.write(`Unknown command: ${args.command}\n`);
    process.exitCode = 1;
    return null;
  }

  return openProject({ port: args.port });
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  runtimePathForProject,
  openProject,
  main
};
