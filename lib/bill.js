"use strict";
import config from "./config"
import log from "./log";
import TelegramBot from "node-telegram-bot-api";
import fs from "./promise_fs";
import chalk from "chalk";

const modulesFolder = 'modules';
async function enableAllBotModules(bill) {
    var count = 0;
    //load all modules from the modules folder
    for (let file of await fs.readdirAsync(`${__dirname}/${modulesFolder}/`))
        if (file.match(/\.js$/) && file !== 'index.js') {
            try {
                require(`${__dirname}/${modulesFolder}/${file.replace('.js', '')}`).default(bill);
            } catch (e) {
                log(`Failed to load module ${file} because of error: ${e.message}`);
                console.error(e);
                continue;
            }
            log(`Loaded module ${chalk.bold.blue(file)}`);
            count++;
        }

    return count;
}

export default async function() {
    let bot;
    await enableAllBotModules(bot = new TelegramBot(config.telegram.key, config.telegram.options));
    return bot;
};