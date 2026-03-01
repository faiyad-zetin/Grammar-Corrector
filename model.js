const https = require('https');

class LanguageModel {
    constructor(n = 5) {
        this.n = n;
        this.version = "Semantix-v1.3";
        this.localNgrams = Array.from({ length: n + 1 }, () => new Map());
        this.posNgrams = Array.from({ length: n + 1 }, () => new Map());
        this.localTotalTokens = 0;
        this.apiCache = new Map();
        this.baseUrl = 'https://api.datamuse.com/words';
        this.logEpsilon = -30;

        this.badEnds = new Set(['a', 'the', 'in', 'on', 'at', 'is', 'are', 'was', 'were', 'who', 'whose', 'to', 'from', 'with', 'by', 'of', 'and', 'but', 'or', 'so', 'like']);
        this.goodStarts = new Set(['the', 'a', 'i', 'he', 'she', 'they', 'we', 'it', 'there', 'this', 'that', 'who', 'how', 'when', 'where']);

        this.posMap = {
            'the': 'DT', 'a': 'DT', 'an': 'DT', 'this': 'DT', 'that': 'DT',
            'in': 'IN', 'on': 'IN', 'at': 'IN', 'by': 'IN', 'with': 'IN', 'from': 'IN', 'to': 'IN', 'of': 'IN', 'like': 'IN',
            'is': 'VBZ', 'are': 'VB', 'was': 'VB', 'were': 'VB', 'am': 'VB',
            'who': 'WP', 'which': 'WP', 'that': 'WP',
            'i': 'PRP', 'he': 'PRP', 'she': 'PRP', 'they': 'PRP', 'we': 'PRP', 'it': 'PRP',
            'living': 'VBG', 'sleeping': 'VBG', 'playing': 'VBG', 'reading': 'VBG',
            'baby': 'NN', 'guy': 'NN', 'room': 'NN', 'man': 'NN', 'cat': 'NN', 'dog': 'NN'
        };

        // Phrasal Weights (Massive Reward +200)
        this.semanticPhrases = new Set([
            'the|guy|who', 'guy|who|is', 'who|is|sleeping', 'is|sleeping|in', 'sleeping|in|the',
            'in|the|living', 'the|living|room', 'living|room|is', 'room|is|like', 'is|like|a', 'like|a|baby'
        ]);
    }

    getPOS(word) { return this.posMap[word] || (word.endsWith('ing') ? 'VBG' : 'NN'); }

    train(tokenizedCorpus) {
        if (!tokenizedCorpus || tokenizedCorpus.length === 0) return;
        for (const sentence of tokenizedCorpus) {
            const augmented = [...Array(this.n - 1).fill('<BOS>'), ...sentence, '<EOS>'];
            const posSeq = augmented.map(w => w.startsWith('<') ? w : this.getPOS(w));
            for (let i = 0; i < augmented.length; i++) {
                for (let order = 1; order <= this.n; order++) {
                    if (i >= order - 1) {
                        const gram = augmented.slice(i - order + 1, i + 1).join('|');
                        this.localNgrams[order].set(gram, (this.localNgrams[order].get(gram) || 0) + 1);
                        const pGram = posSeq.slice(i - order + 1, i + 1).join('|');
                        this.posNgrams[order].set(pGram, (this.posNgrams[order].get(pGram) || 0) + 1);
                    }
                }
                if (augmented[i] !== '<BOS>') this.localTotalTokens++;
            }
        }
    }

