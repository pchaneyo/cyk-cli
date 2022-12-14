#!/usr/bin/env ts-node
import { DBManager, DBTable } from "@cyklang/core"
import * as fs from "fs"
import loglevel from 'loglevel'
import { Command } from "commander"
import { spawn } from "child_process"
import { Cmd } from "./Cmd"
import { DBClient } from "./DBClient"
import { Stream } from "form-data"
import FormData from 'form-data'

const logger = loglevel.getLogger("TableCommand.ts")
logger.setLevel("debug")

export class TableCommand extends Command {
    constructor(name: string) {
        super(name)
        this.description('import/export table rows').version('0.1')
        this.addCommand(new TableExportCmd())
        this.addCommand(new TableImportCmd())
        this.addCommand(new TableList('list', 'list database tables'))
        this.addCommand(new TableList('l', '(l)ist database tables'))
        this.addCommand(new TableQuery('query', 'query select table content'))
        this.addCommand(new TableQuery('q', 'query select table content'))
    }
}

class TableExportCmd extends Cmd {

    constructor() {
        super('export')
        this.description('export to CSV file(s)')
            .argument('<tables...>', 'table(s) to export')
            .option('-f --file <file>', 'name of the file to create, defaults to <table_name>.csv')
            .option('-d --dir <directory>', 'name of the directory where to create exported files')
            .action(async (tables, options) => this.commandExport(tables, options))
    }

    async commandExport(tables: string[], options: Options) {
        await this.prologue(options)
        if (this.dbManager === undefined) throw 'dbManager undefined'
        // await commandImportExport(this.dbManager, 'to', tables, options)

        try {
            if (options.file === undefined && options.dir === undefined) throw '--file or --dir mandatory'
            if (options.file !== undefined && options.dir !== undefined) throw '--file and --dir are mutually exclusive'
            if (tables.length === 0) throw 'at least one table name is mandatory'
            if (tables.length > 1 && options.dir === undefined) throw 'for multiple tables, --dir is mandatory'

            for (let indi = 0; indi < tables.length; indi++) {
                const tableName = tables[indi]
                const dbTable = await this.dbManager.dbTableExist(tableName)
                if (dbTable === undefined) {
                    logger.info('table ' + tableName + ' not found')
                    continue
                }
                const filename = buildFilename(dbTable.name, options)
                await this.copyTo(dbTable, filename)
            }
        }
        catch (err) {
            logger.error(err)
        }
    }

    async copyTo(dbTable: DBTable, filename: string) {
        if (this.dbRemote === undefined) throw 'dbRemote undefined'

        try {
            const writeStream = fs.createWriteStream(filename)

            const response = await this.dbRemote.apiServer.get('/admin/export/' + dbTable.name, { responseType: 'stream' })
            const stream = response as Stream
            stream.on('data', (data: Uint8Array) => {
                logger.debug('**** DATA ****', data.length)
                const textDecoder = new TextDecoder()
                const chunk = (textDecoder.decode(data))
                writeStream.write(chunk)
            })
            stream.on('end', () => logger.debug('**** DONE ****'))
        }
        catch (err) {
            logger.error(err)
        }
    }

}

class TableImportCmd extends Cmd {

    constructor() {
        super('import')
        this.description('import from CSV file(s)')
            .argument('<tables...>', 'table(s) to import')
            .option('-f --file <file>', 'name of the file to import, defaults to <table_name>.csv')
            .option('-d --dir <directory>', 'name of the directory where to find files to import')
            .action(async (tables, options) => this.commandImport(tables, options))
    }

    async commandImport(tables: string[], options: Options) {
        await this.prologue(options)
        if (this.dbManager === undefined) throw 'dbManager undefined'
        // await commandImportExport(this.dbManager, 'to', tables, options)

        try {
            if (options.file === undefined && options.dir === undefined) throw '--file or --dir mandatory'
            if (options.file !== undefined && options.dir !== undefined) throw '--file and --dir are mutually exclusive'
            if (tables.length === 0) throw 'at least one table name is mandatory'
            if (tables.length > 1 && options.dir === undefined) throw 'for multiple tables, --dir is mandatory'

            for (let indi = 0; indi < tables.length; indi++) {
                const tableName = tables[indi]
                const dbTable = await this.dbManager.dbTableExist(tableName)
                if (dbTable === undefined) {
                    logger.info('table ' + tableName + ' not found')
                    continue
                }
                const filename = buildFilename(dbTable.name, options)
                this.copyFrom(dbTable, filename)
            }
        }
        catch (err) {
            logger.error(err)
        }
    }

