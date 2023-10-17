import { Command } from "commander";
import loglevel from 'loglevel'
import { Cmd } from "./Cmd";
const logger = loglevel.getLogger('CronCommand.ts')
logger.setLevel('debug')

export class CronCommand extends Command {
    constructor(name: string) {
        super(name)
        this.description('batch scheduling with cron')
        .addCommand(new CronList('list'))
        .addCommand(new CronList('l'))
        .addCommand(new CronAddCmd('add'))
        .addCommand(new CronAddCmd('a'))
    }
}

class CronList extends Cmd {
    constructor(name: string) {
        super(name)
        this.description('List scheduled batches')
            .action(async (options: any) => {

            })
    }
}

class CronAddCmd extends Cmd {
    constructor(name: string) {
        super(name)
        this.description('add a batch scheduling with cron')
            .option('-s --schedule <schedule>', 'schedule in crontab format')
            .option('-m --module <module_name>', 'module name')
            .option('-f --function <function>', 'function called in the module')
            .option('-p --param <parameter_name_value>', 'name and value separated by = character')
            .action(async (options: any) => {
                console.log('options', options)
            })
    }
}