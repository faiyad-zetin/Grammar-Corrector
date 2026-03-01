const natural = require('natural');
const path = require('path');

async function testPOS() {
    console.log('Testing POS Tagger...');
    const language = "EN"
    const defaultCategory = 'N';
    const lexicon = new natural.Lexicon(null, defaultCategory);
    const rules = new natural.RuleSet(null);
    const tagger = new natural.BrillPOSTagger(lexicon, rules);

    const sentence = ["the", "guy", "who", "is", "sleeping"];
    const tagged = tagger.tag(sentence);
    console.log(JSON.stringify(tagged, null, 2));
}

testPOS();
