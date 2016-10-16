#!/usr/bin/env node
"use strict";

const bill = require('../lib/bill');

bill.default().catch(e => {
    console.log("Failed to start bill!");
    console.error(e);
    process.exit(127);
});