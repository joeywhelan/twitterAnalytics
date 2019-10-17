/**
 * @fileoverview Functions implementing Google Natural Lanaguage (NL) analytics on tweet text
 * @author Joey Whelan <joey.whelan@gmail.com>
 */

'use strict';
'use esversion 6';
const fetch = require('node-fetch');
const fs = require('fs');
const fsp = fs.promises;

//Google NL API key
const GOOGLE_KEY = process.env.GOOGLE_KEY;

//Google NL Entity/Sentiment REST end point
const ENTITY_SENTIMENT_URL = 'https://language.googleapis.com/v1beta2/documents:analyzeEntitySentiment?key=' + GOOGLE_KEY;

//Google NL Sentiment REST end point
const SENTIMENT_URL = 'https://language.googleapis.com/v1beta2/documents:analyzeSentiment?key=' + GOOGLE_KEY;

//json-formatted file with the results from twitter premium search
const INFILE = './tweets.json';  


/**
 * Function that calls Google Natural Language entitySentiment REST end point to derive sentiment
 * on the top salience entity within a tweet
 * @param {string} tweet - text of a tweet
 * @return {promise} JSON object containing entity-sentiment analysis of the top salience entity
 * @throws {Error} propagates HTTP status errors or node fetch exceptions
 */
async function entitySentiment(tweet) {
    let ts = new Date();
    console.debug(`${ts.toISOString()} entitySentiment()`);

    const document = {
        'type': 'PLAIN_TEXT',
        'language': 'en',
        'content': tweet
    };

    const body = {
        'document' : document,
        'encodingType' : 'UTF8'
    };	

    try {
        const response = await fetch(ENTITY_SENTIMENT_URL, {
            method : 'POST',
            body : JSON.stringify(body),
            headers: {'Content-Type' : 'application/json; charset=utf-8'},
        });

        if (response.ok) {
            const json = await response.json();
            const topSalience = json.entities[0];
            const results = {
                'name' : topSalience.name,
                'type' : topSalience.type,
                'salience' : topSalience.salience,
                'entitySentiment' : topSalience.sentiment
            }
            return results;
        }
        else {
            let msg = (`response status: ${response.status}`);
            throw new Error(msg);
        }
    }
    catch (err) {
        ts = new Date();
        let msg = (`${ts.toISOString()} entitySentiment() - ${err}`);
        console.error(msg)
        throw err;
    }
}

/**
 * Function that calls Google Natural Language sentiment REST end point of the entire tweet
 * @param {string} tweet - text of a tweet
 * @return {promise} JSON object containing sentiment analysis
 * @throws {Error} propagates HTTP status errors or node fetch exceptions
 */
async function sentiment(tweet) {
    let ts = new Date();
    console.debug(`${ts.toISOString()} sentiment()`);

    const document = {
        'type': 'PLAIN_TEXT',
        'language': 'en',
        'content': tweet
    };

    const body = {
        'document' : document,
        'encodingType' : 'UTF8'
    };	

    try {
        const response = await fetch(SENTIMENT_URL, {
            method : 'POST',
            body : JSON.stringify(body),
            headers: {'Content-Type' : 'application/json; charset=utf-8'},
        });

        if (response.ok) {
            const json = await response.json();
            return json.documentSentiment;
        }
        else {
            let msg = (`response status: ${response.status}`);
            throw new Error(msg);
        }
    }
    catch (err) {
        ts = new Date();
        let msg = (`${ts.toISOString()} sentiment() - ${err}`);
        console.error(msg)
        throw err;
    }
}

/**
 * Function that combines call to Google NL to derive sentiment on both the top salience entity within a tweet and the overall tweet.
 * @param {string} tweet - text of a tweet
 * @return {promise} JSON object containing entity/sentiment analysis
 * @throws {Error} propagates HTTP status errors or node fetch exceptions
 */
async function analyze(tweet) {
    const esnt = await entitySentiment(tweet);
    const snt = await sentiment(tweet);

    let results = {};
    results.tweet = tweet;
    results.name = esnt.name;
    results.type = esnt.type;
    results.salience = esnt.salience;
    results.entitySentiment = esnt.entitySentiment;
    results.documentSentiment = snt;
    let mag = (results.entitySentiment.magnitude + results.documentSentiment.magnitude) / 2;
    let score = (results.entitySentiment.score + results.documentSentiment.score) / 2;
    results.aggregate = mag * score;
    return results;
}

/**
* Function providing an async read of json-formatted file.
* @param {string} file- name of json-formatted file to be read
* @return {object} - json object
*/
async function readTweetFile(file) {
    let tweets = await fsp.readFile(file);
    return JSON.parse(tweets);
}


readTweetFile(INFILE)
.then(tweets => {
    for (let i=0; i < tweets.length; i++) {
        analyze(tweets[i].text)
        .then(json => {
            console.log(JSON.stringify(json, null, 4));
        });
    }
})
.catch(err => {
    console.error(err);
});
