const { LanguageModel } = require('../src/model');
const { BeamSearch } = require('../src/search');
const { tokenizeInput } = require('../src/utils');

async function testComplexFix() {
    console.log('Verifying Fix for Complex Sentence...');
    const model = new LanguageModel(4);
    const searcher = new BeamSearch(model, 100);

    const input = 'living guy who room in sleeping a is the like baby is the';
    const tokens = tokenizeInput(input);
    console.log(`Input tokens: ${tokens.join(', ')}`);

    console.log('Searching...');
    const result = await searcher.search(tokens);
    console.log(`Result: ${result.join(' ')}`);
}

testComplexFix().catch(console.error);
