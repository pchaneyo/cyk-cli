import { Cmd } from "./Cmd";

import loglevel from 'loglevel'
const logger = loglevel.getLogger('OpenCommand.ts')
logger.setLevel('debug')

export class OpenCommand extends Cmd {
    constructor(name: string) {
        super(name)
        this.description('open browser').version('0.1')
            .argument('<module_path>', 'module to execute or pathname')
            .action(async (module_path: any, options: any) => {
                await this.openBrowser(module_path, options)
            })
    }

    async openBrowser(module_path: string, options: any) {
        try {
            await this.prologue(options)

            if (process.env.DBREMOTE_URL === undefined) throw 'DBREMOTE_URL undefined'
            let url = process.env.DBREMOTE_URL
            if (module_path.startsWith('/')) {
                url += module_path
            }
            else {
                url += '/cyk/#/run/' + module_path
            }
            const open = await import('open');
            open.default(url)
        }
        catch (err) {
            logger.error(err)
        }
    }

}