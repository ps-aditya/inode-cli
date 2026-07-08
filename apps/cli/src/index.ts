#!/usr/bin/env node
import { Command } from 'commander';
import { parseCommand } from '@inode/parser';
import { collectRepoContext } from '@inode/context';
import { analyzeCommand } from '@inode/predictor';
import { renderAssessment } from '@inode/output';

const program = new Command();

program
  .name('inode')
  .description('inode-cli — see what a command will actually do before you run it.')
  .version('0.1.0');

program
  .command('parse <command...>')
  .description('Parse a raw command into its structured form (debug utility for Sprint 1)')
  .allowUnknownOption()
  .action((commandParts: string[]) => {
    const raw = commandParts.join(' ');
    const parsed = parseCommand(raw);
    console.log(JSON.stringify(parsed, null, 2));
  });

program
  .command('check <command...>')
  .description('Assess the risk of a command before you run it')
  .allowUnknownOption()
  .action((commandParts: string[]) => {
    const raw = commandParts.join(' ');
    const assessment = analyzeCommand(raw, process.cwd());
    console.log(renderAssessment(raw, assessment));
  });

program
  .command('context')
  .description('Show what we can detect about the current repo (debug utility for Sprint 3)')
  .action(() => {
    const context = collectRepoContext(process.cwd());
    console.log(JSON.stringify(context, null, 2));
  });

program.parse(process.argv);
