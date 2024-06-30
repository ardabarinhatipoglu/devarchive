// const article = document.querySelector("article");

// // `document.querySelector` may return null if the selector doesn't match anything.
// if (article) {
//     const text = article.textContent;
//     const wordMatchRegExp = /[^\s]+/g; // Regular expression
//     const words = text.matchAll(wordMatchRegExp);
//     // matchAll returns an iterator, convert to array to get word count
//     const wordCount = [...words].length;
//     const readingTime = Math.round(wordCount / 200);
//     const badge = document.createElement("p");
//     // Use the same styling as the publish information in an article's header
//     badge.classList.add("color-secondary-text", "type--caption");
//     badge.textContent = `⏱️ ${readingTime} min read`;

//     // Support for API reference docs
//     const heading = article.querySelector("h1");
//     // Support for article docs with date
//     const date = article.querySelector("time")?.parentNode;

//     (date ?? heading).insertAdjacentElement("afterend", badge);
// }

async function updateTfIdf(text, url)
{
    let storage = await chrome.storage.local.get(["documents", "corpusOccurances"]);

    if (!storage.documents || !storage.corpusOccurances) {
        storage.documents = {};
        storage.corpusOccurances = {};
    }

    let alreadySaved = false;
    if (storage.documents[url]) {
        alreadySaved = true;
    }
    
    storage.documents[url] = {};

    let counts = {};
    const regex = /\w+/gi
    let words = text.match(regex)
    words.forEach(function(tmp) {
        let str = tmp.toLowerCase();
        if (counts[str]) {
            counts[str]++;
        } else {
            counts[str] = 1;
        }
    });

    let wordCount = words.length;
    storage.documents[url]["tf"] = {};
    for (let str in counts){
        storage.documents[url]["tf"][str] = counts[str] / wordCount;
    }



    if (!alreadySaved) {
        for (let str in counts) {
            if (storage.corpusOccurances[str]) {
                storage.corpusOccurances[str]++;
            } else {
                storage.corpusOccurances[str] = 1;
            }
        };
    }

    let corpusSize = Object.keys(storage.documents).length + 1; // Count including current document
    for (let savedUrl in storage.documents) {
        if (!storage.documents[savedUrl]["idf"]){
            storage.documents[savedUrl]["idf"] = {};
        }
        for (let str in counts) {
            storage.documents[savedUrl]["idf"][str] = Math.log(corpusSize / (1 + storage.corpusOccurances[str]));
        };
    }


    for (let savedUrl in storage.documents) {
        if (!storage.documents[savedUrl]["tfIdf"]){
            storage.documents[savedUrl]["tfIdf"] = {};
        }
        for (let str in counts) {
            storage.documents[savedUrl]["tfIdf"][str] = storage.documents[savedUrl]["tf"][str] * storage.documents[savedUrl]["idf"][str];
        };
    }

    await chrome.storage.local.set({documents:storage.documents, corpusOccurances:storage.corpusOccurances});

    return storage;
}

async function setValue() {
    await chrome.storage.local.set({ test: "something" });
}

async function getValue() {
    let result = await chrome.storage.local.get(["test"]);
    var div=document.createElement("div"); 
    div.innerText="DevArchive: " + result.test;
    searchResults = document.getElementById("rcnt")
    searchResults.appendChild(div); 
}

async function setSearchQuery() {
    const urlObj = new URL(window.location.href);
    const params = new URLSearchParams(urlObj.search);
    const query = params.get('q');
    await chrome.storage.local.set({ query: query});
}

async function getReccomendation() {
    let urlObj = new URL(window.location.href);
    let params = new URLSearchParams(urlObj.search);
    let query = params.get('q');
    let storage = await updateTfIdf(query, "query");

    let cosineSimilarities = {};
    let queryTfIdf = storage.documents["query"]["tfIdf"];
    
    for (let url in storage.documents) {
        let documentTfIdf = storage.documents[url]["tfIdf"];
        let productSum = 0;
        let querySquareSum = 0;
        let documentSquareSum = 0;

        for (let word in storage.documents["query"]["tfIdf"]) {
            let queryTfIdfWord = queryTfIdf[word];
            let documentTfIdfWord = documentTfIdf[word];
            if (!queryTfIdfWord) {
                queryTfIdfWord = 0;
            }
            if (!documentTfIdfWord) {
                documentTfIdfWord = 0;
            }

            productSum += queryTfIdfWord * documentTfIdfWord;
            querySquareSum += queryTfIdfWord * queryTfIdfWord
            documentSquareSum += documentTfIdfWord * documentTfIdfWord;
        }

        let cosineSimilarity = 0;
        if (querySquareSum != 0 && documentSquareSum != 0){
            cosineSimilarity = productSum / (Math.sqrt(querySquareSum) * Math.sqrt(documentSquareSum));
        } 
        
        // cosineSimilarities[url] = cosineSimilarity;
        cosineSimilarities[url] = productSum;
    }
    let pairs = Object.entries(cosineSimilarities);
    pairs.sort((a, b) => b[1] - a[1]);
    console.log(pairs);
    const sortedKeys = pairs.map(pair => pair[0]);

    return sortedKeys;

}

async function showReccomendation() {
    let result = await chrome.storage.local.get(["title", "query"]);
    var div = document.createElement("div"); 
    div.innerText="DevArchive: \n Last looked up: " + result.title + "\nSearch query: " + result.query;
    searchResults = document.getElementById("rcnt")
    searchResults.appendChild(div); 
    let rankedReccomendations = await getReccomendation();
    console.log(rankedReccomendations);
    var text = ""
    for (let i = 0; i < rankedReccomendations.length; i ++) {
        text += rankedReccomendations[i].substring(8,70) + "\n"; 
    }
    console.log("HEI")

    console.log(text);
    div.innerText="DevArchive: \n Search query: " + result.query + "\nRanked matches: \n" + text;

}


setSearchQuery();
showReccomendation();
// getReccomendation();