    async copyFrom(dbTable: DBTable, filename: string) {
        if (this.dbRemote === undefined) throw 'dbRemote undefined'

        try {
            const file = fs.createReadStream(filename)
            const form = new FormData()
            form.append('uploadFile', file)

            const route = '/admin/import/' + dbTable.name
            const resp = await this.dbRemote.apiServer.post(route, form)
            if (resp.status === 200) {
                logger.debug(filename + ' uploaded')
            }
        }
        catch (err) {
            logger.error(err)
        }
    }
}


function buildFilename(tableName: string, options: Options): string {
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
        throw ("--dir " + options.dir + " is a file ")
    }
    else {
        let directory = options.dir.trim()
        if (directory[directory.length - 1] !== '/') {
            directory += '/'
        }
        filename = directory + tableName + '.csv'
    }
    return filename
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
            psqlCmd(dbTable, direction, options)
        }
    }
    catch (err) {
        logger.error(err)
    }
}


//--------------------------------------------------------------------------------------------------------------------
// function psqlCmd
// invoke local install of psql CLI
//--------------------------------------------------------------------------------------------------------------------

function psqlCmd(dbTable: DBTable, direction: 'from' | 'to', options: Options,) {

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
        filename = directory + dbTable.name + '.csv'
    }

    let copy_cmd = "\\copy " + dbTable.name + lcols + direction + " '" + filename + "' csv header"
    const shell_cmd = psql_cmd + '"' + copy_cmd + '"'
    logger.debug(shell_cmd)
    const child = spawn(shell_cmd.trim(), { stdio: 'inherit', shell: true })

}

//--------------------------------------------------------------------------------------------------------------------
// class TableList
//--------------------------------------------------------------------------------------------------------------------

class TableList extends Cmd {
    constructor(name: string, description: string) {
        super(name)
        this.description(description)
            .option('-s --sort <columns>', 'sort list by column numbers (begins with 0) separated by comma')
            .action(async (options: any) => {
                await this.commandList(options)
            })
    }

    async commandList(options: any) {
        await this.prologue(options)
        if (this.dbManager === undefined) throw 'dbManager undefined'

        const dbClient = new DBClient(this.dbManager)
        dbClient.selectFromTable('List of Tables', 'cyk_table',
            { fields: 'table_id,table_name,table_description,table_access', sort: options.sort || '1' }
        )
    }
}

//--------------------------------------------------------------------------------------------------------------------
// class TableQuery
//--------------------------------------------------------------------------------------------------------------------

class TableQuery extends Cmd {

    constructor(name: string, description: string) {
        super(name)
        this.description(description)
            .argument('<table>', 'table to query')
            .option('--where <clause_where_sql>', 'criteria in SQL syntax')
            .option('-s --sort <columns>', 'sort by columns positions (begins by 0) separated by comma')
            .option('-w --width <colwidth>', 'columns widths separated by comma')
            .action(async (table, options) => {
                this.commandQuery(table, options)
            })
    }

    async commandQuery(table: string, options: any) {
        try {
            await this.prologue(options)
            if (this.dbManager === undefined) throw 'dbManager undefined'

            const dbTable = await this.dbManager.dbTableExist(table)
            if (dbTable === undefined) throw 'table ' + table + ' not found'

            let fields = ''

            for (let ind = 0; ind < dbTable.columns.length; ind++) {
                const dbColumn = dbTable.columns[ind]
                let ok = false
                let fieldName = dbColumn.name
                if (dbColumn.dbType === 'text' || dbColumn.dbType === 'bytea') {
                    ok = false
                    fieldName = 'length(' + dbColumn.name + ')'
                }
                else {
                    ok = true
                }
                if (ok === true) {
                    if (fields !== '') fields += ','
                    fields += fieldName
                }
            }

            logger.debug('commandQuery', table)
            const dbClient = new DBClient(this.dbManager)
            let title = 'Table ' + table
            if (options.where !== undefined) {
                title += ' where ' + options.where
            }
            dbClient.selectFromTable(title, table,
                { fields: fields, width: options.width, sort: options.sort || '1', where: options.where })
        }
        catch (err) {
            logger.error(err)
        }
    }
}

