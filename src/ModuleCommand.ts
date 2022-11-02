#!/usr/bin/env ts-node
import { DBModule, parseXML } from "@cyklang/core"
import * as fs from "fs"
import loglevel from 'loglevel'
import path from "path"
import { Command } from 'commander'
import { Cmd } from "./Cmd"
import { DBClient } from "./DBClient"
const logger = loglevel.getLogger("ModuleCommand.ts")
logger.setLevel("debug")

export class ModuleCommand extends Command {
    constructor(name: string) {
        super(name)
        this.description('manage modules')
        // upload
        this.addCommand(new ModuleUpload('upload', `Upload local module file(s) to the database.
Module name is the base name of the file. If a module with the same name already exists, it will be updated.
Otherwise, a new module is inserted in the database. To rename a module, use option --id to indicate the module you want to rename`)
        )
        this.addCommand(new ModuleUpload('u', 'shortcut for (u)pload'))
        // download
        this.addCommand(new ModuleDownload('download', 'download module files to the current directory'))
        this.addCommand(new ModuleDownload('d', 'shortcut for (d)ownload'))
        // list
        this.addCommand(new ModuleList('list', 'List modules'))
        this.addCommand(new ModuleList('l', 'shortcut for (l)ist'))
        // rename

    }
}

function getModuleDBName(filePath: string): string {
    // let result
    // if (filePath.endsWith('.xml') === false) throw filePath + ' does not have .xml extension'
    // result = path.basename(filePath, '.xml')

    const result = path.parse(filePath).name
    const identifierRegex = /^[_a-zA-Z][_a-zA-Z0-9]*$/
    if (result.match(identifierRegex) === null) throw 'filename ' + result + ' does not match identifier syntax'
    return result
}
interface UploadOptions {
    id: string | undefined
    env: string | undefined
}
class ModuleUpload extends Cmd {
    constructor(name: string, description: string) {
        super(name)
        this.description(description)
            .option('-i --id <id>', 'module ID to upload')
            .argument('[files...]', 'local module file(s) to upload to the server')
            .action(async (files: any, options: any) => {
                await this.commandUpload(files, options)
            })
    }
    async commandUpload(files: string[], options: UploadOptions) {
        try {
            await this.prologue(options)
            if (this.dbManager === undefined) throw 'dbManager undefined'

            if (files.length === 0) throw 'file(s) argument is missing'
            if (options.id !== undefined) {
                if (files.length > 1) throw 'with --id option you can only specify 1 local file'
                const dbModule = await this.dbManager.getModule(options.id)
                dbModule.source = fs.readFileSync(files[0]).toString()
                dbModule.dbname = getModuleDBName(files[0])
                const tag = parseXML(dbModule.dbname, dbModule.source)
                dbModule.access = tag.attributes.ACCESS
                dbModule.description = tag.attributes.DESCRIPTION
                await this.dbManager.dbModuleUpdate(dbModule)
            }
            else {
                for (let ind = 0; ind < files.length; ind++) {
                    const file = files[ind]
                    const dbname = getModuleDBName(file)
                    const source = fs.readFileSync(file).toString()
                    const tag = parseXML(dbname, source)
                    const dbModuleExist = await this.dbManager.dbModuleExist(dbname)
                    if (dbModuleExist === undefined) {
                        // insert
                        const dbModule = new DBModule()
                        dbModule.source = source
                        dbModule.dbname = dbname
                        dbModule.access = tag.attributes.ACCESS
                        dbModule.description = tag.attributes.DESCRIPTION
                        logger.debug('module insert ' + dbname + ' access ' + dbModule.access + ' description ' + dbModule.description)
                        const id = await this.dbManager.dbModuleInsert(dbModule)
                        logger.info('module ' + dbname + ' added with ID ' + id)
                    }
                    else {
                        // update
                        dbModuleExist.source = source
                        dbModuleExist.access = tag.attributes.ACCESS
                        dbModuleExist.description = tag.attributes.DESCRIPTION
                        logger.debug('module update ' + dbname + ' access ' + dbModuleExist.access + ' description ' + dbModuleExist.description)
                        await this.dbManager.dbModuleUpdate(dbModuleExist)
                        logger.info('module ' + dbname + ' updated')
                    }
                }
            }
        }
        catch (err) {
            logger.error(err)
        }
    }
}

interface DownloadOptions {
    id: string | undefined
    env: string | undefined
    all: string | undefined
}
class ModuleDownload extends Cmd {
    constructor(name: string, description: string) {
        super(name)
        this.description(description)
            .option('-i --id <id>', 'module ID')
            .option('-a --all', 'download all the modules')
            .argument('[files...]', 'module(s) name(s) are derived as the basename(s) of the file(s) path')
            .action(async (files: string[], options: DownloadOptions) => {
                await this.commandDownload(files, options)
            })
    }
    async commandDownload(files: string[], options: DownloadOptions) {
        try {
            await this.prologue(options)
            if (this.dbManager === undefined) throw 'dbManager undefined'

            if (options.id !== undefined) {
                const dbModule = await this.dbManager.getModule(options.id)
                await this.downloadModule(dbModule.dbname || '', dbModule)
            }
            else if (options.all !== undefined) {
                const modules = await this.dbManager.getModules(undefined)
                for (let ind = 0; ind < modules.length; ind++) {
                    const dbModule = modules[ind]
                    await this.downloadModule(dbModule.dbname || '', dbModule)
                }
            }
            else {
                for (let ind = 0; ind < files.length; ind++) {
                    await this.downloadModule(getModuleDBName(files[ind]))
                }
            }

        }
        catch (err) {
            logger.error(err)
        }
    }

    async downloadModule(dbname: string, dbModule?: DBModule) {
        logger.debug('downloadModule ' + dbname)
        if (dbModule === undefined) {
            dbModule = await this.dbManager?.dbModuleExist(dbname)
            if (dbModule === undefined) throw 'module not found : ' + dbname
        }
        const filePath = dbname + '.xml'
        if (fs.existsSync(filePath) === true) {
            logger.info('file ' + filePath + ' already exists. Remove it before launching the command if you want to overwrite.')
        }
        else {
            fs.writeFileSync(filePath, dbModule.source || '')
            logger.info('module ' + dbname + ' has been downloaded and file ' + filePath + ' has been created')
        }
    }
}

class ModuleList extends Cmd {
    constructor(name: string, description: string) {
        super(name)
        this.description(description)
            .option('-s --sort <columns>', 'sort list by column numbers (begins by 0) separated by comma')
            .action(async (options: any) => {
                await this.commandList(options)
            })
    }

    async commandList(options: any) {
        try {
            await this.prologue(options)
            if (this.dbManager === undefined) throw 'dbManager undefined'

            const dbClient = new DBClient(this.dbManager)
            dbClient.selectFromTable('List of Modules', 'cyk_module',
                { fields: 'module_id,module_dbname,module_access,module_description', sort: options.sort || '1' })

        }
        catch (err) {
            logger.error(err)
        }
    }
}

class ModuleDelete extends Cmd {
    constructor(name: string, description: string) {
        super(name)
        this.description(description)
        .argument('[files...]', 'module(s) to delete from the database')
        .action(async(files: any, options: any) => {
            await this.commandDelete(files, options)
        })
    }
    async commandDelete(files: string[], options: any) {
        try {
            await this.prologue(options)
            if (this.dbManager === undefined) throw 'dbManager undefined'

            if (files.length === 0) throw 'no module to delete'


        }
        catch (err){
            logger.error(err)
        } 
    }
}

