import { Command } from "commander"
import { getLogger, resetLevel } from "loglevel"
import { Cmd } from "./Cmd"
import { DBClient } from "./DBClient"
import * as fs from "fs"
import path from "path"
import mime from 'mime-types'
import inquirer from 'inquirer'
// import readline from 'readline'
import { DBAsset, DBExecuteRequest, ObjectData, parseXML, PrimitiveData } from "@cyklang/core"
import FormData from 'form-data'

const logger = getLogger('AssetCommand.ts')
logger.setLevel('debug')

export class AssetCommand extends Command {
    constructor(name: string, description: string) {
        super(name)
        this.description(description)
        this.addCommand(new AssetList('list', 'list assets'))
        this.addCommand(new AssetList('l', '(l)ist assets'))
        this.addCommand(new AssetUpload('upload', 'upload assets from sources'))
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
                { fields: 'asset_id,asset_route,asset_auth,asset_access,asset_mimetype,asset_last_update', sort: options.sort || '1' }
            )
        }
        catch (err) {
            logger.error(err)
        }
    }
}

//----------------------------------------------------------------------------------------------
// class AssetUpload
//----------------------------------------------------------------------------------------------

interface FileDescriptor {
    path: string
    mtime: Date
    id?: number
}
class AssetUpload extends Cmd {

    constructor(name: string, description: string) {
        super(name)
        this.description(description)
            .option('-a --auth <auth_schema>', 'authentication schema : basic | token | any, default is no authentication')
            .option('-d --dest <destination>', 'destination path, directory name')
            .option('-c --clean', 'clean destination path before uploading')
            .option('-y --yes', 'upload list is automatically confirmed')
            .argument('[sources...]', 'local files or directories to upload as assets to the server')
            .action(async (sources: any, options: any) => {
                await this.commandUpload(sources, options)
            })
    }

    mimetypeLookup(filename: string): string | false {
        let result: string | false
        if (path.extname(filename) === '.cyk') {
            result = 'application/xml'
        }
        else {
            result = mime.lookup(filename)
        }
        return result
    }

    async commandUpload(sources: string[], options: any) {

        try {
            await this.prologue(options)
            if (this.dbManager === undefined) throw 'dbManager undefined'

            if (sources.length === 0) throw 'no source to upload'

            if ( options.auth && ' basic | token | any '.indexOf(options.auth) === -1 ) {
                throw 'valid authentication schemas are : basic | token | any'
            }
            logger.debug('options : ', options)
            logger.debug('auth : ' + options.auth)

            let dest = "/"
            if (options.dest !== undefined) dest = options.dest
            if (dest.substring(0, 1) !== '/') dest = '/' + dest
            if (dest.substring(dest.length - 1) !== '/') dest = dest + '/'

            if (options.clean) {
                await this.cleanDestination(dest)
            }

            for (let ind = 0; ind < sources.length; ind++) {
                const source = sources[ind]
                if (fs.existsSync(source) === false) throw 'source ' + source + ' does not exist'
                const filestat = fs.lstatSync(source)
                if (filestat.isDirectory() === true) {
                    await this.uploadDirectory(source, dest, options)
                }
                else if (filestat.isFile() === true) {
                    const base = path.parse(source).base
                    logger.debug('upload file ' + source + ' to ' + dest + base)
                    await this.uploadAsset({ path: source, mtime: filestat.mtime }, dest + base, options.auth)
                }
            }
        }
        catch (err) {
            logger.error(err)
        }
    }

    //----------------------------------------------------------------------------------------------
    // cleanDestination
    //----------------------------------------------------------------------------------------------

    async cleanDestination(dest: string) {

        const remoteList = await this.scanAssets()
        for(let ind = 0; ind < remoteList.length; ind++) {
            const fd = remoteList[ind]
            if (fd.path.startsWith(dest)) {
                const url = '/api/admin/assets/' + fd.id
                await this.dbRemote?.apiServer.delete(url)
            }
        }
    }

    //----------------------------------------------------------------------------------------------
    // uploadDirectory
    //----------------------------------------------------------------------------------------------

