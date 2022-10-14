#!/usr/bin/env ts-node
import { Structure, XmlError, DBRemote, DBManager, DBTableInstruction } from "@cyklang/core"
import * as fs from "fs"
import loglevel from 'loglevel'
import path from "path"
import dotenv from 'dotenv'
import { Command } from "commander"
import { exec, spawn } from "child_process"
import { Cmd } from "./Cmd"
const logger = loglevel.getLogger("TableCommand.ts")
logger.setLevel("debug")

export class TableCommand extends Command {
    constructor(name: string) {
        super(name)
        this.description('import/export table rows').version('0.1')
        this.addCommand(new TableExportCmd())
    }
}

class TableExportCmd extends Cmd {
    constructor() {
        super('export')
        this.description('export to CSV file(s)')
        .argument('<tables...>', 'table(s) to export')
        .option('-f --file <file>', 'name of the file to create, defaults to <table_name>.csv')
        .option('-d --dir <directory>', 'name of the directory where to create exported files')
        .action(async (tables, options) => this.commandExport( tables, options))
    }
    async commandExport(tables: string[], options: Options) {
        await this.prologue(options)
        if (this.dbManager === undefined) throw 'dbManager undefined'
        await commandImportExport(this.dbManager, 'to', tables, options)
    }
}

class TableImportCmd extends Cmd {
    constructor() {
        super('import')
        this.description('import from CSV file(s)')
        .option('-f --file <file>', 'name of the file to import, defaults to <table_name>.csv')
        .option('-d --dir <directory>', 'name of the directory where to find files to import')
        .action(async (tables, options) => this.commandImport(tables, options))
    }
    async commandImport(tables: string[], options: Options) {
        await this.prologue(options)
        if (this.dbManager === undefined) throw 'dbManager undefined'
        await commandImportExport(this.dbManager, 'from', tables, options)
    }
}

interface Options {
    env: string | undefined
    file: string | undefined
    dir: string | undefined
}

const commandImportExport = async (dbManager: DBManager, direction: 'from' | 'to', tables: string[], options: Options) => {
    logger.debug('tables : ', tables, 'options : ', options)
    try {

        if (options.file === undefined && options.dir === undefined) throw '--file or --dir mandatory'
        if (options.file !== undefined && options.dir !== undefined) throw '--file and --dir are mutually exclusive'
        if (tables.length === 0) throw 'at least one table name is mandatory'
        if (tables.length > 1 && options.dir === undefined) throw 'for multiple tables, --dir is mandatory'

        for (let indi = 0; indi < tables.length; indi++) {
            const tableName = tables[indi]
            const dbTable = await dbManager.dbTableExist(tableName)
            if (dbTable === undefined) {
                logger.info('table ' + tableName + ' not found')
                continue
            }
            let lcols: string | undefined
            for (let indj = 0; indj < dbTable.columns.length; indj++) {
                const dbColumn = dbTable.columns[indj]
                if (lcols === undefined) {
                    lcols = "("
                }
                else {
                    lcols += ","
                }
                lcols += dbColumn.name
            }
            lcols += ")"

            let psql_cmd = "psql -c"
            if (process.env.HEROKU_CLI !== undefined) {
                psql_cmd = process.env.HEROKU_CLI + ' -c '
            }

            let filename
            if (options.file !== undefined) {
                if (fs.existsSync(options.file) && fs.lstatSync(options.file).isDirectory())
                    throw '--file ' + options.file + ' is a directory'
                filename = options.file
            }
            else if (options.dir === undefined)
                throw '--file and --dir unspecified'
            else if (fs.existsSync(options.dir) === false)
                throw 'directory ' + options.dir + ' does not exist'
            else if (fs.lstatSync(options.dir).isFile()) {
                logger.debug("--dir " + options.dir + " is a file ")
            }
            else {
                let directory = options.dir.trim()
                if (directory[directory.length - 1] !== '/') {
                    directory += '/'
                }
                filename = directory + tableName + '.csv'
            }

            let copy_cmd = "\\copy " + tableName + lcols + direction + " '" + filename + "' csv header"
            const shell_cmd = psql_cmd + '"' + copy_cmd + '"'
            logger.debug(shell_cmd)
            const child = spawn(shell_cmd.trim(), { stdio: 'inherit', shell: true })
            // exec(shell_cmd.trim(), (error, stdout, stderr) => {
            //     if (error) throw error
            //     logger.debug(stdout, stderr)
            // })
        }
    }
    catch (err) {
        logger.error(err)
    }


}

