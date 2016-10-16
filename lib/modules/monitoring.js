"use strict";

const db = require("../db").default.db.get('monitoring');
import log from "../log";
import Promise from "bluebird";
const net = Promise.promisifyAll(require('net'));
const dns = Promise.promisifyAll(require('dns'));
const ping = Promise.promisifyAll(require('net-ping').createSession());
import rp from "request-promise";
import chalk from "chalk";

class HostCheckException {
    constructor(error, message) {
        this.error = error;
        this.message = message;
    }
}

async function checkHost(host_options) {
    try {
        for (let ip of await dns.resolve4Async(host_options.host))
            await ping.pingHostAsync(ip)
    } catch (e) {
        throw new HostCheckException(e, 'Ping failed');
    }

    if (host_options.hasOwnProperty('port')) {
        let connection = null;
        try {
            connection = await net.connectAsync(host_options);
        } catch (e) {
            throw new HostCheckException(e, 'Could not establish a tcp connection');
        } finally {
            if (connection != undefined)
                connection.end();
        }
    }

    if (host_options.hasOwnProperty('http')) {
        let http_opts = host_options.http;
        let options = {resolveWithFullResponse: true}; Object.assign(options, http_opts);
        options.uri = `${http_opts.schema}${host_options.host}:${host_options.port}${http_opts.uri}`;
        let result;

        try {
            result = await rp(options);
        } catch (e) {
            throw new HostCheckException(e, 'HTTP connection failed');
        }

        if (result.statusCode != (http_opts.status_code || 200))
            throw new HostCheckException(null, `HTTP status code was not right, got: ${result.statusCode}`);
    }
}

function watchHost(bill, host_options) {
    return setTimeout(() =>
        checkHost(host_options).catch(error => handleHostDown(bill, host_options, error)).delay(100).then(() => watchHost(bill, host_options))
    , 5000);
}

async function handleHostDown(bill, host_options, error) {
    console.error(error.error);
    log(chalk.red(`Host ${host_options.host_name} is down due to error: ${error.message}`));
    try {
        let count = notify(bill, host_options.host_name, error.message);
        log(chalk.blue(`Sent notifications to ${count} subscribers`));
    } catch (error) {
        log(chalk.bold.red(`Failed to notify users: ${error}`));
    }
}

async function notify(bill, host_name, error) {
    return await Promise.all(getNotificationTargets(host_name).map(target => bill.sendMessage(target, `Monitoring for ${host_name}\n\n${error}`))).length;
}

function getNotificationTargets(host_name) {
        let res = db.get('subscribers').find({host: host_name}).value();
    if (!(res instanceof Array))
        res = [res];
    return res.map(target => target.chat_id);
}

function subscribe(bill, chatter, host_name) {
    db.get('subscribers').push({host: host_name, chat_id: chatter.id}).value();
    bill.sendMessage(chatter.id, `You have subscribed to notifications about ${host_name}`);
}

function getData(target) {
    let httpMatch;
    if (httpMatch = target.match(/^http(s?):\/\/([^\/:]*)(?::([0-9]+))?(\/[^?#=]*)?(?:\?.*)?$/i))
        return {host: httpMatch[2],
            port: httpMatch[3] != undefined ? parseInt(httpMatch[3]) : (httpMatch[1] == 's' ? 443 : 80),
            http: {
                uri: httpMatch[4] == undefined ? '/' : httpMatch[4],
                schema: `http${httpMatch[1] == 's' ? 's' : ''}://`
            },
            host_name: httpMatch[0]};

    let ipMatch;
    if (ipMatch = target.match(/^((?:(?:2[0-5][0-5]|[0-1]?[0-9]{1,2})\.){3}(?:2[0-5][0-5]|[0-1]?[0-9]?[0-9]))(?::(6[0-5][0-5][0-3][0-5]|[1-9][0-9]{0,3}))?$/))
        return {host: ipMatch[1],
            port: ipMatch[2] != undefined ? parseInt(ipMatch[2]) : undefined,
            host_name: ipMatch[0]};

    throw new Error("Invalid string passed");
}

function watchAllHosts(hostDb, bill) {
    let hosts = hostDb.value();
        if (hosts != undefined) {
        let ids = hosts.map(host => watchHost(bill, host));
        if (ids.length > 0)
            log(`Watching ${ids.length} hosts`);
        return ids;
    }
    else
        return [];
}

function unsubscribeAll(ids) {
    for (let id of ids)
        clearTimeout(id);
}

export default function(bill) {
    let hostDb = db.get('servers');
    let ids = watchAllHosts(hostDb, bill);

    bill.onText(/^monitor (.*)$/, (message, match) => {
        /*
         * valid queries:
         *  stop              | stops all
         *  stop google.com
         *  http://google.com | monitors google.com
         *  192.168.1.1       | pings 192.168.1.1
         *  192.168.1.1:25565 | checks that 25565 is open and working
         *
         */
        try {
            let query = match[1];
                        let target;

            let stopMatch;
            if (stopMatch = query.match(/^stop(?: (.*))?/)) {
                if (stopMatch[1] == undefined || stopMatch[1].length == 0) {
                    db.get('subscribers').remove({chat_id: message.from.id}).value();
                    bill.sendMessage(message.from.id, 'Unsubscribed from all!');
                } else {
                    target = getData(stopMatch[1]);
                    if (db.get('subscribers').remove({
                            chat_id: message.from.id,
                            host_name: target.host_name
                        }).value() != undefined) {
                        bill.sendMessage(message.from.id, 'You have been unsubscribed');
                        if (db.get('subscribers').find({host_name: target.host_name}).value() == undefined)
                            hostDb.remove({host_name: target.host_name});
                    }
                    else
                        bill.sendMessage(message.from.id, "Can't find that in our database, try specifying a different host...");
                }

            } else {
                target = getData(query);
                if (!hostDb.has(target).value())
                    hostDb.push(target).value();

                subscribe(bill, message.from, target.host_name);
            }

            unsubscribeAll(ids);
            ids = watchAllHosts(hostDb, bill);
        } catch (e) {
            bill.sendMessage(message.from.id, `There was an error processing your query: ${e.message}`);
            console.error(e);
        }

    });
}