#!/usr/bin/env ts-node
import { DBModule, ModuleInstruction, parseXML, Scope } from "@cyklang/core"
import * as fs from "fs"
import loglevel from 'loglevel'
import path from "path"
import { Command } from 'commander'
import { Cmd } from "./Cmd"
const logger = loglevel.getLogger("ModuleCommand.ts")
logger.setLevel("debug")

export class ModuleCommand extends Command {
    constructor() {
        super('module')
        this.description('manage modules').version('0.1')
        this.addCommand(new ModuleAddCmd())
        this.addCommand(new ModuleUpdateCmd())
        this.addCommand(new ModuleRunCmd())
    }
}

class ModuleAddCmd extends Cmd {
    constructor() {
        super('add')
        this.description('add modules')
            .argument('<files...>', 'local module file(s) to upload to the server')
            .option('-n --name <dbname>', 'module dbname')
            .option('-d --desc <description>', 'description')
            .option('-a --access <access>', 'access control list')
            .action(async (files: any, options: any) => {
                await this.commandAdd(files, options)
            })
    }

    async commandAdd(files: string[], options: Options) {
        // logger.debug('options : ', options, ', files : ', files)
        try {
            await this.prologue(options)
            if (this.dbManager === undefined) throw 'dbManager undefined'
            if (options.id !== undefined) throw '--id option is not available'
            if (files.length === 0) throw 'file(s) name(s) missing'
            if (files.length > 1 && (options.name !== undefined)) throw '--name option cannot be specified with more than 1 file'
            for (let ind = 0; ind < files.length; ind++) {
                const file = files[ind]
                const dbModule = new DBModule()
                dbModule.source = fs.readFileSync(file).toString()
                dbModule.dbname = path.basename(file, '.xml')
                if (options.name !== undefined) dbModule.dbname = options.name
                if (options.desc !== undefined) dbModule.description = options.desc
                if (options.access !== undefined) dbModule.access = options.access
                const moduleExist = await this.dbManager.dbModuleExist(dbModule.dbname)
                if (moduleExist !== undefined) throw 'module ' + moduleExist.dbname + ' already exists with id ' + moduleExist.id
                const id = await this.dbManager.dbModuleInsert(dbModule)
                logger.info('module ' + dbModule.dbname + ' added with id ' + id)
            }
        }
        catch (err) {
            logger.error(err)
        }
    }
}


interface Options {
    id: string | undefined
    name: string | undefined
    desc: string | undefined
    access: string | undefined
    env: string | undefined
}

class ModuleUpdateCmd extends Cmd {
    constructor() {
        super('update')
        this.description('update module')
        .option('-i --id <id>', 'module ID')
        .option('-n --name <dbname>', 'module dbname')
        .option('-d --desc <description>', 'description')
        .option('-a --access <access>', 'access control list')
        .argument('[files...]', 'local module file(s) to upload to the server')
        .action(async (files: any, options: any) => {
            await this.commandUpdate(files, options)
        })
    }

    async commandUpdate (files: string[], options: Options) {
        // logger.debug('files : ', files, ', options : ', options)
        try {
            await this.prologue(options)
            if (this.dbManager === undefined) throw 'dbManager undefined'
            if (options.id !== undefined) {
                if (files.length > 1) throw 'with --id option you can only specify 1 local file'
                const dbModule = await this.dbManager.getModule(options.id)
                if (options.name !== undefined) dbModule.dbname = options.name
                if (options.desc !== undefined) dbModule.description = options.desc
                if (options.access !== undefined) dbModule.access = options.access
                if (files.length === 1) {
                    dbModule.source = fs.readFileSync(files[0]).toString()
                }
                await this.dbManager.dbModuleUpdate(dbModule)
            }
            else {
                if (files.length === 0) throw 'without --id option you need to specify at least 1 local file'
                for (let ind = 0; ind < files.length; ind++) {
                    const file = files[ind]
                    const dbname = path.basename(file, '.xml')
                    const dbModule = await this.dbManager.dbModuleExist(dbname)
                    if (dbModule === undefined) {
                        logger.info('local file ' + file + ', module ' + dbname + ' not found')
                        continue
                    }
                    dbModule.source = fs.readFileSync(file).toString()
                    logger.debug('dbModule update from ' + file)
                    if (options.desc !== undefined) dbModule.description = options.desc
                    if (options.access !== undefined) dbModule.access = options.access
                    await this.dbManager.dbModuleUpdate(dbModule)
                }
            }
        }
        catch (err) {
            logger.error(err)
        }
    }
    
}


class ModuleRunCmd extends Cmd {
    constructor() {
        super('run')
        this.description('execute/run a local module file')
        .argument('<file>', 'local module file to run')
        .action(async (file: any, options: any) => {
            await this.commandRun(file, options)
        })
    }

    async commandRun (file: string, options: Options) {
        try {
            await this.prologue(options)
            if (this.dbManager === undefined) throw 'dbManager undefined'
            const source = fs.readFileSync(file).toString()
            const tag = parseXML(file, source)
            const moduleInstruction = new ModuleInstruction(tag, this.dbManager)
            const scopeRun = new Scope(this.dbManager.scope.structure, this.dbManager.scope, undefined)
            await moduleInstruction.parseInstructions(tag, scopeRun)
            await moduleInstruction.execute(scopeRun)
        }
        catch (err) {
            logger.error(err)
        }
    }

    
}
