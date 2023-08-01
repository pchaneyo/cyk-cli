import { Structure, Script, XmlError, DBRemote, DBManager, ModuleInstruction, parseXML, MapData } from "@cyklang/core"
import * as fs from "fs"
import { errorconsole, PrintInstructionType } from "./console"
import loglevel from 'loglevel'
import { NodeCrypto } from "./NodeCrypto"
import { Cmd } from "./Cmd"
loglevel.setLevel('debug')
const logger = loglevel.getLogger('RunCommand.ts');

export class RunCommand extends Cmd {
    constructor() {
        super('run')
        this.description('run module').version('0.2')
            .argument('<files...>', 'local module file(s) to run')
            .action(async (files: any, options: any) => {
                await this.runFiles(files, options)
            })
    }
    async runFiles(files: string[], options: any) {
        try {
            await this.prologue(options)
            for (let ind = 0; ind < files.length; ind++) {
                const result = await runFile(files[ind])
                // if (result === false) {
                //     logger.debug('*********** FAILURE ' + process.argv[ind] + ' ***************')
                // }
            }
        }
        catch (err) {
            logger.error(err)
        }
    }
}


async function runFile(filename: string): Promise<void> {
    let result: boolean

    if (filename.indexOf(".") !== -1) {
        filename = filename.substring(0, filename.indexOf("."))
    }

    // skip filename with double underscore
    if (filename.indexOf("__") !== -1) return

    let xmlfilename = filename + ".xml"
    // let logfilename = filename + ".log"
    // let outfilename = filename + ".output"

    let xml = fs.readFileSync(xmlfilename)

    // fs.writeFileSync(logfilename, "")

    try {
        if (process.env.DBREMOTE_URL === undefined) throw 'DBREMOTE_URL undefined'
        logger.trace('DBREMOTE_URL ' + process.env.DBREMOTE_URL)
        const structure = new Structure()
        const nodeCrypto = new NodeCrypto()
        const dbRemote = new DBRemote(structure.scope, process.env.DBREMOTE_URL, nodeCrypto)
        const login = await dbRemote.signin(process.env.USER_NAME, undefined, process.env.USER_PASSWORD)
        const dbManager = new DBManager(structure.scope, dbRemote)
        await dbManager.initialize()
        // const tag = parseXML(xmlfilename, xml.toString())
        // const moduleInstruction = new ModuleInstruction(tag, dbManager)
        // await moduleInstruction.parse(structure.scope)
        // await moduleInstruction.execute(structure.scope)

        // structure.scope.addInstructionType(new PrintInstructionType(logfilename))

        const user_lang = login.content.user_lang
        if (user_lang && user_lang.trim() !== '') {

            const langfilename = filename + "__" + user_lang + ".xml"

            if (fs.existsSync(langfilename)) {
                const langXml = fs.readFileSync(langfilename)
                const tag = parseXML(xmlfilename, langXml.toString())
                const modLang = new ModuleInstruction(tag, dbManager)
                await modLang.parse(structure.scope)
                await modLang.execute(structure.scope)

                const langMap = modLang.objectData?.variables.getData(user_lang)

                if (langMap !== null && langMap !== undefined) {
                    structure.mapLang = langMap as MapData
                }
            }
        }

        let script = new Script(structure.scope, xmlfilename, xml.toString())
        await script.parseInstructions()
        await script.execute()
    }
    catch (err) {

        if (err instanceof XmlError) {
            let xmlError = <XmlError>err
            errorconsole(xmlError)
        }
        console.log(err)
    }

    // let log = fs.readFileSync(logfilename)
    // if (fs.existsSync(outfilename) === true ) {
    //     let out = fs.readFileSync(outfilename)

    //     if (log.toString() === out.toString()) {
    //         console.log("test " + xmlfilename + " SUCCESS")
    //         result = true
    //     }
    //     else {
    //         console.log("test " + xmlfilename + " FAILURE")
    //         result = false
    //     }
    // }
    // else {
    //     console.log("test " + xmlfilename + " output file not found ")
    //     result = false
    // }

    // return result
}
