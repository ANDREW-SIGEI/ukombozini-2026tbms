const { exec } = require('child_process');

console.log('Searching for process on port 5000...');
exec('netstat -ano | findstr :5000', (err, stdout) => {
    if (err || !stdout) {
        console.log('No process found on port 5000.');
        return;
    }

    const lines = stdout.split('\n');
    let killed = false;

    lines.forEach(line => {
        if (line.includes('LISTENING')) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1]; // PID is last column
            if (pid && parseInt(pid) > 0) {
                console.log(`Found PID: ${pid}`);
                exec(`taskkill /PID ${pid} /F`, (kErr) => {
                    if (kErr) console.error(`Failed to kill ${pid}: ${kErr.message}`);
                    else console.log(`Successfully killed process ${pid}`);
                });
                killed = true;
            }
        }
    });

    if (!killed) console.log('No LISTENING process found.');
});
