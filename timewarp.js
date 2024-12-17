#!/usr/bin/env node

const { execSync, spawnSync } = require('child_process');
const readline = require('readline');

// Add function to check and request sudo access at startup
function ensureSudoAccess() {
  if (process.platform === 'win32') {
    return; // Windows handles admin privileges differently
  }

  try {
    // Try to execute a harmless sudo command to check/cache credentials
    execSync('sudo -v', { stdio: 'inherit' });
    
    // Keep sudo session alive in background
    const intervalId = setInterval(() => {
      try {
        execSync('sudo -v', { stdio: 'ignore' });
      } catch (error) {
        clearInterval(intervalId);
      }
    }, 60000); // Refresh every minute

    // Clean up interval on exit
    process.on('SIGINT', () => {
      clearInterval(intervalId);
      process.exit();
    });
    
    process.on('exit', () => {
      clearInterval(intervalId);
    });

  } catch (error) {
    console.error('This program requires sudo privileges to modify system time.');
    process.exit(1);
  }
}

// Predefined time intervals in milliseconds
const TIME_INTERVALS = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '3h': 3 * 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
};

// Function to set system time
function setSystemTime(date, useNetworkTime = false) {
  if (useNetworkTime) {
    try {
      // Get time from time server
      if (process.platform === 'darwin') {
        execSync('sudo sntp -sS time.apple.com');
      } else if (process.platform === 'win32') {
        execSync('w32tm /resync /force');
      } else {
        execSync('sudo ntpdate pool.ntp.org');
      }
      console.log('Time reset to current network time');
      return;
    } catch (error) {
      console.error('Failed to sync with time server. Falling back to system time...');
    }
  }

  const timeString = date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  try {
    if (process.platform === 'win32') {
      execSync(`date ${timeString.split(',')[0]}`);
      execSync(`time ${timeString.split(',')[1].trim()}`);
    } else if (process.platform === 'darwin') { // macOS
      // Format: MMDDHHmmYYYY.SS
      const [datePart, timePart] = timeString.split(',');
      const [month, day, year] = datePart.trim().split('/');
      const [hour, minute, second] = timePart.trim().split(':');
      
      const macTimeFormat = `${month}${day}${hour}${minute}${year}.${second}`;
      execSync(`sudo date ${macTimeFormat}`);
    } else { // Linux and other Unix-like systems
      execSync(`sudo date -s "${timeString}"`);
    }
    console.log(`Time set to: ${date.toLocaleString()}`);
  } catch (error) {
    console.error('Error setting system time. Make sure you have necessary permissions.');
    console.error('On macOS/Linux systems, run with sudo.');
    console.error('Actual error:', error.message);
    process.exit(1);
  }
}

// Function to display menu and handle user input
function showMenu() {
  console.log('\n🕒 Time Warp Menu:');
  console.log('1. Jump Forward');
  console.log('2. Jump Backward');
  console.log('3. Reset to Current Time');
  console.log('4. Exit');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('\nSelect an option (1-4): ', (answer) => {
    switch (answer) {
      case '1':
        showTimeIntervals(rl, 'forward');
        break;
      case '2':
        showTimeIntervals(rl, 'backward');
        break;
      case '3':
        setSystemTime(new Date(), true);
        rl.close();
        showMenu();
        break;
      case '4':
        console.log('Goodbye! 👋');
        process.exit(0);
      default:
        console.log('Invalid option. Please try again.');
        rl.close();
        showMenu();
    }
  });
}

// Function to display time interval options
function showTimeIntervals(rl, direction) {
  console.log('\nSelect time interval:');
  Object.keys(TIME_INTERVALS).forEach((key, index) => {
    console.log(`${index + 1}. ${key}`);
  });
  console.log(`${Object.keys(TIME_INTERVALS).length + 1}. Back to main menu`);

  rl.question('\nSelect an option: ', (answer) => {
    const intervals = Object.values(TIME_INTERVALS);
    const selection = parseInt(answer) - 1;

    if (selection >= 0 && selection < intervals.length) {
      const offset = direction === 'forward' ? intervals[selection] : -intervals[selection];
      const newTime = new Date(Date.now() + offset);
      setSystemTime(newTime);
    }

    rl.close();
    showMenu();
  });
}

// Start the program
console.log('🌟 Welcome to Time Warp CLI! 🌟');
console.log('Requesting sudo privileges to modify system time...');
ensureSudoAccess();
showMenu(); 