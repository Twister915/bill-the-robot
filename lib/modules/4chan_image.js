"use strict";
import rp from "request-promise";
import log from "../log"
import util from "../util"
import chalk from "chalk"

function flatten(arr) {
    const flat = [].concat(...arr);
    return flat.some(Array.isArray) ? flatten(flat) : flat;
}

async function getRandomImage(board) {
    let threads = flatten((await get4API(board, 'threads')).map((page) => page.threads));
    var imageLink = null;

    while (imageLink == null) {
        let threadImages = (await get4API(board, `thread/${threads[Math.floor(Math.random() * threads.length)].no}`))
            .posts
            .filter((post) => post.hasOwnProperty('tim'))
            .map((post) => `http://i.4cdn.org/${board}/${post.tim}${post.ext}`);

        if (threadImages.length > 0)
            imageLink = threadImages[Math.floor(Math.random() * threadImages.length)];
    }

    return imageLink;
}

function get4API(board, path) {
    let options = {
        uri: `http://a.4cdn.org/${board}/${path}.json`,
        json: true
    };

    return rp(options);
}

export default function(bill) {
    bill.onText(/^image me(?: ?)([A-Za-z0-9]{0,3})\s*$/i, (msg, match) => {
        getRandomImage(match[1])
            .then(image => {
                bill.sendPhoto(msg.from.id, image);
                log(`Sending image to ${chalk.blue(util.getName(msg.from))} from board ${chalk.blue(match[1])} on 4chan`)
            })
            .catch(e => bill.sendMessage(msg.from.id, `Sorry, there was an error getting your image... ${e.message}`));
    });
}