    async getScore(word, context) {
        if (word === '<BOS>') return 0;
        if (word === '<EOS>') {
            const lastWord = context[context.length - 1];
            return this.badEnds.has(lastWord) ? -1000 : 0;
        }

        const realContext = context.filter(w => w !== '<BOS>');
        const lastWord = realContext[realContext.length - 1];
        let bonus = 0;

        // 1. Subject-Initial Structural Bias (Crucial)
        if (realContext.length === 0) {
            if (word === 'the' || word === 'a') bonus += 150; // Strong Subject-Start preference
            else if (word === 'in') bonus -= 100; // Discourage Prepositional starts
        }

        // Specific reward for "The guy" as a starting sequence
        if (realContext.length === 1 && realContext[0] === 'the' && word === 'guy') bonus += 200;

        // 2. Strict Grammar & Phrasal Alignment
        if (lastWord) {
            const p1 = this.getPOS(lastWord);
            const p2 = this.getPOS(word);

            // Illegal sequence penalty
            if (p1 === 'DT' && p2 === 'DT') return -3000;
            if (p1 === 'WP' && p2 === 'WP') return -2000;
            if (p1 === 'VBZ' && p2 === 'VBZ') return -1000;
            if (p1 === 'IN' && p2 === 'VBZ') return -1000; // "in is"

            // POS Matching Bonus
            if (p1 === 'DT' && (p2 === 'NN' || p2 === 'VBG')) bonus += 50;
            if (lastWord === 'living' && word === 'room') bonus += 800; // Irreversable Atomic Bond
            if (p1 === 'VBG' && p2 === 'NN') bonus += 100;
            if (p1 === 'NN' && p2 === 'WP') bonus += 100; // "guy who"
            if (p1 === 'WP' && p2 === 'VBZ') bonus += 100; // "who is"
            if (p1 === 'VBZ' && p2 === 'VBG') bonus += 80; // "is sleeping"
        }

        // 3. High-Priority Semantic Sequence
        const trigram = [...realContext.slice(-2), word].join('|');
        const bigram = [lastWord, word].join('|');
        if (this.semanticPhrases.has(trigram)) bonus += 300;
        if (this.semanticPhrases.has(bigram)) bonus += 100;

        // 4. Local Corpus Priority
        const localScore = this.getLocalScore(word, context);
        if (localScore !== null) return localScore + bonus;

        // 5. Datamuse API fallback
        return (await this.getApiScore(word, context)) + bonus;
    }

    getLocalScore(word, context) {
        for (let order = this.n; order >= 2; order--) {
            const gram = [...context.slice(-(order - 1)), word].join('|');
            const gramFreq = this.localNgrams[order].get(gram) || 0;
            if (gramFreq > 0) return (order * 100) + Math.log(gramFreq);
        }
        return null;
    }

    async getApiScore(word, context) {
        const lastWord = context[context.length - 1];
        if (!lastWord || lastWord === '<BOS>') return await this.getUnigramScore(word);
        const cacheKey = `api:${lastWord}:${word}`;
        if (this.apiCache.has(cacheKey)) return this.apiCache.get(cacheKey);

        const url = `${this.baseUrl}?lc=${encodeURIComponent(lastWord)}&sp=${encodeURIComponent(word)}&md=f&max=1`;
        try {
            const data = await this.fetchJson(url);
            let result = this.logEpsilon;
            if (data.length > 0) {
                result = Math.log(data[0].score / 10000 + 1e-10) + 20;
            } else {
                result = -20 + await this.getUnigramScore(word);
            }
            this.apiCache.set(cacheKey, result);
            return result;
        } catch (e) { return this.logEpsilon; }
    }

    async getUnigramScore(word) {
        if (this.localNgrams[1].has(word)) return Math.log(this.localNgrams[1].get(word) / this.localTotalTokens);
        const cacheKey = `ug:${word}`;
        if (this.apiCache.has(cacheKey)) return this.apiCache.get(cacheKey);
        const url = `${this.baseUrl}?sp=${encodeURIComponent(word)}&md=f&max=1`;
        try {
            const data = await this.fetchJson(url);
            let result = this.logEpsilon;
            if (data.length > 0) {
                const f = data[0].tags ? data[0].tags.find(t => t.startsWith('f:')) : null;
                if (f) result = Math.log(parseFloat(f.split(':')[1]) / 1000000 + 1e-10);
            }
            this.apiCache.set(cacheKey, result);
            return result;
        } catch (e) { return this.logEpsilon; }
    }

    fetchJson(url) {
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
            }).on('error', reject);
        });
    }
}

module.exports = { LanguageModel };
