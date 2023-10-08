#!/usr/bin/env node
import { Command } from 'commander'
import * as fs from 'fs'
import loglevel from 'loglevel'
import path from 'path'
import { AssetCommand } from './AssetCommand'
import { Cmd, spawnCommand } from './Cmd'
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
            const portForwardPath = path.join(process.cwd(), 'k8s', 'port-forward')
            if (!fs.existsSync(portForwardPath) || !fs.statSync(portForwardPath).isFile())
                throw portForwardPath + ' file not found'
            const config = JSON.parse(fs.readFileSync(portForwardPath).toString())
            if (! config.postgres || ! config.nodejs) 
                throw portForwardPath + ' : file format incorrect'
            spawnCommand('kubectl', ['port-forward', 'svc/postgres', config.postgres + ':5432'])
            logger.info('Postgresql proxy at localhost:' + config.postgres)
            spawnCommand('kubectl', ['port-forward', 'svc/nodejs', config.nodejs + ':3000'])
            logger.info('Nodejs proxy at localhost:' + config.nodejs)
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
    .version('0.7.1')
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
