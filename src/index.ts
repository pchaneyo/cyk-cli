#!/usr/bin/env ts-node
import loglevel from 'loglevel'
import { Command } from 'commander'
import { ModuleCommand } from "./ModuleCommand"
import { UserCommand } from './UserCommand'
import { QueryCommand } from './QueryCommand'
import { TableCommand } from './TableCommand'
const logger = loglevel.getLogger("index.ts")
logger.setLevel("debug")

const program = new Command()
program.name('cyk').description('cyklang CLI')
    .version('0.1')

program.addCommand(new ModuleCommand())
program.addCommand(new UserCommand())
program.addCommand(new QueryCommand())
program.addCommand(new TableCommand())

program.parse()
