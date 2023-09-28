import { Cmd } from "./Cmd";
import * as fs from "fs"
import * as path from "path"
import {green, red, bold} from 'kolorist'

import loglevel from 'loglevel'
import { uploadModule } from "./ModuleCommand";
const logger = loglevel.getLogger('InstallCommand.ts')
logger.setLevel('debug')

export class InstallCommand extends Cmd {
    constructor(name: string) {
        super(name)
        this.description('npm install and upload xml modules to Cyk server')
            .argument('<node_package>', 'Node Package installed as dev dependency')
            .action(async (node_package: any, options: any) => {
                await this.install(node_package, options)
            })
    }

    async install(node_package: string, options: any) {
        try {
            await this.prologue(options)
            if (this.dbManager === undefined) throw 'dbManager undefined'

            /**
             * install the Node Package
             */
            await this.installNodePackage(node_package)

            const installScript = await this.lookupInstallScript(node_package)

            if (installScript) {
                /**
                 * execute installScript
                 */
                const installPath = path.join('node_modules',node_package,'scripts',installScript)
                await this.runShellCommand(installPath, [])
            }
            else {
                /**
                 * default install : upload modules and execute _init.xml
                 */
                console.log()
                console.log('upload modules to server ...')
                const xmlFolder = path.join('node_modules', node_package, 'xml')
                if (!fs.existsSync(xmlFolder) || !fs.statSync(xmlFolder).isDirectory()) {
                    throw 'xml folder not found ( ' + xmlFolder + ' )'
                }
                /**
                 * upload modules to the server
                 */
                let initModule: string | undefined
                const files = fs.readdirSync(xmlFolder)
                for (let ind = 0; ind < files.length; ind++) {
                    const file = files[ind]
                    await uploadModule(path.join(xmlFolder, file), this.dbManager)
                    if (file.endsWith('_init.xml')) {
                        initModule = file
                    }
                }
                console.log(green('*') + ' upload modules to server' )
                if (initModule) {
                    const initPath = path.join(xmlFolder, initModule)
                    await this.runShellCommand('npx', ['cyk', 'run', initPath])
                }
            }

        }
        catch (err) {
            logger.error(err)
        }
    }

    /**
     * method installNodePackage
     * @param node_package 
     */
    async installNodePackage(node_package: string) {

        try {
            await this.runShellCommand('npm', ['install', '--save-dev', node_package])
        } catch (error) {
            console.error('Error installing ' + node_package + ' :', error);
            throw error
        }
    }

    /**
     * method lookupInstallScript
     * @param node_package 
     */
    async lookupInstallScript(node_package: string): Promise<string | undefined> {
        let result: string | undefined
        try {
            const scriptsFolder = path.join('node_modules', node_package, 'scripts')
            if (fs.existsSync(scriptsFolder) && fs.statSync(scriptsFolder).isDirectory()) {
                const files = fs.readdirSync(scriptsFolder)
                for (let ind = 0; ind < files.length; ind++) {
                    const file = files[ind]
                    if (file.startsWith('install.')) {
                        result = file
                    }
                }
            }
            return result
        }
        catch (err) {
            throw err
        }
    }

}