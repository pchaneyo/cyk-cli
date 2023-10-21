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
        .addCommand(new CronDeleteCmd('delete'))
        .addCommand(new CronDeleteCmd('d'))
    }
}

class CronList extends Cmd {
    constructor(name: string) {
        super(name)
        this.description('List scheduled batches')
            .action(async (options: any) => {
                await this.commandList(options)
            })
    }

    async commandList(options: any) {
        try {
            await this.prologue(options)

            const json = await this.dbRemote?.apiServer.get('/api/admin/cron')
            console.log(JSON.stringify(json))
        }
        catch (err) {
            logger.error(err)
        }
    }
}

class CronAddCmd extends Cmd {
    constructor(name: string) {
        super(name)
        this.description('add a batch scheduling with cron')
            .option('-s --schedule <schedule>', 'schedule in crontab format')
            .option('-m --module <module_name>', 'module name')
            .option('-f --function <function>', 'function called in the module')
            .option('-p --params <name_value_pairs>', 'URL encoded form without ? (question mark) ie "p1=val1&p2=val2"')
            .action(async (options: any) => {
                await this.commandAdd(options)
            })
    }
    /**
     * 
     * @param options 
     */
    async commandAdd(options: any) {
        try {

            await this.prologue(options)
            if (! this.dbRemote) throw 'dbRemote undefined'
            const payload: any = {
                schedule: options.schedule,
                module: options.module,
                function: options.function,
                params: options.params
            }
            const response = await this.dbRemote.apiServer.post('/api/admin/cron', payload)
            logger.debug(response)
        }
        catch (err) {
            logger.error(err)
        }
    }

}

class CronDeleteCmd extends Cmd {
    constructor(name: string) {
        super(name)
        this.description('delete a batch scheduling with cron')
            .option('-i --id <cron_id>', 'id of the cron to delete (mandatory)')
            .option('-s --schedule <schedule>', 'schedule in crontab format')
            .option('-m --module <module_name>', 'module name')
            .option('-f --function <function>', 'function called in the module')
            .option('-p --params <name_value_pairs>', 'URL encoded form without ? (question mark) ie "p1=val1&p2=val2"')
            .action(async (options: any) => {
                
                await this.commandDelete(options)
            })
    }
    /**
     * 
     * @param options 
     */
        async commandDelete(options: any) {
            try {
    
                await this.prologue(options)
                if (! this.dbRemote) throw 'dbRemote undefined'
                if (! options.id) throw 'id is missing'
                const payload: any = {
                    schedule: options.schedule,
                    module: options.module,
                    function: options.function,
                    params: options.params
                }
                const response = await this.dbRemote.apiServer.delete(`/api/admin/cron/${options.id}`, payload)
                logger.debug(response)
            }
            catch (err) {
                logger.error(err)
            }
        }
}