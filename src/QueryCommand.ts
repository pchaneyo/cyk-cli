#!/usr/bin/env ts-node
import { Script, Structure, DBRemote, DBManager, DBQueryInstruction,  parseXML, Tag, Scope  } from "@cyklang/core"
import * as fs from "fs"
import loglevel from 'loglevel'
import {Cmd} from './Cmd'
import {Command} from 'commander'
const logger = loglevel.getLogger("QueryCommand.ts")
logger.setLevel("debug")

export class QueryCommand extends Command {
    constructor() {
        super('query')
    }
}

function parseXmlFile(filepath: string, basename: string, xmlSource: string): Tag {
    const tag = parseXML(filepath, xmlSource)
    if (tag.name !== 'DB.QUERY') {
        throw Error('tag ' + tag.name + ', should be <db.query>')
    }
    const name = tag.attributes.NAME
    if (name === undefined) {
        throw Error('name attribute is missing')
    }
    if (basename !== name + '.xml') {
        throw Error('filename ' + filepath + ' and name ' + name + ' do not correspond')
    }
    return tag
}

async function executeXml(structure: Structure, tag: Tag, xmlSource: string) {
    try {
        logger.debug('executeXml '+tag.attributes.NAME)
        // structure.setInstructionType("print", new PrintInstructionType(logfilename))
        const dbQueryInstructionType = structure.scope.getInstructionType('db.query')
        if (dbQueryInstructionType === undefined) {
            throw Error('dbQueryInstructionType not found')
        }

        const scopeParse = new Scope(structure, structure.scope, undefined)
        const dbQueryInst = <DBQueryInstruction>await dbQueryInstructionType.parseInstruction(tag, scopeParse)
        dbQueryInst.source = xmlSource
        const scopeExecute = new Scope(structure, structure.scope, undefined)
        await dbQueryInst.execute(scopeExecute)
    }
    catch (err) {
        logger.error(err)
    }
}

async function testQuery(structure: Structure, queryName: string) {
    const xmlScript = `
    <block>
    <object name='result'/>
    <db.execute query='${queryName}' result='result' />
    <print>string(result)</print>
    </block>
    `
    const script = new Script(structure.scope, 'test', xmlScript)
    await script.parseInstructions()
    await script.execute()
}
