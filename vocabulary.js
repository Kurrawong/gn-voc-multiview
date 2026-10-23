import { Parser, Store, DataFactory } from 'n3';
const { namedNode } = DataFactory;
export const BASE = 'https://example.com/def/gn-status-types/';
const SKOS = 'http://www.w3.org/2004/02/skos/core#';
const TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
export function parseVocabulary(turtle) {
  const store = new Store(new Parser().parse(turtle));
  const objects = (id, property) => store.getObjects(namedNode(id), namedNode(SKOS + property), null);
  const concepts = new Map(store.getSubjects(namedNode(TYPE), namedNode(SKOS + 'Concept'), null).map(subject => {
    const id = subject.value;
    return [id, { id, creators: store.getObjects(subject, namedNode('https://schema.org/creator'), null).map(term => term.value), notations: objects(id, 'notation'), definitions: objects(id, 'definition'), preferred: objects(id, 'prefLabel'), alternatives: objects(id, 'altLabel'), parents: new Set(), children: new Set() }];
  }));
  const connect = (parent, child) => {
    if (concepts.has(parent) && concepts.has(child)) {
      concepts.get(parent).children.add(child);
      concepts.get(child).parents.add(parent);
    }
  };
  for (const concept of concepts.values()) {
    objects(concept.id, 'broader').forEach(parent => connect(parent.value, concept.id));
    objects(concept.id, 'narrower').forEach(child => connect(concept.id, child.value));
  }
  return { concepts, members: jurisdiction => objects(BASE + jurisdiction, 'member').map(term => term.value) };
}
export function selectedLabels(concept, jurisdiction) {
  const alternatives = jurisdiction !== 'national' && jurisdiction !== 'all'
    ? concept.alternatives.filter(term => term.datatype?.value === BASE + jurisdiction) : [];
  const selected = alternatives.length ? alternatives : concept.preferred;
  return [...new Set(selected.map(term => term.value))];
}
export function viewFor(vocabulary, jurisdiction) {
  const { concepts } = vocabulary;
  const nationalCreator = 'https://linked.data.gov.au/org/icsm';
  const jurisdictionCreator = 'https://linked.data.gov.au/org/' + jurisdiction;
  const included = new Set([...concepts.values()].filter(concept =>
    jurisdiction === 'all' || concept.creators.includes(nationalCreator) ||
    (jurisdiction !== 'national' && concept.creators.includes(jurisdictionCreator))
  ).map(concept => concept.id));
  return { included, roots: [...included].filter(id => ![...concepts.get(id).parents].some(parent => included.has(parent))) };
}

export function labelsFor(concept, jurisdiction) {
  return selectedLabels(concept, jurisdiction).join(' / ') || concept.id;
}
export function conceptInformation(concept, jurisdiction) {
  const selected = selectedLabels(concept, jurisdiction);
  const abbreviations = { icsm: 'ICSM', act: 'ACT', nt: 'NT', nsw: 'NSW', qld: 'Qld', tas: 'Tas', vic: 'Vic', sa: 'SA', wa: 'WA', aad: 'AAD', aho: 'AHO' };
  const acronymFor = term => {
    const datatype = term.datatype?.value || '';
    const code = datatype.startsWith(BASE) ? datatype.slice(BASE.length)
      : datatype.match(/\/dataset\/([a-z]+)-gn\/datatype\//)?.[1];
    return abbreviations[code];
  };
  const jurisdictionOrder = ['ACT', 'NT', 'NSW', 'Qld', 'Tas', 'Vic', 'SA', 'WA', 'AAD'];
  const acronymRank = acronym => {
    const index = jurisdictionOrder.indexOf(acronym);
    return index < 0 ? jurisdictionOrder.length : index;
  };
  const groupTerms = terms => {
    const groups = new Map();
    for (const term of terms) {
      if (!groups.has(term.value)) groups.set(term.value, new Set());
      const acronym = acronymFor(term);
      if (acronym) groups.get(term.value).add(acronym);
    }
    return [...groups].map(([value, acronyms]) => acronyms.size
      ? value + ' (' + [...acronyms].sort((a, b) => acronymRank(a) - acronymRank(b) || a.localeCompare(b)).join(', ') + ')' : value);
  };
  return {
    label: labelsFor(concept, jurisdiction),
    alternatives: groupTerms([...concept.preferred, ...concept.alternatives].filter(term => !selected.includes(term.value))),
    notations: groupTerms(concept.notations),
    definitions: [...new Set(concept.definitions.map(term => term.value))],
    creators: concept.creators.map(iri => abbreviations[iri.split('/').pop()] || iri.split('/').pop().toUpperCase())
  };
}
