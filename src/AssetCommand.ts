import { Command } from "commander"
import { getLogger, resetLevel } from "loglevel"
import { Cmd } from "./Cmd"
import { DBClient } from "./DBClient"
import * as fs from "fs"
import path from "path"
import mime from 'mime-types'
import readline from 'readline'
import { DBAsset } from "@cyklang/core"
const logger = getLogger('AssetCommand.ts')
logger.setLevel('debug')

export class AssetCommand extends Command {
    constructor(name: string, description: string) {
        super(name)
        this.description(description)
        this.addCommand(new AssetList('list', 'list assets'))
        this.addCommand(new AssetList('l', '(l)ist assets'))
        this.addCommand(new AssetUpload('upload', 'upload assets from current directory'))
        this.addCommand(new AssetUpload('u', '(u)pload assets'))
    }
}

class AssetList extends Cmd {
    constructor(name: string, description: string) {
        super(name)
        this.description(description)
            .option('-s --sort <columns>', 'sort list by column numbers (begins by 0) separated by comma')
            .action(async (options: any) => { await this.commandList(options) })
    }
    async commandList(options: any) {
        try {
            await this.prologue(options)
            if (this.dbManager === undefined) throw 'dbManager undefined'

            const dbClient = new DBClient(this.dbManager)
            dbClient.selectFromTable('List of Assets', 'cyk_asset',
                { fields: 'asset_id,asset_route,asset_mimetype', sort: options.sort || '1' }
            )
        }
        catch (err) {
            logger.error(err)
        }
    }
}

class AssetUpload extends Cmd {

    constructor(name: string, description: string) {
        super(name)
        this.description(description)
            .option('-d --dest <destination>', 'route of destination')
            .argument('[sources...]', 'local files or directories to upload as assets to the server')
            .action(async (sources: any, options: any) => {
                await this.commandUpload(sources, options)
            })
    }
    async commandUpload(sources: string[], options: any) {

        try {
            await this.prologue(options)
            if (this.dbManager === undefined) throw 'dbManager undefined'

            if (sources.length === 0) throw 'no source to upload'

            let dest = "/"
            if (options.dest !== undefined) dest = options.dest
            if (dest.substring(0, 1) !== '/') dest = '/' + dest
            if (dest.substring(dest.length - 1) !== '/') dest = dest + '/'

            for (let ind = 0; ind < sources.length; ind++ ) {
                const source = sources[ind]
                if (fs.existsSync(source) === false) throw 'source ' + source + ' does not exist'
                const filestat = fs.lstatSync(source)
                if (filestat.isDirectory() === true) {
                    await this.uploadDirectory(source, dest)
                }
                else if (filestat.isFile() === true) {
                    const base = path.parse(source).base
                    logger.debug('upload file ' + source + ' to ' + dest + base)
                    this.uploadFile(source, dest +  base)
                }
            }
        }
        catch (err) {
            logger.error(err)
        }
    }

    async uploadDirectory(source: string, dest: string) {

        const fileNames: string[] = []
        let dirName: string
        if (source.substring(source.length - 1) === '/') {
            // trailing directory separator
            dirName = source
        }
        else {
            dirName = source + '/'
        }

        logger.debug('dirName', dirName )

        this.scanDir(dirName, fileNames)
        logger.info(fileNames.join('\n'))
        if (fileNames.length === 0) throw 'None file to upload'

        const rl = readline.createInterface(process.stdin, process.stdout)
        rl.question('Do you want to upload this(these) ' + fileNames.length + ' file(s) (Y/N/y/n) ?', async (reply) => {
            rl.close()
            if (reply !== 'Y' && reply !== 'y') {
                logger.info('upload cancelled')
                return
            }

            await this.uploadFiles(dirName, fileNames, dest)
        })
    }

    scanDir(dirName: string, result: string[]) {
        const files = fs.readdirSync(dirName)
        for (let ind = 0; ind < files.length; ind++) {
            const fileName = files[ind]
            if (this.file2exclude(fileName) === true) continue
            if (fs.statSync(dirName + fileName).isDirectory() === true) {
                this.scanDir(dirName + fileName + '/', result)
            }
            else {
                if (mime.lookup(fileName) === false) continue
                result.push(dirName + fileName)
                // logger.debug(dirName + '/' + fileName)
            }
        }
    }

    ignorePatterns = ['.git', 'node_modules']

    file2exclude(fileName: string): boolean {
        let result = false
        this.ignorePatterns.forEach((pattern) => {
            if (fileName === pattern) result = true
        })
        return result
    }

    async uploadFiles(dirName: string, fileNames: string[], dest: string) {
        for (let ind = 0; ind < fileNames.length; ind++) {
            const fileName = fileNames[ind]
            const route = dest + fileName.substring(dirName.length)
            logger.debug('upload ' + fileName + ' to ' + route)
            // await this.uploadFile(fileName, route)
        }
    }

    async uploadFile(fileName: string, route: string) {
        logger.debug('upload ' + fileName + ' to route ' + route + ' with mimetype ' + mime.lookup(fileName))
        
        try {
            let dbAsset: DBAsset | undefined = await this.dbManager?.dbAssetExist(route)
            if (dbAsset === undefined) {
                dbAsset = new DBAsset()
            }
            const mimetype = mime.lookup(fileName)
            if (mimetype === false) throw 'mimetype false for ' + fileName 
            dbAsset.mimetype = mimetype
            dbAsset.route = route
            
            const contentBuffer = fs.readFileSync(fileName)
            dbAsset.content = contentBuffer
            logger.debug('dbAsset.content length ' + dbAsset.content.length)
            // logger.debug(dbAsset.content)
            if (dbAsset.id === undefined) {
                const id = await this.dbManager?.dbAssetInsert(dbAsset)
                logger.info('added asset ' + id + ' route ' + dbAsset.route)
            }
            else {
                await this.dbManager?.dbAssetUpdate(dbAsset)
                logger.info('asset ' + dbAsset.route + ' updated')
            }
        }
        catch (err) {
            logger.error(err)
        }
    }
}
