#!/usr/bin/env ts-node
import { Script, Structure, DBRemote, DBManager, DBQueryInstruction, parseXML, Tag, Scope } from "@cyklang/core"
import * as fs from "fs"
import loglevel from 'loglevel'
import { Cmd } from './Cmd'
import { Command } from 'commander'
import { DBClient } from "./DBClient"
const logger = loglevel.getLogger("QueryCommand.ts")
logger.setLevel("debug")

export class QueryCommand extends Command {
    constructor(name: string) {
        super(name)
        this.description('query management')
        this.addCommand(new QueryList('list', 'list queries'))
        this.addCommand(new QueryList('l', 'list queries'))
    }
}

//--------------------------------------------------------------------------------------------------------------------
// class TableList
//--------------------------------------------------------------------------------------------------------------------

class QueryList extends Cmd {
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
        dbClient.selectFromTable('List of Queries', 'cyk_query',
            { fields: 'query_id,query_name,query_auth,query_access,query_description', sort: options.sort || '1' }
        )
    }
}



//--------------------------------------------------------------------------------------------------------------------
// class queryData
//--------------------------------------------------------------------------------------------------------------------

class queryData extends Cmd {

    constructor(name: string, description: string) {
        super(name)
        this.description(description)
            .argument('<query>', 'query name')
            .option('--where <clause_where_sql>', 'criteria in SQL syntax')
            .option('-s --sort <columns>', 'sort by columns positions (begins by 0) separated by comma')
            .option('-w --width <colwidth>', 'columns widths separated by comma')
            .action(async (query, options) => {
                this.commandData(query, options)
            })
    }

    async commandData(query: string, options: any) {
        try {
            await this.prologue(options)
            if (this.dbManager === undefined) throw 'dbManager undefined'

            const dbQuery = await this.dbManager.dbQueryExist(query)
            if (dbQuery === undefined) throw 'query ' + query + ' not found'

            //DBClient
        }
        catch (err) {
            logger.error(err)
        }
    }
}
