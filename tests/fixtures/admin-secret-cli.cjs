// Offline CLI fixture. Deliberately echoes secret input to both pipes so the
// provisioning script must suppress external output. Never contacts a service.
let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',value=>input+=value);
process.stdin.on('end',()=>{
  const token=input.trim(),args=process.argv.slice(2);
  if(!/^[A-Za-z0-9_-]{43}$/.test(token)||args[0]!=='secret'||args[1]!=='put'||args[2]!=='DONGJIEXI_ADMIN_TOKEN'||args[3]!=='--config'||args.some(value=>value.includes(token))){process.exitCode=7;return;}
  process.stdout.write(token);process.stderr.write(token);
});
