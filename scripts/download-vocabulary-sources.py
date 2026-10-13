"""Download the build inputs; never runs as part of the app or npm build."""
import argparse
from pathlib import Path
from urllib.request import Request, urlopen

import nltk

parser = argparse.ArgumentParser()
parser.add_argument('destination', type=Path)
args = parser.parse_args()
args.destination.mkdir(parents=True, exist_ok=True)
base = 'https://www.oxfordlearnersdictionaries.co.uk/external/pdf/wordlists/oxford-3000-5000/'
for local, remote in [('oxford3000.pdf', 'The_Oxford_3000.pdf'), ('oxford5000.pdf', 'The_Oxford_5000.pdf')]:
    with urlopen(Request(base + remote, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60) as response:
        (args.destination / local).write_bytes(response.read())
nltk.download('wordnet', download_dir=str(args.destination), raise_on_error=True)
