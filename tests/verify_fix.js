const { loadCorpus, tokenizeInput } = require('../src/utils');
const { LanguageModel } = require('../src/model');
const { BeamSearch } = require('../src/search');
const path = require('path');

const CORPUS_PATH = path.join(__dirname, '..', 'data', 'corpus.txt');

function test() {
    console.log('--- Verification Test ---');
    const tokenizedCorpus = loadCorpus(CORPUS_PATH);
    const model = new LanguageModel();
    model.train(tokenizedCorpus);
    const searcher = new BeamSearch(model, 10);

    const input = 'infinite to place there be is';
    const tokens = tokenizeInput(input);
    const reconstructed = searcher.search(tokens);

    let sentence = reconstructed.join(' ');
    sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';

    console.log(`Jumbled: ${input}`);
    console.log(`Reconstructed: ${sentence}`);

    const expectedPatterns = [
        'There is infinite place to be.',
        'There is an infinite place to be.',
        'Infinite place to be is there.',
        'To be is infinite place there.' // This was the old bad output
    ];

    if (sentence.includes('There is') || sentence.includes('Infinite')) {
        console.log('SUCCESS: Reconstruction looks much better!');
    } else {
        console.log('FAILURE: Reconstruction still looks poor.');
    }
}

test();
