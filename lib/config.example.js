"use strict";

let options = {};

options.telegram = {};
options.telegram.key = "YOUR TELEGRAM KEY";
options.telegram.options = {polling: true};
//any telegram options you want here

options.message_queues = [];

options.message_queues.push({
    file: 'vpn_broadcasts.txt',
    chat_id: '123'
});

export default options;