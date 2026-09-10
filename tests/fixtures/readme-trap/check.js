import assert from 'node:assert/strict';
import { consume } from './consumer.js';
assert.equal(consume({ ready: true, tasks: ['build'] }).action, 'execute');
