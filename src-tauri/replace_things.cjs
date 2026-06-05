const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/Administrator/Desktop/world-wiki/src-tauri/src/logic';

fs.readdirSync(dir).forEach(file => {
    if(file.endsWith('.rs')) {
        let p = path.join(dir, file);
        let content = fs.readFileSync(p, 'utf8');
        let initial = content;
        
        // Match type::thing('table', $var)
        content = content.replace(/type::thing\('([^']+)',\s*(\$[a-zA-Z0-9_]+)\)/g, "type::record(string::concat('$1:', $2))");
        
        // Also match the formatted one in volumes.rs: format!("UPDATE type::thing('{}', $id)...
        content = content.replace(/type::thing\('\{\}',\s*(\$[a-zA-Z0-9_]+)\)/g, "type::record(string::concat('{}', ':', $1))");
        
        if (content !== initial) {
            console.log(`Updated ${file}`);
            fs.writeFileSync(p, content);
        }
    }
});
