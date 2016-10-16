"use strict";
import config from "../config";
import Promise from "bluebird";
import fs from "../promise_fs";
import log from "../log"

async function sendMessages(bill, queue) {
    let contents;
    try {
        contents = await fs.readFileAsync(queue.file, 'utf8')
    } catch (e) {
        await fs.closeFileAsync(await fs.openAsync(queue.file, 'w'));
        return await sendMessages(bill, queue);
    }

    let messages = contents.split("\n").filter(line => line.length > 0);
    await Promise.all(messages.map(async line => bill.sendMessage(queue.chat_id, line)));
    await fs.truncateAsync(queue.file);
    return messages.length;
}

function beginWatch(bill, queue) {
    let w = fs.watch(queue.file, (eventType) => {
        if (eventType !== 'change')
            return;
        w.close();
        sendAndWatch(bill, queue);
    });
}

function sendAndWatch(bill, queue) {
    return sendMessages(bill, queue)
        .then(count => {
            if (count > 0)
                log(`Sent ${count} messages...`);
        })
        .delay(10)
        .then(() => beginWatch(bill, queue));
}

export default function(bill) {
    for (let queue of config.message_queues)
        sendAndWatch(bill, queue);
}