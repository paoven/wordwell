"""Build the game dictionary from Oxford headwords and licensed WordNet glosses.

Requires nltk==3.9.2 and pypdf==6.20.1; see src/data/VOCABULARY.md.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re

import nltk
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'src' / 'data'
LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1']
BAD_REGISTER = re.compile(
    r'\b(archaic|obsolete|obsolescent|antiquated|old-fashioned|disused|'
    r'vulgar|offensive|derogatory|disparaging|slur|slang|profanity|obscene|'
    r'pejorative|insulting|contemptuous)\b', re.I)
POS = {'n': 'n', 'v': 'v', 'adj': 'a', 'adv': 'r'}
CATEGORIES = {
    'noun.food': 'Food', 'verb.consumption': 'Food',
    'noun.location': 'Travel', 'verb.motion': 'Travel',
    'noun.possession': 'Business',
    'noun.person': 'People', 'noun.group': 'Society',
    'noun.animal': 'Nature', 'noun.plant': 'Nature',
    'noun.phenomenon': 'Nature', 'noun.substance': 'Nature',
    'noun.body': 'Health', 'noun.state': 'Everyday Life',
    'noun.feeling': 'Feelings', 'verb.emotion': 'Feelings',
    'noun.communication': 'Communication', 'verb.communication': 'Communication',
    'noun.cognition': 'Education', 'verb.cognition': 'Education',
    'noun.time': 'Time', 'noun.quantity': 'Numbers',
}
TOPICS = {
    'Food': 'food drink meal cooking kitchen fruit vegetable bread meat fish taste restaurant hungry thirsty delicious'.split(),
    'Business': 'business work job money bank company trade customer finance financial employee employment office industry industrial economy economic market retail commercial'.split(),
    'Technology': 'computer software internet electronic digital technology telephone wireless electrical electricity machine machinery engine equipment computing online smartphone'.split(),
    'Travel': 'travel travelling transport vehicle road railway airport flight passenger hotel tourism tourist journey destination'.split(),
    'Health': 'health medical medicine illness disease patient hospital doctor treatment surgery symptom injury'.split(),
    'Education': 'education school student teacher university learning study knowledge science scientific research'.split(),
    'Nature': 'nature natural weather environment environmental animal plant ocean river mountain forest climate'.split(),
    'Society': 'government political politics legal law justice election community military religion religious'.split(),
    'Arts & Leisure': 'music musical art artistic sport sports game entertainment film movie theatre theater dance dancing'.split(),
}


def read_headwords(sources):
    entries = {}
    for name in ['oxford3000.pdf', 'oxford5000.pdf']:
        for page in PdfReader(sources / name).pages:
            for line in page.extract_text().splitlines():
                # The number distinguishes homographs, e.g. bow1/bow2.
                match = re.match(r'^([a-z]+)[12]?\s*(n|v|adj|adv)\.', line)
                levels = re.findall(r'\b(?:A[12]|B[12]|C1)\b', line)
                if not match or not levels:
                    continue
                word, pos = match.groups()
                level = min(levels, key=LEVELS.index)
                if word not in entries or LEVELS.index(level) < LEVELS.index(entries[word]['difficulty']):
                    entries[word] = {'difficulty': level, 'pos': POS[pos]}
    return entries


def category_for(word, synset, definition):
    tokens = set(re.findall(r'[a-z]+', word + ' ' + definition.lower()))
    for category, cues in TOPICS.items():
        if tokens.intersection(cues):
            return category
    return CATEGORIES.get(synset.lexname(), 'Everyday Life')


def clean_definition(definition):
    # WordNet occasionally leaves separators where quotations were removed.
    definition = re.sub(r';\s*;.*$', '', definition).strip(' ;')
    return definition


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('sources', type=Path, help='Directory containing the two PDFs and corpora/wordnet.zip')
    args = parser.parse_args()
    nltk.data.path.insert(0, str(args.sources))
    from nltk.corpus import wordnet as wn
    blocked = set(json.loads((DATA / 'vocabulary-exclusions.json').read_text()))
    originals = json.loads((DATA / 'vocabulary-overrides.json').read_text())
    entries = read_headwords(args.sources)
    dictionary = {item['word']: item for item in originals if item['word'] not in blocked}
    for word, item in dictionary.items():
        if word in entries:
            item['difficulty'] = entries[word]['difficulty']
    excluded = Counter()
    skipped = []
    for word, meta in sorted(entries.items()):
        if word in dictionary:
            continue
        if word in blocked:
            excluded['excludedWords'] += 1
            continue
        if not 2 <= len(word) <= 18:
            excluded['length'] += 1
            continue
        candidates = wn.synsets(word, pos=meta['pos'])
        chosen = None
        for synset in candidates:
            # Exact lowercase headwords only: no morphological guesses or names.
            if word not in [lemma.name() for lemma in synset.lemmas()]:
                continue
            definition = clean_definition(synset.definition())
            if len(definition) < 21 or BAD_REGISTER.search(definition):
                continue
            if any(re.search(r'\b' + re.escape(term) + r'\b', definition, re.I) for term in blocked):
                continue
            # Avoid clues which disclose the answer.
            if re.search(r'\b' + re.escape(word) + r'\b', definition, re.I):
                continue
            chosen = synset
            break
        if chosen is None:
            excluded['noSuitableDefinition'] += 1
            skipped.append(word)
            continue
        definition = clean_definition(chosen.definition())
        definition = definition[0].upper() + definition[1:]
        if not definition.endswith(('.', '!', '?')):
            definition += '.'
        dictionary[word] = {
            'word': word, 'definition': definition,
            'category': category_for(word, chosen, definition),
            'difficulty': meta['difficulty'],
        }
    # Keep existing entries first; append in alphabetical order for stable builds.
    words = list(dictionary.values())
    (DATA / 'vocabulary.json').write_text(json.dumps(words, ensure_ascii=False, indent=2) + '\n')
    provenance = {
        'count': len(words), 'headwordsParsed': len(entries),
        'levels': dict(sorted(Counter(w['difficulty'] for w in words).items())),
        'categories': dict(sorted(Counter(w['category'] for w in words).items())),
        'excluded': dict(excluded), 'wordsWithoutSuitableDefinition': skipped,
        'sourceSha256': {name: hashlib.sha256((args.sources / name).read_bytes()).hexdigest()
                         for name in ['oxford3000.pdf', 'oxford5000.pdf', 'corpora/wordnet.zip']},
    }
    (DATA / 'vocabulary-build.json').write_text(json.dumps(provenance, indent=2) + '\n')
    license_text = '\n'.join(line.rstrip() for line in wn.open('LICENSE').read().splitlines()) + '\n'
    (ROOT / 'public').mkdir(exist_ok=True)
    (ROOT / 'public' / 'wordnet-license.txt').write_text(license_text)
    print(json.dumps({key: value for key, value in provenance.items()
                      if key not in ['sourceSha256', 'wordsWithoutSuitableDefinition']}, indent=2))


if __name__ == '__main__':
    main()
