import { Command } from "commander"
import { getLogger, resetLevel } from "loglevel"
import { Cmd } from "./Cmd"
import { DBClient } from "./DBClient"
import * as fs from "fs"
import path from "path"
import mime from 'mime-types'
import inquirer from 'inquirer'
// import readline from 'readline'
import { DBAsset, DBExecuteRequest, DBManager, DBRemote, ObjectData, parseXML, PrimitiveData } from "@cyklang/core"
import FormData from 'form-data'

const logger = getLogger('AssetCommand.ts')
logger.setLevel('debug')


//----------------------------------------------------------------------------------------------
// scanAssets
//----------------------------------------------------------------------------------------------

const scanAssets = async (dbManager: DBManager | undefined, dest?: string): Promise<FileDescriptor[]> => {

    const result: FileDescriptor[] = []
    if (dbManager === undefined) throw 'dbManager undefined'
    const dbReq = new DBExecuteRequest()
    dbReq.selectFromTable = 'cyk_asset'
    const pFields = dbReq.parameters.addVariable('fields', dbManager.scope.structure.stringDataType)
    pFields.data = new PrimitiveData(dbManager.scope.structure.stringDataType, "asset_id,asset_route,asset_last_update,asset_mimetype")
    const objResult = await dbManager.dbExecute(dbReq)
    if (!objResult) throw 'objResult undefined'
    const rows = (objResult.variables.getData('resultset') as ObjectData).variables
    for (let ind = 0; ind < rows.length(); ind++) {
        const namedVariable = rows.at(ind)
        const record = namedVariable?.variable.data as ObjectData
        const asset_id = (record.variables.getData('asset_id') as PrimitiveData).value as number
        const asset_route = (record.variables.getData('asset_route') as PrimitiveData).value as string
        const asset_last_update = (record.variables.getData('asset_last_update') as PrimitiveData)?.value as Date
        // logger.debug('asset_route ' + asset_route,'asset_last_update ' + asset_last_update)

        if (!dest || asset_route.startsWith(dest))
            result.push({ path: asset_route, mtime: asset_last_update, id: asset_id })
    }
    return result
}

export class AssetCommand extends Command {
    constructor(name: string, description: string) {
        super(name)
        this.description(description)
        this.addCommand(new AssetList('list', 'list assets'))
        this.addCommand(new AssetList('l', '(l)ist assets'))
        this.addCommand(new AssetU('upload', 'upload asset content from source files to a <destination> path'))
        this.addCommand(new AssetU('update', 'update properties of asset identified by its <id>'))
        this.addCommand(new AssetU('u', '(u)pload assets content from sources or (u)pdate asset properties'))
        this.addCommand(new AssetDelete('delete', 'delete an asset'))
    }
}

/**
 * class AssetDelete
 */
class AssetDelete extends Cmd {
    constructor(name: string, description: string) {
        super(name)
        this.description(description)
            .option('-i --id <id_pathname>', 'asset id or pathname to delete')
            .option('-d --dest <destination>', 'delete all assets whose pathname begins with dest')
            .action(async (options: any) => {
                if (options.id)
                    await this.commandDeleteOne(options)
                else if (options.dest) {
                    await this.commandDeletePathname(options)
                }
                else {
                    logger.error('one of --id or --dest options is required')
                }
            })
    }

    /**
     * 
     * @param options 
     */
    async commandDeleteOne(options: any) {
        try {
            await this.prologue(options)
            if (this.dbManager === undefined) throw 'dbManager undefined'

            if (options.id === undefined) throw '<id_or_pathname> of asset to delete is missing'

            if (!options.id.startsWith('/')) throw '-i --id only pathname is supported at the moment'

            const dbAsset = await this.dbManager.dbAssetExist(options.id)
            if (dbAsset === undefined) throw 'Asset ' + options.id + ' not found'

            await this.dbManager.dbAssetDelete(dbAsset)

            logger.info('asset ' + dbAsset.id + ' ' + dbAsset.route + ' deleted')
        }
        catch (err) {
            logger.error(err)
        }
    }

