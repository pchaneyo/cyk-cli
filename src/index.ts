#!/usr/bin/env node
import { Command } from 'commander'
import * as fs from 'fs'
import loglevel from 'loglevel'
import path from 'path'
import { AssetCommand } from './AssetCommand'
import { Cmd, spawnCommand, spawnCommandData } from './Cmd'
import { InstallCommand } from './InstallCommand'
import { ModuleCommand } from "./ModuleCommand"
import { OpenCommand } from './OpenCommand'
import { QueryCommand } from './QueryCommand'
import { RunCommand } from './RunCommand'
import { TableCommand } from './TableCommand'
import { TableDataCommand } from './TableDataCommand'
import { TestCommand } from './TestCommand'
import { UninstallCommand } from './UninstallCommand'
import { UserCommand } from './UserCommand'

const logger = loglevel.getLogger("index.ts")
logger.setLevel("debug")

type Orchestrator = 'kubernetes' | 'docker' | undefined

/**
 * function getOrchestrator
 */
function getOrchestrator(): Orchestrator {
    let result: Orchestrator
    const cwd = process.cwd()
    const dockerComposePath = path.join(cwd, 'docker-compose.yml')
    const k8sPath = path.join(cwd, 'k8s')
    if (fs.existsSync(dockerComposePath) && fs.statSync(dockerComposePath).isFile()) {
        result = 'docker'
    }
    else if (fs.existsSync(k8sPath) && fs.statSync(k8sPath).isDirectory()) {
        result = 'kubernetes'
    }
    return result
}

/**
 * function startServer
 */
async function startServer() {
    try {
        const orchestrator = getOrchestrator()
        if (orchestrator === 'docker') {
            await spawnCommand('docker', ['compose', 'up', '-d'])
        }
        if (orchestrator === 'kubernetes') {

            // apply resource files
            await spawnCommand('kubectl', ['apply', '-f', path.join(process.cwd(), 'k8s')])

            // port-forward
            const portForwardPath = path.join(process.cwd(), 'k8s', 'port-forward')
            if (!fs.existsSync(portForwardPath) || !fs.statSync(portForwardPath).isFile())
                throw portForwardPath + ' file not found'
            const portForwardContent = JSON.parse(fs.readFileSync(portForwardPath).toString())

            // wait for the services to be available

            while (true) {

                const declared_services = await spawnCommandData('kubectl', ['get', 'svc', '-o', 'name'])

                let ok = true

                for(const service in portForwardContent) {
                    if (! Object.prototype.hasOwnProperty.call(portForwardContent, service)) continue
                    if (! declared_services.includes(`service/${service}`)) {
                        ok = false
                        break
                    }
                    const avail = await serviceAvailable(service)
                    if (! avail) {
                        ok = false
                        break
                    }
                }

                if (ok) break

                // wait for 1 second
                logger.info('Wait for nodejs and postgres services...')
                await new Promise<void>((resolve) =>
                    setTimeout(() => {
                        resolve();
                    }, 1000)
                );
            }

            for(const service in portForwardContent) {
                spawnCommand('kubectl', ['port-forward', `svc/${service}`, portForwardContent[service]])
                logger.info(`${service} proxy via localhost ${portForwardContent[service].split(':')[0]}`)
            }

        }
        if (!orchestrator) {
            logger.error('No cyk server is defined in current folder ' + process.cwd())
        }
    }
    catch (err) {
        console.error(err)
    }
}

/**
 * function serviceAvailable
 * @param service 
 * @returns 
 */
async function serviceAvailable(service: string): Promise<boolean> {

    const descNodejs = await spawnCommandData('kubectl', ['describe', 'service', service])
    const lines = descNodejs.split('\n')
    for (const line of lines) {
        if (line.includes('Endpoints')) {
            return !line.includes('<none>')
        }
    }
    return false
}

/**
 * function stopServer
 */
async function stopServer() {
    try {
        const orchestrator = getOrchestrator()
        if (orchestrator === 'docker') {
            await spawnCommand('docker', ['compose', 'down'])
        }
        if (orchestrator === 'kubernetes') {
            await spawnCommand('kubectl', ['delete', '-f', path.join(process.cwd(), 'k8s')])
            logger.info('Kubernetes deployments and services deleted')
        }
        if (!orchestrator) {
            logger.error('No cyk server is defined in current folder ' + process.cwd())
        }
    }
    catch (err) {
        console.error(err)
    }
}

/**
 * class StartCommand
 */
class StartCommand extends Command {
    constructor(name: string) {
        super(name)
        this.description('start cyk server defined in current project folder')
            .action(async (options: any) => {
                await startServer()
            })
    }
}

/**
 * class StopCommand
 */
class StopCommand extends Command {
    constructor(name: string) {
        super(name)
        this.description('stop cyk server defined in current project folder')
            .action(async (options: any) => {
                await stopServer()
            })
    }
}

/**
 * Main program
 */
const program = new Command()
program.name('cyk').description('cyklang CLI')
    .version('0.8.2')
program.addCommand(new StartCommand('start'))
program.addCommand(new StopCommand('stop'))
program.addCommand(new InstallCommand('install'))
program.addCommand(new InstallCommand('i'))
program.addCommand(new UninstallCommand('uninstall'))
program.addCommand(new AssetCommand('asset', 'manage assets'))
program.addCommand(new AssetCommand('a', 'manage assets'))
program.addCommand(new ModuleCommand('module'))
program.addCommand(new ModuleCommand('m'))
program.addCommand(new UserCommand('user'))
program.addCommand(new UserCommand('u'))
program.addCommand(new QueryCommand('query'))
program.addCommand(new QueryCommand('q'))
program.addCommand(new TableCommand('table'))
program.addCommand(new TableCommand('t'))
program.addCommand(new TableDataCommand('data', 'show table data'))
program.addCommand(new TableDataCommand('d', 'show table data'))
program.addCommand(new TestCommand())
program.addCommand(new RunCommand('run'))
program.addCommand(new RunCommand('r'))
program.addCommand(new OpenCommand('open'))
program.addCommand(new OpenCommand('o'))

program.parse()
