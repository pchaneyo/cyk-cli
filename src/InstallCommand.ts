import { Cmd, readPackageJson, runShellCommand } from "./Cmd";
import * as fs from "fs"
import * as path from "path"
import { green, red, bold } from 'kolorist'

import loglevel from 'loglevel'
import { uploadModule } from "./ModuleCommand";
import { uninstallPackage } from "./UninstallCommand";
import { DBManager, DBRemote } from "@cyklang/core";
import { FileDescriptor, uploadAsset, uploadDirectory } from "./AssetCommand";
const logger = loglevel.getLogger('InstallCommand.ts')
logger.setLevel('debug')

export class InstallCommand extends Cmd {
    /**
     * constructor
     * @param name 
     */
    constructor(name: string) {
        super(name)
        this.description('npm install and run install script')
            .argument('<node_package>', 'Node Package installed as dev dependency')
            .action(async (node_package: any, options: any) => {
                await this.install(node_package, options)
            })
    }

    /**
     * method install
     * @param node_package 
     * @param options 
     */
    async install(node_package: string, options: any) {
        try {
            await this.prologue(options)
            if (this.dbManager === undefined || !this.dbRemote) throw 'dbManager or dbRemote undefined'

            await installPackage(node_package, this.dbManager, this.dbRemote)
        }
        catch (err) {
            logger.error(err)
        }
    }
}

export async function installPackage(node_package: string, dbManager: DBManager, dbRemote: DBRemote) {

    /**
     * install the Node Package
     */
    await installNodePackage(node_package, dbManager, dbRemote)

    const installScript = await lookupInstallScript(node_package)

    if (installScript) {
        /**
         * execute installScript
         */
        const installPath = path.join('node_modules', node_package, 'scripts', installScript)
        await runShellCommand(installPath, [])
    }
    else {
        /**
         * default install : upload modules and execute _init.xml
         */
        await defaultInstallScript(node_package, dbManager, dbRemote)
    }

}

/**
 * method defaultInstallScript
 * @param node_package 
 */
async function defaultInstallScript(node_package: string, dbManager: DBManager, dbRemote: DBRemote) {

    console.log()
    console.log('Default install script')
    /**
     * upload package assets
     */
    await uploadPackageAssets(node_package, dbManager, dbRemote)

    /**
     * upload package modules to the server 
     */
    await uploadPackageModules(node_package, dbManager)
}

/**
 * function uploadPackageAssets
 * @param node_package 
 * @param dbManager 
 */
async function uploadPackageAssets(node_package: string, dbManager: DBManager, dbRemote: DBRemote) {
    const assetFolder = path.join('node_modules', node_package, 'asset')
    if (!fs.existsSync(assetFolder) || !fs.statSync(assetFolder).isDirectory()) {
        return
    }
    console.log()
    console.log('upload assets to server ...')
    
    const items = fs.readdirSync(assetFolder)
    for (let ind = 0; ind < items.length; ind++) {
        const item = items[ind]
        const itemPath = path.join(assetFolder, item)
        if (fs.statSync(itemPath).isDirectory()) {
            const dest = "/" + item + "/"
            await uploadDirectory(itemPath, dest, {yes: true}, dbManager, dbRemote)
        }
        else {
            const dest = "/" + item
            const fd: FileDescriptor = {path: path.join(assetFolder, item), mtime: new Date()}
            await uploadAsset(fd, dest, dbManager, dbRemote)
        }
        
    }
    console.log(green('*') + ' upload assets to server')
}

/**
 * function uploadModules
 * @param node_package 
 * @param dbManager 
 */
async function uploadPackageModules(node_package: string, dbManager: DBManager) {

    const moduleFolder = path.join('node_modules', node_package, 'module')
    if (!fs.existsSync(moduleFolder) || !fs.statSync(moduleFolder).isDirectory()) {
        return
    }
    console.log()
    console.log('upload modules to server ...')
    let initModule: string | undefined
    const files = fs.readdirSync(moduleFolder)
    for (let ind = 0; ind < files.length; ind++) {
        const file = files[ind]
        if (!dbManager) throw 'dbManager undefined'
        await uploadModule(path.join(moduleFolder, file), dbManager)
        if (file.endsWith('_init.xml')) {
            initModule = file
        }
    }
    console.log(green('*') + ' upload modules to server')
    if (initModule) {
        const initPath = path.join(moduleFolder, initModule)
        await runShellCommand('npx', ['cyk', 'run', initPath])
    }
}

/**
 * method installNodePackage
 * @param node_package 
 */
async function installNodePackage(node_package: string, dbManager: DBManager, dbRemote: DBRemote) {

    try {
        const packageJson = await readPackageJson()
        if (packageJson.devDependencies && packageJson.devDependencies[node_package] 
            || packageJson.dependencies && packageJson.dependencies[node_package]) {
            console.log(node_package + ' already installed. We uninstall it first')
            if (!dbManager) throw 'dbManager undefined'
            await uninstallPackage(node_package, dbManager, dbRemote)
        }

        await runShellCommand('npm', ['install', '--save-dev', node_package])
    } catch (error) {
        console.error('Error installing ' + node_package + ' :', error);
        throw error
    }
}
/**
 * function lookupInstallScript
 * @param node_package 
 */
async function lookupInstallScript(node_package: string): Promise<string | undefined> {
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