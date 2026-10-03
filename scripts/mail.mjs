#!/usr/bin/env node
import { createMailbox, loadConfig } from './mailbox.mjs';
import { readFile } from 'node:fs/promises';

const usage = 'Usage: node scripts/mail.mjs <command> --config <local-config.json> [--input <request.json>]';
const [command, ...args] = process.argv.slice(2);
let configFile, inputFile;
try {
  for (let index = 0; index < args.length; index += 2) {
    if (!args[index + 1]) throw new Error(usage);
    if (args[index] === '--config' && !configFile) configFile = args[index + 1];
    else if (args[index] === '--input' && !inputFile) inputFile = args[index + 1];
    else throw new Error(usage);
  }
  if (!command || !configFile) throw new Error(usage);
  const config = await loadConfig(configFile);
  const input = inputFile ? JSON.parse(await readFile(inputFile, 'utf8')) : {};
  const result = await createMailbox(config).execute(command, input);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exitCode = result.code;
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, code: 2, error: error.message === usage ? usage : 'Invalid local config/input; check readable JSON and documented schema' }, null, 2) + '\n');
  process.exitCode = 2;
}
