import { DBManager, DBRemote, SigninResponse, Structure } from "@cyklang/core";
import { Command } from "commander";
import dotenv from 'dotenv'
import loglevel from 'loglevel'
import { NodeCrypto } from "./NodeCrypto";
import { DBClient } from "./DBClient";
const logger = loglevel.getLogger('Cmd.ts')
logger.setLevel('debug')

export class Cmd extends Command {
    dbManager: DBManager | undefined
    dbRemote: DBRemote | undefined

    constructor(name: string) {
        super(name);
        this.option('--env <env>', 'path to the environment variables file')
    }

    async prologue(options: any): Promise<SigninResponse> {

        const dotenvOutput = dotenv.config({ path: options.env })
        if (dotenvOutput.error !== undefined) throw dotenvOutput.error

        const structure = new Structure()
        if (process.env.DBREMOTE_URL === undefined) throw 'DBREMOTE_URL undefined'
        logger.debug('Cmd.DBREMOTE_URL ' + process.env.DBREMOTE_URL)
        const nodeCrypto = new NodeCrypto()
        this.dbRemote = new DBRemote(structure.scope, process.env.DBREMOTE_URL, nodeCrypto)
        const login = await this.dbRemote.signin(process.env.USER_NAME, undefined, process.env.USER_PASSWORD)
        // logger.debug(login)

        this.dbManager = new DBManager(structure.scope, this.dbRemote)
        await this.dbManager.initialize()

        return login


    }

    /**
     * method updateAuthAccess
     * @param tableName 
     * @param prefix 
     * @param id 
     * @param options 
     */
    async updateAuthAccess(tableName: string, prefix: string, id: string, options: any) {

        try {

            let dclAuth: string | undefined

            if (options.auth) {
                if (' basic | token | cookie | any | none | null '.indexOf(' ' + options.auth + ' ') === -1) {
                    throw 'valid authentication schemas are : basic | token | cookie | any | null'
                }
                dclAuth = `<string name='${prefix}_auth'>`
                if (' none | null '.indexOf(' ' + options.auth + ' ') === -1)
                    dclAuth += ` "${options.auth}" `
                else
                    dclAuth += ' null '
                dclAuth += "</string>"
            }

            let dclAccess: string | undefined

            if (options.access) {

                dclAccess = `<string name='${prefix}_access'> `
                if (' null | none '.indexOf(' ' + options.access + ' ') === -1)
                    dclAccess += `"${options.access}"`
                else
                    dclAccess += ' null '
                dclAccess += "</string>"
            }

            const inst = `
            <db.update table='${tableName}'>
                <object>
                    <number name='${prefix}_id'>${id}</number>
                    ${dclAuth}
                    ${dclAccess ? dclAccess : ''}
                </object>
            </db.update>
            `

            if (! this.dbManager) throw 'prologue() has not been called before'

            const dbClient = new DBClient(this.dbManager)
            dbClient.execInstructions(inst)
        }
        catch (err) {
            logger.error(err)
            throw err
        }
    }
}