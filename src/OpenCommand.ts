import { Cmd } from "./Cmd";

import loglevel from 'loglevel'
const logger = loglevel.getLogger('OpenCommand.ts')
logger.setLevel('debug')

export class OpenCommand extends Cmd {
    constructor(name: string) {
        super(name)
        this.description('open browser').version('0.1')
            .argument('<module>', 'module to execute')
            .action(async (module: any, options: any) => {
                await this.openBrowser(module, options)
            })
    }

    async openBrowser(module: string, options: any) {
        try {
            await this.prologue(options)

            if (process.env.DBREMOTE_URL === undefined) throw 'DBREMOTE_URL undefined'
            const url = process.env.DBREMOTE_URL + '/cyk/#/run/' + module;
            const open = await import('open');
            open.default(url)
        }
        catch (err) {
            logger.error(err)
        }
    }

}