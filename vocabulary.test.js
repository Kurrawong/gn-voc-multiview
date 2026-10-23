import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BASE, parseVocabulary, labelsFor, viewFor } from './vocabulary.js';
const vocabulary = parseVocabulary(readFileSync(new URL('./gn-status-types.ttl', import.meta.url), 'utf8'));
test('all concepts have creators; National contains only the seven ICSM concepts', () => {
  for (const concept of vocabulary.concepts.values()) assert.ok(concept.creators.length);
  const view = viewFor(vocabulary, 'national');
  assert.equal(view.included.size, 7);
  assert.equal(view.roots.length, 7);
  for (const id of view.included) assert.ok(vocabulary.concepts.get(id).creators.includes('https://linked.data.gov.au/org/icsm'));
  assert.equal(viewFor(vocabulary, 'all').included.size, 51);
});
test('labels use matching jurisdiction datatypes; National and All always use preferred labels', () => {
  const official = vocabulary.concepts.get(BASE + 'official');
  assert.equal(labelsFor(official, 'nsw'), 'Official Assigned');
  assert.equal(labelsFor(official, 'qld'), 'Official');
  assert.equal(labelsFor(official, 'national'), 'Official');
  assert.equal(labelsFor(official, 'all'), 'Official');
  assert.equal(labelsFor(vocabulary.concepts.get(BASE + 'recorded'), 'sa'), 'Local / Variant');
  assert.equal(labelsFor(vocabulary.concepts.get(BASE + 'proposed'), 'act'), 'Proposed');
});
test('jurisdictions include exactly national and their creator concepts, including shared creators', () => {
  for (const jurisdiction of ['act','nt','nsw','qld','tas','vic','sa','wa','aad']) {
    const { included } = viewFor(vocabulary, jurisdiction);
    for (const concept of vocabulary.concepts.values()) {
      assert.equal(included.has(concept.id), concept.creators.includes('https://linked.data.gov.au/org/icsm') || concept.creators.includes('https://linked.data.gov.au/org/' + jurisdiction));
    }
  }
  assert.ok(viewFor(vocabulary, 'nt').included.has(BASE + 'assigned'));
  assert.ok(viewFor(vocabulary, 'qld').included.has(BASE + 'assigned'));
  assert.ok(!viewFor(vocabulary, 'wa').included.has(BASE + 'advertise'));
});

test('modal information excludes displayed labels and includes notation, definition and creator abbreviations', async () => {
  const { conceptInformation } = await import('./vocabulary.js');
  const recorded = conceptInformation(vocabulary.concepts.get(BASE + 'recorded'), 'sa');
  assert.equal(recorded.label, 'Local / Variant');
  assert.ok(recorded.alternatives.includes('Recorded'));
  assert.ok(!recorded.alternatives.includes('Local'));
  assert.ok(!recorded.alternatives.includes('Variant'));
  assert.ok(recorded.notations.includes('RECD (SA)'));
  assert.ok(recorded.definitions[0].startsWith('A name'));
  assert.deepEqual(recorded.creators, ['ICSM']);
  const assigned = conceptInformation(vocabulary.concepts.get(BASE + 'assigned'), 'qld');
  assert.deepEqual(new Set(assigned.creators), new Set(['NT', 'Qld']));
  assert.deepEqual(assigned.notations, []);
});

test('modal groups identical alternative labels with all datatype jurisdictions', async () => {
  const { conceptInformation } = await import('./vocabulary.js');
  const recorded = conceptInformation(vocabulary.concepts.get(BASE + 'recorded'), 'national');
  assert.ok(recorded.alternatives.includes('Variant (NSW, SA)'));
  assert.equal(recorded.alternatives.filter(label => label.startsWith('Variant')).length, 1);
  assert.ok(recorded.alternatives.includes('Acknowledged (AAD)'));
  assert.ok(recorded.notations.includes('U (WA)'));
  const proposed = conceptInformation(vocabulary.concepts.get(BASE + 'proposed'), 'national');
  assert.ok(proposed.alternatives.includes('Unapproved'));
});

test('modal groups identical notations and deduplicates jurisdiction acronyms', async () => {
  const { conceptInformation } = await import('./vocabulary.js');
  const concept = {
    ...vocabulary.concepts.get(BASE + 'recorded'),
    notations: [
      { value: 'X', datatype: { value: 'https://example.com/dataset/sa-gn/datatype/sappa' } },
      { value: 'X', datatype: { value: 'https://example.com/dataset/wa-gn/datatype/geonoma' } },
      { value: 'X', datatype: { value: BASE + 'sa' } },
      { value: 'Y', datatype: { value: BASE + 'nsw' } },
      { value: 'Z' }
    ]
  };
  assert.deepEqual(conceptInformation(concept, 'national').notations, ['X (SA, WA)', 'Y (NSW)', 'Z']);
});

test('alternative label and notation acronyms follow the View dropdown order', async () => {
  const { conceptInformation } = await import('./vocabulary.js');
  const terms = ['aad', 'wa', 'sa', 'vic', 'tas', 'qld', 'nsw', 'nt', 'act'].map(code => ({
    value: 'Shared', datatype: { value: BASE + code }
  }));
  const concept = { ...vocabulary.concepts.get(BASE + 'recorded'), alternatives: terms, notations: terms };
  const info = conceptInformation(concept, 'national');
  const expected = 'Shared (ACT, NT, NSW, Qld, Tas, Vic, SA, WA, AAD)';
  assert.deepEqual(info.alternatives, [expected]);
  assert.deepEqual(info.notations, [expected]);
});
