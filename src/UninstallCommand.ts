import { Cmd, runShellCommand } from "./Cmd";
import * as fs from "fs"
import * as path from "path"
import { green, red, bold } from 'kolorist'

import loglevel from 'loglevel'
import { deleteModule } from "./ModuleCommand";
import { DBManager, DBRemote } from "@cyklang/core";
const logger = loglevel.getLogger('UninstallCommand.ts')
logger.setLevel('debug')

export class UninstallCommand extends Cmd {
    /**
     * constructor
     * @param name 
     */
    constructor(name: string) {
        super(name)
        this.description('run uninstall script and npm uninstall command')
            .argument('<node_package>', 'Node Package installed as dev dependency')
            .action(async (node_package: any, options: any) => {
                await this.uninstall(node_package, options)
            })
    }

    /**
     * method uninstall
     * @param node_package 
     * @param options 
     */
    async uninstall(node_package: string, options: any) {
        try {
            await this.prologue(options)
            if (! this.dbManager || ! this.dbRemote) throw 'dbManager or dbRemote undefined'

            await uninstallPackage(node_package, this.dbManager, this.dbRemote)
        }
        catch (err) {
            logger.error(err)
        }
    }
}

/**
 * function uninstallPackage
 * @param node_package 
 */
export async function uninstallPackage(node_package: string, dbManager: DBManager, dbRemote: DBRemote) {

    const uninstallScript = await lookupUninstallScript(node_package)
    if (uninstallScript) {
        /**
         * run scripts/uninstall
         */
        const uninstallPath = path.join('node_modules', node_package, 'scripts', uninstallScript)
        await runShellCommand(uninstallPath, [])
    }
    else {
        /**
         * default uninstall : 
         */
        await defaultUninstallScript(node_package, dbManager, dbRemote)
    }

    /**
     * uninstall the node package
     */
    await uninstallNodePackage(node_package)

}
/**
 * method defaultUninstallScript
 * @param node_package 
 */
async function defaultUninstallScript(node_package: string, dbManager: DBManager, dbRemote: DBRemote) {
    console.log()
    console.log('Default uninstall script')
    /**
     * delete package modules from server
     */
    await deletePackageModules(node_package, dbManager)
    /**
     * delete package assets from server
     */
    await deletePackageAssets(node_package, dbManager, dbRemote)

}

/**
 * function deletePackageAssets
 * @param node_package 
 * @param dbManager 
 * @param dbRemote 
 */
async function deletePackageAssets(node_package: string, dbManager: DBManager, dbRemote: DBRemote) {
    const assetFolder = path.join('node_modules', node_package, 'asset')
    if (!fs.existsSync(assetFolder) || !fs.statSync(assetFolder).isDirectory()) {
        return
    }
    console.log()
    console.log('delete assets from server ...')

    await browseFolder(assetFolder, async (filePath: string) => {
        const route = '/' + path.relative(assetFolder, filePath)
        const dbAsset = await dbManager.dbAssetExist(route)
        if (!dbAsset) {
            logger.info('asset ' + route + ' not found')
            return
        }
        await dbManager.dbAssetDelete(dbAsset)
        logger.info('asset ' + route + ' deleted')
    })

    console.log(green('*') + ' delete assets from server')
}

/**
 * browseFolder
 * @param folder 
 * @param treatment 
 */
async function browseFolder(folder: string, treatment: (filePath: string) => Promise<void>) {
    const files = fs.readdirSync(folder)
    for(let ind = 0; ind < files.length; ind++) {
        const file = files[ind]
        const pathName = folder + '/' + file
        if (fs.statSync(pathName).isDirectory()) {
            await browseFolder(pathName, treatment)
        }
        else {
            await treatment(pathName)
        }
    }
}

/**
 * function deletePackageModules
 * @param node_package 
 * @param dbManager 
 * @returns 
 */
async function deletePackageModules(node_package: string, dbManager: DBManager) {
    const moduleFolder = path.join('node_modules', node_package, 'module')
    if (!fs.existsSync(moduleFolder) || !fs.statSync(moduleFolder).isDirectory()) {
        return
    }
    console.log()
    console.log('delete modules from server ...')
    const files = fs.readdirSync(moduleFolder)
    for (let ind = 0; ind < files.length; ind++) {
        const file = files[ind]
        if (!dbManager) throw 'dbManager undefined'

        const fileInfo = path.parse(file)
        await deleteModule(fileInfo.name, dbManager)
    }
    console.log(green('*') + ' delete modules from server')
}

/**
 * function uninstallNodePackage
 * @param node_package 
 */
async function uninstallNodePackage(node_package: string) {

    try {
        await runShellCommand('npm', ['uninstall', '--save-dev', node_package])
    } catch (error) {
        console.error('Error uninstalling ' + node_package + ' :', error);
        throw error
    }
}

/**
 * function lookupUninstallScript
 * @param node_package 
 */
async function lookupUninstallScript(node_package: string): Promise<string | undefined> {
    let result: string | undefined
    try {
        const scriptsFolder = path.join('node_modules', node_package, 'scripts')
        if (fs.existsSync(scriptsFolder) && fs.statSync(scriptsFolder).isDirectory()) {
            const files = fs.readdirSync(scriptsFolder)
            for (let ind = 0; ind < files.length; ind++) {
                const file = files[ind]
                if (file.startsWith('uninstall.')) {
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