    async uploadDirectory(source: string, dest: string, options: any) {

        const localList: FileDescriptor[] = []
        let dirName: string
        if (source.substring(source.length - 1) === '/') {
            // trailing directory separator
            dirName = source
        }
        else {
            dirName = source + '/'
        }

        logger.debug('options', options)

        this.scanDir(dirName, localList)

        const remoteList = await this.scanAssets()

        const uploadList = this.buildUploadList(dirName, dest, localList, remoteList)

        // logger.info(fileNames.join('\n'))
        if (uploadList.length === 0) throw 'None file to upload'

        let uploadConfirmed = (options.yes !== undefined)

        if (uploadConfirmed === false) {
            const reply = await inquirer.prompt({ type: 'confirm', name: 'confirm', message: 'Do you want to upload this(these) ' + uploadList.length + ' file(s) ?' })
            if (reply.confirm === true) uploadConfirmed = true
        }

        if (uploadConfirmed === true) {
            await this.uploadFiles(dirName, uploadList, dest, options.auth)
        }

        // const rl = readline.createInterface(process.stdin, process.stdout)
        // rl.question('Do you want to upload this(these) ' + uploadList.length + ' file(s) (Y/N/y/n) ?', async (reply) => {
        //     rl.close()
        //     if (reply !== 'Y' && reply !== 'y') {
        //         logger.info('upload cancelled')
        //         return
        //     }

        //     await this.uploadFiles(dirName, uploadList, dest)
        // })
    }

    //----------------------------------------------------------------------------------------------
    // buildUploadList
    //----------------------------------------------------------------------------------------------

    buildUploadList(dirName: string, dest: string, localList: FileDescriptor[], remoteList: FileDescriptor[]): FileDescriptor[] {
        const result: FileDescriptor[] = []
        const remoteMap = new Map<string, FileDescriptor>()
        for (let ind = 0; ind < remoteList.length; ind++) {
            const remote = remoteList[ind]
            remoteMap.set(remote.path, remote)
        }
        for (let ind = 0; ind < localList.length; ind++) {
            const localDesc = localList[ind]
            const route = dest + localDesc.path.substring(dirName.length)
            const remoteDesc = remoteMap.get(route)

            if (remoteDesc === undefined || remoteDesc.mtime.getTime() + 1000 < localDesc.mtime.getTime()) {
                if (remoteDesc === undefined) logger.debug('remoteDesc undefined')
                else logger.debug('remoteDesc.mtime ' + remoteDesc.mtime.getTime(), 'localDesc.mtime ' + localDesc.mtime.getTime())
                logger.info(localDesc.path)
                result.push(localDesc)
            }
        }
        return result
    }


    //----------------------------------------------------------------------------------------------
    // scanAssets
    //----------------------------------------------------------------------------------------------

    async scanAssets() {
        const result: FileDescriptor[] = []
        if (this.dbManager === undefined) throw 'dbManager undefined'
        const dbReq = new DBExecuteRequest()
        dbReq.selectFromTable = 'cyk_asset'
        const pFields = dbReq.parameters.addVariable('fields', this.dbManager.scope.structure.stringDataType)
        pFields.data = new PrimitiveData(this.dbManager.scope.structure.stringDataType, "asset_id,asset_route,asset_last_update,asset_mimetype")
        const xmlResult = await this.dbManager.dbExecute(dbReq)
        if (xmlResult === undefined || xmlResult === null) throw 'xmlResult null or undefined'
        const tag = parseXML('scanAssets', xmlResult)
        const objResult = await this.dbManager.scope.structure.objectDataType.parseData(tag, this.dbManager.scope) as ObjectData
        const rows = (objResult.variables.getData('cyk_asset') as ObjectData).variables
        for (let ind = 0; ind < rows.list.length; ind++) {
            const { variable: row } = rows.list[ind]
            const record = row.data as ObjectData
            const asset_id = (record.variables.getData('asset_id') as PrimitiveData).value as number
            const asset_route = (record.variables.getData('asset_route') as PrimitiveData).value as string
            const asset_last_update = (record.variables.getData('asset_last_update') as PrimitiveData)?.value as Date
            // logger.debug('asset_route ' + asset_route,'asset_last_update ' + asset_last_update)
            result.push({ path: asset_route, mtime: asset_last_update, id: asset_id })
        }
        return result
    }

