import { DBManager, DBRemote, SigninResponse, Structure } from "@cyklang/core";
import { Command } from "commander";
import dotenv from 'dotenv'
import loglevel from 'loglevel'
import { NodeCrypto } from "./NodeCrypto";
import { DBClient } from "./DBClient";
import { exec, spawn } from 'child_process';
import { red, green, bold } from 'kolorist'
import * as fs from 'fs'

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
        logger.info('Cyk server: ' + process.env.DBREMOTE_URL)
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

            if (!this.dbManager) throw 'prologue() has not been called before'

            const dbClient = new DBClient(this.dbManager)
            dbClient.execInstructions(inst)
        }
        catch (err) {
            logger.error(err)
            throw err
        }
    }

    /**
     * method executeCommand
     * @param command 
     * @returns 
     */
    executeCommand(command: string): Promise<{ stdout: string, stderr: string }> {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve({ stdout, stderr });
            });
        });
    }



}


/**
 * method runShellCommand
 * @param command 
 */
export async function runShellCommand(command: string, args: string[]) {
    try {
        await spawnCommand(command, args)
        // console.log(command)
        // const result = await this.executeCommand(command);
        // console.log(result.stdout);
        // if (result.stderr && result.stderr.trim() !== '')
        //     console.error(result.stderr);
    } catch (error) {
        console.error('Error running "' + command + '":', error);
        throw error
    }
}

/**
 * function spawnCommand
 * @param command 
 * @param args 
 * @returns 
 */
export function spawnCommand(command: string, args: string[]): Promise<void> {
    console.log()
    console.log([command, ...args, '...'].join(' '))
    const child_process = spawn(command, args, { stdio: 'inherit' })
    return new Promise((resolve, reject) => {
        child_process.on('close', (code) => {
            if (code === 0) {
                console.log(green('*') + ' ' + [command, ...args].join(' '))
                resolve()
            }
            else {
                reject(new Error([command, ...args].join(' ') + ' --> Error ' + code))
            }
        })
    })
}

/**
 * function readPackageJson
 * @returns 
 */
export async function readPackageJson(): Promise<any> {
    try {
        if (!fs.existsSync("package.json")) throw 'package.json not found'
        const fileContent = fs.readFileSync("package.json")
        return JSON.parse(fileContent.toString())
    }
    catch (err) {
        console.error(err)
        throw err
    }
}