    /**
     * 
     * @param options 
     */
    async commandDeletePathname(options: any) {

        try {
            await this.prologue(options)
            if (!this.dbManager) throw 'dbManager undefined'
            const dbClient = new DBClient(this.dbManager)
            const list = await dbClient.selectFromTable('Assets to delete', 'cyk_asset',
                {
                    fields: 'asset_id,asset_route,asset_auth,asset_access,asset_mimetype,asset_last_update', sort: options.sort || '1',
                    where: (options.dest ? "asset_route like '" + options.dest + "%'" : undefined)
                }

            );
            const reply = await inquirer.prompt({ type: 'confirm', name: 'confirm', message: 'Do you want to delete these ' + list.length + ' file(s)' })
            if (reply.confirm) {
                for (let ind = 0; ind < list.length; ind++) {
                    const asset = list[ind]
                    logger.info('delete ' + asset.asset_route)
                    const url = '/api/admin/assets/' + asset.asset_id
                    await this.dbRemote?.apiServer.delete(url)
                }
            }

        }
        catch (err) {
            logger.error(err)
        }

    }

}

class AssetList extends Cmd {
    constructor(name: string, description: string) {
        super(name)
        this.description(description)
            .option('-d --dest <destination>', 'filter assets whose pathname begins with destination')
            .option('-s --sort <columns>', 'sort list by column numbers (begins by 0) separated by comma')
            .action(async (options: any) => { await this.commandList(options) })
    }
    async commandList(options: any) {
        try {
            await this.prologue(options)
            if (this.dbManager === undefined) throw 'dbManager undefined'

            const dbClient = new DBClient(this.dbManager)
            dbClient.selectFromTable('List of Assets', 'cyk_asset',
                {
                    fields: 'asset_id,asset_route,asset_auth,asset_access,asset_mimetype,asset_last_update', sort: options.sort || '1',
                    where: (options.dest ? "asset_route like '" + options.dest + "%'" : undefined)
                }

            )
        }
        catch (err) {
            logger.error(err)
        }
    }
}

export interface FileDescriptor {
    path: string
    mtime: Date
    id?: number
}
/**
 * class AssetU
 */
class AssetU extends Cmd {

    constructor(name: string, description: string) {
        super(name)
        this.description(description)
            .option('-i --id <id>', 'asset id or pathname whose properties are updated')
            .option('--auth <auth_schema>', 'authentication schema : basic | token | cookie | any | none, default is none')
            .option('--access <access>', 'access rights required')
            .option('-d --dest <destination>', 'destination path, directory name')
            .option('-c --clean', 'clean destination path before uploading')
            .option('-y --yes', 'upload list is automatically confirmed')
            .argument('[sources...]', 'local files or directories to upload as assets to the server')
            .action(async (sources: any, options: any) => {
                await this.commandU(sources, options)
            })
    }



    /**
     * method commandU
     * @param sources 
     * @param options 
     */
    async commandU(sources: string[], options: any) {
        if (sources.length > 0) {
            // upload
            // logger.debug('upload sources :', sources)
            await this.commandUpload(sources, options)
        }
        else {
            // update
            // logger.debug('update', options)
            await this.commandUpdate(options)
        }
    }

    /**
     * method commandUpdate
     * @param options 
     */
    async commandUpdate(options: any) {
        try {
            await this.prologue(options)
            if (this.dbManager === undefined) throw 'dbManager undefined'

            if (options.id === undefined) throw '<id_or_pathname> of asset to update is missing'

            if (!options.id.startsWith('/')) throw '-i --id only pathname is supported at the moment'

            const dbAsset = await this.dbManager.dbAssetExist(options.id)
            if (dbAsset === undefined) throw 'Asset ' + options.id + ' not found'

            await this.updateAuthAccess('cyk_asset', 'asset', dbAsset.id || '', options)

        }
        catch (err) {
            logger.error(err)
        }
    }

