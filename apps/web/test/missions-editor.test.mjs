import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeMissionEditor, renderMissionEditor } from '../src/missions/mission-editor.js';
const A=(v)=>'0x'+v.repeat(40).slice(0,40);
function form(overrides={}){ const values={title:'Build',summary:'Build safely',roles:'builder, reviewer',application_deadline:'2026-10-20T00:00',launch_deadline:'2026-10-21T00:00',token:A('1'),symbol:'USDC',amount_raw:'1000000',recipient:A('2'),...overrides}; return {get:(key)=>values[key]??null}; }
test('editor requires raw token units, immutable recipient address, roles, and deadlines',()=>{ const value=normalizeMissionEditor(form()); assert.equal(value.allocations[0].amountRaw,'1000000'); assert.equal(value.allocations[0].recipient,A('2')); assert.deepEqual(value.roles,['builder','reviewer']); assert.ok(value.launchDeadline>value.applicationDeadline); assert.match(renderMissionEditor(),/Publishing opens public recruiting.*No token transfer occurs/); });
test('editor rejects numbers with formatting, malformed addresses, and empty roles',()=>{ assert.throws(()=>normalizeMissionEditor(form({amount_raw:'1,000'})),/canonical decimal/); assert.throws(()=>normalizeMissionEditor(form({recipient:'0x123'})),/Address/); assert.throws(()=>normalizeMissionEditor(form({roles:''})),/role/); });
