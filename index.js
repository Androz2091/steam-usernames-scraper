const fetch = require("node-fetch");
const { black, green } = require("chalk");
const moment = require("moment");

const AbortController = require("abort-controller");

const { readFile, writeFile } = require("fs");
const { promisify } = require("util");
const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

let aborted = 0;

const log = (msg, type) => {
    const timestamp = `[${moment().format("YYYY-MM-DD HH:mm:ss")}]:`;
    switch (type){
        case "bigsuccess":
            return console.log(`${timestamp} ${green(msg)} `);
        case "bigerror":
            return console.log(`${timestamp} ${black.bgRed(msg)} `);
        case "success":
            return console.log(`${timestamp} ${green(type.toUpperCase())} ${msg} `);
        case "error":
            return console.log(`${timestamp} ${black.bgRed(type.toUpperCase())} ${msg} `);
        case "log":
            return console.log(`${timestamp} ${black.bgBlue(type.toUpperCase())} ${msg} `);
    }
};

const exists = async (username) => {
    return new Promise(async (resolve) => {
        const controller = new AbortController();
        const timeout = setTimeout(
            () => {
                controller.abort();
            },
            1000
        );
        let url = `https://steamcommunity.com/id/${username}`;
        fetch(url, { signal: controller.signal }).then(
        async res => {
            let body = await res.text();
            let valid = !body.includes("The specified profile could not be found.");
            if(valid && !body.includes("profile_header_content")){
                log("Seems like Steam blocked me...", "error");
                process.exit(0);
            }
            aborted = 0;
            resolve(valid);
        }, 
        async err => {
            if (err.name === "AbortError") {
                aborted++;
                if(aborted > 5){
                    await delay(10000);
                    aborted = 0;
                }
                log(`Request for ${escape(username)} aborted.`, "bigerror");
                resolve(false);
            }
        })
        .catch(() => {
            log(`Request for ${escape(username)} failed.`, "bigerror");
            resolve(false);
            clearTimeout(timeout);
        })
        .finally(() => {
            clearTimeout(timeout);
        });
    });
};

(async () => {

    const usernamesRaw = await readFileAsync("./list.txt", "utf-8");
    const usernames = usernamesRaw.split("\n");
    log(`Fetched read. (${usernames.length})`, "log");

    const fetchedRaw = await readFileAsync("./fetched.txt", "utf-8");
    let fetched = fetchedRaw.split("\n");
    log(`Fetched read. (${fetched.length})`, "log");

    const validRaw = await readFileAsync("./valid.txt", "utf-8");
    let valid = validRaw.split("\n");
    log(`Valid read. (${valid.length})`, "log");

    const toFetch = usernames.filter((u) => !fetched.includes(u));
    log(`Fetching ${toFetch.length} usernames...`, "log");

    for(let username of toFetch){
        if(String(usernames.indexOf(username)).endsWith(0)){
            log(`${usernames.indexOf(username)} usernames tested. (${valid.length} valid, ${toFetch.length - (toFetch.indexOf(username))} remaining)`, "bigsuccess");
        }
        log(`${escape(username)} waiting.`, "log");
        let usernameExists = await exists(username);
        if(usernameExists){
            log(`${escape(username)} validated.`, "success");
            valid.push(username);
            await writeFileAsync("./valid.txt", valid.join("\n"));
        } else {
            log(`${escape(username)} invalidated.`, "error");
        }
        fetched.push(username);
        await writeFileAsync("./fetched.txt", fetched.join("\n"));
    };

})();