    /**
     * method commandUpload
     * @param sources 
     * @param options 
     */
    async commandUpload(sources: string[], options: any) {

        try {
            await this.prologue(options)
            if (this.dbManager === undefined) throw 'dbManager undefined'

            if (sources.length === 0) throw 'no source to upload'

            if (options.auth && ' basic | token | cookie | any | none'.indexOf(options.auth) === -1) {
                throw 'valid authentication schemas are : basic | token | cookie | any | none'
            }
            // logger.debug('options : ', options)
            // logger.debug('auth : ' + options.auth)

            let dest = "/"
            if (options.dest !== undefined) dest = options.dest
            if (dest.substring(0, 1) !== '/') dest = '/' + dest
            if (dest.substring(dest.length - 1) !== '/') dest = dest + '/'

            if (options.clean) {
                await cleanDestination(dest, this.dbManager, this.dbRemote)
            }

            for (let ind = 0; ind < sources.length; ind++) {
                const source = sources[ind]
                if (fs.existsSync(source) === false) throw 'source ' + source + ' does not exist'
                const filestat = fs.lstatSync(source)
                if (filestat.isDirectory() === true) {
                    await uploadDirectory(source, dest, options, this.dbManager, this.dbRemote)
                }
                else if (filestat.isFile() === true) {
                    const base = path.parse(source).base
                    logger.debug('upload file ' + source + ' to ' + dest + base)
                    await uploadAsset({ path: source, mtime: filestat.mtime }, dest + base, this.dbManager, this.dbRemote, options.auth)
                }
            }
        }
        catch (err) {
            logger.error(err)
        }
    }
}

/**
 * function cleanDestination
 * @param dest 
 * @param dbManager 
 * @param dbRemote 
 */
async function cleanDestination(dest: string, dbManager: DBManager | undefined, dbRemote: DBRemote | undefined) {

    const remoteList = await scanAssets(dbManager)
    for (let ind = 0; ind < remoteList.length; ind++) {
        const fd = remoteList[ind]
        if (fd.path.startsWith(dest)) {
            const url = '/api/admin/assets/' + fd.id
            await dbRemote?.apiServer.delete(url)
        }
    }
}
/**
 * function uploadDirectory
 * @param source 
 * @param dest 
 * @param options {yes: no confirmation, auth: basic/token/cookie/undefined}
 * @param dbManager 
 * @param dbRemote 
 */
export async function uploadDirectory(source: string, dest: string, options: any, 
    dbManager: DBManager | undefined, dbRemote: DBRemote | undefined) {

    const localList: FileDescriptor[] = []
    let dirName: string
    if (source.substring(source.length - 1) === '/') {
        // trailing directory separator
        dirName = source
    }
    else {
        dirName = source + '/'
    }

    // logger.debug('options', options)

    scanDir(dirName, localList)

    const remoteList = await scanAssets(dbManager)

    const uploadList = buildUploadList(dirName, dest, localList, remoteList)

    // logger.info(fileNames.join('\n'))
    if (uploadList.length === 0) throw 'None file to upload'

    let uploadConfirmed = (options.yes !== undefined)

    if (uploadConfirmed === false) {
        const reply = await inquirer.prompt({ type: 'confirm', name: 'confirm', message: 'Do you want to upload this(these) ' + uploadList.length + ' file(s) ?' })
        if (reply.confirm === true) uploadConfirmed = true
    }

    if (uploadConfirmed === true) {
        await uploadFiles(dirName, uploadList, dest, dbManager, dbRemote, options.auth)
    }
}
/**
 * function buildUploadList
 * @param dirName 
 * @param dest 
 * @param localList 
 * @param remoteList 
 * @returns 
 */
function buildUploadList(dirName: string, dest: string, localList: FileDescriptor[], remoteList: FileDescriptor[]): FileDescriptor[] {
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
            // if (remoteDesc === undefined) logger.debug('remoteDesc undefined')
            // else logger.debug('remoteDesc.mtime ' + remoteDesc.mtime.getTime(), 'localDesc.mtime ' + localDesc.mtime.getTime())
            // logger.info(localDesc.path)
            result.push(localDesc)
        }
    }
    return result
}
/**
 * function scanDir
 * @param dirName 
 * @param result 
 */
