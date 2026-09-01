$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
node "$scriptDir\cogito.js" @args
