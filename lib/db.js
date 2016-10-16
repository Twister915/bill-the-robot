"use strict";
import low from "lowdb";

const db = low();

db.defaults({
    monitoring: {
        servers: [],
        subscribers: []
    }
}).value();

export default {db};