function scanDir(dirName: string, result: FileDescriptor[]) {
    const files = fs.readdirSync(dirName)
    for (let ind = 0; ind < files.length; ind++) {
        const fileName = files[ind]
        if (file2exclude(fileName) === true) continue
        const fstat = fs.statSync(dirName + fileName)
        if (fstat.isDirectory() === true) {
            scanDir(dirName + fileName + '/', result)
        }
        else {
            if (mimetypeLookup(fileName) === false) {
                logger.info(fileName + ' file extension is unknown and will not be uploaded')
                continue
            }
            //const dbAssetExist = this.dbManager?.dbAssetExist()
            result.push({ path: dirName + fileName, mtime: fstat.mtime })
            // logger.debug(dirName + '/' + fileName)
        }
    }
}

const ignorePatterns = ['.git', 'node_modules']
/**
 * function file2exclude
 * @param fileName 
 * @returns 
 */
function file2exclude(fileName: string): boolean {
    let result = false
    ignorePatterns.forEach((pattern) => {
        if (fileName === pattern) result = true
    })
    return result
}
/**
 * function uploadFiles
 * @param dirName 
 * @param uploadList 
 * @param dest 
 * @param dbManager 
 * @param dbRemote 
 * @param auth 
 */
async function uploadFiles(dirName: string, uploadList: FileDescriptor[], dest: string, dbManager: DBManager | undefined, dbRemote: DBRemote | undefined, auth: string | undefined) {
    for (let ind = 0; ind < uploadList.length; ind++) {
        const upload = uploadList[ind]
        const route = dest + upload.path.substring(dirName.length)
        // logger.debug('upload ' + upload.path + ' to ' + route)
        await uploadAsset(upload, route, dbManager, dbRemote, auth)
    }
}

/**
 * function uploadAsset
 * @param upload 
 * @param route 
 * @param dbManager 
 * @param dbRemote 
 * @param auth 
 */
export async function uploadAsset(upload: FileDescriptor, route: string, dbManager: DBManager | undefined, dbRemote: DBRemote | undefined, auth?: string) {
    // logger.debug('uploadAsset ' + upload.path + ' to route ' + route + ' with mimetype ' + this.mimetypeLookup(upload.path) + ', auth : ' + auth)

    try {
        let dbAsset: DBAsset | undefined = await dbManager?.dbAssetExist(route)
        if (dbAsset === undefined) {
            dbAsset = new DBAsset()
        }
        const mimetype = mimetypeLookup(upload.path)
        if (mimetype === false) throw 'mimetype false for ' + upload
        dbAsset.mimetype = mimetype
        dbAsset.route = route
        dbAsset.auth = auth
        if (dbAsset.auth === 'none') dbAsset.auth = undefined

        // const fstat = fs.statSync(fileName)
        dbAsset.last_update = upload.mtime

        // const contentBuffer = fs.readFileSync(fileName)
        // dbAsset.content = contentBuffer
        // logger.debug('dbAsset.content length ' + dbAsset.content.length)

        if (dbAsset.id === undefined) {
            dbAsset.id = await dbManager?.dbAssetInsert(dbAsset)
            logger.info('inserted asset ' + dbAsset.route)
        }
        else {
            await dbManager?.dbAssetUpdate(dbAsset)
            logger.info('updated asset ' + dbAsset.route)
        }

        await uploadAssetContent(dbAsset, upload.path, dbRemote)
    }
    catch (err) {
        logger.error(err)
    }
}

/**
 * function mimetypeLookup
 * @param filename 
 * @returns 
 */
function mimetypeLookup(filename: string): string | false {
    let result: string | false
    if (path.extname(filename) === '.cyk') {
        result = 'application/xml'
    }
    else {
        result = mime.lookup(filename)
    }
    return result
}

/**
 * function uploadAssetContent
 * @param dbAsset 
 * @param fileName 
 * @param dbRemote 
 */
async function uploadAssetContent(dbAsset: DBAsset, fileName: string, dbRemote: DBRemote | undefined) {
    // logger.debug('uploadAssetContent file ' + fileName + ' to path ' + path)
    try {
        const file = fs.createReadStream(fileName)
        const form = new FormData()
        form.append('uploadFile', file)

        const route = `/api/admin/assets/${dbAsset.id}/content`
        const resp = await dbRemote?.apiServer.post(route, form)
        logger.debug("metadata", resp)

    }
    catch (err) {
        logger.error(err)
    }
}
