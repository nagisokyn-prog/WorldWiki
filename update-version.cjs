const fs = require('fs');
const version = '0.25.0';

const tauriConfPath = 'src-tauri/tauri.conf.json';
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
tauriConf.version = version;
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2));

const cargoPath = 'src-tauri/Cargo.toml';
let cargoToml = fs.readFileSync(cargoPath, 'utf8');
cargoToml = cargoToml.replace(/version = "[^"]+"/, `version = "${version}"`);
fs.writeFileSync(cargoPath, cargoToml);
