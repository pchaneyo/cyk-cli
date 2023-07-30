import { Structure, Script, XmlError, DBRemote, DBManager, MapData, ModuleInstruction, parseXML } from "@cyklang/core"
import * as fs from "fs"
import { errorconsole, PrintInstructionType } from "./console"
import loglevel from 'loglevel'
import { NodeCrypto } from "./NodeCrypto"
import { Cmd } from "./Cmd"
loglevel.setLevel('debug')
const logger = loglevel.getLogger('TestCommand.ts');

export class TestCommand extends Cmd {
    constructor() {
        super('test')
        this.description('test script').version('0.1')
        .argument('<files...>', 'local module file(s) to test run')
        .action(async(files: any, options: any) => {
            await this.testRun(files, options)
        })
    }
    async testRun(files: string[], options: any) {
        try {
            const signinResponse = await this.prologue(options)
            for (let ind=0; ind < files.length; ind++) {
                const result = await testfile(files[ind])
                if (result === false) {
                    logger.debug('*********** FAILURE ' + files[ind] + ' ***************')
                }
            }
        }
        catch (err) {
            logger.error(err)
        }

    }
}


async function testfile(filename: string): Promise<boolean> {
    let result: boolean

    if (filename.indexOf(".") !== -1) {
        filename = filename.substring(0, filename.indexOf("."))
    }

    let xmlfilename = filename + ".xml"
    let logfilename = filename + ".log"
    let outfilename = filename + ".output"

    let xml = fs.readFileSync(xmlfilename)

    
    fs.writeFileSync(logfilename, "")
    //console.log(xml.toString())
    try {
        if (process.env.DBREMOTE_URL === undefined) throw 'DBREMOTE_URL undefined'
        logger.trace('DBREMOTE_URL '+process.env.DBREMOTE_URL)
        const structure = new Structure()
        const nodeCrypto = new NodeCrypto()
        const dbRemote = new DBRemote(structure.scope, process.env.DBREMOTE_URL, nodeCrypto)
        const login = await dbRemote.signin(process.env.USER_NAME, undefined, process.env.USER_PASSWORD)
        //const dbRemote = new DBRemote(structure, 'https://cyk-postgres.herokuapp.com')
        const dbManager = new DBManager(structure.scope, dbRemote)
        await dbManager.initialize()
        structure.scope.addInstructionType(new PrintInstructionType(logfilename))
        let script = new Script(structure.scope, xmlfilename, xml.toString())
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

                    outfilename = filename + "__" + user_lang + ".output"
                }
            }
        }

        await script.parseInstructions()
        await script.execute()
        // console.log(JSON.stringify(script.block.toString()))
    }
    catch (err) {

        if (err instanceof XmlError) {
            let xmlError = <XmlError>err
            errorconsole(xmlError)
        }
        console.log(err)
    }

    let log = fs.readFileSync(logfilename)
    if (fs.existsSync(outfilename) === true ) {
        let out = fs.readFileSync(outfilename)

        if (log.toString() === out.toString()) {
            console.log("test " + xmlfilename + " SUCCESS")
            result = true
        }
        else {
            console.log("test " + xmlfilename + " FAILURE")
            result = false
        }
    }
    else {
        console.log("test " + xmlfilename + " output file not found ")
        result = false
    }


    return result
}
