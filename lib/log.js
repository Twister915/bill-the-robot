import chalk from "chalk";
import moment from "moment";

const mainLogger = console.log;

function log(message) {
    mainLogger(`${chalk.italic.green(getDate())}${chalk.dim(':')} ${chalk.white(message)}`);
}

function getDate() {
    return moment().format('MMM Do YYYY H:mm:ss');
}

export default log;