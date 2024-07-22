// WARNING: save_document.js has the exact same updateTfIdf copy and pasted. Make sure they are the same always.

//async function getSynonyms(word) {
//    const response = await fetch(`https://api.datamuse.com/words?ml=${word}`);
//    const data = await response.json();
//    return data.map(item => item.word);
//}

async function updateTfIdf(text, url) 
{
    let storage = await chrome.storage.local.get(["documents", "corpusOccurances"]);

    if (!storage.documents || !storage.corpusOccurances) {
        storage.documents = {};
        storage.corpusOccurances = {};
    }

    let counts = {};
    const regex = /\w+/g
    let words = text.toLowerCase().match(regex) // all text is lower case now, no need to convert every time

    let bigrams = [];
    
    for (let i = 0; l = words.length - 1; i < l; i++) { // optimization
        let bigram = words[i] + " " + words[i + 1];
        bigrams.push(bigram);
    }
    words = words.concat(bigrams);

    // Expand words with synonyms
/*    let expandedWords = [];
    for (let word of words) 
    {
        expandedWords.push(word);
        let synonyms = await getSynonyms(word.toLowerCase());
        expandedWords = expandedWords.concat(synonyms);
    }
*/
    for (let str in words) { // for loops are more efficient 
        if (counts[str]) {
            counts[str]++;
        } else {
            counts[str] = 1;
        }
    };

    // Delete saved document
    let removeSavedUrl = false;
    if (url.localeCompare('query') != 0 && storage.documents[url]) {
        removeSavedUrl = true;
        delete storage.documents[url];
        for (let word in counts) {
            storage.corpusOccurances[word]--;
        }
        for (let word in storage.corpusOccurances) {
            if (storage.corpusOccurances[word] === 0) {
                delete storage.corpusOccurances[word];
            }
        }

        // let corpusSize = Object.keys(storage.documents).length;
        // for (let savedUrl in storage.documents) {
        //     if (!storage.documents[savedUrl]["idf"]){
        //         storage.documents[savedUrl]["idf"] = {};
        //     }
        //     for (let str in counts) {
        //         storage.documents[savedUrl]["idf"][str] = Math.log(corpusSize / (storage.corpusOccurances[str]));
        //     };
        // }
    
    
        // for (let savedUrl in storage.documents) {
        //     if (!storage.documents[savedUrl]["tfIdf"]){
        //         storage.documents[savedUrl]["tfIdf"] = {};
        //     }
        //     for (let str in counts) {
        //         storage.documents[savedUrl]["tfIdf"][str] = storage.documents[savedUrl]["tf"][str] * storage.documents[savedUrl]["idf"][str];
        //     };
        // }
        await chrome.storage.local.set({documents:storage.documents, corpusOccurances:storage.corpusOccurances});
        return;
    }

    storage.documents[url] = {};

    let savedTextStorage = await chrome.storage.local.get(["savedText"]);
    if (savedTextStorage.savedText)
    {
        storage.documents[url]["st"] = savedTextStorage.savedText;
        savedTextStorage.savedText = null;
        await chrome.storage.local.set({ savedText: savedTextStorage.savedText });
    }
    else
    {
        storage.documents[url]["st"] = null;
    }

    let wordCount = words.length;
    storage.documents[url]["tf"] = {};
    for (let str in counts){
        storage.documents[url]["tf"][str] = counts[str] / wordCount;
    }

    let savingQuery = url.localeCompare('query') == 0;


    if (!savingQuery) {
        for (let str in counts) {
            if (storage.corpusOccurances[str]) {
                storage.corpusOccurances[str]++;
            } else {
                storage.corpusOccurances[str] = 1;
            }
        };
    }


    let documentsToIterate = storage.documents;
    if (savingQuery) {
        documentsToIterate = [storage.documents['query']]
    }

    let corpusSize = Object.keys(storage.documents).length + 1; // When one document is saved, all idf scores are 0 normally, +1 prevents this
    for (let savedUrl in documentsToIterate) {
        if (!documentsToIterate[savedUrl]["idf"]){
            documentsToIterate[savedUrl]["idf"] = {};
        }
        for (let str in counts) {
            documentsToIterate[savedUrl]["idf"][str] = Math.log(corpusSize / (storage.corpusOccurances[str]));
        };
    };
    for (let savedUrl in documentsToIterate) {
        if (!documentsToIterate[savedUrl]["tfIdf"]){
            documentsToIterate[savedUrl]["tfIdf"] = {};
        }
        for (let str in counts) {
            documentsToIterate[savedUrl]["tfIdf"][str] = documentsToIterate[savedUrl]["tf"][str] * documentsToIterate[savedUrl]["idf"][str];
        };
    };

    console.log(storage.documents['query']);
    for (let url in storage.documents) {
        console.log(url);
        console.log(storage.documents[url]['idf']['function']);
    }
    console.log(storage.documents);


    

    await chrome.storage.local.set({documents:storage.documents, corpusOccurances:storage.corpusOccurances});

    return storage;
}

