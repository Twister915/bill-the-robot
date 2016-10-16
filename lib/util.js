"use strict";
function getName(sender) {
    if (sender.hasOwnProperty('first_name')) {
        var str = '';
        str += `${sender.first_name} `;
        if (sender.hasOwnProperty('last_name'))
            str += `${sender.last_name} `;
        return str + `(@${sender.username})`;
    }
    return `@${sender.username}`;
}

export default {getName};