    //----------------------------------------------------------------------------------------------
    // scanDir
    //----------------------------------------------------------------------------------------------

    scanDir(dirName: string, result: FileDescriptor[]) {
        const files = fs.readdirSync(dirName)
        for (let ind = 0; ind < files.length; ind++) {
            const fileName = files[ind]
            if (this.file2exclude(fileName) === true) continue
            const fstat = fs.statSync(dirName + fileName)
            if (fstat.isDirectory() === true) {
                this.scanDir(dirName + fileName + '/', result)
            }
            else {
                if (this.mimetypeLookup(fileName) === false) {
                    logger.info(fileName + ' file extension is unknown and will not be uploaded')
                    continue
                }
                //const dbAssetExist = this.dbManager?.dbAssetExist()
                result.push({ path: dirName + fileName, mtime: fstat.mtime })
                // logger.debug(dirName + '/' + fileName)
            }
        }
    }

    //----------------------------------------------------------------------------------------------
    // file2exclude
    //----------------------------------------------------------------------------------------------

    ignorePatterns = ['.git', 'node_modules']

    file2exclude(fileName: string): boolean {
        let result = false
        this.ignorePatterns.forEach((pattern) => {
            if (fileName === pattern) result = true
        })
        return result
    }

    //----------------------------------------------------------------------------------------------
    // uploadFiles
    //----------------------------------------------------------------------------------------------

    async uploadFiles(dirName: string, uploadList: FileDescriptor[], dest: string, auth: string | undefined) {
        for (let ind = 0; ind < uploadList.length; ind++) {
            const upload = uploadList[ind]
            const route = dest + upload.path.substring(dirName.length)
            logger.debug('upload ' + upload.path + ' to ' + route)
            await this.uploadAsset(upload, route, auth)
        }
    }

    //----------------------------------------------------------------------------------------------
    // uploadAsset
    //----------------------------------------------------------------------------------------------

    async uploadAsset(upload: FileDescriptor, route: string, auth?: string) {
        logger.debug('uploadAsset ' + upload.path + ' to route ' + route + ' with mimetype ' + this.mimetypeLookup(upload.path) + ', auth : ' + auth)

        try {
            let dbAsset: DBAsset | undefined = await this.dbManager?.dbAssetExist(route)
            if (dbAsset === undefined) {
                dbAsset = new DBAsset()
            }
            const mimetype = this.mimetypeLookup(upload.path)
            if (mimetype === false) throw 'mimetype false for ' + upload
            dbAsset.mimetype = mimetype
            dbAsset.route = route
            dbAsset.auth = auth
            
            // const fstat = fs.statSync(fileName)
            dbAsset.last_update = upload.mtime

            // const contentBuffer = fs.readFileSync(fileName)
            // dbAsset.content = contentBuffer
            // logger.debug('dbAsset.content length ' + dbAsset.content.length)

            if (dbAsset.id === undefined) {
                dbAsset.id = await this.dbManager?.dbAssetInsert(dbAsset)
                logger.info('inserted asset ' + dbAsset.id + ' route ' + dbAsset.route)
            }
            else {
                await this.dbManager?.dbAssetUpdate(dbAsset)
                logger.info('updated asset ' + dbAsset.route)
            }

            await this.uploadAssetContent(dbAsset, upload.path)
        }
        catch (err) {
            logger.error(err)
        }
    }

    //----------------------------------------------------------------------------------------------
    // uploadAssetContent
    //----------------------------------------------------------------------------------------------

    async uploadAssetContent(dbAsset: DBAsset, fileName: string) {
        logger.debug('uploadAssetContent file ' + fileName + ' to path ' + path)
        try {
            const file = fs.createReadStream(fileName)
            const form = new FormData()
            form.append('uploadFile', file)

            const route = '/api/upload/cyk_asset/asset_content?asset_id=' + dbAsset.id
            const resp = await this.dbRemote?.apiServer.post(route, form)
            if (resp.status === 200) {
                logger.info(fileName + ' uploaded')
            }
        }
        catch (err) {
            logger.error(err)
        }
    }
}