/*
This is very pointless as the query is already being accessed in 
getReccomendation but this function is used in showReccomendation()
Remove at first chance

 async function setSearchQuery() { 
   const urlObj = new URL(window.location.href);
   const params = new URLSearchParams(urlObj.search);
    const query = params.get('q');
    await chrome.storage.local.set({ query: query});
}
not used in showrec */

async function getRecommendation() {
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
            let documentTfIdfWord = documentTfIdf[word];
            if (!documentTfIdfWord) {
                documentTfIdfWord = 0;
            }
            let queryTfIdfWord = queryTfIdf[word];
            
            productSum += queryTfIdfWord * documentTfIdfWord;
            querySquareSum += queryTfIdfWord * queryTfIdfWord;
            documentSquareSum += documentTfIdfWord * documentTfIdfWord;
        }

        let cosineSimilarity = 0;
        if (querySquareSum != 0 && documentSquareSum != 0){
            cosineSimilarity = (productSum + 0.00000001) / (Math.sqrt(querySquareSum + 0.0001) * Math.sqrt(documentSquareSum + 0.0001));
        } 
        cosineSimilarities[url] = cosineSimilarity;
    }
    console.log(cosineSimilarities);
    let pairs = Object.entries(cosineSimilarities);
    pairs.sort((a, b) => b[1] - a[1]);
    const sortedKeys = pairs.map(pair => pair[0]);

    sortedKeys.splice(sortedKeys.indexOf("query"), 1);
    

    let sortedKeysAndHighlightedTexts = {};
    for (i = 0; l = sortedKeys.length; i < l; i++) // optimization
    {
        let url = sortedKeys[i];
        sortedKeysAndHighlightedTexts[url] = storage.documents[url]["st"];
    }
    return sortedKeysAndHighlightedTexts;
}

async function placeRecommendationBoxInDiv(recommendationBox) {
    // If a google info box appears on the right, a new column with id rhs is created, it takes a short time to load
    searchResults = document.getElementById("rcnt")

    let rhsDiv = null;
    for (let i = 0; i < 2; i++) {  // Try for a maximum of 10 times
        rhsDiv = searchResults.querySelector('#rhs');
        if (rhsDiv) {
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 500));  // Wait for 500ms before trying again
    }
    if (rhsDiv) {
        rhsDiv.appendChild(recommendationBox);
    } else {
        let newRhsDiv = document.createElement('div');
        newRhsDiv.id = 'rhs';
        searchResults.appendChild(newRhsDiv);
        newRhsDiv.appendChild(recommendationBox);
    }
}



function createRecommendationBox(text) {

    let existing_box = document.getElementById('archive-recommendation');
    if (existing_box != null) { 
        return null;
    }
    var infoBox = document.createElement('div');
    infoBox.className = 'your-info-box-class';
    infoBox.id = 'archive-recommendation'
    infoBox.padding = '15px';

    // Create title section
    var titleSection = document.createElement('div');
    // titleSection.className = 'info-title';
    titleSection.textContent = 'DevArchive Suggestion';
    infoBox.appendChild(titleSection);

    // Add horizontal break
    var hr = document.createElement('hr');
    infoBox.appendChild(hr);

    // Create content section
    var contentSection = document.createElement('div');
    // contentSection.className = 'info-content';
    contentSection.innerHTML = text;
    infoBox.appendChild(contentSection);
    return infoBox;
}

async function showRecommendation() {
    let rankedRecommendations = await getRecommendation();
    var text = "";

    const entries = Object.entries (rankedRecommendations);
    const firstFive = entries.slice (0,5);

    firstFive.forEach (([recommendedUrl, highlightedText]) => {
        
        text += '<p><a href="' + recommendedUrl + '">' + recommendedUrl + "</a></p><p>";

        if (highlightedText)
        {
            text += "- Highlighted text: " + highlightedText;
        }

        text += '</p>' + "\n";

        console.log(recommendedUrl + " text: " + highlightedText);
    });

    let recommendation_box = null;
    if (text !== "")
    {
        recommendation_box = createRecommendationBox(text);
    }

    if (recommendation_box == null) {
        return;
    }

    await placeRecommendationBoxInDiv(recommendation_box);
}
// urlpattern = /^https:\/\/www\.google\.com\/search.*/
if (/^https:\/\/www\.google\.com\/search.*/.test(window.location.href))
{
    showRecommendation();
}
else
{
    updateTfIdf(document.body.innerText, window.location.href);
}
